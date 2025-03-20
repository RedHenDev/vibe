// NPC Manager System
AFRAME.registerSystem('npc-manager', {
    schema: {
      maxNPCs: {type: 'number', default: 12}, // Maximum number of NPCs to spawn
      spawnRadius: {type: 'number', default: 100}, // Radius within which to spawn NPCs
      activationDistance: {type: 'number', default: 150}, // Distance at which NPCs become active
      performanceMode: {type: 'boolean', default: true} // Enable performance optimization
    },
  
    init: function() {
      this.player = document.querySelector('#player').object3D;
      this.npcs = []; // Array to track all NPCs
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
      
      // Initialize spawn system
      this.lastSpawnCheck = 0;
      this.spawnInterval = 2000; // Time between spawn checks (ms)
      
      // Performance tracking
      this.processingTime = 0;
      this.frameCount = 0;
      this.avgProcessingTime = 0;
      
      console.log('NPC Manager initialized');
    },
    
    defineNPCTypes: function() {
      // Define different types of NPCs
      this.npcTypes = {
        'glasst': {
          model: '#mGlasst',
          scale: '1 1 1',
          height: 12,
          speed: 7,
          rSpeed: 0.9,
          clampY: false,
          wiggle: true,
          flee: false,
          spawnChance: 1 // 70% chance to spawn this type
        },
        'runner': {
          model: '#mGlasst', // Same model but different behavior
          scale: '32 32 32',
          height: 64,
          speed: 1.2,
          rSpeed: 1.2,
          clampY: true,
          wiggle: true,
          flee: false,
          spawnChance: 0 // 30% chance to spawn this type
        },
        'fleer': {
          model: '#mGlasst', // Same model but flees from player
          scale: '2 2 2',
          height: 6,
          speed: 0.8,
          rSpeed: 1.0,
          clampY: true,
          wiggle: true,
          flee: true,
          spawnChance: 0 // 30% chance to spawn this type
        }
      };
    },
    
    tick: function(time) {
      //const startTime = performance.now();
      
      // Don't run every frame - check periodically for performance
      if (time - this.lastSpawnCheck > this.spawnInterval) {
        this.lastSpawnCheck = time;
        this.updateNPCs();
      }
      
      // Calculate processing time for performance monitoring
      //const endTime = performance.now();
      //this.processingTime += (endTime - startTime);
      this.frameCount++;
      
      // Update average every second
    //   if (time - this.lastSpawnCheck > 1000) {
    //     this.avgProcessingTime = this.processingTime / this.frameCount;
    //     this.processingTime = 0;
    //     this.frameCount = 0;
    //   }
    },
    
    getPerformanceStats: function() {
      return {
        avgProcessingTime: this.avgProcessingTime,
        npcCount: this.npcs.length,
        activeCount: this.npcs.filter(npc => npc.active).length
      };
    },
    
    // Find the updateNPCs function in npc-manager.js and replace it with this:
updateNPCs: function() {
    const player = this.player;
    
    // Check if we need to spawn more NPCs
    // FIXED: Spawn multiple NPCs per update, up to 5 at once
    const maxSpawnsPerUpdate = 5;
    const neededNPCs = this.data.maxNPCs - this.npcs.length;
    
    if (neededNPCs > 0) {
      const spawnCount = Math.min(neededNPCs, maxSpawnsPerUpdate);
      //console.log(`Spawning ${spawnCount} NPCs to reach target of ${this.data.maxNPCs}`);
      
      for (let i = 0; i < spawnCount; i++) {
        this.spawnNPC();
      }
    }
    
    // Update active/inactive state based on distance
    this.npcs.forEach((npc, index) => {
      if (!npc.el) return; // Skip if entity reference is missing
      
      const npcPosition = npc.el.object3D.position;
      const distanceToPlayer = new THREE.Vector3().subVectors(npcPosition, player.position).length();
      
      // If NPC is too far, remove it
      if (distanceToPlayer > this.data.spawnRadius * 1.5) {
        this.removeNPC(index);
        return;
      }
      
      // Activate/deactivate based on distance
      if (this.data.performanceMode) {
        const shouldBeActive = distanceToPlayer < this.data.activationDistance;
        if (shouldBeActive !== npc.active) {
          npc.active = shouldBeActive;
          this.toggleNPCActivity(npc);
        }
      }
    });
    },
    
    toggleNPCActivity: function(npc) {
      // Enable/disable AI behavior based on distance
      if (!npc.el) return;
      
      const aiComponent = npc.el.components['ai-locomotion'];
      if (aiComponent) {
        if (npc.active) {
          // Restore original behavior
          aiComponent.data.speed = npc.originalSpeed;
          aiComponent.data.active = true;
          
          // Set update interval based on distance (optimization)
          const distance = new THREE.Vector3().subVectors(
            npc.el.object3D.position, 
            this.player.position
          ).length();
          
          // Closer NPCs update more frequently
          if (distance < 30) {
            aiComponent.data.updateInterval = 1;
          } else if (distance < 60) {
            aiComponent.data.updateInterval = 2;
          } else {
            aiComponent.data.updateInterval = 4;
          }
        } else {
          // Store original speed and stop movement
          npc.originalSpeed = aiComponent.data.speed;
          aiComponent.data.speed = 0;
          aiComponent.data.active = false;
          // Set high update interval for inactive NPCs
          aiComponent.data.updateInterval = 10;
        }
      }
    },
    
    spawnNPC: function() {
      // Determine spawn position in a ring around the player
      const angle = Math.random() * Math.PI * 2;
      const distance = this.data.activationDistance * 0.8 + (Math.random() * this.data.activationDistance * 0.2);
      
      const spawnX = this.player.position.x + Math.cos(angle) * distance;
      const spawnZ = this.player.position.z + Math.sin(angle) * distance;
      
      // Get terrain height at spawn position
      const spawnY = getTerrainHeight(spawnX, spawnZ);
      
      // Pick a random NPC type based on spawn chances
      const npcType = this.getRandomNPCType();
      const npcConfig = this.npcTypes[npcType];
      
      // Create the NPC entity
      const npcEntity = document.createElement('a-entity');
      npcEntity.setAttribute('gltf-model', npcConfig.model);
      npcEntity.setAttribute('scale', npcConfig.scale);
      npcEntity.setAttribute('position', `${spawnX} ${spawnY + npcConfig.height} ${spawnZ}`);
      
      // Set unique ID for easier tracking
      const npcId = 'npc-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      npcEntity.setAttribute('id', npcId);
      
      // Determine update interval based on distance (optimization)
      const updateInterval = this.calculateUpdateInterval(distance);
      
      // Add AI component
      npcEntity.setAttribute('ai-locomotion', {
        height: npcConfig.height,
        speed: npcConfig.speed,
        targetID: '#player',
        rSpeed: npcConfig.rSpeed,
        clampY: npcConfig.clampY,
        wiggle: npcConfig.wiggle,
        flee: npcConfig.flee,
        updateInterval: updateInterval,
        terrainOffset: 2 // Add small random offset to terrain height
      });
      
      // Add to container
      this.npcContainer.appendChild(npcEntity);
      
      // Store reference
      this.npcs.push({
        el: npcEntity,
        type: npcType,
        id: npcId,
        active: true,
        originalSpeed: npcConfig.speed,
        spawnTime: Date.now()
      });
      
      //console.log(`Spawned ${npcType} NPC at ${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}`);
    },
    
    calculateUpdateInterval: function(distance) {
      // Determine how often the NPC should update based on distance
      if (distance < 30) {
        return 1; // Update every frame when close
      } else if (distance < 60) {
        return 2; // Update every other frame when medium distance
      } else {
        return 4; // Update every 4 frames when far
      }
    },
    
    removeNPC: function(index) {
        if (index >= 0 && index < this.npcs.length) {
          const npc = this.npcs[index];
          
          // Remove from DOM
          if (npc.el && npc.el.parentNode) {
            npc.el.parentNode.removeChild(npc.el);
          }
          
          // Remove from array - IMPORTANT: This changes array indices!
          this.npcs.splice(index, 1);
          //console.log(`Removed NPC, count now: ${this.npcs.length}`);
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
      maxNPCs: {type: 'number', default: 30},
      spawnRadius: {type: 'number', default: 100},
      activationDistance: {type: 'number', default: 150},
      performanceMode: {type: 'boolean', default: true}
    },
    
    init: function() {
      // Pass configuration to the system
      const system = this.el.sceneEl.systems['npc-manager'];
      if (system) {
        system.data.maxNPCs = this.data.maxNPCs;
        system.data.spawnRadius = this.data.spawnRadius;
        system.data.activationDistance = this.data.activationDistance;
        system.data.performanceMode = this.data.performanceMode;
      }
    }
  });