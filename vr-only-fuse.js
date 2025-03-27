// Component to make reticle fusing behavior active only in VR mode
AFRAME.registerComponent('vr-only-fuse', {
    init: function() {
      // Get the reticle element
      this.reticle = document.querySelector('#reticle');
      if (!this.reticle) {
        console.error('Could not find reticle with id "reticle"');
        return;
      }
      
      // Store original cursor settings
      this.originalCursor = Object.assign({}, this.reticle.getAttribute('cursor'));
      this.originalFusingAnimation = this.reticle.getAttribute('animation__fusing');
      
      // Initial update based on current mode
      this.updateFuseMode();
      
      // Listen for VR mode changes
      this.el.sceneEl.addEventListener('enter-vr', this.handleVRChange.bind(this));
      this.el.sceneEl.addEventListener('exit-vr', this.handleVRChange.bind(this));
    },
    
    handleVRChange: function() {
      // Small delay to ensure VR mode is properly detected
      setTimeout(() => this.updateFuseMode(), 100);
    },
    
    updateFuseMode: function() {
      if (!this.reticle) return;
      
      // Check if in VR mode
      const inVR = AFRAME.utils.device.checkHeadsetConnected() || 
                   this.el.sceneEl.is('vr-mode');
      
      if (inVR) {
        // In VR: enable fuse
        this.reticle.setAttribute('cursor', this.originalCursor);
        
        // Restore fusing animation
        if (this.originalFusingAnimation && !this.reticle.hasAttribute('animation__fusing')) {
          this.reticle.setAttribute('animation__fusing', this.originalFusingAnimation);
        }
      } else {
        // Not in VR: disable fuse
        const nonVRSettings = Object.assign({}, this.originalCursor, {
          fuse: false
        });
        this.reticle.setAttribute('cursor', nonVRSettings);
        
        // Remove fusing animation
        if (this.reticle.hasAttribute('animation__fusing')) {
          this.reticle.removeAttribute('animation__fusing');
        }
      }
    }
  });