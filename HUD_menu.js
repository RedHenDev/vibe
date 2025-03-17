const hudParent = document.createElement('a-entity');
hudParent.setAttribute('generate-hud', '');
document.querySelector('a-scene').appendChild(hudParent);
//document.querySelector('#player').appendChild(hudParent);

AFRAME.registerComponent('generate-hud', {
  init: function() {
    // Create main HUD entity.
    const hudEntity = document.createElement('a-entity');
    const sceneEl = document.querySelector('a-scene');
    const playerEl = document.querySelector('#player');
    hudEntity.setAttribute('id', 'hud');

    // Create background panel (plane)
    const panel = document.createElement('a-plane');
    panel.setAttribute('position', '0 0 -3');
    panel.setAttribute('rotation', '0 0 0');
    panel.setAttribute('width', '4');
    panel.setAttribute('height', '2');
    panel.setAttribute('material', {
      color: '#088',
      opacity: 0.8,
      depthTest: true
    });

    // Create title text
    const titleText = document.createElement('a-text');
    titleText.setAttribute('id', 'hud-text');
    titleText.setAttribute('value', 'menu');
    titleText.setAttribute('position', '0 0.75 0.01');
    titleText.setAttribute('scale', '1 1 1');
    titleText.setAttribute('align', 'center');
    titleText.setAttribute('color', '#DDD');
    panel.appendChild(titleText);

    // Function to create buttons
    const createButton = (id, position, textValue, handler) => {
      const button = document.createElement('a-box');
      button.setAttribute('id', id);
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

    const button3 = createButton('b3', '1 0.2 0', 'luna \nbounce', (event) => {
      console.log('Button state:', event.detail.state);
      const playerEl = document.querySelector('#player');
      const tmc = playerEl.components['terrain-movement'];
      tmc.lunaBounce = event.detail.state;
    });

    let button4;
    if (worldSeed!=1){
    button4 = createButton('b4', '-1 -0.6 0', 'snow', (event) => {
      console.log('Button state:', event.detail.state);
      const en = document.querySelector('#klaus').components['snow-system'];
      en.data.snowing = event.detail.state;
    });
    }

    // External, non-Hud button.
    const button5 = createButton('b5', '0 0 0', 'snow', (event) => {
      console.log('Button state:', event.detail.state);
      const en = document.querySelector('#klaus').components['snow-system'];
      en.data.snowing = event.detail.state;
      // Remove button once activated. It worked!
      sceneEl.remove(button5);
    });
    // Place button out in world, not on Hud. Note lower we append
    // to scene and not Hud.
    //button5.setAttribute('position', "440 12 -365");
    button5.setAttribute('position', "94 6 -1044");
    button5.setAttribute('buttonText', 'position', '0 0 0.01');
    button5.setAttribute('scale', "12 12 12");
    button5.setAttribute('look-at','targetID:#player;rSpeed:1');

    // Add buttons to panel.
    panel.appendChild(button1);
    panel.appendChild(button2);
    panel.appendChild(button3);
    if (worldSeed!=1){
    panel.appendChild(button4);
    }
    sceneEl.appendChild(button5);

    // Add panel to HUD.
    hudEntity.appendChild(panel);

    // Add HUD to scene.
    //sceneEl.appendChild(hudEntity);
    playerEl.appendChild(hudEntity);
    // Begin hidden.
    hudEntity.object3D.visible=false;
    hudEntity.object3D.position.y=999;
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

/*
<!-- HUD Interface -->
        <a-entity id="hud" follow-camera>
            <!-- Background panel -->
             <!-- 0 2.6 -2 and 15, not 5 and 90. -->
            <a-plane position="0 4 -2" rotation="70 0 0"
                    width="4" height="2" 
                    material="color: #088; opacity: 0.8; depthTest: true">
                
                <!-- Button 1 -->
                <a-box id="b1" position="-1 0 0" 
                    scale="0.5 0.5 0.005"
                    toggle-button="label: Speed Mode; initialState: false">
                    <a-text value="speed \nmode" 
                            position="0 0 1" 
                            scale="1 1 1" 
                            align="center"
                            color="#fff"></a-text>
                </a-box>
                
                <!-- Button 2 -->
                <a-box id="b2" position="0 0 0" 
                    scale="0.5 0.5 0.005"
                    toggle-button="label: Speed Mode; initialState: false">
                    <a-text value="fly \nmode" 
                            position="0 0 1" 
                            scale="1 1 1" 
                            align="center"
                            color="#fff"></a-text>
                </a-box>
                
                <!-- Button 3 -->
                <a-box id="b3" position="1 0 0" 
                    scale="0.5 0.5 0.005"
                    toggle-button="label: Speed Mode; initialState: false">
                    <a-text value="luna \nbounce" 
                            position="0 0 1" 
                            scale="1 1 1" 
                            align="center"
                            color="#fff"></a-text>
                </a-box>
                
                <!-- Title -->
                <a-text id="hud-text" value="settings" 
                        position="0 0.75 0.01" 
                        scale="1 1 1" 
                        align="center" 
                        color="#0FF"></a-text>
            </a-plane>
        </a-entity>
*/