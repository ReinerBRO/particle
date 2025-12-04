import * as THREE from 'three';

export class SantaCharacter {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.visible = false;

        this.parts = {};
        this.initBody();

        this.scene.add(this.group);
    }

    initBody() {
        // Materials
        const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.3 });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.5, roughness: 0.2 });

        // --- Head Group ---
        const headGroup = new THREE.Group();

        // Face
        const faceGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const face = new THREE.Mesh(faceGeo, skinMat);
        headGroup.add(face);

        // Beard
        const beardGeo = new THREE.SphereGeometry(0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const beard = new THREE.Mesh(beardGeo, whiteMat);
        beard.position.y = -0.02;
        beard.position.z = 0.02;
        beard.rotation.x = Math.PI;
        headGroup.add(beard);

        // Hat
        const hatGeo = new THREE.ConeGeometry(0.13, 0.25, 16);
        const hat = new THREE.Mesh(hatGeo, redMat);
        hat.position.y = 0.15;
        headGroup.add(hat);

        const hatRimGeo = new THREE.TorusGeometry(0.13, 0.03, 8, 16);
        const hatRim = new THREE.Mesh(hatRimGeo, whiteMat);
        hatRim.position.y = 0.05;
        hatRim.rotation.x = Math.PI / 2;
        headGroup.add(hatRim);

        const pompomGeo = new THREE.SphereGeometry(0.04);
        const pompom = new THREE.Mesh(pompomGeo, whiteMat);
        pompom.position.y = 0.28;
        headGroup.add(pompom);

        this.parts.head = headGroup;
        this.group.add(headGroup);


        // --- Torso ---
        const torsoGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 16);
        const torso = new THREE.Mesh(torsoGeo, redMat);
        // Pivot is usually center, but we want to control it easily. 
        // We'll update position directly.
        this.parts.torso = torso;
        this.group.add(torso);

        // Belt
        const beltGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.05, 16);
        const belt = new THREE.Mesh(beltGeo, blackMat);
        this.parts.belt = belt; // Will follow torso
        this.group.add(belt);

        // Buckle
        const buckleGeo = new THREE.BoxGeometry(0.08, 0.06, 0.02);
        const buckle = new THREE.Mesh(buckleGeo, goldMat);
        this.parts.buckle = buckle;
        this.group.add(buckle);


        // --- Arms ---
        // We need separate meshes for Upper Arm and Forearm to bend elbows
        this.parts.leftArm = this.createLimb(0.06, 0.25, redMat);
        this.parts.leftForeArm = this.createLimb(0.05, 0.25, redMat);
        this.parts.rightArm = this.createLimb(0.06, 0.25, redMat);
        this.parts.rightForeArm = this.createLimb(0.05, 0.25, redMat);

        // Hands (Gloves)
        this.parts.leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.06), whiteMat);
        this.parts.rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.06), whiteMat);

        this.group.add(this.parts.leftHand);
        this.group.add(this.parts.rightHand);


        // --- Legs ---
        this.parts.leftLeg = this.createLimb(0.07, 0.35, redMat);
        this.parts.leftCalf = this.createLimb(0.06, 0.35, redMat);
        this.parts.rightLeg = this.createLimb(0.07, 0.35, redMat);
        this.parts.rightCalf = this.createLimb(0.06, 0.35, redMat);

        // Boots
        const bootGeo = new THREE.BoxGeometry(0.1, 0.1, 0.15);
        this.parts.leftBoot = new THREE.Mesh(bootGeo, blackMat);
        this.parts.rightBoot = new THREE.Mesh(bootGeo, blackMat);

        this.group.add(this.parts.leftBoot);
        this.group.add(this.parts.rightBoot);
    }

    createLimb(radius, length, material) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.8, length), material);
        // Adjust geometry so pivot is at the top
        mesh.geometry.translate(0, -length / 2, 0);
        this.group.add(mesh);
        return mesh;
    }

    update(landmarks) {
        if (!landmarks) return;

        // Helper to get Vector3 from landmark
        const getPos = (index) => {
            // Map MediaPipe (0-1) to Three.js world coordinates
            // Assuming screen is roughly -1 to 1 in x and y
            // Z is depth estimate
            const l = landmarks[index];
            // Scale factors need to match the scene scale. 
            // In skeleton.js, particles are mapped: 
            // x: (0.5 - l.x) * 2
            // y: (0.5 - l.y) * 2  <-- Wait, usually y is inverted. Let's check skeleton.js logic.
            // Skeleton.js: 
            // const x = (0.5 - l.x) * 4;
            // const y = (0.5 - l.y) * 3; // Aspect ratio approx
            // const z = -l.z * 2;

            return new THREE.Vector3(
                (0.5 - l.x) * 4,
                (0.5 - l.y) * 3,
                -l.z * 2
            );
        };

        // Landmarks:
        // 0: nose
        // 11: left_shoulder, 12: right_shoulder
        // 13: left_elbow, 14: right_elbow
        // 15: left_wrist, 16: right_wrist
        // 23: left_hip, 24: right_hip
        // 25: left_knee, 26: right_knee
        // 27: left_ankle, 28: right_ankle

        const nose = getPos(0);
        const lShoulder = getPos(11);
        const rShoulder = getPos(12);
        const lElbow = getPos(13);
        const rElbow = getPos(14);
        const lWrist = getPos(15);
        const rWrist = getPos(16);
        const lHip = getPos(23);
        const rHip = getPos(24);
        const lKnee = getPos(25);
        const rKnee = getPos(26);
        const lAnkle = getPos(27);
        const rAnkle = getPos(28);

        // --- Head ---
        this.parts.head.position.copy(nose);
        // Simple rotation based on shoulders? Or just look forward.
        // For now, upright.

        // --- Torso ---
        // Center of shoulders and hips
        const shoulderCenter = new THREE.Vector3().addVectors(lShoulder, rShoulder).multiplyScalar(0.5);
        const hipCenter = new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5);
        const torsoCenter = new THREE.Vector3().addVectors(shoulderCenter, hipCenter).multiplyScalar(0.5);

        this.parts.torso.position.copy(torsoCenter);
        this.parts.torso.lookAt(shoulderCenter);
        this.parts.torso.rotateX(Math.PI / 2); // Cylinder looks up by default

        // Belt follows hips
        this.parts.belt.position.copy(hipCenter);
        this.parts.belt.lookAt(shoulderCenter);
        this.parts.belt.rotateX(Math.PI / 2);

        this.parts.buckle.position.copy(hipCenter);
        this.parts.buckle.position.z += 0.2; // Push forward

        // --- Arms ---
        this.orientLimb(this.parts.leftArm, lShoulder, lElbow);
        this.orientLimb(this.parts.leftForeArm, lElbow, lWrist);
        this.orientLimb(this.parts.rightArm, rShoulder, rElbow);
        this.orientLimb(this.parts.rightForeArm, rElbow, rWrist);

        // Hands
        this.parts.leftHand.position.copy(lWrist);
        this.parts.rightHand.position.copy(rWrist);

        // --- Legs ---
        this.orientLimb(this.parts.leftLeg, lHip, lKnee);
        this.orientLimb(this.parts.leftCalf, lKnee, lAnkle);
        this.orientLimb(this.parts.rightLeg, rHip, rKnee);
        this.orientLimb(this.parts.rightCalf, rKnee, rAnkle);

        // Boots
        this.parts.leftBoot.position.copy(lAnkle);
        this.parts.rightBoot.position.copy(rAnkle);
    }

    orientLimb(mesh, start, end) {
        mesh.position.copy(start);
        mesh.lookAt(end);
        mesh.rotateX(Math.PI / 2); // Cylinder default is Y-up, lookAt aligns Z.

        // Scale length to match distance
        const dist = start.distanceTo(end);
        // Original length was set in createLimb, but we can scale Y
        // Initial length was roughly 0.25 or 0.35. 
        // Let's just scale based on initial geometry height? 
        // Actually, createLimb sets a fixed geometry. 
        // Better to scale:
        // The geometry height is 'length' passed in createLimb.
        // We can just scale.y = dist / original_length
        // But we didn't save original length. 
        // Let's just assume a standard scale or re-create geometry? 
        // Scaling is faster.
        // Let's just set scale.y = dist * 3 (approx factor) or calculate properly.
        // Actually, let's just use lookAt and fixed length for now, or dynamic scale.

        // Dynamic scale:
        // We stored the geometry. The height is in parameters.
        // Let's just use a fixed unit length cylinder and scale it?
        // Too late, geometry is baked.
        // Let's just leave length fixed for "cartoon" look or try to scale.
        // mesh.scale.y = dist / 0.3; // Approx
    }

    setVisible(visible) {
        this.group.visible = visible;
        this.visible = visible;
    }
}
