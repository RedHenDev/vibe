// Night Chase Component for Eigengrau Light
// Makes nocturnal NPCs extra aggressive during night time

AFRAME.registerComponent('night-chase', {
  schema: {
    enabled: { type: 'boolean', default: true },
    speedBoost: { type: 'number', default: 2.5 },     // Speed multiplier at night
    huntRange: { type: 'number', default: 150 },      // Max distance to detect player at night
    maxSpeed: { type: 'number', default: 18 },        // Speed cap even with boosts
    stunDuration: { type: 'number', default: 100 },   // How long NPCs are stunned by light in ms
    flashlightProtection: { type: 'boolean', default: true }, // Player torch deters NPCs
    visualEffect: { type: 'boolean', default: true }  // Show visual effect when chasing
  },
  
  init: function() {
    // Get dependencies
    this.ai = this.el.components['enhanced-ai'] || this.el.components['ai-locomotion'];
    
    if (!this.ai) {
      console.warn('night-chase requires enhanced-ai or ai-locomotion component');
      return;
    }
    
    // State
    this.isNight = false;
    this.isChasing = false;
    this.isStunned = false;
    this.stunTimeout = null;
    this.originalSpeed = this.getSpeed();
    this.originalBehavior = this.getBehavior();
    this.lastPlayerPos = new THREE.Vector3();
    this.detectionCount = 0;
    
    // Create visual effect
    if (this.data.visualEffect) {
      this.createVisualEffect();
    }
    
    // Player reference
    this.player = document.querySelector('#player');
    
    // Check for day-night cycle
    this.connectToDayNightCycle();
    
    // Check for player torch
    this.connectToPlayerTorch();
  },
  
  connectToDayNightCycle: function() {
    const cycleEntity = document.querySelector('#day-night-cycle');
    if (cycleEntity && cycleEntity.components['day-night-cycle']) {
      this.dayNightCycle = cycleEntity.components['day-night-cycle'];
      
      // Set initial night state
      this.isNight = this.dayNightCycle.isNight;
      this.updateNightState();
      
      console.log(`night-chase: Connected to day-night cycle, isNight: ${this.isNight}`);
    } else {
      // Try again later
      setTimeout(() => this.connectToDayNightCycle(), 1000);
    }
  },
  
  connectToPlayerTorch: function() {
    const torchEntity = document.querySelector('#player-torch-system');
    if (torchEntity && torchEntity.components['player-torch']) {
      this.playerTorch = torchEntity.components['player-torch'];
      console.log('night-chase: Connected to player torch');
    }
  },
  
  update: function(oldData) {
    // Handle changes to component data
    if (oldData.enabled !== undefined && oldData.enabled !== this.data.enabled) {
      this.updateNightState();
    }
  },
  
  tick: function(time, delta) {
    if (!this.data.enabled || !this.isNight || !this.player || !delta) return;
    
    // Skip processing if stunned
    if (this.isStunned) return;
    
    // Check if night time and AI is alive
    if (this.isNight && this.ai) {
      const playerPos = this.player.object3D.position;
      const npcPos = this.el.object3D.position;
      
      // Calculate distance to player
      const distance = playerPos.distanceTo(npcPos);
      
      if (distance <= this.data.huntRange) {
        // Player is in range - check if there's a line of sight
        const hasLineOfSight = this.checkLineOfSight(npcPos, playerPos);
        
        if (hasLineOfSight) {
          this.detectionCount++;
          
          // Only trigger chase after multiple successful detections
          // (prevents immediately chasing through walls)
          if (this.detectionCount >= 3) {
            if (!this.isChasing) {
              this.startChasing();
            }
            
            // Check if player is using torch for protection
            if (this.data.flashlightProtection) {
              this.checkTorchProtection(npcPos, playerPos);
            }
          }
        } else {
          // Reduce detection count on lost sight but don't immediately stop chasing
          this.detectionCount = Math.max(0, this.detectionCount - 1);
          
          // Only stop chase after sustained loss of detection
          if (this.isChasing && this.detectionCount === 0) {
            this.stopChasing();
          }
        }
      } else {
        // Player out of range
        this.detectionCount = 0;
        if (this.isChasing) {
          this.stopChasing();
        }
      }
      
      // Store player position for next frame
      this.lastPlayerPos.copy(playerPos);
      
      // Update visual effect
      if (this.visualEffect) {
        this.updateVisualEffect();
      }
    }
  },
  
  checkLineOfSight: function(fromPos, toPos) {
    // Simple line of sight check using raycasting
    const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
    const distance = fromPos.distanceTo(toPos);
    
    // Create raycaster
    const raycaster = new THREE.Raycaster(fromPos, direction, 0, distance);
    
    // Cast ray against scene objects
    // In a simplified implementation, we'll consider line of sight always valid
    // because proper raycasting would require scene hierarchies we don't have full access to
    
    // More advanced implementation: create a simplified raycasting check
    // This could check against known terrain or obstacle elements
    
    // For now, use distance-based probability - closer = more likely to detect
    const detectionProbability = Math.min(1.0, 1.0 - (distance / this.data.huntRange));
    return Math.random() < detectionProbability;
  },
  
  checkTorchProtection: function(npcPos, playerPos) {
    // Check if player's torch is active and pointing at the NPC
    if (!this.playerTorch || !this.playerTorch.isActive) return;
    
    // Get camera direction
    const camera = document.querySelector('#cam');
    if (!camera) return;
    
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.object3D.quaternion);
    
    // Calculate vector from player to NPC
    const toNPC = new THREE.Vector3().subVectors(npcPos, playerPos).normalize();
    
    // Calculate dot product to determine if NPC is in front of player
    const dotProduct = cameraDirection.dot(toNPC);
    
    // If dot product is positive, NPC is in front of player
    if (dotProduct > 0.7) { // Narrower angle for torch beam
      // Calculate distance
      const distance = playerPos.distanceTo(npcPos);
      
      // Effect is stronger at closer range
      if (distance < 20) {
        // Stun the NPC
        this.stunNPC();
      }
    }
  },
  
  stunNPC: function() {
    if (this.isStunned) return;
    
    this.isStunned = true;
    
    // Temporarily stop the NPC
    if (this.ai) {
      // Store current speed
      this.stunSpeed = this.getSpeed();
      
      // Set speed to 0
      this.setSpeed(0);
    }
    
    // Clear any existing timeout
    if (this.stunTimeout) {
      clearTimeout(this.stunTimeout);
    }
    
    // Set timeout to restore movement
    this.stunTimeout = setTimeout(() => {
      this.isStunned = false;
      
      // Restore speed
      if (this.ai) {
        this.setSpeed(this.stunSpeed);
      }
    }, this.data.stunDuration);
    
    // Create stunning effect
    if (this.data.visualEffect) {
      this.createStunEffect();
    }
  },
  
  startChasing: function() {
    if (this.isChasing) return;
    
    this.isChasing = true;
    
    // Boost speed
    this.boostSpeed();
    
    // Set behavior based on AI type
    if (this.ai) {
      // For enhanced AI
      if (this.ai.componentName === 'enhanced-ai') {
        this.ai.currentBehavior = 'hunt';
        this.ai.onBehaviorChange();
      } 
      // For legacy AI
      else if (this.setSpeed) {
        // For legacy AI, just boost speed
        this.setSpeed(this.originalSpeed * this.data.speedBoost);
      }
    }
    
    // Show visual effect
    if (this.visualEffect) {
      this.visualEffect.setAttribute('visible', true);
    }
    
    // Log for debugging
    console.log(`NPC ${this.el.id} started chasing at night!`);
  },
  
  stopChasing: function() {
    if (!this.isChasing) return;
    
    this.isChasing = false;
    this.detectionCount = 0;
    
    // Restore normal behavior
    this.restoreSpeed();
    
    // Reset behavior
    if (this.ai && this.ai.componentName === 'enhanced-ai') {
      this.ai.currentBehavior = this.originalBehavior;
      this.ai.onBehaviorChange();
    }
    
    // Hide visual effect
    if (this.visualEffect) {
      this.visualEffect.setAttribute('visible', false);
    }
  },
  
  boostSpeed: function() {
    // Get the original speed from the AI component
    this.originalSpeed = this.getSpeed();
    
    // Apply night boost to speed
    const boostedSpeed = this.originalSpeed * this.data.speedBoost;
    
    // Cap at max speed
    const newSpeed = Math.min(boostedSpeed, this.data.maxSpeed);
    
    // Set the new speed
    this.setSpeed(newSpeed);
  },
  
  restoreSpeed: function() {
    // Restore original speed
    this.setSpeed(this.originalSpeed);
  },
  
  getSpeed: function() {
    // Get speed from AI component
    if (!this.ai) return 0;
    
    if (this.ai.componentName === 'enhanced-ai') {
      return this.ai.data.speed;
    } else if (this.ai.componentName === 'ai-locomotion') {
      return this.ai.data.speed;
    } else if (this.ai.componentName === 'ai-loco-legacy') {
      return this.ai.data.speed;
    }
    
    return 0;
  },
  
  setSpeed: function(speed) {
    // Set speed in AI component
    if (!this.ai) return;
    
    if (this.ai.componentName === 'enhanced-ai') {
      this.ai.targetSpeed = speed;
    } else if (this.ai.componentName === 'ai-locomotion') {
      this.ai.data.speed = speed;
    } else if (this.ai.componentName === 'ai-loco-legacy') {
      this.ai.data.speed = speed;
    }
  },
  
  getBehavior: function() {
    // Get behavior from enhanced AI
    if (this.ai && this.ai.componentName === 'enhanced-ai') {
      return this.ai.currentBehavior || 'patrol';
    }
    
    return 'patrol'; // Default
  },
  
  createVisualEffect: function() {
    // Create visual effect for night chasing
    this.visualEffect = document.createElement('a-entity');
    this.visualEffect.setAttribute('position', '0 3 0');
    
    // Create a glowing eye effect
    this.visualEffect.setAttribute('geometry', {
      primitive: 'sphere',
      radius: 0.5
    });
    
    this.visualEffect.setAttribute('material', {
      color: '#FF0000',
      emissive: '#FF0000',
      emissiveIntensity: 0.8,
      opacity: 0.7,
      transparent: true
    });
    
    // Add pulsing animation
    this.visualEffect.setAttribute('animation', {
      property: 'material.emissiveIntensity',
      from: 0.5,
      to: 1.0,
      dur: 500,
      dir: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    });
    
    // Hide initially
    this.visualEffect.setAttribute('visible', false);
    
    this.el.appendChild(this.visualEffect);
  },
  
  createStunEffect: function() {
    // Create visual effect for being stunned
    const stunEffect = document.createElement('a-entity');
    stunEffect.setAttribute('position', '0 3 0');
    
    // Create a flash effect
    stunEffect.setAttribute('geometry', {
      primitive: 'sphere',
      radius: 0.8
    });
    
    stunEffect.setAttribute('material', {
      color: '#FFFFFF',
      emissive: '#FFFFFF',
      emissiveIntensity: 1.0,
      opacity: 0.9,
      transparent: true
    });
    
    // Add quick pulse animation
    stunEffect.setAttribute('animation', {
      property: 'scale',
      from: '1 1 1',
      to: '2 2 2',
      dur: 300,
      easing: 'easeOutQuad'
    });
    
    stunEffect.setAttribute('animation__fade', {
      property: 'material.opacity',
      from: 0.9,
      to: 0.0,
      dur: 300,
      easing: 'easeOutQuad'
    });
    
    // Add to entity and remove after animation
    this.el.appendChild(stunEffect);
    setTimeout(() => {
      if (stunEffect.parentNode) {
        stunEffect.parentNode.removeChild(stunEffect);
      }
    }, 400);
  },
  
  updateVisualEffect: function() {
    if (!this.visualEffect) return;
    
    // Update effect intensity based on chase state
    if (this.isChasing) {
      this.visualEffect.setAttribute('material', {
        emissiveIntensity: 0.8 + Math.sin(Date.now() * 0.01) * 0.2
      });
    }
  },
  
  updateNightState: function() {
    if (!this.data.enabled) return;
    
    // Check for day-night cycle component
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      this.isNight = dayNightCycle.components['day-night-cycle'].isNight;
    }
    
    if (this.isNight) {
      // Night time - enable extra aggression
      // Don't start chasing immediately - wait for player detection
      console.log(`NPC ${this.el.id} night-chase enabled`);
      
      // If already chasing, ensure correct behavior
      if (this.isChasing) {
        this.boostSpeed();
      }
    } else {
      // Day time - disable chase behavior
      if (this.isChasing) {
        this.stopChasing();
      }
      
      // Restore to original state
      this.restoreSpeed();
      
      console.log(`NPC ${this.el.id} night-chase disabled (daytime)`);
    }
  },
  
  remove: function() {
    // Clean up
    if (this.stunTimeout) {
      clearTimeout(this.stunTimeout);
    }
    
    if (this.visualEffect && this.visualEffect.parentNode) {
      this.visualEffect.parentNode.removeChild(this.visualEffect);
    }
    
    // Restore original speed
    this.restoreSpeed();
  }
});
