AFRAME.registerComponent('grass-system', {
    // Configuration options
    schema: {
      chunkSize: { type: 'number', default: 64 },           // Size of each chunk in meters
      renderDistance: { type: 'number', default: 128 },      // Max distance to render grass
      instancesPerChunk: { type: 'number', default: 2000 },  // Grass blades per chunk
      updateThreshold: { type: 'number', default: 32 }       // Distance player must move to trigger update
    },
  
    init: function () {
      // Map to store active chunks
      this.chunks = new Map();
      
      // Track last update position
      this.lastUpdatePosition = new THREE.Vector3();
      
      // Define grass blade geometry and material
      this.geometry = new THREE.PlaneGeometry(0.2, 2.0); // 10cm wide, 2m tall
      this.material = new THREE.MeshBasicMaterial({
        color: 0x008f00, // Green color
        side: THREE.DoubleSide
      });
      
      // Access getHeight function (assumed to be globally available)
      this.getHeight = getTerrainHeight;
      
      // Get player reference
      this.player = this.el.sceneEl.querySelector('#player').object3D;
      
      // Generate initial chunk at player position
      if (this.player) {
        this.generateChunk(
          Math.floor(this.player.position.x / this.data.chunkSize),
          Math.floor(this.player.position.z / this.data.chunkSize)
        );
        this.lastUpdatePosition.copy(this.player.position);
      }
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
      const radius = Math.ceil(this.data.renderDistance / chunkSize); // Chunks within renderDistance
      
      // Player's chunk coordinates
      const cx = Math.floor(playerPosition.x / chunkSize);
      const cz = Math.floor(playerPosition.z / chunkSize);
  
      // Identify required chunks
      const requiredChunks = new Set();
      for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
          const key = `${cx + i},${cz + j}`;
          requiredChunks.add(key);
          if (!this.chunks.has(key)) {
            this.generateChunk(cx + i, cz + j);
          }
        }
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
  
      // Generate random grass blade positions within chunk
      for (let k = 0; k < instances; k++) {
        const x = (i + Math.random()) * chunkSize;
        const z = (j + Math.random()) * chunkSize;
        const y = this.getHeight(x, z); // Get terrain height
        positions.push(new THREE.Vector3(x, y, z));
        
        // Random rotation for variety
        rotations.push(Math.random() * Math.PI * 2);
      }
  
      // Create instanced mesh for the chunk
      const instancedMesh = new THREE.InstancedMesh(this.geometry, this.material, instances);
      const matrix = new THREE.Matrix4();
      
      positions.forEach((pos, index) => {
        const rotation = rotations[index];
        
        // Apply rotation and position
        matrix.makeRotationY(rotation);
        matrix.setPosition(pos);
        instancedMesh.setMatrixAt(index, matrix);
      });
  
      // Update instance matrices
      instancedMesh.instanceMatrix.needsUpdate = true;
  
      // Add to scene and store in chunks map
      this.el.sceneEl.object3D.add(instancedMesh);
      this.chunks.set(`${i},${j}`, { 
        instancedMesh,
        positions,
        rotations
      });
    },
  
    removeChunk: function (key) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.el.sceneEl.object3D.remove(chunk.instancedMesh);
        chunk.instancedMesh.geometry.dispose();
        chunk.instancedMesh.material.dispose();
        this.chunks.delete(key);
      }
    },
  
    remove: function () {
      // Clean up all chunks when component is removed
      for (const key of this.chunks.keys()) {
        this.removeChunk(key);
      }
    }
});