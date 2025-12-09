import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SnowEffect } from './snow.js';
import { SnowGround } from './snowGround.js';
import { ChristmasTree } from './christmasTree.js';
import { GiftBox } from './giftBox.js';
import { ModelCharacter, AVAILABLE_MODELS } from './modelCharacter.js';
import { generateEmotionPoem } from './audioManager.js';
import { ChristmasEnvelope } from './christmasEnvelope.js';
import { StoryFragments } from './storyFragments.js';
import PS5SceneController from './ps5SceneController.js';

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
let snowGround;
let christmasTree;
let christmasEnvelope;

// Multi-Person Globals
const MAX_CHARACTERS = 2;
const characters = []; // Pool of AuraCharacter instances
let poseLandmarker = undefined;
let handLandmarker = undefined; // 手部关键点检测器
let lastVideoTime = -1;
let storyFragments = null; // 故事碎片系统
let bokehLights = null; // Christmas bokeh light particles
let globalModelVisible = true; // Global flag for model visibility

// Tree gifts system
let treeGifts = []; // Array of gifts hanging on the tree
const MAX_TREE_GIFTS = 10;
let lastGiftTime = 0;

// PS5 Controller
let ps5Controller = null;

// Hang a gift on the Christmas tree
function hangGiftOnTree() {
    if (treeGifts.length >= MAX_TREE_GIFTS) {
        console.log('[Gift] Max tree gifts reached');
        return;
    }

    if (!scene) return;

    // Create a gift box group
    const giftGroup = new THREE.Group();

    // Main box (red)
    const boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const boxMaterial = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0xff0000 : 0x00aa00, // Red or Green
        emissive: 0x330000,
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.2
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    giftGroup.add(box);

    // Gold ribbon
    const ribbonMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 0.3,
        roughness: 0.4,
        metalness: 0.6
    });

    const ribbonV = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.03), ribbonMaterial);
    const ribbonH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.22), ribbonMaterial);
    giftGroup.add(ribbonV);
    giftGroup.add(ribbonH);

    // Bow
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), ribbonMaterial);
    bow.position.y = 0.1;
    giftGroup.add(bow);

    // Random position on tree (cone distribution)
    // Tree is at (0, 0, -4), height ~3.5 units
    const treeBaseY = 0.5;
    const treeHeight = 3.0;
    const y = treeBaseY + Math.random() * treeHeight;

    // Radius decreases with height
    const maxRadius = 1.2 * (1 - (y - treeBaseY) / treeHeight);
    const radius = 0.3 + Math.random() * maxRadius * 0.8;
    const angle = Math.random() * Math.PI * 2;

    const x = Math.cos(angle) * radius;
    const z = -4 + Math.sin(angle) * radius; // Tree is at z = -4

    giftGroup.position.set(x, y, z);
    giftGroup.userData = {
        swingPhase: Math.random() * Math.PI * 2,
        swingSpeed: 0.5 + Math.random() * 0.5
    };

    scene.add(giftGroup);
    treeGifts.push(giftGroup);

    console.log(`[Gift] Hung gift on tree at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}). Total: ${treeGifts.length}`);
}

// Update tree gifts animation (gentle swinging)
function updateTreeGifts(time) {
    treeGifts.forEach(gift => {
        const phase = gift.userData.swingPhase;
        const speed = gift.userData.swingSpeed;
        gift.rotation.z = Math.sin(time * speed + phase) * 0.1;
        gift.rotation.x = Math.cos(time * speed * 0.7 + phase) * 0.05;
    });
}

// Bokeh Light Particles - Creates dreamy floating light orbs
function createBokehLights() {
    const particleCount = 80;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = [];

    // Warm Christmas colors: gold, orange, warm white, soft red
    const bokehColors = [
        new THREE.Color(0xffcc66), // Warm gold
        new THREE.Color(0xff9944), // Orange
        new THREE.Color(0xffeebb), // Warm white
        new THREE.Color(0xff6655), // Soft red
        new THREE.Color(0x88aaff), // Cool blue (accent)
        new THREE.Color(0xaaffaa), // Soft green
    ];

    for (let i = 0; i < particleCount; i++) {
        // Spread lights across the scene
        positions[i * 3] = (Math.random() - 0.5) * 20;     // x: -10 to 10
        positions[i * 3 + 1] = Math.random() * 8 - 1;       // y: -1 to 7
        positions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5; // z: -12.5 to 2.5

        // Random warm color
        const color = bokehColors[Math.floor(Math.random() * bokehColors.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // Varied sizes for depth effect
        sizes[i] = Math.random() * 0.3 + 0.1;

        // Slow drift velocities
        velocities.push({
            x: (Math.random() - 0.5) * 0.002,
            y: (Math.random() - 0.5) * 0.001,
            z: (Math.random() - 0.5) * 0.001
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader for soft, glowing bokeh effect
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            opacity: { value: 0.7 }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            varying float vSize;
            void main() {
                vColor = color;
                vSize = size;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float opacity;
            varying vec3 vColor;
            varying float vSize;
            void main() {
                // Soft circular gradient (bokeh effect)
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                
                // Soft glow falloff
                float alpha = smoothstep(0.5, 0.0, dist) * opacity;
                alpha *= 0.5 + 0.5 * sin(time * 2.0 + vSize * 10.0); // Gentle twinkle
                
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    bokehLights = new THREE.Points(geometry, material);
    bokehLights.userData.velocities = velocities;
    scene.add(bokehLights);
}

// Update bokeh lights animation
function updateBokehLights(time) {
    if (!bokehLights) return;

    bokehLights.material.uniforms.time.value = time;

    const positions = bokehLights.geometry.attributes.position.array;
    const velocities = bokehLights.userData.velocities;

    for (let i = 0; i < velocities.length; i++) {
        positions[i * 3] += velocities[i].x;
        positions[i * 3 + 1] += velocities[i].y;
        positions[i * 3 + 2] += velocities[i].z;

        // Wrap around boundaries
        if (positions[i * 3] > 10) positions[i * 3] = -10;
        if (positions[i * 3] < -10) positions[i * 3] = 10;
        if (positions[i * 3 + 1] > 7) positions[i * 3 + 1] = -1;
        if (positions[i * 3 + 1] < -1) positions[i * 3 + 1] = 7;
    }

    bokehLights.geometry.attributes.position.needsUpdate = true;
}

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
        this.showSkeleton = false; // Disable skeleton by default

        this.landmarksMap = {};
        this.particleSystem = null;
        this.giftBox = null;
        this.modelCharacter = null;  // 统一的 3D 模型角色
        this.mode = 'model'; // Default to 'model'
        this.currentModelId = null;
        this.lastSwitchTime = 0;

        // Audio & Poem State
        this.isRecording = false;
        this.hasPoem = false;
        this.poemText = "";
        this.userWords = ""; // 用户原话
        this.ringParticles = null;
        this.showingPoem = false; // 当前是否正在显示诗歌卡片
        this.ringMode = 'idle'; // 'idle', 'recording', 'ready', 'expanding'



        // 两指手势状态（用于选择故事）
        this.isTwoFingerGesture = false;
        this.isOneFingerGesture = false;
        this.twoFingerStartTime = 0;
        this.handLandmarks = null;

        // 滑动检测状态
        this.lastHandX = null;
        this.slideThreshold = 0.08; // 滑动阈值
        this.slideCooldown = 0;
        this.slideAccumulator = 0; // 滑动累加器，用于连续切换
        this.slideAnimationTimeout = null; // 动画定时器

        this.initSkeleton();
        this.createParticleSystem();
        this.initGiftBox();
        this.initModelCharacter();
        // this.initRingParticles(); // 禁用脚下光环效果

    }



    initRingParticles() {
        // 使用更多粒子，分多层创建更漂亮的光环
        const ringLayers = 3; // 多层光环
        const particlesPerLayer = 80;
        const particleCount = ringLayers * particlesPerLayer;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const angles = new Float32Array(particleCount);
        const layers = new Float32Array(particleCount); // 记录每个粒子所在层

        // 更柔和的圣诞配色 - 金色为主
        const christmasColors = [
            new THREE.Color(0xffd700), // Gold (主色)
            new THREE.Color(0xffaa00), // Orange Gold
            new THREE.Color(0xffee88), // Light Gold
            new THREE.Color(0xffffff), // White sparkle
        ];

        let idx = 0;
        for (let layer = 0; layer < ringLayers; layer++) {
            for (let i = 0; i < particlesPerLayer; i++) {
                const angle = (i / particlesPerLayer) * Math.PI * 2 + layer * 0.3;
                angles[idx] = angle;
                layers[idx] = layer;

                // Initial positions
                positions[idx * 3] = Math.cos(angle);
                positions[idx * 3 + 1] = 0;
                positions[idx * 3 + 2] = Math.sin(angle);

                // 内层金色，外层白色闪烁
                const colorIdx = layer === 0 ? 0 : (layer === 1 ? 1 : Math.floor(Math.random() * christmasColors.length));
                const color = christmasColors[colorIdx];
                colors[idx * 3] = color.r;
                colors[idx * 3 + 1] = color.g;
                colors[idx * 3 + 2] = color.b;

                // 内层粒子大，外层小
                sizes[idx] = layer === 0 ? 0.025 : (layer === 1 ? 0.02 : 0.015);
                idx++;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
        geometry.setAttribute('layer', new THREE.BufferAttribute(layers, 1));

        const material = new THREE.PointsMaterial({
            size: 0.06,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        this.ringParticles = new THREE.Points(geometry, material);
        this.ringParticles.visible = false;
        this.group.add(this.ringParticles);

        // 存储光环基础位置和参数
        this.ringBasePosition = { x: 0, y: 0, z: 0 };
        this.ringExpandProgress = 0;
        this.ringLayers = ringLayers;
        this.particlesPerLayer = particlesPerLayer;
    }

    updateRingParticles(landmarks) {
        if (!this.ringParticles) return;

        // 如果正在显示诗歌卡片，隐藏光环
        if (this.showingPoem) {
            this.ringParticles.visible = false;
            return;
        }

        // 只有在录音中或有诗歌准备好时才显示光环
        if (!this.isRecording && !this.hasPoem) {
            this.ringParticles.visible = false;
            return;
        }

        // 使用脚踝位置（27, 28）计算脚下中心
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        // 也获取脚尖位置用于更精确的定位
        const leftHeel = landmarks[29];
        const rightHeel = landmarks[30];

        if (!leftAnkle || !rightAnkle) return;

        // 计算脚下中心位置 - 使用脚踝中点
        const centerX = ((0.5 - leftAnkle.x) * 2 + (0.5 - rightAnkle.x) * 2) / 2;
        // 稍微降低Y位置，让光环更贴近地面
        const footY = Math.max(
            (1 - leftAnkle.y) * 2,
            (1 - rightAnkle.y) * 2
        );
        const centerY = footY - 0.15; // 往下偏移，更贴近脚下
        const centerZ = (-leftAnkle.z - rightAnkle.z) / 2;

        this.ringBasePosition = { x: centerX, y: centerY, z: centerZ };

        this.ringParticles.visible = true;
        const positions = this.ringParticles.geometry.attributes.position.array;
        const angles = this.ringParticles.geometry.attributes.angle.array;
        const layerAttr = this.ringParticles.geometry.attributes.layer;
        const layers = layerAttr ? layerAttr.array : null;
        const sizes = this.ringParticles.geometry.attributes.size.array;
        const time = Date.now() * 0.002;

        // 根据状态调整光环效果 - 更小的基础半径
        let baseRadius = this.hasPoem ? 0.25 : 0.2;
        let pulseSpeed = this.isRecording ? 0.006 : 0.003;
        let pulseAmount = this.isRecording ? 0.12 : 0.06;

        // 柔和的呼吸效果
        const pulse = 1 + Math.sin(Date.now() * pulseSpeed) * pulseAmount;

        const particleCount = positions.length / 3;
        for (let i = 0; i < particleCount; i++) {
            const baseAngle = angles[i];
            const layer = layers ? layers[i] : 0;

            // 每层不同的旋转速度和半径
            const layerSpeed = 1 + layer * 0.3;
            const layerRadius = baseRadius * (1 + layer * 0.15);
            const angle = baseAngle + time * layerSpeed;

            const radius = layerRadius * pulse;

            // 轻微的垂直波动 - 更小幅度
            const waveOffset = Math.sin(baseAngle * 4 + time * 3) * 0.015 * (layer + 1);

            positions[i * 3] = centerX + Math.cos(angle) * radius;
            positions[i * 3 + 1] = centerY + waveOffset;
            positions[i * 3 + 2] = centerZ + Math.sin(angle) * radius;

            // 动态大小 - 更精致
            const baseSize = layer === 0 ? 0.025 : (layer === 1 ? 0.02 : 0.015);
            sizes[i] = baseSize * (0.8 + Math.sin(time * 2 + baseAngle) * 0.2);
        }

        this.ringParticles.geometry.attributes.position.needsUpdate = true;
        this.ringParticles.geometry.attributes.size.needsUpdate = true;

        // 调整透明度 - 有诗歌时更亮
        this.ringParticles.material.opacity = this.hasPoem ? 0.95 : 0.75;
    }

    disperseRing() {
        if (!this.ringParticles) return;

        // 触发扩散动画
        this.ringExpandProgress = 0;
        const startTime = Date.now();
        const duration = 800; // 800ms动画

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用ease-out缓动
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            if (this.ringParticles && this.ringParticles.visible) {
                const positions = this.ringParticles.geometry.attributes.position.array;
                const angles = this.ringParticles.geometry.attributes.angle.array;

                for (let i = 0; i < positions.length / 3; i++) {
                    const angle = angles[i];
                    const expandRadius = 0.5 + easeProgress * 3; // 扩展到更大半径
                    const rise = easeProgress * 2; // 上升

                    positions[i * 3] = this.ringBasePosition.x + Math.cos(angle) * expandRadius;
                    positions[i * 3 + 1] = this.ringBasePosition.y + rise;
                    positions[i * 3 + 2] = this.ringBasePosition.z + Math.sin(angle) * expandRadius;
                }

                this.ringParticles.geometry.attributes.position.needsUpdate = true;
                this.ringParticles.material.opacity = 1 - easeProgress;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.ringParticles.visible = false;
                    this.ringParticles.material.opacity = 0.8;
                }
            }
        };

        animate();
    }

    // 收回光环动画（从展开状态回到脚下）
    collapseRing(landmarks) {
        if (!this.ringParticles || !this.showingPoem) return;

        const leftFoot = landmarks[27];
        const rightFoot = landmarks[28];
        if (!leftFoot || !rightFoot) return;

        const centerX = ((0.5 - leftFoot.x) * 2 + (0.5 - rightFoot.x) * 2) / 2;
        const centerY = ((1 - leftFoot.y) * 2 + (1 - rightFoot.y) * 2) / 2;
        const centerZ = (-leftFoot.z - rightFoot.z) / 2;

        this.ringBasePosition = { x: centerX, y: centerY, z: centerZ };
        this.ringParticles.visible = true;
        this.ringParticles.material.opacity = 0.8;
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
        this.particleSystem.visible = (this.mode === 'particle');
        this.group.add(this.particleSystem);
    }

    initGiftBox() {
        this.giftBox = new GiftBox(this.scene);
    }

    initModelCharacter() {
        this.modelCharacter = new ModelCharacter(this.scene);
        this.modelCharacter.setVisible(this.mode === 'model');

        // Randomly select a model
        if (AVAILABLE_MODELS.length > 0) {
            const randomModel = AVAILABLE_MODELS[Math.floor(Math.random() * AVAILABLE_MODELS.length)];
            this.setModel(randomModel.id);
        }
    }

    async setModel(modelId) {
        if (this.modelCharacter) {
            await this.modelCharacter.loadModel(modelId);
            this.currentModelId = modelId;
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'particle') {
            if (this.particleSystem) this.particleSystem.visible = true;
            if (this.modelCharacter) this.modelCharacter.setVisible(false);
        } else if (mode === 'model') {
            if (this.particleSystem) this.particleSystem.visible = false;
            if (this.modelCharacter) this.modelCharacter.setVisible(true);
        }
    }

    async switchRandomModel() {
        if (AVAILABLE_MODELS.length <= 1) return;

        let newModel;
        // Try to find a different model
        let attempts = 0;
        do {
            newModel = AVAILABLE_MODELS[Math.floor(Math.random() * AVAILABLE_MODELS.length)];
            attempts++;
        } while (newModel.id === this.currentModelId && attempts < 5);

        console.log(`Switching to model: ${newModel.name}`);
        await this.setModel(newModel.id);
    }

    detectHandsUp(landmarks) {
        // MediaPipe landmarks: 0 is nose, 15 is left wrist, 16 is right wrist
        // Y axis: 0 is top, 1 is bottom. So "above" means smaller Y value.
        const nose = landmarks[0];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        if (!nose || !leftWrist || !rightWrist) return false;

        // Check if both wrists are above the nose
        return leftWrist.y < nose.y && rightWrist.y < nose.y;
    }

    // Detect presenting gesture (hands together in front) to trigger hanging gift
    detectPresentingGesture(landmarks) {
        if (!landmarks || landmarks.length < 33) return false;

        // Get wrist positions (landmarks 15 and 16)
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        if (!leftWrist || !rightWrist) return false;

        // Calculate distance between wrists
        const dx = leftWrist.x - rightWrist.x;
        const dy = leftWrist.y - rightWrist.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if hands are at similar height
        const heightDiff = Math.abs(dy);

        // Presenting gesture criteria:
        // 1. Hands are close together (0.08 to 0.35 units apart)
        // 2. Hands are at similar height
        const isPresenting = (
            distance > 0.08 && distance < 0.35 &&
            heightDiff < 0.15
        );

        return isPresenting;
    }

    detectOpenArms(landmarks) {
        // 原本是张开双臂，现在改为不使用
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return false;

        const isLeftOpen = leftWrist.x < leftShoulder.x - 0.1;
        const isRightOpen = rightWrist.x > rightShoulder.x + 0.1;

        return isLeftOpen && isRightOpen;
    }

    // 检测双手环胸手势
    detectArmsCrossed(landmarks) {
        // 11: Left Shoulder, 12: Right Shoulder
        // 13: Left Elbow, 14: Right Elbow  
        // 15: Left Wrist, 16: Right Wrist
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftElbow = landmarks[13];
        const rightElbow = landmarks[14];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist) {
            return false;
        }

        // 计算肩膀中心
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

        // 双手环胸的特征:
        // 1. 两个手腕都在身体中线附近（x坐标接近肩膀中心）
        // 2. 手腕在肩膀下方但不会太低（胸口位置）
        // 3. 左手腕在右肩附近，右手腕在左肩附近（交叉）

        // 检查手腕是否在胸口高度（肩膀下方一点）
        const chestY = shoulderCenterY + 0.15; // 胸口位置
        const isLeftWristAtChest = leftWrist.y > shoulderCenterY && leftWrist.y < shoulderCenterY + 0.3;
        const isRightWristAtChest = rightWrist.y > shoulderCenterY && rightWrist.y < shoulderCenterY + 0.3;

        // 检查手腕是否交叉到对侧
        // 左手腕应该在右侧（x值更大），右手腕应该在左侧（x值更小）
        const isLeftCrossed = leftWrist.x > shoulderCenterX - 0.05; // 左手到了中线右侧
        const isRightCrossed = rightWrist.x < shoulderCenterX + 0.05; // 右手到了中线左侧

        // 检查手腕是否靠近身体中心（不能太远）
        const leftWristNearCenter = Math.abs(leftWrist.x - shoulderCenterX) < 0.2;
        const rightWristNearCenter = Math.abs(rightWrist.x - shoulderCenterX) < 0.2;

        return isLeftWristAtChest && isRightWristAtChest &&
            isLeftCrossed && isRightCrossed &&
            leftWristNearCenter && rightWristNearCenter;
    }



    /**
     * 设置手部关键点数据
     */
    setHandLandmarks(handLandmarks) {
        this.handLandmarks = handLandmarks;
    }

    /**
     * 检测手指伸出状态
     * 返回: { oneFinger: bool, twoFinger: bool, handX: number }
     */
    detectFingerGesture() {
        if (!this.handLandmarks || this.handLandmarks.length === 0) {
            return { oneFinger: false, twoFinger: false, handX: null };
        }

        const hand = this.handLandmarks[0];
        if (!hand || hand.length < 21) {
            return { oneFinger: false, twoFinger: false, handX: null };
        }

        // 获取关键点
        const wrist = hand[0];
        const thumbTip = hand[4];
        const thumbIP = hand[3];
        const indexTip = hand[8];
        const indexPIP = hand[6];
        const middleTip = hand[12];
        const middlePIP = hand[10];
        const ringTip = hand[16];
        const ringPIP = hand[14];
        const pinkyTip = hand[20];
        const pinkyPIP = hand[18];

        // 检查拇指是否伸出
        const thumbExtended = thumbTip.y < thumbIP.y ||
            Math.abs(thumbTip.x - wrist.x) > Math.abs(thumbIP.x - wrist.x) * 1.2;

        // 检查各手指是否伸出（指尖高于PIP关节）
        const indexExtended = indexTip.y < indexPIP.y - 0.02;
        const middleExtended = middleTip.y < middlePIP.y - 0.02;
        const ringExtended = ringTip.y < ringPIP.y - 0.02;
        const pinkyExtended = pinkyTip.y < pinkyPIP.y - 0.02;

        // 单指：仅食指伸出
        const oneFinger = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

        // 双指：(食指+拇指) 或 (食指+中指) 伸出
        // 拇指+食指
        const thumbIndex = thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
        // 食指+中指
        const indexMiddle = indexExtended && middleExtended && !ringExtended && !pinkyExtended;

        const twoFinger = thumbIndex || indexMiddle;

        // 手的X位置（用于滑动检测）
        const handX = wrist.x;

        return { oneFinger, twoFinger, handX };
    }

    /**
     * 检测并处理手势
     */
    detectAndHandleTwoFingerGesture() {
        const gesture = this.detectFingerGesture();

        // 减少滑动冷却 (更快恢复)
        if (this.slideCooldown > 0) {
            this.slideCooldown--;
        }

        // 单指手势 - 读取故事
        if (gesture.oneFinger) {
            if (!this.isOneFingerGesture) {
                this.isOneFingerGesture = true;
                console.log('[Gesture] One finger - read story');

                if (storyFragments && !storyFragments.isStoryExpanded()) {
                    const story = storyFragments.expandCurrentStory();
                    if (story) {
                        this.showStoryUI(story);
                    }
                }
            }
        } else {
            if (this.isOneFingerGesture) {
                this.isOneFingerGesture = false;
                console.log('[Gesture] One finger released');

                if (storyFragments && storyFragments.isStoryExpanded()) {
                    storyFragments.collapseStory();
                    this.hideStoryUI();
                }
            }
        }

        // 双指手势 - 滑动切换
        if (gesture.twoFinger) {
            if (!this.isTwoFingerGesture) {
                this.isTwoFingerGesture = true;
                this.lastHandX = gesture.handX;
                this.slideAccumulator = 0; // 重置累加器
                console.log('[Gesture] Two fingers - slide mode');
            } else if (gesture.handX !== null && this.lastHandX !== null) {
                const deltaX = gesture.handX - this.lastHandX;
                this.slideAccumulator += deltaX;

                // 连续滑动逻辑：当累积移动超过阈值时切换
                // 阈值越小，切换越灵敏
                const switchThreshold = 0.05;

                if (Math.abs(this.slideAccumulator) > switchThreshold) {
                    // 只有冷却结束才允许切换，防止过快
                    if (this.slideCooldown === 0) {
                        if (this.slideAccumulator > 0) {
                            // 手向右移动 = 向左切换（前一个）
                            console.log('[Gesture] Slide left (Previous)');
                            if (storyFragments) {
                                storyFragments.slideLeft();
                                this.triggerSlideAnimation(-1);
                            }
                        } else {
                            // 手向左移动 = 向右切换（下一个）
                            console.log('[Gesture] Slide right (Next)');
                            if (storyFragments) {
                                storyFragments.slideRight();
                                this.triggerSlideAnimation(1);
                            }
                        }

                        // 切换后重置累加器的一部分，而不是全部清零，以支持非常快速的滑动
                        // 或者减去阈值，保持剩余的移动量
                        if (this.slideAccumulator > 0) {
                            this.slideAccumulator -= switchThreshold;
                        } else {
                            this.slideAccumulator += switchThreshold;
                        }

                        // 设置较短的冷却时间，避免一帧内多次切换
                        this.slideCooldown = 8; // 8帧冷却 (约130ms)
                    }
                }

                this.lastHandX = gesture.handX;
            }
        } else {
            if (this.isTwoFingerGesture) {
                this.isTwoFingerGesture = false;
                this.lastHandX = null;
                this.slideAccumulator = 0;
                console.log('[Gesture] Two fingers released');
            }
        }
    }

    /**
     * 触发滑动动画效果 (仅内容切换，无位移)
     */
    triggerSlideAnimation(direction) {
        // 获取UI元素
        const poemContainer = document.getElementById('poem-container');
        if (poemContainer && poemContainer.classList.contains('show')) {
            // 立即更新内容
            const story = storyFragments?.getCurrentStory();
            if (story) {
                this.showStoryUI(story);
            }
        }
    }

    /**

            // Set Background
            if (story.imageUrl) {
                poemBg.style.backgroundImage = `url('${story.imageUrl}')`;
            } else {
                poemBg.style.backgroundImage = 'none';
            }

            this.showingPoem = true;

            // Updated indicator
            this.updateStoryIndicator();
        }
    }

    /**
     * Update Story Progress Bar
     */
    updateStoryIndicator() {
        const progressBar = document.getElementById('story-progress-bar');
        const poemContainer = document.getElementById('poem-container');

        if (!poemContainer || !progressBar) return;

        const storyCount = storyFragments?.getStoryCount() || 0;
        const currentIndex = storyFragments?.getCurrentIndex() || 0;

        if (storyCount <= 1) {
            progressBar.style.width = '100%';
            return;
        }

        // Calculate progress percentage
        // If 5 stories, index 0 is 20%, index 4 is 100%
        const progress = ((currentIndex + 1) / storyCount) * 100;
        progressBar.style.width = `${progress}%`;
    }

    /**
     * 滚动故事内容
     */
    scrollStoryUI(deltaY) {
        const poemTextElement = document.getElementById('poem-text');
        if (poemTextElement) {
            // Adjust sensitivity: Normalized Y is small (-1 to 1), map to pixels
            // Increased multiplier for realistic scroll speed
            poemTextElement.scrollTop -= deltaY * 600;
        }
    }

    /**
     * 更新删除按钮UI动画
     * @param {number} progress 0.0 to 1.0 (1.0 = ready to delete)
     */
    updateDeleteUI(progress) {
        let btn = document.getElementById('delete-story-btn');
        if (!btn) {
            btn = document.createElement('div');
            btn.id = 'delete-story-btn';
            btn.innerHTML = '🗑️'; // Trash icon
            Object.assign(btn.style, {
                position: 'fixed',
                bottom: '40px',
                left: '50%',
                transform: 'translateX(-50%) scale(0)',
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 59, 48, 0)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                zIndex: '2000',
                transition: 'transform 0.1s, background-color 0.1s, opacity 0.1s',
                opacity: '0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                pointerEvents: 'none'
            });
            document.body.appendChild(btn);
        }

        if (progress <= 0.05) {
            btn.style.opacity = '0';
            btn.style.transform = 'translateX(-50%) scale(0)';
            return;
        }

        btn.style.display = 'flex';
        btn.style.opacity = '1';

        // Animation
        const scale = 0.5 + Math.min(progress, 1.2) * 1.0;
        const bgOpacity = 0.2 + Math.min(progress, 1) * 0.8;

        btn.style.transform = `translateX(-50%) scale(${scale})`;
        btn.style.backgroundColor = `rgba(255, 59, 48, ${bgOpacity})`;

        if (progress >= 0.8) { // Threshold for "Ready" visual
            btn.style.boxShadow = `0 0 ${20 + (progress - 0.8) * 50}px rgba(255, 0, 0, 0.8)`;
            if (progress >= 1.0) btn.innerHTML = '💥';
            else btn.innerHTML = '🗑️';
        } else {
            btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
            btn.innerHTML = '🗑️';
        }
    }

    /**
     * 隐藏故事UI
     */
    hideStoryUI() {
        const poemContainer = document.getElementById('poem-container');
        if (poemContainer) {
            poemContainer.classList.remove('show');
            this.showingPoem = false;
        }
    }

    update(landmarks) {
        this.visible = true;
        this.group.visible = true;

        // Check for Hands Up gesture to switch model
        if (this.mode === 'model' && this.detectHandsUp(landmarks)) {
            const now = Date.now();
            if (now - this.lastSwitchTime > 2000) {
                this.switchRandomModel();
                this.lastSwitchTime = now;
            }
        }

        // 检测两指手势（用于选择故事）
        this.detectAndHandleTwoFingerGesture();

        // Update based on mode
        if (this.mode === 'particle') {
            this.updateParticles(landmarks);
        } else if (this.mode === 'model') {
            if (this.modelCharacter) {
                this.modelCharacter.setVisible(globalModelVisible);
                if (globalModelVisible) {
                    this.modelCharacter.update(landmarks);
                }
            }
        }

        // 在 model 模式下，隐藏骨架（只显示 3D 模型）
        const hideSkeletonModes = ['model'];
        const showSkeletonInThisMode = this.showSkeleton && !hideSkeletonModes.includes(this.mode);

        // Common updates: Skeleton Debug View
        landmarks.forEach((landmark, index) => {
            const sphere = this.landmarksMap[index];
            if (sphere) {
                const x = (0.5 - landmark.x) * 2;
                const y = (1 - landmark.y) * 2;
                const z = -landmark.z;

                sphere.position.set(x, y, z);
                sphere.visible = showSkeletonInThisMode;
            }
        });

        this.group.children.forEach(child => {
            if (child instanceof THREE.Line) {
                const startIdx = child.userData.start;
                const endIdx = child.userData.end;

                if (this.landmarksMap[startIdx] && this.landmarksMap[endIdx]) {
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
                    child.visible = showSkeletonInThisMode;
                } else {
                    child.visible = false;
                }
            }
        });

        // Update gift box
        if (this.giftBox && !hideSkeletonModes.includes(this.mode)) {
            this.giftBox.update(landmarks);
        } else if (this.giftBox) {
            this.giftBox.hide();
        }
    }

    showPoemUI(headPosition = null) {
        const poemContainer = document.getElementById('poem-container');
        const poemBg = document.getElementById('poem-bg');
        const poemTextElement = document.getElementById('poem-text');
        const userTextElement = document.getElementById('user-text');

        if (poemContainer && poemTextElement) {
            if (userTextElement) {
                userTextElement.textContent = this.userWords || "...";
            }
            poemTextElement.textContent = this.poemText;

            // Default styling for new story
            poemContainer.className = 'layout-left accent-gold font-serif show';

            // If we have an image URL from generation
            if (this.generatedImageUrl) {
                poemBg.style.backgroundImage = `url('${this.generatedImageUrl}')`;
            }

            this.showingPoem = true;

            // Envelope flight animation
            if (christmasEnvelope && headPosition) {
                const treePos = new THREE.Vector3(0, 1.5, -3.5);
                christmasEnvelope.startFlight(headPosition, treePos);
            }

            // Hide after 15 seconds
            setTimeout(() => {
                poemContainer.classList.remove('show');
                this.showingPoem = false;
            }, 15000);
        }
    }

    hidePoemUI() {
        const poemContainer = document.getElementById('poem-container');
        if (poemContainer) {
            poemContainer.classList.remove('show');
            this.showingPoem = false;
        }
    }

    /**
     * 设置故事图片变换 (缩放 + 位移)
     * @param {number} scale - 缩放倍率
     * @param {number} x - X轴位移 (px)
     * @param {number} y - Y轴位移 (px)
     * @param {boolean} withTransition - 是否启用平滑过渡/回弹动画
     */
    setStoryImageTransform(scale, x, y, withTransition = false) {
        const poemContainer = document.getElementById('poem-container');
        if (poemContainer) {
            const glassPane = poemContainer.querySelector('.story-glass-pane');

            if (withTransition) {
                // 弹性回弹动画 (保留 opacity 过渡)
                poemContainer.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.8s ease';
                if (glassPane) glassPane.style.opacity = '1';
            } else {
                // 交互时禁用 transform 过渡，确保跟手
                poemContainer.style.transition = 'opacity 0.8s ease';
                if (glassPane) glassPane.style.opacity = '0';
            }

            // 保留居中定位 (translate(-50%, -50%)) 并叠加偏移和缩放
            // scale 默认为 1 (在CSS中 show 状态是 scale(1))
            poemContainer.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
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

        // Hide model character when character is hidden
        if (this.modelCharacter) {
            this.modelCharacter.setVisible(false);
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

    // === Christmas Night Atmosphere ===
    // Deep blue-purple gradient background
    scene.background = new THREE.Color(0x0a0a1a); // Dark midnight blue

    // Add atmospheric fog for dreamy, hazy feel
    scene.fog = new THREE.FogExp2(0x1a1030, 0.08); // Purple-tinted fog

    // Create bokeh light particles (floating warm lights)
    createBokehLights();

    // Grid Helper - Hidden for cleaner look
    const gridHelper = new THREE.GridHelper(10, 10, 0x1a1a2e, 0x0f0f1a);
    gridHelper.visible = false; // Hide grid for cleaner aesthetic
    scene.add(gridHelper);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 3);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true }); // Enable antialiasing for smoother look
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
    renderer.toneMappingExposure = 1.2;
    canvasContainer.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.update();

    // Lights - Warmer, more atmospheric (降低环境光)
    const ambientLight = new THREE.AmbientLight(0x4a3a6a, 0.35); // 降低强度到0.35
    scene.add(ambientLight);

    // Warm golden light from above (like street lamps)
    const warmLight = new THREE.PointLight(0xffaa44, 0.8, 20);
    warmLight.position.set(3, 5, 2);
    scene.add(warmLight);

    // Cool blue accent light
    const coolLight = new THREE.PointLight(0x4488ff, 0.4, 15);
    coolLight.position.set(-3, 3, -2);
    scene.add(coolLight);

    const directionalLight = new THREE.DirectionalLight(0xffeedd, 0.3);
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

    // Christmas Tree Glow Light (night scene main light source)
    const treeLight = new THREE.PointLight(0xffd700, 1.8, 18);
    treeLight.position.set(0, 2, -4); // Center of tree
    scene.add(treeLight);

    // Snow Ground (static, no trail texture)
    snowGround = new SnowGround(scene);

    // Christmas Envelope (飞行信封效果)
    christmasEnvelope = new ChristmasEnvelope(scene);

    // Story Fragments (故事碎片飞旋效果)
    storyFragments = new StoryFragments(scene, new THREE.Vector3(0, 0, -4));

    // Initialize PS5 Controller
    initPS5Controller();

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);

    // WASD Keyboard Controls for Camera Movement
    const moveSpeed = 0.1;
    const keyState = {};

    window.addEventListener('keydown', (e) => {
        keyState[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
        keyState[e.key.toLowerCase()] = false;
    });

    // Update camera position based on key state
    function updateCameraMovement() {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        const right = new THREE.Vector3();
        right.crossVectors(direction, camera.up).normalize();

        if (keyState['w']) {
            camera.position.add(direction.multiplyScalar(moveSpeed));
            controls.target.add(direction.clone().normalize().multiplyScalar(moveSpeed));
        }
        if (keyState['s']) {
            camera.position.sub(direction.multiplyScalar(moveSpeed));
            controls.target.sub(direction.clone().normalize().multiplyScalar(moveSpeed));
        }
        if (keyState['a']) {
            camera.position.sub(right.multiplyScalar(moveSpeed));
            controls.target.sub(right.clone().normalize().multiplyScalar(moveSpeed));
        }
        if (keyState['d']) {
            camera.position.add(right.multiplyScalar(moveSpeed));
            controls.target.add(right.clone().normalize().multiplyScalar(moveSpeed));
        }
    }

    // Store updateCameraMovement for use in animate loop
    window.updateCameraMovement = updateCameraMovement;

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

    // WASD camera movement
    if (window.updateCameraMovement) {
        window.updateCameraMovement();
    }

    // Update snow effect
    if (snowEffect) {
        snowEffect.update();
    }

    // Update bokeh lights (Christmas night atmosphere)
    updateBokehLights(Date.now() * 0.001);

    // Update Christmas tree
    if (christmasTree) {
        christmasTree.update(Date.now() * 0.001);
    }

    // Update tree gifts animation
    updateTreeGifts(Date.now() * 0.001);

    // Update Christmas envelope
    if (christmasEnvelope) {
        christmasEnvelope.update(16); // ~60fps
    }

    // Update Story Fragments
    if (storyFragments) {
        storyFragments.update(16);
    }

    // Update PS5 Controller
    if (ps5Controller) {
        ps5Controller.update(16);
    }

    // Render MediaPipe Pose & Hand
    if (poseLandmarker && videoElement.currentTime !== lastVideoTime) {
        if (videoElement.videoWidth > 0) {
            lastVideoTime = videoElement.currentTime;
            const startTimeMs = performance.now();
            const poseResult = poseLandmarker.detectForVideo(videoElement, startTimeMs);

            // 手部检测
            let handResults = null;
            if (handLandmarker) {
                handResults = handLandmarker.detectForVideo(videoElement, startTimeMs);
            }

            // Reset all characters to hidden
            characters.forEach(char => char.hide());

            if (poseResult.landmarks) {
                // Assign each detected pose to a character
                poseResult.landmarks.forEach((landmarks, index) => {
                    if (index < characters.length) {
                        // 设置手部关键点（如果有）
                        if (handResults && handResults.landmarks) {
                            characters[index].setHandLandmarks(handResults.landmarks);
                        } else {
                            characters[index].setHandLandmarks(null);
                        }
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
        const { PoseLandmarker, HandLandmarker, FilesetResolver } = await import(
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

        loadingElement.textContent = 'Loading Hand Model...';
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
        console.log('[MediaPipe] Hand Landmarker loaded');

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

// Voice Button Logic
const voiceBtn = document.getElementById('voice-btn');
const voiceStatus = document.getElementById('voice-status');

let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let hasAudioInput = false;
let audioCheckInterval;

if (voiceBtn) {
    voiceBtn.addEventListener('click', async () => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            // Start Recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Audio Input Detection Setup
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioContext.createMediaStreamSource(stream);
                    analyser = audioContext.createAnalyser();
                    analyser.fftSize = 256;
                    source.connect(analyser);
                    dataArray = new Uint8Array(analyser.frequencyBinCount);
                    hasAudioInput = false;

                    // Check for audio input periodically
                    audioCheckInterval = setInterval(() => {
                        if (!analyser) return;
                        analyser.getByteFrequencyData(dataArray);
                        // Calculate average volume
                        let sum = 0;
                        for (let i = 0; i < dataArray.length; i++) {
                            sum += dataArray[i];
                        }
                        const average = sum / dataArray.length;

                        // Threshold for "sound detected" (noise floor is usually low)
                        if (average > 10) {
                            hasAudioInput = true;
                        }
                    }, 100);
                } catch (e) {
                    console.warn("AudioContext setup failed, defaulting access to true", e);
                    hasAudioInput = true; // Fallback
                }

                // Setup MediaRecorder
                const options = { mimeType: 'audio/webm;codecs=opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    console.warn('audio/webm;codecs=opus not supported, using default');
                    mediaRecorder = new MediaRecorder(stream);
                } else {
                    mediaRecorder = new MediaRecorder(stream, options);
                }
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    // Cleanup Audio Context
                    clearInterval(audioCheckInterval);
                    if (audioContext && audioContext.state !== 'closed') {
                        audioContext.close();
                    }

                    // Stop all tracks to release mic
                    stream.getTracks().forEach(track => track.stop());

                    // UI Cleanup
                    voiceBtn.classList.remove('recording');
                    document.body.classList.remove('recording-mode');

                    // 1. Silent Check
                    if (!hasAudioInput) {
                        console.log("No audio input detected, skipping API call.");
                        if (voiceStatus) voiceStatus.textContent = '❌ 未检测到语音 / No speech detected';

                        // Reset UI after short delay
                        setTimeout(() => {
                            if (voiceStatus) voiceStatus.textContent = '点击说话 / Click to Speak';
                        }, 2000);
                        return;
                    }

                    // 2. Proceed with API Call
                    voiceBtn.classList.add('processing'); // Visual feedback
                    if (voiceStatus) voiceStatus.textContent = '✨ 生成中... / Generating...';

                    // Use the actual MIME type from the recorder
                    const mimeType = mediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(audioChunks, { type: mimeType });
                    console.log(`[DEBUG] Audio blob created: ${audioBlob.size} bytes, type: ${mimeType}`);

                    try {
                        console.log("Generating poem...");
                        const result = await generateEmotionPoem(audioBlob);
                        console.log("Poem generated:", result);

                        // Save story
                        if (storyFragments) {
                            await storyFragments.addStory(result.userWords, result.poem, result.imageUrl);
                            console.log("[Story] Story saved to fragments");
                        }

                        // Update characters
                        characters.forEach(char => {
                            char.poemText = result.poem;
                            char.userWords = result.userWords;
                            char.isRecording = false;
                        });

                        // Success Feedback
                        voiceBtn.classList.remove('processing');
                        if (voiceStatus) voiceStatus.textContent = '✅ 生成成功! / Done!';
                        setTimeout(() => {
                            if (voiceStatus) voiceStatus.textContent = '点击说话 / Click to Speak';
                        }, 3000);

                    } catch (error) {
                        console.error("Poem generation failed:", error);
                        characters.forEach(char => char.isRecording = false);

                        voiceBtn.classList.remove('processing');

                        if (error.message === 'NO_SPEECH') {
                            if (voiceStatus) voiceStatus.textContent = '❌ 未检测到语音 / No speech detected';
                        } else {
                            if (voiceStatus) voiceStatus.textContent = '❌ 生成失败 / Failed';
                            alert("Failed to generate poem. Please try again.");
                        }

                        setTimeout(() => {
                            if (voiceStatus) voiceStatus.textContent = '点击说话 / Click to Speak';
                        }, 3000);
                    }
                };

                mediaRecorder.start();

                // UI Update for Recording
                voiceBtn.classList.add('recording');
                document.body.classList.add('recording-mode');
                if (voiceStatus) voiceStatus.textContent = '🎤 正在录音... / Recording...';

            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Could not access microphone.");
            }
        } else {
            // Stop Recording
            mediaRecorder.stop();
            // Note: Actual processing happens in onstop event
        }
    });
}

// Star Menu Logic
function initStarMenu() {
    const container = document.getElementById('star-menu-container');
    const button = document.getElementById('star-button');
    const menu = document.getElementById('glass-menu');
    const toggleCameraItem = document.getElementById('menu-toggle-camera');
    const toggleModelItem = document.getElementById('menu-toggle-model');
    const modelList = document.getElementById('menu-model-list');

    if (!container || !button) return;

    // Toggle Menu
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
        button.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            menu.classList.remove('open');
            button.classList.remove('active');
        }
    });

    // Camera Toggle - Default HIDDEN
    let cameraVisible = false;
    const videoContainer = document.getElementById('video-container');
    videoContainer.style.display = 'none'; // Hide by default
    toggleCameraItem.addEventListener('click', () => {
        cameraVisible = !cameraVisible;
        videoContainer.style.display = cameraVisible ? 'block' : 'none';
        toggleCameraItem.innerHTML = cameraVisible ? '<span class="icon">●</span> Hide Camera' : '<span class="icon">○</span> Show Camera';
    });

    // Model Toggle - Default SHOWN
    if (toggleModelItem) {
        // Set initial state - model SHOWN by default
        globalModelVisible = true;

        toggleModelItem.addEventListener('click', () => {
            globalModelVisible = !globalModelVisible;

            // Force immediate update for all character models
            characters.forEach(char => {
                if (char.modelCharacter) {
                    char.modelCharacter.setVisible(globalModelVisible);
                }
            });

            toggleModelItem.innerHTML = globalModelVisible ? '<span class="icon">●</span> Hide Model' : '<span class="icon">○</span> Show Model';
        });
    }

    // Populate Model List
    if (modelList) {
        AVAILABLE_MODELS.forEach(model => {
            const div = document.createElement('div');
            div.className = 'menu-item model-option';
            if (model.id === 'santa') div.classList.add('active'); // Default
            div.textContent = model.name;

            div.addEventListener('click', () => {
                // Remove active class from all
                document.querySelectorAll('.model-option').forEach(el => el.classList.remove('active'));
                div.classList.add('active');

                // Change model for all characters
                characters.forEach(char => {
                    if (char.setModel) {
                        char.setModel(model.id);
                    }
                });
            });

            modelList.appendChild(div);
        });
    }
}

// Initialize the menu
initStarMenu();

// ==================== Menu Manager ====================
class MenuManager {
    constructor() {
        this.isOpen = false;
        this.currentIndex = 0;
        this.menuContainer = document.getElementById('glass-menu');
        this.menuItems = Array.from(document.querySelectorAll('.menu-item'));

        // Initial setup
        if (this.menuItems.length > 0) {
            this.updateSelection();
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.menuContainer) {
            if (this.isOpen) {
                this.menuContainer.classList.add('open');
                this.updateSelection();
            } else {
                this.menuContainer.classList.remove('open');
            }
        }
        return this.isOpen;
    }

    navigate(direction) {
        if (!this.isOpen) return;

        this.currentIndex += direction;

        // Loop navigation
        if (this.currentIndex < 0) this.currentIndex = this.menuItems.length - 1;
        if (this.currentIndex >= this.menuItems.length) this.currentIndex = 0;

        this.updateSelection();
    }

    updateSelection() {
        this.menuItems.forEach((item, index) => {
            if (index === this.currentIndex) {
                item.style.background = 'rgba(255, 255, 255, 0.2)';
                item.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)';
            } else {
                item.style.background = 'rgba(255, 255, 255, 0.05)';
                item.style.boxShadow = 'none';
            }
        });

        // Ensure visible
        this.menuItems[this.currentIndex]?.scrollIntoView({ block: 'nearest' });
    }

    triggerAction() {
        if (!this.isOpen) return;
        const item = this.menuItems[this.currentIndex];
        if (item) {
            console.log(`[Menu] Triggering action for: ${item.id}`);
            item.click(); // Trigger click event

            // Visual feedback
            item.style.transform = 'scale(0.95)';
            setTimeout(() => item.style.transform = 'scale(1)', 100);

            // Special handling for some actions
            if (item.id === 'menu-toggle-camera' || item.id === 'menu-toggle-model') {
                // Update icon text maybe?
                const icon = item.querySelector('.icon');
                if (icon) {
                    icon.textContent = icon.textContent === '○' ? '◉' : '○';
                }
            }
        }
    }
}

/**
 * Initialize PS5 Controller Integration
 */
async function initPS5Controller() {
    try {
        console.log('[Skeleton] Initializing PS5 Controller...');

        const menuManager = new MenuManager();


        ps5Controller = new PS5SceneController({
            deadzone: 0.15,
            buttonDebounce: 200
        });

        // Set scene references
        ps5Controller.setSceneReferences({
            scene: scene,
            camera: camera,
            controls: controls,
            snowEffect: snowEffect,
            storyFragments: storyFragments,
            characters: characters,
            menuManager: menuManager // Pass menu manager
        });

        // UI Handling
        const connectBtn = document.getElementById('menu-ps5-connect');
        if (connectBtn) {
            // Helper to set connected visual state
            const setConnectedState = () => {
                connectBtn.innerHTML = '<span class="icon">✅</span> PS5 Connected';
                // Green tint style as requested
                connectBtn.style.background = 'rgba(46, 204, 113, 0.2)';
                connectBtn.style.borderColor = 'rgba(46, 204, 113, 0.5)';
                connectBtn.style.pointerEvents = 'none'; // Lock it
            };

            // Try Auto Connect
            const autoConnected = await ps5Controller.tryAutoConnect();
            if (autoConnected) {
                setConnectedState();
            }

            // Click Handler for Manual Connect
            connectBtn.addEventListener('click', async () => {
                if (ps5Controller.connected) return;

                try {
                    connectBtn.innerHTML = '<span class="icon">⏳</span> Connecting...';
                    await ps5Controller.init(); // Triggers device picker
                    setConnectedState();
                } catch (error) {
                    console.error('[Skeleton] PS5 connection failed:', error);
                    connectBtn.innerHTML = '<span class="icon">❌</span> Failed';
                    // Reset after 2s
                    setTimeout(() => {
                        if (!ps5Controller.connected) {
                            connectBtn.innerHTML = '<span class="icon">🎮</span> Connect PS5';
                        }
                    }, 2000);
                }
            });
        }

    } catch (error) {
        console.warn('[Skeleton] PS5 Controller initialization failed:', error);
    }
}

// Call initialization
initPS5Controller();

// Rendering Loop for Snow System
function renderLoop() {
    requestAnimationFrame(renderLoop);

    // Update snow particles
    if (snowEffect) {
        snowEffect.update();
    }
}

// Start render loop
renderLoop();
