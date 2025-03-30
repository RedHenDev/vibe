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
  
      // Set up callback for when day-night cycle entity is available
      this.waitForDayNightCycle();
      
      console.log(`NPC Pool created with ${this.data.poolSize} entities`);
    },
    
    waitForDayNightCycle: function() {
      // This will check for the day-night-cycle component and set a reference to it when available
      const checkForCycle = () => {
        const cycleEntity = document.querySelector('#day-night-cycle');
        if (cycleEntity && cycleEntity.components && cycleEntity.components['day-night-cycle']) {
          this.dayNightCycle = cycleEntity.components['day-night-cycle'];
          console.log('NPC Manager connected to day-night-cycle');
        } else {
          // If not found, try again in a moment
          setTimeout(checkForCycle, 1000);
        }
      };
      
      // Start checking
      checkForCycle();
    },
    
    isNightTime: function() {
      // Check if it's night time based on day-night-cycle component
      if (this.dayNightCycle) {
        return this.dayNightCycle.isNight;
      }
      
      // Fallback if day-night cycle not available yet
      return false;
    },
    
    defineNPCTypes: function() {
      // Define different types of NPCs with nocturnal property
      this.npcTypes = {
        'glass-tooth_3': {
          model: '#mGlasst',
          nocturnal: true,
          scale: '3 3 3',
          targetID: '#player',
          height: 12,
          speed: 7,
          rSpeed: 0.9,
          clampY: false,
          adjustY: 3.14,
          wiggle: true,
          flee: false,
          spawnChance: 0.33
        },
        'vibe-slip': {
          model: '#mCublit',
          nocturnal: true,
          scale: '32 32 32',
          height: 64,
          speed: 1.2,
          rSpeed: 1.2,
          clampY: false,
          wiggle: false,
          flee: false,
          spawnChance: 0.33
        },
        'glass-tooth_7': {
          model: '#mGlasst',
          nocturnal: true,
          scale: '7 7 7',
          height: 6,
          speed: 0.8,
          rSpeed: 1.0,
          clampY: false,
          adjustY: 3.14,
          wiggle: true,
          flee: false,
          spawnChance: 0.33
        },
        'wibbit': {
          model: '#mWibbit',
          nocturnal: false,
          scale: '2 2 2',
          height: 2,
          speed: 3,
          rSpeed: 4.2,
          clampY: true,
          wiggle: true,
          flee: false,
          spawnChance: 0.33
        },
        'shab': {
          model: '#mShab',
          nocturnal: false,
          scale: '2 2 2',
          height: 1,
          speed: 5,
          rSpeed: 4.2,
          clampY: true,
          wiggle: true,
          flee: false,
          spawnChance: 0.33
        },
        'shelby': {
          model: '#mShelby',
          nocturnal: false,
          scale: '4 4 4',
          height: 2,
          speed: 0.5,
          rSpeed: 4.2,
          clampY: true,
          wiggle: true,
          flee: false,
          spawnChance: 0.33
        }
      };
    },
    
    initializeNPCPool: function() {
      // Create all NPCs upfront and store them in the inactive pool
      // Ensure we have a balanced mix of nocturnal and diurnal NPCs
      
      // Get nocturnal and diurnal types
      const nocturnalTypes = [];
      const diurnalTypes = [];
      
      for (const type in this.npcTypes) {
        if (this.npcTypes[type].nocturnal) {
          nocturnalTypes.push(type);
        } else {
          diurnalTypes.push(type);
        }
      }
      
      console.log(`NPC types - Nocturnal: ${nocturnalTypes.join(', ')}, Diurnal: ${diurnalTypes.join(', ')}`);
      
      // Calculate how many of each to create
      // Make sure we have at least a minimum number of each type
      const minPerCategory = Math.max(3, Math.floor(this.data.poolSize / 4));
      const nocturnalCount = Math.max(minPerCategory, Math.floor(this.data.poolSize / 2));
      const diurnalCount = this.data.poolSize - nocturnalCount;
      
      console.log(`Creating ${nocturnalCount} nocturnal and ${diurnalCount} diurnal NPCs`);
      
      // Function to create an NPC of a specific type
      const createNPC = (npcType, index) => {
        const npcConfig = this.npcTypes[npcType];
        
        // Create the NPC entity
        const npcEntity = document.createElement('a-entity');
        npcEntity.setAttribute('gltf-model', npcConfig.model);
        npcEntity.setAttribute('scale', npcConfig.scale);
        
        // Position far away initially (will be properly positioned when activated)
        npcEntity.setAttribute('position', '0 -9999 0');
        
        // Set unique ID for easier tracking
        const npcId = `npc-${npcConfig.nocturnal ? 'night' : 'day'}-${index}`;
        npcEntity.setAttribute('id', npcId);

        // New night-chase behaviour.
        if (npcConfig.nocturnal){
          npcEntity.setAttribute('night-chase', '');
        }
        
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
          spawnTime: 0,
          nocturnal: npcConfig.nocturnal
        };
        
        // Store in arrays
        this.npcs.push(npcRef);
        this.inactiveNPCs.add(npcRef);
        
        return npcRef;
      };
      
      // Create nocturnal NPCs
      for (let i = 0; i < nocturnalCount; i++) {
        // Select a random nocturnal type
        const npcType = nocturnalTypes[Math.floor(Math.random() * nocturnalTypes.length)];
        createNPC(npcType, i);
      }
      
      // Create diurnal NPCs
      for (let i = 0; i < diurnalCount; i++) {
        // Select a random diurnal type
        const npcType = diurnalTypes[Math.floor(Math.random() * diurnalTypes.length)];
        createNPC(npcType, i + nocturnalCount);
      }
      
      console.log(`NPC Pool created with ${this.npcs.length} entities (${nocturnalCount} nocturnal, ${diurnalCount} diurnal)`);
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
      // Get the current day/night state
      const isNight = this.isNightTime();
      
      // Find NPCs of the appropriate type (nocturnal for night, diurnal for day)
      const validNPCs = Array.from(this.inactiveNPCs)
        .filter(npc => {
          const npcConfig = this.npcTypes[npc.type];
          return npcConfig && ((isNight && npcConfig.nocturnal) || (!isNight && !npcConfig.nocturnal));
        });
      
      // If no valid NPCs found, log and return
      if (validNPCs.length === 0) {
        console.warn(`No inactive ${isNight ? 'nocturnal' : 'diurnal'} NPCs available to spawn`);
        return;
      }
      
      // Select a random NPC from the valid ones
      const npc = validNPCs[Math.floor(Math.random() * validNPCs.length)];
      
      // Get the NPC configuration
      const npcConfig = this.npcTypes[npc.type];
      
      // Double check validity
      if (!npcConfig || (isNight && !npcConfig.nocturnal) || (!isNight && npcConfig.nocturnal)) {
        console.warn(`Invalid NPC selected: ${npc.type}, nocturnal: ${npcConfig?.nocturnal}, isNight: ${isNight}`);
        return;
      }
    
      // Remove from inactive pool
      this.inactiveNPCs.delete(npc);
      
      // Determine spawn position in a ring around the player
      const angle = Math.random() * Math.PI * 2;
      const distance = this.data.activationDistance * 0.8 + (Math.random() * this.data.activationDistance * 0.2);
      
      const spawnX = this.player.position.x + Math.cos(angle) * distance;
      const spawnZ = this.player.position.z + Math.sin(angle) * distance;
      
      // Get terrain height at spawn position
      const spawnY = getTerrainHeight(spawnX, spawnZ);
      
      // Spawn at -20 so that does not suddenly appear in air
      npc.el.setAttribute('position', `${spawnX} -20 ${spawnZ}`);
      
      // Restore original speed and activate
      const aiComponent = npc.el.components['ai-locomotion'];
      if (aiComponent) {
        // Adjust speed based on time of day
        let speed = npcConfig.speed;
        if (isNight && npcConfig.nocturnal) {
          // Night creatures are faster at night
          speed *= 1.5;
        }
        
        aiComponent.data.speed = speed;
        aiComponent.data.active = true;
        aiComponent.data.updateInterval = 1; // Normal update frequency
      }
      
      // Mark as active
      npc.active = true;
      npc.spawnTime = Date.now();
      
      // Add to active set
      this.activeNPCs.add(npc);
      
      console.log(`Activated ${isNight ? 'nocturnal' : 'diurnal'} NPC: ${npc.type}`);
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
    },
    
    updateNPCActivity: function(npc, fullyActive, distance) {
      if (!npc.el) return;
      
      const aiComponent = npc.el.components['ai-locomotion'];
      if (!aiComponent) return;
      
      // Get NPC configuration
      const npcConfig = this.npcTypes[npc.type];
      if (!npcConfig) return;
      
      if (fullyActive) {
        // Full speed when close
        let speed = npcConfig.speed;
        
        // Adjust speed based on time of day
        const isNight = this.isNightTime();
        if ((isNight && npcConfig.nocturnal) || (!isNight && !npcConfig.nocturnal)) {
          // Creatures are faster during their preferred time
          speed *= isNight ? 1.5 : 1.0;
        }
        
        aiComponent.data.speed = speed;
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
        aiComponent.data.speed = npcConfig.speed * distanceFactor * 0.5;
        aiComponent.data.updateInterval = 5; // Reduced update frequency
        aiComponent.data.active = distanceFactor > 0.1; // Only deactivate if very far
      }
    },
    
    // This function now factors in day/night when returning available NPC types
    getRandomNPCType: function() {
      // Get current day/night state
      const isNight = this.isNightTime();
      
      // Filter for types that are appropriate for the current time
      const availableTypes = Object.keys(this.npcTypes).filter(type => {
        const npcConfig = this.npcTypes[type];
        return (isNight && npcConfig.nocturnal) || (!isNight && !npcConfig.nocturnal);
      });
      
      // If no appropriate types, return a random one anyway
      if (availableTypes.length === 0) {
        const allTypes = Object.keys(this.npcTypes);
        return allTypes[Math.floor(Math.random() * allTypes.length)];
      }
      
      // Calculate total spawn chance of available types
      let totalChance = 0;
      availableTypes.forEach(type => {
        totalChance += this.npcTypes[type].spawnChance;
      });
      
      // Select based on spawn chances
      const rand = Math.random() * totalChance;
      let cumulativeChance = 0;
      
      for (const type of availableTypes) {
        cumulativeChance += this.npcTypes[type].spawnChance;
        if (rand < cumulativeChance) {
          return type;
        }
      }
      
      // Default to first available type
      return availableTypes[0];
    },
    
    // Method to be called from day-night-cycle when time changes
    // This will force the activation/deactivation of appropriate NPCs
    handleTimeChange: function(isNight) {
      console.log(`NPC Manager handling time change to ${isNight ? 'night' : 'day'} mode`);
      
      // Step 1: Deactivate NPCs that shouldn't be active at this time
      const npcsToDeactivate = [];
      
      for (const npc of this.activeNPCs) {
        const npcConfig = this.npcTypes[npc.type];
        if (!npcConfig) continue;
        
        if ((isNight && !npcConfig.nocturnal) || (!isNight && npcConfig.nocturnal)) {
          // This NPC shouldn't be active at this time
          npcsToDeactivate.push(npc);
        }
      }
      
      // Perform deactivation
      for (const npc of npcsToDeactivate) {
        this.deactivateNPC(npc);
      }
      
      console.log(`Deactivated ${npcsToDeactivate.length} NPCs due to time change`);
      
      // Step 2: Force spawn of appropriate NPCs
      const activeCount = this.activeNPCs.size;
      let maxSpawnCount = this.data.maxNPCs - activeCount;
      
      // Increase spawn count for initial population after time change
      if (maxSpawnCount > 0) {
        // Try to spawn in batches to ensure we get enough NPCs quickly after time change
        for (let batch = 0; batch < 3 && maxSpawnCount > 0; batch++) {
          let spawnedInBatch = 0;
          
          for (let i = 0; i < Math.min(maxSpawnCount, 5); i++) {
            // Before attempting to spawn, check if we have appropriate inactive NPCs
            const hasValidNPCs = Array.from(this.inactiveNPCs).some(npc => {
              const config = this.npcTypes[npc.type];
              return config && ((isNight && config.nocturnal) || (!isNight && !config.nocturnal));
            });
            
            if (!hasValidNPCs) {
              console.warn(`No more inactive ${isNight ? 'nocturnal' : 'diurnal'} NPCs available to spawn`);
              break;
            }
            
            // Try to activate an NPC
            const activeCountBefore = this.activeNPCs.size;
            this.activateNPC();
            
            // Check if we were successful
            if (this.activeNPCs.size > activeCountBefore) {
              spawnedInBatch++;
            }
          }
          
          // Update remaining slots
          maxSpawnCount -= spawnedInBatch;
          
          // If we didn't spawn any in this batch, no point continuing
          if (spawnedInBatch === 0) break;
        }
      }
      
      console.log(`Active NPCs after time change: ${this.activeNPCs.size}/${this.data.maxNPCs}`);
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