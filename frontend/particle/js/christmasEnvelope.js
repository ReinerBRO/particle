import * as THREE from 'three';

/**
 * ChristmasEnvelope - 圣诞信封飞行动画效果
 * 从人物头顶飞到圣诞树旁边，自上而下自下而上盘旋飞行
 * 带有发光粒子轨迹效果
 */
export class ChristmasEnvelope {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        this.envelope = null;
        this.trailParticles = null;
        this.isFlying = false;
        this.flightProgress = 0;
        this.flightDuration = 3000; // 飞行到圣诞树的时间(ms)
        this.orbitTime = 0;
        this.phase = 'idle'; // 'idle', 'flying', 'orbiting'
        
        // 飞行路径参数
        this.startPosition = new THREE.Vector3(0, 1.5, 0);
        this.treePosition = new THREE.Vector3(0, 1.5, -3.5); // 圣诞树位置
        this.orbitRadius = 1.5; // 扩大盘旋半径
        this.orbitSpeed = 0.8; // 稍微减慢速度让盘旋更优雅
        this.verticalOscillation = 0.8; // 增大上下波动幅度
        
        // 粒子轨迹
        this.trailPositions = [];
        this.maxTrailLength = 80; // 增加轨迹长度
        
        this.createEnvelope();
        this.createTrailParticles();
    }
    
    createEnvelope() {
        // 创建信封几何体
        const envelopeGroup = new THREE.Group();
        
        // 信封主体 - 红色底
        const bodyGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.02);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xc41e3a, // 圣诞红
            emissive: 0x661020,
            emissiveIntensity: 0.3,
            metalness: 0.1,
            roughness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        envelopeGroup.add(body);
        
        // 信封封口三角形 - 金色
        const flapShape = new THREE.Shape();
        flapShape.moveTo(-0.075, 0);
        flapShape.lineTo(0.075, 0);
        flapShape.lineTo(0, -0.06);
        flapShape.closePath();
        
        const flapGeometry = new THREE.ShapeGeometry(flapShape);
        const flapMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700, // 金色
            emissive: 0xaa8800,
            emissiveIntensity: 0.4,
            metalness: 0.3,
            roughness: 0.5,
            side: THREE.DoubleSide
        });
        const flap = new THREE.Mesh(flapGeometry, flapMaterial);
        flap.position.set(0, 0.05, 0.011);
        flap.rotation.x = Math.PI * 0.1;
        envelopeGroup.add(flap);
        
        // 装饰 - 小星星/雪花
        const starGeometry = new THREE.OctahedronGeometry(0.015, 0);
        const starMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffaa,
            emissiveIntensity: 0.8
        });
        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.set(0, 0, 0.015);
        envelopeGroup.add(star);
        
        // 添加点光源让信封发光
        const light = new THREE.PointLight(0xffd700, 0.5, 0.5);
        light.position.set(0, 0, 0.05);
        envelopeGroup.add(light);
        
        this.envelope = envelopeGroup;
        this.envelope.visible = false;
        this.group.add(this.envelope);
    }
    
    createTrailParticles() {
        // 创建粒子轨迹系统
        const particleCount = this.maxTrailLength * 3; // 每个位置多个粒子
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const alphas = new Float32Array(particleCount);
        
        // 圣诞配色
        const trailColors = [
            new THREE.Color(0xffd700), // 金色
            new THREE.Color(0xffaa00), // 橙金
            new THREE.Color(0xffffff), // 白色
            new THREE.Color(0xffee88), // 浅金
        ];
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -100; // 隐藏在画面外
            positions[i * 3 + 2] = 0;
            
            const color = trailColors[Math.floor(Math.random() * trailColors.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            sizes[i] = 0.02 + Math.random() * 0.03;
            alphas[i] = 0;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        
        // 使用自定义着色器材质实现透明度渐变
        const material = new THREE.PointsMaterial({
            size: 0.04,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.trailParticles = new THREE.Points(geometry, material);
        this.trailParticles.visible = false;
        this.group.add(this.trailParticles);
    }
    
    /**
     * 开始飞行动画
     * @param {THREE.Vector3} startPos - 起始位置（人物头顶）
     * @param {THREE.Vector3} treePos - 圣诞树位置
     */
    startFlight(startPos, treePos = null) {
        if (this.isFlying) return;
        
        this.startPosition.copy(startPos);
        this.startPosition.y += 0.3; // 头顶上方一点
        
        if (treePos) {
            this.treePosition.copy(treePos);
        }
        
        this.isFlying = true;
        this.phase = 'flying';
        this.flightProgress = 0;
        this.orbitTime = 0;
        this.trailPositions = [];
        
        this.envelope.visible = true;
        this.envelope.position.copy(this.startPosition);
        this.trailParticles.visible = true;
        
        console.log('[Envelope] Started flight from', this.startPosition, 'to', this.treePosition);
    }
    
    /**
     * 停止飞行动画
     */
    stopFlight() {
        this.isFlying = false;
        this.phase = 'idle';
        this.envelope.visible = false;
        this.trailParticles.visible = false;
        this.trailPositions = [];
    }
    
    /**
     * 更新动画
     * @param {number} deltaTime - 时间增量(ms)
     */
    update(deltaTime = 16) {
        if (!this.isFlying) return;
        
        if (this.phase === 'flying') {
            this.updateFlying(deltaTime);
        } else if (this.phase === 'orbiting') {
            this.updateOrbiting(deltaTime);
        }
        
        this.updateTrail();
        this.updateEnvelopeRotation();
    }
    
    updateFlying(deltaTime) {
        this.flightProgress += deltaTime / this.flightDuration;
        
        if (this.flightProgress >= 1) {
            this.flightProgress = 1;
            this.phase = 'orbiting';
            console.log('[Envelope] Reached tree, starting orbit');
        }
        
        // 使用贝塞尔曲线进行平滑飞行
        const t = this.easeInOutCubic(this.flightProgress);
        
        // 控制点 - 创建弧形路径
        const controlPoint = new THREE.Vector3(
            (this.startPosition.x + this.treePosition.x) / 2,
            Math.max(this.startPosition.y, this.treePosition.y) + 0.8, // 向上拱起
            (this.startPosition.z + this.treePosition.z) / 2 + 0.5
        );
        
        // 二次贝塞尔曲线
        const pos = this.quadraticBezier(
            this.startPosition,
            controlPoint,
            this.treePosition,
            t
        );
        
        this.envelope.position.copy(pos);
        
        // 添加轨迹点
        this.addTrailPoint(pos.clone());
    }
    
    updateOrbiting(deltaTime) {
        this.orbitTime += deltaTime * 0.001 * this.orbitSpeed;
        
        // 盘旋运动 - 围绕圣诞树
        const angle = this.orbitTime * Math.PI * 2;
        const verticalOffset = Math.sin(this.orbitTime * 2) * this.verticalOscillation;
        
        const x = this.treePosition.x + Math.cos(angle) * this.orbitRadius;
        const y = this.treePosition.y + verticalOffset + 0.5;
        const z = this.treePosition.z + Math.sin(angle) * this.orbitRadius;
        
        this.envelope.position.set(x, y, z);
        
        // 添加轨迹点
        this.addTrailPoint(new THREE.Vector3(x, y, z));
        
        // 10秒后停止盘旋
        if (this.orbitTime > 10) {
            this.fadeOut();
        }
    }
    
    fadeOut() {
        // 渐隐效果
        const fadeOutDuration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / fadeOutDuration, 1);
            
            // 缩小并透明
            const scale = 1 - progress;
            this.envelope.scale.setScalar(scale);
            
            if (this.trailParticles.material) {
                this.trailParticles.material.opacity = 0.8 * (1 - progress);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.stopFlight();
                this.envelope.scale.setScalar(1);
                if (this.trailParticles.material) {
                    this.trailParticles.material.opacity = 0.8;
                }
            }
        };
        
        animate();
    }
    
    addTrailPoint(position) {
        // 添加一些随机偏移的粒子
        for (let i = 0; i < 3; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05
            );
            this.trailPositions.push({
                pos: position.clone().add(offset),
                life: 1.0,
                decay: 0.015 + Math.random() * 0.01
            });
        }
        
        // 限制轨迹长度
        while (this.trailPositions.length > this.maxTrailLength * 3) {
            this.trailPositions.shift();
        }
    }
    
    updateTrail() {
        if (!this.trailParticles) return;
        
        const positions = this.trailParticles.geometry.attributes.position.array;
        const sizes = this.trailParticles.geometry.attributes.size.array;
        
        // 更新现有轨迹点
        for (let i = this.trailPositions.length - 1; i >= 0; i--) {
            const trail = this.trailPositions[i];
            trail.life -= trail.decay;
            
            if (trail.life <= 0) {
                this.trailPositions.splice(i, 1);
            }
        }
        
        // 更新粒子位置
        const particleCount = positions.length / 3;
        for (let i = 0; i < particleCount; i++) {
            if (i < this.trailPositions.length) {
                const trail = this.trailPositions[i];
                positions[i * 3] = trail.pos.x;
                positions[i * 3 + 1] = trail.pos.y;
                positions[i * 3 + 2] = trail.pos.z;
                
                // 根据生命值调整大小
                const baseSize = 0.02 + Math.random() * 0.02;
                sizes[i] = baseSize * trail.life;
            } else {
                // 隐藏未使用的粒子
                positions[i * 3 + 1] = -100;
                sizes[i] = 0;
            }
        }
        
        this.trailParticles.geometry.attributes.position.needsUpdate = true;
        this.trailParticles.geometry.attributes.size.needsUpdate = true;
    }
    
    updateEnvelopeRotation() {
        if (!this.envelope) return;
        
        // 信封朝向飞行方向
        const time = Date.now() * 0.001;
        
        // 轻微摇摆
        this.envelope.rotation.x = Math.sin(time * 3) * 0.1;
        this.envelope.rotation.y = Math.sin(time * 2) * 0.2 + (this.phase === 'orbiting' ? this.orbitTime * Math.PI * 2 : 0);
        this.envelope.rotation.z = Math.cos(time * 2.5) * 0.15;
    }
    
    // 缓动函数
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    // 二次贝塞尔曲线
    quadraticBezier(p0, p1, p2, t) {
        const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
        const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
        const z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z;
        return new THREE.Vector3(x, y, z);
    }
    
    dispose() {
        if (this.envelope) {
            this.envelope.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        if (this.trailParticles) {
            this.trailParticles.geometry.dispose();
            this.trailParticles.material.dispose();
        }
        this.scene.remove(this.group);
    }
}
