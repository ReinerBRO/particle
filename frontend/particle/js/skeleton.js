import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SnowEffect } from './snow.js';
import { ChristmasTree } from './christmasTree.js';
import { GiftBox } from './giftBox.js';
import { SantaCharacter } from './santa.js';

// Configurationss
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

// DOM Elements
const videoElement = document.getElementById('input-video');
const canvasContainer = document.getElementById('canvas-container');
const loadingElement = document.getElementById('loading');

// Three.js Globals
let scene, camera, renderer, controls;
let composer;
let snowEffect;
let christmasTree;

// Multi-Person Globals
const MAX_CHARACTERS = 2;
const characters = []; // Pool of AuraCharacter instances
let poseLandmarker = undefined;
let lastVideoTime = -1;

// MediaPipe Pose Connections (subset for simple skeleton)
const POSE_CONNECTIONS = [
    [11, 12], // Shoulders
    [11, 13], [13, 15], // Left Arm
    [12, 14], [14, 16], // Right Arm
    [11, 23], [12, 24], // Torso
    [23, 24], // Hips
    [23, 25], [25, 27], // Left Leg
    [24, 26], [26, 28], // Right Leg
    [27, 29], [27, 31], // Left Foot
    [28, 30], [28, 32], // Right Foot
    [15, 17], [15, 19], [15, 21], // Left Hand
    [16, 18], [16, 20], [16, 22], // Right Hand
    [0, 1], [1, 2], [2, 3], [3, 7], // Left Eye/Face
    [0, 4], [4, 5], [5, 6], [6, 8], // Right Eye/Face
    [9, 10] // Mouth
];

// Torso Triangles for volume filling
const TORSO_TRIANGLES = [
    [11, 12, 23], // Upper/Left torso
    [12, 24, 23]  // Lower/Right torso
];

class AuraCharacter {
    constructor(scene, colorIndex = 0) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.visible = false;
        this.colorIndex = colorIndex;
        this.showSkeleton = true;

        this.landmarksMap = {};
        this.particleSystem = null;
        this.giftBox = null;
        this.santa = null;
        this.mode = 'particle'; // 'particle' or 'santa'

        this.initSkeleton();
        this.createParticleSystem();
        this.initGiftBox();
        this.initSanta();
    }

    initSkeleton() {
        // Initialize Skeleton Meshes
        for (let i = 0; i < 33; i++) {
            // Joint (Sphere) - Glowing material
            const geometry = new THREE.SphereGeometry(0.05, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff88 }); // Bright green for glow
            const sphere = new THREE.Mesh(geometry, material);
            sphere.visible = false;
            this.group.add(sphere);
            this.landmarksMap[i] = sphere;
        }

        // Connections (Lines)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
        POSE_CONNECTIONS.forEach((pair) => {
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
            const line = new THREE.Line(geometry, lineMaterial);
            line.visible = false;
            line.userData = { start: pair[0], end: pair[1] };
            this.group.add(line);
        });
    }

    createParticleSystem() {
        const particleCount = 2000; // Reduced count per person for performance
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        // 0 = bone connection, 1 = torso triangle
        const types = new Float32Array(particleCount);
        // Index of the connection or triangle
        const targetIndices = new Float32Array(particleCount);
        // Interpolation factors (t for line, u/v for triangle)
        const lerpFactors = new Float32Array(particleCount * 2); // x=u/t, y=v
        const randomOffsets = new Float32Array(particleCount * 3);

        const color = new THREE.Color();

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;

            // Use colorIndex to assign unique hue for each person
            // Distribute hues evenly across color wheel
            const baseHue = (this.colorIndex * 0.2) % 1.0;
            const hueVariation = (Math.random() - 0.5) * 0.05;
            const hue = baseHue + hueVariation;
            color.setHSL(hue, 0.8, 0.6);

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            sizes[i] = Math.random() * 0.15;

            // 50% chance to be in torso volume
            if (Math.random() < 0.5) {
                targetIndices[i] = Math.floor(Math.random() * POSE_CONNECTIONS.length);
                lerpFactors[i * 2] = Math.random(); // t

                const thickness = 0.15;
                randomOffsets[i * 3] = (Math.random() - 0.5) * thickness;
                randomOffsets[i * 3 + 1] = (Math.random() - 0.5) * thickness;
                randomOffsets[i * 3 + 2] = (Math.random() - 0.5) * thickness;
            }
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        particles.setAttribute('type', new THREE.BufferAttribute(types, 1));
        particles.setAttribute('targetIndex', new THREE.BufferAttribute(targetIndices, 1));
        particles.setAttribute('lerpFactor', new THREE.BufferAttribute(lerpFactors, 2));
        particles.setAttribute('randomOffset', new THREE.BufferAttribute(randomOffsets, 3));

        const vertexShader = [
            'attribute float size;',
            'varying vec3 vColor;',
            'void main() {',
            '    vColor = color;',
            '    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
            '    gl_PointSize = size * (300.0 / -mvPosition.z);',
            '    gl_Position = projectionMatrix * mvPosition;',
            '}'
        ].join('\n');

        const fragmentShader = [
            'varying vec3 vColor;',
            'void main() {',
            '    float r = distance(gl_PointCoord, vec2(0.5));',
            '    if (r > 0.5) discard;',
            '    float glow = 1.0 - (r * 2.0);',
            '    glow = pow(glow, 2.0);',
            '    gl_FragColor = vec4(vColor, glow * 0.8);',
            '}'
        ].join('\n');

        const material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true
        });

        this.particleSystem = new THREE.Points(particles, material);
        this.group.add(this.particleSystem);
    }

    initGiftBox() {
        this.giftBox = new GiftBox(this.scene);
    }

    initSanta() {
        this.santa = new SantaCharacter(this.scene);
        this.santa.setVisible(false);
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'particle') {
            if (this.particleSystem) this.particleSystem.visible = true;
            if (this.santa) this.santa.setVisible(false);
        } else if (mode === 'santa') {
            if (this.particleSystem) this.particleSystem.visible = false;
            if (this.santa) this.santa.setVisible(true);
        }
    }

    update(landmarks) {
        this.visible = true;
        this.group.visible = true;

        // Update based on mode
        if (this.mode === 'particle') {
            this.updateParticles(landmarks);
        } else if (this.mode === 'santa') {
            if (this.santa) {
                this.santa.update(landmarks);
            }
        }

        // Common updates: Skeleton Debug View (respects showSkeleton flag)
        landmarks.forEach((landmark, index) => {
            const sphere = this.landmarksMap[index];
            if (sphere) {
                const x = (0.5 - landmark.x) * 2;
                const y = (1 - landmark.y) * 2;
                const z = -landmark.z;

                sphere.position.set(x, y, z);
                sphere.visible = this.showSkeleton;
            }
        });

        this.group.children.forEach(child => {
            if (child instanceof THREE.Line) {
                const startIdx = child.userData.start;
                const endIdx = child.userData.end;

                if (this.landmarksMap[startIdx] && this.landmarksMap[endIdx] &&
                    this.landmarksMap[startIdx].visible && this.landmarksMap[endIdx].visible) {

                    const positions = child.geometry.attributes.position.array;
                    const startPos = this.landmarksMap[startIdx].position;
                    const endPos = this.landmarksMap[endIdx].position;

                    positions[0] = startPos.x;
                    positions[1] = startPos.y;
                    positions[2] = startPos.z;

                    positions[3] = endPos.x;
                    positions[4] = endPos.y;
                    positions[5] = endPos.z;

                    child.geometry.attributes.position.needsUpdate = true;
                    child.visible = this.showSkeleton;
                } else {
                    child.visible = false;
                }
            }
        });

        // Update gift box based on hand gesture
        if (this.giftBox) {
            this.giftBox.update(landmarks);
        }
    }

    toggleSkeleton(show) {
        this.showSkeleton = show;
    }

    toggleParticles(show) {
        if (this.particleSystem) {
            this.particleSystem.visible = show;
        }
    }

    updateParticles(landmarks) {
        if (!this.particleSystem) return;

        const positions = this.particleSystem.geometry.attributes.position.array;
        const types = this.particleSystem.geometry.attributes.type.array;
        const targetIndices = this.particleSystem.geometry.attributes.targetIndex.array;
        const lerpFactors = this.particleSystem.geometry.attributes.lerpFactor.array;
        const randomOffsets = this.particleSystem.geometry.attributes.randomOffset.array;

        const time = Date.now() * 0.002;

        for (let i = 0; i < positions.length / 3; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;

            const type = types[i];
            const idx = targetIndices[i];

            let tx, ty, tz;

            if (type === 1) { // Torso Triangle
                const tri = TORSO_TRIANGLES[idx];
                const A = this.landmarksMap[tri[0]];
                const B = this.landmarksMap[tri[1]];
                const C = this.landmarksMap[tri[2]];

                if (!A || !B || !C) continue;

                const u = lerpFactors[i * 2];
                const v = lerpFactors[i * 2 + 1];

                const w = 1 - u - v;

                tx = w * A.position.x + u * B.position.x + v * C.position.x;
                ty = w * A.position.y + u * B.position.y + v * C.position.y;
                tz = w * A.position.z + u * B.position.z + v * C.position.z;

            } else { // Bone Line
                const pair = POSE_CONNECTIONS[idx];
                const startMesh = this.landmarksMap[pair[0]];
                const endMesh = this.landmarksMap[pair[1]];

                if (!startMesh || !endMesh) continue;

                const t = lerpFactors[i * 2];

                tx = startMesh.position.x * (1 - t) + endMesh.position.x * t;
                ty = startMesh.position.y * (1 - t) + endMesh.position.y * t;
                tz = startMesh.position.z * (1 - t) + endMesh.position.z * t;
            }

            // Add random offset
            tx += randomOffsets[ix];
            ty += randomOffsets[iy];
            tz += randomOffsets[iz];

            // Dynamic noise
            const noiseX = Math.sin(time + i) * 0.02;
            const noiseY = Math.cos(time + i * 0.5) * 0.02;
            const noiseZ = Math.sin(time * 0.5 + i) * 0.02;

            const destX = tx + noiseX;
            const destY = ty + noiseY;
            const destZ = tz + noiseZ;

            positions[ix] += (destX - positions[ix]) * 0.2;
            positions[iy] += (destY - positions[iy]) * 0.2;
            positions[iz] += (destZ - positions[iz]) * 0.2;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    hide() {
        this.visible = false;
        this.group.visible = false;

        // Hide gift box when character is hidden
        if (this.giftBox) {
            this.giftBox.hide();
        }
    }
}

// Initialize Application
async function init() {
    try {
        initThreeJS();
        await initMediaPipe();
    } catch (error) {
        console.error('Critical initialization error:', error);
        loadingElement.textContent = 'Critical Error: ' + error.message;
        loadingElement.style.color = 'red';
    }
}

function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Grid Helper - Darker for contrast
    const gridHelper = new THREE.GridHelper(10, 10, 0x222222, 0x111111);
    scene.add(gridHelper);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 3);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    canvasContainer.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.update();

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(2, 2, 5);
    scene.add(directionalLight);

    // Initialize Character Pool with unique colors
    for (let i = 0; i < MAX_CHARACTERS; i++) {
        characters.push(new AuraCharacter(scene, i));
    }

    // Post-Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 2.0;
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Snow Effect
    snowEffect = new SnowEffect(scene);

    // Christmas Tree
    christmasTree = new ChristmasTree(scene);

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);

    // Start Animation Loop
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Update snow effect
    if (snowEffect) {
        snowEffect.update();
    }

    // Update Christmas tree
    if (christmasTree) {
        christmasTree.update(Date.now() * 0.001);
    }

    // Render MediaPipe
    if (poseLandmarker && videoElement.currentTime !== lastVideoTime) {
        if (videoElement.videoWidth > 0) {
            lastVideoTime = videoElement.currentTime;
            const startTimeMs = performance.now();
            const result = poseLandmarker.detectForVideo(videoElement, startTimeMs);

            // Reset all characters to hidden
            characters.forEach(char => char.hide());

            if (result.landmarks) {
                // Assign each detected pose to a character
                result.landmarks.forEach((landmarks, index) => {
                    if (index < characters.length) {
                        characters[index].update(landmarks);
                    }
                });
            }
        }
    }

    composer.render();
}

async function initMediaPipe() {
    try {
        loadingElement.textContent = 'Loading MediaPipe Library...';

        // Dynamic import to catch loading errors
        const { PoseLandmarker, FilesetResolver } = await import(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/+esm"
        );

        loadingElement.textContent = 'Loading Vision Tasks...';
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        loadingElement.textContent = 'Loading Pose Model...';
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: MAX_CHARACTERS,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        loadingElement.textContent = 'Starting Camera...';
        // Start Camera
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: VIDEO_WIDTH,
                    height: VIDEO_HEIGHT,
                    facingMode: 'user'
                }
            });
            videoElement.srcObject = stream;
            videoElement.addEventListener('loadeddata', () => {
                videoElement.play();
                loadingElement.style.display = 'none';
            });
        } else {
            loadingElement.textContent = 'Webcam not supported';
        }
    } catch (error) {
        console.error('Error initializing MediaPipe:', error);
        loadingElement.textContent = 'Error: ' + error.message;
        loadingElement.style.color = 'red';
        // Check for common import errors
        if (error.message && error.message.includes('import')) {
            loadingElement.textContent += ' (Failed to load MediaPipe library. Check internet connection.)';
        }
    }
}

// Start
init();

// Toggle skeleton visibility
const toggleButton = document.getElementById('toggle-skeleton');
let skeletonVisible = true;

toggleButton.addEventListener('click', () => {
    skeletonVisible = !skeletonVisible;
    characters.forEach(char => char.toggleSkeleton(skeletonVisible));
    toggleButton.textContent = skeletonVisible ? 'Hide Skeleton' : 'Show Skeleton';
});

// Toggle particles visibility
const toggleParticlesButton = document.getElementById('toggle-particles');
let particlesVisible = true;

toggleParticlesButton.addEventListener('click', () => {
    particlesVisible = !particlesVisible;
    characters.forEach(char => char.toggleParticles(particlesVisible));
    toggleParticlesButton.textContent = particlesVisible ? 'Hide Particles' : 'Show Particles';
});

// Toggle camera visibility
const toggleCameraButton = document.getElementById('toggle-camera');
const videoContainer = document.getElementById('video-container');
let cameraVisible = true;

toggleCameraButton.addEventListener('click', () => {
    cameraVisible = !cameraVisible;
    videoContainer.style.display = cameraVisible ? 'block' : 'none';
    toggleCameraButton.textContent = cameraVisible ? 'Hide Camera' : 'Show Camera';
});

// Toggle Santa Mode
const toggleSantaButton = document.getElementById('toggle-santa');
let isSantaMode = false;

toggleSantaButton.addEventListener('click', () => {
    isSantaMode = !isSantaMode;
    const mode = isSantaMode ? 'santa' : 'particle';
    characters.forEach(char => char.setMode(mode));
    toggleSantaButton.textContent = isSantaMode ? 'Particle Mode' : 'Santa Mode';
});
