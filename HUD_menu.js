// HUD_menu.js - Fixed version

const hudParent = document.createElement('a-entity');
hudParent.setAttribute('generate-hud', '');
document.querySelector('a-scene').appendChild(hudParent);

AFRAME.registerComponent('generate-hud', {
  init: function() {
    // Create main HUD entity.
    const hudEntity = document.createElement('a-entity');
    const sceneEl = document.querySelector('a-scene');
    const playerEl = document.querySelector('#player');
    hudEntity.setAttribute('id', 'hud');

    // Create background panel (plane)
    const panel = document.createElement('a-plane');
    panel.setAttribute('position', '0 0 -4.4');
    panel.setAttribute('rotation', '0 0 0');
    panel.setAttribute('width', '4');
    panel.setAttribute('height', '2');
    panel.setAttribute('material', {
      color: '#048',
      opacity: 0.8,
      depthTest: true
    });

    // Create title text
    const titleText = document.createElement('a-text');
    titleText.setAttribute('id', 'hud-text');
    titleText.setAttribute('value', 'menu');
    titleText.setAttribute('position', '0 0.4 1.3');
    titleText.setAttribute('scale', '1 1 1');
    titleText.setAttribute('align', 'center');
    titleText.setAttribute('color', '#EEE');
    panel.appendChild(titleText);

    // Function to create buttons
    const createButton = (id, position, textValue, handler) => {
      const button = document.createElement('a-box');
      button.setAttribute('id', id);
      button.setAttribute('material','shader','flat');
      button.setAttribute('position', position);
      button.setAttribute('scale', '0.5 0.5 0.005');
      button.setAttribute('toggle-button', {
        label: 'Speed Mode',
        initialState: false
      });

      const buttonText = document.createElement('a-text');
      buttonText.setAttribute('value', textValue);
      buttonText.setAttribute('position', '0 0 1');
      buttonText.setAttribute('scale', '1 1 1');
      buttonText.setAttribute('align', 'center');
      buttonText.setAttribute('color', '#fff');
      
      button.appendChild(buttonText);

      // Add event listener right after creating the button
      button.addEventListener('statechanged', handler);
      
      return button;
    };

    // Create the three buttons with their respective handlers
    const button1 = createButton('b1', '-1 0.2 0', 'speed \nmode', (event) => {
      console.log('Button state:', event.detail.state);
      const playerEl = document.querySelector('#player');
      const tmc = playerEl.components['terrain-movement'];
      tmc.running = event.detail.state;
    });

    const button2 = createButton('b2', '0 0.2 0', 'fly \nmode', (event) => {
      console.log('Button state:', event.detail.state);
      const playerEl = document.querySelector('#player');
      const tmc = playerEl.components['terrain-movement'];
      tmc.flying = event.detail.state;
    });

    /*
    const button3 = createButton('b3', '1 0.2 0', 'luna \nbounce', (event) => {
      console.log('Button state:', event.detail.state);
      const playerEl = document.querySelector('#player');
      const tmc = playerEl.components['terrain-movement'];
      tmc.lunaBounce = event.detail.state;
    });
    */

    // Attempt to add player position to main Hud menu.
    // Create location text
    const locationText = document.createElement('a-text');
    const position = playerEl.object3D.position;
    locationText.setAttribute('id', 'hud-loco-text');
    locationText.setAttribute('value', `X ${Math.floor(position.x)} Z ${Math.floor(position.z)}   alt ${Math.floor(position.y)}`);
    locationText.setAttribute('position', '0 -0.35 1');
    locationText.setAttribute('scale', '0.8 0.8 0.8');
    locationText.setAttribute('align', 'center');
    locationText.setAttribute('color', '#EEE');
    panel.appendChild(locationText);

    // Add buttons to panel.
    panel.appendChild(button1);
    panel.appendChild(button2);
    //panel.appendChild(button3);

    // Add panel to HUD.
    hudEntity.appendChild(panel);

    // Add HUD to scene.
    //sceneEl.appendChild(hudEntity);
    playerEl.appendChild(hudEntity);
    
    // Begin hidden.
    hudEntity.object3D.visible=false;
    hudEntity.object3D.position.y=999;
    
    // KEY FIX: Add the updateHud method directly to the HUD entity
    hudEntity.updateHud = function() {
      try {
        const playerEl = document.querySelector('#player');
        if (!playerEl || !playerEl.object3D) return;
        
        const position = playerEl.object3D.position;
        const locationText = this.querySelector('#hud-loco-text');
        if (!locationText) return;
        
        const playerCount = window.playerCount || 1;
        locationText.setAttribute('value', `X ${Math.floor(position.x)} Z ${Math.floor(position.z)}   alt ${Math.floor(position.y)}`);
      } catch (err) {
        console.error("Error updating HUD:", err);
      }
    };
  }
});

// Component to handle button states.
AFRAME.registerComponent('toggle-button', {
  schema: {
    label: {type: 'string', default: 'Button'},
    initialState: {type: 'boolean', default: false}
  },
  
  init: function () {
    this.state = this.data.initialState;
    this.el.setAttribute('class', 'clickable');

    // For checking whether active (visible or not)
    this.hud = document.querySelector("#hud").object3D;
    
    // Set initial colours.
    this.updateVisuals();
    
    // Add click handler.
    this.el.addEventListener('click', () => {
      // Disable if not active (i.e. not visible).
      if (!this.el.object3D.visible) return;
      this.state = !this.state;
      this.updateVisuals();
      // Emit event with new state.
      this.el.emit('statechanged', { state: this.state });
      // Hide menu now.
      this.hud.visible=false;
      this.hud.position.y=999;
    });
  },
  
  updateVisuals: function () {
    const activeColor = '#4CAF50';
    const inactiveColor = '#f44336';
    this.el.setAttribute('material', 'color', this.state ? activeColor : inactiveColor);
  }
});