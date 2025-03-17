// Pointer Lock (free look) controls for A-Frame.
AFRAME.registerComponent('pointer-lock-controls', {
    schema: {
      enabled: {default: true},
      sensitivity: {default: 2.0}
    },
  
    init: function () {
      this.camera = this.el.querySelector('[camera]');
      this.canvasEl = document.querySelector('canvas');
      this.pointerLocked = false;
      this.previousMouseEvent = null;
      this.setupMouseControls();
      
      // Create instruction overlay
      this.createInstructions();
    },
  
    createInstructions: function () {
      // Create instructions overlay
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
  
    setupMouseControls: function () {
      // Initial click to request pointer lock
      this.canvasEl.addEventListener('click', this.requestPointerLock.bind(this));
      
      // Set up pointer lock change and error event listeners
      document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
      document.addEventListener('mozpointerlockchange', this.onPointerLockChange.bind(this));
      document.addEventListener('webkitpointerlockchange', this.onPointerLockChange.bind(this));
      
      document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
      document.addEventListener('mozpointerlockerror', this.onPointerLockError.bind(this));
      document.addEventListener('webkitpointerlockerror', this.onPointerLockError.bind(this));
      
      // Mouse move handler for camera rotation
      this.onMouseMove = this.onMouseMove.bind(this);
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
      const cameraEl = this.camera;
      
      // Calculate rotation based on mouse movement
      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
      
      // Adjust rotation sensitivity
      const sensitivity = this.data.sensitivity / 1000;
      
      // Apply mouse X movement to camera Y rotation (yaw)
      const yawObject = camera;
      yawObject.rotation.y -= movementX * sensitivity;
      
      // Apply mouse Y movement to camera X rotation (pitch), but clamp it
      const pitchObject = camera;
      const currentPitch = pitchObject.rotation.x;
      const newPitch = currentPitch - movementY * sensitivity;
      
      // Clamp vertical look between -90 and 90 degrees
      pitchObject.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, newPitch));
    },
    
    remove: function () {
      // Clean up event listeners
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
      document.removeEventListener('mozpointerlockchange', this.onPointerLockChange);
      document.removeEventListener('webkitpointerlockchange', this.onPointerLockChange);
      
      document.removeEventListener('pointerlockerror', this.onPointerLockError);
      document.removeEventListener('mozpointerlockerror', this.onPointerLockError);
      document.removeEventListener('webkitpointerlockerror', this.onPointerLockError);
      
      document.removeEventListener('mousemove', this.onMouseMove);
      
      // Remove instruction element
      if (this.instructionsEl && this.instructionsEl.parentNode) {
        this.instructionsEl.parentNode.removeChild(this.instructionsEl);
      }
    }
  });