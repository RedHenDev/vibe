// Grass without transparencies.

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const grassSystemEntity = document.createElement('a-entity');
        grassSystemEntity.setAttribute('id', 'whitman');
        grassSystemEntity.setAttribute('grass-system', '');
        scene.appendChild(grassSystemEntity);
        console.log('Leaves of grass loaded.');
      });
    }
  });

AFRAME.registerComponent('grass-system', {
    // Configuration options
    schema: {
      chunkSize: { type: 'number', default: 64 },           // Size of each chunk in meters
      renderDistance: { type: 'number', default: 128 },      // Max distance to render grass
      instancesPerChunk: { type: 'number', default: 4000 },  // Grass blades per chunk
      updateThreshold: { type: 'number', default: 32 },      // Distance player must move to trigger update
      minHeight: { type: 'number', default: 1.0 },           // Minimum grass height
      maxHeight: { type: 'number', default: 2.5 },           // Maximum grass height
      dayColor: { type: 'color', default: '#00D200' },       // Day grass color
      nightColor: { type: 'color', default: '#16161D' },     // Night grass color (very dark gray)
      baseColor: { type: 'color', default: '#00D200' },      // Current color (changes with day/night)
      chunksPerFrame: { type: 'number', default: 1 },        // Chunks to generate per frame
      colorVariation: { type: 'number', default: 0.2 },      // Color variation amount (0-1)
      isNightMode: { type: 'boolean', default: false }       // Track day/night state
    },
  
    init: function () {
      // Map to store active chunks
      this.chunks = new Map();
      
      // Track last update position
      this.lastUpdatePosition = new THREE.Vector3();
      
      // Queue for gradual chunk loading
      this.chunkQueue = [];
      this.isProcessingQueue = false;
      
      // Define grass blade geometry and material
      this.geometry = new THREE.PlaneGeometry(0.2, 2.0); // Width and unit height (will be scaled)
      
      // Set base color based on day/night mode
      this.data.baseColor = this.data.isNightMode ? this.data.nightColor : this.data.dayColor;
      
      this.material = new THREE.MeshBasicMaterial({
        color: this.data.baseColor,
        side: THREE.DoubleSide
        // Don't use vertexColors since we'll be using the material color directly
      });
      
      // Convert base color to vector for manipulation
      this.baseColorVector = new THREE.Color(this.data.baseColor);
      
      // Access getHeight function (assumed to be globally available)
      this.getHeight = getTerrainHeight;
      
      // Get player reference
      this.player = this.el.sceneEl.querySelector('#player').object3D;
      
      // Make grass system accessible to other components
      window.grassSystem = this;
      
      // Initialize chunks around player
      if (this.player) {
        this.queueInitialChunks();
        this.lastUpdatePosition.copy(this.player.position);
        console.log('Grass system initialized, chunks queued for loading');
      }
    },
    
    // Add methods to change grass colors for day/night cycle
    setNightMode: function() {
      if (this.data.isNightMode) return; // Already in night mode
      
      this.data.isNightMode = true;
      this.data.baseColor = this.data.nightColor;
      this.baseColorVector = new THREE.Color(this.data.baseColor);
      
      // Update existing grass chunks
      this.updateExistingGrassColors();
    },
    
    setDayMode: function() {
      if (!this.data.isNightMode) return; // Already in day mode
      
      this.data.isNightMode = false;
      this.data.baseColor = this.data.dayColor;
      this.baseColorVector = new THREE.Color(this.data.baseColor);
      
      // Update existing grass chunks
      this.updateExistingGrassColors();
    },
    
    updateExistingGrassColors: function() {
      // For each existing chunk, update its material color
      for (const [key, chunk] of this.chunks.entries()) {
        if (chunk.instancedMesh && chunk.instancedMesh.material) {
          // Update base material color
          chunk.instancedMesh.material.color.copy(this.baseColorVector);
          chunk.instancedMesh.material.needsUpdate = true;
        }
      }
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
          const distanceSquared = i*i + j*j;
          
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
      // Use component reference for RAF callback
      const component = this;
      
      requestAnimationFrame(function() {
        component.processChunkQueue();
      });
    },
    
    processChunkQueue: function() {
      // If there are no chunks to process, stop
      if (this.chunkQueue.length === 0) {
        this.isProcessingQueue = false;
        //console.log('Finished loading all grass chunks');
        return;
      }
      
      // Process a limited number of chunks per frame
      const limit = Math.min(this.data.chunksPerFrame, this.chunkQueue.length);
      
      for (let i = 0; i < limit; i++) {
        const chunk = this.chunkQueue.shift();
        this.generateChunk(chunk.x, chunk.z);
      }
      
      // Continue processing in the next frame
      this.startQueueProcessing();
    },
    
    tick: function () {
      // Get player's Object3D
      const player = this.player;
      if (!player) return;
  
      // Check if player has moved enough to update chunks
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
      
      // Player's chunk coordinates
      const cx = Math.floor(playerPosition.x / chunkSize);
      const cz = Math.floor(playerPosition.z / chunkSize);
  
      // Identify required chunks
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
              distanceSquared: i*i + j*j
            });
          }
        }
      }
      
      // Sort new chunks by distance
      newChunks.sort((a, b) => a.distanceSquared - b.distanceSquared);
      
      // Add new chunks to the queue
      this.chunkQueue.push(...newChunks);
      
      // Start processing the queue if not already
      if (!this.isProcessingQueue && this.chunkQueue.length > 0) {
        this.isProcessingQueue = true;
        this.startQueueProcessing();
      }
  
      // Remove chunks outside radius
      for (const key of this.chunks.keys()) {
        if (!requiredChunks.has(key)) {
          this.removeChunk(key);
        }
      }
    },
  
    generateChunk: function (i, j) {
      const chunkSize = this.data.chunkSize;
      const instances = this.data.instancesPerChunk;
      const positions = [];
      const rotations = [];
      const scales = [];
      const colors = [];
      
      // Prepare color reusables
      const colorVariation = this.data.colorVariation;
      const tempColor = new THREE.Color();
      
      // Generate random grass blade positions within chunk
      for (let k = 0; k < instances; k++) {
        const x = (i + Math.random()) * chunkSize;
        const z = (j + Math.random()) * chunkSize;
        const y = this.getHeight(x, z); // Get terrain height
        
        // Add some terrain awareness - avoid placing grass in water
        if (y < -11 || x > 128 & x < 256) {
          // Skip this instance or place less grass in water
        //   if (Math.random() > 0.2) {
            continue;
        //   }
        }
        
        positions.push(new THREE.Vector3(x, y, z));
        
        // Random rotation for variety
        rotations.push(Math.random() * Math.PI * 2);
        
        // Random height and width scale for variety
        const heightScale = this.data.minHeight + Math.random() * (this.data.maxHeight - this.data.minHeight);
        const widthScale = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
        scales.push(new THREE.Vector3(widthScale, heightScale, 1));
        
        // Vary color based on height and random variation
        tempColor.copy(this.baseColorVector);
        
        // Darken grass lower on the terrain, lighten it higher up
        const terrainFactor = Math.max(0, Math.min(1, (y + 20) / 60)); // -20 to 40 normalized
        
        // Random color variation
        const random = Math.random() * colorVariation * 2 - colorVariation; // -var to +var
        
        // Apply less variation at night for more uniform dark appearance
        const variationAmount = this.data.isNightMode ? 0.05 : 0.4;
        
        // Apply color adjustments
        tempColor.r = Math.max(0, Math.min(1, tempColor.r * (0.8 + terrainFactor * variationAmount + random)));
        tempColor.g = Math.max(0, Math.min(1, tempColor.g * (0.8 + terrainFactor * variationAmount + random)));
        tempColor.b = Math.max(0, Math.min(1, tempColor.b * (0.8 + terrainFactor * variationAmount + random)));
        
        colors.push(tempColor.clone());
      }
      
      // Skip if no valid grass positions were found
      if (positions.length === 0) {
        return;
      }
      
      // Create instanced mesh for the chunk with a new material for each chunk
      const chunkMaterial = new THREE.MeshBasicMaterial({
        color: this.data.baseColor,
        side: THREE.DoubleSide
      });
      
      const instancedMesh = new THREE.InstancedMesh(this.geometry, chunkMaterial, positions.length);
      const matrix = new THREE.Matrix4();
      const dummy = new THREE.Object3D();
      
      // Create a color attribute for the instances
      // This is a more compatible way that works across THREE.js versions
      if (typeof instancedMesh.setColorAt === 'function') {
        // If the method exists (newer THREE.js versions)
        for (let k = 0; k < positions.length; k++) {
          instancedMesh.setColorAt(k, colors[k]);
        }
      } else {
        // Fallback for older THREE.js versions
        const colorArray = new Float32Array(positions.length * 3);
        for (let k = 0; k < positions.length; k++) {
          const color = colors[k];
          colorArray[k * 3] = color.r;
          colorArray[k * 3 + 1] = color.g;
          colorArray[k * 3 + 2] = color.b;
        }
        
        const colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);
        instancedMesh.geometry.setAttribute('color', colorAttribute);
        chunkMaterial.vertexColors = true;
      }
      
      // Set the transform of each instance
      positions.forEach((pos, index) => {
        const rotation = rotations[index];
        const scale = scales[index];
        
        dummy.position.copy(pos);
        dummy.rotation.set(0, rotation, 0);
        dummy.scale.copy(scale);
        dummy.updateMatrix();
        
        instancedMesh.setMatrixAt(index, dummy.matrix);
      });
      
      // Update instance matrices and colors
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
      
      // Add a slight fade-in animation
      instancedMesh.material.transparent = true;
      instancedMesh.material.opacity = 0;
      
      // Add to scene and store in chunks map
      this.el.sceneEl.object3D.add(instancedMesh);
      this.chunks.set(`${i},${j}`, { 
        instancedMesh,
        positions,
        rotations,
        scales,
        colors
      });
      
      // Animate opacity
      this.animateChunkIn(instancedMesh);
    },
    
    animateChunkIn: function(mesh) {
      // Simple animation to fade in the chunk
      let opacity = 0;
      const component = this;
      
      function animate() {
        opacity += 0.05;
        mesh.material.opacity = Math.min(1, opacity);
        
        if (opacity < 1) {
          requestAnimationFrame(animate);
        } else {
          // Once fully faded in, we can optimize by making it non-transparent
          mesh.material.transparent = false;
          mesh.material.needsUpdate = true;
        }
      }
      
      requestAnimationFrame(animate);
    },
  
    removeChunk: function (key) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.animateChunkOut(chunk.instancedMesh, key);
      }
    },
    
    animateChunkOut: function(mesh, key) {
      // Make it transparent again for animation
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
          // Final removal after animation
          component.finalizeChunkRemoval(key);
        }
      }
      
      requestAnimationFrame(animate);
    },
    
    finalizeChunkRemoval: function(key) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.el.sceneEl.object3D.remove(chunk.instancedMesh);
        chunk.instancedMesh.geometry.dispose();
        chunk.instancedMesh.material.dispose();
        this.chunks.delete(key);
      }
    },
  
    remove: function () {
      // Clear the chunk queue
      this.chunkQueue = [];
      this.isProcessingQueue = false;
      
      // Clean up all chunks when component is removed
      for (const key of this.chunks.keys()) {
        this.finalizeChunkRemoval(key);
      }
      
      // Remove global reference
      delete window.grassSystem;
    }
});