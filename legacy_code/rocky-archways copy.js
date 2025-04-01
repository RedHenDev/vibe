// Rock Archways System for Eigengrau Light
// Creates procedural low-poly rock formations with natural archways

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const archSystemEntity = document.createElement('a-entity');
        archSystemEntity.setAttribute('id', 'arch-system');
        archSystemEntity.setAttribute('rock-archways', '');
        scene.appendChild(archSystemEntity);
        console.log('Rock archways system initialized');
      });
    }
});
  
AFRAME.registerComponent('rock-archways', {
  schema: {
    chunkSize: { type: 'number', default: 800 },          // Size of each chunk in meters (larger than other systems)
    renderDistance: { type: 'number', default: 360 },     // Max distance to render formations
    archsPerChunk: { type: 'number', default: 1 },         // Archways per chunk (sparse distribution)
    updateThreshold: { type: 'number', default: 100 },     // Distance player must move to trigger update
    minHeight: { type: 'number', default: 70 },            // Minimum formation height
    maxHeight: { type: 'number', default: 300 },           // Maximum formation height
    maxWidth: { type: 'number', default: 120 },            // Maximum formation width
    minWidth: { type: 'number', default: 60 },             // Minimum formation width
    baseColor: { type: 'color', default: '#708090' },      // Base color (slate gray)
    chunksPerFrame: { type: 'number', default: 1 },        // Chunks to generate per frame
    colorVariation: { type: 'number', default: 0.2 },      // Color variation amount
    avoidWater: { type: 'boolean', default: false },        // Avoid placing in water areas
    waterLevel: { type: 'number', default: -11 },          // Water level threshold
    roughness: { type: 'number', default: 0.8 },           // Material roughness
    metalness: { type: 'number', default: 0.1 },           // Material metalness
    seed: { type: 'number', default: 12345 }               // Random seed for deterministic generation
  },
    
  init: function() {
    // Map to store active chunks
    this.chunks = new Map();
      
    // Track last update position
    this.lastUpdatePosition = new THREE.Vector3();
      
    // Queue for gradual chunk loading
    this.chunkQueue = [];
    this.isProcessingQueue = false;
      
    // Access getHeight function
    this.getHeight = getTerrainHeight;
      
    // Get player reference
    this.player = this.el.sceneEl.querySelector('#player').object3D;
      
    // Initialize chunks around player
    if (this.player) {
      this.queueInitialChunks();
      this.lastUpdatePosition.copy(this.player.position);
      console.log('Rock archways system ready, chunks queued for loading');
    }
  },
    
  // Simple deterministic random number generator
  seededRandom: function(x, z, n = 0) {
    // This is a simple hash function that produces a value between 0 and 1
    // based on the input coordinates and an optional index n
    return ((Math.sin(x * 12.9898 + z * 78.233 + n * 43.534) * 43758.5453) % 1 + 1) % 1;
  },
    
  queueInitialChunks: function() {
    const chunkSize = this.data.chunkSize;
    const radius = Math.ceil(this.data.renderDistance / chunkSize);
    const cx = Math.floor(this.player.position.x / chunkSize);
    const cz = Math.floor(this.player.position.z / chunkSize);
      
    // Create a sorted list of chunks based on distance from player
    const chunksToLoad = [];
      
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const chunkX = cx + i;
        const chunkZ = cz + j;
        const key = `${chunkX},${chunkZ}`;
          
        // Skip if chunk already exists
        if (this.chunks.has(key)) continue;
          
        // Calculate distance from player (in chunk coordinates)
        const distanceSquared = i * i + j * j;
          
        chunksToLoad.push({
          x: chunkX,
          z: chunkZ,
          key: key,
          distanceSquared: distanceSquared
        });
      }
    }
      
    // Sort by distance (closest first)
    chunksToLoad.sort((a, b) => a.distanceSquared - b.distanceSquared);
      
    // Add to queue
    this.chunkQueue = chunksToLoad;
      
    // Start processing the queue
    if (!this.isProcessingQueue) {
      this.isProcessingQueue = true;
      this.startQueueProcessing();
    }
  },
    
  startQueueProcessing: function() {
    const component = this;
    requestAnimationFrame(function() {
      component.processChunkQueue();
    });
  },
    
  processChunkQueue: function() {
    if (this.chunkQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
      
    const limit = Math.min(this.data.chunksPerFrame, this.chunkQueue.length);
      
    for (let i = 0; i < limit; i++) {
      const chunk = this.chunkQueue.shift();
      this.generateChunk(chunk.x, chunk.z);
    }
      
    this.startQueueProcessing();
  },
    
  tick: function() {
    const player = this.player;
    if (!player) return;
      
    const playerPosition = player.position;
    const dx = playerPosition.x - this.lastUpdatePosition.x;
    const dz = playerPosition.z - this.lastUpdatePosition.z;
    const distanceMoved = Math.sqrt(dx * dx + dz * dz);
      
    if (distanceMoved > this.data.updateThreshold) {
      this.updateChunks(playerPosition);
      this.lastUpdatePosition.copy(playerPosition);
    }
  },
    
  updateChunks: function(playerPosition) {
    const chunkSize = this.data.chunkSize;
    const radius = Math.ceil(this.data.renderDistance / chunkSize);
      
    const cx = Math.floor(playerPosition.x / chunkSize);
    const cz = Math.floor(playerPosition.z / chunkSize);
      
    const requiredChunks = new Set();
    const newChunks = [];
      
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const chunkX = cx + i;
        const chunkZ = cz + j;
        const key = `${chunkX},${chunkZ}`;
        requiredChunks.add(key);
          
        if (!this.chunks.has(key) && !this.chunkQueue.some(item => item.key === key)) {
          newChunks.push({
            x: chunkX,
            z: chunkZ,
            key: key,
            distanceSquared: i * i + j * j
          });
        }
      }
    }
      
    newChunks.sort((a, b) => a.distanceSquared - b.distanceSquared);
    this.chunkQueue.push(...newChunks);
      
    if (!this.isProcessingQueue && this.chunkQueue.length > 0) {
      this.isProcessingQueue = true;
      this.startQueueProcessing();
    }
      
    for (const key of this.chunks.keys()) {
      if (!requiredChunks.has(key)) {
        this.removeChunk(key);
      }
    }
  },
    
  // Specialized function to place formations only in suitable locations
  shouldPlaceFormation: function(x, z) {
    // Check if we should avoid water
    if (this.data.avoidWater) {
      const y = this.getHeight(x, z);
      if (y < this.data.waterLevel) {
        return false;
      }
    }
      
    // Only place formations at a certain frequency (determined by chunk position)
    const frequency = this.seededRandom(x, z, 1);
    return frequency < 0.1; // Only place in 10% of possible locations
  },
    
  // FIX: Create a simpler, more robust arch mesh with pre-computed radius values
  createArchMesh: function(centerX, centerZ, seed) {
    // Create sequential random number generator for this particular formation
    const randSeed = seed;
    const randomValues = [];
      
    // Pre-generate a set of random values to use consistently
    for (let i = 0; i < 100; i++) {
      const r = ((Math.sin(randSeed + i * 123.45) * 43758.5453) % 1 + 1) % 1;
      randomValues.push(r);
    }
      
    // Helper to get a consistent random value
    const getNextRandom = (index) => {
      index = index % randomValues.length;
      return randomValues[index];
    };
      
    // Find the base height by sampling the terrain
    let baseY = this.getHeight(centerX, centerZ);
    if (isNaN(baseY)) {
      // If terrain height returns NaN, use a fallback height
      console.warn("Terrain height returned NaN, using fallback height");
      baseY = 0;
    }
      
    // Size parameters with some randomness
    const width = this.data.minWidth + getNextRandom(0) * (this.data.maxWidth - this.data.minWidth);
    const height = this.data.minHeight + getNextRandom(1) * (this.data.maxHeight - this.data.minHeight);
      
    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: this.data.baseColor,
      roughness: this.data.roughness,
      metalness: this.data.metalness,
      flatShading: true
    });
      
    // Create group to hold all parts of the formation
    const formationGroup = new THREE.Group();
      
    // Use a simpler approach to create the arch - low poly regular geometry
    this.createSimpleArch(formationGroup, centerX, centerZ, baseY, width, height, material, getNextRandom);
      
    // Apply random rotation to the entire formation
    formationGroup.rotation.y = getNextRandom(5) * Math.PI * 2;
      
    // Add slight natural tilt
    formationGroup.rotation.x = (getNextRandom(6) * 0.1 - 0.05);
    formationGroup.rotation.z = (getNextRandom(7) * 0.1 - 0.05);
      
    return formationGroup;
  },
    
  // FIX: Use a simplified arch creation method to avoid NaN issues and add overlap between segments
  createSimpleArch: function(formationGroup, centerX, centerZ, baseY, width, height, material, getNextRandom) {
    // Create points for a simple arch
    const archPoints = [];
    const halfWidth = width / 2;
    const maxHeight = baseY + height;
      
    // Number of segments (keep low for performance)
    const segments = 12;
      
    // Create an array of pre-computed radius values
    const radiusValues = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
        
      // Simple arch radius profile - thicker at the base, thinner at the top
      const baseRadius = width * 0.1; // Base radius size
      const profile = 0.5 + 0.5 * Math.sin(Math.PI * t); // Smooth profile curve
      const radius = baseRadius * Math.max(0.3, profile); // Ensure radius is never too small
        
      radiusValues.push(radius);
    }
      
    // Create the arch points
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
        
      // Arch X position - from -halfWidth to +halfWidth
      const x = -halfWidth + width * t;
        
      // Arch Y position - parabolic curve
      const y = baseY + height * 4 * t * (1 - t);
        
      // Add some controlled randomness to Z
      const z = getNextRandom(i + 20) * width * 0.1 - width * 0.05;
        
      // Add the point
      archPoints.push(new THREE.Vector3(x, y, z));
    }
      
    // Create a simple arch using box geometry segments
    // Define an overlap factor (10% extra length per segment)
    const segmentOverlapFactor = 0.7;
    for (let i = 0; i < segments; i++) {
      const p1 = archPoints[i];
      const p2 = archPoints[i + 1];
        
      // Direction vector between points
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        
      // Length between points
      const length = p1.distanceTo(p2);
      // Increase length by overlap factor so segments overlap with neighbors
      const extendedLength = length * (1 + segmentOverlapFactor);
        
      // Create a box geometry for this segment with the extended length
      const segmentGeometry = new THREE.BoxGeometry(extendedLength, ( (radiusValues[i] + radiusValues[i + 1]) / 2 ) * 2, ((radiusValues[i] + radiusValues[i + 1]) / 2 ) * 2);
        
      // Create a mesh for this segment
      const segmentMesh = new THREE.Mesh(segmentGeometry, material.clone());
        
      // Position at the midpoint between p1 and p2 remains the same
      const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      segmentMesh.position.copy(midpoint);
        
      // Rotate to align with the direction; then adjust rotation so the box extends evenly on both sides
      segmentMesh.lookAt(p2);
        
      // Optionally, add some random variation
      segmentMesh.rotation.z += (getNextRandom(i + 40) - 0.5) * 0.3;
      // Rotate 180-deg to eradicate gaps.
      segmentMesh.rotation.x += 1.5;
      // Add to formation group
      formationGroup.add(segmentMesh);
    }
      
    // Add a few rock decorations around the arch
    this.addBaseRocks(formationGroup, centerX, centerZ, baseY, width, material, getNextRandom);
      
    return formationGroup;
  },
    
  // Add rocks around the base - simplified to avoid NaN issues
  addBaseRocks: function(formationGroup, centerX, centerZ, baseY, width, material, getNextRandom) {
    const numRocks = 3 + Math.floor(getNextRandom(60) * 5);
      
    for (let i = 0; i < numRocks; i++) {
      // Position around the formation base
      const angle = getNextRandom(i + 70) * Math.PI * 2;
      const distance = width * (0.4 + getNextRandom(i + 71) * 0.3);
        
      const rockX = Math.cos(angle) * distance;
      const rockZ = Math.sin(angle) * distance;
        
      // Size variation
      const rockSize = width * (0.05 + getNextRandom(i + 72) * 0.1);
        
      // Use a simple box for better performance and to avoid NaN issues
      const rockGeometry = new THREE.BoxGeometry(
        rockSize * (0.8 + getNextRandom(i + 73) * 0.4),
        rockSize * (1.0 + getNextRandom(i + 74) * 1.0),
        rockSize * (0.8 + getNextRandom(i + 75) * 0.4)
      );
        
      // Create darker material for base rocks
      const rockMaterial = material.clone();
      const colorScale = 0.7 + getNextRandom(i + 76) * 0.3; // Darker
      rockMaterial.color.set(material.color).multiplyScalar(colorScale);
        
      const rockMesh = new THREE.Mesh(rockGeometry, rockMaterial);
        
      // Position and rotate randomly
      rockMesh.position.set(rockX, baseY, rockZ);
      rockMesh.rotation.set(
        getNextRandom(i + 77) * Math.PI,
        getNextRandom(i + 78) * Math.PI,
        getNextRandom(i + 79) * Math.PI
      );
        
      formationGroup.add(rockMesh);
    }
  },
    
  generateChunk: function(chunkX, chunkZ) {
    const chunkSize = this.data.chunkSize;
    const formations = [];
      
    // Use deterministic random number for this chunk
    const chunkSeed = chunkX * 374761 + chunkZ * 642519 + this.data.seed;
      
    // Calculate the number of attempts to place a formation
    const placementAttempts = this.data.archsPerChunk * 15; // Try many locations to find suitable spots
      
    for (let i = 0; i < placementAttempts; i++) {
      // Generate position within chunk, slightly inset from edges
      const inset = chunkSize * 0.1;
      const xOffset = this.seededRandom(chunkSeed, i * 7) * (chunkSize - inset * 2) + inset;
      const zOffset = this.seededRandom(chunkSeed, i * 13) * (chunkSize - inset * 2) + inset;
        
      const x = (chunkX * chunkSize) + xOffset;
      const z = (chunkZ * chunkSize) + zOffset;
        
      // Check if this is a suitable location
      if (this.shouldPlaceFormation(x, z)) {
        try {
          // Generate a unique seed for this formation
          const formationSeed = chunkSeed + i * 1000000;
            
          // Create the arch mesh
          const archMesh = this.createArchMesh(x, z, formationSeed);
            
          // Position the arch
          let y = this.getHeight(x, z);
          if (isNaN(y)) {
            console.warn("Terrain height returned NaN, using fallback height");
            y = 0;
          }
          archMesh.position.set(x, y, z);
            
          // Add to formations array
          formations.push(archMesh);
            
          // Only place up to the maximum number of formations per chunk
          if (formations.length >= this.data.archsPerChunk) {
            break;
          }
        } catch (error) {
          console.error("Error creating formation:", error);
          // Continue to next attempt
        }
      }
    }
      
    // If no formations were placed, just return
    if (formations.length === 0) {
      return;
    }
      
    // Create a group to hold all formations in this chunk
    const chunkGroup = new THREE.Group();
      
    // Add all formations to the group
    formations.forEach(formation => {
      chunkGroup.add(formation);
    });
      
    // Add the group to the scene
    this.el.sceneEl.object3D.add(chunkGroup);
      
    // Store in chunks map
    this.chunks.set(`${chunkX},${chunkZ}`, {
      group: chunkGroup,
      formations: formations
    });
      
    console.log(`Generated chunk ${chunkX},${chunkZ} with ${formations.length} rock formations`);
  },
    
  removeChunk: function(key) {
    const chunk = this.chunks.get(key);
    if (chunk) {
      this.finalizeChunkRemoval(key);
    }
  },
    
  finalizeChunkRemoval: function(key) {
    const chunk = this.chunks.get(key);
    if (chunk) {
      // Remove group from scene
      this.el.sceneEl.object3D.remove(chunk.group);
        
      // Clean up all meshes and materials
      chunk.group.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
          
        if (object.material) {
          // Handle both arrays of materials and single materials
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
        
      // Remove from chunks map
      this.chunks.delete(key);
    }
  },
    
  remove: function() {
    // Clean up on component removal
    this.chunkQueue = [];
    this.isProcessingQueue = false;
      
    for (const key of this.chunks.keys()) {
      this.finalizeChunkRemoval(key);
    }
  }
});
