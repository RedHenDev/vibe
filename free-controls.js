// Free controls with pointer lock for desktop and touch support for mobile
AFRAME.registerComponent('free-controls', {
    schema: {
      enabled: {default: true},
      sensitivity: {default: 2.0},
      mobileSensitivity: {default: 1.0},        // Separate sensitivity for touch devices
      bannerText: {default: 'Press ESC to exit mouse look, F to toggle fullscreen'},
      showFullscreenTip: {default: true}
    },
  
    init: function() {
      this.canvasEl = document.querySelector('canvas');
      this.pointerLocked = false;
      
      // Check if we're on a mobile device
      this.isMobile = AFRAME.utils.device.isMobile();
      console.log("Device detected as mobile:", this.isMobile);
      
      // Important: Get the correct camera reference
      this.cameraEl = this.el;
      this.camera = this.el.object3D;
      
      // Log for debugging
      console.log("Camera element:", this.cameraEl);
      console.log("Camera object3D:", this.camera);
      
      // Touch state tracking
      this.touchActive = false;
      this.lastTouchX = 0;
      this.lastTouchY = 0;
      
      // Bind methods
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onPointerLockChange = this.onPointerLockChange.bind(this);
      this.onPointerLockError = this.onPointerLockError.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onFullscreenChange = this.onFullscreenChange.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      
      // Setup event listeners based on device type
      if (this.isMobile) {
        this.setupTouchControls();
      } else {
        this.setupMouseControls();
      }
      
      // Track fullscreen state
      this.isFullscreen = !!(document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement || 
                             document.msFullscreenElement);
      
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
      document.addEventListener('mozfullscreenchange', this.onFullscreenChange);
      document.addEventListener('MSFullscreenChange', this.onFullscreenChange);
      
      console.log("Free controls initialized for", this.isMobile ? "mobile" : "desktop");
    },
    
    setupMouseControls: function() {
      // Disable A-Frame's default look controls
      if (this.cameraEl.getAttribute('look-controls') !== null) {
        this.cameraEl.setAttribute('look-controls', 'enabled', false);
        console.log("Disabled A-Frame's default look controls");
      }
      
      // Initial click to request pointer lock
      this.canvasEl.addEventListener('click', this.onMouseDown);
      
      // Set up pointer lock change and error event listeners
      document.addEventListener('pointerlockchange', this.onPointerLockChange);
      document.addEventListener('mozpointerlockchange', this.onPointerLockChange);
      document.addEventListener('webkitpointerlockchange', this.onPointerLockChange);
      
      document.addEventListener('pointerlockerror', this.onPointerLockError);
      document.addEventListener('mozpointerlockerror', this.onPointerLockError);
      document.addEventListener('webkitpointerlockerror', this.onPointerLockError);
      
      // Listen for keyboard events
      document.addEventListener('keydown', this.onKeyDown);
    },
    
    setupTouchControls: function() {
      console.log("Setting up touch controls for mobile");
      
      // Disable A-Frame's default look controls for consistency
      if (this.cameraEl.getAttribute('look-controls') !== null) {
        this.cameraEl.setAttribute('look-controls', 'enabled', false);
        console.log("Disabled A-Frame's default look controls on mobile");
      }
      
      // Add touch event listeners
      this.canvasEl.addEventListener('touchstart', this.onTouchStart, false);
      this.canvasEl.addEventListener('touchmove', this.onTouchMove, false);
      this.canvasEl.addEventListener('touchend', this.onTouchEnd, false);
      
      // Prevent default touch behaviors like scrolling
      this.canvasEl.style.touchAction = 'none';
      document.body.style.touchAction = 'none';
      
      // Create a small indicator for touch mode
      this.createTouchIndicator();
    },
    
    createTouchIndicator: function() {
      // Create a small indicator showing touch mode is active
      const indicator = document.createElement('div');
      indicator.style.position = 'fixed';
      indicator.style.bottom = '10px';
      indicator.style.right = '10px';
      indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      indicator.style.color = 'white';
      indicator.style.padding = '5px 8px';
      indicator.style.borderRadius = '4px';
      indicator.style.fontSize = '12px';
      indicator.style.fontFamily = 'Arial, sans-serif';
      indicator.style.zIndex = '999';
      indicator.style.opacity = '0.7';
      indicator.textContent = 'Drag to look';
      
      document.body.appendChild(indicator);
      
      // Fade out after 5 seconds
      setTimeout(function() {
        indicator.style.transition = 'opacity 1s ease-out';
        indicator.style.opacity = '0';
        setTimeout(function() {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 1000);
      }, 5000);
      
      this.touchIndicator = indicator;
    },
    
    onMouseDown: function(event) {
      // Don't request if we're clicking on UI elements
      if (event.target.closest('.a-enter-vr') || 
          event.target.closest('.a-orientation-modal') ||
          event.target.closest('.look-toggle-btn')) {
        return;
      }
      
      if (!this.pointerLocked) {
        // Request pointer lock on the canvas
        this.canvasEl.requestPointerLock = this.canvasEl.requestPointerLock ||
                                           this.canvasEl.mozRequestPointerLock ||
                                           this.canvasEl.webkitRequestPointerLock;
        
        // Request pointer lock
        this.canvasEl.requestPointerLock();
      }
    },
    
    onTouchStart: function(event) {
      if (!this.data.enabled) return;
      
      // Prevent default behavior (scrolling, zooming)
      event.preventDefault();
      
      // Store the initial touch position
      if (event.touches.length === 1) {
        this.touchActive = true;
        this.lastTouchX = event.touches[0].clientX;
        this.lastTouchY = event.touches[0].clientY;
        
        console.log("Touch start at:", this.lastTouchX, this.lastTouchY);
      }
    },
    
    onTouchMove: function(event) {
      if (!this.touchActive || !this.data.enabled) return;
      
      // Prevent default behavior
      event.preventDefault();
      
      if (event.touches.length === 1) {
        // Get current touch position
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;
        
        // Calculate movement
        const movementX = touchX - this.lastTouchX;
        const movementY = touchY - this.lastTouchY;
        
        // Debug first few touch movements
        if (this.touchDebugCount === undefined) {
          this.touchDebugCount = 0;
        }
        
        if (this.touchDebugCount < 5) {
          console.log("Touch movement:", movementX, movementY);
          this.touchDebugCount++;
        }
        
        // Update camera rotation based on touch movement
        // Note: mobile usually requires different sensitivity than mouse
        const sensitivity = this.data.mobileSensitivity / 200; // Higher divisor for touch
        
        // Apply X movement to Y rotation (yaw)
        this.camera.rotation.y -= movementX * sensitivity;
        
        // Apply Y movement to X rotation (pitch) with clamping
        const currentPitch = this.camera.rotation.x;
        const newPitch = currentPitch - movementY * sensitivity;
        
        // Clamp vertical look between -90 and 90 degrees
        this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, newPitch));
        
        // Store current position for next move
        this.lastTouchX = touchX;
        this.lastTouchY = touchY;
      }
    },
    
    onTouchEnd: function(event) {
      // End touch tracking
      this.touchActive = false;
    },
    
    onPointerLockChange: function() {
      // Check if we now have pointerlock
      if (document.pointerLockElement === this.canvasEl ||
          document.mozPointerLockElement === this.canvasEl ||
          document.webkitPointerLockElement === this.canvasEl) {
        
        // Pointer is locked, add mousemove listener
        this.pointerLocked = true;
        document.addEventListener('mousemove', this.onMouseMove, false);
        
        console.log('Pointer locked');
      } else {
        // Pointer is unlocked, remove mousemove listener
        this.pointerLocked = false;
        document.removeEventListener('mousemove', this.onMouseMove, false);
        
        console.log('Pointer unlocked');
        
        // If in fullscreen and just exited pointer lock, show a hint about F key
        if (this.isFullscreen && this.data.showFullscreenTip) {
          this.showFullscreenReminder();
        }
      }
    },
    
    onPointerLockError: function() {
      console.error('Error obtaining pointer lock');
    },
    
    onMouseMove: function(event) {
      if (!this.pointerLocked || !this.data.enabled) return;
      
      // Calculate rotation based on mouse movement
      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
      
      // Adjust rotation sensitivity
      const sensitivity = this.data.sensitivity / 1000;
      
      // Debug output for first few movements
      if (this.debugCount === undefined) {
        this.debugCount = 0;
      }
      
      if (this.debugCount < 5) {
        console.log("Mouse movement:", movementX, movementY);
        console.log("Current camera rotation:", this.camera.rotation);
        this.debugCount++;
      }
      
      // Apply mouse X movement to camera Y rotation (yaw)
      this.camera.rotation.y -= movementX * sensitivity;
      
      // Apply mouse Y movement to camera X rotation (pitch), but clamp it
      const currentPitch = this.camera.rotation.x;
      const newPitch = currentPitch - movementY * sensitivity;
      
      // Clamp vertical look between -90 and 90 degrees
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, newPitch));
    },
    
    onKeyDown: function(event) {
      // Handle F key for toggling fullscreen
      if (event.key === 'f' || event.key === 'F') {
        this.toggleFullscreen();
      }
    },
    
    onFullscreenChange: function() {
      // Update fullscreen state
      this.isFullscreen = !!(document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement || 
                             document.msFullscreenElement);
    },
    
    toggleFullscreen: function() {
      if (!this.isFullscreen) {
        // Enter fullscreen
        const element = document.documentElement;
        
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
          element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          element.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    },
    
    showFullscreenReminder: function() {
      // Create a reminder message
      const reminder = document.createElement('div');
      reminder.style.position = 'fixed';
      reminder.style.bottom = '50px';
      reminder.style.left = '50%';
      reminder.style.transform = 'translateX(-50%)';
      reminder.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      reminder.style.color = 'white';
      reminder.style.padding = '10px 15px';
      reminder.style.borderRadius = '5px';
      reminder.style.fontSize = '16px';
      reminder.style.fontFamily = 'Arial, sans-serif';
      reminder.style.zIndex = '9999';
      reminder.style.transition = 'opacity 0.5s ease-in-out';
      reminder.textContent = 'Press F to toggle fullscreen mode';
      
      document.body.appendChild(reminder);
      
      // Fade out and remove after 3 seconds
      setTimeout(function() {
        reminder.style.opacity = '0';
        setTimeout(function() {
          if (reminder.parentNode) {
            reminder.parentNode.removeChild(reminder);
          }
        }, 500);
      }, 3000);
    },
    
    remove: function() {
      // Clean up event listeners - desktop
      this.canvasEl.removeEventListener('click', this.onMouseDown);
      
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
      document.removeEventListener('mozpointerlockchange', this.onPointerLockChange);
      document.removeEventListener('webkitpointerlockchange', this.onPointerLockChange);
      
      document.removeEventListener('pointerlockerror', this.onPointerLockError);
      document.removeEventListener('mozpointerlockerror', this.onPointerLockError);
      document.removeEventListener('webkitpointerlockerror', this.onPointerLockError);
      
      document.removeEventListener('mousemove', this.onMouseMove);
      
      // Clean up event listeners - mobile
      this.canvasEl.removeEventListener('touchstart', this.onTouchStart);
      this.canvasEl.removeEventListener('touchmove', this.onTouchMove);
      this.canvasEl.removeEventListener('touchend', this.onTouchEnd);
      
      // Clean up keyboard and fullscreen listeners
      document.removeEventListener('keydown', this.onKeyDown);
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', this.onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', this.onFullscreenChange);
      
      // Remove touch indicator if it exists
      if (this.touchIndicator && this.touchIndicator.parentNode) {
        this.touchIndicator.parentNode.removeChild(this.touchIndicator);
      }
    }
  });