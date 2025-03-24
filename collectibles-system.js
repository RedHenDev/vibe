// collectibles-system.js - A modular collectibles system for Eigengrau Light

// ===============================================
// COLLECTIBLE TYPE DEFINITIONS - ADD NEW TYPES HERE
// ===============================================
const COLLECTIBLE_TYPES = {
    // Simple procedural collectibles
    "vibe": {
      type: "procedural",
      shape: "sphere",    // sphere, cube, pyramid, torus, etc.
      color: "#FF9500",
      scale: "1 1 1",
      glow: true,
      effect: "speed",
      effectDuration: 30, // seconds
      spawnRate: 10,      // relative chance of spawning
      points: 1
    },
    "kaparthy": {
      type: "procedural",
      shape: "diamond",
      color: "#00DDFF",
      scale: "1.5 1.5 1.5",
      glow: true,
      rotate: true,
      effect: "special",  // Special effect with selection menu
      effectDuration: 5,
      spawnRate: 1,       // rare
      points: 10
    },
    
    // Model-based collectibles
    "crystal": {
      type: "model",
      model: "#mGlasst",  // Reference to a model in a-assets
      scale: "3 3 3",
      color: "#AA00FF",
      rotate: true,
      effect: "flight",
      effectDuration: 20,
      spawnRate: 3,
      points: 5
    },
    "cubelit": {
      type: "model",
      model: "#mCublit",
      scale: "5 5 5",
      color: "#00FF88",
      rotate: true,
      effect: "luna",
      effectDuration: 30,
      spawnRate: 2,
      points: 5
    },
    
    // Low-poly procedural collectibles
    "pyramid": {
      type: "procedural",
      shape: "pyramid",
      color: "#FF00CC",
      scale: "1.2 1.2 1.2",
      glow: true,
      rotate: true,
      effect: "all",      // Activates all movement abilities
      effectDuration: 15,
      spawnRate: 1,
      points: 15
    },
    "torus": {
      type: "procedural",
      shape: "torus",
      color: "#FFFF00",
      scale: "1 1 1",
      glow: true,
      rotate: true,
      effect: "speed",
      effectDuration: 25,
      spawnRate: 3,
      points: 3
    },
    "cube": {
      type: "procedural",
      shape: "cube",
      color: "#00FFFF",
      scale: "0.8 0.8 0.8",
      glow: true,
      rotate: true,
      effect: "luna",
      effectDuration: 20,
      spawnRate: 4,
      points: 2
    },
    "octahedron": {
      type: "procedural",
      shape: "octahedron",
      color: "#FF0000",
      scale: "1 1 1",
      glow: true,
      rotate: true,
      effect: "flight",
      effectDuration: 15,
      spawnRate: 3,
      points: 4
    },
    "tetrahedron": {
      type: "procedural",
      shape: "tetrahedron",
      color: "#00FF00",
      scale: "1.2 1.2 1.2",
      glow: true,
      rotate: true,
      effect: "speed",
      effectDuration: 15,
      spawnRate: 4,
      points: 3
    },
    "decahedron": {
      type: "procedural",
      shape: "decahedron",
      color: "#8844FF",
      scale: "1.3 1.3 1.3",
      glow: true,
      rotate: true,
      effect: "special",
      effectDuration: 5,
      spawnRate: 1,
      points: 8
    }
  };
  
  // ===============================================
  // COLLECTIBLE COMPONENT
  // ===============================================
  AFRAME.registerComponent('collectible', {
    schema: {
      type: { type: 'string', default: 'vibe' },
      collectedBy: { type: 'string', default: '' },
      uniqueId: { type: 'string', default: '' }
    },
  
    init: function() {
      // Set up the collectible based on its type
      const typeConfig = COLLECTIBLE_TYPES[this.data.type];
      if (!typeConfig) {
        console.error(`Unknown collectible type: ${this.data.type}`);
        return;
      }
  
      // Create visual representation
      this.createVisual(typeConfig);
      
      // Set up animation if needed
      if (typeConfig.rotate) {
        this.el.setAttribute('animation__rotate', {
          property: 'rotation',
          dur: 10000,
          easing: 'linear',
          loop: true,
          to: '0 360 0'
        });
      }
      
      // Set up glow effect if enabled
      if (typeConfig.glow) {
        this.setupGlowEffect(typeConfig.color);
      }
      
      // Set up collision detection
      this.playerEl = document.querySelector('#player');
      this.collectionRadius = 8; // Increased from 3 for easier collection
      
      // Reference to sync system
      this.syncSystem = document.querySelector('a-scene').systems['collectible-sync'];
    },
    
    tick: function() {
      // Skip if already collected
      if (this.data.collectedBy) return;
      
      // Check for collection
      if (this.playerEl && this.isPlayerInRange()) {
        console.log('Collecting item:', this.data.type);
        this.collectItem();
      }
    },
    
    isPlayerInRange: function() {
      const playerPos = this.playerEl.object3D.position;
      const itemPos = this.el.object3D.position;
      const dx = playerPos.x - itemPos.x;
      const dy = playerPos.y - itemPos.y;
      const dz = playerPos.z - itemPos.z;
      
      const distSquared = dx*dx + dy*dy + dz*dz;
      const radiusSquared = this.collectionRadius * this.collectionRadius;
      
      // Log distance occasionally (1% of the time to avoid console spam)
      if (Math.random() < 0.01) {
        console.log('Distance to collectible:', Math.sqrt(distSquared).toFixed(2), 
                    'Collection radius:', this.collectionRadius);
      }
      
      return distSquared < radiusSquared;
    },
    
    collectItem: function() {
      // Get player ID
      const playerId = window.playerId || 'local-player';
      
      console.log('Collecting item with player ID:', playerId);
      
      // Mark as collected
      this.data.collectedBy = playerId;
      
      // Apply effect to player
      this.applyEffect();
      
      // Sync with other players
      if (this.syncSystem) {
        this.syncSystem.reportCollection(this.data.uniqueId, playerId);
      }
      
      // Play collection animation
      this.playCollectionAnimation().then(() => {
        // Remove from scene after animation
        if (this.el.parentNode) {
          this.el.parentNode.removeChild(this.el);
        }
      });
    },
    
    createVisual: function(typeConfig) {
      if (typeConfig.type === 'procedural') {
        this.createProceduralVisual(typeConfig);
      } else if (typeConfig.type === 'model') {
        this.createModelVisual(typeConfig);
      }
    },
    
    createProceduralVisual: function(typeConfig) {
      switch(typeConfig.shape) {
        case 'sphere':
          this.el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5
          });
          break;
        case 'cube':
          this.el.setAttribute('geometry', {
            primitive: 'box',
            width: 1,
            height: 1,
            depth: 1
          });
          break;
        case 'pyramid':
          this.el.setAttribute('geometry', {
            primitive: 'cone',
            radiusBottom: 0.7,
            radiusTop: 0,
            height: 1,
            segmentsRadial: 4
          });
          break;
        case 'diamond':
          // Create a diamond shape (octahedron)
          this.el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5,
            segmentsWidth: 4,
            segmentsHeight: 2
          });
          break;
        case 'torus':
          this.el.setAttribute('geometry', {
            primitive: 'torus',
            radius: 0.5,
            radiusTubular: 0.1
          });
          break;
        case 'octahedron':
          this.el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5,
            segmentsWidth: 4,
            segmentsHeight: 2
          });
          break;
        case 'tetrahedron':
          this.el.setAttribute('geometry', {
            primitive: 'cone',
            radiusBottom: 0.7,
            radiusTop: 0,
            height: 1,
            segmentsRadial: 3
          });
          break;
        case 'decahedron':
          this.el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5,
            segmentsWidth: 5,
            segmentsHeight: 3
          });
          break;
        default:
          // Default to sphere
          this.el.setAttribute('geometry', {
            primitive: 'sphere',
            radius: 0.5
          });
      }
      
      // Set material and scale
      this.el.setAttribute('material', {
        color: typeConfig.color,
        metalness: 0.7,
        roughness: 0.3,
        emissive: typeConfig.glow ? typeConfig.color : '#000000',
        emissiveIntensity: typeConfig.glow ? 0.5 : 0
      });
      
      this.el.setAttribute('scale', typeConfig.scale);
    },
    
    createModelVisual: function(typeConfig) {
      this.el.setAttribute('gltf-model', typeConfig.model);
      this.el.setAttribute('scale', typeConfig.scale);
      
      // If color is specified, we need to adjust the model material
      if (typeConfig.color) {
        // We'll need to override the material after the model loads
        this.el.addEventListener('model-loaded', () => {
          this.el.object3D.traverse(node => {
            if (node.isMesh) {
              node.material.color.set(typeConfig.color);
              if (typeConfig.glow) {
                node.material.emissive.set(typeConfig.color);
                node.material.emissiveIntensity = 0.5;
              }
            }
          });
        });
      }
    },
    
    setupGlowEffect: function(color) {
      // Add a light source to create glow effect
      const light = document.createElement('a-entity');
      light.setAttribute('light', {
        type: 'point',
        color: color,
        intensity: 1.0, // Increased from 0.5
        distance: 8,    // Increased from 3
        decay: 1.2
      });
      this.el.appendChild(light);
      
      // Add animation to pulse the light
      light.setAttribute('animation__pulse', {
        property: 'light.intensity',
        dur: 2000,
        from: 0.5,  // Increased minimum brightness
        to: 1.5,    // Increased maximum brightness
        dir: 'alternate',
        loop: true,
        easing: 'easeInOutSine'
      });
      
      // Also add a particle effect for better visibility
      const particles = document.createElement('a-entity');
      particles.setAttribute('position', '0 0 0');
      particles.setAttribute('particle-system', {
        preset: 'dust',
        particleCount: 50,
        color: color,
        size: 0.5,
        maxAge: 2,
        blending: 'additive'
      });
      
      // Only add particles if the system supports it
      try {
        this.el.appendChild(particles);
      } catch (e) {
        console.log('Particle system not supported:', e);
      }
    },
    
    applyEffect: function() {
      const typeConfig = COLLECTIBLE_TYPES[this.data.type];
      if (!typeConfig || !typeConfig.effect) return;
      
      const player = document.querySelector('#player');
      const terrainMovement = player.components['terrain-movement'];
      
      if (!terrainMovement) return;
      
      // Apply effect based on type
      switch(typeConfig.effect) {
        case 'speed':
          terrainMovement.running = true;
          break;
        case 'flight':
          terrainMovement.flying = true;
          break;
        case 'luna':
          terrainMovement.lunaBounce = true;
          break;
        case 'all':
          terrainMovement.running = true;
          terrainMovement.flying = true;
          terrainMovement.lunaBounce = true;
          break;
        case 'special':
          // Special effect for kaparthy - player can choose an effect
          this.showEffectSelectionMenu();
          break;
      }
      
      // Show effect activated message
      this.showEffectMessage(typeConfig.effect, typeConfig.effectDuration);
      
      // Set timeout to deactivate effect
      if (typeConfig.effectDuration > 0 && typeConfig.effect !== 'special') {
        setTimeout(() => {
          this.deactivateEffect(typeConfig.effect);
        }, typeConfig.effectDuration * 1000);
      }
    },
    
    deactivateEffect: function(effectType) {
      const player = document.querySelector('#player');
      const terrainMovement = player.components['terrain-movement'];
      
      if (!terrainMovement) return;
      
      // Remove effect based on type
      switch(effectType) {
        case 'speed':
          terrainMovement.running = false;
          break;
        case 'flight':
          terrainMovement.flying = false;
          break;
        case 'luna':
          terrainMovement.lunaBounce = false;
          break;
        case 'all':
          terrainMovement.running = false;
          terrainMovement.flying = false;
          terrainMovement.lunaBounce = false;
          break;
      }
      
      // Show effect deactivated message
      this.showEffectEndMessage(effectType);
    },
    
    showEffectMessage: function(effectType, duration) {
      let message;
      switch(effectType) {
        case 'speed':
          message = `Speed boost activated for ${duration} seconds!`;
          break;
        case 'flight':
          message = `Flight mode activated for ${duration} seconds!`;
          break;
        case 'luna':
          message = `Luna bounce activated for ${duration} seconds!`;
          break;
        case 'all':
          message = `All powers activated for ${duration} seconds!`;
          break;
        case 'special':
          message = 'Kaparthy crystal collected! Choose an effect!';
          break;
        default:
          message = `${this.data.type} collected!`;
      }
      
      // Create a notification
      this.createTemporaryNotification(message);
    },
    
    showEffectEndMessage: function(effectType) {
      let message;
      switch(effectType) {
        case 'speed':
          message = 'Speed boost has worn off.';
          break;
        case 'flight':
          message = 'Flight mode has worn off.';
          break;
        case 'luna':
          message = 'Luna bounce has worn off.';
          break;
        case 'all':
          message = 'All powers have worn off.';
          break;
        default:
          message = `${effectType} effect has worn off.`;
      }
      
      // Create a notification
      this.createTemporaryNotification(message);
    },
    
    createTemporaryNotification: function(message) {
      // Create a simple notification element
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.bottom = '20%';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.padding = '10px 20px';
      notification.style.backgroundColor = 'rgba(0,0,0,0.7)';
      notification.style.color = 'white';
      notification.style.borderRadius = '5px';
      notification.style.fontFamily = 'Arial, sans-serif';
      notification.style.fontSize = '16px';
      notification.style.zIndex = '9999';
      notification.style.transition = 'opacity 0.5s ease-in-out';
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 500);
      }, 3000);
    },
    
    showEffectSelectionMenu: function() {
      // Create a selection menu for the special Kaparthy effect
      const menu = document.createElement('div');
      menu.style.position = 'fixed';
      menu.style.top = '50%';
      menu.style.left = '50%';
      menu.style.transform = 'translate(-50%, -50%)';
      menu.style.padding = '20px';
      menu.style.backgroundColor = 'rgba(0,0,0,0.8)';
      menu.style.color = 'white';
      menu.style.borderRadius = '10px';
      menu.style.fontFamily = 'Arial, sans-serif';
      menu.style.zIndex = '10000';
      menu.style.display = 'flex';
      menu.style.flexDirection = 'column';
      menu.style.gap = '10px';
      
      const title = document.createElement('h3');
      title.textContent = 'Choose an Effect';
      title.style.margin = '0 0 15px 0';
      title.style.textAlign = 'center';
      menu.appendChild(title);
      
      // Effect options
      const effects = [
        { name: 'Super Speed', effect: 'speed', duration: 60 },
        { name: 'Flight', effect: 'flight', duration: 45 },
        { name: 'Luna Bounce', effect: 'luna', duration: 60 },
        { name: 'All Powers', effect: 'all', duration: 30 }
      ];
      
      effects.forEach(effect => {
        const button = document.createElement('button');
        button.textContent = `${effect.name} (${effect.duration}s)`;
        button.style.padding = '10px';
        button.style.margin = '5px 0';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.backgroundColor = '#00DDFF';
        button.style.color = 'black';
        button.style.cursor = 'pointer';
        
        button.addEventListener('click', () => {
          // Apply the selected effect
          this.applySpecialEffect(effect.effect, effect.duration);
          // Close the menu
          document.body.removeChild(menu);
        });
        
        menu.appendChild(button);
      });
      
      document.body.appendChild(menu);
    },
    
    applySpecialEffect: function(effectType, duration) {
      const player = document.querySelector('#player');
      const terrainMovement = player.components['terrain-movement'];
      
      if (!terrainMovement) return;
      
      // Apply special effect
      if (effectType === 'all') {
        // Enable all powers
        terrainMovement.running = true;
        terrainMovement.flying = true;
        terrainMovement.lunaBounce = true;
      } else {
        // Apply single effect
        switch(effectType) {
          case 'speed':
            terrainMovement.running = true;
            break;
          case 'flight':
            terrainMovement.flying = true;
            break;
          case 'luna':
            terrainMovement.lunaBounce = true;
            break;
        }
      }
      
      // Show effect activated message
      this.showEffectMessage(effectType, duration);
      
      // Set timeout to deactivate effect
      setTimeout(() => {
        if (effectType === 'all') {
          terrainMovement.running = false;
          terrainMovement.flying = false;
          terrainMovement.lunaBounce = false;
        } else {
          this.deactivateEffect(effectType);
        }
      }, duration * 1000);
    },
    
    playCollectionAnimation: function() {
      return new Promise(resolve => {
        // Add collection animation (scaling up and fading out)
        this.el.setAttribute('animation__collect', {
          property: 'scale',
          dur: 500,
          to: '2 2 2',
          easing: 'easeOutQuad'
        });
        
        this.el.setAttribute('animation__fade', {
          property: 'material.opacity',
          dur: 500,
          to: '0',
          easing: 'easeOutQuad'
        });
        
        // Resolve after animation completes
        setTimeout(resolve, 500);
      });
    }
  });
  
  // ===============================================
  // COLLECTIBLE MANAGER SYSTEM
  // ===============================================
  // Fix system definition - remove duplicate registration
  AFRAME.registerComponent('collectible-manager', {
    schema: {
      enabled: { default: true },
      spawnRadius: { type: 'number', default: 100 },
      maxCollectibles: { type: 'number', default: 20 },
      spawnInterval: { type: 'number', default: 10000 }, // ms
      chunkSize: { type: 'number', default: 64 },
      renderDistance: { type: 'number', default: 128 }
    },
    
    init: function() {
      this.collectibles = new Map(); // Map of all collectibles by uniqueId
      this.lastSpawnTime = 0;
      this.player = document.querySelector('#player').object3D;
      this.spawnContainer = document.createElement('a-entity');
      this.spawnContainer.setAttribute('id', 'collectibles-container');
      this.el.sceneEl.appendChild(this.spawnContainer);
      
      // Track player stats
      this.playerStats = {
        collected: 0,
        points: 0,
        types: {}
      };
      
      // Set up sync with server
      this.setupSync();
      
      // Initialize with some collectibles very close to player
      setTimeout(() => {
        console.log('Spawning initial collectibles very close to player');
        // Create a test collectible right in front of player
        const playerPos = this.player.position;
        const testCollectible = document.createElement('a-entity');
        
        // Position it 10 units in front of player
        const angle = Math.random() * Math.PI * 2; // Random angle
        const x = playerPos.x + Math.cos(angle) * 10;
        const z = playerPos.z + Math.sin(angle) * 10;
        const y = typeof getTerrainHeight === 'function' ? getTerrainHeight(x, z) : playerPos.y;
        
        testCollectible.setAttribute('position', `${x} ${y + 3} ${z}`);
        testCollectible.setAttribute('collectible', {
          type: 'kaparthy', // The special one that's easy to see
          uniqueId: 'test-collectible-' + Date.now()
        });
        this.spawnContainer.appendChild(testCollectible);
        
        // Also spawn a few regular collectibles
        for (let i = 0; i < 4; i++) {
          this.spawnCollectible();
        }
      }, 5000); // Increased delay to ensure player and terrain are fully loaded
      
      console.log('Collectible manager initialized, will spawn test items in 5 seconds');
    },
    
    tick: function(time) {
      if (!this.data.enabled || !this.player) return;
      
      // Check if it's time to spawn new collectibles
      if (time - this.lastSpawnTime > this.data.spawnInterval) {
        this.lastSpawnTime = time;
        this.spawnCollectibles();
      }
      
      // Check for collectibles that need to be removed (too far from player)
      this.checkCollectibleDistances();
    },
    
    spawnCollectibles: function() {
      // Don't spawn if we already have enough
      if (this.collectibles.size >= this.data.maxCollectibles) return;
      
      // Calculate how many to spawn
      const toSpawn = Math.min(
        3, // Max per spawn cycle
        this.data.maxCollectibles - this.collectibles.size
      );
      
      for (let i = 0; i < toSpawn; i++) {
        this.spawnCollectible();
      }
    },
    
    spawnCollectible: function() {
      // Choose a collectible type based on spawn rates
      const type = this.chooseCollectibleType();
      
      // Generate a unique ID for this collectible
      const uniqueId = 'collectible-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      
      // Choose a spawn position
      const position = this.getSpawnPosition();
      
      // Create the collectible entity
      const collectible = document.createElement('a-entity');
      collectible.setAttribute('id', uniqueId);
      collectible.setAttribute('collectible', {
        type: type,
        uniqueId: uniqueId
      });
      collectible.setAttribute('position', position);
      
      // Add event listener for when the model/geometry has loaded
      collectible.addEventListener('loaded', () => {
        // Add to collectibles map
        this.collectibles.set(uniqueId, {
          type: type,
          position: position,
          entity: collectible,
          spawnTime: Date.now()
        });
        
        // Report to sync system
        if (this.syncSystem) {
          this.syncSystem.reportSpawn(uniqueId, type, position);
        }
      });
      
      // Add to scene
      this.spawnContainer.appendChild(collectible);
      
      return collectible;
    },
    
    chooseCollectibleType: function() {
      // Calculate total spawn rate
      let totalSpawnRate = 0;
      const types = Object.keys(COLLECTIBLE_TYPES);
      
      types.forEach(type => {
        totalSpawnRate += COLLECTIBLE_TYPES[type].spawnRate || 1;
      });
      
      // Choose a type randomly based on spawn rates
      let random = Math.random() * totalSpawnRate;
      let cumulativeRate = 0;
      
      for (const type of types) {
        cumulativeRate += COLLECTIBLE_TYPES[type].spawnRate || 1;
        if (random <= cumulativeRate) {
          return type;
        }
      }
      
      // Fallback to first type
      return types[0];
    },
    
    getSpawnPosition: function() {
      // Get player position
      const playerPos = this.player.position;
      
      // Choose a random angle and distance within spawn radius
      const angle = Math.random() * Math.PI * 2;
      const minDistance = 15; // Changed from proportional to fixed minimum (was this.data.spawnRadius * 0.4)
      const maxDistance = 50; // Set a reasonable maximum distance
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
      
      // Calculate position
      const x = playerPos.x + Math.cos(angle) * distance;
      const z = playerPos.z + Math.sin(angle) * distance;
      
      // Get terrain height at this position
      let y = 0;
      try {
        // Use global terrain height function if available
        if (typeof getTerrainHeight === 'function') {
          y = getTerrainHeight(x, z);
          console.log('Spawning collectible at height:', y);
        } else {
          console.warn('getTerrainHeight not found, using default height');
          y = playerPos.y;
        }
      } catch (e) {
        console.error('Error getting terrain height:', e);
        y = playerPos.y;
      }
      
      // Add a small offset above the terrain (increased from 1.5 to 3)
      return `${x} ${y + 3} ${z}`;
    },
    
    checkCollectibleDistances: function() {
      if (!this.player) return;
      
      const playerPos = this.player.position;
      const maxDistance = this.data.renderDistance * 1.5; // Remove if beyond render distance
      
      for (const [id, collectible] of this.collectibles.entries()) {
        if (!collectible.entity) continue;
        
        const pos = collectible.entity.object3D.position;
        const dx = playerPos.x - pos.x;
        const dz = playerPos.z - pos.z;
        const distSquared = dx*dx + dz*dz;
        
        // If too far away or too old, remove it
        const tooFar = distSquared > maxDistance * maxDistance;
        const tooOld = (Date.now() - collectible.spawnTime) > 300000; // 5 minutes
        
        if (tooFar || tooOld) {
          // Only remove if not collected
          const component = collectible.entity.getAttribute('collectible');
          if (!component || !component.collectedBy) {
            this.removeCollectible(id);
          }
        }
      }
    },
    
    removeCollectible: function(id) {
      const collectible = this.collectibles.get(id);
      if (!collectible) return;
      
      // Remove from DOM
      if (collectible.entity && collectible.entity.parentNode) {
        collectible.entity.parentNode.removeChild(collectible.entity);
      }
      
      // Remove from map
      this.collectibles.delete(id);
      
      // Notify sync system
      if (this.syncSystem) {
        this.syncSystem.reportRemoval(id);
      }
    },
    
    setupSync: function() {
      // Get reference to sync system if it exists
      this.syncSystem = this.el.sceneEl.systems['collectible-sync'];
      
      if (!this.syncSystem) {
        console.warn('collectible-sync system not found, collectible synchronization will be disabled');
      }
    }
  });
  
  // ===============================================
  // COLLECTIBLE SYNC SYSTEM - Register this before it's used
  // ===============================================
  AFRAME.registerSystem('collectible-sync', {
        schema: {
          enabled: { default: true }
        },
        
        init: function() {
          this.collectibles = new Map();
          this.pendingUpdates = [];
          this.lastSyncTime = 0;
          this.syncInterval = 1000; // Sync every second
          this.socket = null;
          
          // Connect to the WebSocket when available
          this.connectToSocketWhenReady();
        },
        
        connectToSocketWhenReady: function() {
          // Check for socket every second until connected
          const checkSocket = () => {
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
              this.socket = window.socket;
              console.log('Collectible sync connected to WebSocket');
            } else {
              setTimeout(checkSocket, 1000);
            }
          };
          
          checkSocket();
        },
        
        tick: function(time) {
          // Sync with server periodically
          if (time - this.lastSyncTime > this.syncInterval) {
            this.lastSyncTime = time;
            this.syncWithServer();
          }
        },
        
        syncWithServer: function() {
          if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
          
          // If we have pending updates, send them
          if (this.pendingUpdates.length > 0) {
            this.socket.send(JSON.stringify({
              type: 'collectibles-update',
              updates: this.pendingUpdates
            }));
            
            this.pendingUpdates = [];
          }
        },
        
        reportSpawn: function(id, type, position) {
          this.collectibles.set(id, {
            type: type,
            position: position,
            collected: false,
            collectedBy: null
          });
          
          this.pendingUpdates.push({
            action: 'spawn',
            id: id,
            type: type,
            position: position
          });
        },
        
        reportCollection: function(id, playerId) {
          const collectible = this.collectibles.get(id);
          if (!collectible) return;
          
          collectible.collected = true;
          collectible.collectedBy = playerId;
          
          this.pendingUpdates.push({
            action: 'collect',
            id: id,
            playerId: playerId
          });
        },
        
        reportRemoval: function(id) {
          this.collectibles.delete(id);
          
          this.pendingUpdates.push({
            action: 'remove',
            id: id
          });
        },
        
        handleServerMessage: function(message) {
          if (message.type !== 'collectibles-update') return;
          
          const updates = message.updates || [];
          
          updates.forEach(update => {
            switch (update.action) {
              case 'spawn':
                this.handleSpawnUpdate(update);
                break;
              case 'collect':
                this.handleCollectionUpdate(update);
                break;
              case 'remove':
                this.handleRemovalUpdate(update);
                break;
            }
          });
        },
        
        handleSpawnUpdate: function(update) {
          // Ignore if we already know about this collectible
          if (this.collectibles.has(update.id)) return;
          
          // Add to our map
          this.collectibles.set(update.id, {
            type: update.type,
            position: update.position,
            collected: false,
            collectedBy: null
          });
          
          // Create the collectible entity if we can
          const manager = this.el.sceneEl.systems['collectible-manager'];
          if (manager) {
            manager.spawnCollectibleFromServer(update.id, update.type, update.position);
          }
        },
        
        handleCollectionUpdate: function(update) {
          // Ignore if this is our own collection
          if (update.playerId === window.playerId) return;
          
          // Mark as collected
          const collectible = this.collectibles.get(update.id);
          if (collectible) {
            collectible.collected = true;
            collectible.collectedBy = update.playerId;
          }
          
          // Update the entity if it exists
          const manager = this.el.sceneEl.systems['collectible-manager'];
          if (manager) {
            manager.markCollectibleCollected(update.id, update.playerId);
          }
        },
        
        handleRemovalUpdate: function(update) {
          // Remove from our map
          this.collectibles.delete(update.id);
          
          // Remove the entity if it exists
          const manager = this.el.sceneEl.systems['collectible-manager'];
          if (manager) {
            manager.removeCollectible(update.id);
          }
        }
      }
  );
  
  // Continue with the collectible-manager system
  AFRAME.registerSystem('collectible-manager', {
    
    spawnCollectibleFromServer: function(id, type, position) {
      // Create collectible with the provided data
      const collectible = document.createElement('a-entity');
      collectible.setAttribute('id', id);
      collectible.setAttribute('collectible', {
        type: type,
        uniqueId: id
      });
      collectible.setAttribute('position', position);
      
      // Add to collectibles map
      this.collectibles.set(id, {
        type: type,
        position: position,
        entity: collectible,
        spawnTime: Date.now()
      });
      
      // Add to scene
      this.spawnContainer.appendChild(collectible);
      
      return collectible;
    },
    
    markCollectibleCollected: function(id, playerId) {
      const collectibleData = this.collectibles.get(id);
      if (!collectibleData || !collectibleData.entity) return;
      
      const collectible = collectibleData.entity;
      const component = collectible.components.collectible;
      
      if (component) {
        // Set collected state
        component.data.collectedBy = playerId;
        
        // Play collection animation and remove
        component.playCollectionAnimation().then(() => {
          this.removeCollectible(id);
        });
      } else {
        // If component isn't ready yet, try again in a moment
        setTimeout(() => {
          this.markCollectibleCollected(id, playerId);
        }, 100);
      }
    },
    
    // Public methods for tracking player stats
    recordCollection: function(collectibleType) {
      const typeConfig = COLLECTIBLE_TYPES[collectibleType];
      if (!typeConfig) return;
      
      // Update stats
      this.playerStats.collected++;
      this.playerStats.points += typeConfig.points || 1;
      
      // Update type-specific stats
      if (!this.playerStats.types[collectibleType]) {
        this.playerStats.types[collectibleType] = 0;
      }
      this.playerStats.types[collectibleType]++;
      
      // Update display if available
      this.updateStatsDisplay();
      
      return this.playerStats;
    },
    
    updateStatsDisplay: function() {
      // If we have a collectibles HUD, update it
      const hudText = document.querySelector('#collectibles-hud-text');
      if (hudText) {
        hudText.setAttribute('value', `Collectibles: ${this.playerStats.collected} | Points: ${this.playerStats.points}`);
      }
    }
  });
  
  // ===============================================
  // HUD FOR COLLECTIBLES
  // ===============================================
  AFRAME.registerComponent('collectibles-hud', {
    init: function() {
      // Create HUD
      const hudEntity = document.createElement('a-entity');
      hudEntity.setAttribute('id', 'collectibles-hud');
      hudEntity.setAttribute('position', '0 -0.7 -1');
      
      // Create text element
      const hudText = document.createElement('a-text');
      hudText.setAttribute('id', 'collectibles-hud-text');
      hudText.setAttribute('value', 'Collectibles: 0 | Points: 0');
      hudText.setAttribute('align', 'center');
      hudText.setAttribute('color', '#00DDFF');
      hudText.setAttribute('scale', '0.5 0.5 0.5');
      hudEntity.appendChild(hudText);
      
      // Add to camera
      const camera = document.querySelector('#cam');
      if (camera) {
        camera.appendChild(hudEntity);
      }
    }
  });
  
  // ===============================================
  // Add a script to handle Collectible WebSocket messages
  // ===============================================
  document.addEventListener('DOMContentLoaded', function() {
    // Wait for socket to be available
    const checkSocket = function() {
      if (window.socket) {
        // Override the existing onmessage handler to also handle collectibles
        const originalOnMessage = window.socket.onmessage;
        
        window.socket.onmessage = function(event) {
          // Call the original handler first
          if (originalOnMessage) {
            originalOnMessage(event);
          }
          
          // Now handle collectible messages
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'collectibles-update') {
              const syncSystem = document.querySelector('a-scene').systems['collectible-sync'];
              if (syncSystem) {
                syncSystem.handleServerMessage(message);
              }
            }
          } catch (error) {
            console.error('Error handling collectible message:', error);
          }
        };
        
        console.log('Collectible WebSocket handler set up');
      } else {
        setTimeout(checkSocket, 1000);
      }
    };
    
    checkSocket();
  });
  
  // ===============================================
  // Auto-initialize the collectible system when the scene loads
  // ===============================================
  document.addEventListener('DOMContentLoaded', function() {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', function() {
        // Create collectible manager entity
        const collectibleManagerEntity = document.createElement('a-entity');
        collectibleManagerEntity.setAttribute('id', 'collectible-manager-entity');
        collectibleManagerEntity.setAttribute('collectible-manager', '');
        scene.appendChild(collectibleManagerEntity);
        
        // Create collectibles HUD
        const hudEntity = document.createElement('a-entity');
        hudEntity.setAttribute('collectibles-hud', '');
        scene.appendChild(hudEntity);
        
        console.log('Collectibles system initialized');
      });
    }
  });