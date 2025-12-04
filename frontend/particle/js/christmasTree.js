import * as THREE from 'three';

export class ChristmasTree {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.init();
    }

    init() {
        // Position tree behind the character
        this.group.position.set(0, 0, -4);

        // --- 1. Granular Tree Body (Instanced Meshes) ---
        // We will use 3 types of shapes: Cubes, Spheres, and Stars (Tetrahedrons)

        const count = 300; // Particles per shape type (total ~900)

        // Geometries
        const boxGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const sphereGeo = new THREE.SphereGeometry(0.07, 8, 8);
        const starGeo = new THREE.OctahedronGeometry(0.08, 0); // Diamond/Star shape

        // Material (Standard material for solid, granular look)
        const material = new THREE.MeshStandardMaterial({
            roughness: 0.3,
            metalness: 0.8,
            emissiveIntensity: 0.2
        });

        // Create InstancedMeshes
        const boxMesh = new THREE.InstancedMesh(boxGeo, material.clone(), count);
        const sphereMesh = new THREE.InstancedMesh(sphereGeo, material.clone(), count);
        const starMesh = new THREE.InstancedMesh(starGeo, material.clone(), count);

        // Colors for instances
        const palette = [
            new THREE.Color(0x2255ff), // Blue
            new THREE.Color(0x88ccff), // Light Blue
            new THREE.Color(0xffffff), // White
            new THREE.Color(0xffd700), // Gold
            new THREE.Color(0xc0c0c0)  // Silver
        ];

        const dummy = new THREE.Object3D();
        const _color = new THREE.Color();

        // Helper function to position instances in a cone
        const fillInstances = (mesh, offset) => {
            for (let i = 0; i < count; i++) {
                // Random height (0 to 3.2)
                const y = Math.random() * 3.2;

                // Radius decreases as height increases
                const maxRadius = 1.3 * (1 - y / 3.4);
                // Distribute more particles near the surface but also some inside
                const radius = Math.random() * maxRadius;
                const angle = Math.random() * Math.PI * 2;

                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;

                dummy.position.set(x, y + 0.4, z);

                // Random rotation
                dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

                // Random scale variation
                const scale = 0.8 + Math.random() * 0.6;
                dummy.scale.set(scale, scale, scale);

                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);

                // Random color
                mesh.setColorAt(i, palette[Math.floor(Math.random() * palette.length)]);
            }
            mesh.instanceMatrix.needsUpdate = true;
            mesh.instanceColor.needsUpdate = true;
            this.group.add(mesh);
        };

        fillInstances(boxMesh, 0);
        fillInstances(sphereMesh, 1);
        fillInstances(starMesh, 2);


        // --- 2. Glowing Spiral Ribbon ---
        const curvePoints = [];
        const spiralHeight = 3.4;
        const spiralRadiusBase = 1.4;
        const spiralTurns = 6.5;

        for (let i = 0; i <= 120; i++) {
            const t = i / 120;
            const angle = t * Math.PI * 2 * spiralTurns;
            const y = t * spiralHeight;
            const radius = spiralRadiusBase * (1 - t);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            curvePoints.push(new THREE.Vector3(x, y + 0.4, z));
        }

        const curve = new THREE.CatmullRomCurve3(curvePoints);

        // Solid core of the ribbon
        const tubeGeometry = new THREE.TubeGeometry(curve, 120, 0.02, 8, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: false, // Solid
            opacity: 1.0
        });
        const spiral = new THREE.Mesh(tubeGeometry, tubeMaterial);

        // Outer glow of the ribbon
        const glowGeometry = new THREE.TubeGeometry(curve, 120, 0.06, 8, false);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowSpiral = new THREE.Mesh(glowGeometry, glowMaterial);

        this.group.add(spiral);
        this.group.add(glowSpiral);


        // --- 3. Top Star (3D Extruded) ---
        const starShape = new THREE.Shape();
        const outerRadius = 0.25;
        const innerRadius = 0.12;
        const spikes = 5;

        for (let i = 0; i < spikes * 2; i++) {
            const r = (i % 2 === 0) ? outerRadius : innerRadius;
            const a = (i / (spikes * 2)) * Math.PI * 2;
            const x = Math.cos(a + Math.PI / 2) * r;
            const y = Math.sin(a + Math.PI / 2) * r;

            if (i === 0) starShape.moveTo(x, y);
            else starShape.lineTo(x, y);
        }
        starShape.closePath();

        const starGeometry = new THREE.ExtrudeGeometry(starShape, {
            depth: 0.1,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 2
        });

        // Center the geometry
        starGeometry.center();

        const starMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,      // Yellow/Gold
            emissive: 0xffd700,   // Glows yellow
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.8
        });

        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.y = 3.9;

        // Removed the flat CircleGeometry glow to avoid "disk" artifact

        this.group.add(star);
        this.star = star;

        this.scene.add(this.group);
    }

    update(time) {
        // Rotate the whole tree slowly
        this.group.rotation.y = time * 0.15;

        // Pulse the star
        const scale = 1 + Math.sin(time * 3) * 0.1;
        this.star.scale.set(scale, scale, scale);
    }
}
