// Night Chase System for Eigengrau Light
// Makes nocturnal NPCs more aggressive and coordinated during nighttime
// Add to your HTML with: <script src="night-chase.js"></script>

// Adds event listener to ensure script runs after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Night Chase system initializing...');
  
  // Find scene and wait for it to load
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      // Register configurator entity that applies night-chase to nocturnal NPCs
      const nightChaseEntity = document.createElement('a-entity');
      nightChaseEntity.setAttribute('id', 'night-chase-system');
      nightChaseEntity.setAttribute('night-chase-manager', '');
      scene.appendChild(nightChaseEntity);
      console.log('Night Chase system registered');
    });
  }
});

// Main component that gets attached to nocturnal NPCs
AFRAME.registerComponent('night-chase', {
  schema: {
    enabled: {type: 'boolean', default: true},
    speedMultiplier: {type: 'number', default: 2.5},      // How much faster NPCs move at night
    detectionRange: {type: 'number', default: 160},       // How far NPCs can detect the player
    huntAcceleration: {type: 'number', default: 2.0},     // Acceleration when chasing player
    swarmRotationRate: {type: 'number', default: 0.5},    // How quickly NPCs swarm around player
    maxSwarmSpeed: {type: 'number', default: 20},         // Maximum speed when swarming
    alertRange: {type: 'number', default: 80},            // How far NPCs alert other NPCs
    directionChangeFactor: {type: 'number', default: 3},  // How quickly NPCs can change direction
    minDistanceToPlayer: {type: 'number', default: 1.5},   // Minimum distance to maintain from player
    visionConeAngle: {type: 'number', default: 120}       // Field of view for detecting player (degrees)
  },
  
  init: function() {
    // Store references to important components
    this.aiComponent = this.el.components['ai-locomotion'];
    if (!this.aiComponent) {
      console.warn('night-chase requires ai-locomotion component');
      return;
    }
    
    // Store original AI settings to restore during daytime
    this.originalSettings = {
      speed: this.aiComponent.data.speed,
      rSpeed: this.aiComponent.data.rSpeed,
      updateInterval: this.aiComponent.data.updateInterval || 1,
      turnRate: this.aiComponent.data.turnRate || 0.05
    };
    
    // Get player reference
    this.player = document.querySelector('#player').object3D;
    if (!this.player) {
      console.warn('Could not find player object');
      return;
    }
    
    // Create visual indicator for hunting state
    this.createHuntingIndicator();
    
    // Connect to day-night cycle
    this.connectToDayNightCycle();
    
    // State tracking
    this.isHunting = false;
    this.isNight = false;
    this.playerLastPosition = new THREE.Vector3();
    this.playerVelocity = new THREE.Vector3();
    this.lastUpdateTime = 0;
    this.swarmOffsetAngle = Math.random() * Math.PI * 2; // Unique per NPC
    this.alertLevel = 0; // 0-1 range for how alerted the NPC is
    
    // Enable visual debugging
    this.visualDebug = false;
  },
  
  createHuntingIndicator: function() {
    // Visual indicator that appears when hunting (glowing eyes effect)
    const indicator = document.createElement('a-entity');
    indicator.setAttribute('position', '0 2 0');
    
    // Create glowing eyes
    const leftEye = document.createElement('a-sphere');
    leftEye.setAttribute('position', '-0.4 0 0.6');
    leftEye.setAttribute('radius', '0.15');
    leftEye.setAttribute('material', 'color: #FF0000; emissive: #FF0000; emissiveIntensity: 1.0');
    
    const rightEye = document.createElement('a-sphere');
    rightEye.setAttribute('position', '0.4 0 0.6');
    rightEye.setAttribute('radius', '0.15');
    rightEye.setAttribute('material', 'color: #FF0000; emissive: #FF0000; emissiveIntensity: 1.0');
    
    // Add eyes to indicator
    indicator.appendChild(leftEye);
    indicator.appendChild(rightEye);
    
    // Add pulsing animation
    indicator.setAttribute('animation__pulse', {
      property: 'scale',
      from: '1 1 1',
      to: '1.1 1.1 1.1',
      dur: 500,
      dir: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    });
    
    // Hide initially
    indicator.setAttribute('visible', false);
    
    // Add to entity
    this.el.appendChild(indicator);
    this.huntingIndicator = indicator;
  },
  
  connectToDayNightCycle: function() {
    // Find the day-night-cycle component
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
      this.isNight = this.dayNightCycle.isNight;
      
      // Apply night mode immediately if it's already night
      if (this.isNight) {
        this.onNightStart();
      }
    } else {
      // Keep trying until we find it
      setTimeout(() => this.connectToDayNightCycle(), 1000);
    }
  },
  
  tick: function(time, delta) {
    if (!this.data.enabled || !this.aiComponent || !delta) return;
    
    // Update night state if day-night cycle is available
    if (this.dayNightCycle && this.isNight !== this.dayNightCycle.isNight) {
      this.isNight = this.dayNightCycle.isNight;
      if (this.isNight) {
        this.onNightStart();
      } else {
        this.onDayStart();
      }
    }
    
    // Skip processing if it's daytime
    if (!this.isNight) return;
    
    // Calculate time delta in seconds
    const dt = delta / 1000;
    
    // Update player velocity tracking (for prediction)
    if (time - this.lastUpdateTime > 100) { // Every 100ms
      this.updatePlayerVelocity(time);
      this.lastUpdateTime = time;
    }
    
    // Check if player is within detection range
    const distanceToPlayer = this.getDistanceToPlayer();
    const inDetectionRange = distanceToPlayer < this.data.detectionRange;
    
    // Calculate awareness based on distance and visibility
    this.updateAwareness(distanceToPlayer, dt);
    
    // Main state machine for chase behavior
    if (inDetectionRange) {
      if (!this.isHunting && this.alertLevel > 0.5) {
        this.startHunting(); // Begin hunting if alerted enough
      }
    } else if (this.isHunting) {
      this.alertLevel -= dt * 0.1; // Gradually lose interest
      if (this.alertLevel < 0.2) {
        this.stopHunting(); // Stop hunting if lost track of player
      }
    }
    
    // Update chase behavior when hunting
    if (this.isHunting) {
      this.updateHunting(dt, distanceToPlayer);
    }
  },
  
  updateAwareness: function(distanceToPlayer, dt) {
    // How quickly the NPC becomes aware of the player
    const awarenessFactor = this.isInNPCFieldOfView() ? 1.0 : 0.3;
    
    // Increase awareness based on distance
    if (distanceToPlayer < this.data.detectionRange) {
      // Closer = faster awareness increase
      const distanceFactor = 1.0 - (distanceToPlayer / this.data.detectionRange);
      this.alertLevel += dt * distanceFactor * awarenessFactor;
      
      // Check if any other alerted NPCs are nearby
      this.checkForAlertingNPCs();
    } else {
      // Decrease awareness when player is out of range
      this.alertLevel -= dt * 0.2;
    }
    
    // Clamp alert level between 0 and 1
    this.alertLevel = Math.max(0, Math.min(1, this.alertLevel));
    
    // Update visual indicator based on alert level
    this.updateHuntingIndicator();
  },
  
  isInNPCFieldOfView: function() {
    // Check if player is within the NPC's vision cone
    if (!this.player) return false;
    
    const npcPosition = this.el.object3D.position;
    const playerPosition = this.player.position;
    
    // Get NPC's forward direction
    const npcForward = new THREE.Vector3(0, 0, -1);
    npcForward.applyQuaternion(this.el.object3D.quaternion);
    
    // Get direction to player
    const toPlayer = new THREE.Vector3();
    toPlayer.subVectors(playerPosition, npcPosition).normalize();
    
    // Calculate angle between NPC forward and direction to player
    const angle = Math.acos(npcForward.dot(toPlayer)) * (180 / Math.PI);
    
    // Return true if player is within vision cone angle
    return angle < (this.data.visionConeAngle / 2);
  },
  
  checkForAlertingNPCs: function() {
    // Find all NPCs with night-chase component
    const npcs = document.querySelectorAll('[night-chase]');
    const npcPosition = this.el.object3D.position;
    
    // Check each NPC to see if they're alerted and within alert range
    for (let i = 0; i < npcs.length; i++) {
      const otherNPC = npcs[i];
      if (otherNPC === this.el) continue; // Skip self
      
      const otherComponent = otherNPC.components['night-chase'];
      if (!otherComponent || !otherComponent.isHunting) continue;
      
      // Calculate distance
      const otherPosition = otherNPC.object3D.position;
      const dx = npcPosition.x - otherPosition.x;
      const dy = npcPosition.y - otherPosition.y;
      const dz = npcPosition.z - otherPosition.z;
      const distSquared = dx*dx + dy*dy + dz*dz;
      
      // If within alert range and other NPC is hunting, get alerted too
      if (distSquared < this.data.alertRange * this.data.alertRange) {
        this.alertLevel += 0.2; // Significant boost to alert level
        break; // Only need one alerted NPC to alert this one
      }
    }
  },
  
  updatePlayerVelocity: function(time) {
    if (!this.player) return;
    
    // Calculate player velocity for prediction
    const playerPosition = this.player.position.clone();
    const dt = (time - this.lastUpdateTime) / 1000;
    
    if (dt > 0 && this.playerLastPosition) {
      // Calculate current velocity
      this.playerVelocity.subVectors(playerPosition, this.playerLastPosition).divideScalar(dt);
    }
    
    // Store current position for next update
    this.playerLastPosition.copy(playerPosition);
  },
  
  updateHunting: function(dt, distanceToPlayer) {
    // Don't override velocity if we're already processing a collision
    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= dt;
      return;
    }
    
    // Predict player's future position based on velocity
    const predictedPosition = this.calculatePredictedPosition();
    
    // Adjust speed based on distance to player - faster when far, slower when close
    let speedFactor;
    if (distanceToPlayer > 20) {
      // Far away - maximum speed to catch up
      speedFactor = this.data.speedMultiplier;
    } else if (distanceToPlayer > 5) {
      // Moderate distance - still fast but not maximum
      speedFactor = this.data.speedMultiplier * 0.8;
    } else {
      // Close - slower to maintain distance and swarm
      speedFactor = this.data.speedMultiplier * 0.6;
    }
    
    // Apply speed to AI component
    this.aiComponent.data.speed = this.originalSettings.speed * speedFactor;
    
    // Engage swarm behavior when multiple NPCs are near player
    this.updateSwarmBehavior(predictedPosition, distanceToPlayer);
    
    // Make sure the NPC is visible and active
    this.aiComponent.data.active = true;
    this.el.object3D.visible = true;
  },
  
  calculatePredictedPosition: function() {
    // Calculate where player will be in the near future
    const predictedPosition = this.player.position.clone();
    
    // Add velocity component (look ahead by 0.5 seconds)
    const lookAheadTime = 0.5;
    predictedPosition.addScaledVector(this.playerVelocity, lookAheadTime);
    
    return predictedPosition;
  },
  
  updateSwarmBehavior: function(targetPosition, distanceToPlayer) {
    // Check if we should engage swarm behavior (close to player)
    if (distanceToPlayer < 20) {
      // Count nearby NPCs to adjust swarm behavior
      const nearbyNPCs = this.countNearbyNPCs();
      
      if (nearbyNPCs > 1) {
        // Multiple NPCs detected, engage swarm behavior
        this.applySwarmOffset(targetPosition, nearbyNPCs);
      }
    }
  },
  
  countNearbyNPCs: function() {
    // Count how many NPCs are near the player to coordinate swarming
    const npcs = document.querySelectorAll('[night-chase]');
    const playerPosition = this.player.position;
    let count = 0;
    
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      const component = npc.components['night-chase'];
      
      if (component && component.isHunting) {
        const npcPosition = npc.object3D.position;
        const dx = npcPosition.x - playerPosition.x;
        const dy = npcPosition.y - playerPosition.y;
        const dz = npcPosition.z - playerPosition.z;
        const distSquared = dx*dx + dy*dy + dz*dz;
        
        if (distSquared < 20*20) { // 20-unit radius
          count++;
        }
      }
    }
    
    return count;
  },
  
  applySwarmOffset: function(targetPosition, nearbyNPCs) {
    // Calculate a unique position around the player based on this NPC's ID
    // This causes NPCs to surround the player instead of all targeting the same spot
    
    // Update swarm angle over time for dynamic movement
    this.swarmOffsetAngle += this.data.swarmRotationRate * 0.01;
    
    // Calculate offset based on angle and distance
    const offsetDistance = Math.max(this.data.minDistanceToPlayer, 2 + (nearbyNPCs * 0.5));
    const offsetX = Math.cos(this.swarmOffsetAngle) * offsetDistance;
    const offsetZ = Math.sin(this.swarmOffsetAngle) * offsetDistance;
    
    // Apply offset to target position
    targetPosition.x += offsetX;
    targetPosition.z += offsetZ;
    
    // If aiComponent has target position, update it
    if (this.aiComponent.targetPosition) {
      this.aiComponent.targetPosition.copy(targetPosition);
    }
    
    // Visualize swarm positions in debug mode
    if (this.visualDebug) {
      this.visualizeSwarmPosition(targetPosition);
    }
  },
  
  visualizeSwarmPosition: function(position) {
    // For debugging - create a visible marker at the target position
    if (!this.debugMarker) {
      this.debugMarker = document.createElement('a-sphere');
      this.debugMarker.setAttribute('radius', '0.5');
      this.debugMarker.setAttribute('color', '#FF00FF');
      this.debugMarker.setAttribute('opacity', '0.5');
      document.querySelector('a-scene').appendChild(this.debugMarker);
    }
    
    this.debugMarker.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
  },
  
  getDistanceToPlayer: function() {
    if (!this.player) return Infinity;
    
    const npcPosition = this.el.object3D.position;
    const playerPosition = this.player.position;
    
    const dx = npcPosition.x - playerPosition.x;
    const dy = npcPosition.y - playerPosition.y;
    const dz = npcPosition.z - playerPosition.z;
    
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  },
  
  startHunting: function() {
    if (this.isHunting) return;
    
    this.isHunting = true;
    
    // Drastically increase speed and responsiveness
    this.aiComponent.data.speed = this.originalSettings.speed * this.data.speedMultiplier;
    this.aiComponent.data.rSpeed = this.originalSettings.rSpeed * this.data.directionChangeFactor;
    this.aiComponent.data.updateInterval = 1; // Update every frame
    
    // Increase turn rate for more aggressive pursuit
    if (this.aiComponent.data.turnRate !== undefined) {
      this.aiComponent.data.turnRate = 0.2; // More aggressive turning
    }
    
    // Show hunting indicator
    if (this.huntingIndicator) {
      this.huntingIndicator.setAttribute('visible', true);
    }
    
    // Create unique swarm offset for this NPC
    this.swarmOffsetAngle = Math.random() * Math.PI * 2;
    
    // Add randomized modifiers for varied behavior
    this.uniqueSpeedModifier = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    
    // Debug logging
    // console.log(`NPC ${this.el.id} started hunting with speed ${this.aiComponent.data.speed}`);
  },
  
  stopHunting: function() {
    if (!this.isHunting) return;
    
    this.isHunting = false;
    this.alertLevel = 0;
    
    // Restore original settings
    this.aiComponent.data.speed = this.originalSettings.speed;
    this.aiComponent.data.rSpeed = this.originalSettings.rSpeed;
    this.aiComponent.data.updateInterval = this.originalSettings.updateInterval;
    
    if (this.aiComponent.data.turnRate !== undefined) {
      this.aiComponent.data.turnRate = this.originalSettings.turnRate;
    }
    
    // Hide hunting indicator
    if (this.huntingIndicator) {
      this.huntingIndicator.setAttribute('visible', false);
    }
    
    // Debug logging
    // console.log(`NPC ${this.el.id} stopped hunting`);
  },
  
  updateHuntingIndicator: function() {
    // Update hunting indicator based on alert level
    if (!this.huntingIndicator) return;
    
    if (this.alertLevel > 0.5) {
      // Fully alerted
      this.huntingIndicator.setAttribute('visible', true);
      // Scale intensity with alert level
      const intensity = 0.5 + this.alertLevel * 0.5;
      
      // Get eye elements
      const leftEye = this.huntingIndicator.querySelector('a-sphere[position^="-0.4"]');
      const rightEye = this.huntingIndicator.querySelector('a-sphere[position^="0.4"]');
      
      if (leftEye && rightEye) {
        leftEye.setAttribute('material', `emissiveIntensity: ${intensity}`);
        rightEye.setAttribute('material', `emissiveIntensity: ${intensity}`);
      }
    } else if (this.alertLevel > 0.2) {
      // Partially alerted - blinking effect
      const blinkRate = Math.sin(Date.now() * 0.01) > 0;
      this.huntingIndicator.setAttribute('visible', blinkRate);
    } else {
      // Not alerted
      this.huntingIndicator.setAttribute('visible', false);
    }
  },
  
  onNightStart: function() {
    // Immediately boost aggression when night falls
    this.alertLevel = 0.3; // Start partially alerted
    
    // Increase detection range
    this.data.detectionRange *= 1.2;
    
    // Update settings even when not actively hunting
    this.aiComponent.data.speed = this.originalSettings.speed * 1.5;
    this.aiComponent.data.rSpeed = this.originalSettings.rSpeed * 1.2;
    
    // Debug logging
    // console.log(`NPC ${this.el.id} activated night mode`);
  },
  
  onDayStart: function() {
    // Stop hunting behavior when day starts
    this.stopHunting();
    
    // Reset detection range
    this.data.detectionRange /= 1.2;
    
    // Reset to original settings
    this.aiComponent.data.speed = this.originalSettings.speed;
    this.aiComponent.data.rSpeed = this.originalSettings.rSpeed;
    
    // Debug logging
    // console.log(`NPC ${this.el.id} deactivated night mode`);
  },
  
  remove: function() {
    // Clean up
    if (this.huntingIndicator) {
      this.el.removeChild(this.huntingIndicator);
    }
    
    if (this.debugMarker && this.debugMarker.parentNode) {
      this.debugMarker.parentNode.removeChild(this.debugMarker);
    }
  }
});

// A manager component that applies night-chase to all nocturnal NPCs
AFRAME.registerComponent('night-chase-manager', {
  schema: {
    enabled: {type: 'boolean', default: true}
  },
  
  init: function() {
    if (!this.data.enabled) return;
    
    // Delay initialization slightly to ensure other systems are loaded
    setTimeout(() => this.initialize(), 1000);
  },
  
  initialize: function() {
    console.log('Night Chase Manager initializing...');
    
    // Apply night-chase component to all nocturnal NPCs
    this.applyToExistingNPCs();
    
    // Set up observer to apply to newly spawned NPCs
    this.setupObserver();
    
    // Connect to day-night cycle
    this.connectToDayNightCycle();
    
    // Register with NPC manager if available
    this.registerWithNpcManager();
    
    console.log('Night Chase Manager initialized');
  },
  
  applyToExistingNPCs: function() {
    // Find all nocturnal NPCs
    const npcs = document.querySelectorAll('[data-nocturnal="true"], [id*="night"], [gltf-model="#mGlasst"], [gltf-model="#mCublit"]');
    
    npcs.forEach(npc => {
      // Skip if already has the component
      if (npc.hasAttribute('night-chase')) return;
      
      // Apply night-chase component with appropriate settings based on NPC type
      if (npc.getAttribute('gltf-model') === '#mCublit') {
        // Special settings for Cublit (extra fast and aggressive)
        npc.setAttribute('night-chase', {
          speedMultiplier: 2.8,
          huntAcceleration: 2.5,
          maxSwarmSpeed: 22,
          detectionRange: 180
        });
      } else if (npc.getAttribute('gltf-model') === '#mGlasst') {
        // Moderate settings for Glass Tooth
        npc.setAttribute('night-chase', {
          speedMultiplier: 2.2,
          huntAcceleration: 1.8,
          detectionRange: 150
        });
      } else {
        // Default settings for other nocturnal NPCs
        npc.setAttribute('night-chase', '');
      }
      
      console.log(`Applied night-chase to NPC: ${npc.id || 'unnamed'}`);
    });
    
    console.log(`Applied night-chase to ${npcs.length} existing NPCs`);
  },
  
  setupObserver: function() {
    // Set up mutation observer to automatically apply night-chase to new NPCs
    const npcsContainer = document.querySelector('#npcs');
    if (!npcsContainer) {
      console.warn('Could not find NPCs container for observer');
      return;
    }
    
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            // Check if this is an NPC entity
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            
            // Only apply to nocturnal NPCs
            if (this.isNocturnalNPC(node)) {
              // Skip if already has the component
              if (node.hasAttribute('night-chase')) return;
              
              // Apply settings based on NPC type
              if (node.getAttribute('gltf-model') === '#mCublit') {
                node.setAttribute('night-chase', {
                  speedMultiplier: 2.8,
                  huntAcceleration: 2.5,
                  maxSwarmSpeed: 22,
                  detectionRange: 180
                });
              } else if (node.getAttribute('gltf-model') === '#mGlasst') {
                node.setAttribute('night-chase', {
                  speedMultiplier: 2.2,
                  huntAcceleration: 1.8,
                  detectionRange: 150
                });
              } else {
                node.setAttribute('night-chase', '');
              }
              
              console.log(`Applied night-chase to new NPC: ${node.id || 'unnamed'}`);
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(npcsContainer, { childList: true });
  },
  
  isNocturnalNPC: function(node) {
    // Check various indicators of a nocturnal NPC
    return node.hasAttribute('data-nocturnal') && node.getAttribute('data-nocturnal') === 'true' ||
           node.id && node.id.includes('night') ||
           node.getAttribute('gltf-model') === '#mGlasst' ||
           node.getAttribute('gltf-model') === '#mCublit';
  },
  
  connectToDayNightCycle: function() {
    // Find the day-night-cycle component
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (!dayNightCycle || !dayNightCycle.components['day-night-cycle']) {
      // Try again later
      setTimeout(() => this.connectToDayNightCycle(), 1000);
      return;
    }
    
    // Store reference
    this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
    
    console.log('Night Chase Manager connected to day-night cycle');
  },
  
  registerWithNpcManager: function() {
    // Find the NPC manager system
    const npcSystem = document.querySelector('a-scene').systems['npc-manager'];
    if (!npcSystem) {
      console.warn('Could not find NPC manager system');
      return;
    }
    
    // Hook into time change handling
    const originalTimeChange = npcSystem.handleTimeChange;
    npcSystem.handleTimeChange = function(isNight) {
      // Call original handler
      if (originalTimeChange) {
        originalTimeChange.call(npcSystem, isNight);
      }
      
      // Enhance night behavior to boost nocturnal NPCs
      if (isNight) {
        console.log('Night Chase Manager: Enhancing nocturnal NPCs for night time');
        
        // Increase maxNPCs temporarily for greater numbers at night
        const originalMaxNPCs = npcSystem.data.maxNPCs;
        npcSystem.data.maxNPCs = Math.floor(originalMaxNPCs * 1.5);
        
        // Restore normal count after delay
        setTimeout(() => {
          npcSystem.data.maxNPCs = originalMaxNPCs;
        }, 60000); // After 1 minute
      }
    };
    
    console.log('Night Chase Manager registered with NPC manager');
  }
});
