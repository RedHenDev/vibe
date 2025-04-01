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
    dayDuration: { type: 'number', default: 60000 }, // 1 minute for day (in ms)
    nightDuration: { type: 'number', default: 120000 }, // 2 minutes for night (in ms)
    transitionDuration: { type: 'number', default: 5000 }, // 5 seconds for transition (in ms)
    dayColor: { type: 'color', default: '#00DDFF' }, // Day sky color
    nightColor: { type: 'color', default: '#001133' }, // Night sky color
    dayWaterColor: { type: 'color', default: '#DD00DD' }, // Day water color
    nightWaterColor: { type: 'color', default: '#770000' }, // Night water color (red)
    showNotifications: { type: 'boolean', default: true }, // Whether to show UI notifications
    countdownDisplay: { type: 'boolean', default: true } // Show countdown to next time change
  },
  
  init: function() {
    // Current state - expose as public property
    this.isNight = false;
    this.isTransitioning = false;
    this.timeInState = 0;
    
    // Get references to scene elements
    this.sky = document.querySelector('a-sky');
    this.sun = document.querySelector('#hamlet');

    // The sea is implemented as a-box inside the a-scene
    this.seaMesh = document.querySelector('a-box[scale="1000 0.01 1000"]');
    
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
    this.npcManager = document.querySelector('a-scene').systems['npc-manager'];
    if (!this.npcManager) {
      console.warn('Day-Night cycle: Could not find NPC manager system');
    }
    
    // Initialize timing
    this.lastTick = 0;
    this.createNotificationElement();
    
    // Create countdown display if enabled
    if (this.data.countdownDisplay) {
      this.createCountdownDisplay();
    }
    
    // Start in day mode
    this.setDayMode(true); // true = skip transition
    
    console.log('Day-Night cycle component initialized');
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
    
    // Update countdown display if enabled
    if (this.data.countdownDisplay && this.countdownEl) {
      this.updateCountdown();
    }
    
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
  
  createCountdownDisplay: function() {
    // Create element for countdown display
    this.countdownEl = document.createElement('div');
    Object.assign(this.countdownEl.style, {
      position: 'fixed',
      top: '180px',
      left: '10px',
      padding: '8px 15px',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      borderRadius: '5px',
      zIndex: '999',
      pointerEvents: 'none'
    });
    
    document.body.appendChild(this.countdownEl);
    this.updateCountdown();
  },
  
  updateCountdown: function() {
    if (!this.countdownEl) return;
    
    // Calculate time remaining
    let timeRemaining;
    let totalDuration;
    
    if (this.isTransitioning) {
      timeRemaining = this.data.transitionDuration - this.timeInState;
      totalDuration = this.data.transitionDuration;
    } else if (this.isNight) {
      timeRemaining = this.data.nightDuration - this.timeInState;
      totalDuration = this.data.nightDuration;
    } else {
      timeRemaining = this.data.dayDuration - this.timeInState;
      totalDuration = this.data.dayDuration;
    }
    
    // Convert to seconds
    const secondsRemaining = Math.ceil(timeRemaining / 1000);
    const minutesRemaining = Math.floor(secondsRemaining / 60);
    const secondsPart = secondsRemaining % 60;
    
    // Update display
    let displayText;
    let stateText;
    
    if (this.isTransitioning) {
      stateText = this.isNight ? "Night falling" : "Dawn breaking";
    } else if (this.isNight) {
      stateText = "Night time";
    } else {
      stateText = "Day time";
    }
    
    // Format time as MM:SS
    displayText = `${stateText}: ${minutesRemaining}:${secondsPart < 10 ? '0' : ''}${secondsPart}`;
    
    // Add icon based on state
    const icon = this.isNight ? '🌙' : '☀️';
    
    // Set text and color
    this.countdownEl.textContent = `${icon} ${displayText}`;
    
    // Set color based on state
    if (this.isNight) {
      this.countdownEl.style.backgroundColor = 'rgba(0, 20, 60, 0.7)';
    } else {
      this.countdownEl.style.backgroundColor = 'rgba(80, 140, 200, 0.7)';
    }
  },
  
  startDayTransition: function() {
    console.log('Starting transition to day');
    this.isTransitioning = true;
    this.timeInState = 0;
    this.isNight = false;
    
    // Notify players if enabled
    if (this.data.showNotifications) {
      this.showNotification('Sunlight returns...', '#44AA00');
    }
  },
  
  startNightTransition: function() {
    console.log('Starting transition to night');
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
  },
  
  completeNightTransition: function() {
    // Set final night state
    this.setNightMode();
    
    // Notify players if enabled
    if (this.data.showNotifications) {
      this.showNotification('Darkness reigns...', '#FF0000');
    }

    // Adjust sun brightness
    if (this.sun) {
      this.sun.setAttribute('light', 'intensity', 0.06);
    }
    
    // Update music system without directly controlling audio
    if (window.musicSystem) {
      window.musicSystem.setNightMode();
    }
    
    // Update grass system to night mode
    if (window.grassSystem) {
      window.grassSystem.setNightMode();
    }
    
    // Notify the NPC manager about the time change
    this.notifyNpcManager(true);
  },
  
  completeDayTransition: function() {
    // Set final day state
    this.setDayMode();
    
    // Notify players if enabled
    if (this.data.showNotifications) {
      //this.showNotification('The sun ascends! Safety...for now.', '#FFDD44');
    }

    // Adjust sun brightness
    if (this.sun) {
      this.sun.setAttribute('light', 'intensity', 4.0);
    }
    
    // Update music system without directly controlling audio
    if (window.musicSystem) {
      window.musicSystem.setDayMode();
    }
    
    // Update grass system to day mode
    if (window.grassSystem) {
      window.grassSystem.setDayMode();
    }
    
    // Notify the NPC manager about the time change
    this.notifyNpcManager(false);
  },
  
  notifyNpcManager: function(isNight) {
    // Get the NPC manager system
    const npcSystem = document.querySelector('a-scene').systems['npc-manager'];
    
    if (npcSystem && typeof npcSystem.handleTimeChange === 'function') {
      // Call the handler method to update NPCs based on time change
      npcSystem.handleTimeChange(isNight);
    } else {
      console.warn('Day-Night cycle: Could not notify NPC manager about time change');
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
    
    // If we're skipping the transition, reset state variables
    if (skipTransition) {
      this.isNight = true;
      this.isTransitioning = false;
      this.timeInState = 0;
      
      // Notify the NPC manager directly
      this.notifyNpcManager(true);
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
    
    // If we're skipping the transition, reset state variables
    if (skipTransition) {
      this.isNight = false;
      this.isTransitioning = false;
      this.timeInState = 0;
      
      // Notify the NPC manager directly
      this.notifyNpcManager(false);
    }
  },
  
  updateSeaColor: function(color) {
    // Try multiple approaches to update the sea color
    try {
      if (this.seaMesh) {
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
    
    if (this.countdownEl && this.countdownEl.parentNode) {
      this.countdownEl.parentNode.removeChild(this.countdownEl);
    }
  }
});