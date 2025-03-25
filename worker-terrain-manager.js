// Worker-based Terrain Manager
// Integrates the web worker with the pooled terrain system for optimal performance

// Check if Web Workers are supported
const isWorkerSupported = typeof Worker !== 'undefined';

// Manager for handling the terrain worker
const TerrainWorkerManager = {
  worker: null,
  initialized: false,
  pendingRequests: new Map(),
  requestId: 0,
  
  // Initialize the terrain worker
  init: function(onInitialized) {
    if (!isWorkerSupported) {
      console.warn('Web Workers not supported in this browser. Using fallback method.');
      if (onInitialized) onInitialized(false);
      return;
    }
    
    try {
      // Create the worker
      this.worker = new Worker('terrain-worker.js');
      
      // Set up message handlers
      this.worker.onmessage = (e) => {
        const data = e.data;
        
        switch (data.type) {
          case 'initialized':
            console.log(`Terrain worker initialized with seed ${data.seed}`);
            this.initialized = true;
            if (onInitialized) onInitialized(true);
            break;
            
          case 'chunkData':
            // Forward chunk data to the appropriate handler
            const chunkKey = `${data.chunkX},${data.chunkZ}`;
            if (TerrainChunkRegistry.handlers.has(chunkKey)) {
              const handler = TerrainChunkRegistry.handlers.get(chunkKey);
              handler(data);
            }
            break;
            
          case 'heightResult':
            // Resolve the pending height request
            if (this.pendingRequests.has(data.id)) {
              const { resolve } = this.pendingRequests.get(data.id);
              resolve(data.height);
              this.pendingRequests.delete(data.id);
            }
            break;
            
          case 'cacheCleared':
            console.log('Terrain worker cache cleared');
            break;
        }
      };
      
      // Handle errors
      this.worker.onerror = (error) => {
        console.error('Terrain worker error:', error);
        // Reject all pending requests
        for (const [id, { reject }] of this.pendingRequests) {
          reject(new Error('Terrain worker error'));
        }
        this.pendingRequests.clear();
      };
      
      // Initialize the worker
      this.worker.postMessage({
        type: 'init',
        seed: document.currentScript?.getAttribute('data-seed') || '1'
      });
      
    } catch (error) {
      console.error('Failed to initialize terrain worker:', error);
      this.worker = null;
      if (onInitialized) onInitialized(false);
    }
  },
  
  // Get terrain height from the worker
  getTerrainHeight: function(x, z) {
    if (!this.worker || !this.initialized) {
      // Fall back to original method if worker not available
      return getTerrainHeight(x, z);
    }
    
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      
      // Store the request
      this.pendingRequests.set(id, { resolve, reject });
      
      // Send the request to the worker
      this.worker.postMessage({
        type: 'calculateHeight',
        id: id,
        x: x,
        z: z
      });
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          console.warn('Terrain height request timed out, falling back to main thread');
          this.pendingRequests.delete(id);
          resolve(getTerrainHeight(x, z));
        }
      }, 1000);
    });
  },
  
  // Request chunk generation from the worker
  generateChunk: function(chunkX, chunkZ, chunkSize, resolution, callback) {
    if (!this.worker || !this.initialized) {
      return false;
    }
    
    // Register the callback
    const chunkKey = `${chunkX},${chunkZ}`;
    TerrainChunkRegistry.handlers.set(chunkKey, callback);
    
    // Request generation
    this.worker.postMessage({
      type: 'generateChunk',
      chunkX: chunkX,
      chunkZ: chunkZ,
      chunkSize: chunkSize,
      resolution: resolution
    });
    
    return true;
  },
  
  // Clear the worker cache
  clearCache: function() {
    if (this.worker && this.initialized) {
      this.worker.postMessage({ type: 'clearCache' });
    }
  },
  
  // Terminate the worker
  terminate: function() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.pendingRequests.clear();
    }
  }
};

// Registry for chunk generation callbacks
const TerrainChunkRegistry = {
  handlers: new Map()
};

// Enhanced pooled terrain generator that uses the worker
AFRAME.registerComponent('enhanced-terrain-generator', {
  schema: {
    chunkSize: { type: 'number', default: 64 },
    poolSize: { type: 'number', default: 36 },
    chunksToRender: { type: 'number', default: 9 },
    updateThreshold: { type: 'number', default: 32 },
    resolution: { type: 'number', default: 1 },
    useWorker: { type: 'boolean', default: true },
    adaptiveDetail: { type: 'boolean', default: true } // Use higher detail for nearby chunks
  },
  
  init: function() {
    // Initialize terrain worker if enabled
    if (this.data.useWorker && isWorkerSupported) {
      TerrainWorkerManager.init((success) => {
        this.workerEnabled = success;
        console.log(`Terrain worker ${success ? 'enabled' : 'disabled'}`);
        
        // Initialize the terrain system
        this.initializeSystem();
      });
    } else {
      this.workerEnabled = false;
      this.initializeSystem();
    }
  },
  
  initializeSystem: function() {
    // Initialize the original pooled terrain system
    // Use existing terrain generation if worker is not available
    this.originalGetTerrainHeight = window.getTerrainHeight;
    
    // Replace global height function with worker version if available
    if (this.workerEnabled) {
      // Cache for synchronous access
      const heightCache = new Map();
      const maxCacheSize = 20000;
      
      // Replace the global terrain height function
      window.getTerrainHeight = function(x, z) {
        // Round coordinates for better cache hits
        const rx = Math.round(x * 10) / 10;
        const rz = Math.round(z * 10) / 10;
        const key = `${rx},${rz}`;
        
        // Check cache first
        if (heightCache.has(key)) {
          return heightCache.get(key);
        }
        
        // Fall back to original function (synchronous)
        // Worker will update cache asynchronously for future calls
        const height = this.originalGetTerrainHeight(rx, rz);
        
        // Store in cache
        if (heightCache.size < maxCacheSize) {
          heightCache.set(key, height);
        }
        
        // Request worker to calculate this height for future use
        TerrainWorkerManager.getTerrainHeight(rx, rz)
          .then(workerHeight => {
            // Update cache with worker result
            heightCache.set(key, workerHeight);
          })
          .catch(error => {
            console.warn('Worker height calculation failed:', error);
          });
        
        return height;
      }.bind(this);
    }
    
    // Set up pooled terrain component
    this.player = document.querySelector('#player').object3D;
    this.activeChunks = new Map();
    this.chunkPool = [];
    this.lastUpdatePosition = new THREE.Vector3();
    
    // Create vertex templates
    this.createTemplates();
    
    // Initialize chunk pool
    this.initializeChunkPool();
    
    // Start with chunks around player
    if (this.player) {
      setTimeout(() => {
        this.updateChunks();
      }, 100);
    }
    
    // Performance metrics
    this.frameCounter = 0;
    this.totalUpdateTime = 0;
    this.updateCount = 0;
    
    // Debug logging periodically
    setInterval(() => {
      if (this.updateCount > 0) {
        const avgTime = this.totalUpdateTime / this.updateCount;
        console.log(`Terrain stats: ${this.activeChunks.size} active chunks, avg update: ${avgTime.toFixed(2)}ms`);
        this.totalUpdateTime = 0;
        this.updateCount = 0;
      }
    }, 10000);
  },
  
  createTemplates: function() {
    // Create template arrays for indices - these are the same for all chunks
    const chunkSize = this.data.chunkSize;
    const resolution = this.data.resolution;
    const verticesPerRow = Math.ceil(chunkSize / resolution) + 1;
    
    // Pre-calculate index pattern for all chunks
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
    console.log(`Initializing enhanced terrain chunk pool with ${this.data.poolSize} chunks...`);
    
    for (let i = 0; i < this.data.poolSize; i++) {
      const chunk = this.createChunk();
      this.chunkPool.push(chunk);
    }
    
    console.log('Enhanced terrain pool initialized');
  },
  
  createChunk: function() {
    // Create a pooled chunk with buffers
    const vertexCount = this.vertexCount;
    
    // Pre-allocate vertex arrays
    const vertices = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    
    // Create geometry with pre-allocated buffers
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(this.templateIndices);
    
    // Create material
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
      lastUsed: 0,
      vertexBuffers: {
        position: vertices,
        color: colors
      }
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
      
      // Remove from active chunks
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
    const resolution = this.getResolutionForChunk(chunkX, chunkZ);
    
    // Try to use worker for generation
    if (this.workerEnabled) {
      // Get reference to geometry for updating when worker completes
      const positionAttr = chunk.mesh.geometry.getAttribute('position');
      const colorAttr = chunk.mesh.geometry.getAttribute('color');
      
      // Register callback for when worker completes
      const success = TerrainWorkerManager.generateChunk(
        chunkX, chunkZ, chunkSize, resolution,
        (data) => {
          // Update geometry with worker-generated data
          const vertices = new Float32Array(data.vertices);
          const colors = new Float32Array(data.colors);
          
          positionAttr.array = vertices;
          colorAttr.array = colors;
          
          positionAttr.needsUpdate = true;
          colorAttr.needsUpdate = true;
          
          // Update normals
          chunk.mesh.geometry.computeVertexNormals();
          
          // Show the chunk
          chunk.mesh.visible = true;
        }
      );
      
      if (!success) {
        // Fall back to main thread if worker generation failed
        this.generateChunkMainThread(chunk, chunkX, chunkZ, resolution);
      }
    } else {
      // Use main thread generation
      this.generateChunkMainThread(chunk, chunkX, chunkZ, resolution);
    }
    
    // Update chunk metadata
    chunk.chunkX = chunkX;
    chunk.chunkZ = chunkZ;
    
    // Add to active chunks
    this.activeChunks.set(`${chunkX},${chunkZ}`, chunk);
  },
  
  generateChunkMainThread: function(chunk, chunkX, chunkZ, resolution) {
    const chunkSize = this.data.chunkSize;
    const verticesPerRow = Math.ceil(chunkSize / resolution) + 1;
    
    // Calculate world offset
    const offsetX = chunkX * (chunkSize - resolution); // Slight overlap to avoid seams
    const offsetZ = chunkZ * (chunkSize - resolution);
    
    // Get vertex and color buffer from geometry
    const positionAttr = chunk.mesh.geometry.getAttribute('position');
    const colorAttr = chunk.mesh.geometry.getAttribute('color');
    const positionArray = positionAttr.array;
    const colorArray = colorAttr.array;
    
    // Generate vertex data
    let vertexIndex = 0;
    for (let z = 0; z < verticesPerRow; z++) {
      for (let x = 0; x < verticesPerRow; x++) {
        const worldX = offsetX + x * resolution;
        const worldZ = offsetZ + z * resolution;
        
        // Get terrain height at this position
        const height = window.getTerrainHeight(worldX, worldZ);
        
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
    
    // Mark buffers as needing update
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    
    // Update normals
    chunk.mesh.geometry.computeVertexNormals();
    
    // Show the chunk
    chunk.mesh.visible = true;
  },
  
  getResolutionForChunk: function(chunkX, chunkZ) {
    if (!this.data.adaptiveDetail) {
      return this.data.resolution;
    }
    
    // Calculate distance from player in chunk coordinates
    const playerChunkX = Math.floor(this.player.position.x / this.data.chunkSize);
    const playerChunkZ = Math.floor(this.player.position.z / this.data.chunkSize);
    
    const dx = chunkX - playerChunkX;
    const dz = chunkZ - playerChunkZ;
    const distanceSquared = dx * dx + dz * dz;
    
    // Adjust resolution based on distance
    // Closer chunks get more detail (smaller resolution value)
    if (distanceSquared <= 1) {
      return this.data.resolution; // Highest detail for immediate chunks
    } else if (distanceSquared <= 4) {
      return this.data.resolution * 2; // Medium detail for nearby chunks
    } else {
      return this.data.resolution * 4; // Low detail for distant chunks
    }
  },
  
  tick: function(time) {
    // Only update chunks every 3rd frame for performance
    this.frameCounter = (this.frameCounter + 1) % 3;
    if (this.frameCounter !== 0) return;
    
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
      
      // Record performance metrics
      const updateTime = performance.now() - startTime;
      this.totalUpdateTime += updateTime;
      this.updateCount++;
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
    
    // Generate needed chunks in spiral pattern starting from center
    // This loads the most important chunks first
    const spiral = this.generateSpiralPattern(radius);
    
    for (const [dx, dz] of spiral) {
      const chunkX = centerChunkX + dx;
      const chunkZ = centerChunkZ + dz;
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
  
  generateSpiralPattern: function(radius) {
    // Generate a spiral pattern centered at 0,0
    // This creates a pattern that spirals outward from the center
    const result = [[0, 0]]; // Start with center
    
    for (let r = 1; r <= radius; r++) {
      // Top edge (left to right)
      for (let x = -r; x <= r; x++) {
        result.push([x, -r]);
      }
      
      // Right edge (top to bottom)
      for (let z = -r + 1; z <= r; z++) {
        result.push([r, z]);
      }
      
      // Bottom edge (right to left)
      for (let x = r - 1; x >= -r; x--) {
        result.push([x, r]);
      }
      
      // Left edge (bottom to top)
      for (let z = r - 1; z >= -r + 1; z--) {
        result.push([-r, z]);
      }
    }
    
    return result;
  },
  
  // Clean up resources when component is removed
  remove: function() {
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
    
    // Terminate worker
    if (this.workerEnabled) {
      TerrainWorkerManager.terminate();
    }
    
    // Restore original height function
    if (this.originalGetTerrainHeight) {
      window.getTerrainHeight = this.originalGetTerrainHeight;
    }
  }
});

// Helper component to enable compatibility with existing terrain-generator
AFRAME.registerComponent('enable-worker-terrain', {
  init: function() {
    // Remove any existing terrain-generator components to avoid conflicts
    const existingTerrain = document.querySelector('[terrain-generator]');
    if (existingTerrain) {
      existingTerrain.removeAttribute('terrain-generator');
    }
    
    // Create enhanced terrain generator entity
    const enhancedTerrain = document.createElement('a-entity');
    enhancedTerrain.setAttribute('id', 'enhanced-terrain');
    enhancedTerrain.setAttribute('enhanced-terrain-generator', {
      useWorker: true,
      adaptiveDetail: true,
      poolSize: 36,
      chunksToRender: 9
    });
    
    document.querySelector('a-scene').appendChild(enhancedTerrain);
    
    console.log('Enhanced worker-based terrain generator enabled');
  }
});

// Add the component to the scene (can be added manually in HTML too)
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const enablerEntity = document.createElement('a-entity');
      enablerEntity.setAttribute('enable-worker-terrain', '');
      scene.appendChild(enablerEntity);
    });
  }
});
