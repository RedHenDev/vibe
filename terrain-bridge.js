// Terrain Bridge Module
// This module maintains backward compatibility with the original terrain-generator
// while using the new pooled-terrain-generator under the hood for better performance

// Register a compatibility layer that forwards to the pooled implementation
AFRAME.registerComponent('terrain-generator', {
  schema: {
    chunk: {type: 'vec2'} // Keep original schema for compatibility
  },

  init: function() {
    console.log('Using optimized pooled terrain generator');
    
    // Create the actual pooled terrain generator entity if not already present
    let pooledTerrain = document.querySelector('#pooled-terrain');
    
    if (!pooledTerrain) {
      pooledTerrain = document.createElement('a-entity');
      pooledTerrain.setAttribute('id', 'pooled-terrain');
      pooledTerrain.setAttribute('pooled-terrain-generator', {
        // Configure based on device capabilities
        poolSize: this.detectDeviceCapabilities(),
        chunksToRender: this.detectIdealChunkCount()
      });
      
      this.el.sceneEl.appendChild(pooledTerrain);
    }
    
    // Store a reference to the pooled terrain component
    this.pooledTerrainComp = pooledTerrain.components['pooled-terrain-generator'];
    
    // Forward any existing chunk-generated events
    pooledTerrain.addEventListener('chunk-generated', (event) => {
      this.el.dispatchEvent(new CustomEvent('chunk-generated', {
        detail: event.detail
      }));
    });
    
    // Track if the original component had any custom event listeners
    this.originalEventListeners = {};
  },
  
  // Auto-detect device capabilities to set appropriate poolSize
  detectDeviceCapabilities: function() {
    // Check if this is a mobile device
    const isMobile = AFRAME.utils.device.isMobile();
    
    // Check memory constraints (rough estimate)
    const memory = navigator.deviceMemory || 4; // Default to 4GB if not available
    
    // Check for WebGL2 support
    const hasWebGL2 = (function() {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGL2RenderingContext && 
                 canvas.getContext('webgl2'));
      } catch(e) {
        return false;
      }
    })();
    
    // Determine pool size based on device capabilities
    if (isMobile) {
      return memory <= 2 ? 24 : 36; // Smaller pool for mobile
    } else {
      return hasWebGL2 ? 49 : 36; // Larger pool for desktop with WebGL2
    }
  },
  
  // Determine ideal chunk count based on device
  detectIdealChunkCount: function() {
    const isMobile = AFRAME.utils.device.isMobile();
    
    if (isMobile) {
      // Mobile devices show fewer chunks
      return 9; // 3x3 grid around player
    } else {
      // Desktop can handle more
      return 25; // 5x5 grid around player
    }
  },
  
  // Forward method calls to the pooled terrain generator
  generateChunk: function(x, z) {
    if (this.pooledTerrainComp) {
      // Not needed - the pooled system manages chunks automatically
      console.log(`Forwarding generateChunk request for ${x},${z} to pooled system`);
    }
  },
  
  // Proxy the remove method
  remove: function() {
    // Nothing to do - the pooled system handles cleanup
  },
  
  // Forward event listeners
  addEventListener: function(eventName, callback) {
    if (!this.originalEventListeners[eventName]) {
      this.originalEventListeners[eventName] = [];
    }
    this.originalEventListeners[eventName].push(callback);
    this.el.addEventListener(eventName, callback);
  },
  
  // Remove event listeners
  removeEventListener: function(eventName, callback) {
    if (this.originalEventListeners[eventName]) {
      const index = this.originalEventListeners[eventName].indexOf(callback);
      if (index !== -1) {
        this.originalEventListeners[eventName].splice(index, 1);
      }
    }
    this.el.removeEventListener(eventName, callback);
  }
});

// Add performance optimizations for terrain height calculation
(function optimizeTerrainFunctions() {
  // Only run this if getTerrainHeight exists
  if (typeof getTerrainHeight !== 'function') return;
  
  // Create a cache for terrain height calculations
  const heightCache = new Map();
  const cacheSize = 10000; // Maximum cache entries
  
  // The original getTerrainHeight function
  const originalGetTerrainHeight = getTerrainHeight;
  
  // Replace with a cached version
  window.getTerrainHeight = function(x, z) {
    // Round coordinates to reduce cache size and improve hit rate
    // Precision of 0.5 units is typically good enough for terrain
    const roundedX = Math.round(x * 2) / 2;
    const roundedZ = Math.round(z * 2) / 2;
    
    const key = `${roundedX},${roundedZ}`;
    
    // Check cache first
    if (heightCache.has(key)) {
      return heightCache.get(key);
    }
    
    // Calculate terrain height
    const height = originalGetTerrainHeight(roundedX, roundedZ);
    
    // Store in cache
    if (heightCache.size < cacheSize) {
      heightCache.set(key, height);
    } else {
      // Simple cache eviction - delete a random entry
      // In practice, a least-recently-used (LRU) approach would be better
      const keys = Array.from(heightCache.keys());
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      heightCache.delete(randomKey);
      heightCache.set(key, height);
    }
    
    return height;
  };
  
  // Cache terrain colors as well
  if (typeof getTerrainColor === 'function') {
    const colorCache = new Map();
    const originalGetTerrainColor = getTerrainColor;
    
    window.getTerrainColor = function(height) {
      // Round height to the nearest 0.5 for better cache hits
      const roundedHeight = Math.round(height * 2) / 2;
      
      if (colorCache.has(roundedHeight)) {
        return colorCache.get(roundedHeight);
      }
      
      const color = originalGetTerrainColor(roundedHeight);
      
      if (colorCache.size < 200) { // Colors have a small range, so small cache is fine
        colorCache.set(roundedHeight, color);
      }
      
      return color;
    };
  }
  
  console.log('Terrain function optimizations applied');
})();

// Apply Perlin noise optimizations if possible
(function optimizeNoise() {
  if (typeof noise !== 'object' || !noise.noise) return;
  
  // Cache for noise calculations
  const noiseCache = new Map();
  const cacheSize = 5000;
  
  // Original noise function
  const originalNoise = noise.noise;
  
  // Replace with cached version
  noise.noise = function(x, y, z) {
    // Round coordinates slightly for better cache hits
    const rx = Math.round(x * 100) / 100;
    const ry = Math.round(y * 100) / 100;
    const rz = Math.round(z * 100) / 100;
    
    const key = `${rx},${ry},${rz}`;
    
    if (noiseCache.has(key)) {
      return noiseCache.get(key);
    }
    
    const value = originalNoise.call(noise, rx, ry, rz);
    
    if (noiseCache.size < cacheSize) {
      noiseCache.set(key, value);
    } else {
      // Simple LRU-like approach
      const keys = Array.from(noiseCache.keys());
      const oldestKey = keys[0];
      noiseCache.delete(oldestKey);
      noiseCache.set(key, value);
    }
    
    return value;
  };
  
  console.log('Perlin noise optimizations applied');
})();
