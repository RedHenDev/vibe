// Day-Night Cycle System for Eigengrau Light
// Controls the transition between day and night modes, affecting environment and NPC behavior

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const cycleEntity = document.createElement('a-entity');
      cycleEntity.setAttribute('id', 'day-night-cycle');
      cycleEntity.setAttribute('day-night-cycle', '');
      scene.appendChild(cycleEntity);
      console.log('Day-Night cycle system initialized');
    });
  }
});

AFRAME.registerComponent('day-night-cycle', {
  schema: {
    enabled: { type: 'boolean', default: true },
    dayDuration: { type: 'number', default: 300000 }, // 3 minutes for day (in ms)
    nightDuration: { type: 'number', default: 120000 }, // 2 minutes for night (in ms)
    transitionDuration: { type: 'number', default: 5000 }, // 5 seconds for transition (in ms)
    dayColor: { type: 'color', default: '#00DDFF' }, // Day sky color
    nightColor: { type: 'color', default: '#001133' }, // Night sky color
    dayWaterColor: { type: 'color', default: '#DD00DD' }, // Day water color
    nightWaterColor: { type: 'color', default: '#770000' }, // Night water color (red)
    showNotifications: { type: 'boolean', default: true } // Whether to show UI notifications
  },
  
  init: function() {
    // Current state
    this.isNight = false;
    this.isTransitioning = false;
    this.timeInState = 0;
    
    // Get references to scene elements
    this.sky = document.querySelector('a-sky');
    this.sun = document.querySelector('#hamlet');

    // The sea is implemented as a-box inside the a-scene
    // this.seaMesh = document.querySelector('a-box[scale="1000 0.01 1000"]');
    
    if (!this.sky) {
      console.warn('Day-Night cycle: Could not find a-sky element');
    }
    
    if (!this.seaMesh) {
      console.warn('Day-Night cycle: Could not find sea element (a-box with large scale)');
      // Try alternative selector
      this.seaMesh = document.querySelector('a-scene > a-box');
      if (this.seaMesh) {
        console.log('Day-Night cycle: Found sea element using alternative selector');
      }
    }
    
    // Get reference to NPC manager
    this.npcManager = document.querySelector('#npc-manager-entity');
    if (!this.npcManager) {
      console.warn('Day-Night cycle: Could not find NPC manager');
    }
    
    // Store original NPC types for reference
    this.originalNpcTypes = {};
    this.captureOriginalNpcTypes();
    
    // Initialize timing
    this.lastTick = 0;
    this.createNotificationElement();
    
    // Start in day mode
    this.setDayMode(true); // true = skip transition
    this.updateNpcManager(false);

    console.log('Day-Night cycle component initialized');
  },
  
  captureOriginalNpcTypes: function() {
    // Capture the original NPC types configuration before we start modifying it
    if (this.npcManager && this.npcManager.components && 
        this.npcManager.components['npc-manager'] && 
        this.npcManager.components['npc-manager'].system && 
        this.npcManager.components['npc-manager'].system.npcTypes) {
      
      const npcTypes = this.npcManager.components['npc-manager'].system.npcTypes;
      
      // Deep clone the configuration
      for (const type in npcTypes) {
        this.originalNpcTypes[type] = Object.assign({}, npcTypes[type]);
      }
      
      console.log('Day-Night cycle: Captured original NPC configurations');
    } else {
      console.warn('Day-Night cycle: Could not capture original NPC types');
    }
  },
  
  tick: function(time, deltaTime) {
    if (!this.data.enabled || !deltaTime) return;
    
    // Initialize lastTick on first call
    if (!this.lastTick) {
      this.lastTick = time;
      return;
    }
    
    // Calculate time in current state
    const elapsed = time - this.lastTick;
    this.timeInState += elapsed;
    this.lastTick = time;
    
    // Handle transitions
    if (this.isTransitioning) {
      this.updateTransition(this.timeInState);
      
      if (this.timeInState >= this.data.transitionDuration) {
        this.isTransitioning = false;
        this.timeInState = 0;
        
        // Complete the transition
        if (this.isNight) {
          this.completeNightTransition();
        } else {
          this.completeDayTransition();
        }
      }
    } 
    else {
      // Check if it's time to transition
      if (this.isNight) {
        if (this.timeInState >= this.data.nightDuration) {
          this.startDayTransition();
        }
      } else {
        if (this.timeInState >= this.data.dayDuration) {
          this.startNightTransition();
        }
      }
    }
  },
  
  startDayTransition: function() {
    //console.log('Starting transition to day');
    this.isTransitioning = true;
    this.timeInState = 0;
    this.isNight = false;
    
    // Notify players if enabled
    if (this.data.showNotifications) {
      this.showNotification('Sunlight returns...', '#44AA00');
    }
  },
  
  startNightTransition: function() {
    //console.log('Starting transition to night');
    this.isTransitioning = true;
    this.timeInState = 0;
    this.isNight = true;
    
    // Notify players if enabled
    if (this.data.showNotifications) {
      this.showNotification('Night is falling...', '#FF4444');
    }
  },
  
  updateTransition: function(elapsed) {
    // Calculate transition progress (0 to 1)
    const progress = Math.min(1, elapsed / this.data.transitionDuration);
    
    // Transition to night or day based on current state
    if (this.isNight) {
      this.transitionToNight(progress);
    } else {
      this.transitionToDay(progress);
    }
  },
  
  transitionToNight: function(progress) {
    // Interpolate sky color
    if (this.sky) {
      const skyColor = this.lerpColor(this.data.dayColor, this.data.nightColor, progress);
      this.sky.setAttribute('color', skyColor);
    }
    
    // Set sea color to night color when halfway through transition
    if (this.seaMesh && progress > 0.5 && !this.seaColorChanged) {
      this.seaMesh.setAttribute('color', this.data.nightWaterColor);
      this.seaColorChanged = true;
    }
    
    // Gradually adjust fog
    document.querySelector('a-scene').setAttribute('fog', {
      type: 'linear',
      color: this.lerpColor(this.data.dayColor, this.data.nightColor, progress),
      far: 365 - progress * 165 // Reduce fog distance at night (365 -> 200)
    });
    
    // Start transitioning NPC behavior gradually
    this.transitionNpcBehavior(progress, true);
  },
  
  transitionToDay: function(progress) {
    // Interpolate sky color
    if (this.sky) {
      const skyColor = this.lerpColor(this.data.nightColor, this.data.dayColor, progress);
      this.sky.setAttribute('color', skyColor);
    }
    
    // Set sea color to day color when halfway through transition
    if (this.seaMesh && progress > 0.5 && this.seaColorChanged) {
      this.seaMesh.setAttribute('color', this.data.dayWaterColor);
      this.seaColorChanged = false;
    }
    
    // Gradually adjust fog
    document.querySelector('a-scene').setAttribute('fog', {
      type: 'linear',
      color: this.lerpColor(this.data.nightColor, this.data.dayColor, progress),
      far: 200 + progress * 165 // Increase fog distance during day (200 -> 365)
    });

    // Start transitioning NPC behavior gradually
    this.transitionNpcBehavior(progress, false);
  },
  
  completeNightTransition: function() {
    // Set final night state
    this.setNightMode();
    
    // Notify players if enabled
    if (this.data.showNotifications) {
      //this.showNotification('Darkness reigns...', '#FF0000');
    }

    this.sun.setAttribute('light', 'intensity', 0.06);
    
    // Update music system without directly controlling audio
    if (window.musicSystem) {
      window.musicSystem.setNightMode();
    }
    
    // Update grass system to night mode
    if (window.grassSystem) {
      window.grassSystem.setNightMode();
    }
  },
  
  completeDayTransition: function() {
    // Set final day state
    this.setDayMode();
    
    // Notify players if enabled
    if (this.data.showNotifications) {
      //this.showNotification('The sun ascends! Safety...for now.', '#FFDD44');
    }

    this.sun.setAttribute('light', 'intensity', 4.0);
    
    // Update music system without directly controlling audio
    if (window.musicSystem) {
      window.musicSystem.setDayMode();
    }
    
    // Update grass system to day mode
    if (window.grassSystem) {
      window.grassSystem.setDayMode();
    }
  },
  
  setNightMode: function(skipTransition = false) {
    // Set visual properties
    if (this.sky) {
      this.sky.setAttribute('color', this.data.nightColor);
    }
    
    // Set sea color directly
    this.updateSeaColor(this.data.nightWaterColor);
    this.seaColorChanged = true;
    
    // Adjust fog
    document.querySelector('a-scene').setAttribute('fog', {
      type: 'linear',
      color: this.data.nightColor,
      far: 200 // Reduced visibility at night
    });
    
    // Update NPC manager for night mode
    this.updateNpcManager(true);
    
    // If we're skipping the transition, reset state variables
    if (skipTransition) {
      this.isNight = true;
      this.isTransitioning = false;
      this.timeInState = 0;
    }
  },
  
  setDayMode: function(skipTransition = false) {
    // Set visual properties
    if (this.sky) {
      this.sky.setAttribute('color', this.data.dayColor);
    }
    
    // Set sea color directly
    this.updateSeaColor(this.data.dayWaterColor);
    this.seaColorChanged = false;
    
    // Adjust fog
    document.querySelector('a-scene').setAttribute('fog', {
      type: 'linear',
      color: this.data.dayColor,
      far: 365 // Better visibility during day
    });
    
    // Update NPC manager for day mode
    this.updateNpcManager(false);
    
    // If we're skipping the transition, reset state variables
    if (skipTransition) {
      this.isNight = false;
      this.isTransitioning = false;
      this.timeInState = 0;
    }
  },
  
  updateSeaColor: function(color) {
    // Try multiple approaches to update the sea color
    try {
      if (this.seaMesh) {
        //console.log('Updating sea color to:', color);
        this.seaMesh.setAttribute('color', color);
        
        // Direct manipulation as fallback
        if (this.seaMesh.object3D && this.seaMesh.object3D.children && this.seaMesh.object3D.children.length > 0) {
          const mesh = this.seaMesh.object3D.children[0];
          if (mesh && mesh.material) {
            mesh.material.color.set(color);
            mesh.material.needsUpdate = true;
          }
        }
      } else {
        // Try to find it again if reference is lost
        this.seaMesh = document.querySelector('a-box[scale="1000 0.01 1000"]') || 
                     document.querySelector('a-scene > a-box');
        
        if (this.seaMesh) {
          this.seaMesh.setAttribute('color', color);
        }
      }
    } catch (error) {
      console.warn('Failed to update sea color:', error);
    }
  },
  
  updateNpcManager: function(isNight) {
    // Get the NPC manager system
    const npcSystem = document.querySelector('a-scene').systems['npc-manager'];
    
    if (!npcSystem) {
      console.warn('Day-Night cycle: Could not find NPC manager system');
      return;
    }
    
    // Modify spawn rates based on time of day
    const npcTypes = npcSystem.npcTypes;
    
    if (isNight) {
      // Night mode: only spawn glassts
      for (const type in npcTypes) {
        // Set spawn rate to 0 for all except glassts
        if (type === 'glasst') {
          npcTypes[type].spawnChance = 1.0; // 100% chance to spawn glassts
          npcTypes[type].speed = 12.0; // Make them faster at night
          npcTypes[type].targetID = '#player';
          npcTypes[type].flee = false; // Make sure they chase, not flee
        } else {
          npcTypes[type].spawnChance = 0.0; // Don't spawn other types
        }
      }
      
      // Increase max NPCs during night for more danger
      if (npcSystem.data) {
        npcSystem.data.maxNPCs = 15; // More NPCs at night
      }
      
    } else {
      // Day mode: only spawn shelbies
      for (const type in npcTypes) {
        // Reset to original values if we have them
        if (this.originalNpcTypes[type]) {
          // During day, only spawn shelbies
          if (type === 'shelby') {
            npcTypes[type].spawnChance = 1.0; // 100% chance to spawn shelbies
          } else {
            npcTypes[type].spawnChance = 0.0; // Don't spawn other types
          }
          
          // Reset other properties to original values
          npcTypes[type].speed = this.originalNpcTypes[type].speed;
          npcTypes[type].flee = this.originalNpcTypes[type].flee;
        }
      }
      
      // Reset max NPCs during day
      if (npcSystem.data) {
        npcSystem.data.maxNPCs = 8; // Fewer NPCs during day
      }
    }
    
    //console.log(`Day-Night cycle: Updated NPC behavior for ${isNight ? 'night' : 'day'} mode`);
    
    // Force respawn some NPCs with the new behavior
    this.respawnSomeNpcs(npcSystem);
  },
  
  transitionNpcBehavior: function(progress, toNight) {
    // Get the NPC manager system
    const npcSystem = document.querySelector('a-scene').systems['npc-manager'];
    
    if (!npcSystem || !npcSystem.npcs) return;
    
    // Adjust behavior of existing NPCs during transition
    for (const npc of npcSystem.npcs) {
      if (!npc.el || !npc.el.components || !npc.el.components['ai-locomotion']) continue;
      
      const aiComponent = npc.el.components['ai-locomotion'];
      
      if (toNight) {
        // Transitioning to night: gradually speed up glassts
        if (npc.type === 'glasst') {
          const originalSpeed = this.originalNpcTypes.glasst ? 
                              this.originalNpcTypes.glasst.speed : 7;
          const nightSpeed = 12.0;
          
          // Interpolate speed
          aiComponent.data.speed = originalSpeed + progress * (nightSpeed - originalSpeed);
        }
      } else {
        // Transitioning to day: gradually slow down glassts
        if (npc.type === 'glasst') {
          const originalSpeed = this.originalNpcTypes.glasst ? 
                              this.originalNpcTypes.glasst.speed : 7;
          const nightSpeed = 12.0;
          
          // Interpolate speed
          aiComponent.data.speed = nightSpeed - progress * (nightSpeed - originalSpeed);
        }
      }
    }
  },
  
  respawnSomeNpcs: function(npcSystem) {
    // Force some NPCs to respawn with the new behavior
    // First deactivate some NPCs
    const activeNpcs = Array.from(npcSystem.activeNPCs);
    
    // Deactivate half of the active NPCs
    for (let i = 0; i < activeNpcs.length / 2; i++) {
      if (activeNpcs[i]) {
        npcSystem.deactivateNPC(activeNpcs[i]);
      }
    }
    
    // Let the system naturally respawn new ones
  },
  
  createNotificationElement: function() {
    // Create element for notifications
    this.notificationEl = document.createElement('div');
    Object.assign(this.notificationEl.style, {
      position: 'fixed',
      top: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 24px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontWeight: 'bold',
      borderRadius: '8px',
      zIndex: '1000',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.5s ease-in-out',
      textAlign: 'center',
      textShadow: '0 0 8px rgba(0, 0, 0, 0.8)'
    });
    
    document.body.appendChild(this.notificationEl);
  },
  
  showNotification: function(message, color = '#FFFFFF') {
    if (!this.notificationEl) return;
    
    // Update content
    this.notificationEl.textContent = message;
    this.notificationEl.style.color = color;
    
    // Show notification
    this.notificationEl.style.opacity = '1';
    
    // Clear any existing timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    // Hide after a delay
    this.notificationTimeout = setTimeout(() => {
      this.notificationEl.style.opacity = '0';
    }, 4000);
  },
  
  playSound: function(type) {
    // Play sound effect if available
    try {
      const soundID = type === 'night' ? 'night-sound' : 'day-sound';
      const soundEntity = document.querySelector(`#${soundID}`);
      
      if (soundEntity) {
        soundEntity.components.sound.playSound();
      } else {
        // Create temporary sound entity if it doesn't exist
        const sound = document.createElement('a-entity');
        sound.setAttribute('id', soundID);
        sound.setAttribute('sound', {
          src: type === 'night' ? './assets/eigengrau_light.mp3' : './assets/pixel_wonder.mp3',
          volume: 0.7,
          poolSize: 1
        });
        document.querySelector('a-scene').appendChild(sound);
        
        // Play after a brief delay to ensure loading
        setTimeout(() => {
          if (sound.components.sound) {
            sound.components.sound.playSound();
          }
        }, 100);
      }
    } catch (error) {
      console.warn(`Could not play ${type} sound:`, error);
    }
  },
  
  lerpColor: function(colorA, colorB, t) {
    // Helper function to linearly interpolate between two colors
    const a = new THREE.Color(colorA);
    const b = new THREE.Color(colorB);
    
    const r = a.r + (b.r - a.r) * t;
    const g = a.g + (b.g - a.g) * t;
    const b_ = a.b + (b.b - a.b) * t;
    
    return `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b_ * 255)})`;
  },
  
  remove: function() {
    // Cleanup
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    if (this.notificationEl && this.notificationEl.parentNode) {
      this.notificationEl.parentNode.removeChild(this.notificationEl);
    }
    
    // Restore original NPC settings
    this.restoreOriginalNpcSettings();
  },
  
  restoreOriginalNpcSettings: function() {
    // Get the NPC manager system
    const npcSystem = document.querySelector('a-scene').systems['npc-manager'];
    
    if (!npcSystem) return;
    
    // Restore original NPC type configurations
    for (const type in this.originalNpcTypes) {
      if (npcSystem.npcTypes[type]) {
        // Restore all properties from the original
        for (const prop in this.originalNpcTypes[type]) {
          npcSystem.npcTypes[type][prop] = this.originalNpcTypes[type][prop];
        }
      }
    }
    
    //console.log('Day-Night cycle: Restored original NPC configurations');
  }
});