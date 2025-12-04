import * as THREE from 'three';

export class GiftBox {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.visible = false;
        this.init();
    }

    init() {
        // Main box (red, opaque, solid, bright)
        const boxGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xaa0000,  // Self-illumination for brightness
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.2,
            transparent: false,
            depthWrite: true,
            depthTest: true
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.renderOrder = 10; // Render on top of particles
        this.group.add(box);

        // Gold ribbon (opaque, bright)
        const ribbonMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffaa00,  // Self-illumination for brightness
            emissiveIntensity: 0.4,
            roughness: 0.4,
            metalness: 0.6,
            transparent: false,
            depthWrite: true,
            depthTest: true
        });
        const ribbonVertGeometry = new THREE.BoxGeometry(0.32, 0.32, 0.05);
        const ribbonVert = new THREE.Mesh(ribbonVertGeometry, ribbonMaterial);
        ribbonVert.renderOrder = 10;
        this.group.add(ribbonVert);

        // Gold ribbon around box (horizontal)
        const ribbonHorGeometry = new THREE.BoxGeometry(0.05, 0.32, 0.32);
        const ribbonHor = new THREE.Mesh(ribbonHorGeometry, ribbonMaterial);
        ribbonHor.renderOrder = 10;
        this.group.add(ribbonHor);

        // Bow on top - center knot
        const knotGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        const knot = new THREE.Mesh(knotGeometry, ribbonMaterial);
        knot.position.y = 0.15;
        knot.renderOrder = 10;
        this.group.add(knot);

        // Bow loops (4 petals)
        const loopGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        loopGeometry.scale(1, 0.5, 0.5);

        // Front loop
        const loop1 = new THREE.Mesh(loopGeometry, ribbonMaterial);
        loop1.position.set(0, 0.15, 0.1);
        loop1.renderOrder = 10;
        this.group.add(loop1);

        // Back loop
        const loop2 = new THREE.Mesh(loopGeometry, ribbonMaterial);
        loop2.position.set(0, 0.15, -0.1);
        loop2.renderOrder = 10;
        this.group.add(loop2);

        // Left loop
        const loop3 = new THREE.Mesh(loopGeometry, ribbonMaterial);
        loop3.position.set(-0.1, 0.15, 0);
        loop3.rotation.y = Math.PI / 2;
        loop3.renderOrder = 10;
        this.group.add(loop3);

        // Right loop
        const loop4 = new THREE.Mesh(loopGeometry, ribbonMaterial);
        loop4.position.set(0.1, 0.15, 0);
        loop4.rotation.y = Math.PI / 2;
        loop4.renderOrder = 10;
        this.group.add(loop4);

        // Ribbon tails
        const tailGeometry = new THREE.BoxGeometry(0.04, 0.12, 0.02);

        const tail1 = new THREE.Mesh(tailGeometry, ribbonMaterial);
        tail1.position.set(0.08, 0.08, 0);
        tail1.rotation.z = -0.3;
        tail1.renderOrder = 10;
        this.group.add(tail1);

        const tail2 = new THREE.Mesh(tailGeometry, ribbonMaterial);
        tail2.position.set(-0.08, 0.08, 0);
        tail2.rotation.z = 0.3;
        tail2.renderOrder = 10;
        this.group.add(tail2);

        // Add to scene but hide initially
        this.group.visible = false;
        this.scene.add(this.group);
    }

    // Detect if hands are in presenting pose
    detectPresentingGesture(landmarks) {
        if (!landmarks || landmarks.length < 33) return false;

        // Get wrist positions (landmarks 15 and 16)
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        if (!leftWrist || !rightWrist) return false;

        // Calculate distance between wrists
        const dx = leftWrist.x - rightWrist.x;
        const dy = leftWrist.y - rightWrist.y;
        const dz = leftWrist.z - rightWrist.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Check if hands are at similar height (horizontal alignment)
        const heightDiff = Math.abs(dy);

        // Check if hands are in front (both hands should have similar z)
        const depthDiff = Math.abs(dz);

        // Presenting gesture criteria (relaxed thresholds to reduce flickering):
        // 1. Hands are close together (0.15 to 0.6 units apart) - increased max distance
        // 2. Hands are at similar height (heightDiff < 0.2) - more tolerance
        // 3. Hands are at similar depth (depthDiff < 0.25) - more tolerance
        const isPresenting = (
            distance > 0.15 && distance < 0.6 &&
            heightDiff < 0.2 &&
            depthDiff < 0.25
        );

        return isPresenting;
    }

    update(landmarks) {
        const isPresenting = this.detectPresentingGesture(landmarks);

        if (isPresenting && landmarks) {
            // Show the gift box
            this.group.visible = true;
            this.visible = true;

            // Position between the hands
            const leftWrist = landmarks[15];
            const rightWrist = landmarks[16];

            const centerX = ((0.5 - leftWrist.x) * 2 + (0.5 - rightWrist.x) * 2) / 2;
            const centerY = ((1 - leftWrist.y) * 2 + (1 - rightWrist.y) * 2) / 2;
            const centerZ = (-leftWrist.z + -rightWrist.z) / 2;

            this.group.position.set(centerX, centerY, centerZ);

            // Add a gentle floating animation
            const time = Date.now() * 0.001;
            this.group.position.y += Math.sin(time * 2) * 0.02;
            this.group.rotation.y = time * 0.5;
        } else {
            // Hide the gift box
            this.group.visible = false;
            this.visible = false;
        }
    }

    hide() {
        this.group.visible = false;
        this.visible = false;
    }
}
