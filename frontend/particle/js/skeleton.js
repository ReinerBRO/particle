import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Configuration
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

// DOM Elements
const videoElement = document.getElementById('input-video');
const canvasContainer = document.getElementById('canvas-container');
const loadingElement = document.getElementById('loading');

// Three.js Globals
let scene, camera, renderer, controls;
let composer;
let skeletonGroup;
let particleSystem;
const landmarksMap = {}; // Map to store mesh objects for each landmark

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

// Initialize Application
async function init() {
    initThreeJS();
    initMediaPipe();
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
    renderer = new THREE.WebGLRenderer({ antialias: false }); // Antialias false for post-processing performance
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

    // Skeleton Container
    skeletonGroup = new THREE.Group();
    scene.add(skeletonGroup);

    // Initialize Skeleton Meshes
    for (let i = 0; i < 33; i++) {
        // Joint (Sphere) - Glowing material
        const geometry = new THREE.SphereGeometry(0.05, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff88 }); // Bright green for glow
        const sphere = new THREE.Mesh(geometry, material);
        sphere.visible = false;
        skeletonGroup.add(sphere);
        landmarksMap[i] = sphere;
    }

    // Connections (Lines)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
    POSE_CONNECTIONS.forEach((pair, index) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
        const line = new THREE.Line(geometry, lineMaterial);
        line.visible = false;
        line.userData = { start: pair[0], end: pair[1] };
        skeletonGroup.add(line);
    });

    // Particle System
    createParticleSystem();

    // Post-Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 2.0; // High strength for strong glow
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);

    // Start Animation Loop
    animate();
}

// Torso Triangles for volume filling
const TORSO_TRIANGLES = [
    [11, 12, 23], // Upper/Left torso
    [12, 24, 23]  // Lower/Right torso
];

function createParticleSystem() {
    const particleCount = 5000; // Increased count
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

        const hue = 0.5 + Math.random() * 0.2;
        color.setHSL(hue, 0.8, 0.6);

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = Math.random() * 0.15;

        // 50% chance to be in torso volume
        if (Math.random() < 0.5) {
            types[i] = 1; // Torso
            targetIndices[i] = Math.floor(Math.random() * TORSO_TRIANGLES.length);

            // Random barycentric coordinates
            let u = Math.random();
            let v = Math.random();
            if (u + v > 1) {
                u = 1 - u;
                v = 1 - v;
            }
            lerpFactors[i * 2] = u;
            lerpFactors[i * 2 + 1] = v;

            // Thicker volume for torso
            // X/Y thickness
            const thicknessXY = 0.5;
            // Z thickness (depth) - make it deeper to simulate body volume
            const thicknessZ = 0.8;

            randomOffsets[i * 3] = (Math.random() - 0.5) * thicknessXY;
            randomOffsets[i * 3 + 1] = (Math.random() - 0.5) * thicknessXY;
            randomOffsets[i * 3 + 2] = (Math.random() - 0.5) * thicknessZ;

        } else {
            types[i] = 0; // Bone
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

    const vertexShader = `
        attribute float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        varying vec3 vColor;
        void main() {
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;
            float glow = 1.0 - (r * 2.0);
            glow = pow(glow, 2.0);
            gl_FragColor = vec4(vColor, glow * 0.8);
        }
    `;

    const material = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true,
        vertexColors: true
    });

    particleSystem = new THREE.Points(particles, material);
    scene.add(particleSystem);
}

function updateParticles() {
    if (!particleSystem) return;

    const positions = particleSystem.geometry.attributes.position.array;
    const types = particleSystem.geometry.attributes.type.array;
    const targetIndices = particleSystem.geometry.attributes.targetIndex.array;
    const lerpFactors = particleSystem.geometry.attributes.lerpFactor.array;
    const randomOffsets = particleSystem.geometry.attributes.randomOffset.array;

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
            const A = landmarksMap[tri[0]];
            const B = landmarksMap[tri[1]];
            const C = landmarksMap[tri[2]];

            if (!A || !A.visible || !B || !B.visible || !C || !C.visible) continue;

            const u = lerpFactors[i * 2];
            const v = lerpFactors[i * 2 + 1];

            // P = A + u(B-A) + v(C-A)
            // P = (1-u-v)A + uB + vC
            const w = 1 - u - v;

            tx = w * A.position.x + u * B.position.x + v * C.position.x;
            ty = w * A.position.y + u * B.position.y + v * C.position.y;
            tz = w * A.position.z + u * B.position.z + v * C.position.z;

        } else { // Bone Line
            const pair = POSE_CONNECTIONS[idx];
            const startMesh = landmarksMap[pair[0]];
            const endMesh = landmarksMap[pair[1]];

            if (!startMesh || !startMesh.visible || !endMesh || !endMesh.visible) continue;

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

    particleSystem.geometry.attributes.position.needsUpdate = true;
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
    updateParticles();
    composer.render();
}

function initMediaPipe() {
    const pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await pose.send({ image: videoElement });
        },
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT
    });

    camera.start()
        .then(() => {
            console.log('Camera started');
            loadingElement.style.display = 'none';
        })
        .catch(err => {
            console.error('Error starting camera:', err);
            loadingElement.textContent = 'Error starting camera: ' + err.message;
        });
}

function onPoseResults(results) {
    if (!results.poseLandmarks) {
        return;
    }

    // Calculate center of mass (approximate with hips/torso)
    let centerX = 0, centerY = 0, centerZ = 0;
    let count = 0;

    // Update Joints
    results.poseLandmarks.forEach((landmark, index) => {
        const sphere = landmarksMap[index];
        if (sphere) {
            // MediaPipe coordinates: x (0-1), y (0-1), z (approx meters, relative to hips)
            // We need to map this to our 3D world.
            // Invert X because webcam is mirrored usually, but we mirrored video element.
            // Actually, let's just map directly and see.
            // MP: +y is down. ThreeJS: +y is up.

            // Scale and offset to fit in view
            const x = (0.5 - landmark.x) * 2; // Center at 0
            const y = (1 - landmark.y) * 2;   // Flip Y, scale
            const z = -landmark.z;            // Flip Z for standard view

            sphere.position.set(x, y, z);
            sphere.visible = true;

            // Accumulate for center calculation (using torso points)
            if ([11, 12, 23, 24].includes(index)) {
                centerX += x;
                centerY += y;
                centerZ += z;
                count++;
            }
        }
    });

    // Update Particles Target
    // Particles are now updated in animate() loop using the landmarksMap directly

    // Update Connections
    skeletonGroup.children.forEach(child => {
        if (child instanceof THREE.Line) {
            const startIdx = child.userData.start;
            const endIdx = child.userData.end;

            if (landmarksMap[startIdx] && landmarksMap[endIdx] &&
                landmarksMap[startIdx].visible && landmarksMap[endIdx].visible) {

                const positions = child.geometry.attributes.position.array;
                const startPos = landmarksMap[startIdx].position;
                const endPos = landmarksMap[endIdx].position;

                positions[0] = startPos.x;
                positions[1] = startPos.y;
                positions[2] = startPos.z;

                positions[3] = endPos.x;
                positions[4] = endPos.y;
                positions[5] = endPos.z;

                child.geometry.attributes.position.needsUpdate = true;
                child.visible = true;
            } else {
                child.visible = false;
            }
        }
    });
}

// Start
init();
