// Enhanced AI Locomotion for multiple NPC entities
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
        behavior: {type: 'string', default: 'chase'} // 'chase', 'flee', 'patrol', 'idle'
    },

    init: function() {
        this.rig = this.el.object3D;
        
        // Target tracking
        this.targetID = document.querySelector(this.data.targetID).object3D;
        this.object = this.el.object3D;
        this.origRotX = this.el.object3D.rotation.x;
        this.origRotZ = this.el.object3D.rotation.z;
        
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
        
        // Performance stats
        this.lastProcessingTime = 0;
    },

    turn: function() {
        // Skip processing if inactive
        if (!this.data.active) return;
        
        let targetDirection = new THREE.Vector3();
        
        // Handle different behaviors
        if (this.data.behavior === 'patrol' || 
            (this.data.behavior === 'chase' && !this.targetVisible)) {
            
            // Patrol in a general direction
            const now = Date.now();
            if (now - this.patrolTimer > this.patrolDuration) {
                this.patrolTimer = now;
                this.patrolAngle = Math.random() * Math.PI * 2;
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
        
        // Calculate the yaw angle
        const yaw = Math.atan2(targetDirection.x, targetDirection.z) + this.data.adjustY;
        
        // Apply the rotations
        if (this.data.clampY) {
            this.object.rotation.set(0, yaw * this.data.rSpeed, 0);
        } else {
            // Calculate pitch if not clamping to Y axis
            const pitch = Math.atan2(
                targetDirection.y, 
                Math.sqrt(targetDirection.x * targetDirection.x + targetDirection.z * targetDirection.z)
            );
            this.object.rotation.set(-pitch * this.data.rSpeed, yaw * this.data.rSpeed, 0);
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
        
        // Get current position
        const mx = this.rig.position.x;
        const mz = this.rig.position.z;
        
        // Add small offsets for varied height
        const terrainX = mx + this.terrainOffsetX;
        const terrainZ = mz + this.terrainOffsetZ;
        
        // Get terrain height and adjust entity position
        const my = getTerrainHeight(terrainX, terrainZ);
        this.rig.position.y = my + this.data.height;
        
        // Turn toward target (or away if fleeing)
        this.turn();
        
        // Handle different movement behaviors
        let movementSpeed = this.data.speed;
        
        if (this.data.behavior === 'idle') {
            movementSpeed = 0;
        } else if (this.data.behavior === 'patrol') {
            movementSpeed = this.patrolSpeed;
        }
        
        // Apply movement
        const fleeMultiplier = this.data.flee ? -1 : 1;
        
        this.rig.position.x += 
            fleeMultiplier * Math.sin(this.rig.rotation.y + this.data.adjustY) * 
            movementSpeed * delta * this.data.updateInterval;
            
        this.rig.position.z += 
            fleeMultiplier * Math.cos(this.rig.rotation.y + this.data.adjustY) * 
            movementSpeed * delta * this.data.updateInterval;
        
        // Wiggle animation
        if (this.data.wiggle && movementSpeed > 0) {
            this.rig.rotation.z = Math.sin((Date.now() * 0.01) * (movementSpeed * 0.5)) * 0.16;
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