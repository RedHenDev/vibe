// Terrain Shader and Rendering Optimizations
// This script improves GPU performance by optimizing materials and applying frustum culling

(function() {
  // Ensure dependencies are available
  if (!window.THREE) {
    console.warn('THREE.js not found, shader optimizations will not be applied');
    return;
  }
  
  // Optimization configuration
  const config = {
    enableFrustumCulling: true,     // Enable frustum culling for chunks
    optimizeMaterials: true,        // Use optimized shader materials
    mergeMaterialsWhenPossible: true, // Reduce material count
    enableLOD: true,                // Enable level of detail
    disableVsync: false,            // Disable vsync for maximum frame rate (can cause tearing)
    cacheTerrainColor: true,        // Cache terrain color calculations
    cacheTerrainHeight: true        // Cache terrain height calculations
  };
  
  // Create a specialized, more performant material for terrain
  function createOptimizedTerrainMaterial() {
    // We'll create a custom ShaderMaterial for better performance
    // This reduces shader complexity by removing unnecessary features
    
    // Vertex shader
    const vertexShader = `
      varying vec3 vColor;
      
      #ifdef USE_COLOR
        attribute vec3 color;
      #endif
      
      void main() {
        // Pass the color to the fragment shader
        #ifdef USE_COLOR
          vColor = color;
        #endif
        
        // Transform the vertex
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    // Fragment shader
    const fragmentShader = `
      varying vec3 vColor;
      
      void main() {
        // Apply the color
        gl_FragColor = vec4(vColor, 1.0);
        
        // Apply fog if needed
        #ifdef USE_FOG
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          float fogFactor = smoothstep(fogNear, fogFar, depth);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
        #endif
      }
    `;
    
    // Create the material
    const material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      vertexColors: true,
      fog: true, // Enable fog
      transparent: false,
      defines: {
        USE_COLOR: '',
        USE_FOG: ''
      }
    });
    
    return material;
  }
  
  // Cache for terrain colors
  const terrainColorCache = new Map();
  
  // Optimized terrain color function
  function getOptimizedTerrainColor(height) {
    // Round height to reduce cache misses
    const roundedHeight = Math.round(height * 2) / 2;
    
    // Check cache
    if (terrainColorCache.has(roundedHeight)) {
      return terrainColorCache.get(roundedHeight);
    }
    
    // Call original function
    const color = window.getTerrainColor(roundedHeight);
    
    // Cache the result
    if (terrainColorCache.size < 200) { // Terrain colors have a fixed range
      terrainColorCache.set(roundedHeight, color);
    }
    
    return color;
  }
  
  // Cache for terrain height
  const terrainHeightCache = new Map();
  const MAX_HEIGHT_CACHE_SIZE = 10000;
  
  // Optimized terrain height function
  function getOptimizedTerrainHeight(x, z) {
    // Round coordinates to reduce cache misses while maintaining quality
    const roundedX = Math.round(x * 10) / 10;
    const roundedZ = Math.round(z * 10) / 10;
    
    const key = `${roundedX},${roundedZ}`;
    
    // Check cache
    if (terrainHeightCache.has(key)) {
      return terrainHeightCache.get(key);
    }
    
    // Call original function
    const height = window.getTerrainHeight(roundedX, roundedZ);
    
    // Cache the result
    if (terrainHeightCache.size < MAX_HEIGHT_CACHE_SIZE) {
      terrainHeightCache.set(key, height);
    } else {
      // Simple eviction strategy - delete a random entry
      const keys = Array.from(terrainHeightCache.keys());
      const randomIndex = Math.floor(Math.random() * keys.length);
      terrainHeightCache.delete(keys[randomIndex]);
      terrainHeightCache.set(key, height);
    }
    
    return height;
  }
  
  // Set up Level of Detail (LOD) for terrain
  function setupTerrainLOD(terrainEntity) {
    if (!terrainEntity) return;
    
    // Create high and low detail geometries
    const highDetailGeometry = new THREE.PlaneGeometry(1000, 1000, 100, 100);
    const mediumDetailGeometry = new THREE.PlaneGeometry(1000, 1000, 50, 50);
    const lowDetailGeometry = new THREE.PlaneGeometry(1000, 1000, 25, 25);
    
    // Create the LOD object
    const lod = new THREE.LOD();
    
    // Add levels
    lod.addLevel(new THREE.Mesh(highDetailGeometry, createOptimizedTerrainMaterial()), 0);
    lod.addLevel(new THREE.Mesh(mediumDetailGeometry, createOptimizedTerrainMaterial()), 300);
    lod.addLevel(new THREE.Mesh(lowDetailGeometry, createOptimizedTerrainMaterial()), 600);
    
    // Position the LOD object
    lod.position.set(0, 0, 0);
    
    // Add to terrain entity
    terrainEntity.object3D.add(lod);
    
    return lod;
  }
  
  // Apply material optimizations to the entire scene
  function optimizeSceneMaterials(scene) {
    if (!scene) return;
    
    // Shared material for terrain chunks
    const sharedTerrainMaterial = createOptimizedTerrainMaterial();
    
    // Track stats
    let materialCount = 0;
    let optimizedCount = 0;
    
    // Traverse the scene
    scene.traverse(function(object) {
      if (object.isMesh) {
        materialCount++;
        
        // Check if this is a terrain chunk
        const isTerrainChunk = object.parent && 
            (object.parent.id === 'pooled-terrain' || 
             object.parent.id === 'enhanced-terrain');
        
        if (isTerrainChunk) {
          // Apply shared material if configured to do so
          if (config.mergeMaterialsWhenPossible) {
            object.material = sharedTerrainMaterial;
          }
          // Otherwise optimize the existing material
          else if (config.optimizeMaterials) {
            // Apply optimization to individual material
            object.material.vertexColors = true;
            object.material.flatShading = true;
            object.material.needsUpdate = true;
            
            // Reduce material complexity
            object.material.roughness = 0.8;
            object.material.metalness = 0.1;
            object.material.fog = true;
          }
          
          // Enable frustum culling
          if (config.enableFrustumCulling) {
            object.frustumCulled = true;
          }
          
          optimizedCount++;
        }
      }
    });
    
    console.log(`Optimized ${optimizedCount} of ${materialCount} materials in the scene`);
  }
  
  // Apply renderer optimizations
  function optimizeRenderer(renderer) {
    if (!renderer) return;
    
    // Check for WebGL 2 support
    const isWebGL2 = renderer.capabilities.isWebGL2;
    
    // Apply optimizations
    if (isWebGL2) {
      renderer.precision = 'mediump'; // Use medium precision for better performance
    } else {
      renderer.precision = 'lowp'; // Use low precision for WebGL 1
    }
    
    // Disable vsync if configured
    if (config.disableVsync) {
      if (typeof renderer.setAnimationLoop === 'function') {
        const originalRaf = window.requestAnimationFrame;
        
        // Replace requestAnimationFrame with a version that doesn't sync to vsync
        window.requestAnimationFrame = function(callback) {
          setTimeout(callback, 0);
        };
        
        // Store the original for restoration if needed
        window.originalRequestAnimationFrame = originalRaf;
      }
    }
    
    // Set conservative shadow settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // Only update shadows when needed
    
    console.log(`Renderer optimized: ${isWebGL2 ? 'WebGL 2' : 'WebGL'} mode`);
  }
  
  // Apply Perlin noise optimizations
  function optimizePerlinNoise() {
    if (!window.noise || !window.noise.noise) return;
    
    // Cache Perlin noise results
    const noiseCache = new Map();
    const MAX_NOISE_CACHE_SIZE = 10000;
    
    // Store original function
    const originalNoise = window.noise.noise;
    
    // Replace with cached version
    window.noise.noise = function(x, y, z) {
      // Round inputs slightly to increase cache hits
      const rx = Math.round(x * 100) / 100;
      const ry = Math.round(y * 100) / 100;
      const rz = Math.round(z * 100) / 100;
      
      const key = `${rx},${ry},${rz}`;
      
      if (noiseCache.has(key)) {
        return noiseCache.get(key);
      }
      
      const value = originalNoise.call(window.noise, rx, ry, rz);
      
      if (noiseCache.size < MAX_NOISE_CACHE_SIZE) {
        noiseCache.set(key, value);
      } else {
        // Simple eviction
        const keys = Array.from(noiseCache.keys());
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        noiseCache.delete(randomKey);
        noiseCache.set(key, value);
      }
      
      return value;
    };
    
    console.log('Perlin noise function optimized');
  }
  
  // Apply all optimizations when the scene is loaded
  AFRAME.registerComponent('terrain-optimization-manager', {
    schema: {
      enabled: { type: 'boolean', default: true }
    },
    
    init: function() {
      if (!this.data.enabled) return;
      
      // Reference to the scene
      this.scene = this.el.sceneEl.object3D;
      
      // Reference to the renderer
      this.renderer = this.el.sceneEl.renderer;
      
      // Apply optimizations after scene has loaded
      this.el.sceneEl.addEventListener('loaded', () => {
        this.applyOptimizations();
      });
      
      // Periodically apply optimizations to catch newly created objects
      this.optimizationInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          this.applyOptimizations();
        }
      }, 10000); // Check every 10 seconds
    },
    
    applyOptimizations: function() {
      // Renderer optimizations
      optimizeRenderer(this.renderer);
      
      // Scene material optimizations
      optimizeSceneMaterials(this.scene);
      
      // Replace global functions with optimized versions
      if (config.cacheTerrainColor && window.getTerrainColor) {
        window.getTerrainColor = getOptimizedTerrainColor;
      }
      
      if (config.cacheTerrainHeight && window.getTerrainHeight) {
        window.getTerrainHeight = getOptimizedTerrainHeight;
      }
      
      // Perlin noise optimizations
      optimizePerlinNoise();
      
      console.log('Applied terrain shader and rendering optimizations');
    },
    
    remove: function() {
      // Clean up interval
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
        this.optimizationInterval = null;
      }
      
      // Restore original requestAnimationFrame if modified
      if (window.originalRequestAnimationFrame) {
        window.requestAnimationFrame = window.originalRequestAnimationFrame;
        delete window.originalRequestAnimationFrame;
      }
    }
  });
  
  // Add the optimization manager to the scene
  document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const optiEntity = document.createElement('a-entity');
        optiEntity.setAttribute('terrain-optimization-manager', '');
        scene.appendChild(optiEntity);
        console.log('Terrain optimization manager added to scene');
      });
    }
  });
})();
