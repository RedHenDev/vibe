// Pyramid System for Eigenlite Vibe
// Creates pyramid structures using THREE.js primitives with instancing

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const pyramidSystemEntity = document.createElement('a-entity');
        pyramidSystemEntity.setAttribute('id', 'pyramidos');
        pyramidSystemEntity.setAttribute('pyramid-system', '');
        scene.appendChild(pyramidSystemEntity);
        console.log('Eigengrau pyramid system loaded.');
      });
    }
  });
  
  AFRAME.registerComponent('pyramid-system', {
    schema: {
      chunkSize: { type: 'number', default: 64 },        // Size of each chunk in meters
      renderDistance: { type: 'number', default: 128 },   // Max distance to render instances
      instancesPerChunk: { type: 'number', default: 5 },  // Instances per chunk
      updateThreshold: { type: 'number', default: 32 },   // Distance player must move to trigger update
      minHeight: { type: 'number', default: 3 },         // Minimum pyramid height
      maxHeight: { type: 'number', default: 5 },         // Maximum pyramid height
      baseColor: { type: 'color', default: '#CC00DD' },   // Base color (wheat)
      chunksPerFrame: { type: 'number', default: 2 },     // Chunks to generate per frame
      colorVariation: { type: 'number', default: 0.2 },   // Color variation amount (0-1)
      randomRotation: { type: 'boolean', default: true }, // Randomly rotate instances
      heightOffset: { type: 'number', default: 0 },       // Offset from terrain for placement
      avoidWater: { type: 'boolean', default: true },     // Avoid placing in water areas
      waterLevel: { type: 'number', default: -11 },       // Water level threshold
      sides: { type: 'number', default: 4 },              // Number of sides (3=triangle, 4=square base)
      baseWidth: { type: 'number', default: 4 },         // Base width of pyramid
      useGlowMaterial: { type: 'boolean', default: false } // Use glowing material?
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
      
      // Create pyramid geometry
      this.createPyramidGeometry();
      
      // Initialize chunks around player
      if (this.player) {
        this.queueInitialChunks();
        this.lastUpdatePosition.copy(this.player.position);
        console.log('Pyramid system initialized, chunks queued for loading');
      }
    },
    
    createPyramidGeometry: function() {
      // Create a cone geometry with a small number of segments to make it look like a pyramid
      const sides = this.data.sides;
      const baseWidth = 1; // Unit size - we'll scale instances individually
      const height = 1;    // Unit height
      
      // Create cone geometry (which makes a pyramid with few segments)
      this.pyramidGeometry = new THREE.ConeGeometry(baseWidth, height, sides, 1);
      
      // Center the pyramid so the base is at y=0
      this.pyramidGeometry.translate(0, height/2, 0);
      
      // Convert the baseColor string to a THREE.Color object
      const baseColor = new THREE.Color(this.data.baseColor);
      console.log("Using base color:", this.data.baseColor, baseColor);
      
      // Create material
      if (this.data.useGlowMaterial) {
        // Create a glowing material
        this.pyramidMaterial = new THREE.MeshBasicMaterial({
          color: baseColor,
          emissive: baseColor,
          emissiveIntensity: 0.5
        });
      } else {
        // Create a standard material
        this.pyramidMaterial = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.7,
          metalness: 0.3
        });
      }
      
      console.log(`Created pyramid geometry with ${sides} sides and color ${this.data.baseColor}`);
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
      const matrices = []; // Store matrices for efficient updates
      const colors = [];
      
      // Parse the base color correctly
      const baseColor = new THREE.Color(this.data.baseColor);
      const colorVariation = this.data.colorVariation;
      
      // Temporary objects for matrix calculations
      const tempPosition = new THREE.Vector3();
      const tempQuaternion = new THREE.Quaternion();
      const tempScale = new THREE.Vector3();
      const tempMatrix = new THREE.Matrix4();
      
      // Add some deterministic randomness based on chunk coordinates
      const chunkRandom = new Math.seedrandom(`pyramid-${i}-${j}`);
      
      for (let k = 0; k < instances; k++) {
        // Using chunk-specific random to make placement somewhat deterministic
        const xPercent = chunkRandom();
        const zPercent = chunkRandom();
        
        const x = (i + xPercent) * chunkSize;
        const z = (j + zPercent) * chunkSize;
        const y = this.getHeight(x, z);
        
        // Skip if in water and avoidWater is true
        if (this.data.avoidWater && y < this.data.waterLevel) {
          if (chunkRandom() > 0.2) {
            continue;
          }
        }
        
        // Position with height offset
        tempPosition.set(x, y + this.data.heightOffset, z);
        
        // Random rotation (Y axis only)
        if (this.data.randomRotation) {
          tempQuaternion.setFromEuler(new THREE.Euler(0, chunkRandom() * Math.PI * 2, 0));
        } else {
          tempQuaternion.setFromEuler(new THREE.Euler(0, 0, 0));
        }
        
        // Random scale - height and base size
        const heightScale = this.data.minHeight + chunkRandom() * (this.data.maxHeight - this.data.minHeight);
        const baseScale = this.data.baseWidth * (0.8 + chunkRandom() * 0.4); // Base width variation
        tempScale.set(baseScale, heightScale, baseScale);
        
        // Create transformation matrix
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        
        // Store matrix
        matrices.push(tempMatrix.clone());
        
        // Store original position for potential updates
        positions.push(tempPosition.clone());
        
        // For color variation, we'll use a much lighter touch to preserve the base color's hue
        const color = baseColor.clone();
        const variationAmount = chunkRandom() * colorVariation - (colorVariation / 2);
        
        // Apply color variation while preserving hue better
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        
        // Just vary saturation and lightness slightly
        hsl.s = Math.max(0, Math.min(1, hsl.s + variationAmount * 0.3));
        hsl.l = Math.max(0.1, Math.min(0.9, hsl.l + variationAmount * 0.3));
        
        color.setHSL(hsl.h, hsl.s, hsl.l);
        colors.push(color);
      }
      
      if (positions.length === 0) {
        return;
      }
      
      // Create a new material for this chunk with the exact base color
      const chunkMaterial = this.pyramidMaterial.clone();
      chunkMaterial.color = new THREE.Color(this.data.baseColor);
      
      // Use custom vertex colors
      chunkMaterial.vertexColors = false; // We'll handle coloring at the instance level
      
      // Create instanced mesh
      const instancedMesh = new THREE.InstancedMesh(
        this.pyramidGeometry,
        chunkMaterial,
        positions.length
      );
      
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      
      // Apply matrices and colors
      for (let i = 0; i < matrices.length; i++) {
        instancedMesh.setMatrixAt(i, matrices[i]);
        instancedMesh.setColorAt(i, colors[i]);
      }
      
      // Force color update
      instancedMesh.instanceColor.needsUpdate = true;
      
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
      
      if (this.pyramidGeometry) {
        this.pyramidGeometry.dispose();
      }
      if (this.pyramidMaterial) {
        this.pyramidMaterial.dispose();
      }
    }
  });
  
  // Add seedrandom for deterministic random placement
  // From https://github.com/davidbau/seedrandom
  !function(f,a,c){var s,l=256,p="random",d=c.pow(l,6),g=c.pow(2,52),y=2*g,h=l-1;function n(n,t,r){function e(){for(var n=u.g(6),t=d,r=0;n<g;)n=(n+r)*l,t*=l,r=u.g(1);for(;y<=n;)n/=2,t/=2,r>>>=1;return(n+r)/t}var o=[],i=j(function n(t,r){var e,o=[],i=typeof t;if(r&&"object"==i)for(e in t)try{o.push(n(t[e],r-1))}catch(n){}return o.length?o:"string"==i?t:t+"\0"}((t=1==t?{entropy:!0}:t||{}).entropy?[n,S(a)]:null==n?function(){try{var n;return s&&(n=s.randomBytes)?n=n(l):(n=new Uint8Array(l),(f.crypto||f.msCrypto).getRandomValues(n)),S(n)}catch(n){var t=f.navigator,r=t&&t.plugins;return[+new Date,f,r,f.screen,S(a)]}}():n,3),o),u=new m(o);return e.int32=function(){return 0|u.g(4)},e.quick=function(){return u.g(4)/4294967296},e.double=e,j(S(u.S),a),(t.pass||r||function(n,t,r,e){return e&&(e.S&&v(e,u),n.state=function(){return v(u,{})}),r?(c[p]=n,t):n})(e,i,"global"in t?t.global:this==c,t.state)}function m(n){var t,r=n.length,u=this,e=0,o=u.i=u.j=0,i=u.S=[];for(r||(n=[r++]);e<l;)i[e]=e++;for(e=0;e<l;e++)i[e]=i[o=h&o+n[e%r]+(t=i[e])],i[o]=t;(u.g=function(n){for(var t,r=0,e=u.i,o=u.j,i=u.S;n--;)t=i[e=h&e+1],r=r*l+i[h&(i[e]=i[o=h&o+t])+(i[o]=t)];return u.i=e,u.j=o,r})(l)}function v(n,t){return t.i=n.i,t.j=n.j,t.S=n.S.slice(),t}function j(n,t){for(var r,e=n+"",o=0;o<e.length;)t[h&o]=h&(r^=19*t[h&o])+e.charCodeAt(o++);return S(t)}function S(n){return String.fromCharCode.apply(0,n)}if(j(c.random(),a),"object"==typeof module&&module.exports){module.exports=n;try{s=require("crypto")}catch(n){}}else"function"==typeof define&&define.amd?define(function(){return n}):c["seed"+p]=n}("undefined"!=typeof self?self:this,[],Math);