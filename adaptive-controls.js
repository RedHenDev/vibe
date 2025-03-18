// Adaptive controls - handles both desktop (pointer lock) and mobile (touch) controls
AFRAME.registerComponent('adaptive-controls', {
    schema: {
      enabled: {default: true},
      sensitivity: {default: 2.0}
    },
  
    init: function () {
      this.isMobile = AFRAME.utils.device.isMobile();
      this.camera = document.querySelector('#cam');
      this.canvasEl = document.querySelector('canvas');
      this.pointerLocked = false;
      this.previousMouseEvent = null;
  
      console.log("Device detected:", this.isMobile ? "Mobile" : "Desktop");
      
      if (this.isMobile) {
        this.setupMobileControls();
      } else {
        this.setupDesktopControls();
      }
    },
  
    setupMobileControls: function () {
      console.log("Setting up mobile controls");
      
      // Enable A-Frame's built-in look controls for mobile
      this.camera.setAttribute('look-controls', 'enabled: true; touchEnabled: true; magicWindowEnabled: true');
      
      // Create mobile instructions
      this.createMobileInstructions();
    },
  
    createMobileInstructions: function () {
      // Create mobile-friendly instructions
      this.instructionsEl = document.createElement('div');
      this.instructionsEl.style.position = 'absolute';
      this.instructionsEl.style.bottom = '20px';
      this.instructionsEl.style.left = '50%';
      this.instructionsEl.style.transform = 'translateX(-50%)';
      this.instructionsEl.style.textAlign = 'center';
      this.instructionsEl.style.width = '80%';
      this.instructionsEl.style.color = 'white';
      this.instructionsEl.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      this.instructionsEl.style.padding = '10px';
      this.instructionsEl.style.borderRadius = '5px';
      this.instructionsEl.style.zIndex = '999';
      this.instructionsEl.innerHTML = 'Drag to look around';
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (this.instructionsEl && this.instructionsEl.parentNode) {
          this.instructionsEl.style.opacity = '0';
          this.instructionsEl.style.transition = 'opacity 1s ease-in-out';
          setTimeout(() => {
            if (this.instructionsEl && this.instructionsEl.parentNode) {
              this.instructionsEl.parentNode.removeChild(this.instructionsEl);
            }
          }, 1000);
        }
      }, 5000);
      
      document.body.appendChild(this.instructionsEl);
    },
  
    setupDesktopControls: function () {
      console.log("Setting up desktop controls");
      
      // Disable A-Frame's default look controls
      this.camera.setAttribute('look-controls', 'enabled: false');
      
      // Add click listener to entire canvas for pointer lock
      this.canvasEl.addEventListener('click', this.requestPointerLock.bind(this));
      
      // Set up pointer lock event listeners
      document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
      document.addEventListener('mozpointerlockchange', this.onPointerLockChange.bind(this));
      document.addEventListener('webkitpointerlockchange', this.onPointerLockChange.bind(this));
      
      document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
      document.addEventListener('mozpointerlockerror', this.onPointerLockError.bind(this));
      document.addEventListener('webkitpointerlockerror', this.onPointerLockError.bind(this));
      
      // Mouse move handler for camera rotation
      this.onMouseMove = this.onMouseMove.bind(this);
      
      // Create desktop instructions that auto-hide
      this.createDesktopInstructions();
    },
  
    createDesktopInstructions: function () {
      // Create a more subtle, auto-hiding instruction overlay for desktop
      this.instructionsEl = document.createElement('div');
      this.instructionsEl.style.position = 'absolute';
      this.instructionsEl.style.top = '50%';
      this.instructionsEl.style.left = '50%';
      this.instructionsEl.style.transform = 'translate(-50%, -50%)';
      this.instructionsEl.style.textAlign = 'center';
      this.instructionsEl.style.width = '100%';
      this.instructionsEl.style.color = 'white';
      this.instructionsEl.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      this.instructionsEl.style.padding = '10px';
      this.instructionsEl.style.zIndex = '999';
      this.instructionsEl.style.cursor = 'pointer';
      this.instructionsEl.innerHTML = 'Click to look around freely<br>WASD/Arrow keys to move, Shift to toggle run';
      
      // Add a close button
      const closeButton = document.createElement('div');
      closeButton.style.position = 'absolute';
      closeButton.style.top = '5px';
      closeButton.style.right = '10px';
      closeButton.style.color = 'white';
      closeButton.style.fontSize = '20px';
      closeButton.style.cursor = 'pointer';
      closeButton.textContent = '×';
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering pointer lock
        this.hideInstructions();
      });
      
      this.instructionsEl.appendChild(closeButton);
      document.body.appendChild(this.instructionsEl);
      
      // Add click handler to instructions for pointer lock
      this.instructionsEl.addEventListener('click', this.requestPointerLock.bind(this));
      
      // Auto-hide after 8 seconds
      setTimeout(() => {
        this.hideInstructions();
      }, 8000);
    },
    
    hideInstructions: function() {
      if (this.instructionsEl && this.instructionsEl.parentNode) {
        this.instructionsEl.style.opacity = '0';
        this.instructionsEl.style.transition = 'opacity 1s ease-in-out';
        setTimeout(() => {
          if (this.instructionsEl && this.instructionsEl.parentNode) {
            this.instructionsEl.parentNode.removeChild(this.instructionsEl);
            this.instructionsEl = null;
          }
        }, 1000);
      }
    },
  
    requestPointerLock: function (event) {
      // Don't request if we're clicking on A-Frame UI elements (like the fullscreen button)
      if (event && event.target) {
        const target = event.target;
        // Check if we're clicking on the A-Frame UI or any child of it
        if (target.closest('.a-enter-vr') || target.closest('.a-orientation-modal')) {
          console.log("Clicked on A-Frame UI, ignoring pointer lock request");
          return;
        }
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
  
    onPointerLockChange: function () {
      // Check if we now have pointerlock
      if (document.pointerLockElement === this.canvasEl ||
          document.mozPointerLockElement === this.canvasEl ||
          document.webkitPointerLockElement === this.canvasEl) {
        
        // Pointer is locked, add mousemove listener
        this.pointerLocked = true;
        
        // Hide instructions if they're still visible
        if (this.instructionsEl) {
          this.hideInstructions();
        }
        
        document.addEventListener('mousemove', this.onMouseMove, false);
        console.log('Pointer locked');
      } else {
        // Pointer is unlocked, remove mousemove listener
        this.pointerLocked = false;
        document.removeEventListener('mousemove', this.onMouseMove, false);
        console.log('Pointer unlocked');
      }
    },
  
    onPointerLockError: function () {
      console.error('Error obtaining pointer lock');
      if (this.instructionsEl) {
        this.instructionsEl.innerHTML = 
          'Error enabling look controls. Click again to retry.<br>' +
          'Make sure you\'re using a supported browser and are clicking on the game area.';
      }
    },
  
    onMouseMove: function (event) {
      if (!this.pointerLocked || !this.data.enabled) return;
      
      // Get camera and its parent (rig)
      const camera = this.camera.object3D;
      
      // Calculate rotation based on mouse movement
      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
      
      // Adjust rotation sensitivity
      const sensitivity = this.data.sensitivity / 1000;
      
      // Apply mouse X movement to camera Y rotation (yaw)
      camera.rotation.y -= movementX * sensitivity;
      
      // Apply mouse Y movement to camera X rotation (pitch), but clamp it
      const currentPitch = camera.rotation.x;
      const newPitch = currentPitch - movementY * sensitivity;
      
      // Clamp vertical look between -90 and 90 degrees
      camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, newPitch));
    },
    
    remove: function () {
      // Clean up event listeners based on device type
      if (!this.isMobile) {
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        document.removeEventListener('mozpointerlockchange', this.onPointerLockChange);
        document.removeEventListener('webkitpointerlockchange', this.onPointerLockChange);
        
        document.removeEventListener('pointerlockerror', this.onPointerLockError);
        document.removeEventListener('mozpointerlockerror', this.onPointerLockError);
        document.removeEventListener('webkitpointerlockerror', this.onPointerLockError);
        
        document.removeEventListener('mousemove', this.onMouseMove);
      }
      
      // Remove instruction element
      if (this.instructionsEl && this.instructionsEl.parentNode) {
        this.instructionsEl.parentNode.removeChild(this.instructionsEl);
      }
    }
  });