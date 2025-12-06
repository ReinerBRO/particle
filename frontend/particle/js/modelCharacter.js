import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * 可用的 3D 模型列表
 */
export const AVAILABLE_MODELS = [
    { id: 'christmas_elf', name: 'Christmas Elf', path: '/models/christmas_elf/scene.gltf' },
    { id: 'gingy', name: 'Gingy', path: '/models/gingy_the_gingebread_man/scene.gltf' },
    { id: 'gingerbread_man', name: 'Gingerbread Man', path: '/models/gingerbread_man/scene.gltf' },
    { id: 'gingerbread_man_alt', name: 'Gingerbread Man Alt', path: '/models/gingerbread_man (1)/scene.gltf' },
    { id: 'gingerbread_joy', name: 'Gingerbread Joy', path: '/models/gingerbread_joy/scene.gltf' },
    { id: 'gingerbread_joy_alt', name: 'Gingerbread Joy Alt', path: '/models/gingerbread_joy (1)/scene.gltf' },
    { id: 'ginger_cookies', name: 'Ginger Cookies', path: '/models/christmas_ginger_bread_cookies/scene.gltf' },
    { id: 'shrek_gingy', name: 'Shrek Gingy', path: '/models/shrek_2_gingerbread_man/scene.gltf' },
];

/**
 * MediaPipe 关键点索引
 */
const LANDMARKS = {
    NOSE: 0,
    LEFT_EYE: 2,
    RIGHT_EYE: 5,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28
};

/**
 * 圣诞树高度常量（用于计算模型目标高度）
 */
const TREE_HEIGHT = 3.6;
const TARGET_MODEL_HEIGHT = TREE_HEIGHT * 0.75;

/**
 * 骨骼名称别名映射
 */
const BONE_ALIASES = {
    // 通用
    'hips': 'hips', 'pelvis': 'hips', 'root': 'hips',
    'spine': 'spine', 'spine1': 'spine1', 'spine2': 'spine2',
    'chest': 'chest', 'upperchest': 'chest',
    'neck': 'neck',
    'head': 'head',
    
    // 左臂
    'leftshoulder': 'leftShoulder', 'shoulderl': 'leftShoulder', 'lshoulder': 'leftShoulder',
    'leftarm': 'leftUpperArm', 'leftupperarm': 'leftUpperArm', 'upperarml': 'leftUpperArm', 'lupperarm': 'leftUpperArm',
    'leftforearm': 'leftForeArm', 'forearml': 'leftForeArm', 'lforearm': 'leftForeArm',
    'lefthand': 'leftHand', 'handl': 'leftHand', 'lhand': 'leftHand',
    
    // 右臂
    'rightshoulder': 'rightShoulder', 'shoulderr': 'rightShoulder', 'rshoulder': 'rightShoulder',
    'rightarm': 'rightUpperArm', 'rightupperarm': 'rightUpperArm', 'upperarmr': 'rightUpperArm', 'rupperarm': 'rightUpperArm',
    'rightforearm': 'rightForeArm', 'forearmr': 'rightForeArm', 'rforearm': 'rightForeArm',
    'righthand': 'rightHand', 'handr': 'rightHand', 'rhand': 'rightHand',
    
    // 左腿
    'leftupleg': 'leftUpLeg', 'leftthigh': 'leftUpLeg', 'thighl': 'leftUpLeg', 'lthigh': 'leftUpLeg',
    'leftleg': 'leftLeg', 'leftshin': 'leftLeg', 'shinl': 'leftLeg', 'lshin': 'leftLeg', 'leftlowleg': 'leftLeg',
    'leftfoot': 'leftFoot', 'footl': 'leftFoot', 'lfoot': 'leftFoot',
    
    // 右腿
    'rightupleg': 'rightUpLeg', 'rightthigh': 'rightUpLeg', 'thighr': 'rightUpLeg', 'rthigh': 'rightUpLeg',
    'rightleg': 'rightLeg', 'rightshin': 'rightLeg', 'shinr': 'rightLeg', 'rshin': 'rightLeg', 'rightlowleg': 'rightLeg',
    'rightfoot': 'rightFoot', 'footr': 'rightFoot', 'rfoot': 'rightFoot',

    // Mixamo 命名
    'mixamorigleftarm': 'leftUpperArm',
    'mixamorigrightarm': 'rightUpperArm',
    'mixamorigleftforearm': 'leftForeArm',
    'mixamorigrightforearm': 'rightForeArm',
    'mixamorigleftupleg': 'leftUpLeg',
    'mixamorigrightupleg': 'rightUpLeg',
    'mixamorigleftleg': 'leftLeg',
    'mixamorigrightleg': 'rightLeg',
};

/**
 * ModelCharacter - 统一的 3D 模型角色类，支持骨骼驱动
 */
export class ModelCharacter {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.model = null;
        this.visible = false;
        this.isLoaded = false;
        this.currentModelId = null;

        // 骨骼相关
        this.skeleton = null;
        this.bones = {};
        this.hasSkeleton = false;
        this.restPose = {};

        // 平滑参数
        this.smoothing = 0.25;

        // 平滑数据
        this.previousPosition = null;
        this.previousRotation = 0;
        this.previousLandmarks = null;
        this.previousBoneRotations = {};
        this.targetPosition = new THREE.Vector3();

        // 模型缓存
        this.modelCache = {};
        this.skeletonCache = {};
        this.loader = new GLTFLoader();
        
        // 跟踪正在加载的模型，防止重复加载
        this.loadingPromises = {};

        this.scene.add(this.group);
    }

    /**
     * 激活缓存的模型
     */
    _activateModel(modelId) {
        // 隐藏所有缓存的模型
        Object.values(this.modelCache).forEach(m => m.visible = false);
        
        this.model = this.modelCache[modelId];
        this.model.visible = this.visible;
        this.bones = this.skeletonCache[modelId]?.bones || {};
        this.hasSkeleton = this.skeletonCache[modelId]?.hasSkeleton || false;
        this.restPose = this.skeletonCache[modelId]?.restPose || {};
        this.currentModelId = modelId;
        this.isLoaded = true;
    }

    /**
     * 加载指定模型
     */
    async loadModel(modelId) {
        const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId);
        if (!modelInfo) {
            console.error('Model not found:', modelId);
            return;
        }

        // 如果已经是当前模型且已加载完成，无需重新加载
        if (this.currentModelId === modelId && this.isLoaded) {
            return;
        }

        // 如果该模型正在加载中，等待它完成
        if (this.loadingPromises[modelId]) {
            console.log('Model already loading, waiting:', modelId);
            await this.loadingPromises[modelId];
            this._activateModel(modelId);
            return;
        }

        // 隐藏所有缓存的模型
        Object.values(this.modelCache).forEach(m => m.visible = false);

        // 检查缓存
        if (this.modelCache[modelId]) {
            this._activateModel(modelId);
            console.log('Model loaded from cache:', modelId, 'Has skeleton:', this.hasSkeleton);
            return;
        }

        // 创建加载 Promise 并缓存
        this.loadingPromises[modelId] = this._loadModelAsync(modelId, modelInfo);
        
        try {
            await this.loadingPromises[modelId];
        } finally {
            // 加载完成后清除 promise 缓存
            delete this.loadingPromises[modelId];
        }
    }

    /**
     * 实际加载模型的异步方法
     */
    async _loadModelAsync(modelId, modelInfo) {
        try {
            const gltf = await new Promise((resolve, reject) => {
                this.loader.load(
                    modelInfo.path, 
                    resolve, 
                    (progress) => {
                        if (progress.total > 0) {
                            console.log(`Loading ${modelId}: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
                        }
                    },
                    reject
                );
            });

            const newModel = gltf.scene;

            // 计算并应用缩放
            const box = new THREE.Box3().setFromObject(newModel);
            const size = box.getSize(new THREE.Vector3());
            const scale = TARGET_MODEL_HEIGHT / size.y;
            newModel.scale.setScalar(scale);

            // 重新计算边界框并居中
            box.setFromObject(newModel);
            const center = box.getCenter(new THREE.Vector3());
            const newSize = box.getSize(new THREE.Vector3());
            newModel.position.sub(center);
            newModel.position.y += newSize.y / 2;

            // 查找骨骼
            this.bones = {};
            this.hasSkeleton = false;
            this.restPose = {};
            this.findAndMapBones(newModel);

            // 添加到组并缓存
            this.group.add(newModel);
            this.modelCache[modelId] = newModel;
            this.skeletonCache[modelId] = {
                bones: { ...this.bones },
                hasSkeleton: this.hasSkeleton,
                restPose: { ...this.restPose }
            };
            
            // 激活模型
            this._activateModel(modelId);

            console.log(`Model ${modelId} loaded. Has skeleton: ${this.hasSkeleton}, Bones found:`, Object.keys(this.bones));
        } catch (error) {
            console.error('Failed to load model:', modelId, error);
            throw error;
        }
    }

    /**
     * 查找并映射骨骼
     */
    findAndMapBones(model) {
        model.traverse((object) => {
            // 查找 SkinnedMesh 的骨骼
            if (object.isSkinnedMesh && object.skeleton) {
                this.skeleton = object.skeleton;
                this.hasSkeleton = true;
                
                object.skeleton.bones.forEach((bone) => {
                    this.mapBone(bone);
                });
            }

            // 也检查普通骨骼
            if (object.isBone) {
                this.mapBone(object);
            }
        });
    }

    /**
     * 映射单个骨骼
     */
    mapBone(bone) {
        const name = bone.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // 检查别名
        for (const [alias, standard] of Object.entries(BONE_ALIASES)) {
            if (name.includes(alias) || alias.includes(name)) {
                if (!this.bones[standard]) {
                    this.bones[standard] = bone;
                    this.restPose[standard] = {
                        position: bone.position.clone(),
                        quaternion: bone.quaternion.clone()
                    };
                    this.hasSkeleton = true;
                }
                return;
            }
        }

        // 模糊匹配
        let standardName = null;
        if (name.includes('hip') || name.includes('pelvis')) standardName = 'hips';
        else if (name.includes('spine')) standardName = 'spine';
        else if (name.includes('chest') || name.includes('torso')) standardName = 'chest';
        else if (name.includes('neck')) standardName = 'neck';
        else if (name.includes('head') && !name.includes('end')) standardName = 'head';
        
        // 手臂
        else if (name.includes('shoulder') && (name.includes('l') || name.includes('left'))) standardName = 'leftShoulder';
        else if (name.includes('shoulder') && (name.includes('r') || name.includes('right'))) standardName = 'rightShoulder';
        else if ((name.includes('arm') || name.includes('upper')) && (name.includes('l') || name.includes('left')) && !name.includes('fore')) standardName = 'leftUpperArm';
        else if ((name.includes('arm') || name.includes('upper')) && (name.includes('r') || name.includes('right')) && !name.includes('fore')) standardName = 'rightUpperArm';
        else if (name.includes('fore') && (name.includes('l') || name.includes('left'))) standardName = 'leftForeArm';
        else if (name.includes('fore') && (name.includes('r') || name.includes('right'))) standardName = 'rightForeArm';
        else if (name.includes('hand') && (name.includes('l') || name.includes('left'))) standardName = 'leftHand';
        else if (name.includes('hand') && (name.includes('r') || name.includes('right'))) standardName = 'rightHand';
        
        // 腿
        else if ((name.includes('thigh') || name.includes('upleg')) && (name.includes('l') || name.includes('left'))) standardName = 'leftUpLeg';
        else if ((name.includes('thigh') || name.includes('upleg')) && (name.includes('r') || name.includes('right'))) standardName = 'rightUpLeg';
        else if ((name.includes('shin') || name.includes('calf') || name.includes('leg')) && (name.includes('l') || name.includes('left')) && !name.includes('up')) standardName = 'leftLeg';
        else if ((name.includes('shin') || name.includes('calf') || name.includes('leg')) && (name.includes('r') || name.includes('right')) && !name.includes('up')) standardName = 'rightLeg';
        else if (name.includes('foot') && (name.includes('l') || name.includes('left'))) standardName = 'leftFoot';
        else if (name.includes('foot') && (name.includes('r') || name.includes('right'))) standardName = 'rightFoot';

        if (standardName && !this.bones[standardName]) {
            this.bones[standardName] = bone;
            this.restPose[standardName] = {
                position: bone.position.clone(),
                quaternion: bone.quaternion.clone()
            };
            this.hasSkeleton = true;
        }
    }

    /**
     * 获取关键点位置
     */
    getPos(landmarks, index) {
        const l = landmarks[index];
        if (!l) return null;
        return new THREE.Vector3(
            (0.5 - l.x) * 2,
            (1 - l.y) * 2,
            -l.z
        );
    }

    /**
     * 平滑关键点
     */
    smoothLandmarks(landmarks) {
        if (!this.previousLandmarks) {
            this.previousLandmarks = landmarks.map(l => ({ ...l }));
            return landmarks;
        }

        const smoothed = landmarks.map((l, i) => {
            const prev = this.previousLandmarks[i];
            return {
                x: prev.x + (l.x - prev.x) * this.smoothing,
                y: prev.y + (l.y - prev.y) * this.smoothing,
                z: prev.z + (l.z - prev.z) * this.smoothing,
                visibility: l.visibility
            };
        });

        this.previousLandmarks = smoothed.map(l => ({ ...l }));
        return smoothed;
    }

    /**
     * 更新模型
     */
    update(landmarks) {
        if (!this.isLoaded || !landmarks || !this.model) return;

        const smoothed = this.smoothLandmarks(landmarks);

        // 更新整体位置
        this.updatePosition(smoothed);

        // 如果有骨骼，更新骨骼动画
        if (this.hasSkeleton && Object.keys(this.bones).length > 0) {
            this.updateSkeleton(smoothed);
        }
    }

    /**
     * 更新模型位置
     */
    updatePosition(landmarks) {
        const leftHip = this.getPos(landmarks, LANDMARKS.LEFT_HIP);
        const rightHip = this.getPos(landmarks, LANDMARKS.RIGHT_HIP);
        const leftShoulder = this.getPos(landmarks, LANDMARKS.LEFT_SHOULDER);
        const rightShoulder = this.getPos(landmarks, LANDMARKS.RIGHT_SHOULDER);

        if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return;

        // 身体中心
        const hipCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
        const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
        const bodyCenter = new THREE.Vector3().addVectors(hipCenter, shoulderCenter).multiplyScalar(0.5);

        this.targetPosition.copy(bodyCenter);

        // 身体朝向
        const shoulderDir = new THREE.Vector3().subVectors(rightShoulder, leftShoulder);
        const forward = new THREE.Vector3(-shoulderDir.z, 0, shoulderDir.x).normalize();
        const targetRotY = Math.atan2(forward.x, forward.z);

        // 平滑位置
        this.group.position.lerp(this.targetPosition, this.smoothing);

        // 平滑旋转
        let rotDiff = targetRotY - this.previousRotation;
        if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        this.previousRotation += rotDiff * this.smoothing;
        this.group.rotation.y = this.previousRotation;
    }

    /**
     * 更新骨骼动画
     */
    updateSkeleton(landmarks) {
        // 更新脊柱/躯干
        this.updateSpine(landmarks);
        
        // 更新头部
        this.updateHead(landmarks);
        
        // 更新手臂
        this.updateArm(landmarks, 'left');
        this.updateArm(landmarks, 'right');
        
        // 更新腿部
        this.updateLeg(landmarks, 'left');
        this.updateLeg(landmarks, 'right');
    }

    /**
     * 更新脊柱
     */
    updateSpine(landmarks) {
        const leftHip = this.getPos(landmarks, LANDMARKS.LEFT_HIP);
        const rightHip = this.getPos(landmarks, LANDMARKS.RIGHT_HIP);
        const leftShoulder = this.getPos(landmarks, LANDMARKS.LEFT_SHOULDER);
        const rightShoulder = this.getPos(landmarks, LANDMARKS.RIGHT_SHOULDER);

        if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return;

        const hipCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
        const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);

        // 脊柱方向
        const spineDir = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
        
        // 计算倾斜角度
        const tiltX = Math.asin(spineDir.z) * 0.5;
        const tiltZ = -Math.asin(spineDir.x) * 0.5;

        // 应用到脊柱骨骼
        ['spine', 'spine1', 'spine2', 'chest'].forEach(boneName => {
            const bone = this.bones[boneName];
            if (bone) {
                const euler = new THREE.Euler(tiltX * 0.3, 0, tiltZ * 0.3, 'XYZ');
                const targetQuat = new THREE.Quaternion().setFromEuler(euler);
                this.applyBoneRotation(boneName, targetQuat);
            }
        });
    }

    /**
     * 更新头部
     */
    updateHead(landmarks) {
        const nose = this.getPos(landmarks, LANDMARKS.NOSE);
        const leftShoulder = this.getPos(landmarks, LANDMARKS.LEFT_SHOULDER);
        const rightShoulder = this.getPos(landmarks, LANDMARKS.RIGHT_SHOULDER);

        if (!nose || !leftShoulder || !rightShoulder) return;

        const shoulderCenter = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
        const headDir = new THREE.Vector3().subVectors(nose, shoulderCenter).normalize();

        // 头部倾斜
        const tiltX = Math.asin(headDir.z) * 0.3;
        const tiltZ = -Math.asin(headDir.x) * 0.3;

        const bone = this.bones['head'];
        if (bone) {
            const euler = new THREE.Euler(tiltX, 0, tiltZ, 'XYZ');
            const targetQuat = new THREE.Quaternion().setFromEuler(euler);
            this.applyBoneRotation('head', targetQuat);
        }

        // 颈部
        const neckBone = this.bones['neck'];
        if (neckBone) {
            const euler = new THREE.Euler(tiltX * 0.5, 0, tiltZ * 0.5, 'XYZ');
            const targetQuat = new THREE.Quaternion().setFromEuler(euler);
            this.applyBoneRotation('neck', targetQuat);
        }
    }

    /**
     * 更新手臂
     */
    updateArm(landmarks, side) {
        const isLeft = side === 'left';
        const shoulderIdx = isLeft ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER;
        const elbowIdx = isLeft ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW;
        const wristIdx = isLeft ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST;

        const shoulder = this.getPos(landmarks, shoulderIdx);
        const elbow = this.getPos(landmarks, elbowIdx);
        const wrist = this.getPos(landmarks, wristIdx);

        if (!shoulder || !elbow || !wrist) return;

        // 上臂方向
        const upperArmDir = new THREE.Vector3().subVectors(elbow, shoulder).normalize();
        const upperArmBone = this.bones[isLeft ? 'leftUpperArm' : 'rightUpperArm'];
        
        if (upperArmBone) {
            // 计算从默认方向到目标方向的旋转
            const defaultDir = isLeft ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, upperArmDir);
            this.applyBoneRotation(isLeft ? 'leftUpperArm' : 'rightUpperArm', quat);
        }

        // 前臂方向
        const foreArmDir = new THREE.Vector3().subVectors(wrist, elbow).normalize();
        const foreArmBone = this.bones[isLeft ? 'leftForeArm' : 'rightForeArm'];
        
        if (foreArmBone) {
            const defaultDir = isLeft ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, foreArmDir);
            this.applyBoneRotation(isLeft ? 'leftForeArm' : 'rightForeArm', quat);
        }
    }

    /**
     * 更新腿部
     */
    updateLeg(landmarks, side) {
        const isLeft = side === 'left';
        const hipIdx = isLeft ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP;
        const kneeIdx = isLeft ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE;
        const ankleIdx = isLeft ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE;

        const hip = this.getPos(landmarks, hipIdx);
        const knee = this.getPos(landmarks, kneeIdx);
        const ankle = this.getPos(landmarks, ankleIdx);

        if (!hip || !knee || !ankle) return;

        // 大腿方向
        const upLegDir = new THREE.Vector3().subVectors(knee, hip).normalize();
        const upLegBone = this.bones[isLeft ? 'leftUpLeg' : 'rightUpLeg'];
        
        if (upLegBone) {
            const defaultDir = new THREE.Vector3(0, -1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, upLegDir);
            this.applyBoneRotation(isLeft ? 'leftUpLeg' : 'rightUpLeg', quat);
        }

        // 小腿方向
        const legDir = new THREE.Vector3().subVectors(ankle, knee).normalize();
        const legBone = this.bones[isLeft ? 'leftLeg' : 'rightLeg'];
        
        if (legBone) {
            const defaultDir = new THREE.Vector3(0, -1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, legDir);
            this.applyBoneRotation(isLeft ? 'leftLeg' : 'rightLeg', quat);
        }
    }

    /**
     * 应用骨骼旋转（带平滑）
     */
    applyBoneRotation(boneName, targetQuat) {
        const bone = this.bones[boneName];
        if (!bone) return;

        // 获取或初始化之前的旋转
        if (!this.previousBoneRotations[boneName]) {
            this.previousBoneRotations[boneName] = bone.quaternion.clone();
        }

        // 平滑插值
        const smoothed = this.previousBoneRotations[boneName].clone();
        smoothed.slerp(targetQuat, this.smoothing);

        // 结合初始姿态
        const rest = this.restPose[boneName];
        if (rest) {
            const final = rest.quaternion.clone().multiply(smoothed);
            bone.quaternion.copy(final);
        } else {
            bone.quaternion.copy(smoothed);
        }

        this.previousBoneRotations[boneName] = smoothed.clone();
    }

    setVisible(visible) {
        this.group.visible = visible;
        this.visible = visible;
        Object.values(this.modelCache).forEach(m => m.visible = false);
        if (this.model && visible) {
            this.model.visible = true;
        }
    }

    getCurrentModel() {
        return AVAILABLE_MODELS.find(m => m.id === this.currentModelId);
    }
}
