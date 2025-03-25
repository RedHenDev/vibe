// Pooled Terrain Generator
// Optimizes performance by reusing terrain chunks instead of constantly creating/destroying them

// Create component when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const terrainEntity = document.createElement('a-entity');
      terrainEntity.setAttribute('id', 'pooled-terrain');
      terrainEntity.setAttribute('pooled-terrain-generator', '');
      scene.appendChild(terrainEntity);
      console.log('Pooled terrain generator initialized');
    });
  }
});

AFRAME.registerComponent('pooled-terrain-generator', {
  schema: {
    chunkSize: { type: 'number', default: 64 },           // Size of each chunk in meters
    poolSize: { type: 'number', default: 36 },            // Number of chunks to pre-allocate in the pool
    chunksToRender: { type: 'number', default: 9 },       // Number of chunks to render around player (3x3 grid)
    updateThreshold: { type: 'number', default: 32 },     // Distance player must move to trigger update
    resolution: { type: 'number', default: 1 }            // Terrain resolution (higher = more detail but slower)
  },

  init: function() {
    // Initialize pooling system
    this.player = document.querySelector('#player').object3D;
    this.activeChunks = new Map();  // Map of currently active chunks by position
    this.chunkPool = [];            // Pool of reusable chunk objects
    this.vertexCaches = new Map();  // Cache for vertex calculations
    
    // Track last update position
    this.lastUpdatePosition = new THREE.Vector3();
    
    // Performance metrics
    this.lastUpdateTime = 0;
    this.updateCount = 0;
    this.averageUpdateTime = 0;
    
    // Create vertex and index templates (reused across chunks)
    this.createTemplates();
    
    // Initialize the chunk pool
    this.initializeChunkPool();
    
    // Start with 9 chunks around player
    if (this.player) {
      // Add small delay to ensure terrain height function is initialized
      setTimeout(() => {
        this.updateChunks();
      }, 100);
    }
    
    // Debug mode - can be toggled for performance stats
    this.debugMode = false;
    
    // Register keyboard shortcut for debug mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'T') {
        this.debugMode = !this.debugMode;
        console.log(`Terrain debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
      }
    });
  },

  createTemplates: function() {
    // Create template arrays for indices - these are the same for all chunks
    const chunkSize = this.data.chunkSize;
    const resolution = this.data.resolution;
    const verticesPerRow = Math.ceil(chunkSize / resolution) + 1;
    
    // Pre-calculate index pattern for all chunks
    // This is a significant optimization because indices are always the same pattern
    // regardless of chunk position
    const indices = [];
    for (let z = 0; z < verticesPerRow - 1; z++) {
      for (let x = 0; x < verticesPerRow - 1; x++) {
        const topLeft = z * verticesPerRow + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * verticesPerRow + x;
        const bottomRight = bottomLeft + 1;

        // Two triangles per quad
        indices.push(topLeft, bottomLeft, topRight);
        indices.push(bottomLeft, bottomRight, topRight);
      }
    }
    
    this.templateIndices = indices;
    this.verticesPerRow = verticesPerRow;
    this.vertexCount = verticesPerRow * verticesPerRow;
  },

  initializeChunkPool: function() {
    console.log(`Initializing terrain chunk pool with ${this.data.poolSize} chunks...`);
    const startTime = performance.now();
    
    // Pre-allocate arrays for all chunks to avoid GC during gameplay
    for (let i = 0; i < this.data.poolSize; i++) {
      const chunk = this.createChunk();
      this.chunkPool.push(chunk);
    }
    
    const endTime = performance.now();
    console.log(`Terrain pool initialized in ${(endTime - startTime).toFixed(2)}ms`);
  },

  createChunk: function() {
    // Create a pre-allocated chunk with buffers
    const vertexCount = this.vertexCount;
    
    // Pre-allocate vertex arrays - these will be reused and updated
    const vertices = new Float32Array(vertexCount * 3);  // x, y, z for each vertex
    const colors = new Float32Array(vertexCount * 3);    // r, g, b for each vertex
    
    // Create geometry with pre-allocated buffers
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(this.templateIndices);
    
    // Create material - we'll reuse this for all chunks
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add to scene but hide initially
    mesh.visible = false;
    this.el.object3D.add(mesh);
    
    return {
      mesh: mesh,
      inUse: false,
      chunkX: null,
      chunkZ: null,
      lastUsed: 0
    };
  },

  getChunkFromPool: function() {
    // First try to get an unused chunk
    let chunk = this.chunkPool.find(c => !c.inUse);
    
    // If none available, get the oldest used chunk
    if (!chunk) {
      let oldestTime = Infinity;
      let oldestChunk = null;
      
      for (const c of this.chunkPool) {
        if (c.lastUsed < oldestTime) {
          oldestTime = c.lastUsed;
          oldestChunk = c;
        }
      }
      
      chunk = oldestChunk;
      
      // If we're reusing a chunk, remove it from active chunks
      if (chunk && chunk.chunkX !== null) {
        this.activeChunks.delete(`${chunk.chunkX},${chunk.chunkZ}`);
      }
    }
    
    // Mark as in use
    if (chunk) {
      chunk.inUse = true;
      chunk.lastUsed = performance.now();
    }
    
    return chunk;
  },

  updateChunkGeometry: function(chunk, chunkX, chunkZ) {
    const chunkSize = this.data.chunkSize;
    const resolution = this.data.resolution;
    const verticesPerRow = this.verticesPerRow;
    
    // Calculate world offset
    const offsetX = chunkX * (chunkSize - resolution); // Slight overlap to avoid seams
    const offsetZ = chunkZ * (chunkSize - resolution);
    
    // Get vertex and color buffer from geometry
    const positionAttr = chunk.mesh.geometry.getAttribute('position');
    const colorAttr = chunk.mesh.geometry.getAttribute('color');
    const positionArray = positionAttr.array;
    const colorArray = colorAttr.array;
    
    // Check if we have a cached vertex data for this chunk
    const cacheKey = `${chunkX},${chunkZ}`;
    if (this.vertexCaches.has(cacheKey)) {
      // Use cached data to update geometry
      const cachedData = this.vertexCaches.get(cacheKey);
      positionAttr.array.set(cachedData.positions);
      colorAttr.array.set(cachedData.colors);
    } else {
      // Generate new vertex data
      let vertexIndex = 0;
      
      for (let z = 0; z < verticesPerRow; z++) {
        for (let x = 0; x < verticesPerRow; x++) {
          const worldX = offsetX + x * resolution;
          const worldZ = offsetZ + z * resolution;
          
          // Get terrain height at this position
          const height = getTerrainHeight(worldX, worldZ);
          
          // Update vertex position
          const baseIndex = vertexIndex * 3;
          positionArray[baseIndex] = worldX;
          positionArray[baseIndex + 1] = height;
          positionArray[baseIndex + 2] = worldZ;
          
          // Update vertex color
          const color = new THREE.Color(getTerrainColor(height));
          colorArray[baseIndex] = color.r;
          colorArray[baseIndex + 1] = color.g;
          colorArray[baseIndex + 2] = color.b;
          
          vertexIndex++;
        }
      }
      
      // Cache the vertex data for future reuse
      if (this.vertexCaches.size < 100) { // Limit cache size
        this.vertexCaches.set(cacheKey, {
          positions: new Float32Array(positionArray),
          colors: new Float32Array(colorArray)
        });
      }
    }
    
    // Mark buffers as needing update
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    
    // Update normals
    chunk.mesh.geometry.computeVertexNormals();
    
    // Update chunk metadata
    chunk.chunkX = chunkX;
    chunk.chunkZ = chunkZ;
    chunk.mesh.visible = true;
    
    // Add to active chunks
    this.activeChunks.set(`${chunkX},${chunkZ}`, chunk);
  },

  tick: function() {
    if (!this.player) return;
    
    // Check if player has moved enough to update chunks
    const playerPos = this.player.position;
    const dx = playerPos.x - this.lastUpdatePosition.x;
    const dz = playerPos.z - this.lastUpdatePosition.z;
    const distanceMoved = Math.sqrt(dx * dx + dz * dz);
    
    if (distanceMoved > this.data.updateThreshold) {
      const startTime = performance.now();
      
      this.updateChunks();
      this.lastUpdatePosition.copy(playerPos);
      
      // Track performance metrics
      const updateTime = performance.now() - startTime;
      this.lastUpdateTime = updateTime;
      this.updateCount++;
      this.averageUpdateTime = (this.averageUpdateTime * (this.updateCount - 1) + updateTime) / this.updateCount;
      
      if (this.debugMode && this.updateCount % 5 === 0) {
        console.log(`Terrain update: ${updateTime.toFixed(2)}ms (avg: ${this.averageUpdateTime.toFixed(2)}ms)`);
        console.log(`Active chunks: ${this.activeChunks.size}, Pool size: ${this.chunkPool.length}, Cache size: ${this.vertexCaches.size}`);
      }
    }
  },

  updateChunks: function() {
    const chunkSize = this.data.chunkSize;
    const chunksToRender = this.data.chunksToRender;
    
    // Calculate current chunk
    const playerPos = this.player.position;
    const centerChunkX = Math.floor(playerPos.x / chunkSize);
    const centerChunkZ = Math.floor(playerPos.z / chunkSize);
    
    // Determine radius (e.g., 1 for 3x3 grid, 2 for 5x5 grid)
    const radius = Math.floor(Math.sqrt(chunksToRender) / 2);
    
    // Create set of required chunks
    const requiredChunks = new Set();
    
    // Generate needed chunks, starting from player's center chunk
    // and working outward for better perceived loading time
    for (let r = 0; r <= radius; r++) {
      for (let z = -r; z <= r; z++) {
        for (let x = -r; x <= r; x++) {
          // Skip corners if not at the exact radius (creates a circle-ish pattern)
          if (r > 0 && Math.max(Math.abs(x), Math.abs(z)) !== r) {
            continue;
          }
          
          const chunkX = centerChunkX + x;
          const chunkZ = centerChunkZ + z;
          const key = `${chunkX},${chunkZ}`;
          
          requiredChunks.add(key);
          
          // If not already active, create it
          if (!this.activeChunks.has(key)) {
            const chunk = this.getChunkFromPool();
            if (chunk) {
              this.updateChunkGeometry(chunk, chunkX, chunkZ);
            }
          }
        }
      }
    }
    
    // Recycle chunks that are no longer needed
    for (const [key, chunk] of this.activeChunks.entries()) {
      if (!requiredChunks.has(key)) {
        // Hide the mesh rather than removing it
        chunk.mesh.visible = false;
        chunk.inUse = false;
        this.activeChunks.delete(key);
      }
    }
  },
  
  // Clean up resources when component is removed
  remove: function() {
    // Clear the vertex cache
    this.vertexCaches.clear();
    
    // Remove all meshes from the scene
    for (const chunk of this.chunkPool) {
      if (chunk.mesh) {
        this.el.object3D.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
      }
    }
    
    // Clear arrays
    this.chunkPool = [];
    this.activeChunks.clear();
  }
});
