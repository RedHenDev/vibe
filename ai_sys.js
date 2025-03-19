// Enhanced AI Locomotion with smooth direction changes
AFRAME.registerComponent('ai-locomotion', {
    schema: {
        speed: {type: 'number', default: 0.6},
        height: {type: 'number', default: 0.6},
        wiggle: {type: 'boolean', default: true},
        flee: {type: 'boolean', default: false},
        targetID: {type: 'string', default: '#player'},
        rSpeed: {type: 'number', default: 1},
        clampY: {type: 'boolean', default: true},
        adjustY: {type: 'number', default: 0},
        active: {type: 'boolean', default: true},
        updateInterval: {type: 'number', default: 1}, // Update every N frames
        terrainOffset: {type: 'number', default: 0}, // Random offset for terrain sampling
        behavior: {type: 'string', default: 'chase'}, // 'chase', 'flee', 'patrol', 'idle'
        turnRate: {type: 'number', default: 0.05}, // How quickly the NPC can turn (0-1)
        accelerationRate: {type: 'number', default: 0.1} // How quickly the NPC can accelerate (0-1)
    },

    init: function() {
        this.rig = this.el.object3D;
        
        // Target tracking
        this.targetID = document.querySelector(this.data.targetID).object3D;
        this.object = this.el.object3D;
        this.origRotX = this.el.object3D.rotation.x;
        this.origRotZ = this.el.object3D.rotation.z;
        
        // Movement smoothing properties
        this.targetRotationY = this.object.rotation.y;
        this.currentSpeed = 0;
        this.targetSpeed = this.data.speed;
        
        // Optimization
        this.frameCounter = 0;
        
        // Add small random terrain offset for varied height
        this.terrainOffsetX = (Math.random() * 2 - 1) * this.data.terrainOffset;
        this.terrainOffsetZ = (Math.random() * 2 - 1) * this.data.terrainOffset;
        
        // Add unique ID for debugging
        this.npcId = Math.floor(Math.random() * 10000);
        
        // Patrol state
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.patrolSpeed = this.data.speed * 0.7;
        this.patrolTimer = 0;
        this.patrolDuration = 5000 + Math.random() * 5000; // 5-10 seconds
        this.patrolChangeSmoothing = 0; // For smooth patrol transitions
        
        // Previous direction to ensure smooth movement
        this.prevTargetDirection = new THREE.Vector3(0, 0, -1);
        
        // Performance stats
        this.lastProcessingTime = 0;
    },

    calculateTargetDirection: function() {
        // Direction calculation - separated to make the code more modular
        let targetDirection = new THREE.Vector3();
        
        // Handle different behaviors
        if (this.data.behavior === 'patrol' || 
            (this.data.behavior === 'chase' && !this.targetVisible)) {
            
            // Check if it's time to change patrol direction
            const now = Date.now();
            if (now - this.patrolTimer > this.patrolDuration) {
                this.patrolTimer = now;
                
                // Instead of instantly changing angle, set a target and smooth toward it
                this.newPatrolAngle = Math.random() * Math.PI * 2;
                this.patrolChangeSmoothing = 0; // Start transition
            }
            
            // Smoothly transition to new patrol direction if needed
            if (this.patrolChangeSmoothing < 1 && this.newPatrolAngle !== undefined) {
                this.patrolChangeSmoothing += 0.01; // Slowly transition
                this.patrolAngle = this.lerpAngle(this.patrolAngle, this.newPatrolAngle, this.patrolChangeSmoothing);
                
                if (this.patrolChangeSmoothing >= 1) {
                    this.patrolAngle = this.newPatrolAngle;
                }
            }
            
            // Create a patrol direction vector
            targetDirection.set(
                Math.sin(this.patrolAngle), 
                0, 
                Math.cos(this.patrolAngle)
            );
            
        } else {
            // Normal chase or flee behavior
            // Create a direction vector from object to target
            targetDirection.subVectors(this.targetID.position, this.object.position).normalize();
            
            // Reverse direction if fleeing
            if (this.data.flee) {
                targetDirection.negate();
            }
        }
        
        // Smoothly blend with previous direction to avoid sudden turns
        if (this.prevTargetDirection) {
            // Calculate dot product to check how different the directions are
            const dotProduct = this.prevTargetDirection.dot(targetDirection);
            
            // If directions are very different, blend more gradually
            let blendFactor = this.data.turnRate;
            if (dotProduct < 0.7) { // More than ~45 degrees difference
                blendFactor = this.data.turnRate * 0.5; // Slower turns for sharp corners
            }
            
            // Lerp between previous and new direction
            targetDirection.lerp(this.prevTargetDirection, 1 - blendFactor);
            targetDirection.normalize(); // Ensure it's still a unit vector
        }
        
        // Store for next frame
        this.prevTargetDirection.copy(targetDirection);
        
        return targetDirection;
    },
    
    // Helper function to lerp between angles properly (handles wrap-around)
    lerpAngle: function(a, b, t) {
        // Normalize angles to 0-2PI range
        const normA = a % (Math.PI * 2);
        let normB = b % (Math.PI * 2);
        
        // Find shortest path
        let diff = normB - normA;
        if (diff < -Math.PI) normB += Math.PI * 2;
        else if (diff > Math.PI) normB -= Math.PI * 2;
        
        // Lerp
        return normA + (normB - normA) * t;
    },

    turn: function() {
        // Skip processing if inactive
        if (!this.data.active) return;
        
        // Get the target direction with all smoothing applied
        const targetDirection = this.calculateTargetDirection();
        
        // Calculate the yaw angle from direction vector
        const targetYaw = Math.atan2(targetDirection.x, targetDirection.z) + this.data.adjustY;
        
        // Set as the target rotation (will be smoothly applied in tick)
        this.targetRotationY = targetYaw;
        
        // Calculate pitch if not clamping to Y axis
        if (!this.data.clampY) {
            const pitch = Math.atan2(
                targetDirection.y, 
                Math.sqrt(targetDirection.x * targetDirection.x + targetDirection.z * targetDirection.z)
            );
            this.targetRotationX = -pitch;
        }
    },

    tick: function(time, delta) {
        // Skip if no delta or inactive
        if (!delta || !this.data.active) return;
        
        // Optimization: Only process on every Nth frame
        this.frameCounter = (this.frameCounter + 1) % this.data.updateInterval;
        if (this.frameCounter !== 0) return;
        
        const startTime = performance.now();
        
        delta = delta * 0.001; // Convert to seconds
        delta *= this.data.updateInterval; // Account for skipped frames
        
        // Get current position
        const mx = this.rig.position.x;
        const mz = this.rig.position.z;
        
        // Add small offsets for varied height
        const terrainX = mx + this.terrainOffsetX;
        const terrainZ = mz + this.terrainOffsetZ;
        
        // Get terrain height and adjust entity position
        const my = getTerrainHeight(terrainX, terrainZ);
        this.rig.position.y = my + this.data.height;
        
        // Calculate the desired direction
        this.turn();
        
        // Handle different movement behaviors
        this.targetSpeed = this.data.behavior === 'idle' ? 0 : 
                         (this.data.behavior === 'patrol' ? this.patrolSpeed : this.data.speed);
        
        // Smoothly adjust current speed toward target speed
        this.currentSpeed += (this.targetSpeed - this.currentSpeed) * this.data.accelerationRate;
        
        // Smoothly adjust current rotation toward target rotation
        const rotDiff = this.targetRotationY - this.object.rotation.y;
        
        // Handle rotation wrap-around
        let rotDiffNormalized = rotDiff;
        if (rotDiff > Math.PI) rotDiffNormalized -= Math.PI * 2;
        if (rotDiff < -Math.PI) rotDiffNormalized += Math.PI * 2;
        
        // Apply smooth rotation
        this.object.rotation.y += rotDiffNormalized * this.data.turnRate * this.data.rSpeed;
        
        // Apply pitch if enabled
        if (!this.data.clampY && this.targetRotationX !== undefined) {
            this.object.rotation.x += (this.targetRotationX - this.object.rotation.x) * 
                                     this.data.turnRate * this.data.rSpeed;
        }
        
        // Apply movement in the direction the NPC is actually facing
        const fleeMultiplier = this.data.flee ? -1 : 1;
        
        this.rig.position.x += 
            fleeMultiplier * Math.sin(this.object.rotation.y) * 
            this.currentSpeed * delta;
            
        this.rig.position.z += 
            fleeMultiplier * Math.cos(this.object.rotation.y) * 
            this.currentSpeed * delta;
        
        // Wiggle animation - tie it to actual movement speed
        if (this.data.wiggle && this.currentSpeed > 0.1) {
            // Scale wiggle amplitude based on speed
            const wiggleIntensity = Math.min(1, this.currentSpeed / this.data.speed);
            this.object.rotation.z = Math.sin(Date.now() * 0.01) * 0.16 * wiggleIntensity;
        } else {
            // Smoothly reset wiggle to zero
            this.object.rotation.z *= 0.9;
        }
        
        // Track processing time for performance monitoring
        this.lastProcessingTime = performance.now() - startTime;
    }
});

// Line of sight component to check if an NPC can see the player
AFRAME.registerComponent('line-of-sight', {
    schema: {
        target: {type: 'selector', default: '#player'},
        maxDistance: {type: 'number', default: 50},
        fov: {type: 'number', default: 120} // Field of view in degrees
    },
    
    init: function() {
        this.aiComponent = this.el.components['ai-locomotion'];
        if (!this.aiComponent) {
            console.warn('line-of-sight component requires ai-locomotion component');
            return;
        }
        
        this.raycaster = new THREE.Raycaster();
        this.direction = new THREE.Vector3();
        this.targetVisible = false;
        
        // Add ray visualization for debugging
        if (false) { // Set to true for debugging
            this.rayLine = document.createElement('a-entity');
            this.rayLine.setAttribute('line', {
                start: {x: 0, y: 0, z: 0},
                end: {x: 0, y: 0, z: 0},
                color: 'red'
            });
            this.el.appendChild(this.rayLine);
        }
    },
    
    tick: function(time, delta) {
        if (!this.data.target || !delta) return;
        
        // Get positions
        const npcPosition = this.el.object3D.position;
        const targetPosition = this.data.target.object3D.position;
        
        // Calculate distance
        this.direction.subVectors(targetPosition, npcPosition);
        const distance = this.direction.length();
        
        // Check distance
        if (distance > this.data.maxDistance) {
            this.targetVisible = false;
            if (this.aiComponent) {
                this.aiComponent.targetVisible = false;
            }
            return;
        }
        
        // Check if target is within field of view
        const npcForward = new THREE.Vector3(0, 0, -1);
        npcForward.applyQuaternion(this.el.object3D.quaternion);
        
        this.direction.normalize();
        const dotProduct = this.direction.dot(npcForward);
        const angleDegrees = Math.acos(dotProduct) * (180 / Math.PI);
        
        if (angleDegrees > this.data.fov / 2) {
            this.targetVisible = false;
            if (this.aiComponent) {
                this.aiComponent.targetVisible = false;
            }
            return;
        }
        
        // Cast ray to check for obstacles
        this.raycaster.set(npcPosition, this.direction);
        const intersects = this.raycaster.intersectObjects(this.el.sceneEl.object3D.children, true);
        
        // Check if player is the first thing hit
        let hitPlayer = false;
        for (let i = 0; i < intersects.length; i++) {
            const object = intersects[i].object;
            let element = object.el;
            
            // Traverse up to find an entity with an ID
            while (element && !element.id) {
                element = element.parentEl;
            }
            
            if (element && element.id === this.data.target.id) {
                hitPlayer = true;
                break;
            }
            
            // If we hit something else first, then the view is blocked
            if (element && element.id !== this.el.id) {
                break;
            }
        }
        
        this.targetVisible = hitPlayer;
        if (this.aiComponent) {
            this.aiComponent.targetVisible = hitPlayer;
        }
        
        // Update ray visualization if enabled
        if (this.rayLine) {
            const endPoint = new THREE.Vector3()
                .copy(this.direction)
                .multiplyScalar(hitPlayer ? distance : 10)
                .add(npcPosition);
                
            this.rayLine.setAttribute('line', {
                start: {x: 0, y: 0, z: 0},
                end: {
                    x: endPoint.x - npcPosition.x,
                    y: endPoint.y - npcPosition.y,
                    z: endPoint.z - npcPosition.z
                },
                color: hitPlayer ? 'green' : 'red'
            });
        }
    }
});