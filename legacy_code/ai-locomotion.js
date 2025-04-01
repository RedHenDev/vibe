AFRAME.registerComponent('ai-locomotion', {
    schema: {
        speed: {type: 'number', default: 0.6},
        height: {type: 'number', default: 0.6},
        wiggle: {type: 'boolean', default: true},
        flee: {type: 'boolean', default: false},
        targetID: {type: 'string', default: '#player'},
        rSpeed: {type: 'number', default: 1},
        clampY: {type: 'boolean', default: true},
        adjustY: {type: 'number', default: 3.14},
        active: {type: 'boolean', default: true},
        updateInterval: {type: 'number', default: 1},
        terrainOffset: {type: 'number', default: 0},
        behavior: {type: 'string', default: 'chase'},
        turnRate: {type: 'number', default: Math.PI / 2}, // Radians per second (90 degrees/sec default)
        accelerationRate: {type: 'number', default: 0.1} // Smoothing factor (0-1)
    },

    init: function() {
        this.rig = this.el.object3D;
        this.targetID = document.querySelector(this.data.targetID).object3D;
        this.object = this.el.object3D;
        this.origRotX = this.object.rotation.x;
        this.origRotZ = this.object.rotation.z;
        this.targetRotationY = this.object.rotation.y;
        this.currentSpeed = 0;
        this.targetSpeed = this.data.speed;
        this.frameCounter = 0;
        this.terrainOffsetX = (Math.random() * 2 - 1) * this.data.terrainOffset;
        this.terrainOffsetZ = (Math.random() * 2 - 1) * this.data.terrainOffset;
        this.npcId = Math.floor(Math.random() * 10000);
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.patrolSpeed = this.data.speed * 0.7;
        this.patrolTimer = 0;
        this.patrolDuration = 5000 + Math.random() * 5000;
        this.patrolChangeSmoothing = 0;
        this.prevTargetDirection = new THREE.Vector3(0, 0, -1);
        this.lastProcessingTime = 0;
        this.lastKnownPosition = new THREE.Vector3();
        this.hasLastKnownPosition = false;
    },

    calculateTargetDirection: function() {
        let targetDirection = new THREE.Vector3();

        if (this.data.behavior === 'chase') {
            if (this.targetVisible) {
                targetDirection.subVectors(this.targetID.position, this.object.position).normalize();
            } else if (this.hasLastKnownPosition) {
                targetDirection.subVectors(this.lastKnownPosition, this.object.position).normalize();
                const distance = this.object.position.distanceTo(this.lastKnownPosition);
                if (distance < 5) {
                    this.hasLastKnownPosition = false;
                }
            } else {
                const now = Date.now();
                if (now - this.patrolTimer > this.patrolDuration) {
                    this.patrolTimer = now;
                    this.newPatrolAngle = Math.random() * Math.PI * 2;
                    this.patrolChangeSmoothing = 0;
                }
                if (this.patrolChangeSmoothing < 1 && this.newPatrolAngle !== undefined) {
                    this.patrolChangeSmoothing += 0.01;
                    this.patrolAngle = this.lerpAngle(this.patrolAngle, this.newPatrolAngle, this.patrolChangeSmoothing);
                    if (this.patrolChangeSmoothing >= 1) {
                        this.patrolAngle = this.newPatrolAngle;
                    }
                }
                targetDirection.set(
                    Math.sin(this.patrolAngle),
                    0,
                    Math.cos(this.patrolAngle)
                );
            }
        } else if (this.data.behavior === 'patrol') {
            const now = Date.now();
            if (now - this.patrolTimer > this.patrolDuration) {
                this.patrolTimer = now;
                this.newPatrolAngle = Math.random() * Math.PI * 2;
                this.patrolChangeSmoothing = 0;
            }
            if (this.patrolChangeSmoothing < 1 && this.newPatrolAngle !== undefined) {
                this.patrolChangeSmoothing += 0.01;
                this.patrolAngle = this.lerpAngle(this.patrolAngle, this.newPatrolAngle, this.patrolChangeSmoothing);
                if (this.patrolChangeSmoothing >= 1) {
                    this.patrolAngle = this.newPatrolAngle;
                }
            }
            targetDirection.set(
                Math.sin(this.patrolAngle),
                0,
                Math.cos(this.patrolAngle)
            );
        } else if (this.data.behavior === 'idle') {
            targetDirection.set(0, 0, 0);
        }

        if (this.prevTargetDirection) {
            const dotProduct = this.prevTargetDirection.dot(targetDirection);
            let blendFactor = 0.05;
            if (dotProduct < 0.7) {
                blendFactor = 0.025;
            }
            targetDirection.lerp(this.prevTargetDirection, 1 - blendFactor);
            targetDirection.normalize();
        }
        this.prevTargetDirection.copy(targetDirection);

        return targetDirection;
    },

    lerpAngle: function(a, b, t) {
        const normA = a % (Math.PI * 2);
        let normB = b % (Math.PI * 2);
        let diff = normB - normA;
        if (diff < -Math.PI) normB += Math.PI * 2;
        else if (diff > Math.PI) normB -= Math.PI * 2;
        return normA + (normB - normA) * t;
    },

    turn: function() {
        if (!this.data.active) return;

        const targetDirection = this.calculateTargetDirection();
        const targetYaw = Math.atan2(targetDirection.x, targetDirection.z) + this.data.adjustY;
        this.targetRotationY = targetYaw;

        if (!this.data.clampY) {
            const pitch = Math.atan2(
                targetDirection.y,
                Math.sqrt(targetDirection.x * targetDirection.x + targetDirection.z * targetDirection.z)
            );
            this.targetRotationX = -pitch;
        }
    },

    tick: function(time, delta) {
        if (!delta || !this.data.active) return;

        this.frameCounter = (this.frameCounter + 1) % this.data.updateInterval;
        if (this.frameCounter !== 0) return;

        const startTime = performance.now();

        delta = delta * 0.001; // Convert to seconds
        delta *= this.data.updateInterval;

        const mx = this.rig.position.x;
        const mz = this.rig.position.z;
        const terrainX = mx + this.terrainOffsetX;
        const terrainZ = mz + this.terrainOffsetZ;
        const my = getTerrainHeight(terrainX, terrainZ);
        this.rig.position.y = my + this.data.height;

        if (this.targetVisible) {
            this.lastKnownPosition.copy(this.targetID.position);
            this.hasLastKnownPosition = true;
        }

        this.turn();

        if (this.data.behavior === 'chase') {
            if (this.targetVisible) {
                this.targetSpeed = this.data.speed * 1.5; // 50% faster when player is visible
            } else if (this.hasLastKnownPosition) {
                this.targetSpeed = this.data.speed * 1.2; // 20% faster to last known position
            } else {
                this.targetSpeed = this.patrolSpeed;
            }
        } else if (this.data.behavior === 'patrol') {
            this.targetSpeed = this.patrolSpeed;
        } else if (this.data.behavior === 'idle') {
            this.targetSpeed = 0;
        }

        this.currentSpeed += (this.targetSpeed - this.currentSpeed) * this.data.accelerationRate;

        let rotDiff = this.targetRotationY - this.object.rotation.y;
        rotDiff = (rotDiff + Math.PI) % (2 * Math.PI) - Math.PI;
        const maxTurnSpeed = this.data.turnRate * this.data.rSpeed;
        const maxTurnThisFrame = maxTurnSpeed * delta;
        const turnAmount = Math.min(Math.abs(rotDiff), maxTurnThisFrame) * Math.sign(rotDiff);
        this.object.rotation.y += turnAmount;

        if (!this.data.clampY && this.targetRotationX !== undefined) {
            let pitchDiff = this.targetRotationX - this.object.rotation.x;
            pitchDiff = (pitchDiff + Math.PI) % (2 * Math.PI) - Math.PI;
            const pitchTurnAmount = Math.min(Math.abs(pitchDiff), maxTurnThisFrame) * Math.sign(pitchDiff);
            this.object.rotation.x += pitchTurnAmount;
        }

        const fleeMultiplier = this.data.flee ? -1 : 1;
        this.rig.position.x += fleeMultiplier * Math.sin(this.object.rotation.y) * this.currentSpeed * delta;
        this.rig.position.z += fleeMultiplier * Math.cos(this.object.rotation.y) * this.currentSpeed * delta;

        if (this.data.wiggle && this.currentSpeed > 0.1) {
            const wiggleIntensity = Math.min(1, this.currentSpeed / this.data.speed);
            this.object.rotation.z = Math.sin(Date.now() * 0.01) * 0.16 * wiggleIntensity;
        } else {
            this.object.rotation.z *= 0.9;
        }

        this.lastProcessingTime = performance.now() - startTime;
    }
});