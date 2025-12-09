/**
 * PS5 Scene Controller - 集成PS5控制器到粒子场景
 * 功能：按键映射、传感器集成、反馈系统
 */

import * as THREE from 'three';
import PS5ControllerWebHID from './ps5ControllerWebHID.js';
const RAD_95_DEG = 95 * (Math.PI / 180); // 95° 转换为弧度，约为 1.658

const MIN_PHI = 0.9;         // 垂直角度最小值 (约 51.57°)
const MAX_PHI = RAD_95_DEG;  // 垂直角度最大值 (95°)

const MIN_RADIUS = 1.5;      // 缩放范围最小值
const MAX_RADIUS = 9.0;      // 缩放范围最大值 (新限制)

// 震动模式配置
const VIBRATION_PATTERNS = {
    weak: { left: 0.2, right: 0.2, duration: 100 },
    medium: { left: 0.5, right: 0.5, duration: 150 },
    strong: { left: 0.8, right: 0.8, duration: 200 },
    doubleClick: { left: 0.4, right: 0.4, duration: 50, repeat: 2, gap: 50 },
    snapshot: { left: 0.3, right: 0.3, duration: 80 },
    confirm: { left: 0.5, right: 0.5, duration: 150 },
    gentle: { left: 0.25, right: 0.25, duration: 120 },
    selection: { left: 0.1, right: 0.1, duration: 50 }
};

// LED颜色配置
const LED_COLORS = {
    default: { r: 0, g: 0, b: 255 },        // 蓝色 - 默认
    recording: { r: 255, g: 215, b: 0 },    // 金色 - 录音中
    success: { r: 0, g: 255, b: 0 },        // 绿色 - 成功
    flash: { r: 255, g: 255, b: 255 }       // 白色 - 闪烁
};

export class PS5SceneController {
    constructor(options = {}) {
        this.options = {
            deadzone: options.deadzone || 0.15,
            buttonDebounce: options.buttonDebounce || 200,
            touchpadSwipeThreshold: options.touchpadSwipeThreshold || 0.15, // Adjusted for normalized range [-1, 1]
            gyroShakeThreshold: options.gyroShakeThreshold || 15,
            ...options
        };

        // 控制器客户端
        this.controller = null;
        this.connected = false;

        // 场景引用（将由外部设置）
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.snowEffect = null;
        this.storyFragments = null;
        this.characters = null;

        // 相机初始状态
        this.initialCameraPosition = null;
        this.initialCameraTarget = null;
        this.initialCameraZoom = null;

        // 按键防抖状态
        this.buttonCooldowns = {};
        this.lastButtonPress = {};

        // 触控板状态
        this.lastTouchpadPos = { x: 0, y: 0 };
        this.touchpadPressed = false;

        // 陀螺仪状态
        this.gyroBaseline = { x: 0, y: 0, z: 0 };
        this.gyroShakeAmount = 0;
        this.gyroCalibrated = false;

        // 雪花强度状态
        this.currentSnowIntensity = 1.0;
        this.baseSnowIntensity = 1.0;

        // 麦克风吹气检测
        this.lastMicLevel = 0;
        this.micBlowThreshold = 0.6;

        // 触控板高级交互状态 (缩放+拖拽)
        this.touchTransform = { scale: 1, x: 0, y: 0 };
        this.prevTouchState = {
            t1: null, t2: null,
            dist: 0, centerX: 0, centerY: 0
        };
        this.isInteracting = false;
    }

    /**
     * 初始化控制器 (用户手动触发)
     */
    async init() {
        console.log('[PS5SceneController] Initializing (Manual)...');

        if (!this.controller) {
            this.controller = new PS5ControllerWebHID();
            this.setupEventListeners();
        }

        // 连接到手柄（会弹出设备选择对话框）
        try {
            await this.controller.connect();
            this.connected = true;
            this.setLEDColor(LED_COLORS.default);
            console.log('[PS5SceneController] Connected successfully');
        } catch (error) {
            console.error('[PS5SceneController] Connection failed:', error);
            throw error;
        }
    }

    /**
     * 尝试自动连接 (无需用户交互)
     */
    async tryAutoConnect() {
        if (!this.controller) {
            this.controller = new PS5ControllerWebHID();
            this.setupEventListeners();
        }

        const success = await this.controller.autoConnect();
        if (success) {
            this.connected = true;
            this.setLEDColor(LED_COLORS.default);
            console.log('[PS5SceneController] Auto-connected successfully');
        }
        return success;
    }

    /**
     * 设置场景引用
     */
    setSceneReferences(refs) {
        this.scene = refs.scene;
        this.camera = refs.camera;
        this.controls = refs.controls;
        this.snowEffect = refs.snowEffect;
        this.storyFragments = refs.storyFragments;
        this.characters = refs.characters;
        this.menuManager = refs.menuManager; // Store reference

        // 保存初始相机状态
        if (this.camera && this.controls) {
            this.saveCameraState();
        }
    }

    // ==================== STATE HELPERS ====================

    isMenuOpen() {
        return this.menuManager && this.menuManager.isOpen;
    }

    isStoryOpen() {
        return this.storyFragments && this.storyFragments.isStoryExpanded();
    }

    isRecording() {
        const voiceBtn = document.getElementById('voice-btn');
        return voiceBtn && (voiceBtn.classList.contains('recording') || voiceBtn.classList.contains('processing'));
    }

    /**
     * 保存当前相机状态
     */
    /**
     * 保存当前相机状态
     */
    saveCameraState() {
        if (!this.camera || !this.controls) return;

        // 计算并保存初始球坐标参数
        const offset = new THREE.Vector3();
        offset.copy(this.camera.position).sub(this.controls.target);

        const spherical = new THREE.Spherical();
        spherical.setFromVector3(offset);

        this.initialSpherical = {
            radius: spherical.radius,
            phi: spherical.phi,
            theta: spherical.theta
        };

        this.initialCameraTarget = this.controls.target.clone();

        console.log(`[PS5] Initial State Saved - Theta: ${(spherical.theta * 180 / Math.PI).toFixed(2)}°, Radius: ${spherical.radius.toFixed(2)}`);
    }

    /**
     * 重置相机位置和朝向 (L3)
     * 恢复到初始角度 (Theta, Phi) 和 目标点
     */
    resetCameraPosition() {
        if (!this.initialSpherical || !this.camera || !this.controls) return;

        const duration = 500;
        const startTime = Date.now();

        // 当前状态
        const offset = new THREE.Vector3();
        offset.copy(this.camera.position).sub(this.controls.target);
        const currentSpherical = new THREE.Spherical().setFromVector3(offset);

        const startTheta = currentSpherical.theta;
        const startPhi = currentSpherical.phi;
        const startTarget = this.controls.target.clone();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);

            // 插值角度
            currentSpherical.theta = startTheta + (this.initialSpherical.theta - startTheta) * eased;
            currentSpherical.phi = startPhi + (this.initialSpherical.phi - startPhi) * eased;

            // 保持当前半径 (Zoom不变)
            // currentSpherical.radius (unchanged)

            // 更新位置
            offset.setFromSpherical(currentSpherical);
            this.camera.position.copy(this.controls.target).add(offset); // target暂时不动，先计算相对位置

            // 插值Target (如果有必要)
            if (this.initialCameraTarget) {
                this.controls.target.lerpVectors(startTarget, this.initialCameraTarget, eased);
                // 重新根据新Target调整位移? OrbitControls通常只更新Position基于Target
                // 简单起见，我们假设Target归位后，Camera Position也跟随Target平移
                this.camera.position.copy(this.controls.target).add(offset);
            }

            this.controls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log('[PS5] Camera Angle Reset Complete');
            }
        };

        animate();
    }

    /**
     * 重置相机缩放 (R3)
     * 恢复到初始半径 (Radius)
     */
    resetCameraZoom() {
        if (!this.initialSpherical || !this.camera || !this.controls) return;

        const duration = 500;
        const startTime = Date.now();

        const offset = new THREE.Vector3();
        offset.copy(this.camera.position).sub(this.controls.target);
        const currentSpherical = new THREE.Spherical().setFromVector3(offset);

        const startRadius = currentSpherical.radius;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);

            // 插值半径
            currentSpherical.radius = startRadius + (this.initialSpherical.radius - startRadius) * eased;

            // 更新位置
            offset.setFromSpherical(currentSpherical);
            this.camera.position.copy(this.controls.target).add(offset);

            this.controls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log('[PS5] Camera Zoom Reset Complete');
            }
        };

        animate();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 按键按下事件
        this.controller.on('buttonPress', (button) => this.handleButtonPress(button));

        // 按键释放事件
        this.controller.on('buttonRelease', (button) => this.handleButtonRelease(button));

        // 触控板按压
        this.controller.on('touchpadPress', () => this.handleTouchpadPress());

        // 连接状态
        this.controller.on('connected', () => {
            this.connected = true;
            this.setLEDColor(LED_COLORS.default);
        });

        this.controller.on('disconnected', () => {
            this.connected = false;
        });
    }

    /**
     * 更新循环（在主渲染循环中调用）
     */
    update(deltaTime) {
        if (!this.connected || !this.controller) return;

        const state = this.controller.getState();
        if (!state) return;

        // 仅启用双摇杆控制
        this.updateJoysticks(state, deltaTime);

        // 启用触控板控制
        this.updateTouchpad(state);

        // 启用陀螺仪和麦克风
        this.updateGyroscope(state, deltaTime);
        this.updateMicrophone(state, deltaTime);

        this.cleanupCooldowns();
    }

    /**
     * 处理按键按下
     */
    handleButtonPress(buttonName) {
        // ALWAYS Log raw press attempt
        // console.log(`[PS5SceneController] RAW PRESS DETECTED: ${buttonName}`);

        if (this.isButtonOnCooldown(buttonName)) {
            // console.log(`[PS5SceneController] Cooldown ignored: ${buttonName}`);
            return;
        }

        // ==================== STATE CHECKS ====================
        const menuOpen = this.isMenuOpen();
        const storyOpen = this.isStoryOpen();
        const recording = this.isRecording();

        // 互斥逻辑：当任意一个被调用时，其他的都不可调用
        // Mutual exclusion: When one mode is active, block others.

        // 1. Menu Mode (Square)
        // Consumes input if Open.
        if (menuOpen) {
            // Allow Square to close
            if (buttonName === 'square') {
                this.menuManager.toggle();
                this.vibrate(VIBRATION_PATTERNS.medium);
                console.log(`[PS5] Menu Closed`);
                this.setButtonCooldown(buttonName);
                return;
            }

            // Intercept navigation keys
            switch (buttonName) {
                case 'dpad_up':
                    this.menuManager.navigate(-1);
                    this.vibrate(VIBRATION_PATTERNS.selection);
                    break;
                case 'dpad_down':
                    this.menuManager.navigate(1);
                    this.vibrate(VIBRATION_PATTERNS.selection);
                    break;
                case 'dpad_left':
                case 'dpad_right':
                case 'x':
                case 'cross':
                    this.menuManager.triggerAction();
                    this.vibrate(VIBRATION_PATTERNS.confirm);
                    break;
                default:
                    // Block other keys (Triangle, Circle, etc.) when Menu is open
                    // console.log(`[PS5] Input blocked by Menu: ${buttonName}`);
                    break;
            }
            this.setButtonCooldown(buttonName);
            return;
        }

        // 2. Check Conflicts for Mode Switching
        // If we initiate an action, ensure no OTHER mode is active.

        switch (buttonName) {
            case 'square': // Toggle Menu
                if (storyOpen || recording) {
                    console.log('[PS5] Blocked Square (Conflict)');
                    return;
                }
                if (this.menuManager) {
                    this.menuManager.toggle();
                    this.vibrate(VIBRATION_PATTERNS.medium);
                    console.log(`[PS5] Menu Opened`);
                }
                break;

            case 'triangle': // Toggle Story
                if (menuOpen || recording) {
                    console.log('[PS5] Blocked Triangle (Conflict)');
                    return;
                }
                console.log('Dispatching Triangle');
                this.handleTriangle();
                break;

            case 'circle': // Toggle Recording
                if (menuOpen || storyOpen) {
                    console.log('[PS5] Blocked Circle (Conflict)');
                    return;
                }
                console.log('Dispatching Circle');
                this.handleCircle();
                break;

            case 'cross': // Action (Jump)
            case 'x':
                if (menuOpen || storyOpen || recording) {
                    console.log('[PS5] Blocked Cross (Conflict)');
                    return;
                }
                this.handleCross();
                break;

            // Other buttons checks
            case 'dpad_up':
            case 'dpad_down':
            case 'dpad_left':
            case 'dpad_right':
                // Allow D-Pad in Story Mode for scrolling/nav, block in Recording?
                if (recording) {
                    console.log('[PS5] Blocked DPad (Recording)');
                    return;
                }
                if (buttonName === 'dpad_up') this.handleDPadUp();
                else if (buttonName === 'dpad_down') this.handleDPadDown();
                else if (buttonName === 'dpad_left') this.handleDPadLeft();
                else if (buttonName === 'dpad_right') this.handleDPadRight();
                break;

            case 'L3':
                this.handleL3Press();
                this.vibrate(VIBRATION_PATTERNS.confirm);
                break;
            case 'R3':
                this.handleR3Press();
                this.vibrate(VIBRATION_PATTERNS.confirm);
                break;
            case 'share':
                this.handleShare();
                break;
            case 'options':
                this.handleOptions();
                break;
            case 'ps':
                console.log('Dispatching PS Button');
                break;
            default:
                console.log(`[PS5SceneController] Unhandled button: ${buttonName}`);
                break;
        }

        this.setButtonCooldown(buttonName);
    }

    /**
     * 处理按键释放
     */
    handleButtonRelease(buttonName) {
    }

    // ==================== 方向键处理 ====================

    handleDPadUp() {
        if (this.storyFragments && this.storyFragments.isStoryExpanded()) {
            const poemText = document.getElementById('poem-text');
            if (poemText) {
                poemText.scrollTop -= 50;
                this.vibrate(VIBRATION_PATTERNS.weak);
                console.log('[PS5] Story scroll up');
            }
        }
    }

    handleDPadDown() {
        if (this.storyFragments && this.storyFragments.isStoryExpanded()) {
            const poemText = document.getElementById('poem-text');
            if (poemText) {
                poemText.scrollTop += 50;
                this.vibrate(VIBRATION_PATTERNS.weak);
                console.log('[PS5] Story scroll down');
            }
        }
    }

    handleDPadLeft() {
        if (this.storyFragments && !this.storyFragments.isSlidingNow()) {
            this.storyFragments.slideLeft();
            this.vibrate(VIBRATION_PATTERNS.medium);
            console.log('[PS5] Story slide left');

            // Update UI if expanded
            if (this.storyFragments.isStoryExpanded() && this.characters && this.characters.length > 0) {
                const story = this.storyFragments.getCurrentStory();
                if (story) {
                    this.characters[0].showStoryUI(story);
                }
            }
        }
    }

    handleDPadRight() {
        if (this.storyFragments && !this.storyFragments.isSlidingNow()) {
            this.storyFragments.slideRight();
            this.vibrate(VIBRATION_PATTERNS.medium);
            console.log('[PS5] Story slide right');

            // Update UI if expanded
            if (this.storyFragments.isStoryExpanded() && this.characters && this.characters.length > 0) {
                const story = this.storyFragments.getCurrentStory();
                if (story) {
                    this.characters[0].showStoryUI(story);
                }
            }
        }
    }

    // ==================== 主要按键处理 ====================

    handleCross() {
        if (this.characters && this.characters.length > 0) {
            const char = this.characters[0];
            if (char.jumpEffect) {
                const landmarks = char.landmarksMap;
                if (landmarks && landmarks[23]) {
                    const hipPos = landmarks[23].position;
                    char.jumpEffect.trigger(hipPos);
                    console.log('[PS5] Jump triggered');
                }
            }
        }
    }

    handleCircle() {
        // ○ Circle: 开始录音 / 生成诗歌，再次点击关闭
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            // 检查当前录音状态
            const isRecording = voiceBtn.classList.contains('recording');
            const isProcessing = voiceBtn.classList.contains('processing');

            if (isRecording || isProcessing) {
                // 正在录音或处理中 -> 再次点击关闭/停止
                voiceBtn.click();
                this.vibrate(VIBRATION_PATTERNS.gentle);
                console.log('[PS5] Circle: Recording stopped / closed');
            } else {
                // 未在录音 -> 开始录音
                voiceBtn.click();
                this.vibrate(VIBRATION_PATTERNS.confirm);
                console.log('[PS5] Circle: Recording started');
            }
        } else {
            console.warn('[PS5] Circle: Voice button not found');
        }
    }

    handleTriangle() {
        // △ Triangle: 打开故事界面，默认从最新的故事开始，再次按下关闭故事界面
        if (this.storyFragments && this.characters && this.characters.length > 0) {
            if (this.storyFragments.isStoryExpanded()) {
                // 已展开 -> 关闭故事界面
                this.storyFragments.collapseStory();
                this.characters[0].hideStoryUI();
                this.vibrate(VIBRATION_PATTERNS.gentle);
                console.log('[PS5] Triangle: Story closed');
            } else {
                // 未展开 -> 跳转到最新故事并展开
                this.storyFragments.goToLatestStory();
                const story = this.storyFragments.expandCurrentStory();
                if (story) {
                    this.characters[0].showStoryUI(story); // 传递 story 对象
                    this.vibrate(VIBRATION_PATTERNS.gentle);
                    console.log('[PS5] Triangle: Story opened at latest');
                }
            }
        } else {
            console.warn('[PS5] Triangle: storyFragments or characters not available');
        }
    }

    handleTouchpadPress() {
        if (this.characters && this.characters.length > 0) {
            const char = this.characters[0];
            if (char.showingPoem) {
                char.hidePoemUI();
                console.log('[PS5] Poem hidden');
            }
        }
    }

    // ==================== 摇杆处理 ====================

    handleL3Press() {
        this.resetCameraPosition();
        console.log('[PS5] Camera position reset');
    }

    handleR3Press() {
        this.resetCameraZoom();
        console.log('[PS5] Camera zoom reset');
    }

    updateJoysticks(state, deltaTime) {
        if (!this.controls || !this.camera) return;

        const leftStick = this.controller.getLeftStick();
        const rightStick = this.controller.getRightStick();

        if (Math.abs(leftStick.x) > this.options.deadzone || Math.abs(leftStick.y) > this.options.deadzone) {
            const rotationSpeed = 0.005 * deltaTime;
            const offset = new THREE.Vector3();
            offset.copy(this.camera.position).sub(this.controls.target);
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(offset);
            spherical.theta -= leftStick.x * rotationSpeed;
            spherical.phi -= leftStick.y * rotationSpeed;
            spherical.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, spherical.phi));
            const thetaDeg = spherical.theta * (180 / Math.PI);
            const phiDeg = spherical.phi * (180 / Math.PI);
            // console.log(`[PS5] 角度 (Deg) - 水平(Theta): ${thetaDeg.toFixed(2)}°, 垂直(Phi): ${phiDeg.toFixed(2)}°`);
            offset.setFromSpherical(spherical);
            this.camera.position.copy(this.controls.target).add(offset);
            this.controls.update();
        }

        if (Math.abs(rightStick.y) > this.options.deadzone) {
            const zoomSpeed = 0.01 * deltaTime;
            const offset = new THREE.Vector3();
            offset.copy(this.camera.position).sub(this.controls.target);
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(offset);
            spherical.radius += rightStick.y * zoomSpeed;
            spherical.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, spherical.radius));
            // console.log(`[PS5] 缩放范围 (Radius): ${spherical.radius.toFixed(2)}`);
            offset.setFromSpherical(spherical);
            this.camera.position.copy(this.controls.target).add(offset);
            this.controls.update();
        }
    }

    // ==================== 触控板处理 ====================

    /**
     * 更新触控板滑动 (改进版：双指缩放+平移)
     */
    updateTouchpad(state) {
        const touchpad = this.controller.getTouchpad();
        const touches = (touchpad.touches && touchpad.touches.length > 0) ? touchpad.touches : (touchpad.touching ? [touchpad] : []);

        // 1. 双指交互 (缩放 + 拖拽)
        if (touches.length === 2 && this.storyFragments && this.storyFragments.isStoryExpanded()) {
            this.isInteracting = true;
            this.isZoomGestureActive = true; // 兼容旧标记

            const t1 = touches[0];
            const t2 = touches[1];

            // 计算当前距离和中心点
            const currDist = Math.sqrt(Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2));
            const currCenterX = (t1.x + t2.x) / 2;
            const currCenterY = (t1.y + t2.y) / 2;

            // 如果上一帧有数据，计算增量
            if (this.prevTouchState.dist > 0) {
                // --- 缩放逻辑 ---
                const zoomFactor = currDist / this.prevTouchState.dist;
                this.touchTransform.scale *= zoomFactor;
                // 限制缩放范围 (0.5x - 4.0x)
                this.touchTransform.scale = Math.max(0.5, Math.min(this.touchTransform.scale, 4.0));

                // --- 平移逻辑 ---
                // 注意：PS5触控板坐标通常是归一化的(0-1)，需要映射到屏幕像素
                // 假设屏幕宽度敏感度为 2000px (根据实际体验调整)
                const moveSensitivity = 2000;
                const deltaX = (currCenterX - this.prevTouchState.centerX) * moveSensitivity;
                const deltaY = (currCenterY - this.prevTouchState.centerY) * moveSensitivity;

                this.touchTransform.x += deltaX;
                this.touchTransform.y += deltaY;
            }

            // 更新上一帧状态
            this.prevTouchState = {
                dist: currDist,
                centerX: currCenterX,
                centerY: currCenterY
            };

            // 应用变换 (无过渡)
            if (this.characters && this.characters[0]) {
                this.characters[0].setStoryImageTransform(
                    this.touchTransform.scale,
                    this.touchTransform.x,
                    this.touchTransform.y,
                    false // disable transition
                );
            }

            return; // 阻止单指逻辑
        }

        // 2. 交互结束 (手指抬起)
        if (this.isInteracting && touches.length < 2) {
            // 只是松开了一只手？还是全部松开？
            // 简单起见，只要不满足双指，就认为交互中断，触发复位
            this.isInteracting = false;
            this.isZoomGestureActive = false;

            // 复位状态
            this.touchTransform = { scale: 1, x: 0, y: 0 };
            this.prevTouchState = { dist: 0, centerX: 0, centerY: 0 };

            // 触发弹性复位动画
            if (this.characters && this.characters[0]) {
                this.characters[0].setStoryImageTransform(1, 0, 0, true);
                console.log('[PS5] Touch interact reset');
            }
            return;
        }

        // 3. 单指交互 (原有的滑动切换/滚动)
        if (touches.length === 1) {
            // Initialize last pos if first frame
            if (this.lastTouchpadPos.x === 0 && this.lastTouchpadPos.y === 0) {
                this.lastTouchpadPos = { x: touches[0].x, y: touches[0].y };
                return;
            }

            const dx = touches[0].x - this.lastTouchpadPos.x;
            const dy = touches[0].y - this.lastTouchpadPos.y;

            // Content Scroll (Up/Down) - If expanded
            if (this.storyFragments && this.storyFragments.isStoryExpanded()) {
                if (Math.abs(dy) > 0.002) {
                    if (this.characters && this.characters[0]) {
                        this.characters[0].scrollStoryUI(dy);
                    }
                }
            }

            // Story Switch (Left/Right)
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > this.options.touchpadSwipeThreshold) {
                let didSlide = false;
                if (dx > 0 && this.storyFragments && !this.storyFragments.isSlidingNow()) {
                    didSlide = this.storyFragments.slideRight();
                    this.vibrate(VIBRATION_PATTERNS.medium);
                } else if (dx < 0 && this.storyFragments && !this.storyFragments.isSlidingNow()) {
                    didSlide = this.storyFragments.slideLeft();
                    this.vibrate(VIBRATION_PATTERNS.medium);
                }

                if (didSlide) {
                    this.lastTouchpadPos.x = touches[0].x;
                    if (this.storyFragments.isStoryExpanded() && this.characters && this.characters[0]) {
                        const story = this.storyFragments.getCurrentStory();
                        if (story) this.characters[0].showStoryUI(story);
                    }
                }
            }

            // Always upadte position for smooth scrolling/tracking
            this.lastTouchpadPos = { x: touches[0].x, y: touches[0].y };
        } else {
            // No touches, reset last pos
            this.lastTouchpadPos = { x: 0, y: 0 };
        }
    }


    // ==================== 陀螺仪处理 ====================

    /**
     * 更新陀螺仪（控制雪花）
     */
    updateGyroscope(state, deltaTime) {
        const gyro = this.controller.getGyro();
        if (!gyro) return;

        // 首次校准
        if (!this.gyroCalibrated) {
            this.gyroBaseline = { ...gyro };
            this.gyroCalibrated = true;
            return;
        }

        // 计算摇晃强度（角速度的变化）
        const dx = Math.abs(gyro.x - this.gyroBaseline.x);
        const dy = Math.abs(gyro.y - this.gyroBaseline.y);
        const dz = Math.abs(gyro.z - this.gyroBaseline.z);
        const shakeIntensity = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // 超过阈值则认为在摇晃
        if (shakeIntensity > this.options.gyroShakeThreshold) {
            this.gyroShakeAmount = Math.min(shakeIntensity / 50, 1.5); // 归一化到0-1.5

            if (this.snowEffect) {
                this.snowEffect.setGyroShake(this.gyroShakeAmount);
            }
        } else {
            // 逐渐恢复
            this.gyroShakeAmount *= 0.95;
            if (this.gyroShakeAmount < 0.01) this.gyroShakeAmount = 0;

            if (this.snowEffect) {
                this.snowEffect.setGyroShake(this.gyroShakeAmount);
            }
        }

        // 更新基准线（慢速跟随）
        this.gyroBaseline.x += (gyro.x - this.gyroBaseline.x) * 0.1;
        this.gyroBaseline.y += (gyro.y - this.gyroBaseline.y) * 0.1;
        this.gyroBaseline.z += (gyro.z - this.gyroBaseline.z) * 0.1;
    }

    // ==================== 麦克风处理 ====================

    /**
     * 更新麦克风（检测吹气）
     */
    /**
     * 更新麦克风（检测吹气和环境音量）
     */
    updateMicrophone(state, deltaTime) {
        // 假设有getMicLevel()方法
        if (typeof this.controller.getMicLevel === 'function') {
            const micLevel = this.controller.getMicLevel();

            // 1. 吹气检测 (瞬时)
            // 检测突然的音量增加（吹气）
            if (micLevel > this.micBlowThreshold && this.lastMicLevel < this.micBlowThreshold) {
                this.triggerBlowEffect(micLevel);
            }

            // 2. 持续音量控制雪花强度 (Snow Intensity)
            // 阈值设定
            // 0.0 - 0.2: 正常 (1.0)
            // 0.2 - 0.5: 微风 (1.5)
            // 0.5 - 0.8:大雪 (2.5)
            // 0.8 - 1.0: 暴风雪 (4.0)

            let targetIntensity = 1.0;

            if (micLevel > 0.8) {
                targetIntensity = 4.0; // Max
            } else if (micLevel > 0.5) {
                targetIntensity = 2.5; // High
            } else if (micLevel > 0.2) {
                targetIntensity = 1.5; // Medium
            } else {
                targetIntensity = 1.0; // Normal
            }

            // 平滑过渡 / 防抖
            // 只有当目标强度与当前强度差异较大，且持续一段时间（简单起见，这里使用直接设置但带平滑或者简单状态锁定）
            // 由于setSnowIntensity内部直接修改velocity，频繁调用可能消耗性能或视觉抖动
            // 我们检查是否需要更新，并添加简单的滞后(hysteresis)防止临界值闪烁

            if (Math.abs(targetIntensity - this.currentSnowIntensity) > 0.1) {
                // 如果是增加强度，立即响应；如果是降低，稍微延迟响应（这里简化为每帧0.05的逼近，创造平滑效果）
                if (targetIntensity > this.currentSnowIntensity) {
                    this.currentSnowIntensity = targetIntensity;
                } else {
                    // 缓慢下降
                    this.currentSnowIntensity += (targetIntensity - this.currentSnowIntensity) * 0.05;
                }

                if (this.snowEffect) {
                    this.snowEffect.setSnowIntensity(this.currentSnowIntensity);
                }
            }

            this.lastMicLevel = micLevel;
        }
    }

    /**
     * 触发吹气效果
     */
    triggerBlowEffect(strength) {
        if (this.snowEffect && typeof this.snowEffect.triggerBlowEffect === 'function') {
            this.snowEffect.triggerBlowEffect(strength);
            this.vibrate({ left: 0.3, right: 0.3, duration: 300 });
            console.log('[PS5] Blow effect triggered, strength:', strength.toFixed(2));
        }
    }

    // ==================== 系统按键处理 ====================

    /**
     * SHARE键 - 截图
     */
    handleShare() {
        this.takeScreenshot();
        console.log('[PS5] Screenshot taken');
    }

    /**
     * OPTIONS键 - 菜单
     */
    handleOptions() {
        // TODO: 实现菜单功能
        console.log('[PS5] Menu toggled');
    }

    /**
     * 截图功能
     */
    takeScreenshot() {
        if (!this.scene) return;

        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `screenshot_${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    }

    // ==================== 反馈系统 ====================

    /**
     * 震动反馈
     */
    vibrate(pattern) {
        if (!this.controller) return;
        if (!pattern) return;

        if (pattern.repeat) {
            // 重复震动（如双击）
            for (let i = 0; i < pattern.repeat; i++) {
                setTimeout(() => {
                    this.controller.vibrate(pattern.left, pattern.right, pattern.duration);
                }, i * (pattern.duration + pattern.gap));
            }
        } else {
            this.controller.vibrate(pattern.left, pattern.right, pattern.duration);
        }
    }

    /**
     * 设置LED颜色
     */
    setLEDColor(color) {
        if (!this.controller) return;
        this.controller.setLED(color.r, color.g, color.b);
    }

    /**
     * LED闪烁
     */
    flashLED(color, duration) {
        const originalColor = LED_COLORS.default;
        this.setLEDColor(color);

        setTimeout(() => {
            this.setLEDColor(originalColor);
        }, duration);
    }

    // ==================== 防抖工具 ====================

    /**
     * 检查按键是否在冷却中
     */
    isButtonOnCooldown(buttonName) {
        return this.buttonCooldowns[buttonName] && Date.now() < this.buttonCooldowns[buttonName];
    }

    /**
     * 设置按键冷却时间
     */
    setButtonCooldown(buttonName) {
        this.buttonCooldowns[buttonName] = Date.now() + this.options.buttonDebounce;
    }

    /**
     * 清理过期的冷却时间
     */
    cleanupCooldowns() {
        const now = Date.now();
        for (const [key, time] of Object.entries(this.buttonCooldowns)) {
            if (time < now) {
                delete this.buttonCooldowns[key];
            }
        }
    }

    // ==================== 工具函数 ====================

    /**
     * 缓动函数
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.controller) {
            this.controller.disconnect();
        }
    }
}

export default PS5SceneController;
