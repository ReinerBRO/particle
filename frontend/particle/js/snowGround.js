import * as THREE from 'three';

/**
 * SnowGround - 静态雪地系统（移除了脚印功能）
 * 使用简单材质的雪地平面
 */
export class SnowGround {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();

        // 雪地中心（圣诞树位置）
        this.centerX = 0;
        this.centerZ = -4;
        this.radius = 18; // 3x radius (was 6)

        this.init();
    }

    init() {
        // === 1. 高细分雪地平面 ===
        const segments = 256; // Increased segments for larger area
        const groundGeometry = new THREE.PlaneGeometry(72, 72, segments, segments); // 3x size (was 12x12)

        // 添加更强的噪声起伏
        const positions = groundGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            // 使用多层噪声创建更真实的雪地起伏（调整频率以适应更大尺寸）
            const noise1 = Math.sin(x * 0.6) * Math.cos(y * 0.6) * 0.2; // Lower freq, higher amp
            const noise2 = Math.sin(x * 1.5 + 1.5) * Math.cos(y * 1.5 + 1.5) * 0.1;
            const noise3 = (Math.random() - 0.5) * 0.03;
            positions[i + 2] += noise1 + noise2 + noise3;
        }
        groundGeometry.attributes.position.needsUpdate = true;
        groundGeometry.computeVertexNormals();

        // === 2. 自定义Shader（无displacement，只有光照）===
        const groundMaterial = new THREE.ShaderMaterial({
            uniforms: {
                // 雪地颜色（暖白色，低亮度）
                snowColor: { value: new THREE.Color(0x9098a8) },
                shadowColor: { value: new THREE.Color(0x303844) },

                // 圣诞树光源颜色和位置
                treeLightColor: { value: new THREE.Color(0xffd700) },
                treeLightPos: { value: new THREE.Vector3(0, 2, -4) },
                treeLightIntensity: { value: 0.8 },

                // 环境光
                lightPosition: { value: new THREE.Vector3(5, 10, -4) }
            },

            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    
                    // 世界坐标
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    
                    // 视角坐标（用于计算视角补偿）
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,

            fragmentShader: `
                uniform vec3 snowColor;
                uniform vec3 shadowColor;
                uniform vec3 lightPosition;
                
                // 圣诞树光源
                uniform vec3 treeLightColor;
                uniform vec3 treeLightPos;
                uniform float treeLightIntensity;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                
                void main() {
                    // 基础暗色
                    vec3 baseColor = snowColor * 0.35;
                    
                    // 环境光（很暗）
                    vec3 lightDir = normalize(lightPosition - vPosition);
                    float diff = max(dot(vNormal, lightDir), 0.2);
                    vec3 finalColor = baseColor * diff * 0.6;
                    
                    // === 圣诞树光源影响 ===
                    vec3 toTreeLight = treeLightPos - vWorldPosition;
                    float distToTree = length(toTreeLight);
                    vec3 treeLightDir = normalize(toTreeLight);
                    
                    // 距离衰减
                    float attenuation = treeLightIntensity / (1.0 + distToTree * distToTree * 0.05);
                    
                    // 树光照射到雪地的强度
                    float treeDiff = max(dot(vNormal, treeLightDir), 0.0);
                    vec3 treeContribution = treeLightColor * treeDiff * attenuation;
                    
                    // 叠加树的光源
                    finalColor += treeContribution * 0.2;
                    
                    // === 视角补偿 ===
                    vec3 viewDir = normalize(vViewPosition);
                    float viewDotNormal = abs(dot(viewDir, vNormal));
                    
                    // Fresnel效果：视角越倾斜，补偿越强
                    float fresnelFactor = pow(1.0 - viewDotNormal, 2.0);
                    float viewBoost = 1.0 - fresnelFactor * 0.2;
                    
                    finalColor *= viewBoost;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,

            side: THREE.DoubleSide
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(this.centerX, -0.1, this.centerZ);
        ground.receiveShadow = true;

        this.group.add(ground);
        this.ground = ground;

        this.scene.add(this.group);
    }

    dispose() {
        if (this.ground) {
            this.ground.geometry.dispose();
            this.ground.material.dispose();
        }
        this.scene.remove(this.group);
    }
}
