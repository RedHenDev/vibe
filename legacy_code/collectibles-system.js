// collectibles-system.js - A modular collectibles system for Eigengrau Light

// ===============================================
// COLLECTIBLE TYPE DEFINITIONS - ADD NEW TYPES HERE
// ===============================================
const COLLECTIBLE_TYPES = {
    "vibe": {
      type: "procedural",
      shape: "sphere",
      color: "#FF9500",
      scale: "1 1 1",
      glow: true,
      effect: "speed",
      effectDuration: 30,
      spawnRate: 10,
      points: 1
    },
    "kaparthy": {
      type: "procedural",
      shape: "diamond",
      color: "#00DDFF",
      scale: "15 15 15",
      glow: true,
      rotate: true,
      effect: "special",
      effectDuration: 5,
      spawnRate: 10,
      points: 10
    },
    "crystal": {
        type: "procedural",
        shape: "torus",
      scale: "3 3 3",
      color: "#AA00FF",
      rotate: true,
      effect: "flight",
      effectDuration: 20,
      spawnRate: 3,
      points: 5
    },
    "cubelit": {
        type: "procedural",
        shape: "torus",
      scale: "5 5 5",
      color: "#00FF88",
      rotate: true,
      effect: "luna",
      effectDuration: 30,
      spawnRate: 2,
      points: 5
    },
    "pyramid": {
      type: "procedural",
      shape: "pyramid",
      color: "#FF00CC",
      scale: "1.2 1.2 1.2",
      glow: true,
      rotate: true,
      effect: "all",
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
      const typeConfig = COLLECTIBLE_TYPES[this.data.type];
      if (!typeConfig) {
        console.error(`Unknown collectible type: ${this.data.type}`);
        return;
      }
  
      this.createVisual(typeConfig);
  
      if (typeConfig.rotate) {
        this.el.setAttribute('animation__rotate', {
          property: 'rotation',
          dur: 10000,
          easing: 'linear',
          loop: true,
          to: '0 360 0'
        });
      }
  
      if (typeConfig.glow) {
        this.setupGlowEffect(typeConfig.color);
      }
  
      this.playerEl = document.querySelector('#player');
      this.collectionRadius = 8;
      // Directly query the scene for the sync system
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems) {
        this.syncSystem = scene.systems['collectible-sync'];
      } else {
        console.warn('Could not find collectible-sync system');
      }
    },
  
    tick: function() {
      if (this.data.collectedBy) return;
  
      if (this.playerEl && this.isPlayerInRange()) {
        //console.log('Collecting item:', this.data.type);
        this.collectItem();
      }
    },
  
    isPlayerInRange: function() {
      const playerPos = this.playerEl.object3D.position;
      const itemPos = this.el.object3D.position;
      const dx = playerPos.x - itemPos.x;
      const dy = playerPos.y - itemPos.y;
      const dz = playerPos.z - itemPos.z;
  
      const distSquared = dx * dx + dy * dy + dz * dz;
      const radiusSquared = this.collectionRadius * this.collectionRadius;
  
      //if (Math.random() < 0.01) {
        //console.log('Distance to collectible:', Math.sqrt(distSquared).toFixed(2),
        //            'Collection radius:', this.collectionRadius);
      //}
  
      return distSquared < radiusSquared;
    },
  
    collectItem: function() {
      const playerId = window.playerId || 'local-player';
      //console.log('Collecting item with player ID:', playerId);
  
      this.data.collectedBy = playerId;
  
      if (window.collectiblesSystem) {
        window.collectiblesSystem.recordCollection(this.data.type);
      } else {
        console.warn('Could not find collectibles system to record collection');
      }
  
      this.applyEffect();
  
      if (this.syncSystem) {
        this.syncSystem.reportCollection(this.data.uniqueId, playerId);
      }
  
      this.playCollectionAnimation().then(() => {
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
          this.el.setAttribute('geometry', { primitive: 'sphere', radius: 0.5 });
          break;
        case 'cube':
          this.el.setAttribute('geometry', { primitive: 'box', width: 1, height: 1, depth: 1 });
          break;
        case 'pyramid':
          this.el.setAttribute('geometry', { primitive: 'cone', radiusBottom: 0.7, radiusTop: 0, height: 1, segmentsRadial: 4 });
          break;
        case 'diamond':
          this.el.setAttribute('geometry', { primitive: 'sphere', radius: 0.5, segmentsWidth: 4, segmentsHeight: 2 });
          break;
        case 'torus':
          this.el.setAttribute('geometry', { primitive: 'torus', radius: 0.5, radiusTubular: 0.1 });
          break;
        case 'octahedron':
          this.el.setAttribute('geometry', { primitive: 'sphere', radius: 0.5, segmentsWidth: 4, segmentsHeight: 2 });
          break;
        case 'tetrahedron':
          this.el.setAttribute('geometry', { primitive: 'cone', radiusBottom: 0.7, radiusTop: 0, height: 1, segmentsRadial: 3 });
          break;
        case 'decahedron':
          this.el.setAttribute('geometry', { primitive: 'sphere', radius: 0.5, segmentsWidth: 5, segmentsHeight: 3 });
          break;
        default:
          this.el.setAttribute('geometry', { primitive: 'sphere', radius: 0.5 });
      }
  
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
  
      if (typeConfig.color) {
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
      const light = document.createElement('a-entity');
      light.setAttribute('light', { type: 'point', color: color, intensity: 1.0, distance: 8, decay: 1.2 });
      this.el.appendChild(light);
  
      light.setAttribute('animation__pulse', {
        property: 'light.intensity',
        dur: 2000,
        from: 0.5,
        to: 1.5,
        dir: 'alternate',
        loop: true,
        easing: 'easeInOutSine'
      });
  
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
          this.showEffectSelectionMenu();
          break;
      }
  
      this.showEffectMessage(typeConfig.effect, typeConfig.effectDuration);
  
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
  
      this.createTemporaryNotification(message);
    },
  
    createTemporaryNotification: function(message) {
      createVRNotification(message, 3000);
  
      if (!AFRAME.utils.device.checkHeadsetConnected()) {
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
        notification.style.fontSize = '20px';
        notification.style.zIndex = '9999';
        notification.style.transition = 'opacity 0.5s ease-in-out';
        notification.textContent = message;
  
        document.body.appendChild(notification);
  
        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 500);
        }, 3000);
      }
    },
  
    showEffectSelectionMenu: function() {
      if (!AFRAME.utils.device.checkHeadsetConnected()) {
        this.showDesktopSelectionMenu();
      } else {
        this.showVRSelectionMenu();
      }
    },
  
    showDesktopSelectionMenu: function() {
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
          this.applySpecialEffect(effect.effect, effect.duration);
          document.body.removeChild(menu);
        });
  
        menu.appendChild(button);
      });
  
      document.body.appendChild(menu);
    },
  
    showVRSelectionMenu: function() {
      const camera = document.querySelector('#cam');
      if (!camera) return;
  
      const menu = document.createElement('a-entity');
      menu.setAttribute('id', 'vr-effect-menu');
      menu.setAttribute('position', '0 0 -1.5');
  
      const panel = document.createElement('a-entity');
      panel.setAttribute('geometry', { primitive: 'plane', width: 1, height: 0.8 });
      panel.setAttribute('material', { color: '#000', opacity: 0.8, transparent: true, shader: 'flat' });
      menu.appendChild(panel);
  
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Choose an Effect');
      title.setAttribute('color', 'white');
      title.setAttribute('align', 'center');
      title.setAttribute('position', '0 0.3 0.01');
      title.setAttribute('width', 1.8);
      title.setAttribute('scale', '0.35 0.35 0.35');
      menu.appendChild(title);
  
      const effects = [
        { name: 'Super Speed', effect: 'speed', duration: 60, color: '#4CAF50' },
        { name: 'Flight', effect: 'flight', duration: 45, color: '#2196F3' },
        { name: 'Luna Bounce', effect: 'luna', duration: 60, color: '#9C27B0' },
        { name: 'All Powers', effect: 'all', duration: 30, color: '#FF9800' }
      ];
  
      effects.forEach((effect, index) => {
        const yPos = 0.15 - index * 0.15;
  
        const button = document.createElement('a-entity');
        button.setAttribute('geometry', { primitive: 'plane', width: 0.8, height: 0.12 });
        button.setAttribute('material', { color: effect.color, opacity: 0.9, shader: 'flat' });
        button.setAttribute('position', `0 ${yPos} 0.02`);
        button.setAttribute('class', 'clickable');
        menu.appendChild(button);
  
        const buttonText = document.createElement('a-text');
        buttonText.setAttribute('value', `${effect.name} (${effect.duration}s)`);
        buttonText.setAttribute('color', 'white');
        buttonText.setAttribute('align', 'center');
        buttonText.setAttribute('position', '0 0 0.01');
        buttonText.setAttribute('width', 2);
        buttonText.setAttribute('scale', '0.25 0.25 0.25');
        button.appendChild(buttonText);
  
        const component = this;
        button.addEventListener('click', function() {
          component.applySpecialEffect(effect.effect, effect.duration);
          menu.setAttribute('animation', {
            property: 'scale',
            to: '0.001 0.001 0.001',
            dur: 300,
            easing: 'easeInQuad'
          });
  
          setTimeout(() => {
            if (menu.parentNode) {
              menu.parentNode.removeChild(menu);
            }
          }, 300);
        });
      });
  
      camera.appendChild(menu);
  
      menu.setAttribute('scale', '0.001 0.001 0.001');
      menu.setAttribute('animation', {
        property: 'scale',
        to: '1 1 1',
        dur: 300,
        easing: 'easeOutQuad'
      });
    },
  
    applySpecialEffect: function(effectType, duration) {
      const player = document.querySelector('#player');
      const terrainMovement = player.components['terrain-movement'];
  
      if (!terrainMovement) return;
  
      if (effectType === 'all') {
        terrainMovement.running = true;
        terrainMovement.flying = true;
        terrainMovement.lunaBounce = true;
      } else {
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
  
      this.showEffectMessage(effectType, duration);
  
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
  
        setTimeout(resolve, 500);
      });
    }
  });
  
  // ===============================================
  // COLLECTIBLES TRACKER COMPONENT
  // ===============================================
  AFRAME.registerComponent('collectibles-tracker', {
    schema: { enabled: { default: true } },
  
    init: function() {
      this.playerStats = { collected: 0, points: 0, types: {} };
  
      if (!window.collectiblesSystem) {
        window.collectiblesSystem = { recordCollection: this.recordCollection.bind(this) };
      }
  
      console.log('Collectibles tracker component initialized');
    },
  
    recordCollection: function(collectibleType) {
      const typeConfig = COLLECTIBLE_TYPES[collectibleType];
      if (!typeConfig) return;
  
      //console.log(`Recording collection of ${collectibleType}`);
  
      this.playerStats.collected++;
      this.playerStats.points += typeConfig.points || 1;
  
      if (!this.playerStats.types[collectibleType]) {
        this.playerStats.types[collectibleType] = 0;
      }
      this.playerStats.types[collectibleType]++;
  
      this.updateStatsDisplay();
  
      const message = `+${typeConfig.points || 1} vibes!`;
      createVRNotification(message, 1500);
  
      return this.playerStats;
    },
  
    updateStatsDisplay: function() {
      const hudText = document.querySelector('#collectibles-hud-text');
      if (hudText) {
        //hudText.setAttribute('value', `vibes: ${this.playerStats.collected} | Points: ${this.playerStats.points}`);
        hudText.setAttribute('value', `vibes collected: ${this.playerStats.points}`);
        
        //console.log(`Updated HUD stats: Items: ${this.playerStats.collected}, Points: ${this.playerStats.points}`);
  
        if (this.playerStats.collected > 9 || this.playerStats.points > 99) {
          const panel = hudText.parentNode.querySelector('[geometry]');
          if (panel) {
            const width = Math.max(0.5, 0.3 + (this.playerStats.points.toString().length * 0.05));
            panel.setAttribute('geometry', { primitive: 'plane', width: width, height: 0.12 });
          }
        }
      } else {
        console.warn('HUD text element not found for stats update');
      }
    }
  });
  
  // ===============================================
  // COLLECTIBLE SYNC SYSTEM
  // ===============================================
  AFRAME.registerSystem('collectible-sync', {
    schema: { enabled: { default: true } },
  
    init: function() {
      this.collectibles = new Map();
      this.pendingUpdates = [];
      this.lastSyncTime = 0;
      this.syncInterval = 1000;
      this.socket = null;
  
      this.connectToSocketWhenReady();
    },
  
    connectToSocketWhenReady: function() {
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
      if (time - this.lastSyncTime > this.syncInterval) {
        this.lastSyncTime = time;
        this.syncWithServer();
      }
    },
  
    syncWithServer: function() {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
  
      if (this.pendingUpdates.length > 0) {
        this.socket.send(JSON.stringify({ type: 'collectibles-update', updates: this.pendingUpdates }));
        this.pendingUpdates = [];
      }
    },
  
    reportSpawn: function(id, type, position) {
      this.collectibles.set(id, { type: type, position: position, collected: false, collectedBy: null });
      this.pendingUpdates.push({ action: 'spawn', id: id, type: type, position: position });
    },
  
    reportCollection: function(id, playerId) {
      const collectible = this.collectibles.get(id);
      if (!collectible) return;
  
      collectible.collected = true;
      collectible.collectedBy = playerId;
  
      this.pendingUpdates.push({ action: 'collect', id: id, playerId: playerId });
    },
  
    reportRemoval: function(id) {
      this.collectibles.delete(id);
      this.pendingUpdates.push({ action: 'remove', id: id });
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
      if (this.collectibles.has(update.id)) return;
  
      this.collectibles.set(update.id, {
        type: update.type,
        position: update.position,
        collected: false,
        collectedBy: null
      });
  
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems) {
        const manager = scene.systems['collectible-manager'];
        if (manager) {
          manager.spawnCollectibleFromServer(update.id, update.type, update.position);
        }
      } else {
        console.error('No a-scene found or scene systems are not available');
      }
    },
  
    handleCollectionUpdate: function(update) {
      if (update.playerId === window.playerId) return;
  
      const collectible = this.collectibles.get(update.id);
      if (collectible) {
        collectible.collected = true;
        collectible.collectedBy = update.playerId;
      }
  
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems) {
        const manager = scene.systems['collectible-manager'];
        if (manager) {
          manager.markCollectibleCollected(update.id, update.playerId);
        }
      } else {
        console.error('No a-scene found or scene systems are not available');
      }
    },
  
    handleRemovalUpdate: function(update) {
      this.collectibles.delete(update.id);
  
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems) {
        const manager = scene.systems['collectible-manager'];
        if (manager) {
          manager.removeCollectible(update.id);
        }
      } else {
        console.error('No a-scene found or scene systems are not available');
      }
    }
  });
  
  // ===============================================
  // COLLECTIBLE MANAGER SYSTEM
  // ===============================================
  AFRAME.registerSystem('collectible-manager', {
    schema: {
      enabled: { default: true },
      spawnRadius: { type: 'number', default: 100 },
      maxCollectibles: { type: 'number', default: 7 },
      spawnInterval: { type: 'number', default: 10000 },
      chunkSize: { type: 'number', default: 64 },
      renderDistance: { type: 'number', default: 128 }
    },
  
    init: function() {
      this.collectibles = new Map();
      this.lastSpawnTime = 0;
      this.player = document.querySelector('#player').object3D;
      this.spawnContainer = document.createElement('a-entity');
      this.spawnContainer.setAttribute('id', 'collectibles-container');
      const scene = document.querySelector('a-scene');
      if (scene) {
        scene.appendChild(this.spawnContainer);
      } else {
        console.error('No a-scene found, cannot append collectibles container');
      }
  
      this.playerStats = { collected: 0, points: 0, types: {} };
  
      this.setupSync();
  
      /*
      // For testing.
      setTimeout(() => {
        console.log('Spawning initial collectibles very close to player');
        const playerPos = this.player.position;
        const testCollectible = document.createElement('a-entity');
  
        const angle = Math.random() * Math.PI * 2;
        const x = playerPos.x + Math.cos(angle) * 10;
        const z = playerPos.z + Math.sin(angle) * 10;
        const y = typeof getTerrainHeight === 'function' ? getTerrainHeight(x, z) : playerPos.y;
  
        testCollectible.setAttribute('position', `${x} ${y + 3} ${z}`);
        testCollectible.setAttribute('collectible', {
          type: 'kaparthy',
          uniqueId: 'test-collectible-' + Date.now()
        });
        this.spawnContainer.appendChild(testCollectible);
  
        for (let i = 0; i < 4; i++) {
          this.spawnCollectible();
        }
      }, 5000);
  
      console.log('Collectible manager initialized, will spawn test items in 5 seconds');
      */
    },
  
    setupSync: function() {
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems) {
        this.syncSystem = scene.systems['collectible-sync'];
        if (!this.syncSystem) {
          console.warn('collectible-sync system not found, collectible synchronization will be disabled');
        }
      } else {
        console.error('No a-scene found or scene systems are not available');
      }
    },
  
    tick: function(time) {
      if (!this.data.enabled || !this.player) return;
  
      if (time - this.lastSpawnTime > this.data.spawnInterval) {
        this.lastSpawnTime = time;
        this.spawnCollectibles();
      }
  
      this.checkCollectibleDistances();
    },
  
    spawnCollectibles: function() {
      if (this.collectibles.size >= this.data.maxCollectibles) return;
  
      const toSpawn = Math.min(3, this.data.maxCollectibles - this.collectibles.size);
      for (let i = 0; i < toSpawn; i++) {
        this.spawnCollectible();
      }
    },
  
    spawnCollectible: function() {
      const type = this.chooseCollectibleType();
      const uniqueId = 'collectible-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const position = this.getSpawnPosition();
  
      const collectible = document.createElement('a-entity');
      collectible.setAttribute('id', uniqueId);
      collectible.setAttribute('collectible', { type: type, uniqueId: uniqueId });
      collectible.setAttribute('position', position);
  
      collectible.addEventListener('loaded', () => {
        this.collectibles.set(uniqueId, {
          type: type,
          position: position,
          entity: collectible,
          spawnTime: Date.now()
        });
  
        if (this.syncSystem) {
          this.syncSystem.reportSpawn(uniqueId, type, position);
        }
      });
  
      this.spawnContainer.appendChild(collectible);
      return collectible;
    },
  
    chooseCollectibleType: function() {
      let totalSpawnRate = 0;
      const types = Object.keys(COLLECTIBLE_TYPES);
  
      types.forEach(type => {
        totalSpawnRate += COLLECTIBLE_TYPES[type].spawnRate || 1;
      });
  
      let random = Math.random() * totalSpawnRate;
      let cumulativeRate = 0;
  
      for (const type of types) {
        cumulativeRate += COLLECTIBLE_TYPES[type].spawnRate || 1;
        if (random <= cumulativeRate) {
          return type;
        }
      }
  
      return types[0];
    },
  
    getSpawnPosition: function() {
      const playerPos = this.player.position;
      const angle = Math.random() * Math.PI * 2;
      const minDistance = 15;
      const maxDistance = 50;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
  
      const x = playerPos.x + Math.cos(angle) * distance;
      const z = playerPos.z + Math.sin(angle) * distance;
      let y = 0;
  
      try {
        if (typeof getTerrainHeight === 'function') {
          y = getTerrainHeight(x, z);
          //console.log('Spawning collectible at height:', y);
        } else {
          console.warn('getTerrainHeight not found, using default height');
          y = playerPos.y;
        }
      } catch (e) {
        console.error('Error getting terrain height:', e);
        y = playerPos.y;
      }
  
      return `${x} ${y + 3} ${z}`;
    },
  
    checkCollectibleDistances: function() {
      if (!this.player) return;
  
      const playerPos = this.player.position;
      const maxDistance = this.data.renderDistance * 1.5;
  
      for (const [id, collectible] of this.collectibles.entries()) {
        if (!collectible.entity) continue;
  
        const pos = collectible.entity.object3D.position;
        const dx = playerPos.x - pos.x;
        const dz = playerPos.z - pos.z;
        const distSquared = dx * dx + dz * dz;
  
        const tooFar = distSquared > maxDistance * maxDistance;
        const tooOld = (Date.now() - collectible.spawnTime) > 300000;
  
        if (tooFar || tooOld) {
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
  
      if (collectible.entity && collectible.entity.parentNode) {
        collectible.entity.parentNode.removeChild(collectible.entity);
      }
  
      this.collectibles.delete(id);
  
      if (this.syncSystem) {
        this.syncSystem.reportRemoval(id);
      }
    },
  
    spawnCollectibleFromServer: function(id, type, position) {
      const collectible = document.createElement('a-entity');
      collectible.setAttribute('id', id);
      collectible.setAttribute('collectible', { type: type, uniqueId: id });
      collectible.setAttribute('position', position);
  
      this.collectibles.set(id, {
        type: type,
        position: position,
        entity: collectible,
        spawnTime: Date.now()
      });
  
      this.spawnContainer.appendChild(collectible);
      return collectible;
    },
  
    markCollectibleCollected: function(id, playerId) {
      const collectibleData = this.collectibles.get(id);
      if (!collectibleData || !collectibleData.entity) return;
  
      const collectible = collectibleData.entity;
      const component = collectible.components?.collectible;
  
      if (component) {
        component.data.collectedBy = playerId;
  
        if (playerId !== window.playerId && playerId !== 'local-player') {
          component.playCollectionAnimation().then(() => {
            this.removeCollectible(id);
          });
        } else {
          if (window.collectiblesSystem) {
            window.collectiblesSystem.recordCollection(component.data.type);
          }
          component.playCollectionAnimation().then(() => {
            this.removeCollectible(id);
          });
        }
      } else {
        setTimeout(() => {
          this.markCollectibleCollected(id, playerId);
        }, 100);
      }
    },
  
    recordCollection: function(collectibleType) {
      const typeConfig = COLLECTIBLE_TYPES[collectibleType];
      if (!typeConfig) return;
  
      //console.log(`Recording collection of ${collectibleType}`);
  
      this.playerStats.collected++;
      this.playerStats.points += typeConfig.points || 1;
  
      if (!this.playerStats.types[collectibleType]) {
        this.playerStats.types[collectibleType] = 0;
      }
      this.playerStats.types[collectibleType]++;
  
      this.updateStatsDisplay();
  
      const message = `+${typeConfig.points || 1} vibes!`;
      createVRNotification(message, 1500);
  
      return this.playerStats;
    },
  
    updateStatsDisplay: function() {
      const hudText = document.querySelector('#collectibles-hud-text');
      if (hudText) {
        hudText.setAttribute('value', `vibes collected: ${this.playerStats.points}`);
        //console.log(`Updated HUD stats: Items: ${this.playerStats.collected}, Points: ${this.playerStats.points}`);
  
        if (this.playerStats.collected > 9 || this.playerStats.points > 99) {
          const panel = hudText.parentNode.querySelector('[geometry]');
          if (panel) {
            const width = Math.max(0.5, 0.3 + (this.playerStats.points.toString().length * 0.05));
            panel.setAttribute('geometry', { primitive: 'plane', width: width, height: 0.12 });
          }
        }
      } else {
        console.warn('HUD text element not found for stats update');
      }
    }
  });
  
  // ===============================================
  // HUD FOR COLLECTIBLES
  // ===============================================
  AFRAME.registerComponent('collectibles-hud', {
    init: function() {
      const hudEntity = document.createElement('a-entity');
      hudEntity.setAttribute('id', 'collectibles-hud');
      hudEntity.setAttribute('position', '0 -0.4 -0.7');
  
      const isVR = AFRAME.utils.device.checkHeadsetConnected();
      const textScale = isVR ? '0.15 0.15 0.15' : '0.3 0.3 0.3';
  
      const panel = document.createElement('a-entity');
      panel.setAttribute('geometry', { primitive: 'plane', width: isVR ? 0.3 : 0.5, height: isVR ? 0.08 : 0.12 });
      panel.setAttribute('material', { color: 'rgba(4, 132, 157, 0.7)', opacity: 0.7, transparent: true, shader: 'flat' });
      panel.setAttribute('position', '0 0 -0.01');
      hudEntity.appendChild(panel);
  
      const hudText = document.createElement('a-text');
      hudText.setAttribute('id', 'collectibles-hud-text');
      hudText.setAttribute('value', 'collect vibes...');
      hudText.setAttribute('align', 'center');
      hudText.setAttribute('color', 'white');
      hudText.setAttribute('scale', textScale);
      hudText.setAttribute('width', 2);
      hudText.setAttribute('position', '0 0 0.01');
      hudEntity.appendChild(hudText);
  
      const camera = document.querySelector('#cam');
      if (camera) {
        camera.appendChild(hudEntity);
      }
    }
  });
  
  // ===============================================
  // VR-COMPATIBLE NOTIFICATIONS
  // ===============================================
  function createVRNotification(message, duration = 3000) {
    const notification = document.createElement('a-entity');
    notification.setAttribute('id', 'notification-' + Date.now());
  
    const isVR = AFRAME.utils.device.checkHeadsetConnected();
    notification.setAttribute('position', isVR ? '0 -0.2 -0.9' : '0 -0.3 -1');
  
    const panel = document.createElement('a-entity');
    panel.setAttribute('geometry', { primitive: 'plane', width: isVR ? 0.6 : 0.8, height: isVR ? 0.15 : 0.2 });
    panel.setAttribute('material', { color: '#000', opacity: 0.7, transparent: true, shader: 'flat' });
    panel.setAttribute('position', '0 0 -0.01');
    notification.appendChild(panel);
  
    const text = document.createElement('a-text');
    text.setAttribute('value', message);
    text.setAttribute('color', 'white');
    text.setAttribute('align', 'center');
    text.setAttribute('width', 1.5);
    text.setAttribute('wrap-count', 30);
    text.setAttribute('scale', isVR ? '0.15 0.15 0.15' : '0.25 0.25 0.25');
    notification.appendChild(text);
  
    const camera = document.querySelector('#cam');
    if (camera) {
      camera.appendChild(notification);
  
      notification.setAttribute('animation__fadein', {
        property: 'scale',
        from: '0.5 0.5 0.5',
        to: '1 1 1',
        dur: 300,
        easing: 'easeOutQuad'
      });
  
      setTimeout(() => {
        notification.setAttribute('animation__fadeout', {
          property: 'scale',
          from: '1 1 1',
          to: '0.5 0.5 0.5',
          dur: 300,
          easing: 'easeInQuad'
        });
  
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, duration);
    }
  
    return notification;
  }
  
  // ===============================================
  // Add a script to handle Collectible WebSocket messages
  // ===============================================
  document.addEventListener('DOMContentLoaded', function() {
    const checkSocket = function() {
      if (window.socket) {
        const originalOnMessage = window.socket.onmessage;
  
        window.socket.onmessage = function(event) {
          if (originalOnMessage) {
            originalOnMessage(event);
          }
  
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
        const trackerEntity = document.createElement('a-entity');
        trackerEntity.setAttribute('collectibles-tracker', '');
        trackerEntity.setAttribute('id', 'collectibles-tracker');
        scene.appendChild(trackerEntity);
  
        const hudEntity = document.createElement('a-entity');
        hudEntity.setAttribute('collectibles-hud', '');
        scene.appendChild(hudEntity);
  
        console.log('Collectibles system initialized');
      });
    }
  });