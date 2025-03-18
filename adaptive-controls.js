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
      this.instructionsEl.innerHTML = 'Drag to look around<br>Use on-screen buttons to move';
      
      // Auto-hide after 10 seconds
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
      }, 10000);
      
      document.body.appendChild(this.instructionsEl);
      
      // Add mobile movement buttons if not present
      this.addMobileMovementButtons();
    },
  
    addMobileMovementButtons: function () {
      const controlsContainer = document.createElement('div');
      controlsContainer.id = 'mobile-controls';
      controlsContainer.style.position = 'absolute';
      controlsContainer.style.bottom = '20px';
      controlsContainer.style.left = '20px';
      controlsContainer.style.zIndex = '1000';
      controlsContainer.style.display = 'grid';
      controlsContainer.style.gridTemplateColumns = 'repeat(3, 60px)';
      controlsContainer.style.gridTemplateRows = 'repeat(3, 60px)';
      controlsContainer.style.gap = '5px';
      
      const buttonStyle = `
        width: 60px;
        height: 60px;
        background-color: rgba(50, 50, 50, 0.6);
        color: white;
        font-size: 24px;
        border: none;
        border-radius: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        user-select: none;
        -webkit-user-select: none;
      `;
      
      // Create movement buttons
      const buttons = [
        { grid: '1 / 2', text: '↑', key: 'ArrowUp' },
        { grid: '2 / 1', text: '←', key: 'ArrowLeft' },
        { grid: '2 / 3', text: '→', key: 'ArrowRight' },
        { grid: '3 / 2', text: '↓', key: 'ArrowDown' }
      ];
      
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.style.cssText = buttonStyle;
        button.style.gridArea = btn.grid;
        button.innerHTML = btn.text;
        button.dataset.key = btn.key;
        
        // Handle touch events
        button.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.simulateKeyEvent(btn.key, true);
        });
        
        button.addEventListener('touchend', (e) => {
          e.preventDefault();
          this.simulateKeyEvent(btn.key, false);
        });
        
        controlsContainer.appendChild(button);
      });
      
      // Add run toggle button
      const runButton = document.createElement('button');
      runButton.style.cssText = buttonStyle;
      runButton.style.gridArea = '2 / 2';
      runButton.innerHTML = 'RUN';
      runButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.simulateKeyEvent('ShiftLeft', true);
      });
      controlsContainer.appendChild(runButton);
      
      document.body.appendChild(controlsContainer);
    },
  
    simulateKeyEvent: function(key, isDown) {
      // Create and dispatch a synthetic keyboard event
      const eventType = isDown ? 'keydown' : 'keyup';
      const event = new KeyboardEvent(eventType, {
        key: key,
        code: key,
        bubbles: true
      });
      document.dispatchEvent(event);
    },
  
    setupDesktopControls: function () {
      console.log("Setting up desktop controls");
      
      // Disable A-Frame's default look controls
      this.camera.setAttribute('look-controls', 'enabled: false');
      
      // Initial click to request pointer lock
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
      
      // Create desktop instructions
      this.createDesktopInstructions();
    },
  
    createDesktopInstructions: function () {
      // Create instructions overlay for desktop
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
      this.instructionsEl.innerHTML = 'Click to look around freely (ESC to exit)<br>WASD/Arrow keys to move, Shift to toggle run';
      
      document.body.appendChild(this.instructionsEl);
      
      // Add click handler to instructions
      this.instructionsEl.addEventListener('click', this.requestPointerLock.bind(this));
    },
  
    requestPointerLock: function () {
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
        this.instructionsEl.style.display = 'none';
        document.addEventListener('mousemove', this.onMouseMove, false);
        
        console.log('Pointer locked');
      } else {
        // Pointer is unlocked, remove mousemove listener
        this.pointerLocked = false;
        this.instructionsEl.style.display = 'block';
        document.removeEventListener('mousemove', this.onMouseMove, false);
        
        console.log('Pointer unlocked');
      }
    },
  
    onPointerLockError: function () {
      console.error('Error obtaining pointer lock');
      this.instructionsEl.innerHTML = 
        'Error enabling look controls. Click again to retry.<br>' +
        'Make sure you\'re using a supported browser and are clicking on the game area.';
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
      
      // Remove mobile controls if present
      const mobileControls = document.getElementById('mobile-controls');
      if (mobileControls && mobileControls.parentNode) {
        mobileControls.parentNode.removeChild(mobileControls);
      }
    }
  });