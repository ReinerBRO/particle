import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * MediaPipe Pose Landmark 索引映射
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export const MEDIAPIPE_LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

/**
 * 骨骼映射配置 - 将 MediaPipe 关键点映射到标准骨骼名称
 * 这个映射表支持不同命名约定的模型
 */
export const BONE_MAPPING = {
    // 脊柱/躯干
    spine: { landmarks: [23, 24, 11, 12], type: 'center' }, // 髋部到肩部中心
    spine1: { landmarks: [11, 12], type: 'center' },
    spine2: { landmarks: [11, 12], type: 'center' },
    chest: { landmarks: [11, 12], type: 'center' },
    neck: { landmarks: [11, 12, 0], type: 'chain' },
    head: { landmarks: [0, 7, 8], type: 'head' },

    // 左臂
    leftShoulder: { landmarks: [11], type: 'joint' },
    leftUpperArm: { from: 11, to: 13, type: 'limb' },
    leftForeArm: { from: 13, to: 15, type: 'limb' },
    leftHand: { landmarks: [15, 17, 19, 21], type: 'hand' },

    // 右臂
    rightShoulder: { landmarks: [12], type: 'joint' },
    rightUpperArm: { from: 12, to: 14, type: 'limb' },
    rightForeArm: { from: 14, to: 16, type: 'limb' },
    rightHand: { landmarks: [16, 18, 20, 22], type: 'hand' },

    // 左腿
    leftUpLeg: { from: 23, to: 25, type: 'limb' },
    leftLeg: { from: 25, to: 27, type: 'limb' },
    leftFoot: { landmarks: [27, 29, 31], type: 'foot' },

    // 右腿
    rightUpLeg: { from: 24, to: 26, type: 'limb' },
    rightLeg: { from: 26, to: 28, type: 'limb' },
    rightFoot: { landmarks: [28, 30, 32], type: 'foot' }
};

/**
 * 常见骨骼名称别名 - 支持不同模型的命名约定
 */
export const BONE_NAME_ALIASES = {
    // Mixamo 命名
    'mixamorigHips': 'spine',
    'mixamorigSpine': 'spine1',
    'mixamorigSpine1': 'spine2',
    'mixamorigSpine2': 'chest',
    'mixamorigNeck': 'neck',
    'mixamorigHead': 'head',
    'mixamorigLeftShoulder': 'leftShoulder',
    'mixamorigLeftArm': 'leftUpperArm',
    'mixamorigLeftForeArm': 'leftForeArm',
    'mixamorigLeftHand': 'leftHand',
    'mixamorigRightShoulder': 'rightShoulder',
    'mixamorigRightArm': 'rightUpperArm',
    'mixamorigRightForeArm': 'rightForeArm',
    'mixamorigRightHand': 'rightHand',
    'mixamorigLeftUpLeg': 'leftUpLeg',
    'mixamorigLeftLeg': 'leftLeg',
    'mixamorigLeftFoot': 'leftFoot',
    'mixamorigRightUpLeg': 'rightUpLeg',
    'mixamorigRightLeg': 'rightLeg',
    'mixamorigRightFoot': 'rightFoot',

    // Blender 标准命名
    'Hips': 'spine',
    'Spine': 'spine1',
    'Spine1': 'spine2',
    'Spine2': 'chest',
    'Neck': 'neck',
    'Head': 'head',
    'LeftShoulder': 'leftShoulder',
    'LeftArm': 'leftUpperArm',
    'LeftForeArm': 'leftForeArm',
    'LeftHand': 'leftHand',
    'RightShoulder': 'rightShoulder',
    'RightArm': 'rightUpperArm',
    'RightForeArm': 'rightForeArm',
    'RightHand': 'rightHand',
    'LeftUpLeg': 'leftUpLeg',
    'LeftLeg': 'leftLeg',
    'LeftFoot': 'leftFoot',
    'RightUpLeg': 'rightUpLeg',
    'RightLeg': 'rightLeg',
    'RightFoot': 'rightFoot',

    // 简单命名
    'shoulder_l': 'leftShoulder',
    'upper_arm_l': 'leftUpperArm',
    'forearm_l': 'leftForeArm',
    'hand_l': 'leftHand',
    'shoulder_r': 'rightShoulder',
    'upper_arm_r': 'rightUpperArm',
    'forearm_r': 'rightForeArm',
    'hand_r': 'rightHand',
    'thigh_l': 'leftUpLeg',
    'shin_l': 'leftLeg',
    'foot_l': 'leftFoot',
    'thigh_r': 'rightUpLeg',
    'shin_r': 'rightLeg',
    'foot_r': 'rightFoot'
};

/**
 * SkeletonDrivenCharacter - 使用 MediaPipe 驱动 3D 模型骨骼的角色类
 */
export class SkeletonDrivenCharacter {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            modelPath: options.modelPath || '../../models/christmas_elf/scene.gltf',
            scale: options.scale || 0.01,
            positionOffset: options.positionOffset || new THREE.Vector3(0, 0, 0),
            debug: options.debug || false,
            smoothing: options.smoothing || 0.3, // 平滑因子
            ...options
        };

        this.group = new THREE.Group();
        this.model = null;
        this.skeleton = null;
        this.bones = {};
        this.boneHelpers = null;
        this.visible = false;
        this.isLoaded = false;

        // 用于平滑的上一帧数据
        this.previousLandmarks = null;
        this.previousRotations = {};

        // 初始骨骼姿态（T-Pose 或 A-Pose）
        this.restPose = {};

        this.scene.add(this.group);
    }

    /**
     * 加载 GLTF/GLB 模型
     */
    async loadModel(modelPath = null) {
        const path = modelPath || this.options.modelPath;
        const loader = new GLTFLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.scale.setScalar(this.options.scale);
                    this.model.position.copy(this.options.positionOffset);

                    // 查找骨骼
                    this.findSkeleton();

                    // 如果开启调试，显示骨骼辅助器
                    if (this.options.debug && this.skeleton) {
                        this.boneHelpers = new THREE.SkeletonHelper(this.model);
                        this.group.add(this.boneHelpers);
                    }

                    this.group.add(this.model);
                    this.isLoaded = true;

                    console.log('Model loaded:', path);
                    console.log('Found bones:', Object.keys(this.bones));

                    resolve(this);
                },
                (progress) => {
                    console.log('Loading progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
                },
                (error) => {
                    console.error('Error loading model:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * 在模型中查找骨骼并建立映射
     */
    findSkeleton() {
        this.model.traverse((object) => {
            // 查找 SkinnedMesh 的骨骼
            if (object.isSkinnedMesh && object.skeleton) {
                this.skeleton = object.skeleton;
                console.log('Found skeleton with', this.skeleton.bones.length, 'bones');

                // 遍历骨骼并建立映射
                this.skeleton.bones.forEach((bone) => {
                    const standardName = this.getStandardBoneName(bone.name);
                    if (standardName) {
                        this.bones[standardName] = bone;
                        // 保存初始姿态
                        this.restPose[standardName] = {
                            position: bone.position.clone(),
                            rotation: bone.quaternion.clone(),
                            scale: bone.scale.clone()
                        };
                    }
                    console.log(`Bone: ${bone.name} -> ${standardName || 'unmapped'}`);
                });
            }

            // 也检查普通骨骼（Bone 类型）
            if (object.isBone) {
                const standardName = this.getStandardBoneName(object.name);
                if (standardName && !this.bones[standardName]) {
                    this.bones[standardName] = object;
                    this.restPose[standardName] = {
                        position: object.position.clone(),
                        rotation: object.quaternion.clone(),
                        scale: object.scale.clone()
                    };
                }
            }
        });
    }

    /**
     * 获取标准化的骨骼名称
     */
    getStandardBoneName(boneName) {
        // 首先检查别名表
        if (BONE_NAME_ALIASES[boneName]) {
            return BONE_NAME_ALIASES[boneName];
        }

        // 检查小写版本
        const lowerName = boneName.toLowerCase();
        for (const [alias, standard] of Object.entries(BONE_NAME_ALIASES)) {
            if (alias.toLowerCase() === lowerName) {
                return standard;
            }
        }

        // 模糊匹配
        if (lowerName.includes('hip') || lowerName.includes('pelvis')) return 'spine';
        if (lowerName.includes('spine') && !lowerName.includes('1') && !lowerName.includes('2')) return 'spine1';
        if (lowerName.includes('chest') || lowerName.includes('torso')) return 'chest';
        if (lowerName.includes('neck')) return 'neck';
        if (lowerName.includes('head') && !lowerName.includes('end')) return 'head';

        // 手臂
        if (lowerName.includes('shoulder') && lowerName.includes('l')) return 'leftShoulder';
        if (lowerName.includes('shoulder') && lowerName.includes('r')) return 'rightShoulder';
        if ((lowerName.includes('arm') || lowerName.includes('upper')) && lowerName.includes('l') && !lowerName.includes('fore')) return 'leftUpperArm';
        if ((lowerName.includes('arm') || lowerName.includes('upper')) && lowerName.includes('r') && !lowerName.includes('fore')) return 'rightUpperArm';
        if (lowerName.includes('fore') && lowerName.includes('l')) return 'leftForeArm';
        if (lowerName.includes('fore') && lowerName.includes('r')) return 'rightForeArm';
        if (lowerName.includes('hand') && lowerName.includes('l')) return 'leftHand';
        if (lowerName.includes('hand') && lowerName.includes('r')) return 'rightHand';

        // 腿
        if ((lowerName.includes('thigh') || lowerName.includes('upleg')) && lowerName.includes('l')) return 'leftUpLeg';
        if ((lowerName.includes('thigh') || lowerName.includes('upleg')) && lowerName.includes('r')) return 'rightUpLeg';
        if ((lowerName.includes('shin') || lowerName.includes('calf') || (lowerName.includes('leg') && !lowerName.includes('up'))) && lowerName.includes('l')) return 'leftLeg';
        if ((lowerName.includes('shin') || lowerName.includes('calf') || (lowerName.includes('leg') && !lowerName.includes('up'))) && lowerName.includes('r')) return 'rightLeg';
        if (lowerName.includes('foot') && lowerName.includes('l')) return 'leftFoot';
        if (lowerName.includes('foot') && lowerName.includes('r')) return 'rightFoot';

        return null;
    }

    /**
     * 从 MediaPipe 关键点获取世界坐标
     */
    getLandmarkPosition(landmarks, index) {
        const l = landmarks[index];
        if (!l) return null;

        // MediaPipe 坐标系转换到 Three.js 坐标系
        // MediaPipe: x 向右 (0-1), y 向下 (0-1), z 向屏幕外 (深度)
        // Three.js: x 向右, y 向上, z 向屏幕外
        return new THREE.Vector3(
            (0.5 - l.x) * 4,  // 水平翻转并缩放
            (0.5 - l.y) * 3,  // 垂直翻转并缩放
            -l.z * 2          // 深度
        );
    }

    /**
     * 计算两个关键点之间的方向向量
     */
    getLimbDirection(landmarks, fromIdx, toIdx) {
        const from = this.getLandmarkPosition(landmarks, fromIdx);
        const to = this.getLandmarkPosition(landmarks, toIdx);

        if (!from || !to) return null;

        return new THREE.Vector3().subVectors(to, from).normalize();
    }

    /**
     * 根据方向向量计算骨骼旋转
     */
    calculateBoneRotation(direction, restDirection = new THREE.Vector3(0, -1, 0)) {
        if (!direction) return null;

        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(restDirection, direction);

        return quaternion;
    }

    /**
     * 平滑插值
     */
    smoothQuaternion(current, target, factor) {
        return current.slerp(target, factor);
    }

    /**
     * 使用 MediaPipe 关键点更新骨骼
     */
    update(landmarks) {
        if (!this.isLoaded || !landmarks || landmarks.length === 0) return;

        // 应用平滑
        const smoothedLandmarks = this.smoothLandmarks(landmarks);

        // 更新各个骨骼
        this.updateSpine(smoothedLandmarks);
        this.updateHead(smoothedLandmarks);
        this.updateArms(smoothedLandmarks);
        this.updateLegs(smoothedLandmarks);

        // 更新整体位置（基于髋部）
        this.updateRootPosition(smoothedLandmarks);

        // 保存当前帧数据用于下一帧平滑
        this.previousLandmarks = smoothedLandmarks;
    }

    /**
     * 平滑关键点数据
     */
    smoothLandmarks(landmarks) {
        if (!this.previousLandmarks) {
            return landmarks;
        }

        const smoothed = [];
        const factor = this.options.smoothing;

        for (let i = 0; i < landmarks.length; i++) {
            const curr = landmarks[i];
            const prev = this.previousLandmarks[i];

            if (prev) {
                smoothed.push({
                    x: prev.x + (curr.x - prev.x) * factor,
                    y: prev.y + (curr.y - prev.y) * factor,
                    z: prev.z + (curr.z - prev.z) * factor,
                    visibility: curr.visibility
                });
            } else {
                smoothed.push(curr);
            }
        }

        return smoothed;
    }

    /**
     * 更新脊柱骨骼
     */
    updateSpine(landmarks) {
        const leftHip = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.LEFT_HIP);
        const rightHip = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.RIGHT_HIP);
        const leftShoulder = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.LEFT_SHOULDER);
        const rightShoulder = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.RIGHT_SHOULDER);

        if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return;

        // 计算髋部和肩部中心
        const hipCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
        const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);

        // 脊柱方向
        const spineDirection = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();

        // 计算躯干旋转
        const spineRotation = this.calculateBoneRotation(spineDirection, new THREE.Vector3(0, 1, 0));

        // 计算躯干侧向倾斜（基于肩部和髋部的相对位置）
        const shoulderLine = new THREE.Vector3().subVectors(rightShoulder, leftShoulder).normalize();
        const hipLine = new THREE.Vector3().subVectors(rightHip, leftHip).normalize();

        // 应用到骨骼
        if (this.bones.spine && spineRotation) {
            this.applyRotationToBone('spine', spineRotation);
        }

        if (this.bones.chest && spineRotation) {
            // 胸部可以有额外的旋转
            const chestRotation = spineRotation.clone();
            this.applyRotationToBone('chest', chestRotation);
        }
    }

    /**
     * 更新头部骨骼
     */
    updateHead(landmarks) {
        const nose = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.NOSE);
        const leftEar = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.LEFT_EAR);
        const rightEar = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.RIGHT_EAR);
        const leftShoulder = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.LEFT_SHOULDER);
        const rightShoulder = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.RIGHT_SHOULDER);

        if (!nose || !leftShoulder || !rightShoulder) return;

        const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);

        // 头部方向（从肩部中心到鼻子）
        const headDirection = new THREE.Vector3().subVectors(nose, shoulderCenter).normalize();

        // 头部旋转
        const headRotation = this.calculateBoneRotation(headDirection, new THREE.Vector3(0, 1, 0));

        // 如果有耳朵数据，计算头部侧转
        if (leftEar && rightEar) {
            const earLine = new THREE.Vector3().subVectors(rightEar, leftEar).normalize();
            // 可以基于耳朵位置计算头部的 yaw 旋转
        }

        if (this.bones.head && headRotation) {
            this.applyRotationToBone('head', headRotation);
        }

        if (this.bones.neck && headRotation) {
            // 颈部旋转是头部旋转的一部分
            const neckRotation = headRotation.clone();
            neckRotation.slerp(new THREE.Quaternion(), 0.5); // 减弱旋转
            this.applyRotationToBone('neck', neckRotation);
        }
    }

    /**
     * 更新手臂骨骼
     */
    updateArms(landmarks) {
        // 左臂
        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.LEFT_SHOULDER,
            MEDIAPIPE_LANDMARKS.LEFT_ELBOW,
            'leftUpperArm',
            new THREE.Vector3(1, 0, 0) // 左臂默认指向左侧
        );

        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.LEFT_ELBOW,
            MEDIAPIPE_LANDMARKS.LEFT_WRIST,
            'leftForeArm',
            new THREE.Vector3(1, 0, 0)
        );

        // 右臂
        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.RIGHT_SHOULDER,
            MEDIAPIPE_LANDMARKS.RIGHT_ELBOW,
            'rightUpperArm',
            new THREE.Vector3(-1, 0, 0) // 右臂默认指向右侧
        );

        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.RIGHT_ELBOW,
            MEDIAPIPE_LANDMARKS.RIGHT_WRIST,
            'rightForeArm',
            new THREE.Vector3(-1, 0, 0)
        );

        // 更新手部
        this.updateHand(landmarks, 'left');
        this.updateHand(landmarks, 'right');
    }

    /**
     * 更新腿部骨骼
     */
    updateLegs(landmarks) {
        // 左腿
        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.LEFT_HIP,
            MEDIAPIPE_LANDMARKS.LEFT_KNEE,
            'leftUpLeg',
            new THREE.Vector3(0, -1, 0) // 腿默认向下
        );

        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.LEFT_KNEE,
            MEDIAPIPE_LANDMARKS.LEFT_ANKLE,
            'leftLeg',
            new THREE.Vector3(0, -1, 0)
        );

        // 右腿
        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.RIGHT_HIP,
            MEDIAPIPE_LANDMARKS.RIGHT_KNEE,
            'rightUpLeg',
            new THREE.Vector3(0, -1, 0)
        );

        this.updateLimb(
            landmarks,
            MEDIAPIPE_LANDMARKS.RIGHT_KNEE,
            MEDIAPIPE_LANDMARKS.RIGHT_ANKLE,
            'rightLeg',
            new THREE.Vector3(0, -1, 0)
        );

        // 更新脚部
        this.updateFoot(landmarks, 'left');
        this.updateFoot(landmarks, 'right');
    }

    /**
     * 更新单个肢体骨骼
     */
    updateLimb(landmarks, fromIdx, toIdx, boneName, restDirection) {
        const bone = this.bones[boneName];
        if (!bone) return;

        const direction = this.getLimbDirection(landmarks, fromIdx, toIdx);
        if (!direction) return;

        const rotation = this.calculateBoneRotation(direction, restDirection);
        if (rotation) {
            this.applyRotationToBone(boneName, rotation);
        }
    }

    /**
     * 更新手部
     */
    updateHand(landmarks, side) {
        const boneName = side === 'left' ? 'leftHand' : 'rightHand';
        const bone = this.bones[boneName];
        if (!bone) return;

        const wristIdx = side === 'left' ? MEDIAPIPE_LANDMARKS.LEFT_WRIST : MEDIAPIPE_LANDMARKS.RIGHT_WRIST;
        const indexIdx = side === 'left' ? MEDIAPIPE_LANDMARKS.LEFT_INDEX : MEDIAPIPE_LANDMARKS.RIGHT_INDEX;

        const direction = this.getLimbDirection(landmarks, wristIdx, indexIdx);
        if (!direction) return;

        const restDirection = side === 'left' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-1, 0, 0);
        const rotation = this.calculateBoneRotation(direction, restDirection);

        if (rotation) {
            this.applyRotationToBone(boneName, rotation);
        }
    }

    /**
     * 更新脚部
     */
    updateFoot(landmarks, side) {
        const boneName = side === 'left' ? 'leftFoot' : 'rightFoot';
        const bone = this.bones[boneName];
        if (!bone) return;

        const ankleIdx = side === 'left' ? MEDIAPIPE_LANDMARKS.LEFT_ANKLE : MEDIAPIPE_LANDMARKS.RIGHT_ANKLE;
        const footIdx = side === 'left' ? MEDIAPIPE_LANDMARKS.LEFT_FOOT_INDEX : MEDIAPIPE_LANDMARKS.RIGHT_FOOT_INDEX;

        const direction = this.getLimbDirection(landmarks, ankleIdx, footIdx);
        if (!direction) return;

        const rotation = this.calculateBoneRotation(direction, new THREE.Vector3(0, 0, 1));

        if (rotation) {
            this.applyRotationToBone(boneName, rotation);
        }
    }

    /**
     * 应用旋转到骨骼（带平滑）
     */
    applyRotationToBone(boneName, targetRotation) {
        const bone = this.bones[boneName];
        if (!bone) return;

        // 获取或初始化之前的旋转
        if (!this.previousRotations[boneName]) {
            this.previousRotations[boneName] = bone.quaternion.clone();
        }

        // 平滑插值
        const smoothedRotation = this.previousRotations[boneName].clone();
        smoothedRotation.slerp(targetRotation, this.options.smoothing);

        // 应用旋转
        bone.quaternion.copy(smoothedRotation);

        // 保存当前旋转
        this.previousRotations[boneName] = smoothedRotation.clone();
    }

    /**
     * 更新模型根位置
     */
    updateRootPosition(landmarks) {
        const leftHip = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.LEFT_HIP);
        const rightHip = this.getLandmarkPosition(landmarks, MEDIAPIPE_LANDMARKS.RIGHT_HIP);

        if (!leftHip || !rightHip) return;

        const hipCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);

        // 平滑位置更新
        if (this.model) {
            this.model.position.lerp(
                hipCenter.add(this.options.positionOffset),
                this.options.smoothing
            );
        }
    }

    /**
     * 重置到初始姿态
     */
    resetToRestPose() {
        for (const [boneName, pose] of Object.entries(this.restPose)) {
            const bone = this.bones[boneName];
            if (bone) {
                bone.position.copy(pose.position);
                bone.quaternion.copy(pose.rotation);
                bone.scale.copy(pose.scale);
            }
        }
        this.previousRotations = {};
    }

    /**
     * 设置可见性
     */
    setVisible(visible) {
        this.group.visible = visible;
        this.visible = visible;
    }

    /**
     * 设置调试模式
     */
    setDebug(debug) {
        this.options.debug = debug;
        if (this.boneHelpers) {
            this.boneHelpers.visible = debug;
        }
    }

    /**
     * 销毁角色
     */
    dispose() {
        if (this.model) {
            this.scene.remove(this.group);
            this.model.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    }
}

/**
 * 简化版：对于没有骨骼的静态模型，保持完整形态
 * 模型整体跟随人体位置和朝向移动
 */
export class SegmentDrivenCharacter {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            modelPath: options.modelPath || '/models/christmas_elf/scene.gltf',
            scale: options.scale || 0.5,  // 调大默认缩放以便看到
            smoothing: options.smoothing || 0.15, // 平滑因子
            yOffset: options.yOffset || 0, // Y轴偏移
            ...options
        };

        this.group = new THREE.Group();
        this.model = null;
        this.visible = false;
        this.isLoaded = false;

        // 用于平滑的历史数据
        this.previousPosition = null;
        this.previousRotation = 0;
        this.targetPosition = new THREE.Vector3();
        this.targetRotationY = 0;

        this.scene.add(this.group);
    }

    /**
     * 加载模型
     */
    async loadModel(modelPath = null) {
        const path = modelPath || this.options.modelPath;
        const loader = new GLTFLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.scale.setScalar(this.options.scale);
                    
                    // 计算模型边界框以正确定位
                    const box = new THREE.Box3().setFromObject(this.model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    
                    // 将模型中心移到原点
                    this.model.position.sub(center);
                    this.model.position.y += size.y / 2; // 让模型脚底在原点
                    
                    this.modelHeight = size.y;
                    
                    this.group.add(this.model);
                    this.isLoaded = true;

                    console.log('Static model loaded:', path);
                    console.log('Model height:', this.modelHeight);
                    resolve(this);
                },
                (progress) => {
                    if (progress.total > 0) {
                        console.log('Loading:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
                    }
                },
                (error) => {
                    console.error('Failed to load model:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * 更新模型位置和旋转（整体跟随，保持模型完整）
     */
    update(landmarks) {
        if (!this.isLoaded || !landmarks) return;

        // 获取关键点坐标 - 与 skeleton.js 保持一致
        const getPos = (index) => {
            const l = landmarks[index];
            if (!l) return null;
            return new THREE.Vector3(
                (0.5 - l.x) * 2,
                (1 - l.y) * 2,
                -l.z
            );
        };

        // 获取关键点
        const leftHip = getPos(MEDIAPIPE_LANDMARKS.LEFT_HIP);
        const rightHip = getPos(MEDIAPIPE_LANDMARKS.RIGHT_HIP);
        const leftShoulder = getPos(MEDIAPIPE_LANDMARKS.LEFT_SHOULDER);
        const rightShoulder = getPos(MEDIAPIPE_LANDMARKS.RIGHT_SHOULDER);

        if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return;

        // 计算身体中心位置
        const hipCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
        const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
        const bodyCenter = new THREE.Vector3().addVectors(hipCenter, shoulderCenter).multiplyScalar(0.5);

        // 目标位置：直接使用身体中心
        this.targetPosition.copy(bodyCenter);

        // 计算身体朝向（基于肩部线）
        const shoulderDirection = new THREE.Vector3().subVectors(rightShoulder, leftShoulder);
        // 身体面向的方向（垂直于肩部线）
        const bodyForward = new THREE.Vector3(-shoulderDirection.z, 0, shoulderDirection.x).normalize();
        this.targetRotationY = Math.atan2(bodyForward.x, bodyForward.z);

        // 计算身体倾斜（可选：基于脊柱方向）
        const spineDirection = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
        const tiltX = Math.asin(spineDirection.z) * 0.3; // 前后倾斜
        const tiltZ = -Math.asin(spineDirection.x) * 0.3; // 左右倾斜

        // 平滑更新位置
        if (this.previousPosition) {
            this.group.position.lerp(this.targetPosition, this.options.smoothing);
        } else {
            this.group.position.copy(this.targetPosition);
        }
        this.previousPosition = this.group.position.clone();

        // 平滑更新旋转
        // 处理角度环绕问题
        let rotationDiff = this.targetRotationY - this.previousRotation;
        if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        
        this.previousRotation += rotationDiff * this.options.smoothing;
        this.group.rotation.y = this.previousRotation;
        
        // 应用轻微的身体倾斜
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, tiltX, this.options.smoothing);
        this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, tiltZ, this.options.smoothing);
    }

    setVisible(visible) {
        this.group.visible = visible;
        this.visible = visible;
    }

    dispose() {
        if (this.model) {
            this.scene.remove(this.group);
        }
    }
}
