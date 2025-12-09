import * as THREE from 'three';

/**
 * GPU-Accelerated Snow Particle System
 * 使用自定义BufferGeometry和attributes实现高性能飘雪
 * 支持10,000+粒子，风吹效果，循环重置
 */
export class SnowEffect {
    constructor(scene, count = 10000) {
        this.scene = scene;
        this.count = count;
        this.particles = null;
        this.time = 0;

        // 风力参数
        this.windStrength = 0.5;
        this.windFrequency = 0.3;

        // 雪花下落区域
        this.volumeWidth = 25;
        this.volumeHeight = 15;
        this.volumeDepth = 25;

        this.init();
    }

    init() {
        const geometry = new THREE.BufferGeometry();

        // 创建attribute数组
        const positions = new Float32Array(this.count * 3);
        const velocities = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);
        const phases = new Float32Array(this.count); // 用于风吹的相位偏移
        const opacities = new Float32Array(this.count);

        // 初始化每个粒子
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // 随机位置 - 在整个体积内均匀分布
            positions[i3] = (Math.random() - 0.5) * this.volumeWidth;
            positions[i3 + 1] = Math.random() * this.volumeHeight - 2;
            positions[i3 + 2] = (Math.random() - 0.5) * this.volumeDepth;

            // 下落速度 - 每个粒子略有不同
            const fallSpeed = Math.random() * 0.03 + 0.02; // 0.02 - 0.05
            velocities[i3] = 0; // x方向初始为0（风控制）
            velocities[i3 + 1] = -fallSpeed; // y向下
            velocities[i3 + 2] = 0; // z方向初始为0

            // 大小 - 模拟远近景深
            sizes[i] = Math.random() * 0.12 + 0.04; // 0.04 - 0.16

            // 相位 - 每个粒子的摆动时间偏移
            phases[i] = Math.random() * Math.PI * 2;

            // 不透明度 - 大幅降低
            opacities[i] = Math.random() * 0.2 + 0.2; // 0.2 - 0.4
        }

        // 设置attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
        geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

        // 创建雪花纹理
        const snowTexture = this.createSnowflakeTexture();

        // 材质 - 使用自定义ShaderMaterial获得更好控制
        const material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: snowTexture },
                time: { value: 0 }
            },
            vertexShader: `
                attribute float size;
                attribute float opacity;
                varying float vOpacity;
                
                void main() {
                    vOpacity = opacity;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * 100.0 / -mvPosition.z; // 近大远小
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying float vOpacity;
                
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    
                    // 保留雪花形状的透明度，但应用整体不透明度
                    gl_FragColor = vec4(texColor.rgb, texColor.a * vOpacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    /**
     * 创建雪花纹理（程序化生成）
     */
    createSnowflakeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // 创建径向渐变（软边缘圆形）
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        // 添加一些六角星细节（可选）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(32, 32);
            ctx.lineTo(
                32 + Math.cos(angle) * 20,
                32 + Math.sin(angle) * 20
            );
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * 更新粒子系统
     */
    update() {
        if (!this.particles) return;

        this.time += 0.016; // ~60fps

        const positions = this.particles.geometry.attributes.position.array;
        const velocities = this.particles.geometry.attributes.velocity.array;
        const phases = this.particles.geometry.attributes.phase.array;

        // 风力效果（全局正弦波）
        const globalWind = Math.sin(this.time * this.windFrequency) * this.windStrength;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // 计算每个粒子的风力（基于全局风+个体相位）
            const windX = globalWind * Math.sin(this.time + phases[i]) * 0.02;
            const windZ = globalWind * Math.cos(this.time + phases[i] * 0.7) * 0.015;

            // 更新位置
            positions[i3] += velocities[i3] + windX;       // X（风）
            positions[i3 + 1] += velocities[i3 + 1];       // Y（下落）
            positions[i3 + 2] += velocities[i3 + 2] + windZ; // Z（风）

            // 边界检测和循环重置
            // Y轴：落到地面以下重置到顶部
            if (positions[i3 + 1] < -2) {
                positions[i3 + 1] = this.volumeHeight - 2;
                // 重置X和Z到随机位置（避免垂直线）
                positions[i3] = (Math.random() - 0.5) * this.volumeWidth;
                positions[i3 + 2] = (Math.random() - 0.5) * this.volumeDepth;
            }

            // X轴：超出边界循环回来
            if (positions[i3] > this.volumeWidth / 2) {
                positions[i3] = -this.volumeWidth / 2;
            } else if (positions[i3] < -this.volumeWidth / 2) {
                positions[i3] = this.volumeWidth / 2;
            }

            // Z轴：超出边界循环回来
            if (positions[i3 + 2] > this.volumeDepth / 2) {
                positions[i3 + 2] = -this.volumeDepth / 2;
            } else if (positions[i3 + 2] < -this.volumeDepth / 2) {
                positions[i3 + 2] = this.volumeDepth / 2;
            }
        }

        // 标记需要更新
        this.particles.geometry.attributes.position.needsUpdate = true;

        // 更新shader的时间uniform
        if (this.particles.material.uniforms.time) {
            this.particles.material.uniforms.time.value = this.time;
        }
    }

    /**
     * 设置风力强度（0-1）
     */
    setWindStrength(strength) {
        this.windStrength = Math.max(0, Math.min(1, strength));
    }

    /**
     * 设置雪花强度（密度和下落速度）
     * @param {number} intensity - 强度值 0-2 (1为正常)
     */
    setSnowIntensity(intensity) {
        if (!this.particles) return;

        const velocities = this.particles.geometry.attributes.velocity.array;
        const opacities = this.particles.geometry.attributes.opacity.array;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // 调整下落速度
            const baseFallSpeed = Math.random() * 0.03 + 0.02;
            velocities[i3 + 1] = -baseFallSpeed * intensity;

            // 调整不透明度
            const baseOpacity = Math.random() * 0.2 + 0.2;
            opacities[i] = Math.min(baseOpacity * intensity, 0.8);
        }

        this.particles.geometry.attributes.velocity.needsUpdate = true;
        this.particles.geometry.attributes.opacity.needsUpdate = true;

        console.log(`[SnowEffect] Intensity set to ${intensity.toFixed(2)}`);
    }

    /**
     * 根据陀螺仪摇晃设置雪花效果
     * @param {number} shakeAmount - 摇晃强度 0-1.5
     */
    setGyroShake(shakeAmount) {
        if (!this.particles) return;

        // 摇晃增强风力和雪花密度
        const enhancedWind = 0.5 + shakeAmount * 0.8;
        const enhancedIntensity = 1.0 + shakeAmount * 0.5;

        this.setWindStrength(enhancedWind);
        this.setSnowIntensity(enhancedIntensity);
    }

    /**
     * 触发吹气效果（麦克风输入）
     * @param {number} strength - 吹气强度 0-1
     * @param {object} direction - 可选的吹气方向 {x, y, z}
     */
    triggerBlowEffect(strength, direction = null) {
        if (!this.particles) return;

        const positions = this.particles.geometry.attributes.position.array;
        const velocities = this.particles.geometry.attributes.velocity.array;

        // 默认吹气方向（向外扩散）
        const blowDir = direction || { x: 0, y: 0, z: 1 };
        const blowForce = strength * 0.3;

        // 为每个粒子添加临时的吹气速度
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // 计算粒子到中心的方向
            const dx = positions[i3];
            const dy = positions[i3 + 1];
            const dz = positions[i3 + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > 0) {
                // 向外吹散
                const normalizedX = dx / dist;
                const normalizedZ = dz / dist;

                velocities[i3] += normalizedX * blowForce * (Math.random() * 0.5 + 0.5);
                velocities[i3 + 2] += normalizedZ * blowForce * (Math.random() * 0.5 + 0.5);

                // 轻微向上
                velocities[i3 + 1] += blowForce * 0.2 * Math.random();
            }
        }

        this.particles.geometry.attributes.velocity.needsUpdate = true;

        // 效果持续一段时间后逐渐衰减
        setTimeout(() => {
            this.resetVelocities();
        }, 1000);

        console.log(`[SnowEffect] Blow effect triggered with strength ${strength.toFixed(2)}`);
    }

    /**
     * 重置粒子速度到正常状态
     */
    resetVelocities() {
        if (!this.particles) return;

        const velocities = this.particles.geometry.attributes.velocity.array;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            const fallSpeed = Math.random() * 0.03 + 0.02;
            velocities[i3] = 0;
            velocities[i3 + 1] = -fallSpeed;
            velocities[i3 + 2] = 0;
        }

        this.particles.geometry.attributes.velocity.needsUpdate = true;
    }

    /**
     * 清理资源
     */
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            if (this.particles.material.uniforms.pointTexture.value) {
                this.particles.material.uniforms.pointTexture.value.dispose();
            }
            this.scene.remove(this.particles);
        }
    }
}

