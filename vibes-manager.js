// Collectibles Manager for Eigengrau Light
// Handles spawning, tracking, and UI for collectibles

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      // Create and add collectibles manager entity
      const managerEntity = document.createElement('a-entity');
      managerEntity.setAttribute('id', 'collectibles-manager');
      managerEntity.setAttribute('collectibles-manager', '');
      scene.appendChild(managerEntity);
      
      // Create HUD for displaying collected count
      const hudEntity = document.createElement('a-entity');
      hudEntity.setAttribute('collectibles-hud', '');
      scene.appendChild(hudEntity);
      
      console.log('Collectibles system initialized');
    });
  }
});

// Main collectibles manager system
AFRAME.registerSystem('collectible-manager', {
  schema: {
    enabled: { default: true },
    maxCollectibles: { default: 200 },
    spawnRadius: { default: 100 },
    spawnInterval: { default: 10000 }, // ms between spawn attempts
    renderDistance: { default: 150 }
  },

  init: function() {
    // Storage for active collectibles
    this.collectibles = new Map();
    
    // Get player reference
    this.player = document.querySelector('#player').object3D;
    
    // Create container for collectibles
    this.container = document.createElement('a-entity');
    this.container.setAttribute('id', 'collectibles-container');
    this.el.sceneEl.appendChild(this.container);
    
    // Initialize player stats
    this.stats = {
      collected: 0,
      points: 0,
      vibes: 0,
      karpathys: 0
    };
    
    // Performance optimization settings
    this._lastCleanup = 0;
    this._cleanupInterval = 5000; // Only check for cleanup every 5 seconds
    this._maxActiveCollectibles = 64; // Limit active collectibles for performance
    
    // Last spawn timestamp
    this.lastSpawnTime = 0;
    
    // Track player position for movement-based spawning
    this.lastPlayerPos = new THREE.Vector3();
    if (this.player) {
      this.lastPlayerPos.copy(this.player.position);
    }
    
    // Distance player must move to trigger spawning
    this.spawnMovementThreshold = 12; // Increased to reduce spawn frequency
    
    // Make the manager globally accessible
    window.collectiblesManager = {
      recordCollection: this.recordCollection.bind(this)
    };
    
    // Set up sync system for multiplayer
    this.setupSync();
    
    // Initial spawn - fewer collectibles for better performance
    this.spawnCollectibles(3); // Spawn initial batch
    
    console.log("Performance-optimized collectibles manager initialized");
  },
  
  tick: function(time) {
    if (!this.data.enabled || !this.player) return;
    
    // Performance optimization: Only run tick logic at certain intervals
    if (!this._lastTick || time - this._lastTick > 1000) { // Check once per second instead of every frame
      this._lastTick = time;
      
      // Spawn based on both time and movement, but less frequently
      const now = time || performance.now();
      const timeTrigger = (now - this.lastSpawnTime > this.data.spawnInterval * 1.5); // 50% longer interval
      
      // Check player movement
      const playerPos = this.player.position;
      const dx = playerPos.x - this.lastPlayerPos.x;
      const dz = playerPos.z - this.lastPlayerPos.z;
      const distMoved = Math.sqrt(dx*dx + dz*dz);
      const movementTrigger = (distMoved > this.spawnMovementThreshold);
      
      // Spawn if triggered by time or movement, but only if we don't have too many already
      if ((timeTrigger || movementTrigger) && this.collectibles.size < this._maxActiveCollectibles) {
        this.lastSpawnTime = now;
        this.lastPlayerPos.copy(playerPos);
        this.spawnCollectibles(1); // Only spawn one at a time for better performance
      }
      
      // Only run cleanup occasionally for performance
      if (!this._lastCleanup || now - this._lastCleanup > this._cleanupInterval) {
        this._lastCleanup = now;
        this.cleanupDistantCollectibles();
      }
    }
  },
  
  spawnCollectibles: function(count) {
    // Performance guard: don't exceed maximum
    if (this.collectibles.size >= this._maxActiveCollectibles) {
      return;
    }
    
    // Calculate how many to spawn (default to 1 for performance)
    const toSpawn = count || 1;
    
    // Don't spawn too many at once
    const actualSpawn = Math.min(toSpawn, 2);
    
    for (let i = 0; i < actualSpawn; i++) {
      // Mostly spawn vibes, occasionally karpathy crystals
      //const type = Math.random() > 0.7 ? 'karpathy' : 'vibe';
      let type;
      const whatPickup = Math.random();
      if (whatPickup < 0.2) type = 'karpathy';
      else if (whatPickup < 0.5) type = 'ring';
      else type = 'vibe';
      this.spawnCollectible(type);
    }
  },
  
  spawnCollectible: function(type) {
    // Generate unique ID
    const uniqueId = `collectible-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Get spawn position
    const position = this.getSpawnPosition();
    
    // Create the collectible entity
    const collectible = document.createElement('a-entity');
    collectible.setAttribute('id', uniqueId);
    collectible.setAttribute('collectible', {
      type: type,
      uniqueId: uniqueId
    });
    collectible.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
    
    // Add to scene
    this.container.appendChild(collectible);
    
    // Track in our map
    this.collectibles.set(uniqueId, {
      entity: collectible,
      type: type,
      position: position,
      spawnTime: Date.now()
    });
    
    // Report to sync system if available
    if (this.syncSystem) {
      this.syncSystem.reportSpawn(uniqueId, type, position);
    }
    
    return collectible;
  },
  
  getSpawnPosition: function() {
    const playerPos = this.player.position;
    
    // Random angle and distance from player
    const angle = Math.random() * Math.PI * 2;
    const minDistance = 20;  // Not too close
    const maxDistance = 80;  // Not too far
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    
    // Calculate position
    const x = playerPos.x + Math.cos(angle) * distance;
    const z = playerPos.z + Math.sin(angle) * distance;
    
    // Get terrain height and add offset
    let y = 0;
    try {
      if (typeof getTerrainHeight === 'function') {
        y = getTerrainHeight(x, z);
      } else {
        y = playerPos.y;
      }
    } catch (e) {
      console.error('Error getting terrain height:', e);
      y = playerPos.y;
    }
    
    // Add vertical offset to ensure visibility
    return { x, y: y + 4 + Math.random() * 4, z };
  },
  
  cleanupDistantCollectibles: function() {
    if (!this.player) return;
    
    const playerPos = this.player.position;
    // Use a smaller cleanup radius for performance
    const maxDistanceSquared = (this.data.renderDistance * 0.7) * (this.data.renderDistance * 0.7);
    
    let removedCount = 0;
    
    // Remove distant collectibles
    for (const [id, data] of this.collectibles.entries()) {
      if (!data.entity) continue;
      
      // Calculate squared distance (more performant than using sqrt)
      const collectiblePos = data.entity.object3D.position;
      const dx = playerPos.x - collectiblePos.x;
      const dz = playerPos.z - collectiblePos.z;
      const distSquared = dx*dx + dz*dz;
      
      // Remove if too far or too old (1 minute instead of 5 minutes)
      const tooFar = distSquared > maxDistanceSquared;
      const tooOld = (Date.now() - data.spawnTime) > 60000; // 1 minute max lifetime
      
      if (tooFar || tooOld) {
        this.removeCollectible(id);
        removedCount++;
        
        // Limit how many we remove in one pass for performance
        if (removedCount >= 5) break;
      }
    }
  },
  
  removeCollectible: function(id) {
    const collectible = this.collectibles.get(id);
    if (!collectible) return;
    
    // Remove from scene with less visual processing
    if (collectible.entity && collectible.entity.parentNode) {
      // Skip animations and simply remove
      collectible.entity.parentNode.removeChild(collectible.entity);
    }
    
    // Remove from tracking
    this.collectibles.delete(id);
    
    // Report to sync system if available, but only occasionally 
    // to reduce network traffic
    if (this.syncSystem && Math.random() < 0.5) { // 50% chance to report each removal
      this.syncSystem.reportRemoval(id);
    }
  },
  
  // This is just the updated recordCollection function
  recordCollection: function(type) {
    // Update stats
    this.stats.collected++;
    
    // Get points from COLLECTIBLE_TYPES if available, otherwise use fallback values
    let points = 1; // Default fallback for vibe
    if (type === 'vibe') {
      this.stats.vibes++;
      // Try to get points from COLLECTIBLE_TYPES
      if (window.COLLECTIBLE_TYPES && window.COLLECTIBLE_TYPES.vibe) {
        points = window.COLLECTIBLE_TYPES.vibe.points;
      }
    } else if (type === 'karpathy') {
      this.stats.karpathys++;
      // Try to get points from COLLECTIBLE_TYPES
      if (window.COLLECTIBLE_TYPES && window.COLLECTIBLE_TYPES.karpathy) {
        points = window.COLLECTIBLE_TYPES.karpathy.points;
      } else {
        points = 2; // Fallback value
      }
    }
    
    // Add points to total
    this.stats.points += points;
    
    // Update HUD
    this.updateHud();
    
    return this.stats;
  },
  
  updateHud: function() {
    // Find HUD text element
    const hudText = document.querySelector('#collectibles-hud-text');
    if (hudText) {
      hudText.setAttribute('value', `vibes ${this.stats.points}`);
    }
  },
  
  // Optimized sync system
  setupSync: function() {
    // Only enable sync if absolutely necessary - major performance impact
    const syncEnabled = false; // Set to true only if multiplayer is critical
    
    if (!syncEnabled) {
      console.log('Collectible sync disabled for performance');
      return;
    }
    
    // Get reference to sync system if it exists
    const scene = document.querySelector('a-scene');
    if (scene && scene.systems && scene.systems['collectible-sync']) {
      this.syncSystem = scene.systems['collectible-sync'];
    }
  }
});

// Component for the manager entity
AFRAME.registerComponent('collectibles-manager', {
  init: function() {
    // Just a wrapper component to initialize the system
    console.log('Collectibles manager component initialized');
  }
});

// Simple HUD for displaying collectibles count
AFRAME.registerComponent('collectibles-hud', {
  init: function() {
    // Create HUD panel
    const camera = document.querySelector('#cam');
    if (!camera) return;
    
    const hudEntity = document.createElement('a-entity');
    hudEntity.setAttribute('position', '0 -0.4 -1');
    
    // Background panel
    const panel = document.createElement('a-entity');
    panel.setAttribute('geometry', { 
      primitive: 'plane', 
      width: 0.4, 
      height: 0.15 
    });
    panel.setAttribute('material', { 
      color: 'rgba(4, 132, 157, 0.7)', 
      opacity: 0.7, 
      transparent: true, 
      shader: 'flat' 
    });
    panel.setAttribute('position', '0 0 -0.01');
    hudEntity.appendChild(panel);
    
    // Text display
    const hudText = document.createElement('a-text');
    hudText.setAttribute('id', 'collectibles-hud-text');
    hudText.setAttribute('value', 'vibes 0');
    hudText.setAttribute('align', 'center');
    hudText.setAttribute('color', 'white');
    hudText.setAttribute('width', 1.8);
    hudText.setAttribute('style', 'bold');
    hudText.setAttribute('position', '0 0.02 0.01');
    hudEntity.appendChild(hudText);
    
    // Add to camera
    camera.appendChild(hudEntity);
  }
});

// Basic sync system for multiplayer
AFRAME.registerSystem('collectible-sync', {
  init: function() {
    this.collectibles = new Map();
    this.pendingUpdates = [];
    this.lastSyncTime = 0;
    this.syncInterval = 2000;
    
    // Connect to WebSocket if available
    this.connectToWebSocket();
  },
  
  connectToWebSocket: function() {
    // Use existing socket if available
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      this.socket = window.socket;
      this.setupMessageHandler();
    }
  },
  
  setupMessageHandler: function() {
    if (!this.socket) return;
    
    const originalOnMessage = this.socket.onmessage;
    
    this.socket.onmessage = (event) => {
      // Call original handler
      if (originalOnMessage) {
        originalOnMessage(event);
      }
      
      // Handle collectible messages
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'collectibles-update') {
          this.handleSyncMessage(message);
        }
      } catch (e) {
        console.error('Error parsing collectible sync message:', e);
      }
    };
  },
  
  tick: function(time) {
    // Sync with server periodically
    if (time - this.lastSyncTime > this.syncInterval) {
      this.lastSyncTime = time;
      this.sendPendingUpdates();
    }
  },
  
  reportSpawn: function(id, type, position) {
    this.collectibles.set(id, {
      type: type,
      position: position,
      collected: false
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
  
  sendPendingUpdates: function() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.pendingUpdates.length === 0) return;
    
    this.socket.send(JSON.stringify({
      type: 'collectibles-update',
      updates: this.pendingUpdates
    }));
    
    this.pendingUpdates = [];
  },
  
  handleSyncMessage: function(message) {
    const updates = message.updates || [];
    const scene = document.querySelector('a-scene');
    const manager = scene.systems['collectible-manager'];
    
    updates.forEach(update => {
      switch (update.action) {
        case 'spawn':
          if (!this.collectibles.has(update.id) && manager) {
            this.collectibles.set(update.id, {
              type: update.type,
              position: update.position,
              collected: false
            });
            
            manager.spawnCollectible(update.type);
          }
          break;
          
        case 'collect':
          if (update.playerId !== window.playerId) {
            const collectible = this.collectibles.get(update.id);
            if (collectible) {
              collectible.collected = true;
              manager.removeCollectible(update.id);
            }
          }
          break;
          
        case 'remove':
          this.collectibles.delete(update.id);
          if (manager) {
            manager.removeCollectible(update.id);
          }
          break;
      }
    });
  }
});