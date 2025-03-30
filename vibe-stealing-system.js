// Vibe Stealing System for Eigengrau Light
// This system allows nocturnal NPCs to steal vibes from players during night time

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const vibeStealingEntity = document.createElement('a-entity');
      vibeStealingEntity.setAttribute('id', 'vibe-stealing-system');
      vibeStealingEntity.setAttribute('vibe-stealing-system', '');
      scene.appendChild(vibeStealingEntity);
      console.log('Vibe stealing system initialized');
    });
  }
});

AFRAME.registerComponent('vibe-stealing-system', {
  schema: {
    enabled: { type: 'boolean', default: true },
    stealRadius: { type: 'number', default: 12 },       // How close NPCs need to be to steal vibes
    stealAmount: { type: 'number', default: 1 },       // How many vibes are stolen per theft
    stealCooldown: { type: 'number', default: 3000 },  // Milliseconds between theft attempts
    stealSound: { type: 'string', default: './assets/whisper.mp3' },
    vibeSound: { type: 'string', default: './assets/vibes.mp3' },
    indicatorDuration: { type: 'number', default: 1500 }, // Duration to show theft indicator
    vibration: { type: 'boolean', default: true }      // Enable vibration on mobile devices (if supported)
  },
  
  init: function() {
    // Get player reference
    this.player = document.querySelector('#player').object3D;
    
    // Track theft cooldown for each NPC
    this.npcCooldowns = new Map();
    
    // Last time vibes were stolen
    this.lastStealTime = 0;
    
    // Create audio elements for sound effects
    this.stealAudio = new Audio(this.data.stealSound);
    this.stealAudio.volume = 0.6;
    this.vibeAudio = new Audio(this.data.vibeSound);
    this.vibeAudio.volume = 0.4;
    
    // Create visual indicator for theft
    this.createTheftIndicator();
    
    // Listen for NPC spawning to track all NPCs
    this.observeNpcSpawning();
    
    // Connect to day-night cycle to only steal during night
    this.connectToDayNightCycle();
    
    // Make system globally accessible
    window.vibeStealingSystem = this;
    
    // Get reference to collectibles manager for managing vibes
    this.collectiblesManager = window.collectiblesManager;
    
    console.log('Vibe stealing system ready');
  },
  
  createTheftIndicator: function() {
    // Create the theft indicator (stays hidden until needed)
    this.theftIndicator = document.createElement('div');
    Object.assign(this.theftIndicator.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '100px',
      height: '100px',
      backgroundImage: 'url(./assets/theft-indicator.png)', // Optional - you can add an indicator image
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      color: 'red',
      fontSize: '24px',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.2s ease-in-out',
      zIndex: '1000'
    });
    
    // Use text as fallback if no image
    this.theftIndicator.textContent = '-1';
    
    document.body.appendChild(this.theftIndicator);
  },
  
  showTheftIndicator: function() {
    // Show the indicator
    this.theftIndicator.style.opacity = '1';
    
    // Flash effect
    const flashEffect = () => {
      this.theftIndicator.style.opacity = '1';
      setTimeout(() => {
        this.theftIndicator.style.opacity = '0.7';
        setTimeout(() => {
          this.theftIndicator.style.opacity = '1';
        }, 100);
      }, 100);
    };
    
    // Flash a few times
    flashEffect();
    setTimeout(flashEffect, 300);
    setTimeout(flashEffect, 600);
    
    // Hide after duration
    setTimeout(() => {
      this.theftIndicator.style.opacity = '0';
    }, this.data.indicatorDuration);
  },
  
  observeNpcSpawning: function() {
    // Find NPC container
    const npcContainer = document.querySelector('#npcs');
    if (!npcContainer) {
      console.warn('Vibe stealing system: Could not find NPC container');
      return;
    }
    
    // Set up mutation observer to track new NPCs
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            // Check if this is an NPC entity
            if (node.hasAttribute && node.hasAttribute('ai-locomotion')) {
              // Set up for vibe stealing if it's a nocturnal NPC
              this.setupNpcForVibesStealing(node);
            }
          });
        }
      });
    });
    
    // Start observing the NPC container
    observer.observe(npcContainer, { childList: true });
    
    // Also check existing NPCs
    const existingNpcs = document.querySelectorAll('#npcs [ai-locomotion]');
    existingNpcs.forEach(npc => {
      this.setupNpcForVibesStealing(npc);
    });
  },
  
  setupNpcForVibesStealing: function(npcEntity) {
    // Check if this is a nocturnal NPC
    const npcSystem = document.querySelector('a-scene').systems['npc-manager'];
    if (!npcSystem) return;
    
    // Get the NPC type from its ID or model
    const modelAttribute = npcEntity.getAttribute('gltf-model');
    
    // Determine if nocturnal based on model
    let isNocturnal = false;
    if (modelAttribute) {
      // Check model against known nocturnal types
      if (modelAttribute === '#mGlasst' || modelAttribute === '#mCublit') {
        isNocturnal = true;
      }
    }
    
    // If we have the NPC ID, check its type more accurately
    const npcId = npcEntity.id;
    if (npcId && npcId.includes('night')) {
      isNocturnal = true;
    }
    
    // Set a data attribute to track nocturnal status
    npcEntity.dataset.nocturnal = isNocturnal;
    
    // Add to cooldown map
    this.npcCooldowns.set(npcEntity, 0);
    
    // If it's a cublit (vibe stealer), add a special stealing animation
    if (modelAttribute === '#mCublit') {
      npcEntity.dataset.vibeStealerType = 'cublit';
      
      // Add a special visual indicator for this NPC
      const indicator = document.createElement('a-entity');
      indicator.setAttribute('position', '0 6 0');
      indicator.setAttribute('geometry', 'primitive: sphere; radius: 0.5');
      indicator.setAttribute('material', 'color: #00FFFF; emissive: #00FFFF; emissiveIntensity: 0.5; opacity: 0.7; transparent: true');
      indicator.setAttribute('animation', 'property: material.opacity; from: 0.7; to: 0.2; dur: 1000; loop: true; dir: alternate;');
      indicator.setAttribute('visible', 'false');
      npcEntity.appendChild(indicator);
      
      // Store reference to the indicator
      npcEntity.stealIndicator = indicator;
    }
  },
  
  connectToDayNightCycle: function() {
    // Find the day-night-cycle component and check if it's night time
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
      this.isNightTime = this.dayNightCycle.isNight;
    } else {
      // If not found, set up a watcher to find it when available
      this.watchForDayNightCycle();
    }
  },
  
  watchForDayNightCycle: function() {
    const checkInterval = setInterval(() => {
      const dayNightCycle = document.querySelector('#day-night-cycle');
      if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
        this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
        this.isNightTime = this.dayNightCycle.isNight;
        clearInterval(checkInterval);
        console.log('Vibe stealing system connected to day-night cycle');
      }
    }, 1000);
  },
  
  tick: function() {
    // Only process if enabled and it's night time
    if (!this.data.enabled || (this.dayNightCycle && !this.dayNightCycle.isNight)) {
      return;
    }
    
    // Check for nocturnal NPCs near player that could steal vibes
    this.checkForVibeStealing();
  },
  
  checkForVibeStealing: function() {
    // Skip if player isn't found
    if (!this.player) return;
    
    // Get the current time for cooldown calculation
    const now = Date.now();
    
    // Don't allow global stealing too frequently
    if (now - this.lastStealTime < this.data.stealCooldown / 2) {
      return;
    }
    
    // Find all nocturnal NPCs
    const nocturnalNpcs = document.querySelectorAll('[data-nocturnal="true"]');
    
    // Track if any NPC attempted theft this frame
    let theftAttempted = false;
    
    nocturnalNpcs.forEach(npc => {
      // Skip if on cooldown
      if (now - this.npcCooldowns.get(npc) < this.data.stealCooldown) {
        return;
      }
      
      // Calculate distance to player
      const npcPosition = npc.object3D.position;
      const playerPosition = this.player.position;
      
      const dx = npcPosition.x - playerPosition.x;
      const dy = npcPosition.y - playerPosition.y;
      const dz = npcPosition.z - playerPosition.z;
      
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      // Check if close enough to steal
      if (distanceSquared < this.data.stealRadius * this.data.stealRadius) {
        // Attempt to steal vibes
        const success = this.attemptVibeTheft(npc);
        
        if (success) {
          theftAttempted = true;
          
          // Update the cooldown for this NPC
          this.npcCooldowns.set(npc, now);
          
          // Show the stealing indicator on special NPCs
          if (npc.dataset.vibeStealerType === 'cublit' && npc.stealIndicator) {
            npc.stealIndicator.setAttribute('visible', 'true');
            
            // Hide it after a few seconds
            setTimeout(() => {
              if (npc.stealIndicator) {
                npc.stealIndicator.setAttribute('visible', 'false');
              }
            }, 2000);
          }
        }
      }
    });
    
    // Update global steal time if any theft occurred
    if (theftAttempted) {
      this.lastStealTime = now;
    }
  },
  
  attemptVibeTheft: function(npc) {
    // Check if player has any vibes to steal
    if (!this.collectiblesManager) {
      // Try to get the manager if it wasn't available at init
      this.collectiblesManager = window.collectiblesManager;
      if (!this.collectiblesManager) {
        console.warn('Collectibles manager not available for vibe theft');
        return false;
      }
    }
    
    // Get current vibe count
    const stats = this.collectiblesManager.getStats();
    if (!stats || typeof stats.points !== 'number' || stats.points <= 0) {
      // No vibes to steal
      return false;
    }
    
    // Steal the vibes!
    this.stealVibes(this.data.stealAmount);
    
    // Show visual indicator
    this.showTheftIndicator();
    
    // Play sound effect
    this.playStealSound();
    
    // Vibrate device if supported and enabled
    if (this.data.vibration && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }
    
    return true;
  },
  
  stealVibes: function(amount) {
    // First try to get the system instance
    const scene = document.querySelector('a-scene');
    let stoleAmount = 0;
    
    // Method 1: Try using the scene's collectible-manager system directly (most reliable)
    if (scene && scene.systems['collectible-manager']) {
      const managerSystem = scene.systems['collectible-manager'];
      
      // Calculate how many vibes to actually steal (don't go below 0)
      const currentVibes = managerSystem.stats.points;
      stoleAmount = Math.min(amount, currentVibes);
      
      // Update stats directly on the system
      managerSystem.stats.points -= stoleAmount;
      console.log(`Stole ${stoleAmount} vibes, remaining: ${managerSystem.stats.points}`);
      
      // Trigger a stats update event
      document.dispatchEvent(new CustomEvent('score-updated', {
        detail: {
          score: managerSystem.stats.points,
          vibes: managerSystem.stats.vibes,
          karpathys: managerSystem.stats.karpathys
        }
      }));
    }
    // Method 2: Use window.collectiblesManager as fallback
    else if (window.collectiblesManager && window.collectiblesManager.stats) {
      // Calculate how many vibes to actually steal (don't go below 0)
      const currentVibes = window.collectiblesManager.stats.points;
      stoleAmount = Math.min(amount, currentVibes);
      
      // Update stats
      window.collectiblesManager.stats.points -= stoleAmount;
      console.log(`Stole ${stoleAmount} vibes, remaining: ${window.collectiblesManager.stats.points}`);
      
      // If this has a recordCollection method, try to use it to update internal state
      if (typeof window.collectiblesManager.recordCollection === 'function') {
        try {
          // Call with a negative amount to reduce points
          window.collectiblesManager.recordCollection('theft');
        } catch (e) {
          console.warn('Error calling recordCollection:', e);
        }
      }
    }
    
    // Ensure HUD is always updated regardless of method used
    const hudText = document.querySelector('#collectibles-hud-text');
    if (hudText) {
      // Get the current score from whatever source we can find
      let currentScore = 0;
      
      if (scene && scene.systems['collectible-manager']) {
        currentScore = scene.systems['collectible-manager'].stats.points;
      } else if (window.collectiblesManager && window.collectiblesManager.stats) {
        currentScore = window.collectiblesManager.stats.points;
      }
      
      hudText.setAttribute('value', `vibes ${currentScore}`);
    }
    
    // Notify the leaderboard of the score change
    if (window.leaderboardManager && typeof window.leaderboardManager.sendScoreUpdate === 'function') {
      window.leaderboardManager.sendScoreUpdate();
    }
    
    return stoleAmount;
  },
  
  playStealSound: function() {
    // Play both sounds with a slight delay between them
    if (this.stealAudio) {
      // Clone the audio to allow overlapping sounds
      const stealSound = this.stealAudio.cloneNode();
      stealSound.volume = 0.8;
      stealSound.play().catch(err => console.warn('Error playing steal sound:', err));
    }
    
    // Play vibe sound with delay
    setTimeout(() => {
      if (this.vibeAudio) {
        const vibeSound = this.vibeAudio.cloneNode();
        vibeSound.volume = 0.6;
        vibeSound.play().catch(err => console.warn('Error playing vibe sound:', err));
      }
    }, 300);
  },
  
  remove: function() {
    // Clean up
    if (this.theftIndicator && this.theftIndicator.parentNode) {
      this.theftIndicator.parentNode.removeChild(this.theftIndicator);
    }
    
    // Remove global reference
    delete window.vibeStealingSystem;
  }
});

// Special component to make NPCs actively try to get closer to player at night
AFRAME.registerComponent('vibe-hunter', {
  schema: {
    enabled: { type: 'boolean', default: true },
    huntRadius: { type: 'number', default: 160 },      // Increased radius to start hunting player
    acceleration: { type: 'number', default: 1.5 },    // Increased acceleration factor
    huntingColor: { type: 'color', default: '#FF0000' }, // Indicator color when hunting
    maxSpeed: { type: 'number', default: 15 },         // Cap for max speed when hunting
    minDistance: { type: 'number', default: 2 }        // Distance to maintain when very close
  },
  
  init: function() {
    // Get player reference
    this.player = document.querySelector('#player').object3D;
    
    // Get AI locomotion component
    this.aiComponent = this.el.components['ai-locomotion'];
    if (!this.aiComponent) {
      console.warn('vibe-hunter requires ai-locomotion component');
      return;
    }
    
    // Store original speed and properties for restoration
    this.originalSpeed = this.aiComponent.data.speed;
    this.originalBehavior = this.aiComponent.data.behavior || 'chase';
    this.originalUpdateInterval = this.aiComponent.data.updateInterval || 1;
    
    // For direct animation control when close
    this.npcObject = this.el.object3D;
    
    // Create a hunting indicator
    //this.createHuntingIndicator();
    
    // Flag for hunting state
    this.isHunting = false;
    
    // Connect to day-night cycle
    this.connectToDayNightCycle();
  },
  
  createHuntingIndicator: function() {
    // Create a small indicator light when hunting
    const indicator = document.createElement('a-entity');
    indicator.setAttribute('position', '0 8 0');
    indicator.setAttribute('geometry', 'primitive: sphere; radius: 0.8');
    indicator.setAttribute('material', `color: ${this.data.huntingColor}; emissive: ${this.data.huntingColor}; emissiveIntensity: 0.5; opacity: 0.7; transparent: true`);
    indicator.setAttribute('animation', 'property: material.opacity; from: 0.7; to: 0.2; dur: 500; loop: true; dir: alternate;');
    indicator.setAttribute('visible', 'false');
    this.el.appendChild(indicator);
    
    // Store reference
    this.huntingIndicator = indicator;
  },
  
  connectToDayNightCycle: function() {
    // Find the day-night-cycle component
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
      this.isNightTime = this.dayNightCycle.isNight;
    } else {
      // Try again in a second
      setTimeout(() => this.connectToDayNightCycle(), 1000);
    }
  },
  
  tick: function(time, delta) {
    // Only process if enabled and it's night time
    if (!this.data.enabled || !this.aiComponent || 
        (this.dayNightCycle && !this.dayNightCycle.isNight)) {
      
      // Reset to original behavior if conditions change
      if (this.isHunting) {
        this.stopHunting();
      }
      return;
    }
    
    // Check if player is within hunting radius
    if (this.player) {
      const npcPosition = this.el.object3D.position;
      const playerPosition = this.player.position;
      
      const dx = npcPosition.x - playerPosition.x;
      const dy = npcPosition.y - playerPosition.y;
      const dz = npcPosition.z - playerPosition.z;
      
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      const distance = Math.sqrt(distanceSquared);
      
      // Start hunting if within radius
      if (distanceSquared < this.data.huntRadius * this.data.huntRadius) {
        if (!this.isHunting) {
          this.startHunting();
        }
        
        // Direct position manipulation for very close NPCs to ensure they stay near player
        // This helps fix issues where AI might not track player well
        if (distance < this.data.minDistance * 4) {
          // For very close NPCs, maintain a small distance from player
          // This creates circling behavior instead of directly overlapping
          const direction = new THREE.Vector3(dx, 0, dz).normalize();
          const idealDistance = this.data.minDistance;
          
          if (distance < idealDistance) {
            // Move slightly away (maintain minimum distance)
            const moveX = direction.x * (idealDistance - distance);
            const moveZ = direction.z * (idealDistance - distance);
            npcPosition.x += moveX * 0.1;
            npcPosition.z += moveZ * 0.1;
          } else {
            // Move closer if beyond ideal distance but still very close
            // Add slight orbit effect for more interesting movement
            const orbit = time * 0.001 * this.aiComponent.data.speed * 0.1;
            const orbitX = Math.sin(orbit) * 0.3;
            const orbitZ = Math.cos(orbit) * 0.3;
            
            npcPosition.x = playerPosition.x + direction.x * idealDistance + orbitX;
            npcPosition.z = playerPosition.z + direction.z * idealDistance + orbitZ;
          }
          
          // Apply gradual height convergence to stay at player's level
          npcPosition.y += (playerPosition.y + this.aiComponent.data.height - npcPosition.y) * 0.1;
        }
      } else if (this.isHunting) {
        this.stopHunting();
      }
    }
  },
  
  startHunting: function() {
    // Already hunting
    if (this.isHunting) return;
    
    this.isHunting = true;
    
    // Dramatically increase speed to pursue player
    const speed = this.originalSpeed * (1 + this.data.acceleration);
    this.aiComponent.data.speed = Math.min(speed, this.data.maxSpeed);
    
    // Force behavior to chase and increase responsiveness
    this.aiComponent.data.behavior = 'chase';
    this.aiComponent.data.updateInterval = 1; // Update every frame for smoother tracking
    this.aiComponent.data.turnRate = 0.2; // More aggressive turning
    
    // If this is a cublit, make it especially dangerous
    if (this.el.getAttribute('gltf-model') === '#mCublit') {
      this.aiComponent.data.speed = this.data.maxSpeed; // Max speed for cublits
      this.aiComponent.targetSpeed = this.data.maxSpeed;
      this.aiComponent.currentSpeed = this.data.maxSpeed;
    }
    
    // Override the prevTargetDirection to force immediate targeting of player
    if (this.aiComponent.prevTargetDirection) {
      const direction = new THREE.Vector3();
      direction.subVectors(this.player.position, this.el.object3D.position).normalize();
      this.aiComponent.prevTargetDirection.copy(direction);
    }
    
    // Show hunting indicator
    if (this.huntingIndicator) {
      this.huntingIndicator.setAttribute('visible', 'true');
    }
    
    // Log for debugging
    console.log(`NPC ${this.el.id} hunting with speed ${this.aiComponent.data.speed}`);
  },
  
  stopHunting: function() {
    if (!this.isHunting) return;
    
    this.isHunting = false;
    
    // Restore original properties
    this.aiComponent.data.speed = this.originalSpeed;
    this.aiComponent.data.behavior = this.originalBehavior;
    this.aiComponent.data.updateInterval = this.originalUpdateInterval;
    
    // Reset speed values to ensure changes take effect
    if (this.aiComponent.targetSpeed) {
      this.aiComponent.targetSpeed = this.originalSpeed;
    }
    if (this.aiComponent.currentSpeed) {
      this.aiComponent.currentSpeed = this.originalSpeed;
    }
    
    // Hide hunting indicator
    if (this.huntingIndicator) {
      this.huntingIndicator.setAttribute('visible', 'false');
    }
  },
  
  remove: function() {
    // Clean up
    if (this.huntingIndicator && this.huntingIndicator.parentNode) {
      this.el.removeChild(this.huntingIndicator);
    }
  }
});

// Add additional modifications to NPC manager to improve hunting behavior
document.addEventListener('DOMContentLoaded', () => {
  // Wait for day-night-cycle to be available
  const waitForDayNightCycle = () => {
    const cycleEntity = document.querySelector('#day-night-cycle');
    if (cycleEntity && cycleEntity.components && cycleEntity.components['day-night-cycle']) {
      // Hook into day-night transitions to better handle nocturnal NPC behavior
      const originalNight = cycleEntity.components['day-night-cycle'].completeNightTransition;
      cycleEntity.components['day-night-cycle'].completeNightTransition = function() {
        // Call original function
        if (originalNight) originalNight.call(this);
        
        console.log("Enhanced night mode for NPCs activated");
        
        // Enhance nocturnal NPCs when night falls
        const npcSystem = document.querySelector('a-scene').systems['npc-manager'];
        if (npcSystem) {
          // Increase speed of all nocturnal NPCs
          for (const npc of npcSystem.activeNPCs) {
            if (!npc.el) continue;
            
            const aiComponent = npc.el.components['ai-locomotion'];
            if (aiComponent && npc.nocturnal) {
              // Apply additional speed boost to nocturnal NPCs
              aiComponent.data.speed *= 1.5;
              aiComponent.data.rSpeed *= 1.2; // Rotation speed boost
              
              // Add vibe-hunter component if not already present
              if (!npc.el.components['vibe-hunter']) {
                npc.el.setAttribute('vibe-hunter', '');
              }
            }
          }
        }
      };
      
      console.log("Enhanced night mode for NPCs set up");
    } else {
      // Try again in a moment
      setTimeout(waitForDayNightCycle, 1000);
    }
  };
  
  // Start checking
  waitForDayNightCycle();
  
  // Set up observer to add vibe-hunter to nocturnal NPCs
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      // Find NPC container
      const npcContainer = document.querySelector('#npcs');
      if (!npcContainer) return;
      
      // Set up mutation observer
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              // Check if this is an NPC entity
              if (node.nodeType !== Node.ELEMENT_NODE) return;
              
              // Add vibe-hunter to nocturnal NPCs
              if (node.id && node.id.includes('night')) {
                node.setAttribute('vibe-hunter', {
                  // Configure different NPCs with different hunting parameters
                  acceleration: node.id.includes('cublit') ? 2.0 : 1.5,
                  maxSpeed: node.id.includes('cublit') ? 20 : 15
                });
              }
              
              // Also check based on model - customize based on model type
              const modelAttribute = node.getAttribute('gltf-model');
              if (modelAttribute) {
                if (modelAttribute === '#mGlasst') {
                  node.setAttribute('vibe-hunter', {
                    acceleration: 1.3,
                    maxSpeed: 12
                  });
                } else if (modelAttribute === '#mCublit') {
                  node.setAttribute('vibe-hunter', {
                    acceleration: 2.0,
                    maxSpeed: 18,
                    huntRadius: 180 // Cublits hunt from further away
                  });
                }
              }
            });
          }
        });
      });
      
      // Start observing
      observer.observe(npcContainer, { childList: true });
      
      // Check existing NPCs
      const existingNocturnalNpcs = document.querySelectorAll('#npcs [id*="night"], #npcs [gltf-model="#mGlasst"], #npcs [gltf-model="#mCublit"]');
      existingNocturnalNpcs.forEach(npc => {
        const modelAttribute = npc.getAttribute('gltf-model');
        
        // Set specific configurations based on NPC type
        if (modelAttribute === '#mCublit') {
          npc.setAttribute('vibe-hunter', {
            acceleration: 2.0,
            maxSpeed: 18,
            huntRadius: 180
          });
        } else if (modelAttribute === '#mGlasst') {
          npc.setAttribute('vibe-hunter', {
            acceleration: 1.3,
            maxSpeed: 12
          });
        } else {
          npc.setAttribute('vibe-hunter', '');
        }
      });
    });
  }
});