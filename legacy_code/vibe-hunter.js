// Vibe-Hunter Component for Eigengrau Light
// Extension for enhanced-ai that specifically handles vibe stealing behavior

AFRAME.registerComponent('vibe-hunter', {
  schema: {
    stealRange: { type: 'number', default: 3.5 },      // Distance needed to steal vibes
    stealCooldown: { type: 'number', default: 3000 },  // Time between steal attempts (ms)
    stealAmount: { type: 'number', default: 1 },       // Vibes stolen per attempt
    visualIndicator: { type: 'boolean', default: true }, // Show visual effect when hunting vibes
    soundEnabled: { type: 'boolean', default: true },  // Play sound when stealing vibes
    huntingSound: { type: 'string', default: './assets/whisper.mp3' }, // Sound to play when hunting
    stealSound: { type: 'string', default: './assets/vibes.mp3' },    // Sound to play when stealing
    senseRadius: { type: 'number', default: 50 },      // Range to sense vibes
    enabled: { type: 'boolean', default: true },       // Enable/disable component
    nightBoost: { type: 'number', default: 2.0 }       // Boost to stealing at night
  },
  
  init: function() {
    // Reference to the enhanced AI component
    this.ai = this.el.components['enhanced-ai'];
    if (!this.ai) {
      console.warn('vibe-hunter requires enhanced-ai component');
    }
    
    // State
    this.lastStealTime = 0;
    this.lastSoundTime = 0;
    this.isNight = false;
    this.canSense = false;
    this.huntingVibe = false;
    this.lastPlayerVibeCount = 0;
    this.playerHasVibes = false;
    
    // Player reference
    this.player = document.querySelector('#player');
    
    // Create visual indicator
    if (this.data.visualIndicator) {
      this.createVisualIndicator();
    }
    
    // Create sounds
    if (this.data.soundEnabled) {
      this.createSounds();
    }
    
    // Connect to day-night cycle
    this.connectToDayNightCycle();
    
    // Get collectibles manager reference
    this.collectiblesManager = null;
    this.getCollectiblesManager();
  },
  
  connectToDayNightCycle: function() {
    // Check if day-night cycle component exists
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
      this.isNight = this.dayNightCycle.isNight;
      
      // Update behavior based on time of day
      this.updateNightState(this.isNight);
    }
  },
  
  getCollectiblesManager: function() {
    // Try to get manager reference
    if (window.collectiblesManager) {
      this.collectiblesManager = window.collectiblesManager;
    } else {
      // Try to get from scene
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems['collectible-manager']) {
        this.collectiblesManager = {
          getStats: function() {
            return scene.systems['collectible-manager'].stats;
          }
        };
      }
      
      // If still not found, try again later
      if (!this.collectiblesManager) {
        setTimeout(() => this.getCollectiblesManager(), 1000);
      }
    }
  },
  
  createVisualIndicator: function() {
    // Create a visual indicator to show when NPC is hunting vibes
    this.indicator = document.createElement('a-entity');
    this.indicator.setAttribute('position', '0 3 0');
    
    // Create glowing sphere
    this.indicator.setAttribute('geometry', {
      primitive: 'sphere',
      radius: 0.5
    });
    
    this.indicator.setAttribute('material', {
      color: '#00FFFF',
      emissive: '#00FFFF',
      emissiveIntensity: 0.6,
      opacity: 0.7,
      transparent: true
    });
    
    // Add pulsing animation
    this.indicator.setAttribute('animation', {
      property: 'scale',
      from: '0.8 0.8 0.8',
      to: '1.2 1.2 1.2',
      dur: 1000,
      dir: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    });
    
    // Hide initially
    this.indicator.setAttribute('visible', false);
    
    this.el.appendChild(this.indicator);
  },
  
  createSounds: function() {
    // Create audio elements for hunting and stealing sounds
    this.huntingAudio = new Audio(this.data.huntingSound);
    this.huntingAudio.volume = 0.3;
    this.huntingAudio.loop = true;
    
    this.stealAudio = new Audio(this.data.stealSound);
    this.stealAudio.volume = 0.6;
  },
  
  update: function(oldData) {
    // Handle changes to settings
    if (oldData.visualIndicator !== undefined && 
        oldData.visualIndicator !== this.data.visualIndicator) {
      if (this.indicator) {
        this.indicator.setAttribute('visible', this.data.visualIndicator && this.huntingVibe);
      }
    }
    
    if (oldData.soundEnabled !== undefined && 
        oldData.soundEnabled !== this.data.soundEnabled) {
      // Turn off sounds if disabled
      if (!this.data.soundEnabled && this.huntingAudio && this.huntingAudio.playing) {
        this.huntingAudio.pause();
      }
    }
  },
  
  tick: function(time, delta) {
    if (!this.data.enabled || !this.player || !delta) return;
    
    // Try to get collectibles manager if not found yet
    if (!this.collectiblesManager) {
      this.getCollectiblesManager();
      return;
    }
    
    // Check player's vibe count
    this.checkPlayerVibeCount();
    
    // Adjust behavior based on vibes and time of day
    this.updateVibeHuntingState();
    
    // Check if close enough to steal
    if (this.canStealVibes()) {
      this.stealVibes();
    }
    
    // Play hunting sound if appropriate
    this.updateHuntingSound();
  },
  
  checkPlayerVibeCount: function() {
    let vibeCount = 0;
    
    // Try to get player's vibe count from collectibles manager
    if (this.collectiblesManager && typeof this.collectiblesManager.getStats === 'function') {
      const stats = this.collectiblesManager.getStats();
      if (stats && typeof stats.points === 'number') {
        vibeCount = stats.points;
      }
    }
    
    // Check if player has any vibes
    const hadVibes = this.playerHasVibes;
    this.playerHasVibes = vibeCount > 0;
    this.lastPlayerVibeCount = vibeCount;
    
    // If player just got vibes, we should sense them
    if (!hadVibes && this.playerHasVibes) {
      this.canSense = true;
    }
  },
  
  updateVibeHuntingState: function() {
    const playerPos = this.player.object3D.position;
    const npcPos = this.el.object3D.position;
    const distance = playerPos.distanceTo(npcPos);
    
    // Determine if should hunt vibes based on distance and whether player has vibes
    const inRange = distance < (this.isNight ? this.data.senseRadius * 1.5 : this.data.senseRadius);
    
    // Only hunt vibes if player has vibes and is in range
    const shouldHuntVibes = this.playerHasVibes && (inRange || this.canSense);
    
    // Update the hunting state
    if (shouldHuntVibes !== this.huntingVibe) {
      this.huntingVibe = shouldHuntVibes;
      this.updateVisualIndicator();
      
      // Update AI behavior if we have access to the enhanced AI
      if (this.ai) {
        // If hunting vibes, set to hunt or swarm depending on distance
        if (this.huntingVibe) {
          if (distance < 20) {
            // Close to player - swarm around
            this.ai.currentBehavior = 'swarm';
            this.ai.onBehaviorChange();
          } else {
            // Further away - hunt directly
            this.ai.currentBehavior = 'hunt';
            this.ai.onBehaviorChange();
          }
          
          // Boost speed when hunting vibes
          const speedBoost = this.isNight ? this.data.nightBoost : 1.2;
          this.ai.targetSpeed = this.ai.data.speed * speedBoost;
        } else {
          // If no longer hunting vibes, return to default behavior
          if (this.isNight) {
            // At night, still occasionally hunt even without vibes
            if (Math.random() < 0.3) {
              this.ai.currentBehavior = 'hunt';
            } else {
              this.ai.currentBehavior = 'patrol';
            }
            this.ai.onBehaviorChange();
          } else {
            // During day, usually patrol
            if (Math.random() < 0.7) {
              this.ai.currentBehavior = 'patrol';
            } else {
              this.ai.currentBehavior = 'swarm';
            }
            this.ai.onBehaviorChange();
          }
          
          // Reset to normal speed
          this.ai.targetSpeed = this.ai.data.speed;
        }
      }
    }
  },
  
  updateVisualIndicator: function() {
    // Update visual indicator based on hunting state
    if (this.indicator && this.data.visualIndicator) {
      this.indicator.setAttribute('visible', this.huntingVibe);
      
      // Change color based on whether player has vibes and time of day
      let color;
      if (this.huntingVibe) {
        color = this.isNight ? '#FF00FF' : '#00FFFF';
      } else {
        color = '#888888';
      }
      
      this.indicator.setAttribute('material', {
        color: color,
        emissive: color,
        emissiveIntensity: this.huntingVibe ? 0.8 : 0.2
      });
    }
  },
  
  updateHuntingSound: function() {
    if (!this.data.soundEnabled || !this.huntingAudio) return;
    
    const now = Date.now();
    
    // Only update sound occasionally for performance
    if (now - this.lastSoundTime < 1000) return;
    this.lastSoundTime = now;
    
    if (this.huntingVibe) {
      // Calculate volume based on distance to player
      const distance = this.player.object3D.position.distanceTo(this.el.object3D.position);
      const maxDistance = 20;
      const volume = Math.max(0.1, Math.min(0.6, 1 - (distance / maxDistance)));
      
      // Only play if relatively close
      if (distance < maxDistance) {
        if (this.huntingAudio.paused) {
          this.huntingAudio.volume = volume;
          this.huntingAudio.play().catch(err => console.warn('Error playing hunting sound', err));
        } else {
          this.huntingAudio.volume = volume;
        }
      } else if (!this.huntingAudio.paused) {
        this.huntingAudio.pause();
      }
    } else if (!this.huntingAudio.paused) {
      this.huntingAudio.pause();
    }
  },
  
  canStealVibes: function() {
    if (!this.playerHasVibes) return false;
    
    const now = Date.now();
    
    // Check cooldown
    if (now - this.lastStealTime < this.data.stealCooldown) return false;
    
    // Check distance
    const distance = this.player.object3D.position.distanceTo(this.el.object3D.position);
    const stealRange = this.isNight ? this.data.stealRange * 1.3 : this.data.stealRange;
    
    return distance <= stealRange;
  },
  
  stealVibes: function() {
    // Record time of steal
    this.lastStealTime = Date.now();
    
    // Try to steal vibes using vibe-stealing-system if available
    const vibeStealingSystem = window.vibeStealingSystem;
    if (vibeStealingSystem && typeof vibeStealingSystem.stealVibes === 'function') {
      const amount = this.isNight ? this.data.stealAmount * 2 : this.data.stealAmount;
      vibeStealingSystem.stealVibes(amount);
      
      // Play sound effect
      if (this.data.soundEnabled && this.stealAudio) {
        this.stealAudio.currentTime = 0;
        this.stealAudio.play().catch(err => console.warn('Error playing steal sound', err));
      }
      
      // Create visual feedback effect
      this.createStealEffect();
      
      return;
    }
    
    // Fallback: try to reduce vibes directly through collectibles manager
    let succeeded = false;
    
    if (this.collectiblesManager) {
      const scene = document.querySelector('a-scene');
      
      // Method 1: Try using the scene's collectible-manager system directly
      if (scene && scene.systems['collectible-manager']) {
        const managerSystem = scene.systems['collectible-manager'];
        
        // Calculate how many vibes to actually steal (don't go below 0)
        const currentVibes = managerSystem.stats.points;
        const amount = Math.min(this.data.stealAmount, currentVibes);
        
        if (amount > 0) {
          // Update stats directly on the system
          managerSystem.stats.points -= amount;
          succeeded = true;
          
          // Trigger a stats update event
          document.dispatchEvent(new CustomEvent('score-updated', {
            detail: {
              score: managerSystem.stats.points,
              vibes: managerSystem.stats.vibes,
              karpathys: managerSystem.stats.karpathys
            }
          }));
        }
      }
      // Method 2: Try using window.collectiblesManager as fallback
      else if (typeof this.collectiblesManager.getStats === 'function') {
        const stats = this.collectiblesManager.getStats();
        
        if (stats && typeof stats.points === 'number') {
          const currentVibes = stats.points;
          const amount = Math.min(this.data.stealAmount, currentVibes);
          
          if (amount > 0 && this.collectiblesManager.stats) {
            this.collectiblesManager.stats.points -= amount;
            succeeded = true;
            
            // If this has a recordCollection method, try to use it to update internal state
            if (typeof this.collectiblesManager.recordCollection === 'function') {
              this.collectiblesManager.recordCollection('theft');
            }
          }
        }
      }
    }
    
    if (succeeded) {
      // Play sound effect
      if (this.data.soundEnabled && this.stealAudio) {
        this.stealAudio.currentTime = 0;
        this.stealAudio.play().catch(err => console.warn('Error playing steal sound', err));
      }
      
      // Create visual feedback effect
      this.createStealEffect();
      
      // Update HUD
      this.updateHUD();
    }
  },
  
  createStealEffect: function() {
    // Create visual effect for stealing
    const effect = document.createElement('a-entity');
    effect.setAttribute('position', '0 2 0');
    
    // Create vibe particle effect
    effect.setAttribute('geometry', {
      primitive: 'sphere',
      radius: 0.8
    });
    
    effect.setAttribute('material', {
      color: '#00FFFF',
      emissive: '#00FFFF',
      emissiveIntensity: 1.0,
      opacity: 0.9,
      transparent: true
    });
    
    // Animate particle moving from player to NPC
    const startPos = new THREE.Vector3();
    startPos.copy(this.player.object3D.position);
    startPos.y += 2; // Head height
    
    const endPos = new THREE.Vector3();
    endPos.copy(this.el.object3D.position);
    endPos.y += 2; // NPC head height
    
    // Convert to entity-local coordinates
    const worldToLocal = new THREE.Matrix4();
    worldToLocal.getInverse(this.el.object3D.matrixWorld);
    
    const localStartPos = startPos.clone().applyMatrix4(worldToLocal);
    const localEndPos = endPos.clone().applyMatrix4(worldToLocal);
    
    // Set animation
    effect.setAttribute('animation', {
      property: 'position',
      from: `${localStartPos.x} ${localStartPos.y} ${localStartPos.z}`,
      to: `${localEndPos.x} ${localEndPos.y} ${localEndPos.z}`,
      dur: 500,
      easing: 'easeInQuad'
    });
    
    // Add scale & opacity animation
    effect.setAttribute('animation__scale', {
      property: 'scale',
      from: '0.3 0.3 0.3',
      to: '0.8 0.8 0.8',
      dur: 500,
      easing: 'easeOutQuad'
    });
    
    effect.setAttribute('animation__opacity', {
      property: 'material.opacity',
      from: '0.9',
      to: '0.1',
      dur: 500,
      easing: 'easeInQuad'
    });
    
    // Add to entity and remove after animation
    this.el.appendChild(effect);
    setTimeout(() => {
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    }, 600);
  },
  
  updateHUD: function() {
    // Update HUD to show current vibe count
    const hudText = document.querySelector('#collectibles-hud-text');
    if (hudText) {
      // Get the current score from whatever source we can find
      let currentScore = 0;
      
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems['collectible-manager']) {
        currentScore = scene.systems['collectible-manager'].stats.points;
      } else if (this.collectiblesManager && this.collectiblesManager.stats) {
        currentScore = this.collectiblesManager.stats.points;
      }
      
      hudText.setAttribute('value', `vibes ${currentScore}`);
    }
    
    // Notify the leaderboard of the score change
    if (window.leaderboardManager && typeof window.leaderboardManager.sendScoreUpdate === 'function') {
      window.leaderboardManager.sendScoreUpdate();
    }
  },
  
  updateNightState: function(isNight) {
    this.isNight = isNight;
    
    // Update behavior for night/day transition
    if (isNight) {
      // More aggressive at night
      this.canSense = true; // Can sense vibes further at night
      
      // Update enhanced AI if available
      if (this.ai) {
        this.ai.setNightMode(true);
      }
    } else {
      // Less aggressive during day
      this.canSense = this.playerHasVibes; // Only sense if player has vibes
      
      // Update enhanced AI if available
      if (this.ai) {
        this.ai.setNightMode(false);
      }
    }
    
    // Update visual indicator
    this.updateVisualIndicator();
  },
  
  remove: function() {
    // Clean up
    if (this.huntingAudio) {
      this.huntingAudio.pause();
      this.huntingAudio = null;
    }
    
    if (this.stealAudio) {
      this.stealAudio = null;
    }
  }
});
