// Model Instance System for Eigenlite Vibe
// Uses instancing for dramatically improved performance with 3D models

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const modelSystemEntity = document.createElement('a-entity');
        modelSystemEntity.setAttribute('id', 'modelos');
        modelSystemEntity.setAttribute('model-system', '');
        scene.appendChild(modelSystemEntity);
        console.log('Eigengrau model system loaded.');
      });
    }
  });
  
  AFRAME.registerComponent('model-system', {
    schema: {
      modelId: { type: 'string', default: '#mRocks' }, // DOM id of the model to instance
      chunkSize: { type: 'number', default: 64 },        // Size of each chunk in meters
      renderDistance: { type: 'number', default: 128 },   // Max distance to render instances
      instancesPerChunk: { type: 'number', default: 1 },  // Instances per chunk
      updateThreshold: { type: 'number', default: 32 },   // Distance player must move to trigger update
      minHeight: { type: 'number', default: 4 },          // Minimum model height
      maxHeight: { type: 'number', default: 25 },         // Maximum model height
      baseColor: { type: 'color', default: '#FFFFFF' },   // Base color tint
      chunksPerFrame: { type: 'number', default: 2 },     // Chunks to generate per frame
      colorVariation: { type: 'number', default: 0.2 },   // Color variation amount (0-1)
      randomRotation: { type: 'boolean', default: true }, // Randomly rotate instances
      heightOffset: { type: 'number', default: 0 },       // Offset from terrain for placement
      avoidWater: { type: 'boolean', default: true },     // Avoid placing in water areas
      waterLevel: { type: 'number', default: -11 }        // Water level threshold
    },
    
    init: function () {
      // Map to store active chunks
      this.chunks = new Map();
      
      // Track last update position
      this.lastUpdatePosition = new THREE.Vector3();
      
      // Queue for gradual chunk loading
      this.chunkQueue = [];
      this.isProcessingQueue = false;
      
      // Access getHeight function (assumed to be globally available)
      this.getHeight = getTerrainHeight;
      
      // Get player reference
      this.player = this.el.sceneEl.querySelector('#player').object3D;
      
      // Load model and initialize system
      this.loadModel(this.data.modelId).then(() => {
        // Initialize chunks around player
        if (this.player) {
          this.queueInitialChunks();
          this.lastUpdatePosition.copy(this.player.position);
          console.log('Model system initialized, chunks queued for loading');
        }
      }).catch(error => {
        console.error('Failed to load model:', error);
      });
    },
    
    loadModel: function(modelId) {
      return new Promise((resolve, reject) => {
        // First, check if it's an asset-item
        const assetItem = document.querySelector(modelId);
        
        if (!assetItem) {
          reject(`Asset item with ID ${modelId} not found`);
          return;
        }
        
        // Create a temporary entity with gltf-model to load the model
        const tempEntity = document.createElement('a-entity');
        tempEntity.setAttribute('gltf-model', modelId);
        tempEntity.setAttribute('position', '0 -9999 0'); // Hide it far below
        this.el.sceneEl.appendChild(tempEntity);
        
        console.log(`Created temporary entity to load model ${modelId}`);
        
        // Wait for the model to load
        tempEntity.addEventListener('model-loaded', e => {
          console.log(`Model ${modelId} loaded successfully`);
          const model = e.detail.model;
          this.extractModelData(model);
          
          // Clean up temporary entity
          setTimeout(() => {
            this.el.sceneEl.removeChild(tempEntity);
          }, 100);
          
          resolve();
        });
        
        // Handle error
        tempEntity.addEventListener('model-error', e => {
          console.error(`Error loading model ${modelId}:`, e.detail);
          this.el.sceneEl.removeChild(tempEntity);
          reject(`Error loading model ${modelId}`);
        });
        
        // Handle timeout
        setTimeout(() => {
          if (!this.originalGeometry) {
            if (tempEntity.parentNode) {
              this.el.sceneEl.removeChild(tempEntity);
            }
            reject(`Loading model ${modelId} timed out`);
          }
        }, 10000);
      });
    },
    
    extractModelData: function(model) {
      // Find the first mesh in the model
      let firstMesh = null;
      
      model.traverse(node => {
        if (!firstMesh && node.isMesh && node.geometry) {
          firstMesh = node;
        }
      });
      
      if (!firstMesh) {
        console.error('No meshes found in model');
        return;
      }
      
      // Clone the geometry
      this.originalGeometry = firstMesh.geometry.clone();
      
      // Clone the material
      if (Array.isArray(firstMesh.material)) {
        // If there are multiple materials, use the first one
        this.originalMaterial = firstMesh.material[0].clone();
      } else {
        this.originalMaterial = firstMesh.material.clone();
      }
      
      // Make the material work with instancing and vertex colors
      this.originalMaterial.vertexColors = true;
      
      console.log('Model geometry and material extracted successfully');
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
    
    tick: function () {
      const player = this.player;
      if (!player || !this.originalGeometry) return;
      
      const playerPosition = player.position;
      const dx = playerPosition.x - this.lastUpdatePosition.x;
      const dz = playerPosition.z - this.lastUpdatePosition.z;
      const distanceMoved = Math.sqrt(dx * dx + dz * dz);
      
      if (distanceMoved > this.data.updateThreshold) {
        this.updateChunks(playerPosition);
        this.lastUpdatePosition.copy(playerPosition);
      }
    },
    
    updateChunks: function (playerPosition) {
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
    
    generateChunk: function (i, j) {
      if (!this.originalGeometry) {
        console.warn('Cannot generate chunk: model geometry not loaded');
        return;
      }
      
      const chunkSize = this.data.chunkSize;
      const instances = this.data.instancesPerChunk;
      const positions = [];
      const matrices = []; // Store matrices for efficient updates
      const colors = [];
      
      const colorVariation = this.data.colorVariation;
      const baseColor = new THREE.Color(this.data.baseColor);
      
      // Temporary objects for matrix calculations
      const tempPosition = new THREE.Vector3();
      const tempQuaternion = new THREE.Quaternion();
      const tempScale = new THREE.Vector3();
      const tempMatrix = new THREE.Matrix4();
      
      for (let k = 0; k < instances; k++) {
        const x = (i + Math.random()) * chunkSize;
        const z = (j + Math.random()) * chunkSize;
        const y = this.getHeight(x, z);
        
        // Skip if in water and avoidWater is true
        if (this.data.avoidWater && y < this.data.waterLevel) {
          if (Math.random() > 0.2) {
            continue;
          }
        }
        
        // Position with height offset
        tempPosition.set(x, y + this.data.heightOffset, z);
        
        // Random rotation (Y axis only, or full 3D)
        if (this.data.randomRotation) {
          tempQuaternion.setFromEuler(new THREE.Euler(
            Math.random() * 0.2 - 0.1,
            Math.random() * Math.PI * 2,
            Math.random() * 0.2 - 0.1
          ));
        } else {
          tempQuaternion.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
        }
        
        // Random scale - use a heightScale and widthScale similar to tree-sys.js
        //const heightScale = this.data.minHeight + Math.random() * (this.data.maxHeight - this.data.minHeight);
        //const widthScale = 0.8 + Math.random() * 0.4; // Random width variation
        const mScale = 10 + Math.random() * 10;
        tempScale.set(mScale,mScale,mScale);
        
        // Create transformation matrix
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        
        // Store matrix
        matrices.push(tempMatrix.clone());
        
        // Store original position for potential updates
        positions.push(tempPosition.clone());
        
        // Vary color based on height and random variation
        const terrainFactor = Math.max(0, Math.min(1, (y + 20) / 60));
        const random = Math.random() * colorVariation * 2 - colorVariation;
        
        const color = baseColor.clone();
        color.r = Math.max(0, Math.min(1, color.r * (0.8 + terrainFactor * 0.4 + random)));
        color.g = Math.max(0, Math.min(1, color.g * (0.8 + terrainFactor * 0.4 + random)));
        color.b = Math.max(0, Math.min(1, color.b * (0.8 + terrainFactor * 0.3 + random)));
        colors.push(color);
      }
      
      if (positions.length === 0) {
        return;
      }
      
      // Create instanced mesh
      const instancedMesh = new THREE.InstancedMesh(
        this.originalGeometry,
        this.originalMaterial.clone(),
        positions.length
      );
      
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      
      // Apply matrices and colors
      for (let i = 0; i < matrices.length; i++) {
        instancedMesh.setMatrixAt(i, matrices[i]);
        
        if (typeof instancedMesh.setColorAt === 'function') {
          instancedMesh.setColorAt(i, colors[i]);
        }
      }
      
      // Need to mark these as needing updates
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      
      // Add to scene
      this.el.sceneEl.object3D.add(instancedMesh);
      
      // Store in chunks map
      this.chunks.set(`${i},${j}`, {
        mesh: instancedMesh,
        positions,
        matrices,
        colors
      });
      
      // Animate fade-in
      instancedMesh.material.transparent = true;
      instancedMesh.material.opacity = 0;
      this.animateChunkIn(instancedMesh);
    },
    
    animateChunkIn: function(mesh) {
      let opacity = 0;
      
      function animate() {
        opacity += 0.05;
        mesh.material.opacity = Math.min(1, opacity);
        
        if (opacity < 1) {
          requestAnimationFrame(animate);
        } else {
          mesh.material.transparent = false;
          mesh.material.needsUpdate = true;
        }
      }
      
      requestAnimationFrame(animate);
    },
    
    removeChunk: function (key) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.animateChunkOut(chunk.mesh, key);
      }
    },
    
    animateChunkOut: function(mesh, key) {
      mesh.material.transparent = true;
      mesh.material.needsUpdate = true;
      let opacity = 1;
      const component = this;
      
      function animate() {
        opacity -= 0.1;
        mesh.material.opacity = Math.max(0, opacity);
        
        if (opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          component.finalizeChunkRemoval(key);
        }
      }
      
      requestAnimationFrame(animate);
    },
    
    finalizeChunkRemoval: function(key) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.el.sceneEl.object3D.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
        this.chunks.delete(key);
      }
    },
    
    remove: function () {
      this.chunkQueue = [];
      this.isProcessingQueue = false;
      
      for (const key of this.chunks.keys()) {
        this.finalizeChunkRemoval(key);
      }
      
      if (this.originalGeometry) {
        this.originalGeometry.dispose();
      }
      if (this.originalMaterial) {
        this.originalMaterial.dispose();
      }
    }
  });