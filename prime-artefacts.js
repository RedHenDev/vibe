// Simplified Artefacts System for Eigengrau Light
// Creates lightweight narrative markers with improved performance

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const artefactsEntity = document.createElement('a-entity');
      artefactsEntity.setAttribute('id', 'simple-artefacts-system');
      artefactsEntity.setAttribute('simple-artefacts', '');
      scene.appendChild(artefactsEntity);
      console.log('Simplified Artefacts system initialized');
    });
  }
});

AFRAME.registerComponent('simple-artefacts', {
  schema: {
    enabled: { type: 'boolean', default: true },
    spawnDistance: { type: 'number', default: 100 },     // Distance ahead to spawn artefacts
    spawnInterval: { type: 'number', default: 100 },     // Units of movement before spawning a new artefact
    detectRadius: { type: 'number', default: 12 },       // Interaction radius
    maxArtefacts: { type: 'number', default: 8 },        // Maximum number of active artefacts
    baseColor: { type: 'color', default: '#8800FF' },    // Base color
    glowColor: { type: 'color', default: '#CC00FF' },    // Glow color
    bobSpeed: { type: 'number', default: 1 },            // Speed of bobbing animation
    bobHeight: { type: 'number', default: 0.5 }          // Height of bobbing animation
  },
  
  init: function() {
    // Reference to player
    this.player = document.querySelector('#player').object3D;
    this.camera = document.querySelector('#cam').object3D;
    
    // Track last player position for distance calculation
    this.lastPosition = new THREE.Vector3();
    if (this.player) {
      this.lastPosition.copy(this.player.position);
    }
    
    // Track distance moved
    this.distanceTraveled = 0;
    
    // Active artefacts
    this.artefacts = [];
    
    // Artefact pool for reuse
    this.artefactPool = [];
    
    // Track visited artefacts
    this.visitedArtefacts = new Set();
    
    // Initialize the notification system
    this.createNotificationSystem();
    
    // Register shader for the wavy effect
    this.registerWavyShader();
    
    // Create the artefact pool
    this.initializeArtefactPool();
    
    // Check timer
    this.lastCheckTime = 0;
    this.checkInterval = 500; // ms
  },
  
  registerWavyShader: function() {
    // Skip if already registered
    if (AFRAME.shaders['wave-distortion']) return;
    
    // Register custom shader for wavy starfield effect (simplified from portal.js)
    AFRAME.registerShader('wave-distortion', {
      schema: {
        time: {type: 'time', is: 'uniform'},
        map: {type: 'map', is: 'uniform'},
        color: {type: 'color', is: 'uniform', default: 'white'}
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform sampler2D map;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          uv.x += sin(uv.y * 10.0 + time * 0.001) * 0.05;
          uv.y += sin(uv.x * 10.0 + time * 0.001) * 0.05;
          vec4 texColor = texture2D(map, uv);
          gl_FragColor = texColor * vec4(color, 1.0);
        }
      `
    });
  },
  
  initializeArtefactPool: function() {
    // Create pool of reusable artefacts
    for (let i = 0; i < this.data.maxArtefacts; i++) {
      const entity = this.createArtefactEntity(i);
      entity.setAttribute('visible', false);
      this.artefactPool.push({
        entity: entity,
        active: false,
        index: i,
        lastVisitTime: 0,
        narrativeIndex: i % this.narrativeFragments.length
      });
    }
  },
  
  createArtefactEntity: function(index) {
    const entity = document.createElement('a-entity');
    entity.setAttribute('id', `artefact-${index}`);
    entity.setAttribute('position', '0 -1000 0'); // Hide initially
    
    // Create a simple pyramid base
    const pyramid = document.createElement('a-entity');
    pyramid.setAttribute('geometry', 'primitive: cone; radiusBottom: 2; radiusTop: 0; height: 3; segmentsRadial: 4');
    pyramid.setAttribute('material', `color: ${this.data.baseColor}; emissive: ${this.data.glowColor}; emissiveIntensity: 0.5`);
    
    // Create floating sphere with portal shader
    const sphere = document.createElement('a-sphere');
    sphere.setAttribute('radius', '1');
    sphere.setAttribute('position', '0 3 0');
    sphere.setAttribute('material', {
      shader: 'wave-distortion',
      map: './assets/starfield.png', // Use same texture as portal
      color: this.data.glowColor,
      transparent: true,
      opacity: 0.9
    });
    
    // Add bobbing animation
    sphere.setAttribute('animation', {
      property: 'position',
      to: `0 ${3 + this.data.bobHeight} 0`,
      dir: 'alternate',
      dur: 2000 / this.data.bobSpeed,
      easing: 'easeInOutSine',
      loop: true
    });
    
    // Add rotating animation
    sphere.setAttribute('animation__rotate', {
      property: 'rotation',
      to: '0 360 0',
      dur: 10000 / this.data.bobSpeed,
      easing: 'linear',
      loop: true
    });
    
    // Add small light
    const light = document.createElement('a-light');
    light.setAttribute('type', 'point');
    light.setAttribute('color', this.data.glowColor);
    light.setAttribute('intensity', '0.5');
    light.setAttribute('distance', '10');
    light.setAttribute('position', '0 3 0');
    
    // Add to entity
    entity.appendChild(pyramid);
    entity.appendChild(sphere);
    entity.appendChild(light);
    
    // Add to scene
    this.el.appendChild(entity);
    
    return entity;
  },
  
  createNotificationSystem: function() {
    // Create notification element
    this.notificationEl = document.createElement('div');
    Object.assign(this.notificationEl.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '70%',
      maxWidth: '600px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      padding: '20px',
      borderRadius: '10px',
      border: `2px solid ${this.data.glowColor}`,
      boxShadow: `0 0 15px ${this.data.glowColor}`,
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      lineHeight: '1.4',
      textAlign: 'center',
      zIndex: '1000',
      opacity: '0',
      transition: 'opacity 0.5s ease-in-out',
      pointerEvents: 'auto', // Allow click interaction
      display: 'none'
    });
    
    // Title for the notification
    this.notificationTitle = document.createElement('h2');
    Object.assign(this.notificationTitle.style, {
      margin: '0 0 15px 0',
      color: this.data.glowColor,
      fontSize: '24px',
      fontWeight: 'bold',
      textShadow: `0 0 5px ${this.data.glowColor}`
    });
    
    // Content for the notification
    this.notificationContent = document.createElement('div');
    
    // Add counter display
    this.notificationCounter = document.createElement('div');
    Object.assign(this.notificationCounter.style, {
      marginTop: '15px',
      fontSize: '14px',
      opacity: '0.8'
    });
    
    // Add tap instruction
    this.notificationInstruction = document.createElement('div');
    Object.assign(this.notificationInstruction.style, {
      marginTop: '20px',
      fontSize: '14px',
      opacity: '0.7',
      fontStyle: 'italic'
    });
    this.notificationInstruction.textContent = 'Tap or click anywhere to dismiss';
    
    // Add the elements to the notification
    this.notificationEl.appendChild(this.notificationTitle);
    this.notificationEl.appendChild(this.notificationContent);
    this.notificationEl.appendChild(this.notificationCounter);
    this.notificationEl.appendChild(this.notificationInstruction);
    
    // Click handler to dismiss
    this.notificationEl.addEventListener('click', () => {
      this.hideNotification();
    });
    
    // Add to document
    document.body.appendChild(this.notificationEl);
    
    // Track active artefact
    this.activeArtefact = null;
  },
  
  hideNotification: function() {
    this.notificationEl.style.opacity = '0';
    
    setTimeout(() => {
      this.notificationEl.style.display = 'none';
      this.activeArtefact = null;
    }, 500);
    
    // Clear any timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = null;
    }
  },
  
  showNotification: function(artefact) {
    const fragment = this.narrativeFragments[artefact.narrativeIndex];
    
    // Set content
    this.notificationTitle.textContent = fragment.title;
    this.notificationContent.textContent = fragment.content;
    this.notificationCounter.textContent = `Fragment ${artefact.narrativeIndex + 1} of ${this.narrativeFragments.length}`;
    
    // Show the notification
    this.notificationEl.style.display = 'block';
    
    // Fade in
    setTimeout(() => {
      this.notificationEl.style.opacity = '1';
    }, 10);
    
    // Auto-hide after 15 seconds
    this.notificationTimeout = setTimeout(() => {
      this.hideNotification();
    }, 15000);
    
    // Track active artefact
    this.activeArtefact = artefact;
  },
  
  getInactiveArtefact: function() {
    // First, try to find an inactive artefact in the pool
    for (let artefact of this.artefactPool) {
      if (!artefact.active) {
        return artefact;
      }
    }
    
    // If all are active, remove the oldest one (assuming first in array is oldest)
    if (this.artefacts.length > 0) {
      const oldest = this.artefacts.shift();
      oldest.active = false;
      oldest.entity.setAttribute('visible', false);
      return oldest;
    }
    
    // Shouldn't get here if pool is properly sized
    console.warn('No inactive artefacts available in pool');
    return null;
  },
  
  spawnArtefact: function() {
    // Get inactive artefact from pool
    const artefact = this.getInactiveArtefact();
    if (!artefact) return;
    
    // Mark as active
    artefact.active = true;
    
    // Get player position
    const playerPos = this.player.position;
    
    // Get camera direction (forward vector)
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Zero out the y component
    cameraDirection.normalize();
    
    // Generate random angle between -60 and 60 degrees from forward direction
    const randomAngle = (Math.random() * 120 - 60) * (Math.PI / 180);
    
    // Create rotation matrix for the random angle
    const rotationMatrix = new THREE.Matrix4().makeRotationY(randomAngle);
    
    // Apply rotation to direction vector
    cameraDirection.applyMatrix4(rotationMatrix);
    
    // Calculate spawn position
    const distance = this.data.spawnDistance + Math.random() * this.data.spawnDistance * 0.5;
    const spawnPos = new THREE.Vector3(
      playerPos.x + cameraDirection.x * distance,
      0, // Will be adjusted for terrain height
      playerPos.z + cameraDirection.z * distance
    );
    
    // Adjust for terrain height
    try {
      if (typeof getTerrainHeight === 'function') {
        spawnPos.y = getTerrainHeight(spawnPos.x, spawnPos.z) + 0.5;
      }
    } catch (e) {
      console.warn('Error getting terrain height:', e);
      spawnPos.y = 0.5;
    }
    
    // Update entity position
    artefact.entity.setAttribute('position', spawnPos);
    artefact.entity.setAttribute('visible', true);
    
    // Reset visit state
    artefact.visited = false;
    
    // Add to active artefacts
    this.artefacts.push(artefact);
    
    return artefact;
  },
  
  checkProximity: function(time) {
    // Don't check too frequently
    if (time - this.lastCheckTime < this.checkInterval) return;
    this.lastCheckTime = time;
    
    if (!this.player) return;
    
    const playerPos = this.player.position;
    
    // Check each artefact for proximity
    for (let i = 0; i < this.artefacts.length; i++) {
      const artefact = this.artefacts[i];
      
      if (!artefact.active) continue;
      
      const entityPos = artefact.entity.getAttribute('position');
      
      // Calculate squared distance (more efficient than using sqrt)
      const dx = playerPos.x - entityPos.x;
      const dy = playerPos.y - entityPos.y;
      const dz = playerPos.z - entityPos.z;
      const distanceSquared = dx*dx + dy*dy + dz*dz;
      
      // Handle auto-dismiss if the player moves away from the active artefact
      if (this.activeArtefact === artefact && distanceSquared > this.data.detectRadius * this.data.detectRadius) {
        this.hideNotification();
      }
      
      // Check if player is within detection radius
      if (distanceSquared < this.data.detectRadius * this.data.detectRadius) {
        // Skip if recently visited (3 second cooldown)
        const canInteract = !artefact.lastVisitTime || (time - artefact.lastVisitTime > 3000);
        
        if (canInteract) {
          // Mark visited
          artefact.lastVisitTime = time;
          artefact.visited = true;
          
          // Show notification
          this.showNotification(artefact);
          
          // Only interact with one artefact at a time
          break;
        }
      }
    }
  },
  
  tick: function(time, delta) {
    if (!this.data.enabled || !this.player || !delta) return;
    
    // Get current player position
    const playerPos = this.player.position;
    
    // Calculate distance moved
    const movement = playerPos.distanceTo(this.lastPosition);
    this.distanceTraveled += movement;
    
    // Spawn new artefact if player has moved enough distance
    if (this.distanceTraveled > this.data.spawnInterval) {
      this.spawnArtefact();
      this.distanceTraveled = 0;
    }
    
    // Update last position
    this.lastPosition.copy(playerPos);
    
    // Check proximity to artefacts
    this.checkProximity(time);
  },
  
  remove: function() {
    // Remove notification element
    if (this.notificationEl && this.notificationEl.parentNode) {
      this.notificationEl.parentNode.removeChild(this.notificationEl);
    }
    
    // Clear notification timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    // Remove all artefact entities
    for (let artefact of this.artefactPool) {
      if (artefact.entity && artefact.entity.parentNode) {
        artefact.entity.parentNode.removeChild(artefact.entity);
      }
    }
  },
  
  // Narrative fragments to show when interacting with artefacts
  narrativeFragments: [
    {
      title: "The First Light",
      content: "In the beginning, there was only darkness. Then came the Eigengrau Light—neither true light nor true darkness, but the color seen by the mind in the absence of light. It was the first creation, born from the void itself."
    },
    {
      title: "The Architects",
      content: "They came from beyond the veil, beings of pure thought and energy. They shaped the Light into patterns, gave it structure and form. We know them only as the Architects, for they built the foundations of this realm."
    },
    {
      title: "The Division",
      content: "As the Light grew stronger, it began to divide. Day and night emerged as distinct concepts, no longer one continuous state. The separation created the first cycle, the first rhythm of existence in this world."
    },
    {
      title: "The Vibes",
      content: "From the resonance of the Light came the Vibes—fragments of pure energy that contain echoes of the original creation. They scatter across the landscape, drawn to those who seek understanding of this place."
    },
    {
      title: "The Glass Teeth",
      content: "When night falls, they emerge—entities born from the shadows between the Light's pulses. The Glass Teeth hunger for the energy of the Vibes, seeking to return all to the primal darkness."
    },
    {
      title: "The Eigenscape",
      content: "This land you traverse is the Eigenscape, a fluctuating dimension shaped by mathematics as much as by matter. The terrain forms around prime coordinates—nodes of stability in an ever-shifting realm."
    },
    {
      title: "The Travelers",
      content: "You are not the first to walk these lands. Others have come before, leaving traces of their passage. Some seek to collect the Vibes, others to understand the patterns. Many never return to the world they came from."
    },
    {
      title: "The Pulse",
      content: "The Light pulses with a rhythm only those attuned to it can perceive. Learn to project this pulse, and you can momentarily disperse the shadows and those who dwell within them."
    },
    {
      title: "The Vibehouse",
      content: "Legends speak of a sanctuary where the Vibes converge—a place of safety even in deepest night. The Vibehouse exists at the intersection of all prime pathways, but only reveals itself to those who have collected enough fragments of the Light."
    },
    {
      title: "The Portals",
      content: "The barriers between worlds thin at certain points. These gateways pulse with the same energy as the Light itself, offering passage to other realms shaped by different minds and different mathematics."
    },
    {
      title: "The Eigengrau Code",
      content: "Hidden within the patterns of the world is a code—a mathematical sequence that might unlock the deepest mysteries of the Light. Each prime artefact holds a piece of this sequence, waiting to be discovered."
    },
    {
      title: "The Endless Night",
      content: "Some speak of an Endless Night—a time when the cycle breaks and darkness persists. Only by restoring the proper mathematical harmony can the Light be rekindled and the rhythm of existence continue."
    }
  ]
});