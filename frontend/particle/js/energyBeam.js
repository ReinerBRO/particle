import * as THREE from 'three';

/**
 * EnergyBeam - 气功波/能量波束粒子效果
 * 当用户做出气功波动作时显示动态能量波束
 */
export class EnergyBeam {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        this.isActive = false;
        this.intensity = 0; // 0-1，用于渐入渐出
        this.fadeSpeed = 0.08; // 消散速度
        this.growSpeed = 0.12; // 增长速度
        
        // 波束参数
        this.beamLength = 2.5;
        this.beamWidth = 0.3;
        this.particleCount = 500;
        
        // 波束起点和方向
        this.origin = new THREE.Vector3(0, 0, 0);
        this.direction = new THREE.Vector3(0, 0, 1);
        
        this.createBeamParticles();
        this.createCoreBeam();
    }
    
    createBeamParticles() {
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        const velocities = new Float32Array(this.particleCount * 3);
        const lifetimes = new Float32Array(this.particleCount);
        
        // 能量波配色 - 蓝白色系
        const beamColors = [
            new THREE.Color(0x00aaff), // 亮蓝
            new THREE.Color(0x44ddff), // 天蓝
            new THREE.Color(0xaaeeff), // 浅蓝
            new THREE.Color(0xffffff), // 白色核心
            new THREE.Color(0x88ffff), // 青色
        ];
        
        for (let i = 0; i < this.particleCount; i++) {
            // 初始位置（会在update中更新）
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -100; // 隐藏
            positions[i * 3 + 2] = 0;
            
            // 随机颜色
            const color = beamColors[Math.floor(Math.random() * beamColors.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            sizes[i] = 0.02 + Math.random() * 0.04;
            
            // 随机速度（沿波束方向）
            velocities[i * 3] = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 2] = 2 + Math.random() * 3; // 主要向前
            
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.particles.visible = false;
        this.group.add(this.particles);
    }
    
    createCoreBeam() {
        // 核心光束 - 使用圆柱体
        const geometry = new THREE.CylinderGeometry(0.05, 0.15, this.beamLength, 16, 1, true);
        geometry.rotateX(Math.PI / 2); // 让圆柱指向Z轴
        
        const material = new THREE.MeshBasicMaterial({
            color: 0x44ddff,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        
        this.coreBeam = new THREE.Mesh(geometry, material);
        this.coreBeam.visible = false;
        this.group.add(this.coreBeam);
        
        // 外层光晕
        const glowGeometry = new THREE.CylinderGeometry(0.1, 0.25, this.beamLength, 16, 1, true);
        glowGeometry.rotateX(Math.PI / 2);
        
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        
        this.glowBeam = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glowBeam.visible = false;
        this.group.add(this.glowBeam);
    }
    
    /**
     * 激活能量波束
     * @param {THREE.Vector3} origin - 波束起点（双手位置）
     * @param {THREE.Vector3} direction - 波束方向
     */
    activate(origin, direction) {
        this.isActive = true;
        this.origin.copy(origin);
        this.direction.copy(direction).normalize();
        
        this.particles.visible = true;
        this.coreBeam.visible = true;
        this.glowBeam.visible = true;
    }
    
    /**
     * 停用能量波束（开始消散）
     */
    deactivate() {
        this.isActive = false;
    }
    
    /**
     * 更新波束位置和方向
     */
    updateBeamTransform(origin, direction) {
        this.origin.copy(origin);
        this.direction.copy(direction).normalize();
    }
    
    /**
     * 更新动画
     */
    update(deltaTime = 16) {
        // 更新强度（渐入渐出）
        if (this.isActive) {
            this.intensity = Math.min(1, this.intensity + this.growSpeed);
        } else {
            this.intensity = Math.max(0, this.intensity - this.fadeSpeed);
        }
        
        // 完全消散后隐藏
        if (this.intensity <= 0 && !this.isActive) {
            this.particles.visible = false;
            this.coreBeam.visible = false;
            this.glowBeam.visible = false;
            return;
        }
        
        this.updateParticles(deltaTime);
        this.updateCoreBeam();
    }
    
    updateParticles(deltaTime) {
        if (!this.particles.visible) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        const velocities = this.particles.geometry.attributes.velocity.array;
        const lifetimes = this.particles.geometry.attributes.lifetime.array;
        const sizes = this.particles.geometry.attributes.size.array;
        
        const time = Date.now() * 0.001;
        const dt = deltaTime / 1000;
        
        // 计算波束的旋转矩阵
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.direction);
        
        for (let i = 0; i < this.particleCount; i++) {
            // 更新生命周期
            lifetimes[i] += dt * (1.5 + Math.random() * 0.5);
            
            if (lifetimes[i] > 1) {
                // 重置粒子
                lifetimes[i] = 0;
                
                // 在波束起点附近生成
                const spreadX = (Math.random() - 0.5) * this.beamWidth * 0.5;
                const spreadY = (Math.random() - 0.5) * this.beamWidth * 0.5;
                
                // 本地坐标
                const localPos = new THREE.Vector3(spreadX, spreadY, 0);
                localPos.applyQuaternion(quaternion);
                
                positions[i * 3] = this.origin.x + localPos.x;
                positions[i * 3 + 1] = this.origin.y + localPos.y;
                positions[i * 3 + 2] = this.origin.z + localPos.z;
            } else {
                // 沿波束方向移动
                const speed = velocities[i * 3 + 2] * dt * this.intensity;
                
                // 添加螺旋运动
                const spiralAngle = lifetimes[i] * Math.PI * 4 + i;
                const spiralRadius = 0.1 * (1 - lifetimes[i]) * this.intensity;
                
                const localVel = new THREE.Vector3(
                    Math.cos(spiralAngle) * spiralRadius * dt * 10,
                    Math.sin(spiralAngle) * spiralRadius * dt * 10,
                    speed
                );
                localVel.applyQuaternion(quaternion);
                
                positions[i * 3] += localVel.x;
                positions[i * 3 + 1] += localVel.y;
                positions[i * 3 + 2] += localVel.z;
            }
            
            // 根据生命周期和强度调整大小
            const baseSize = 0.02 + Math.random() * 0.03;
            sizes[i] = baseSize * (1 - lifetimes[i] * 0.5) * this.intensity;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.lifetime.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;
        
        // 更新材质透明度
        this.particles.material.opacity = 0.9 * this.intensity;
    }
    
    updateCoreBeam() {
        if (!this.coreBeam.visible) return;
        
        // 更新位置
        const beamCenter = this.origin.clone().add(
            this.direction.clone().multiplyScalar(this.beamLength / 2)
        );
        
        this.coreBeam.position.copy(beamCenter);
        this.glowBeam.position.copy(beamCenter);
        
        // 更新朝向
        const lookAt = this.origin.clone().add(this.direction);
        this.coreBeam.lookAt(lookAt);
        this.glowBeam.lookAt(lookAt);
        
        // 更新缩放（基于强度）
        const scale = this.intensity;
        this.coreBeam.scale.set(scale, scale, 1);
        this.glowBeam.scale.set(scale * 1.2, scale * 1.2, 1);
        
        // 更新透明度
        this.coreBeam.material.opacity = 0.5 * this.intensity;
        this.glowBeam.material.opacity = 0.25 * this.intensity;
        
        // 脉动效果
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
        this.coreBeam.scale.x *= pulse;
        this.coreBeam.scale.y *= pulse;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        if (this.coreBeam) {
            this.coreBeam.geometry.dispose();
            this.coreBeam.material.dispose();
        }
        if (this.glowBeam) {
            this.glowBeam.geometry.dispose();
            this.glowBeam.material.dispose();
        }
        this.scene.remove(this.group);
    }
}


/**
 * JumpEffect - 跳跃视觉效果
 * 当检测到用户跳起时显示粒子爆发效果
 */
export class JumpEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        this.isActive = false;
        this.particleCount = 200;
        this.particles = null;
        
        this.createParticles();
    }
    
    createParticles() {
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        const velocities = new Float32Array(this.particleCount * 3);
        const lifetimes = new Float32Array(this.particleCount);
        
        // 跳跃效果配色 - 金色/白色星光
        const jumpColors = [
            new THREE.Color(0xffd700), // 金色
            new THREE.Color(0xffee88), // 浅金
            new THREE.Color(0xffffff), // 白色
            new THREE.Color(0xffaa00), // 橙金
        ];
        
        for (let i = 0; i < this.particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -100;
            positions[i * 3 + 2] = 0;
            
            const color = jumpColors[Math.floor(Math.random() * jumpColors.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            sizes[i] = 0.03 + Math.random() * 0.05;
            
            // 向四周扩散的速度
            const angle = Math.random() * Math.PI * 2;
            const upSpeed = 1 + Math.random() * 2;
            const outSpeed = 0.5 + Math.random() * 1.5;
            velocities[i * 3] = Math.cos(angle) * outSpeed;
            velocities[i * 3 + 1] = upSpeed;
            velocities[i * 3 + 2] = Math.sin(angle) * outSpeed;
            
            lifetimes[i] = 1; // 初始为已结束
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.particles.visible = false;
        this.group.add(this.particles);
    }
    
    /**
     * 触发跳跃效果
     * @param {THREE.Vector3} position - 跳跃位置（脚下）
     */
    trigger(position) {
        this.isActive = true;
        this.particles.visible = true;
        
        const positions = this.particles.geometry.attributes.position.array;
        const velocities = this.particles.geometry.attributes.velocity.array;
        const lifetimes = this.particles.geometry.attributes.lifetime.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            // 在脚下位置生成
            positions[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.3;
            
            // 重置生命周期
            lifetimes[i] = 0;
            
            // 重新随机化速度
            const angle = Math.random() * Math.PI * 2;
            const upSpeed = 1.5 + Math.random() * 2.5;
            const outSpeed = 0.8 + Math.random() * 1.2;
            velocities[i * 3] = Math.cos(angle) * outSpeed;
            velocities[i * 3 + 1] = upSpeed;
            velocities[i * 3 + 2] = Math.sin(angle) * outSpeed;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.velocity.needsUpdate = true;
        this.particles.geometry.attributes.lifetime.needsUpdate = true;
    }
    
    update(deltaTime = 16) {
        if (!this.isActive || !this.particles.visible) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        const velocities = this.particles.geometry.attributes.velocity.array;
        const lifetimes = this.particles.geometry.attributes.lifetime.array;
        const sizes = this.particles.geometry.attributes.size.array;
        
        const dt = deltaTime / 1000;
        const gravity = -3;
        
        let allDead = true;
        
        for (let i = 0; i < this.particleCount; i++) {
            lifetimes[i] += dt * 1.5;
            
            if (lifetimes[i] < 1) {
                allDead = false;
                
                // 应用重力
                velocities[i * 3 + 1] += gravity * dt;
                
                // 更新位置
                positions[i * 3] += velocities[i * 3] * dt;
                positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
                positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
                
                // 根据生命周期缩小
                sizes[i] = (0.03 + Math.random() * 0.04) * (1 - lifetimes[i]);
            } else {
                // 隐藏已结束的粒子
                positions[i * 3 + 1] = -100;
                sizes[i] = 0;
            }
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;
        
        // 所有粒子都结束后隐藏
        if (allDead) {
            this.isActive = false;
            this.particles.visible = false;
        }
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        this.scene.remove(this.group);
    }
}
