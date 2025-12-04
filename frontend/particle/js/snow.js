import * as THREE from 'three';

export class SnowEffect {
    constructor(scene, count = 1000) {
        this.scene = scene;
        this.count = count;
        this.particles = null;
        this.init();
    }

    init() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.count * 3);
        const velocities = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            // Random positions in a large volume
            positions[i * 3] = (Math.random() - 0.5) * 20; // x: -10 to 10
            positions[i * 3 + 1] = Math.random() * 10;     // y: 0 to 10
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20; // z: -10 to 10

            // Velocity: downward with slight random drift
            velocities[i * 3] = (Math.random() - 0.5) * 0.02;     // x drift
            velocities[i * 3 + 1] = -(Math.random() * 0.05 + 0.02); // y fall speed
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02; // z drift

            sizes[i] = Math.random() * 0.1 + 0.05; // Random size
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Simple white particle material - subtle and soft
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.08,  // Smaller size for subtle effect
            transparent: true,
            opacity: 0.4,  // Lower opacity for softer look
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true  // Size decreases with distance
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    update() {
        if (!this.particles) return;

        const positions = this.particles.geometry.attributes.position.array;
        const velocities = this.particles.geometry.attributes.velocity.array;

        for (let i = 0; i < this.count; i++) {
            // Update position based on velocity
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];

            // Reset if below ground
            if (positions[i * 3 + 1] < -2) {
                positions[i * 3 + 1] = 10; // Reset to top
                positions[i * 3] = (Math.random() - 0.5) * 20; // New random X
                positions[i * 3 + 2] = (Math.random() - 0.5) * 20; // New random Z
            }

            // Add some "flutter"
            positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.002;
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
    }
}
