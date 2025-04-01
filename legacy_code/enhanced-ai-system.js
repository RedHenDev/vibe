// Enhanced AI System for Eigengrau Light
// Makes NPCs more aggressive with advanced hunting and swarming behavior

AFRAME.registerComponent('enhanced-ai', {
  schema: {
    speed: {type: 'number', default: 2.0},          // Base movement speed
    maxSpeed: {type: 'number', default: 8.0},       // Maximum speed when hunting
    huntingRange: {type: 'number', default: 150},   // Range to detect player when hunting
    fleeingRange: {type: 'number', default: 5},     // Range to start fleeing (for fleeing NPCs)
    swarmRadius: {type: 'number', default: 8},      // Distance to maintain when swarming
    predictionFactor: {type: 'number', default: 2.0}, // How far ahead to predict player movement
    turnSpeed: {type: 'number', default: 0.08},     // How quickly NPC can turn
    acceleration: {type: 'number', default: 0.05},  // How quickly NPC can change speed
    height: {type: 'number', default: 1.0},         // Height above terrain
    targetID: {type: 'string', default: '#player'}, // Target to hunt
    behavior: {type: 'string', default: 'hunt',     // 'hunt', 'flee', 'swarm', 'patrol'
               oneOf: ['hunt', 'flee', 'swarm', 'patrol']},
    nightBoost: {type: 'number', default: 1.8},     // Speed multiplier at night
    active: {type: 'boolean', default: true},       // Whether AI is active
    updateInterval: {type: 'number', default: 1},   // Update every N frames for performance
    debug: {type: 'boolean', default: false}        // Show debug visualization
  },

  init: function() {
    // References
    this.entity = this.el.object3D;
    this.targetEl = document.querySelector(this.data.targetID);
    if (!this.targetEl) {
      console.error('Enhanced AI: Target element not found', this.data.targetID);
      return;
    }
    this.target = this.targetEl.object3D;
    
    // State variables
    this.currentSpeed = 0;
    this.targetSpeed = this.data.speed;
    this.lastPosition = new THREE.Vector3();
    this.lastPosition.copy(this.entity.position);
    this.currentBehavior = this.data.behavior;
    this.isNightTime = false;
    this.frameCounter = 0;
    this.isMoving = true;
    this.swarmAngle = Math.random() * Math.PI * 2; // Random angle for swarming
    this.swarmPhase = Math.random() * Math.PI * 2; // Random phase for swarming
    this.targetDirection = new THREE.Vector3(0, 0, -1); // Default direction
    this.lastPlayerPos = new THREE.Vector3();
    this.playerVelocity = new THREE.Vector3();
    this.stateChangeTime = 0;
    this.stuckCheckTime = 0;
    this.stuckCheckPosition = new THREE.Vector3();
    this.isStuck = false;
    this.stuckTimer = 0;
    this.debugText = null;
    
    // For smooth rotation
    this.targetRotationY = this.entity.rotation.y;
    
    // Connect to night-time system if available
    this.connectToDayNightCycle();
    
    // Create debug visualization if enabled
    if (this.data.debug) {
      this.createDebugVisualization();
    }
    
    // Start with random behavior change timing
    this.behaviorChangeInterval = 5000 + Math.random() * 5000;
    this.lastBehaviorChange = Date.now();
  },
  
  connectToDayNightCycle: function() {
    // Check if day-night cycle component exists
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
      this.isNightTime = this.dayNightCycle.isNight;
    }
  },
  
  update: function(oldData) {
    // Handle changes to data properties
    if (oldData.behavior !== this.data.behavior) {
      this.currentBehavior = this.data.behavior;
      this.onBehaviorChange();
    }
  },
  
  onBehaviorChange: function() {
    // Adjust parameters based on behavior
    switch (this.currentBehavior) {
      case 'hunt':
        this.targetSpeed = this.data.speed * 1.5;
        if (this.isNightTime) {
          this.targetSpeed *= this.data.nightBoost;
        }
        break;
      case 'flee':
        this.targetSpeed = this.data.speed * 1.2;
        break;
      case 'swarm':
        this.targetSpeed = this.data.speed * 0.8;
        // Reset swarm angle for new swarm behavior
        this.swarmAngle = Math.random() * Math.PI * 2;
        break;
      case 'patrol':
        this.targetSpeed = this.data.speed * 0.5;
        break;
    }
    
    // Cap speed at maxSpeed
    this.targetSpeed = Math.min(this.targetSpeed, this.data.maxSpeed);
    
    // Update debug info
    this.updateDebugText();
  },
  
  tick: function(time, delta) {
    if (!delta || !this.data.active || !this.target) return;
    
    // Optimization: only update on specific frames
    this.frameCounter = (this.frameCounter + 1) % this.data.updateInterval;
    if (this.frameCounter !== 0) return;
    
    // Adjust delta for skipped frames
    delta = delta * 0.001 * this.data.updateInterval; // Convert to seconds and account for skipped frames
    
    // Track target movement for prediction
    this.updateTargetTracking();
    
    // Check if time to change behavior
    const now = Date.now();
    if (now - this.lastBehaviorChange > this.behaviorChangeInterval) {
      this.randomizeBehavior();
      this.lastBehaviorChange = now;
      this.behaviorChangeInterval = 5000 + Math.random() * 5000; // 5-10 seconds
    }
    
    // Check if stuck
    if (now - this.stuckCheckTime > 1000) { // Check every second
      this.checkIfStuck();
      this.stuckCheckTime = now;
    }
    
    // Update based on behavior
    this.updateBehavior(delta);
    
    // Get terrain height at current position
    const terrainY = this.getTerrainHeight(this.entity.position.x, this.entity.position.z);
    const targetY = terrainY + this.data.height;
    
    // Smooth move to target height
    this.entity.position.y += (targetY - this.entity.position.y) * 0.1;
    
    // Prevent sinking below terrain
    if (this.entity.position.y < targetY) {
      this.entity.position.y = targetY;
    }
    
    // Update debug if enabled
    if (this.data.debug) {
      this.updateDebugVisualization();
    }
    
    // Store position for next frame
    this.lastPosition.copy(this.entity.position);
  },
  
  updateTargetTracking: function() {
    const targetPos = this.target.position;
    
    // Calculate target velocity based on position change
    if (this.lastPlayerPos.x !== 0 || this.lastPlayerPos.z !== 0) {
      this.playerVelocity.subVectors(targetPos, this.lastPlayerPos);
    }
    
    // Save current position for next frame
    this.lastPlayerPos.copy(targetPos);
  },
  
  updateBehavior: function(delta) {
    switch (this.currentBehavior) {
      case 'hunt':
        this.huntBehavior(delta);
        break;
      case 'flee':
        this.fleeBehavior(delta);
        break;
      case 'swarm':
        this.swarmBehavior(delta);
        break;
      case 'patrol':
        this.patrolBehavior(delta);
        break;
    }
  },
  
  huntBehavior: function(delta) {
    const targetPos = this.target.position.clone();
    const currentPos = this.entity.position;
    
    // Calculate distance to target
    const distanceToTarget = targetPos.distanceTo(currentPos);
    
    // Only hunt if within range
    if (distanceToTarget > this.data.huntingRange) {
      // Too far to hunt, switch to patrol
      if (this.currentBehavior !== 'patrol') {
        this.currentBehavior = 'patrol';
        this.onBehaviorChange();
      }
      return;
    }
    
    // Predict target's future position for interception
    const prediction = this.predictTargetPosition();
    
    // Calculate direction to predicted position
    this.targetDirection.subVectors(prediction, currentPos).normalize();
    
    // Turn towards target direction
    this.turn(this.targetDirection);
    
    // Accelerate to target speed
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * this.data.acceleration;
    
    // Move in current direction
    this.move(delta);
  },
  
  predictTargetPosition: function() {
    // Get target's current position and velocity
    const targetPos = this.target.position.clone();
    const targetVelocity = this.playerVelocity.clone();
    
    // Scale prediction based on distance - closer means less prediction needed
    const distance = targetPos.distanceTo(this.entity.position);
    const predictionScale = Math.min(1.0, distance / 30) * this.data.predictionFactor;
    
    // Add scaled velocity to current position to predict future position
    targetPos.add(targetVelocity.multiplyScalar(predictionScale));
    
    return targetPos;
  },
  
  fleeBehavior: function(delta) {
    const targetPos = this.target.position;
    const currentPos = this.entity.position;
    
    // Calculate distance to target
    const distanceToTarget = targetPos.distanceTo(currentPos);
    
    // If far enough away, switch to patrol
    if (distanceToTarget > this.data.huntingRange) {
      if (this.currentBehavior !== 'patrol') {
        this.currentBehavior = 'patrol';
        this.onBehaviorChange();
      }
      return;
    }
    
    // Calculate direction AWAY from target
    this.targetDirection.subVectors(currentPos, targetPos).normalize();
    
    // Add some randomness to prevent getting stuck
    this.targetDirection.x += (Math.random() - 0.5) * 0.2;
    this.targetDirection.z += (Math.random() - 0.5) * 0.2;
    this.targetDirection.normalize();
    
    // Turn away from target
    this.turn(this.targetDirection);
    
    // Faster speed when closer to target
    const speedFactor = Math.max(0.5, Math.min(1.5, 10 / distanceToTarget));
    this.currentSpeed = this.targetSpeed * speedFactor;
    
    // Move in current direction
    this.move(delta);
  },
  
  swarmBehavior: function(delta) {
    const targetPos = this.target.position;
    const currentPos = this.entity.position;
    
    // Calculate distance to target
    const distanceToTarget = targetPos.distanceTo(currentPos);
    
    // If too far away, switch to hunt to get closer
    if (distanceToTarget > this.data.huntingRange * 0.5) {
      if (this.currentBehavior !== 'hunt') {
        this.currentBehavior = 'hunt';
        this.onBehaviorChange();
      }
      return;
    }
    
    // Calculate ideal position around target (orbital motion)
    const time = Date.now() * 0.001; // Current time in seconds
    this.swarmAngle += 0.1 * delta; // Slowly rotate around target
    
    // Create orbit position
    const orbitRadius = this.data.swarmRadius;
    const orbitX = Math.cos(this.swarmAngle) * orbitRadius;
    const orbitZ = Math.sin(this.swarmAngle) * orbitRadius;
    
    // Add waviness to orbit
    const waveX = Math.sin(time * 2 + this.swarmPhase) * orbitRadius * 0.2;
    const waveZ = Math.cos(time * 2 + this.swarmPhase + 1) * orbitRadius * 0.2;
    
    // Calculate target position relative to player
    const targetOrbitPos = new THREE.Vector3(
      targetPos.x + orbitX + waveX,
      targetPos.y,
      targetPos.z + orbitZ + waveZ
    );
    
    // Direction to orbit position
    this.targetDirection.subVectors(targetOrbitPos, currentPos).normalize();
    
    // Turn towards orbit position
    this.turn(this.targetDirection);
    
    // Adjust speed based on distance to orbit position
    const distToOrbit = currentPos.distanceTo(targetOrbitPos);
    const speedFactor = Math.min(1.5, distToOrbit / orbitRadius);
    this.currentSpeed = this.targetSpeed * speedFactor;
    
    // Move in current direction
    this.move(delta);
  },
  
  patrolBehavior: function(delta) {
    const currentPos = this.entity.position;
    const targetPos = this.target.position;
    
    // Calculate distance to target
    const distanceToTarget = targetPos.distanceTo(currentPos);
    
    // If close enough to target and night time, switch to hunt
    if (distanceToTarget < this.data.huntingRange && this.isNightTime) {
      if (this.currentBehavior !== 'hunt') {
        this.currentBehavior = this.isNightTime ? 'hunt' : 'swarm';
        this.onBehaviorChange();
      }
      return;
    }
    
    // Slow meandering motion
    const time = Date.now() * 0.001;
    const noiseX = Math.sin(time * 0.3 + this.entity.position.x * 0.01) * 2;
    const noiseZ = Math.cos(time * 0.2 + this.entity.position.z * 0.01) * 2;
    
    this.targetDirection.set(noiseX, 0, noiseZ).normalize();
    
    // Turn towards patrol direction
    this.turn(this.targetDirection);
    
    // Move at patrol speed
    this.currentSpeed = this.targetSpeed * (0.7 + Math.sin(time) * 0.3);
    
    // Move in current direction
    this.move(delta);
  },
  
  randomizeBehavior: function() {
    // Don't change behavior if stuck - we need to work through that
    if (this.isStuck) return;
    
    // Distance to player will influence behavior choice
    const distToPlayer = this.entity.position.distanceTo(this.target.position);
    
    // Different behavior probabilities depending on distance and time of day
    let behaviors = [];
    let weights = [];
    
    if (this.isNightTime) {
      // Night time - more aggressive
      if (distToPlayer < this.data.huntingRange * 0.3) {
        // Close to player - high chance of hunt or swarm
        behaviors = ['hunt', 'swarm', 'patrol'];
        weights = [0.6, 0.3, 0.1];
      } else if (distToPlayer < this.data.huntingRange) {
        // Medium distance - balanced hunt and patrol
        behaviors = ['hunt', 'patrol', 'swarm'];
        weights = [0.5, 0.3, 0.2];
      } else {
        // Far away - mostly patrol with some hunt
        behaviors = ['patrol', 'hunt'];
        weights = [0.8, 0.2];
      }
    } else {
      // Day time - more passive
      if (distToPlayer < this.data.huntingRange * 0.3) {
        // Close to player - mix of behaviors, flee is possible
        behaviors = ['patrol', 'swarm', 'flee'];
        weights = [0.4, 0.3, 0.3];
      } else {
        // Further away - mostly patrol
        behaviors = ['patrol', 'swarm'];
        weights = [0.8, 0.2];
      }
    }
    
    // Select behavior based on weights
    const behavior = this.weightedRandom(behaviors, weights);
    
    // Only change if it's different
    if (behavior !== this.currentBehavior) {
      this.currentBehavior = behavior;
      this.onBehaviorChange();
    }
  },
  
  weightedRandom: function(items, weights) {
    // Weighted random selection
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      if (random < weights[i]) {
        return items[i];
      }
      random -= weights[i];
    }
    
    return items[0]; // Fallback
  },
  
  turn: function(direction) {
    // Calculate desired yaw angle
    const targetYaw = Math.atan2(direction.x, direction.z);
    
    // Smoothly interpolate current rotation towards target
    let angleDiff = targetYaw - this.entity.rotation.y;
    
    // Normalize angle difference to [-π, π]
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    // Apply turn with speed factor
    this.entity.rotation.y += angleDiff * this.data.turnSpeed;
    
    // Store for next frame
    this.targetRotationY = targetYaw;
  },
  
  move: function(delta) {
    // Calculate movement vector
    const moveX = Math.sin(this.entity.rotation.y) * this.currentSpeed * delta;
    const moveZ = Math.cos(this.entity.rotation.y) * this.currentSpeed * delta;
    
    // Apply movement
    this.entity.position.x += moveX;
    this.entity.position.z += moveZ;
  },
  
  checkIfStuck: function() {
    const currentPos = this.entity.position;
    const distMoved = currentPos.distanceTo(this.stuckCheckPosition);
    
    // If barely moved and should be moving, might be stuck
    if (distMoved < 0.2 && this.currentSpeed > 0.5) {
      this.stuckTimer++;
      
      // After a few checks, consider stuck
      if (this.stuckTimer > 3) {
        this.isStuck = true;
        this.handleStuckState();
      }
    } else {
      this.stuckTimer = 0;
      this.isStuck = false;
    }
    
    // Update position for next check
    this.stuckCheckPosition.copy(currentPos);
  },
  
  handleStuckState: function() {
    // Add some randomness to get unstuck
    this.entity.rotation.y += (Math.random() - 0.5) * Math.PI;
    
    // Boost speed briefly to escape
    this.currentSpeed = this.targetSpeed * 1.5;
    
    // After a short time, reset stuck status
    setTimeout(() => {
      this.isStuck = false;
      this.stuckTimer = 0;
    }, 2000);
  },
  
  getTerrainHeight: function(x, z) {
    // Use global terrain height function
    if (typeof getTerrainHeight === 'function') {
      return getTerrainHeight(x, z);
    }
    // Fallback
    return 0;
  },
  
  setNightMode: function(isNight) {
    this.isNightTime = isNight;
    
    // Increase speed at night
    if (isNight) {
      this.targetSpeed = this.data.speed * this.data.nightBoost;
      
      // More likely to hunt at night
      if (Math.random() < 0.7) {
        this.currentBehavior = 'hunt';
        this.onBehaviorChange();
      }
    } else {
      this.targetSpeed = this.data.speed;
      
      // More likely to patrol during day
      if (Math.random() < 0.6) {
        this.currentBehavior = 'patrol';
        this.onBehaviorChange();
      }
    }
  },
  
  createDebugVisualization: function() {
    // Create debug elements
    const debugEntity = document.createElement('a-entity');
    debugEntity.setAttribute('position', '0 2 0');
    
    // Add text for debug info
    this.debugText = document.createElement('a-text');
    this.debugText.setAttribute('value', 'Debug');
    this.debugText.setAttribute('align', 'center');
    this.debugText.setAttribute('scale', '2 2 2');
    this.debugText.setAttribute('billboard', '');
    
    // Add line to show direction
    this.debugLine = document.createElement('a-entity');
    this.debugLine.setAttribute('line', {
      start: {x: 0, y: 0, z: 0},
      end: {x: 0, y: 0, z: -3},
      color: 'red'
    });
    
    // Add to debug entity
    debugEntity.appendChild(this.debugText);
    debugEntity.appendChild(this.debugLine);
    
    // Add to main entity
    this.el.appendChild(debugEntity);
    this.debugEntity = debugEntity.object3D;
    
    this.updateDebugText();
  },
  
  updateDebugText: function() {
    if (!this.debugText) return;
    
    const behavior = this.currentBehavior.charAt(0).toUpperCase() + this.currentBehavior.slice(1);
    const speed = this.currentSpeed.toFixed(1);
    const text = `${behavior}\nSpeed: ${speed}\n${this.isNightTime ? 'Night' : 'Day'}`;
    
    this.debugText.setAttribute('value', text);
  },
  
  updateDebugVisualization: function() {
    if (!this.debugEntity || !this.debugText) return;
    
    // Update text
    this.updateDebugText();
    
    // Update direction line
    const direction = new THREE.Vector3(0, 0, -3);
    direction.applyQuaternion(this.entity.quaternion);
    
    this.debugLine.setAttribute('line', {
      start: {x: 0, y: 0, z: 0},
      end: {x: direction.x, y: direction.y, z: direction.z},
      color: this.isStuck ? 'yellow' : (this.currentBehavior === 'hunt' ? 'red' : 'blue')
    });
  }
});
