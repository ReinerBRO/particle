import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * 可用的 3D 模型列表
 */
export const AVAILABLE_MODELS = [
    { id: 'angel_devil', name: 'Angel Devil', path: '/models/angel_devil/scene.gltf' },
    { id: 'christmas_elf', name: 'Christmas Elf', path: '/models/christmas_elf/scene.gltf' },
    { id: 'ginger_cookies', name: 'Ginger Cookies', path: '/models/christmas_ginger_bread_cookies/scene.gltf' },
    { id: 'gingerbread_joy', name: 'Gingerbread Joy', path: '/models/gingerbread_joy/scene.gltf' },
    { id: 'gingerbread_joy_alt', name: 'Gingerbread Joy Alt', path: '/models/gingerbread_joy (1)/scene.gltf' },
    { id: 'gingerbread_man', name: 'Gingerbread Man', path: '/models/gingerbread_man/scene.gltf' },
    { id: 'gingerbread_man_alt', name: 'Gingerbread Man Alt', path: '/models/gingerbread_man (1)/scene.gltf' },
    { id: 'gingy', name: 'Gingy', path: '/models/gingy_the_gingebread_man/scene.gltf' },
    { id: 'shrek_gingy', name: 'Shrek Gingy', path: '/models/shrek_2_gingerbread_man/scene.gltf' },
    { id: 'varia_suit', name: 'Varia Suit', path: '/models/varia_suit/scene.gltf' },
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
    RIGHT_ANKLE: 28,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

/**
 * 圣诞树高度常量（用于计算模型目标高度）
 */
const TREE_HEIGHT = 3.6;
const TARGET_MODEL_HEIGHT = TREE_HEIGHT * 0.5; // 模型高度为圣诞树的一半

/**
 * 水平移动比例系数 - 放大人物在虚拟空间中的移动距离
 */
const HORIZONTAL_MOVEMENT_SCALE = 4.5; // 水平移动放大倍数

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

        // 检查是否是程序化模型
        if (!modelInfo.path) {
            this._createProceduralModel(modelId);
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
            
            // 调整特定模型的材质亮度
            this.adjustModelMaterials(newModel, modelId);

            // 添加到组并缓存
            newModel.visible = false; // 新加载的模型默认隐藏
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
     * 创建程序化模型
     */
    _createProceduralModel(modelId) {
        const group = new THREE.Group();
        this.bones = {};
        this.restPose = {};
        this.hasSkeleton = true;

        // Define materials based on modelId
        let bodyMat, limbMat, jointMat, headMat, hatMat, bootMat;
        
        if (modelId === 'santa') {
            bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8 }); // Red suit
            limbMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8 }); // Red suit
            jointMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }); // White trim
            headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 }); // Skin
            hatMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8 }); // Red hat
            bootMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }); // Black boots
        } else if (modelId === 'goblin') {
            bodyMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9 }); // Brown clothes
            limbMat = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.6 }); // Green skin
            jointMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }); // Leather joints
            headMat = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.6 }); // Green skin
            hatMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 }); // Green hat
            bootMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 }); // Dark boots
        } else {
            // Default / Box Man / Stick Man
            bodyMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.5, metalness: 0.5 });
            limbMat = bodyMat;
            jointMat = new THREE.MeshStandardMaterial({ color: 0xff0088, roughness: 0.5 });
            headMat = bodyMat;
            hatMat = jointMat;
            bootMat = bodyMat;
        }

        // Helper to create bone
        const createBone = (name, parent, size, pos, rot = null, customMat = null) => {
            const boneGroup = new THREE.Group();
            boneGroup.name = name;
            if (pos) boneGroup.position.copy(pos);
            if (rot) boneGroup.rotation.setFromVector3(rot);
            
            if (parent) parent.add(boneGroup);
            else group.add(boneGroup);

            // Visual mesh
            if (size) {
                let geometry;
                if (modelId === 'box_man') {
                    geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                } else if (modelId === 'santa' && name === 'chest') {
                    // Santa's belly
                    geometry = new THREE.SphereGeometry(size.x * 0.8, 16, 16);
                    geometry.scale(1, 1.2, 0.8);
                } else if (modelId === 'santa' && name === 'spine') {
                    geometry = new THREE.CylinderGeometry(size.x * 0.6, size.x * 0.5, size.y, 16);
                } else {
                    geometry = new THREE.CylinderGeometry(size.x/2, size.x/2, size.y, 8);
                }
                
                // Adjust geometry center so pivot is at one end if needed
                // For limbs, we usually want pivot at top
                if (name.includes('Arm') || name.includes('Leg')) {
                    geometry.translate(0, -size.y / 2, 0);
                } else if (name === 'head') {
                    geometry.translate(0, size.y / 2, 0);
                } else if (name === 'spine' || name === 'chest') {
                    geometry.translate(0, size.y / 2, 0);
                }

                const mat = customMat || (name.includes('Arm') || name.includes('Leg') ? limbMat : bodyMat);
                // Special case for boots/hands
                const finalMat = (name.includes('Foot') || name.includes('Hand')) && (modelId === 'santa' || modelId === 'goblin') ? bootMat : mat;
                // Special case for head
                const headMaterial = (name === 'head') ? headMat : finalMat;

                const mesh = new THREE.Mesh(geometry, headMaterial);
                boneGroup.add(mesh);

                // Joint visual
                if (modelId !== 'box_man') {
                    const jointGeo = new THREE.SphereGeometry(size.x * 0.6);
                    const joint = new THREE.Mesh(jointGeo, jointMat);
                    boneGroup.add(joint);
                }

                // Add Hat for Santa/Goblin
                if (name === 'head' && (modelId === 'santa' || modelId === 'goblin')) {
                    const hatGeo = new THREE.ConeGeometry(size.x * 0.8, size.y * 0.8, 16);
                    hatGeo.translate(0, size.y + size.y * 0.4, -size.z * 0.2);
                    hatGeo.rotateX(-0.2);
                    const hat = new THREE.Mesh(hatGeo, hatMat);
                    boneGroup.add(hat);
                    
                    // Pom-pom for Santa
                    if (modelId === 'santa') {
                        const pomGeo = new THREE.SphereGeometry(size.x * 0.2);
                        pomGeo.translate(0, size.y * 1.8, -size.z * 0.2); // Approximate tip position
                        const pom = new THREE.Mesh(pomGeo, jointMat); // White
                        boneGroup.add(pom);
                    }
                }
            }

            this.bones[name] = boneGroup;
            this.restPose[name] = {
                position: boneGroup.position.clone(),
                quaternion: boneGroup.quaternion.clone()
            };

            return boneGroup;
        };

        // Build Hierarchy
        // Hips (Root)
        const hips = createBone('hips', null, {x: 0.3, y: 0.15, z: 0.2}, new THREE.Vector3(0, 1.0, 0));

        // Spine Chain
        const spine = createBone('spine', hips, {x: 0.25, y: 0.2, z: 0.15}, new THREE.Vector3(0, 0.1, 0));
        const chest = createBone('chest', spine, {x: 0.35, y: 0.25, z: 0.2}, new THREE.Vector3(0, 0.2, 0));
        const neck = createBone('neck', chest, {x: 0.1, y: 0.1, z: 0.1}, new THREE.Vector3(0, 0.25, 0));
        const head = createBone('head', neck, {x: 0.2, y: 0.25, z: 0.22}, new THREE.Vector3(0, 0.1, 0));

        // Arms
        const shoulderWidth = 0.2;
        const armLength = 0.35;
        const armThick = 0.08;

        // Left Arm
        const lShoulder = createBone('leftShoulder', chest, null, new THREE.Vector3(-shoulderWidth, 0.2, 0));
        
        const lArmGroup = createBone('leftUpperArm', lShoulder, {x: armThick, y: armLength, z: armThick}, new THREE.Vector3(0, 0, 0));
        lArmGroup.rotation.z = -Math.PI / 2; // Point Left (-X)
        this.restPose['leftUpperArm'].quaternion.copy(lArmGroup.quaternion);

        const lForeArm = createBone('leftForeArm', lArmGroup, {x: armThick*0.8, y: armLength, z: armThick*0.8}, new THREE.Vector3(0, -armLength, 0));
        
        // Right Arm
        const rShoulder = createBone('rightShoulder', chest, null, new THREE.Vector3(shoulderWidth, 0.2, 0));
        const rArmGroup = createBone('rightUpperArm', rShoulder, {x: armThick, y: armLength, z: armThick}, new THREE.Vector3(0, 0, 0));
        rArmGroup.rotation.z = Math.PI / 2; // Point Right (+X)
        this.restPose['rightUpperArm'].quaternion.copy(rArmGroup.quaternion);

        const rForeArm = createBone('rightForeArm', rArmGroup, {x: armThick*0.8, y: armLength, z: armThick*0.8}, new THREE.Vector3(0, -armLength, 0));

        // Hands
        createBone('leftHand', lForeArm, {x: 0.08, y: 0.1, z: 0.1}, new THREE.Vector3(0, -armLength, 0));
        createBone('rightHand', rForeArm, {x: 0.08, y: 0.1, z: 0.1}, new THREE.Vector3(0, -armLength, 0));

        // Legs
        const hipWidth = 0.1;
        const legLength = 0.45;
        const legThick = 0.12;

        const lUpLeg = createBone('leftUpLeg', hips, {x: legThick, y: legLength, z: legThick}, new THREE.Vector3(-hipWidth, 0, 0));
        // Legs point down (-Y). Geometry is vertical. No rotation needed.
        
        const lLeg = createBone('leftLeg', lUpLeg, {x: legThick*0.8, y: legLength, z: legThick*0.8}, new THREE.Vector3(0, -legLength, 0));
        createBone('leftFoot', lLeg, {x: 0.1, y: 0.05, z: 0.2}, new THREE.Vector3(0, -legLength, 0));
        // Foot geometry needs to point forward (Z).
        // Our generic box is centered.
        // Let's adjust foot geometry manually if needed or just accept box.

        const rUpLeg = createBone('rightUpLeg', hips, {x: legThick, y: legLength, z: legThick}, new THREE.Vector3(hipWidth, 0, 0));
        const rLeg = createBone('rightLeg', rUpLeg, {x: legThick*0.8, y: legLength, z: legThick*0.8}, new THREE.Vector3(0, -legLength, 0));
        createBone('rightFoot', rLeg, {x: 0.1, y: 0.05, z: 0.2}, new THREE.Vector3(0, -legLength, 0));

        // Scale to match target height
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        
        // Goblin is smaller
        let targetHeight = TARGET_MODEL_HEIGHT;
        if (modelId === 'goblin') targetHeight *= 0.7;
        
        const scale = targetHeight / size.y;
        group.scale.setScalar(scale);

        // Cache and Activate
        group.visible = false;
        this.group.add(group);
        this.modelCache[modelId] = group;
        this.skeletonCache[modelId] = {
            bones: { ...this.bones },
            hasSkeleton: true,
            restPose: { ...this.restPose }
        };

        this._activateModel(modelId);
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
     * 调整模型材质（降低特定模型的亮度）
     */
    adjustModelMaterials(model, modelId) {
        // 只针对 gingy_the_gingebread_man 文件夹下的模型（id 为 'gingy'）
        const isGingyModel = modelId === 'gingy';
        
        if (isGingyModel) {
            console.log(`Adjusting brightness for Gingy model: ${modelId}`);
            
            model.traverse((object) => {
                if (object.isMesh && object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    
                    materials.forEach(mat => {
                        // 降低自发光
                        if (mat.emissive) {
                            mat.emissive.setRGB(0, 0, 0);
                        }
                        mat.emissiveIntensity = 0;
                        
                        // 降低材质亮度 - 调暗颜色
                        if (mat.color) {
                            // 将颜色亮度降低到原来的60%
                            const hsl = {};
                            mat.color.getHSL(hsl);
                            mat.color.setHSL(hsl.h, hsl.s, Math.min(hsl.l * 0.6, 0.5));
                        }
                        
                        // 调整金属度和粗糙度使其更柔和
                        if (mat.metalness !== undefined) {
                            mat.metalness = Math.min(mat.metalness, 0.2);
                        }
                        if (mat.roughness !== undefined) {
                            mat.roughness = Math.max(mat.roughness, 0.6);
                        }
                        
                        // 确保材质更新
                        mat.needsUpdate = true;
                    });
                }
            });
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

        // 应用水平移动比例系数，放大X和Z方向的移动距离
        const scaledPosition = new THREE.Vector3(
            bodyCenter.x * HORIZONTAL_MOVEMENT_SCALE,
            bodyCenter.y,  // Y轴（垂直）保持不变
            bodyCenter.z * HORIZONTAL_MOVEMENT_SCALE
        );

        this.targetPosition.copy(scaledPosition);

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
        const indexIdx = isLeft ? LANDMARKS.LEFT_INDEX : LANDMARKS.RIGHT_INDEX;

        const shoulder = this.getPos(landmarks, shoulderIdx);
        const elbow = this.getPos(landmarks, elbowIdx);
        const wrist = this.getPos(landmarks, wristIdx);
        const indexFinger = this.getPos(landmarks, indexIdx);

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

        // 手掌方向
        if (indexFinger) {
            const handDir = new THREE.Vector3().subVectors(indexFinger, wrist).normalize();
            const handBone = this.bones[isLeft ? 'leftHand' : 'rightHand'];
            
            if (handBone) {
                const defaultDir = isLeft ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0);
                const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, handDir);
                this.applyBoneRotation(isLeft ? 'leftHand' : 'rightHand', quat);
            }
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
        const footIdx = isLeft ? LANDMARKS.LEFT_FOOT_INDEX : LANDMARKS.RIGHT_FOOT_INDEX;

        const hip = this.getPos(landmarks, hipIdx);
        const knee = this.getPos(landmarks, kneeIdx);
        const ankle = this.getPos(landmarks, ankleIdx);
        const foot = this.getPos(landmarks, footIdx);

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

        // 脚部方向
        if (foot) {
            const footDir = new THREE.Vector3().subVectors(foot, ankle).normalize();
            const footBone = this.bones[isLeft ? 'leftFoot' : 'rightFoot'];
            
            if (footBone) {
                // 假设脚部骨骼默认指向前方 (0, 0, 1)
                // 注意：这取决于模型的初始姿态，有些模型脚部可能指向 (0, -1, 0)
                // 这里假设标准 T-pose 脚部向前
                const defaultDir = new THREE.Vector3(0, 0, 1);
                const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, footDir);
                this.applyBoneRotation(isLeft ? 'leftFoot' : 'rightFoot', quat);
            }
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
