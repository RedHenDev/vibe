// Welcome Message Component for EigenLite
// This displays an opening message with game goals and controls
// that adapts to the device being used (mobile/desktop/VR)

document.addEventListener('DOMContentLoaded', () => {
    AFRAME.registerComponent('welcome-message', {
      schema: {
        title: { default: 'Eigengrau Light v1.0' },
        duration: { type: 'number', default: 24000 }, // How long to show message (ms)
        mobileText: { type: 'string', default: 'swipe to turn • walk button to move' },
        desktopText: { type: 'string', default: 'SHIFT toggles run • SPACE for menu' },
        vrText: { type: 'string', default: 'Tilt head left toggles walk • Tilt head right toggles menu' },
        goalText: { type: 'string', default: 'Navigate this infinite world • Find other players • Beware the night!' }
      },
  
      init: function() {
        // Don't create element until after we're sure it's loaded
        setTimeout(() => this.createWelcomeMessage(), 500);
      },
  
      createWelcomeMessage: function() {
        // First, check if we're on mobile
        const isMobile = AFRAME.utils.device.isMobile();
        
        // Create the welcome message container
        const welcomeContainer = document.createElement('div');
        welcomeContainer.id = 'welcome-message';
        
        // Set styles
        Object.assign(welcomeContainer.style, {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(4, 112, 134, 0.85)',
          color: 'white',
          padding: '20px 30px',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          zIndex: '9999',
          backdropFilter: 'blur(5px)',
          transition: 'opacity 0.5s ease-in-out',
          opacity: '0',
          width: isMobile ? '85%' : '600px',
          maxWidth: '90%',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        });
  
        // Create title
        const title = document.createElement('h1');
        title.textContent = this.data.title;
        Object.assign(title.style, {
          margin: '0 0 15px 0',
          fontSize: isMobile ? '28px' : '36px',
          fontWeight: 'bold',
          letterSpacing: '2px',
          color: '#fff',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
        });
  
        // Create goal text
        const goalDiv = document.createElement('div');
        goalDiv.textContent = this.data.goalText;
        Object.assign(goalDiv.style, {
          margin: '0 0 20px 0',
          fontSize: isMobile ? '16px' : '18px',
          opacity: '0.9',
          lineHeight: '1.5'
        });
  
        // Create controls section with the appropriate text
        const controlsTitle = document.createElement('div');
        controlsTitle.textContent = 'CONTROLS';
        Object.assign(controlsTitle.style, {
          marginBottom: '8px',
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: 'bold',
          opacity: '0.8'
        });
  
        const controlsDiv = document.createElement('div');
        controlsDiv.innerHTML = isMobile ? this.data.mobileText : this.data.desktopText;
        Object.assign(controlsDiv.style, {
          marginBottom: '15px',
          fontSize: isMobile ? '16px' : '18px',
          lineHeight: '1.6',
          opacity: '0.9'
        });
  
        // Add VR controls
        const vrDiv = document.createElement('div');
        vrDiv.innerHTML = '<strong>VR:</strong> ' + this.data.vrText;
        Object.assign(vrDiv.style, {
          fontSize: isMobile ? '14px' : '16px',
          opacity: '0.9',
          lineHeight: '1.4'
        });
  
        // Create dismiss hint
        const dismissHint = document.createElement('div');
        dismissHint.textContent = 'CLICK TO START';
        Object.assign(dismissHint.style, {
          marginTop: '20px',
          fontSize: isMobile ? '14px' : '16px',
          opacity: '0.7',
          fontStyle: 'italic'
        });
  
        // Add elements to container
        welcomeContainer.appendChild(title);
        welcomeContainer.appendChild(goalDiv);
        welcomeContainer.appendChild(controlsTitle);
        welcomeContainer.appendChild(controlsDiv);
        welcomeContainer.appendChild(vrDiv);
        welcomeContainer.appendChild(dismissHint);
  
        // Add to document
        document.body.appendChild(welcomeContainer);
  
        // Fade in after a short delay
        setTimeout(() => {
          welcomeContainer.style.opacity = '1';
        }, 300);
  
        // Add click handler to dismiss
        welcomeContainer.addEventListener('click', () => {
          this.dismissMessage(welcomeContainer);
        });
  
        // Auto-dismiss after duration
        setTimeout(() => {
          this.dismissMessage(welcomeContainer);
        }, this.data.duration);
      },
  
      dismissMessage: function(element) {
        // Prevent multiple dismissals
        if (element.dataset.dismissing) return;
        element.dataset.dismissing = 'true';
        
        // Fade out
        element.style.opacity = '0';

        // For enabling music and sounds.
        document.dispatchEvent(new CustomEvent('welcome-dismissed'));
        
        // Remove after animation completes
        setTimeout(() => {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }, 500);
      }
    });
  
    // Create an entity with the welcome-message component
    // This is added here so it doesn't require HTML changes
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', function() {
        const welcomeEntity = document.createElement('a-entity');
        welcomeEntity.setAttribute('welcome-message', '');
        scene.appendChild(welcomeEntity);
      });
    }
  });