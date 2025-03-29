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
    renderDistance: { type: 'number', default: 128 },     // Max distance to render grass
    instancesPerChunk: { type: 'number', default: 2000 }, // Grass blades per chunk
    updateThreshold: { type: 'number', default: 32 },     // Distance player must move to trigger update
    minHeight: { type: 'number', default: 1.0 },          // Minimum grass height
    maxHeight: { type: 'number', default: 2.5 },          // Maximum grass height
    baseColor: { type: 'color', default: '#008f00' },     // Base grass color
    chunksPerFrame: { type: 'number', default: 2 },       // Chunks to generate per frame
    colorVariation: { type: 'number', default: 0.2 },     // Color variation amount (0-1)
    minOpacity: { type: 'number', default: 1.0 },         // Minimum opacity for grass blades
    maxOpacity: { type: 'number', default: 1.0 }          // Maximum opacity for grass blades
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
    this.geometry = new THREE.PlaneGeometry(0.2, 1.0); // Width and unit height (will be scaled)
    this.material = new THREE.MeshBasicMaterial({
      color: this.data.baseColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });

    // Convert base color to vector for manipulation
    this.baseColorVector = new THREE.Color(this.data.baseColor);

    // Access getHeight function (assumed to be globally available)
    this.getHeight = getTerrainHeight;

    // Get player reference
    this.player = this.el.sceneEl.querySelector('#player').object3D;

    // Initialize chunks around player
    if (this.player) {
      this.queueInitialChunks();
      this.lastUpdatePosition.copy(this.player.position);
      console.log('Grass system initialized, chunks queued for loading');
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
      //console.log('Finished loading all grass chunks');
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
    const chunkSize = this.data.chunkSize;
    const instances = this.data.instancesPerChunk;
    const positions = [];
    const rotations = [];
    const scales = [];
    const colors = [];
    const opacities = [];

    const colorVariation = this.data.colorVariation;
    const tempColor = new THREE.Color();

    for (let k = 0; k < instances; k++) {
      const x = (i + Math.random()) * chunkSize;
      const z = (j + Math.random()) * chunkSize;
      const y = this.getHeight(x, z);

      if (y < -11) {
        if (Math.random() > 0.2) {
          continue;
        }
      }

      positions.push(new THREE.Vector3(x, y, z));
      rotations.push(Math.random() * Math.PI * 2);

      const heightScale = this.data.minHeight + Math.random() * (this.data.maxHeight - this.data.minHeight);
      const widthScale = 0.8 + Math.random() * 0.4;
      scales.push(new THREE.Vector3(widthScale, heightScale, 1));

      tempColor.copy(this.baseColorVector);
      const terrainFactor = Math.max(0, Math.min(1, (y + 20) / 60));
      const random = Math.random() * colorVariation * 2 - colorVariation;

      tempColor.r = Math.max(0, Math.min(1, tempColor.r * (0.8 + terrainFactor * 0.4 + random)));
      tempColor.g = Math.max(0, Math.min(1, tempColor.g * (0.8 + terrainFactor * 0.4 + random)));
      tempColor.b = Math.max(0, Math.min(1, tempColor.b * (0.8 + terrainFactor * 0.3 + random)));
      colors.push(tempColor.clone());

      const bladeOpacity = this.data.minOpacity + Math.random() * (this.data.maxOpacity - this.data.minOpacity);
      opacities.push(bladeOpacity);
    }

    if (positions.length === 0) {
      return;
    }

    const opacityGroups = this.groupByOpacity(positions, rotations, scales, colors, opacities);
    const chunkGroup = new THREE.Group();

    for (const group of opacityGroups) {
      if (group.indices.length === 0) continue;

      const material = this.material.clone();
      material.transparent = true;
      material.opacity = group.opacity;
      material.depthWrite = false; // Improve transparency rendering
      material._targetOpacity = group.opacity; // Store target opacity for animation

      const instancedMesh = new THREE.InstancedMesh(
        this.geometry,
        material,
        group.indices.length
      );

      const dummy = new THREE.Object3D();

      if (typeof instancedMesh.setColorAt === 'function') {
        for (let k = 0; k < group.indices.length; k++) {
          const idx = group.indices[k];
          instancedMesh.setColorAt(k, colors[idx]);
        }
      } else {
        const colorArray = new Float32Array(group.indices.length * 3);
        for (let k = 0; k < group.indices.length; k++) {
          const idx = group.indices[k];
          const color = colors[idx];
          colorArray[k * 3] = color.r;
          colorArray[k * 3 + 1] = color.g;
          colorArray[k * 3 + 2] = color.b;
        }

        const colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);
        instancedMesh.geometry.setAttribute('color', colorAttribute);
        material.vertexColors = true;
      }

      for (let k = 0; k < group.indices.length; k++) {
        const idx = group.indices[k];
        const pos = positions[idx];
        const rotation = rotations[idx];
        const scale = scales[idx];

        // Fix: Adjust position so bottom of grass aligns with terrain
        dummy.position.set(pos.x, pos.y + scale.y / 2, pos.z);
        dummy.rotation.set(0, rotation, 0);
        dummy.scale.copy(scale);
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(k, dummy.matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      material.opacity = 0; // Start with zero opacity for fade-in
      chunkGroup.add(instancedMesh);
    }

    this.el.sceneEl.object3D.add(chunkGroup);
    this.chunks.set(`${i},${j}`, {
      group: chunkGroup,
      positions,
      rotations,
      scales,
      colors,
      opacities,
      meshes: chunkGroup.children
    });

    this.animateChunkIn(chunkGroup.children);
  },

  groupByOpacity: function(positions, rotations, scales, colors, opacities) {
    const opacityStep = 0.1;
    const groups = [];

    for (let opacity = this.data.minOpacity; opacity <= this.data.maxOpacity; opacity += opacityStep) {
      groups.push({
        opacity: opacity,
        indices: []
      });
    }

    for (let i = 0; i < opacities.length; i++) {
      const opacity = opacities[i];
      const groupIndex = Math.floor((opacity - this.data.minOpacity) / opacityStep);
      const safeIndex = Math.min(groupIndex, groups.length - 1);

      if (safeIndex >= 0 && safeIndex < groups.length) {
        groups[safeIndex].indices.push(i);
      } else {
        const closest = opacity < this.data.minOpacity ? 0 : groups.length - 1;
        groups[closest].indices.push(i);
      }
    }

    return groups.filter(group => group.indices.length > 0);
  },

  animateChunkIn: function(meshes) {
    let opacity = 0;
    const component = this;

    function animate() {
      opacity += 0.05;
      const targetOpacity = Math.min(1, opacity);

      for (const mesh of meshes) {
        mesh.material.opacity = targetOpacity * mesh.material._targetOpacity;
      }

      if (opacity < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  },

  removeChunk: function (key) {
    const chunk = this.chunks.get(key);
    if (chunk) {
      this.animateChunkOut(chunk, key);
    }
  },

  animateChunkOut: function(chunk, key) {
    const meshes = chunk.meshes;
    let opacity = 1;
    const component = this;

    function animate() {
      opacity -= 0.1;
      const targetOpacity = Math.max(0, opacity);

      for (const mesh of meshes) {
        mesh.material.opacity = targetOpacity * mesh.material._targetOpacity;
      }

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
      this.el.sceneEl.object3D.remove(chunk.group);

      for (const mesh of chunk.meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }

      this.chunks.delete(key);
    }
  },

  remove: function () {
    this.chunkQueue = [];
    this.isProcessingQueue = false;

    for (const key of this.chunks.keys()) {
      this.finalizeChunkRemoval(key);
    }
  }
});