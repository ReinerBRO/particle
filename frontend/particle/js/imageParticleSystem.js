/**
 * ImageParticleSystem - 3D Volumetric Particle Sculpture from Images
 * Implements "ink in water" aesthetic with soft, flowing particles.
 */

import * as THREE from 'three';

export class ImageParticleSystem extends THREE.Object3D {
    constructor(options = {}) {
        super();
        this.options = {
            size: 1.5,           // Physical size in world units
            density: 100,        // Sampling density (width/height)
            depth: 0.3,          // Z-depth thickness of the sculpture
            particleSize: 0.03,  // Base size of particles
            ...options
        };

        this.particles = null;
        this.material = null;
        this.geometry = null;
    }

    /**
     * Load an image and generate the particle system
     * @param {string} imageUrl 
     */
    async loadImage(imageUrl) {
        if (!imageUrl) return;

        // Create an image element to load the data
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        return new Promise((resolve, reject) => {
            img.onload = () => {
                this.generateParticles(img);
                resolve();
            };
            img.onerror = (e) => {
                console.error("Failed to load image for particles:", imageUrl, e);
                reject(e);
            };
        });
    }

    /**
     * Generate particles from image pixel data
     */
    generateParticles(img) {
        // 1. Draw image to offscreen canvas to read pixels
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Downsample for performance / style
        // We want a fixed grid size regardless of image aspect ratio for consistent density
        const aspect = img.width / img.height;
        let width = this.options.density;
        let height = Math.floor(width / aspect);

        canvas.width = width;
        canvas.height = height;

        // Draw and get data
        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 2. Create Geometry
        const positions = [];
        const colors = [];
        const sizes = [];
        const randoms = []; // For animation timing variation

        const threshold = 10; // Dark pixel threshold to skip pure black/transparent if needed

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // Skip transparent pixels
                if (a < 50) continue;

                // Normalize coordinates to centered [-0.5, 0.5] range
                const posX = (x / width) - 0.5;
                const posY = -((y / height) - 0.5); // Flip Y

                // Add volumetric depth (random Z scatter)
                // Concentration in center, thinner at edges? Or uniform?
                // Let's do a slight gaussian-like distribution for "cloud" feel
                const posZ = (Math.random() - 0.5) * this.options.depth;

                // Scale to world size
                positions.push(
                    posX * this.options.size,
                    posY * this.options.size,
                    posZ
                );

                // Colors (normalized)
                colors.push(r / 255, g / 255, b / 255);

                // Variation attributes
                sizes.push(Math.random());
                randoms.push(Math.random());
            }
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometry.setAttribute('sizeOffset', new THREE.Float32BufferAttribute(sizes, 1));
        this.geometry.setAttribute('random', new THREE.Float32BufferAttribute(randoms, 1));

        // 3. Create Shader Material
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseSize: { value: this.options.particleSize * (window.innerHeight || 1000) }, // Scale with screen
                opacity: { value: 0.8 }
            },
            vertexShader: `
                uniform float time;
                uniform float baseSize;
                
                attribute vec3 color;
                attribute float sizeOffset;
                attribute float random;
                
                varying vec3 vColor;
                varying float vAlpha;

                // Simplex noise function or simple sine waves for "fluid" motion
                void main() {
                    vColor = color;
                    
                    vec3 pos = position;
                    
                    // Fluid breathing motion
                    // Pixels drift slightly based on time and random offset
                    float slowTime = time * 0.5;
                    float moveX = sin(slowTime + pos.y * 2.0 + random * 6.0) * 0.02;
                    float moveY = cos(slowTime + pos.x * 2.0 + random * 6.0) * 0.02;
                    float moveZ = sin(slowTime * 1.3 + random * 10.0) * 0.02;
                    
                    pos += vec3(moveX, moveY, moveZ);

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    // Size attenuation
                    // Randomize size slightly for "mist" feel
                    float pSize = baseSize * (0.8 + sizeOffset * 0.6);
                    gl_PointSize = pSize * (1.0 / -mvPosition.z);
                    
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Distance fade (optional, usually handled by fog, but good for soft edges)
                    vAlpha = 1.0;
                }
            `,
            fragmentShader: `
                uniform float opacity;
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    // Circular soft particle
                    vec2 uv = gl_PointCoord - vec2(0.5);
                    float dist = length(uv);
                    
                    // Soft edge: Ink drop gradient
                    // High intensity in center, very quick falloff, but long tail
                    if (dist > 0.5) discard;
                    
                    // Smooth bell curve or exponential falloff for "glow"
                    float glow = exp(-dist * 8.0); // Sharp center
                    float halo = smoothstep(0.5, 0.0, dist) * 0.2; // Soft outer ring
                    
                    float alpha = (glow + halo) * opacity * vAlpha;
                    
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false, // Important for additive/volumetric look, particles don't block each other
            blending: THREE.AdditiveBlending // Glow effect
            // blending: THREE.NormalBlending // Use Normal blending for more "ink" look, Additive for "light"
        });

        // Use Additive for "Light Sculpture", Normal for "Ink in Water"
        // User asked for "Ink in water... soft glowing particles". 
        // Additive is usually better for "glowing". Let's stick with Additive or Custom.
        // If it washes out white, we might switch to Normal with partial alpha.

        this.particles = new THREE.Points(this.geometry, this.material);
        this.add(this.particles);
    }

    update(time) {
        if (this.material) {
            this.material.uniforms.time.value = time;
        }

        // Slowly rotate the whole sculpture for dynamic viewing?
        // this.rotation.y = Math.sin(time * 0.1) * 0.1;
    }

    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
    }
}
