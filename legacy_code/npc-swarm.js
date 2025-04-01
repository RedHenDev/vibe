// NPC Swarm Behavior for Eigengrau Light
// Makes NPCs coordinate their movements and swarm together to hunt the player

AFRAME.registerComponent('npc-swarm', {
  schema: {
    enabled: { type: 'boolean', default: true },
    radius: { type: 'number', default: 50 },          // Radius to detect other NPCs
    maxSwarmSize: { type: 'number', default: 8 },     // Maximum NPCs in a swarm
    minDistance: { type: 'number', default: 6 },      // Minimum distance between NPCs
    cohesionWeight: { type: 'number', default: 0.5 }, // How strongly NPCs move toward swarm center
    alignmentWeight: { type: 'number', default: 0.3 },// How strongly NPCs align movement direction
    separationWeight: { type: 'number', default: 1.0 },// How strongly NPCs avoid each other
    targetWeight: { type: 'number', default: 2.0 },   // Priority of targeting player vs. swarming
    communicationInterval: { type: 'number', default: 1000 }, // Time between swarm updates (ms)
    visualDebug: { type: 'boolean', default: false }  // Show debug visualization
  },
  
  init: function() {
    // Get dependencies
    this.enhancedAI = this.el.components['enhanced-ai'];
    this.legacyAI = this.el.components['ai-locomotion'] || this.el.components['ai-loco-legacy'];
    
    if (!this.enhancedAI && !this.legacyAI) {
      console.warn('npc-swarm requires an AI component (enhanced-ai, ai-locomotion, etc.)');
      return;
    }
    
    // State tracking
    this.swarmMembers = [];
    this.nearbyNPCs = [];
    this.swarmCenter = new THREE.Vector3();
    this.swarmDirection = new THREE.Vector3();
    this.lastCommunication = 0;
    this.isInSwarm = false;
    this.swarmLeader = null;
    this.isSwarmLeader = false;
    this.swarmId = Math.floor(Math.random() * 1000000); // Unique ID for this NPC
    this.lastSwarmUpdate = 0;
    
    // Internal vector reuse
    this.tempVector = new THREE.Vector3();
    this.tempDirection = new THREE.Vector3();
    
    // Get player reference
    this.player = document.querySelector('#player').object3D;
    
    // Create visual debugging if enabled
    if (this.data.visualDebug) {
      this.createDebugVisuals();
    }
    
    // Join global swarm registry
    this.registerWithSwarmSystem();
    
    // Set initial communication time with randomization to avoid all NPCs updating at once
    this.lastCommunication = Date.now() - Math.random() * this.data.communicationInterval;
  },
  
  registerWithSwarmSystem: function() {
    // Create global swarm registry if it doesn't exist
    if (!window.npcSwarmRegistry) {
      window.npcSwarmRegistry = {
        npcs: new Map(),
        registerNPC: function(id, component) {
          this.npcs.set(id, component);
        },
        unregisterNPC: function(id) {
          this.npcs.delete(id);
        },
        getNearbyNPCs: function(position, radius, excludeId) {
          const nearby = [];
          this.npcs.forEach((component, id) => {
            if (id !== excludeId) {
              const distance = position.distanceTo(component.el.object3D.position);
              if (distance <= radius) {
                nearby.push({
                  component: component,
                  distance: distance,
                  position: component.el.object3D.position,
                  direction: component.getTargetDirection ? component.getTargetDirection() : null,
                  isSwarmLeader: component.isSwarmLeader
                });
              }
            }
          });
          return nearby;
        }
      };
      
      console.log('Created global NPC swarm registry');
    }
    
    // Register this NPC
    window.npcSwarmRegistry.registerNPC(this.swarmId, this);
  },
  
  update: function(oldData) {
    // Handle changes to component data
    if (oldData.enabled !== undefined && oldData.enabled !== this.data.enabled) {
      // Enable/disable swarm behavior
      if (!this.data.enabled) {
        this.leaveSwarm();
      }
    }
  },
  
  tick: function(time, delta) {
    if (!this.data.enabled || !this.player || !delta) return;
    
    // Periodic swarm communication
    const now = Date.now();
    if (now - this.lastCommunication >= this.data.communicationInterval) {
      this.updateSwarm();
      this.lastCommunication = now;
    }
    
    // Apply swarm behavior if in a swarm
    if (this.isInSwarm && this.nearbyNPCs.length > 0) {
      this.applySwarmBehavior(delta);
    }
    
    // Update debug visuals
    if (this.data.visualDebug) {
      this.updateDebugVisuals();
    }
  },
  
  updateSwarm: function() {
    // Find nearby NPCs
    if (!window.npcSwarmRegistry) return;
    
    const position = this.el.object3D.position;
    this.nearbyNPCs = window.npcSwarmRegistry.getNearbyNPCs(
      position, 
      this.data.radius, 
      this.swarmId
    );
    
    // Determine if we should be in a swarm based on nearby NPCs
    const shouldBeInSwarm = this.nearbyNPCs.length > 0;
    
    if (shouldBeInSwarm !== this.isInSwarm) {
      if (shouldBeInSwarm) {
        this.joinSwarm();
      } else {
        this.leaveSwarm();
      }
    }
    
    // Update swarm center and direction
    if (this.isInSwarm) {
      this.calculateSwarmCenter();
      this.calculateSwarmDirection();
      
      // Determine swarm leader
      this.determineSwarmLeader();
    }
  },
  
  joinSwarm: function() {
    if (this.isInSwarm) return;
    
    this.isInSwarm = true;
    
    // Apply swarm behavior based on AI type
    if (this.enhancedAI) {
      // For enhanced AI, store original behavior to restore later
      this.originalBehavior = this.enhancedAI.currentBehavior;
      
      // Set to swarm behavior
      this.enhancedAI.currentBehavior = 'swarm';
      this.enhancedAI.onBehaviorChange();
    }
    
    console.log(`NPC ${this.el.id || this.swarmId} joined a swarm with ${this.nearbyNPCs.length} members`);
  },
  
  leaveSwarm: function() {
    if (!this.isInSwarm) return;
    
    this.isInSwarm = false;
    this.isSwarmLeader = false;
    
    // Restore original behavior
    if (this.enhancedAI && this.originalBehavior) {
      this.enhancedAI.currentBehavior = this.originalBehavior;
      this.enhancedAI.onBehaviorChange();
    }
    
    console.log(`NPC ${this.el.id || this.swarmId} left the swarm`);
  },
  
  calculateSwarmCenter: function() {
    // Reset swarm center
    this.swarmCenter.set(0, 0, 0);
    
    // Add all NPC positions
    let count = 1; // Include self
    this.swarmCenter.add(this.el.object3D.position);
    
    this.nearbyNPCs.forEach(npc => {
      this.swarmCenter.add(npc.position);
      count++;
    });
    
    // Calculate average position (center)
    this.swarmCenter.divideScalar(count);
  },
  
  calculateSwarmDirection: function() {
    // Reset swarm direction
    this.swarmDirection.set(0, 0, 0);
    
    // Get own direction
    const ownDirection = this.getTargetDirection();
    this.swarmDirection.add(ownDirection);
    
    // Add all NPC directions if available
    let count = 1; // Include self
    
    this.nearbyNPCs.forEach(npc => {
      if (npc.direction) {
        this.swarmDirection.add(npc.direction);
        count++;
      }
    });
    
    // Calculate average direction
    this.swarmDirection.divideScalar(count);
    this.swarmDirection.normalize();
  },
  
  determineSwarmLeader: function() {
    // Check for existing leader
    let leaderFound = false;
    
    this.nearbyNPCs.forEach(npc => {
      if (npc.isSwarmLeader) {
        this.swarmLeader = npc;
        leaderFound = true;
      }
    });
    
    // If no leader found, determine new leader
    if (!leaderFound) {
      // Choose leader based on proximity to player
      const playerPos = this.player.position;
      let closestDistance = this.el.object3D.position.distanceTo(playerPos);
      let closestNPC = null;
      
      this.nearbyNPCs.forEach(npc => {
        const distance = npc.position.distanceTo(playerPos);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNPC = npc;
        }
      });
      
      // If this NPC is closest, become leader
      if (closestNPC === null) {
        this.isSwarmLeader = true;
        this.swarmLeader = null;
      } else {
        this.isSwarmLeader = false;
        this.swarmLeader = closestNPC;
        
        // Notify the chosen NPC to become leader
        if (closestNPC.component) {
          closestNPC.component.isSwarmLeader = true;
        }
      }
    } else {
      // Existing leader found
      this.isSwarmLeader = false;
    }
  },
  
  applySwarmBehavior: function(delta) {
    // Skip if using enhanced AI - it handles swarming internally
    if (this.enhancedAI) return;
    
    // Apply only to legacy AI components
    if (!this.legacyAI) return;
    
    // Calculate swarm forces
    const position = this.el.object3D.position;
    
    // 1. Cohesion - move toward center of swarm
    const cohesion = new THREE.Vector3();
    cohesion.subVectors(this.swarmCenter, position);
    cohesion.normalize();
    cohesion.multiplyScalar(this.data.cohesionWeight);
    
    // 2. Alignment - align with average direction of swarm
    const alignment = this.swarmDirection.clone();
    alignment.multiplyScalar(this.data.alignmentWeight);
    
    // 3. Separation - avoid other NPCs that are too close
    const separation = new THREE.Vector3();
    this.nearbyNPCs.forEach(npc => {
      if (npc.distance < this.data.minDistance) {
        // Calculate repulsion vector
        this.tempVector.subVectors(position, npc.position);
        
        // Scale by distance (closer = stronger repulsion)
        const repulsionStrength = (this.data.minDistance - npc.distance) / this.data.minDistance;
        this.tempVector.normalize().multiplyScalar(repulsionStrength);
        
        separation.add(this.tempVector);
      }
    });
    separation.multiplyScalar(this.data.separationWeight);
    
    // 4. Target attraction - move toward player
    const targetAttraction = new THREE.Vector3();
    targetAttraction.subVectors(this.player.position, position);
    targetAttraction.normalize();
    targetAttraction.multiplyScalar(this.data.targetWeight);
    
    // Combine forces
    const combinedForce = new THREE.Vector3();
    combinedForce.add(cohesion);
    combinedForce.add(alignment);
    combinedForce.add(separation);
    combinedForce.add(targetAttraction);
    combinedForce.normalize();
    
    // Apply to entity direction
    // For legacy AI, we need to update rotation directly
    const angle = Math.atan2(combinedForce.x, combinedForce.z);
    this.el.object3D.rotation.y = angle;
  },
  
  getTargetDirection: function() {
    // Get current movement direction based on AI type
    if (this.enhancedAI && this.enhancedAI.targetDirection) {
      return this.enhancedAI.targetDirection.clone();
    }
    
    // If no direction found, calculate direction to player
    const direction = new THREE.Vector3();
    direction.subVectors(this.player.position, this.el.object3D.position).normalize();
    
    return direction;
  },
  
  createDebugVisuals: function() {
    // Create debug container
    this.debugEntity = document.createElement('a-entity');
    this.debugEntity.setAttribute('position', '0 3 0');
    
    // Create indicator for swarm status
    this.swarmIndicator = document.createElement('a-sphere');
    this.swarmIndicator.setAttribute('radius', '0.3');
    this.swarmIndicator.setAttribute('color', '#FFFFFF');
    this.swarmIndicator.setAttribute('opacity', '0.5');
    this.debugEntity.appendChild(this.swarmIndicator);
    
    // Create line to swarm center
    this.swarmCenterLine = document.createElement('a-entity');
    this.swarmCenterLine.setAttribute('line', {
      start: '0 0 0',
      end: '0 0 0',
      color: '#00FF00',
      opacity: 0.5
    });
    this.debugEntity.appendChild(this.swarmCenterLine);
    
    // Create line for direction
    this.directionLine = document.createElement('a-entity');
    this.directionLine.setAttribute('line', {
      start: '0 0 0',
      end: '0 0 3',
      color: '#0000FF',
      opacity: 0.5
    });
    this.debugEntity.appendChild(this.directionLine);
    
    // Add to entity
    this.el.appendChild(this.debugEntity);
  },
  
  updateDebugVisuals: function() {
    if (!this.debugEntity) return;
    
    // Update swarm indicator
    if (this.swarmIndicator) {
      // Color based on swarm status
      const color = this.isInSwarm 
        ? (this.isSwarmLeader ? '#FF0000' : '#00FF00') 
        : '#FFFFFF';
      
      this.swarmIndicator.setAttribute('color', color);
      this.swarmIndicator.setAttribute('opacity', this.isInSwarm ? 0.8 : 0.3);
    }
    
    // Update line to swarm center
    if (this.swarmCenterLine && this.isInSwarm) {
      const position = this.el.object3D.position;
      const worldToLocal = new THREE.Matrix4();
      worldToLocal.getInverse(this.el.object3D.matrixWorld);
      
      const localCenter = this.swarmCenter.clone().applyMatrix4(worldToLocal);
      
      this.swarmCenterLine.setAttribute('line', {
        start: '0 0 0',
        end: `${localCenter.x} ${localCenter.y} ${localCenter.z}`,
        color: '#00FF00',
        opacity: 0.5
      });
    }
    
    // Update direction line
    if (this.directionLine) {
      const direction = this.getTargetDirection();
      
      this.directionLine.setAttribute('line', {
        start: '0 0 0',
        end: `${direction.x * 3} ${direction.y * 3} ${direction.z * 3}`,
        color: this.isInSwarm ? '#0000FF' : '#AAAAAA',
        opacity: 0.5
      });
    }
  },
  
  remove: function() {
    // Unregister from swarm registry
    if (window.npcSwarmRegistry) {
      window.npcSwarmRegistry.unregisterNPC(this.swarmId);
    }
    
    // Leave any current swarm
    this.leaveSwarm();
    
    // Remove debug visuals
    if (this.debugEntity && this.debugEntity.parentNode) {
      this.debugEntity.parentNode.removeChild(this.debugEntity);
    }
  }
});
