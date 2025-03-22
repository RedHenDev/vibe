// Improved pointer lock controls with banner overlay
AFRAME.registerComponent('free-controls', {
    schema: {
      enabled: {default: true},
      sensitivity: {default: 2.0},
      bannerText: {default: 'Press ESC to exit mouse look, F to toggle fullscreen'},
      showFullscreenTip: {default: true}
    },
  
    init: function() {
      this.canvasEl = document.querySelector('canvas');
      this.pointerLocked = false;
      
      // Important: Get the correct camera reference
      // this.el is the entity with the component (the camera)
      this.cameraEl = this.el;
      this.camera = this.el.object3D;
      
      // Log for debugging
      console.log("Camera element:", this.cameraEl);
      console.log("Camera object3D:", this.camera);
      
      // Bind methods
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onPointerLockChange = this.onPointerLockChange.bind(this);
      this.onPointerLockError = this.onPointerLockError.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onFullscreenChange = this.onFullscreenChange.bind(this);
      
      // Setup event listeners
      this.setupMouseControls();
      
      // Create our custom banner that will cover the browser's banner
      //this.createCustomBanner();
      
      // Track fullscreen state
      this.isFullscreen = !!(document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement || 
                             document.msFullscreenElement);
      
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
      document.addEventListener('mozfullscreenchange', this.onFullscreenChange);
      document.addEventListener('MSFullscreenChange', this.onFullscreenChange);
      
      console.log("Improved pointer lock controls initialized");
    },
    
    /*
    createCustomBanner: function() {
      // Create a banner that will display above the browser's pointer lock banner
      // to give users an alternative instruction
      this.customBanner = document.createElement('div');
      this.customBanner.style.position = 'fixed';
      this.customBanner.style.top = '0';
      this.customBanner.style.left = '0';
      this.customBanner.style.width = '100%';
      this.customBanner.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      this.customBanner.style.color = 'white';
      this.customBanner.style.padding = '10px';
      this.customBanner.style.textAlign = 'center';
      this.customBanner.style.zIndex = '10000'; // Very high z-index to be above browser UI
      this.customBanner.style.fontSize = '14px';
      this.customBanner.style.fontFamily = 'Arial, sans-serif';
      this.customBanner.style.transition = 'opacity 0.3s ease-in-out';
      this.customBanner.style.opacity = '0';
      this.customBanner.style.pointerEvents = 'none'; // Let mouse events pass through
      this.customBanner.textContent = this.data.bannerText;
      
      document.body.appendChild(this.customBanner);
    },
    */
    
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
    
    onPointerLockChange: function() {
      // Check if we now have pointerlock
      if (document.pointerLockElement === this.canvasEl ||
          document.mozPointerLockElement === this.canvasEl ||
          document.webkitPointerLockElement === this.canvasEl) {
        
        // Pointer is locked, add mousemove listener
        this.pointerLocked = true;
        document.addEventListener('mousemove', this.onMouseMove, false);
        
        // Show our custom banner
        //this.customBanner.style.opacity = '1';
        
        console.log('Pointer locked');
      } else {
        // Pointer is unlocked, remove mousemove listener
        this.pointerLocked = false;
        document.removeEventListener('mousemove', this.onMouseMove, false);
        
        // Hide our custom banner
        //this.customBanner.style.opacity = '0';
        
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
      
        /*
      // Update banner text based on fullscreen state
      if (this.isFullscreen) {
        this.customBanner.textContent = 'Press ESC to exit mouse look, F to exit fullscreen';
      } else {
        this.customBanner.textContent = this.data.bannerText;
      }
        */
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
      // Clean up event listeners
      this.canvasEl.removeEventListener('click', this.onMouseDown);
      
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
      document.removeEventListener('mozpointerlockchange', this.onPointerLockChange);
      document.removeEventListener('webkitpointerlockchange', this.onPointerLockChange);
      
      document.removeEventListener('pointerlockerror', this.onPointerLockError);
      document.removeEventListener('mozpointerlockerror', this.onPointerLockError);
      document.removeEventListener('webkitpointerlockerror', this.onPointerLockError);
      
      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('keydown', this.onKeyDown);
      
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', this.onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', this.onFullscreenChange);
      
      // Remove custom banner
      if (this.customBanner && this.customBanner.parentNode) {
        this.customBanner.parentNode.removeChild(this.customBanner);
      }
    }
  });