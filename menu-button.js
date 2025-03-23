// Menu Button for Mobile - Creates a button that toggles the HUD menu
// This extends the controls with a dedicated menu button

AFRAME.registerComponent('mobile-menu-button', {
    schema: {
      position: {type: 'string', default: 'top-right'}, // Position of the button: top-left, top-right
      size: {type: 'string', default: 'medium'}, // Button size: small, medium, large
      showOnDesktop: {type: 'boolean', default: false} // Whether to show the button on desktop
    },
    
    init: function() {
      // Check if we're on a mobile device or if showOnDesktop is true
      this.isMobile = AFRAME.utils.device.isMobile();
      
      if (!this.isMobile && !this.data.showOnDesktop) {
        return; // Don't create button on desktop unless specifically requested
      }
      
      // Get reference to the player entity with terrain-movement
      this.playerEl = document.querySelector('#player');
      if (!this.playerEl) {
        console.warn("Could not find player element with id 'player'");
        return;
      }
      
      // Get reference to camera and HUD
      this.cameraEl = document.querySelector('#cam');
      this.hudEl = document.querySelector('#hud');
      this.miniHudEl = document.querySelector('#micro-hud');
      
      if (!this.hudEl) {
        console.warn("Could not find HUD element with id 'hud'");
        return;
      }
      
      // Create the menu button
      this.createMenuButton();
    },
    
    createMenuButton: function() {
      // Create button element
      this.menuButton = document.createElement('button');
      this.menuButton.className = 'menu-toggle-btn';
      this.menuButton.textContent = 'Menu';
      
      // Style the button
      this.styleMenuButton();
      
      // Add event listeners for touch/click effects
      this.addButtonListeners();
      
      // Add to document
      document.body.appendChild(this.menuButton);
    },
    
    styleMenuButton: function() {
      // Set size based on schema
      let padding, fontSize;
      switch (this.data.size) {
        case 'small':
          padding = '10px 20px';
          fontSize = '14px';
          break;
        case 'large':
          padding = '20px 30px';
          fontSize = '20px';
          break;
        case 'medium':
        default:
          padding = '15px 25px';
          fontSize = '16px';
      }
      
      // Apply styles
      Object.assign(this.menuButton.style, {
        position: 'fixed',
        padding: padding,
        border: 'none',
        borderRadius: '30px',
        backgroundColor: 'rgba(4, 132, 157, 0.7)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: fontSize,
        fontWeight: 'bold',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        zIndex: '1000',
        transition: 'background-color 0.3s, transform 0.1s',
        cursor: 'pointer'
      });
      
      // Position the button based on schema.
      switch (this.data.position) {
        case 'top-left':
          this.menuButton.style.top = '60px';
          this.menuButton.style.left = '10px';
          break;
        case 'top-right':
        default:
          this.menuButton.style.top = '60px';
          this.menuButton.style.right = '10px';
      }
    },
    
    addButtonListeners: function() {
      // Touch/mouse down effect
      const touchStartHandler = () => {
        this.menuButton.style.transform = 'scale(0.95)';
        this.menuButton.style.backgroundColor = 'rgba(0, 140, 170, 0.9)';
      };
      
      // Touch/mouse up effect
      const touchEndHandler = () => {
        this.menuButton.style.transform = '';
        this.menuButton.style.backgroundColor = 'rgba(0, 170, 204, 0.7)';
      };
      
      // Add visual effect listeners
      this.menuButton.addEventListener('touchstart', touchStartHandler);
      this.menuButton.addEventListener('mousedown', touchStartHandler);
      this.menuButton.addEventListener('touchend', touchEndHandler);
      this.menuButton.addEventListener('mouseup', touchEndHandler);
      
      // Add click handler to toggle the HUD
      this.menuButton.addEventListener('click', this.toggleHud.bind(this));
    },
    
    toggleHud: function(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      // Get the terrain-movement component which contains the hudToggle function
      const terrainMovementComponent = this.playerEl.components['terrain-movement'];
      
      if (terrainMovementComponent) {
        // Use the existing hudToggle function from the terrain-movement component
        terrainMovementComponent.hudToggle();
      } else {
        // Fallback implementation if component not found
        if (this.hudEl && this.hudEl.object3D) {
          this.hudEl.object3D.visible = !this.hudEl.object3D.visible;
          
          if (this.hudEl.object3D.visible) {
            this.hudEl.object3D.position.y = 2;
            if (this.cameraEl && this.cameraEl.object3D) {
              this.hudEl.object3D.rotation.y = this.cameraEl.object3D.rotation.y;
            }
            if (this.miniHudEl) {
              this.miniHudEl.object3D.visible = false;
            }
          } else {
            this.hudEl.object3D.position.y = 999;
            if (this.miniHudEl) {
              this.miniHudEl.object3D.visible = false;
            }
          }
        }
      }
      
      console.log("Menu toggled:", this.hudEl.object3D.visible ? "ON" : "OFF");
    },
    
    remove: function() {
      // Clean up when component is removed
      if (this.menuButton && this.menuButton.parentNode) {
        this.menuButton.removeEventListener('click', this.toggleHud);
        this.menuButton.parentNode.removeChild(this.menuButton);
      }
    }
  });
  
  // Auto-initialize the button by adding an entity with the component
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for scene to load
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', function() {
        const buttonEntity = document.createElement('a-entity');
        buttonEntity.setAttribute('mobile-menu-button', {
          position: 'top-right', 
          size: 'medium'
        });
        scene.appendChild(buttonEntity);
      });
    }
  });