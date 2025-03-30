// NPC Manager System with Object Pooling
AFRAME.registerSystem('npc-manager', {
    schema: {
      maxNPCs: {type: 'number', default: 12}, // Maximum number of NPCs to spawn
      poolSize: {type: 'number', default: 12}, // Size of the NPC pool (should be >= maxNPCs)
      spawnRadius: {type: 'number', default: 360}, // Radius within which to spawn NPCs
      activationDistance: {type: 'number', default: 120}, // Distance at which NPCs become active
      performanceMode: {type: 'boolean', default: true} // Enable performance optimization
    },
  
    init: function() {
      console.log('Initializing NPC Manager with Object Pooling');
      this.player = document.querySelector('#player').object3D;
      this.npcs = []; // Array to track all NPCs (active and inactive)
      this.activeNPCs = new Set(); // Set of active NPCs
      this.inactiveNPCs = new Set(); // Pool of inactive NPCs
      this.npcTypes = {}; // Store definitions of different NPC types
      this.npcContainer = document.querySelector('#npcs'); // Container for all NPCs
      
      if (!this.npcContainer) {
        // Create container if it doesn't exist
        this.npcContainer = document.createElement('a-entity');
        this.npcContainer.id = 'npcs';
        document.querySelector('a-scene').appendChild(this.npcContainer);
      }
      
      // Set up NPC definitions
      this.defineNPCTypes();
      
      // Initialize the NPC pool
      this.initializeNPCPool();
      
      // Initialize spawn system
      this.lastSpawnCheck = 0;
      this.spawnInterval = 1000; // Time between spawn checks (ms)
      
      // Performance tracking
      this.processingTime = 0;
      this.frameCount = 0;
      this.avgProcessingTime = 0;
      
      console.log(`NPC Pool created with ${this.data.poolSize} entities`);
    },
    
    defineNPCTypes: function() {
      // Define different types of NPCs
      this.npcTypes = {
        'glass-tooth_3': {
          model: '#mGlasst',
          scale: '3 3 3',
          targetID: '#player',
          height: 12,
          speed: 7,
          rSpeed: 0.9,
          clampY: false,
          adjustY: 3.14,
          wiggle: true,
          flee: false,
          spawnChance: 0 // 100% chance to spawn this type
        },
        'vibe-leech': {
          model: '#mCublit', // Different model!
          scale: '32 32 32',
          height: 64,
          speed: 1.2,
          rSpeed: 1.2,
          clampY: false,
          wiggle: false,
          flee: false,
          spawnChance: 0 // 0% chance to spawn this type
        },
        'glass-tooth_7': {
          model: '#mGlasst', // Same model but flees from player
          scale: '7 7 7',
          height: 6,
          speed: 0.8,
          rSpeed: 1.0,
          clampY: false,
          adjustY: 3.14,
          wiggle: true,
          flee: false,
          spawnChance: 0 // 0% chance to spawn this type
        },
        'shelby': {
            model: '#mShelby', // Different model!
            scale: '4 4 4',
            height: 2,
            speed: 0.5,
            rSpeed: 4.2,
            clampY: true,
            wiggle: true,
            flee: false,
            spawnChance: 1.0 // 0% chance to spawn this type
          }
      };
    },
    
    initializeNPCPool: function() {
      // Create all NPCs upfront and store them in the inactive pool
      for (let i = 0; i < this.data.poolSize; i++) {
        // Determine the NPC type
        const npcType = this.getRandomNPCType();
        const npcConfig = this.npcTypes[npcType];
        
        // Create the NPC entity
        const npcEntity = document.createElement('a-entity');
        npcEntity.setAttribute('gltf-model', npcConfig.model);
        npcEntity.setAttribute('scale', npcConfig.scale);
        
        // Position far away initially (will be properly positioned when activated)
        npcEntity.setAttribute('position', '0 -9999 0');
        
        // Set unique ID for easier tracking
        const npcId = 'npc-pool-' + i;
        npcEntity.setAttribute('id', npcId);
        
        // Add AI component but set to inactive
        npcEntity.setAttribute('ai-locomotion', {
          height: npcConfig.height,
          speed: 0, // Start with zero speed (inactive)
          targetID: '#player',
          rSpeed: npcConfig.rSpeed,
          clampY: npcConfig.clampY,
          wiggle: npcConfig.wiggle,
          flee: npcConfig.flee,
          updateInterval: 10, // Low update frequency when inactive
          terrainOffset: 2,
          active: false // Start inactive
        });
        
        // Add to container
        this.npcContainer.appendChild(npcEntity);
        
        // Create a reference object
        const npcRef = {
          el: npcEntity,
          type: npcType,
          id: npcId,
          active: false,
          originalSpeed: npcConfig.speed,
          spawnTime: 0
        };
        
        // Store in arrays
        this.npcs.push(npcRef);
        this.inactiveNPCs.add(npcRef);
      }
    },
    
    tick: function(time) {
      // Don't run every frame - check periodically for performance
      if (time - this.lastSpawnCheck > this.spawnInterval) {
        this.lastSpawnCheck = time;
        this.updateNPCs();
        
        // Update performance stats in UI
        this.updateNPCStats();
      }
    },
    
    updateNPCStats: function() {
      // Update the NPC stats display in the UI
      const npcCountEl = document.getElementById('npc-count');
      const npcMaxEl = document.getElementById('npc-max');
      const npcTimeEl = document.getElementById('npc-time');
      
      if (npcCountEl) {
        npcCountEl.textContent = `${this.activeNPCs.size} active / ${this.npcs.length} total`;
      }
      
      if (npcMaxEl) {
        npcMaxEl.textContent = this.data.maxNPCs;
      }
      
      if (npcTimeEl) {
        npcTimeEl.textContent = `${this.avgProcessingTime.toFixed(2)} ms`;
      }
    },
    
    updateNPCs: function() {
      const player = this.player;
      
      // Check if we need to activate more NPCs
      const activeCount = this.activeNPCs.size;
      const neededNPCs = this.data.maxNPCs - activeCount;
      
      if (neededNPCs > 0 && this.inactiveNPCs.size > 0) {
        const maxActivations = Math.min(neededNPCs, 5, this.inactiveNPCs.size); // Max 5 at once
        
        for (let i = 0; i < maxActivations; i++) {
          this.activateNPC();
        }
      }
      
      // Update active NPCs based on distance
      for (const npc of this.activeNPCs) {
        if (!npc.el) continue; // Skip if entity reference is missing
        
        const npcPosition = npc.el.object3D.position;
        const distanceToPlayer = new THREE.Vector3().subVectors(npcPosition, player.position).length();
        
        // If NPC is too far, deactivate it
        if (distanceToPlayer > this.data.spawnRadius * 1.5) {
          this.deactivateNPC(npc);
          continue;
        }
        
        // Update activity level based on distance
        if (this.data.performanceMode) {
          const shouldBeFullyActive = distanceToPlayer < this.data.activationDistance;
          this.updateNPCActivity(npc, shouldBeFullyActive, distanceToPlayer);
        }
      }
    },
    
    activateNPC: function() {
      // Take the first NPC from the inactive pool
      const npc = this.inactiveNPCs.values().next().value;
      if (!npc) return; // No inactive NPCs available
      
      // Remove from inactive pool
      this.inactiveNPCs.delete(npc);
      
      // Determine spawn position in a ring around the player
      const angle = Math.random() * Math.PI * 2;
      const distance = this.data.activationDistance * 0.8 + (Math.random() * this.data.activationDistance * 0.2);
      
      const spawnX = this.player.position.x + Math.cos(angle) * distance;
      const spawnZ = this.player.position.z + Math.sin(angle) * distance;
      
      // Get terrain height at spawn position
      const spawnY = getTerrainHeight(spawnX, spawnZ);
      
      // Get configuration for this NPC type
      const npcConfig = this.npcTypes[npc.type];
      
      // Update position
      //npc.el.setAttribute('position', `${spawnX} ${spawnY + npcConfig.height} ${spawnZ}`);
      // Spawn at -20 so that does not suddenly appear in air.
      npc.el.setAttribute('position', `${spawnX} -20 ${spawnZ}`);
      
      // Restore original speed and activate
      const aiComponent = npc.el.components['ai-locomotion'];
      if (aiComponent) {
        aiComponent.data.speed = npcConfig.speed;
        aiComponent.data.active = true;
        aiComponent.data.updateInterval = 1; // Normal update frequency
      }
      
      // Mark as active
      npc.active = true;
      npc.spawnTime = Date.now();
      
      // Add to active set
      this.activeNPCs.add(npc);
      
      // console.log(`Activated ${npc.type} NPC at ${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}`);
    },
    
    deactivateNPC: function(npc) {
      if (!npc || !npc.el) return;
      
      // Remove from active set
      this.activeNPCs.delete(npc);
      
      // Stop movement and deactivate AI
      const aiComponent = npc.el.components['ai-locomotion'];
      if (aiComponent) {
        aiComponent.data.speed = 0;
        aiComponent.data.active = false;
        aiComponent.data.updateInterval = 10; // Low update frequency
      }
      
      // Move far away (below the terrain)
      npc.el.setAttribute('position', '0 -9999 0');
      
      // Mark as inactive
      npc.active = false;
      
      // Add to inactive pool
      this.inactiveNPCs.add(npc);
      
      // console.log(`Deactivated NPC, active count: ${this.activeNPCs.size}`);
    },
    
    updateNPCActivity: function(npc, fullyActive, distance) {
      if (!npc.el) return;
      
      const aiComponent = npc.el.components['ai-locomotion'];
      if (!aiComponent) return;
      
      if (fullyActive) {
        // Full speed when close
        aiComponent.data.speed = this.npcTypes[npc.type].speed;
        aiComponent.data.active = true;
        
        // Update frequency based on distance
        if (distance < 30) {
          aiComponent.data.updateInterval = 1; // Every frame when very close
        } else if (distance < 60) {
          aiComponent.data.updateInterval = 2; // Every other frame when medium distance
        } else {
          aiComponent.data.updateInterval = 3; // Every third frame when farther
        }
      } else {
        // Reduced activity for distant NPCs
        // Instead of fully deactivating, we reduce speed and update frequency
        const distanceFactor = Math.max(0, 1 - (distance - this.data.activationDistance) / 50);
        aiComponent.data.speed = this.npcTypes[npc.type].speed * distanceFactor * 0.5;
        aiComponent.data.updateInterval = 5; // Reduced update frequency
        aiComponent.data.active = distanceFactor > 0.1; // Only deactivate if very far
      }
    },
    
    getRandomNPCType: function() {
      // Select NPC type based on spawn chances
      const rand = Math.random();
      let cumulativeChance = 0;
      
      // Normalize chances
      const types = Object.keys(this.npcTypes);
      let totalChance = 0;
      types.forEach(type => {
        totalChance += this.npcTypes[type].spawnChance;
      });
      
      // Pick based on normalized probabilities
      for (const type of types) {
        cumulativeChance += this.npcTypes[type].spawnChance / totalChance;
        if (rand < cumulativeChance) {
          return type;
        }
      }
      
      // Default to first type
      return types[0];
    }
  });
  
  // NPC Manager Component (attached to a single entity to control the system)
  AFRAME.registerComponent('npc-manager', {
    schema: {
      enabled: {type: 'boolean', default: true},
      maxNPCs: {type: 'number', default: 12},
      poolSize: {type: 'number', default: 20}, // Should be >= maxNPCs
      spawnRadius: {type: 'number', default: 100},
      activationDistance: {type: 'number', default: 150},
      performanceMode: {type: 'boolean', default: true}
    },
    
    init: function() {
      // Pass configuration to the system
      const system = this.el.sceneEl.systems['npc-manager'];
      if (system) {
        system.data.maxNPCs = this.data.maxNPCs;
        system.data.poolSize = Math.max(this.data.poolSize, this.data.maxNPCs);
        system.data.spawnRadius = this.data.spawnRadius;
        system.data.activationDistance = this.data.activationDistance;
        system.data.performanceMode = this.data.performanceMode;
      }
    },
    
    update: function(oldData) {
      // When maxNPCs changes, update the system
      if (oldData.maxNPCs !== this.data.maxNPCs) {
        const system = this.el.sceneEl.systems['npc-manager'];
        if (system) {
          system.data.maxNPCs = this.data.maxNPCs;
        }
      }
    }
  });