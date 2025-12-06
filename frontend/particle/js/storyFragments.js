import * as THREE from 'three';

/**
 * 创建四芒星几何体
 */
function createFourPointStarGeometry(innerRadius = 0.06, outerRadius = 0.18) {
    const shape = new THREE.Shape();
    const points = 4;
    
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }
    shape.closePath();
    
    return new THREE.ShapeGeometry(shape);
}

/**
 * 故事碎片 - 围绕圣诞树飞旋的四芒星记忆
 */
export class StoryFragments {
    constructor(scene, treePosition = new THREE.Vector3(0, 0, -4)) {
        this.scene = scene;
        this.treePosition = treePosition;
        this.storyStars = []; // 故事四芒星（有颜色）
        this.decorStars = []; // 装饰四芒星（白色）
        this.stories = [];
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        // 轨道参数
        this.orbitRadius = 1.0; // 靠近圣诞树
        this.orbitHeight = 1.5;
        this.orbitSpeed = 0.15; // 缓慢移动
        
        // 当前选中索引
        this.currentIndex = 0;
        this.targetIndex = 0;
        this.slideProgress = 0;
        this.isSliding = false;
        this.slideDirection = 0; // -1左 1右
        
        // 展开状态
        this.isExpanded = false;
        this.expandedStory = null;
        
        // 故事颜色配色（排除白色）
        
        this.storyColors = [
    new THREE.Color(0xffd700),   // 耀眼金 - 传统圣诞奢华
    new THREE.Color(0xe63946),   // 深红宝石 - 圣诞经典
    new THREE.Color(0x1d3557),   // 午夜蓝 - 星空深邃
    new THREE.Color(0xa8dadc),   // 冰晶蓝 - 冬日清新
    new THREE.Color(0xff9e6d),   // 暖阳橙 - 火炉温暖
    new THREE.Color(0x9d4edd),   // 皇家紫 - 神秘魔力
    new THREE.Color(0x06d6a0),   // 青翡翠 - 新生希望
    
    // 新增绚丽配色
    new THREE.Color(0xd43f8d),   // 玫瑰金粉 - 优雅浪漫
    new THREE.Color(0xc70039),   // 圣诞浆果红 - 传统喜庆
    new THREE.Color(0x4cc9f0),   // 极光蓝 - 冰雪奇幻
    new THREE.Color(0xf9c74f),   // 香槟金 - 奢华闪亮
    new THREE.Color(0x7209b7),   // 深紫罗兰 - 神秘深邃
    new THREE.Color(0x3a0ca3),   // 宝石紫 - 高贵典雅
    new THREE.Color(0x4895ef),   // 冰湖蓝 - 清澈宁静
    new THREE.Color(0xf72585),   // 樱花粉 - 温暖甜美
    new THREE.Color(0x00f5d4),   // 水蓝绿 - 清新活力
    new THREE.Color(0x9e0059),   // 梅子红 - 深邃情感
    new THREE.Color(0xffba08),   // 太阳黄 - 温暖希望
    new THREE.Color(0x02c39a),   // 松石绿 - 和平生机
    new THREE.Color(0x3f37c9),   // 深空蓝 - 宇宙奥秘
    new THREE.Color(0xe63996),   // 暮光粉 - 梦幻温柔
    new THREE.Color(0x00bbf9),   // 天空蓝 - 自由开阔
    new THREE.Color(0xf15bb5),   // 梦幻粉 - 童话气息
    new THREE.Color(0x00f5a8),   // 荧光绿 - 活力生机
    new THREE.Color(0xae2012),   // 深酒红 - 沉稳经典
];
        
        // 创建装饰星群
        this.createDecorativeStars();
        
        // 加载故事
        this.loadStories();
    }
    
    /**
     * 创建装饰性白色四芒星群
     */
    createDecorativeStars() {
        const starCount = 25;
        
        for (let i = 0; i < starCount; i++) {
            const star = this.createStar(0xffffff, 0.025 + Math.random() * 0.015, true);
            
            star.userData = {
                angleOffset: Math.random() * Math.PI * 2,
                heightOffset: (Math.random() - 0.5) * 2.5,
                radiusOffset: 0.8 + Math.random() * 1.0, // 靠近圣诞树
                speed: 0.08 + Math.random() * 0.1, // 统一正向旋转
                bobSpeed: 0.5 + Math.random() * 0.5,
                bobAmount: 0.1 + Math.random() * 0.15,
                twinkleSpeed: 1 + Math.random() * 2,
                twinklePhase: Math.random() * Math.PI * 2,
                rotationSpeed: 0.5 + Math.random() * 1,
            };
            
            this.group.add(star.mesh);
            this.group.add(star.trail);
            this.decorStars.push(star);
        }
    }
    
    /**
     * 创建单个四芒星（带尾流）
     */
    createStar(color, size = 0.05, isDecor = false) {
        // 四芒星网格 - 增大尺寸
        const geometry = createFourPointStarGeometry(size * 0.4, size * 1.2);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // 添加发光层
        const glowGeometry = createFourPointStarGeometry(size * 0.6, size * 1.6);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = -0.001;
        mesh.add(glow);
        
        // 创建粒子尾流（由粗到细）
        const trailCount = isDecor ? 20 : 50; // 增加粒子数量
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(trailCount * 3);
        const trailSizes = new Float32Array(trailCount);
        
        for (let i = 0; i < trailCount; i++) {
            // 尾流大小渐变
            trailSizes[i] = size * (1 - i / trailCount) * 1.5;
        }
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeometry.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
        
        const trailMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                opacity: { value: 0.6 }
            },
            vertexShader: `
                attribute float size;
                varying float vSize;
                void main() {
                    vSize = size;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // 增大粒子显示大小
                    gl_PointSize = size * 400.0 / -mvPosition.z;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                varying float vSize;
                void main() {
                    float r = distance(gl_PointCoord, vec2(0.5));
                    if (r > 0.5) discard;
                    float glow = 1.0 - r * 2.0;
                    // 增强尾流亮度
                    float alpha = glow * opacity * 1.5; 
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const trail = new THREE.Points(trailGeometry, trailMaterial);
        
        return {
            mesh,
            trail,
            trailPositions: [],
            trailCount,
            color: new THREE.Color(color),
            size
        };
    }
    
    /**
     * 从后端加载故事
     */
    async loadStories() {
        try {
            const response = await fetch('http://localhost:3000/api/stories');
            if (response.ok) {
                this.stories = await response.json();
                console.log(`[StoryFragments] Loaded ${this.stories.length} stories`);
                this.createStoryStars();
            }
        } catch (error) {
            console.error('[StoryFragments] Failed to load stories:', error);
            this.stories = [];
        }
    }
    
    /**
     * 添加新故事
     */
    async addStory(userText, poemText, imageUrl = "") {
        try {
            const response = await fetch('http://localhost:3000/api/stories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userText, poemText, imageUrl })
            });
            
            if (response.ok) {
                const newStory = await response.json();
                this.stories.push(newStory);
                this.createStoryStarForStory(newStory, this.stories.length - 1);
                console.log(`[StoryFragments] Added story #${newStory.id}`);
                return newStory;
            }
        } catch (error) {
            console.error('[StoryFragments] Failed to add story:', error);
        }
        return null;
    }
    
    /**
     * 创建所有故事星
     */
    createStoryStars() {
        this.storyStars.forEach(star => {
            this.group.remove(star.mesh);
            this.group.remove(star.trail);
        });
        this.storyStars = [];
        
        this.stories.forEach((story, index) => {
            this.createStoryStarForStory(story, index);
        });
    }
    
    /**
     * 为故事创建四芒星
     */
    createStoryStarForStory(story, index) {
        const color = this.storyColors[index % this.storyColors.length];
        const star = this.createStar(color.getHex(), 0.05, false);
        
        star.userData = {
            story: story,
            index: index,
            angleOffset: (index / Math.max(this.stories.length, 1)) * Math.PI * 2,
            heightOffset: Math.sin(index * 1.5) * 0.4,
            speed: 0.1 + (index % 3) * 0.015,
            bobSpeed: 0.6 + Math.random() * 0.3,
            bobAmount: 0.06 + Math.random() * 0.04,
            twinkleSpeed: 1.2 + Math.random() * 0.8,
            twinklePhase: Math.random() * Math.PI * 2,
            rotationSpeed: 0.3 + Math.random() * 0.3,
        };
        
        this.group.add(star.mesh);
        this.group.add(star.trail);
        this.storyStars.push(star);
    }
    
    /**
     * 更新动画
     */
    update(deltaTime) {
        const time = Date.now() * 0.001;
        
        // 更新装饰星
        this.decorStars.forEach(star => {
            this.updateStarOrbit(star, time, true, false);
        });
        
        // 更新故事星
        this.storyStars.forEach((star, i) => {
            // 如果正在滑动，高亮目标索引；否则高亮当前索引
            const highlightIndex = this.isSliding ? this.targetIndex : this.currentIndex;
            const isHighlighted = i === highlightIndex && !this.isExpanded;
            this.updateStarOrbit(star, time, false, isHighlighted);
        });
        
        // 更新滑动动画
        if (this.isSliding) {
            this.slideProgress += deltaTime * 0.004;
            if (this.slideProgress >= 1) {
                this.slideProgress = 0;
                this.isSliding = false;
                this.currentIndex = this.targetIndex;
            }
        }
    }
    
    /**
     * 更新单个星的轨道运动
     */
    updateStarOrbit(star, time, isDecor, isHighlighted = false) {
        const data = star.userData;
        const angle = time * data.speed + data.angleOffset;
        const radius = isDecor ? data.radiusOffset : this.orbitRadius;
        const bobOffset = Math.sin(time * data.bobSpeed + data.angleOffset) * data.bobAmount;
        
        // 计算位置
        const x = this.treePosition.x + Math.cos(angle) * radius;
        const y = this.orbitHeight + data.heightOffset + bobOffset;
        const z = this.treePosition.z + Math.sin(angle) * radius;
        
        star.mesh.position.set(x, y, z);
        
        // 旋转四芒星
        star.mesh.rotation.z = time * data.rotationSpeed;
        
        // 面向外侧
        star.mesh.lookAt(this.treePosition.x, y, this.treePosition.z);
        
        // 闪烁效果
        const twinkle = 0.5 + Math.sin(time * data.twinkleSpeed + data.twinklePhase) * 0.5;
        star.mesh.material.opacity = twinkle * (isHighlighted ? 1.0 : 0.6);
        
        // 高亮效果
        if (isHighlighted) {
            const pulse = 1.8 + Math.sin(time * 3) * 0.3;
            star.mesh.scale.setScalar(pulse);
        } else {
            star.mesh.scale.setScalar(1.0);
        }
        
        // 更新尾流
        this.updateTrail(star);
    }
    
    /**
     * 更新粒子尾流
     */
    updateTrail(star) {
        const positions = star.trail.geometry.attributes.position.array;
        const maxHistory = star.trailCount;
        
        star.trailPositions.unshift(star.mesh.position.clone());
        if (star.trailPositions.length > maxHistory) {
            star.trailPositions.pop();
        }
        
        for (let i = 0; i < maxHistory; i++) {
            const historyIndex = Math.min(i, star.trailPositions.length - 1);
            const pos = star.trailPositions[historyIndex] || star.mesh.position;
            
            const spread = i * 0.003;
            positions[i * 3] = pos.x + (Math.random() - 0.5) * spread;
            positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * spread;
            positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * spread;
        }
        
        star.trail.geometry.attributes.position.needsUpdate = true;
    }
    
    /**
     * 向左滑动切换
     */
    slideLeft() {
        if (this.stories.length === 0) return false;
        
        // 如果已经在滑动中，立即完成上一次滑动，以当前目标作为新的起点
        if (this.isSliding) {
            this.currentIndex = this.targetIndex;
        }
        
        // 允许连续切换，重置进度
        this.isSliding = true;
        this.slideProgress = 0;
        this.slideDirection = -1;
        this.targetIndex = (this.currentIndex - 1 + this.stories.length) % this.stories.length;
        console.log(`[StoryFragments] Sliding left to index ${this.targetIndex}`);
        return true;
    }
    
    /**
     * 向右滑动切换
     */
    slideRight() {
        if (this.stories.length === 0) return false;
        
        // 如果已经在滑动中，立即完成上一次滑动，以当前目标作为新的起点
        if (this.isSliding) {
            this.currentIndex = this.targetIndex;
        }
        
        // 允许连续切换，重置进度
        this.isSliding = true;
        this.slideProgress = 0;
        this.slideDirection = 1;
        this.targetIndex = (this.currentIndex + 1) % this.stories.length;
        console.log(`[StoryFragments] Sliding right to index ${this.targetIndex}`);
        return true;
    }
    
    /**
     * 展开当前故事
     */
    expandCurrentStory() {
        if (this.stories.length === 0) return null;
        
        this.isExpanded = true;
        this.expandedStory = this.stories[this.currentIndex];
        return this.expandedStory;
    }
    
    /**
     * 收起故事
     */
    collapseStory() {
        this.isExpanded = false;
        this.expandedStory = null;
    }
    
    /**
     * 获取当前故事
     */
    getCurrentStory() {
        if (this.stories.length === 0) return null;
        // 如果正在滑动，返回目标故事以立即更新UI
        if (this.isSliding) {
            return this.stories[this.targetIndex];
        }
        return this.stories[this.currentIndex];
    }
    
    getStoryCount() {
        return this.stories.length;
    }
    
    isStoryExpanded() {
        return this.isExpanded;
    }
    
    isSlidingNow() {
        return this.isSliding;
    }
    
    getCurrentIndex() {
        return this.currentIndex;
    }
    
    getSlideProgress() {
        return this.slideProgress;
    }
    
    getSlideDirection() {
        return this.slideDirection;
    }
}
