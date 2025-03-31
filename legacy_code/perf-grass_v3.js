// Enhanced Grass System for Eigengrau Light
// Combines GPU instancing with custom shaders for dramatically improved performance and visual quality

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const grassSystemEntity = document.createElement('a-entity');
        grassSystemEntity.setAttribute('id', 'whitman');
        grassSystemEntity.setAttribute('enhanced-grass-system', '');
        scene.appendChild(grassSystemEntity);
        console.log('Enhanced verdant grass system initialized');
      });
    }
  });
  
  AFRAME.registerComponent('enhanced-grass-system', {
    schema: {
      chunkSize: { type: 'number', default: 64 },          // Size of each chunk in meters
      renderDistance: { type: 'number', default: 128 },     // Max distance to render grass
      instancesPerChunk: { type: 'number', default: 12000 }, // Significant increase in density
      updateThreshold: { type: 'number', default: 32 },     // Distance player must move to trigger update
      minHeight: { type: 'number', default: 1.0 },          // Minimum grass height
      maxHeight: { type: 'number', default: 2.5 },          // Maximum grass height
      dayColor: { type: 'color', default: '#00DD00' },      // Day grass color
      nightColor: { type: 'color', default: '#16161D' },    // Night grass color
      baseColor: { type: 'color', default: '#00DD00' },     // Current color (changes with day/night)
      chunksPerFrame: { type: 'number', default: 1 },       // Chunks to generate per frame
      colorVariation: { type: 'number', default: 0.2 },     // Color variation amount (0-1)
      isNightMode: { type: 'boolean', default: false },     // Track day/night state
      windEffect: { type: 'boolean', default: true },       // Enable wind animation
      windStrength: { type: 'number', default: 0.2 },       // Wind animation strength
      windFrequency: { type: 'number', default: 0.3 },      // Wind animation frequency
      lod: { type: 'boolean', default: true },              // Enable level of detail
      bladeWidth: { type: 'number', default: 0.3 },         // Width of grass blades
      bladeCurve: { type: 'number', default: 0.3 }          // Curvature of grass blades (0-1)
    },
  
    init: function () {
      // Map to store active chunks
      this.chunks = new Map();
      
      // Track last update position
      this.lastUpdatePosition = new THREE.Vector3();
      
      // Queue for gradual chunk loading
      this.chunkQueue = [];
      this.isProcessingQueue = false;
      
      // Convert base color to vector for manipulation
      this.baseColorVector = new THREE.Color(this.data.baseColor);
      
      // Access getHeight function
      this.getHeight = getTerrainHeight;
      
      // Get player reference
      this.player = this.el.sceneEl.querySelector('#player').object3D;
      
      // Make grass system accessible to other components
      window.grassSystem = this;
      
      // Initialize custom shader material for grass
      this.initCustomMaterial();
      
      // Create vertex templates and geometries
      this.createTemplates();
      
      // Initialize chunks around player
      if (this.player) {
        this.queueInitialChunks();
        this.lastUpdatePosition.copy(this.player.position);
        console.log('Enhanced grass system initialized, chunks queued for loading');
      }
      
      // Set up global uniforms for wind animation
      this.setupGlobalUniforms();
      
      // Set up animation loop for wind effect
      if (this.data.windEffect) {
        this.startWindAnimation();
      }
    },
    
    // Deterministic random number generator that doesn't rely on external libraries
    seededRandom: function(x, y, z = 0) {
      // Simple but effective hash function
      const hash = x * 12.9898 + y * 78.233 + z * 43.7234;
      return (Math.sin(hash) * 43758.5453) % 1;
    },
    
    // Get multiple random values from a seed
    getRandoms: function(seed, count) {
      const randoms = [];
      for (let i = 0; i < count; i++) {
        randoms.push(this.seededRandom(seed, i, 0.5));
      }
      return randoms;
    },
    
    initCustomMaterial: function() {
      // Define custom vertex shader for grass with wind animation
      const vertexShader = `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        uniform float time;
        uniform float windStrength;
        uniform float windFrequency;
        
        attribute vec3 color;
        attribute float grassHeight;
        
        void main() {
          vColor = color;
          vNormal = normal;
          
          // Calculate position with wind effect
          vec3 pos = position;
          
          // Add wind effect - more at the top of the blade, less at the bottom
          float windFactor = pos.y * windStrength;
          
          // Wind varies with position and time
          float windX = sin(pos.x * 0.05 + pos.z * 0.05 + time * windFrequency) * windFactor;
          float windZ = cos(pos.x * 0.05 - pos.z * 0.05 + time * windFrequency * 0.7) * windFactor;
          
          // Apply wind displacement
          pos.x += windX;
          pos.z += windZ;
          
          // Pass position to fragment shader
          vPosition = pos;
          
          // Transform vertex
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `;
      
      // Define custom fragment shader for grass with enhanced shading
      const fragmentShader = `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        uniform vec3 lightDirection;
        
        void main() {
          // Calculate simple diffuse lighting
          float lightIntensity = max(0.7, dot(normalize(vNormal), normalize(lightDirection)));
          
          // Add subtle height-based shading for depth
          float heightFactor = clamp(vPosition.y * 0.1, 0.0, 0.3);
          
          // Combine lighting effects
          vec3 litColor = vColor * (lightIntensity + heightFactor);
          
          // Add subtle ambient occlusion at the base
          float ao = mix(0.7, 1.0, smoothstep(0.0, 0.5, vPosition.y));
          litColor *= ao;
          
          gl_FragColor = vec4(litColor, 1.0);
          
          // Add fog if needed
          #ifdef USE_FOG
            float depth = gl_FragCoord.z / gl_FragCoord.w;
            float fogFactor = smoothstep(fogNear, fogFar, depth);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
          #endif
        }
      `;
      
      // Create material with custom shaders
      this.customGrassMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
          time: { value: 0.0 },
          windStrength: { value: this.data.windStrength },
          windFrequency: { value: this.data.windFrequency },
          lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() }
        },
        side: THREE.DoubleSide,
        vertexColors: true,
        fog: true,
        defines: {
          USE_FOG: ''
        }
      });
    },
    
    createTemplates: function() {
      // Create optimized, curved blade geometry for individual grass blades
      this.createGrassBladeGeometry();
      
      // Create compressed, low-poly geometry for distant chunks
      this.createLODGeometries();
    },
    
    createGrassBladeGeometry: function() {
      // Create an optimized grass blade geometry with a natural curve
      const bladeWidth = this.data.bladeWidth;
      const bladeHeight = 1.0; // Unit height, will be scaled per instance
      const segments = 4; // Vertical segments for blade
      
      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];
      
      // Create vertices for a curved blade
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const width = bladeWidth * (1.0 - t * 0.8); // Taper width toward top
        
        // Calculate curve using quadratic function
        const curve = this.data.bladeCurve * t * t;
        
        // Left vertex
        positions.push(-width/2, t * bladeHeight, curve);
        normals.push(0, 0, 1);
        uvs.push(0, t);
        
        // Right vertex
        positions.push(width/2, t * bladeHeight, curve);
        normals.push(0, 0, 1);
        uvs.push(1, t);
      }
      
      // Create faces from vertices
      for (let i = 0; i < segments; i++) {
        const base = i * 2;
        
        // Two triangles per segment
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
      
      // Create geometry and set attributes
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      
      // Store the geometry for instancing
      this.grassBladeGeometry = geometry;
    },
    
    createLODGeometries: function() {
      // Create different LOD versions for distance rendering
      this.lodGeometries = {
        // High detail: Individual blades
        high: this.grassBladeGeometry,
        
        // Medium detail: Simplified cross blades
        medium: this.createCrossGeometry(),
        
        // Low detail: Simple quad for far distance
        low: this.createSimpleQuadGeometry()
      };
    },
    
    createCrossGeometry: function() {
      // Create a cross-shaped geometry (two quads at 90 degrees) for medium distance
      const positions = [
        // First quad
        -0.2, 0, 0,   0.2, 0, 0,   -0.2, 1, 0.3,
        0.2, 0, 0,    0.2, 1, 0.3,  -0.2, 1, 0.3,
        
        // Second quad (rotated 90 degrees)
        0, 0, -0.2,   0, 0, 0.2,   0.3, 1, -0.2,
        0, 0, 0.2,    0.3, 1, 0.2,  0.3, 1, -0.2
      ];
      
      const normals = [
        // First quad
        0, 0, 1,   0, 0, 1,   0, 0, 1,
        0, 0, 1,   0, 0, 1,   0, 0, 1,
        
        // Second quad
        1, 0, 0,   1, 0, 0,   1, 0, 0,
        1, 0, 0,   1, 0, 0,   1, 0, 0
      ];
      
      const uvs = [
        // First quad
        0, 0,   1, 0,   0, 1,
        1, 0,   1, 1,   0, 1,
        
        // Second quad
        0, 0,   1, 0,   0, 1,
        1, 0,   1, 1,   0, 1
      ];
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      
      return geometry;
    },
    
    createSimpleQuadGeometry: function() {
      // Create a simple quad for very distant grass
      const positions = [
        -0.5, 0, 0,   0.5, 0, 0,   -0.5, 1, 0,
        0.5, 0, 0,    0.5, 1, 0,   -0.5, 1, 0
      ];
      
      const normals = [
        0, 0, 1,   0, 0, 1,   0, 0, 1,
        0, 0, 1,   0, 0, 1,   0, 0, 1
      ];
      
      const uvs = [
        0, 0,   1, 0,   0, 1,
        1, 0,   1, 1,   0, 1
      ];
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      
      return geometry;
    },
    
    setupGlobalUniforms: function() {
      // Set up global uniforms for animation and lighting
      this.globalUniforms = {
        time: { value: 0 },
        lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() }
      };
    },
    
    startWindAnimation: function() {
      // Start animation loop for wind effect
      const animate = () => {
        // Update time uniform for all grass materials
        const time = performance.now() * 0.001;
        this.customGrassMaterial.uniforms.time.value = time;
        
        // Update for each active chunk
        for (const [key, chunk] of this.chunks.entries()) {
          if (chunk.instancedMesh && chunk.instancedMesh.material.uniforms) {
            chunk.instancedMesh.material.uniforms.time.value = time;
          }
        }
        
        // Continue animation loop
        requestAnimationFrame(animate);
      };
      
      // Start animation
      animate();
    },
    
    // Add methods to change grass colors for day/night cycle
    setNightMode: function() {
      if (this.data.isNightMode) return; // Already in night mode
      
      this.data.isNightMode = true;
      this.data.baseColor = this.data.nightColor;
      this.baseColorVector = new THREE.Color(this.data.baseColor);
      
      // Update existing grass chunks
      this.updateExistingGrassColors();
      
      // Reduce wind strength at night
      this.customGrassMaterial.uniforms.windStrength.value = this.data.windStrength * 0.5;
    },
    
    setDayMode: function() {
      if (!this.data.isNightMode) return; // Already in day mode
      
      this.data.isNightMode = false;
      this.data.baseColor = this.data.dayColor;
      this.baseColorVector = new THREE.Color(this.data.baseColor);
      
      // Update existing grass chunks
      this.updateExistingGrassColors();
      
      // Restore normal wind strength
      this.customGrassMaterial.uniforms.windStrength.value = this.data.windStrength;
    },
    
    updateExistingGrassColors: function() {
      // For each existing chunk, update instance colors
      for (const [key, chunk] of this.chunks.entries()) {
        if (chunk.instancedMesh && chunk.instanceColors) {
          // Update color attribute if available
          const colorAttribute = chunk.instancedMesh.geometry.getAttribute('color');
          if (colorAttribute && colorAttribute.array) {
            
            // Recreate color array with new base color
            for (let i = 0; i < chunk.positions.length; i++) {
              const pos = chunk.positions[i];
              const y = pos.y;
              
              // Calculate new color based on height and terrain
              const terrainFactor = Math.max(0, Math.min(1, (y + 20) / 60));
              const variationFactor = chunk.colorVariations[i];
              
              // Create the new color
              const color = this.baseColorVector.clone();
              
              // Apply variation while preserving color identity
              color.r = Math.max(0, Math.min(1, color.r * (0.8 + terrainFactor * 0.4 + variationFactor)));
              color.g = Math.max(0, Math.min(1, color.g * (0.8 + terrainFactor * 0.4 + variationFactor)));
              color.b = Math.max(0, Math.min(1, color.b * (0.8 + terrainFactor * 0.3 + variationFactor)));
              
              // Update color in the attribute array
              const idx = i * 3;
              colorAttribute.array[idx] = color.r;
              colorAttribute.array[idx + 1] = color.g;
              colorAttribute.array[idx + 2] = color.b;
            }
            
            // Mark attribute as needing update
            colorAttribute.needsUpdate = true;
          }
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
      
      // Update LOD levels based on distance
      if (this.data.lod) {
        this.updateLODLevels(playerPosition);
      }
    },
    
    updateLODLevels: function(playerPosition) {
      // Update LOD levels for chunks based on distance from player
      for (const [key, chunk] of this.chunks.entries()) {
        if (!chunk.instancedMesh) continue;
        
        // Calculate chunk center position
        const [chunkX, chunkZ] = key.split(',').map(Number);
        const chunkCenterX = chunkX * this.data.chunkSize + this.data.chunkSize / 2;
        const chunkCenterZ = chunkZ * this.data.chunkSize + this.data.chunkSize / 2;
        
        // Calculate distance to chunk center
        const dx = chunkCenterX - playerPosition.x;
        const dz = chunkCenterZ - playerPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Determine appropriate LOD level
        let lodLevel = 'high';
        if (distance > this.data.renderDistance * 0.7) {
          lodLevel = 'low';
        } else if (distance > this.data.renderDistance * 0.4) {
          lodLevel = 'medium';
        }
        
        // If LOD level has changed, update the geometry
        if (chunk.currentLOD !== lodLevel) {
          this.updateChunkLOD(chunk, lodLevel);
          chunk.currentLOD = lodLevel;
        }
      }
    },
    
    updateChunkLOD: function(chunk, lodLevel) {
      // Skip if not using LOD or if the mesh isn't available
      if (!this.data.lod || !chunk.instancedMesh) return;
      
      // Get appropriate geometry for this LOD level
      const newGeometry = this.lodGeometries[lodLevel];
      if (!newGeometry) return;
      
      // Store current transforms
      const transforms = [];
      const dummy = new THREE.Object3D();
      
      for (let i = 0; i < chunk.instancedMesh.count; i++) {
        chunk.instancedMesh.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        transforms.push({
          position: dummy.position.clone(),
          quaternion: dummy.quaternion.clone(),
          scale: dummy.scale.clone()
        });
      }
      
      // Get current color attribute
      const colorAttribute = chunk.instancedMesh.geometry.getAttribute('color');
      const colorArray = colorAttribute ? colorAttribute.array : null;
      
      // Create new instanced mesh with the new geometry
      const newMesh = new THREE.InstancedMesh(
        newGeometry,
        chunk.instancedMesh.material,
        chunk.instancedMesh.count
      );
      
      // Apply stored transforms
      for (let i = 0; i < transforms.length; i++) {
        const transform = transforms[i];
        dummy.position.copy(transform.position);
        dummy.quaternion.copy(transform.quaternion);
        dummy.scale.copy(transform.scale);
        dummy.updateMatrix();
        newMesh.setMatrixAt(i, dummy.matrix);
      }
      
      // Apply colors if available
      if (colorArray) {
        // Create a properly sized color buffer for the new geometry
        const newColorArray = new Float32Array(chunk.instancedMesh.count * 3);
        
        // Copy colors from old mesh to new mesh
        for (let i = 0; i < chunk.instancedMesh.count * 3; i++) {
          newColorArray[i] = colorArray[i];
        }
        
        // Set the color attribute on the new geometry
        newMesh.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(newColorArray, 3));
      }
      
      // Update instance matrix
      newMesh.instanceMatrix.needsUpdate = true;
      
      // Switch out the old mesh for the new one
      this.el.sceneEl.object3D.remove(chunk.instancedMesh);
      this.el.sceneEl.object3D.add(newMesh);
      
      // Store the new mesh
      chunk.instancedMesh = newMesh;
    },
    
    generateChunk: function (i, j) {
      const chunkSize = this.data.chunkSize;
      const instances = this.data.instancesPerChunk;
      
      // Storage for instance data
      const positions = [];
      const rotations = [];
      const scales = [];
      const colors = [];
      const colorVariations = [];
      
      // Generate deterministic random values for this chunk
      const seed = i * 1000 + j;
      const randomsX = [];
      const randomsZ = [];
      const randomsRot = [];
      const randomsHeight = [];
      const randomsWidth = [];
      const randomsColor = [];
      
      // Pre-generate random values for better performance
      for (let k = 0; k < instances; k++) {
        randomsX.push(this.seededRandom(seed, k, 0));
        randomsZ.push(this.seededRandom(seed, k, 1));
        randomsRot.push(this.seededRandom(seed, k, 2) * Math.PI * 2);
        randomsHeight.push(this.data.minHeight + this.seededRandom(seed, k, 3) * 
                          (this.data.maxHeight - this.data.minHeight));
        randomsWidth.push(0.8 + this.seededRandom(seed, k, 4) * 0.4);
        randomsColor.push(this.seededRandom(seed, k, 5) * this.data.colorVariation * 2 - 
                          this.data.colorVariation);
      }
      
      // Helper function to get a value from the pre-generated random arrays
      const getRandom = (index, type) => {
        switch(type) {
          case 'x': return randomsX[index % randomsX.length];
          case 'z': return randomsZ[index % randomsZ.length];
          case 'rot': return randomsRot[index % randomsRot.length];
          case 'height': return randomsHeight[index % randomsHeight.length];
          case 'width': return randomsWidth[index % randomsWidth.length];
          case 'color': return randomsColor[index % randomsColor.length];
          default: return 0;
        }
      };
      
      // Color variation parameter
      const colorVariation = this.data.colorVariation;
      
      // Generate grass instances
      for (let k = 0; k < instances; k++) {
        // Calculate world position with slight randomness for natural distribution
        const xOffset = getRandom(k, 'x');
        const zOffset = getRandom(k, 'z');
        
        const x = (i + xOffset) * chunkSize;
        const z = (j + zOffset) * chunkSize;
        
        // Get terrain height at this position
        const y = this.getHeight(x, z);
        
        // Skip if underwater or on steep slopes
        if (y < -11) {
          if (getRandom(k + instances, 'x') > 0.2) {
            continue;
          }
        }
        
        // Improve coverage by using randomized clusters
        if (k % 5 !== 0) {
          // For 4 out of 5 blades, cluster around the last blade
          const lastIndex = positions.length - 1;
          if (lastIndex >= 0) {
            const lastPos = positions[lastIndex];
            const clusterRadius = 0.8;
            
            // Calculate position within cluster radius
            const angle = getRandom(k * 3 + 7, 'rot');
            const radius = getRandom(k * 5 + 11, 'x') * clusterRadius;
            
            const clusterX = lastPos.x + Math.cos(angle) * radius;
            const clusterZ = lastPos.z + Math.sin(angle) * radius;
            
            // Get height at this new position
            const clusterY = this.getHeight(clusterX, clusterZ);
            
            // Skip if underwater
            if (clusterY < -11 && getRandom(k + instances * 2, 'x') > 0.2) {
              continue;
            }
            
            // Add position
            positions.push(new THREE.Vector3(clusterX, clusterY, clusterZ));
          } else {
            positions.push(new THREE.Vector3(x, y, z));
          }
        } else {
          // Every 5th blade uses a completely new position
          positions.push(new THREE.Vector3(x, y, z));
        }
        
        // Random rotation around Y axis
        rotations.push(getRandom(k, 'rot'));
        
        // Randomize height and width for variety
        const heightScale = getRandom(k, 'height');
        const widthScale = getRandom(k, 'width');
        
        scales.push(new THREE.Vector3(widthScale, heightScale, widthScale));
        
        // Vary color based on terrain height and random variation
        const terrainFactor = Math.max(0, Math.min(1, (y + 20) / 60));
        const random = getRandom(k, 'color');
        
        // Store random variation for later adjustments
        colorVariations.push(random);
        
        // Create color with variation
        const color = this.baseColorVector.clone();
        
        // Allow more variation near water for reeds
        const nearWater = y < -5;
        const waterVariation = nearWater ? 0.5 : 0.0;
        
        // Apply color adjustments
        color.r = Math.max(0, Math.min(1, color.r * (0.8 + terrainFactor * 0.4 + random - waterVariation)));
        color.g = Math.max(0, Math.min(1, color.g * (0.8 + terrainFactor * 0.4 + random)));
        color.b = Math.max(0, Math.min(1, color.b * (0.8 + terrainFactor * 0.3 + random - waterVariation * 0.5)));
        
        colors.push(color);
      }
      
      // Skip if no valid grass positions found
      if (positions.length === 0) {
        return;
      }
      
      // Choose appropriate LOD level based on distance from player
      let lodLevel = 'high';
      const playerPosition = this.player.position;
      
      // Calculate chunk center position
      const chunkCenterX = i * this.data.chunkSize + this.data.chunkSize / 2;
      const chunkCenterZ = j * this.data.chunkSize + this.data.chunkSize / 2;
      
      // Calculate distance to player
      const dx = chunkCenterX - playerPosition.x;
      const dz = chunkCenterZ - playerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      // Determine appropriate LOD level based on distance
      if (distance > this.data.renderDistance * 0.7) {
        lodLevel = 'low';
      } else if (distance > this.data.renderDistance * 0.4) {
        lodLevel = 'medium';
      }
      
      // Create a clone of our material with custom shader
      const grassMaterial = this.customGrassMaterial.clone();
      
      // Create instanced mesh with the appropriate LOD geometry
      const instancedMesh = new THREE.InstancedMesh(
        this.lodGeometries[lodLevel],
        grassMaterial,
        positions.length
      );
      
      // Create matrix for calculating grass blade transforms
      const matrix = new THREE.Matrix4();
      const dummy = new THREE.Object3D();
      
      // Create instance color and height attributes
      const colorAttribute = new THREE.InstancedBufferAttribute(
        new Float32Array(positions.length * 3),
        3
      );
      
      // Set the position, rotation, and scale of each grass blade
      for (let k = 0; k < positions.length; k++) {
        const position = positions[k];
        const rotation = rotations[k];
        const scale = scales[k];
        const color = colors[k];
        
        // Position grass blade
        dummy.position.copy(position);
        
        // Align to terrain normal (approximately)
        // This makes grass perpendicular to the ground
        dummy.lookAt(position.x, position.y + 1, position.z);
        
        // Apply Y-axis rotation for variety
        dummy.rotateY(rotation);
        
        // Apply scale
        dummy.scale.copy(scale);
        
        // Update matrix
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(k, dummy.matrix);
        
        // Set color
        colorAttribute.setXYZ(k, color.r, color.g, color.b);
      }
      
      // Update the instance matrices and colors
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.geometry.setAttribute('color', colorAttribute);
      
      // Optimize for static position (improves performance)
      instancedMesh.frustumCulled = true;
      
      // Add to scene
      this.el.sceneEl.object3D.add(instancedMesh);
      
      // Store in chunks map
      this.chunks.set(`${i},${j}`, {
        instancedMesh,
        positions,
        rotations,
        scales,
        colors,
        colorVariations,
        currentLOD: lodLevel
      });
      
      // Animate in with a gentle fade
      grassMaterial.transparent = true;
      grassMaterial.opacity = 0;
      this.animateChunkIn(instancedMesh);
    },
    
    animateChunkIn: function(mesh) {
      // Gentle fade-in animation for grass chunks
      let opacity = 0;
      
      function animate() {
        opacity += 0.05;
        mesh.material.opacity = Math.min(1, opacity);
        
        if (opacity < 1) {
          requestAnimationFrame(animate);
        } else {
          // Once fully faded in, optimize by disabling transparency
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
      // Enable transparency for fade-out
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
        // Remove from scene
        this.el.sceneEl.object3D.remove(chunk.instancedMesh);
        
        // Proper cleanup to avoid memory leaks
        chunk.instancedMesh.geometry.dispose();
        chunk.instancedMesh.material.dispose();
        
        // Remove from map
        this.chunks.delete(key);
      }
    },
    
    remove: function () {
      // Clean up all chunks and resources
      this.chunkQueue = [];
      this.isProcessingQueue = false;
      
      // Remove all chunks
      for (const key of this.chunks.keys()) {
        this.finalizeChunkRemoval(key);
      }
      
      // Dispose of template geometries
      if (this.grassBladeGeometry) {
        this.grassBladeGeometry.dispose();
      }
      
      // Dispose of LOD geometries
      if (this.lodGeometries) {
        for (const key in this.lodGeometries) {
          if (this.lodGeometries[key]) {
            this.lodGeometries[key].dispose();
          }
        }
      }
      
      // Dispose of materials
      if (this.customGrassMaterial) {
        this.customGrassMaterial.dispose();
      }
      
      // Remove global reference
      delete window.grassSystem;
    }
  });