// Simple collectibles system for Eigengrau Light
// Defines two collectible types: vibe and karpathy crystal

// Define collectible types
const COLLECTIBLE_TYPES = {
    "vibe": {
      shape: "sphere",
      color: "#00DDFF",
      scale: "3 3 3",
      glow: false,
      points: 1,
      soundEffect: "./assets/Shoot_01.mp3" // Using the provided sound file
    },
    "karpathy": {
      shape: "diamond",
      color: "#00DDFF",
      scale: "5 5 5",
      glow: false,
      points: 0,
      soundEffect: "./assets/Pickup_03.mp3" // Using the same sound for both types
    }
  };
  
  // Collectible component for handling individual collectible behavior
  AFRAME.registerComponent('collectible', {
    schema: {
      type: { type: 'string', default: 'vibe' },
      collectedBy: { type: 'string', default: '' },
      uniqueId: { type: 'string', default: '' }
    },
  
    init: function() {
      // Get configuration for this collectible type
      const typeConfig = COLLECTIBLE_TYPES[this.data.type];
      if (!typeConfig) {
        console.error(`Unknown collectible type: ${this.data.type}`);
        return;
      }
  
      // Create visual representation
      this.createVisual(typeConfig);
      
      // Add glow effect if enabled
      if (typeConfig.glow) {
        this.addGlowEffect(typeConfig.color);
      }
      
      // Set up sound effect
      if (typeConfig.soundEffect) {
        // Create audio element directly for more reliable playback
        this.audioEl = document.createElement('audio');
        this.audioEl.src = typeConfig.soundEffect;
        this.audioEl.preload = 'auto';
        this.audioEl.volume = 0.7;
        document.body.appendChild(this.audioEl);
      }
      
      // Set up player reference and collection radius
      this.playerEl = document.querySelector('#player');
      this.collectionRadius = 5;
      
      // Get reference to sync system for multiplayer
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems) {
        this.syncSystem = scene.systems['collectible-sync'];
      }
    },
    
    tick: function(time) {
      // Only run collision detection every few frames for performance
      if (!this._lastUpdate || time - this._lastUpdate > 200) { // Check every 200ms instead of every frame
        this._lastUpdate = time;
        
        // Skip if already collected
        if (this.data.collectedBy) return;
        
        // Check for collection
        if (this.playerEl && this.isPlayerInRange()) {
          this.collectItem();
        }
      }
    },
    
    isPlayerInRange: function() {
      // Fast distance check using squared distance (avoids expensive sqrt operation)
      if (!this.playerEl.object3D) return false;
      
      const playerPos = this.playerEl.object3D.position;
      const itemPos = this.el.object3D.position;
      const dx = playerPos.x - itemPos.x;
      const dy = playerPos.y - itemPos.y;
      const dz = playerPos.z - itemPos.z;
      
      // Using squared distance for performance (avoids square root)
      return (dx*dx + dy*dy + dz*dz) < (this.collectionRadius * this.collectionRadius);
    },
    
    collectItem: function() {
      // Get player ID for multiplayer syncing
      const playerId = window.playerId || 'local-player';
      
      // Mark as collected
      this.data.collectedBy = playerId;
      
      // Play sound effect
      if (this.audioEl) {
        // Create a fresh clone for reliable playback
        const soundClone = this.audioEl.cloneNode();
        soundClone.volume = 0.7;
        soundClone.play().catch(e => console.warn('Sound play error:', e));
        
        // Remove clone after playing
        soundClone.onended = () => {
          if (soundClone.parentNode) {
            soundClone.parentNode.removeChild(soundClone);
          }
        };
      }
      
      // Apply effect for karpathy crystal
      if (this.data.type === 'karpathy') {
        this.applyKarpathyEffect();
      }
      
      // Record collection in the manager system
      if (window.collectiblesManager) {
        window.collectiblesManager.recordCollection(this.data.type);
      }
      
      // Report collection to sync system for multiplayer
      if (this.syncSystem) {
        this.syncSystem.reportCollection(this.data.uniqueId, playerId);
      }
      
      // Play collection animation and remove
      this.playCollectionAnimation().then(() => {
        if (this.el.parentNode) {
          this.el.parentNode.removeChild(this.el);
        }
      });
    },
    
    createVisual: function(typeConfig) {
      // Create geometry based on shape - use simpler geometries for better performance
      switch(typeConfig.shape) {
        case 'sphere':
          this.el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5,
            segmentsWidth: 8,  // Reduced segment count for performance
            segmentsHeight: 8
          });
          break;
        case 'diamond':
          this.el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5,
            segmentsWidth: 4,  // Already low-poly
            segmentsHeight: 2
          });
          break;
      }
      
      // Set material with glow but more performant settings
      this.el.setAttribute('material', {
        color: typeConfig.color,
        metalness: 0.3,
        roughness: 0.3,
        emissive: typeConfig.glow ? typeConfig.color : '#000000',
        emissiveIntensity: typeConfig.glow ? 0.7 : 0,
        shader: 'flat',
        wireframe: false,  // Solid rendering
        wireframeLinewidth: 2  // Thicker lines make it more visible
      });
      
      // Apply scale
      this.el.setAttribute('scale', typeConfig.scale);
      
      // Add simple rotation animation (more performant)
      this.el.setAttribute('animation__rotate', {
        property: 'rotation.y',  // Only rotate on Y-axis for better performance
        dur: 10000,
        easing: 'linear',
        loop: true,
        to: 360
      });
      
      // Simple outline using a border material property instead of an extra mesh
      this.el.setAttribute('material', {
        color: typeConfig.color,
        metalness: 0.3,
        roughness: 0.3,
        emissive: typeConfig.glow ? typeConfig.color : '#000000',
        emissiveIntensity: typeConfig.glow ? 0.7 : 0,
        shader: 'flat'
      });
    },
    
    addGlowEffect: function(color) {
      // Add a light to create glow effect
      const light = document.createElement('a-entity');
      light.setAttribute('light', {
        type: 'point',
        color: color,
        intensity: 0.5,
        distance: 5
      });
      this.el.appendChild(light);
    },
    
    applyKarpathyEffect: function() {
      // Find player's terrain-movement component
      const playerEl = document.querySelector('#player');
      const terrainMovement = playerEl.components['terrain-movement'];
      
      if (terrainMovement) {
        // Enable flight mode
        terrainMovement.flying = true;
        
        // Initial small boost for immediate feedback
        playerEl.object3D.position.y += 5;
        
        // Create a smooth acceleration effect over 2 seconds
        let accelerationTime = 0;
        const totalAccelerationTime = 2000; // 2 seconds
        const accelerationInterval = 50; // Update every 50ms
        const totalSteps = totalAccelerationTime / accelerationInterval;
        let currentStep = 0;
        
        // Store the acceleration interval ID for cleanup
        const accelerationIntervalId = setInterval(() => {
          currentStep++;
          
          // Ease-in acceleration curve (starts slow, ends fast)
          const progress = currentStep / totalSteps;
          const easedProgress = progress * progress; // Quadratic easing
          
          // Calculate acceleration for this step
          const stepAcceleration = 1.5 * easedProgress; // Maximum of 1.5 units per step
          
          // Apply upward movement
          playerEl.object3D.position.y += stepAcceleration;
          
          // Clear interval after acceleration phase
          if (currentStep >= totalSteps) {
            clearInterval(accelerationIntervalId);
            console.log("Karpathy acceleration complete, continuing flight mode");
          }
        }, accelerationInterval);
        
        // Set moveZ positive to ensure upward movement when flying
        terrainMovement.moveZ = 1;
        
        // Disable flight and reset moveZ after 15 seconds
        setTimeout(() => {
          terrainMovement.flying = false;
          // Don't reset moveZ if player is actively moving
          if (!terrainMovement.keys || (!terrainMovement.keys.w && !terrainMovement.keys.ArrowUp)) {
            terrainMovement.moveZ = 0;
          }
        }, 15000);
        
        console.log("🚀 Karpathy effect applied - launching player with smooth acceleration!");
      } else {
        console.warn("Could not find terrain-movement component on player");
      }
    },
    
    playCollectionAnimation: function() {
      return new Promise(resolve => {
        // Skip animations for better performance - just fast fade out
        this.el.setAttribute('animation__fade', {
          property: 'material.opacity',
          dur: 150, // Much faster animation
          easing: 'easeOutQuad',
          to: '0'
        });
        
        // Faster resolution
        setTimeout(resolve, 150);
      });
    }
  });