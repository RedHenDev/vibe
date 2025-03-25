// terrain-worker.js - Web Worker for terrain computations
// This file should be placed in the same directory as other scripts

// Import the necessary noise functions
// We need to manually recreate the noise functions here since workers can't access the parent scope

// Perlin noise implementation for the worker
const noise = {
  p: new Uint8Array(512),
  permutation: [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180],
  
  init: function(seed) {
    for(let i=0; i < 256; i++) {
      this.p[i] = this.p[i + 256] = this.permutation[i] * (seed || 1);
    }
  },
  
  fade: function(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
  lerp: function(t, a, b) { return a + t * (b - a); },
  
  grad: function(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  },
  
  noise: function(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;

    return this.lerp(w,
      this.lerp(v,
        this.lerp(u,
          this.grad(this.p[AA], x, y, z),
          this.grad(this.p[BA], x-1, y, z)
        ),
        this.lerp(u,
          this.grad(this.p[AB], x, y-1, z),
          this.grad(this.p[BB], x-1, y-1, z)
        )
      ),
      this.lerp(v,
        this.lerp(u,
          this.grad(this.p[AA+1], x, y, z-1),
          this.grad(this.p[BA+1], x-1, y, z-1)
        ),
        this.lerp(u,
          this.grad(this.p[AB+1], x, y-1, z-1),
          this.grad(this.p[BB+1], x-1, y-1, z-1)
        )
      )
    );
  }
};

// Helper functions needed for terrain computation
function getSeed(seedWord) {
  if (!seedWord) return 1;
  let hash = 5381;
  for (let i = 0; i < seedWord.length; i++) {
    hash = ((hash << 5) + hash) + seedWord.charCodeAt(i);
  }
  if (hash == NaN || hash === 5381) return 1;
  return hash >>> 0;
}

// World seed is 1 by default
let worldSeed = 1;

// Implementation of terrain height calculation
function getTerrainHeight(x, z) {
  // Default 0.05.
  const xCoord = x * 0.05;
  const zCoord = z * 0.05;
  
  // Base terrain with multiple layers
  let height = 0;

  const gSpread2 = 0.001;
  height += noise.noise(xCoord * 0.1 * gSpread2, 0, zCoord * 0.1 * gSpread2) * 2048;
  
  // General spread multiplier attempt. Default 1.
  const gSpread = 0.7;
  height += noise.noise(xCoord * 0.1 * gSpread, 0, zCoord * 0.1 * gSpread) * 64;
  
  // Medium features (hills)
  height += noise.noise(xCoord * 1 * gSpread, 0, zCoord * 1 * gSpread) * 12;
  
  // Small features (rough terrain)
  height += noise.noise(xCoord * 2 * gSpread, 0, zCoord * 2 * gSpread) * 6;
  
  // Micro features (texture)
  height += noise.noise(xCoord * 4 * gSpread, 0, zCoord * 4 * gSpread) * 3;
  
  // Mountain generation with more variation
  const mountainNoise = noise.noise(xCoord * 0.25 * gSpread, 0, zCoord * 0.25 * gSpread);
  if (mountainNoise > 0.5) {
    const mountainHeight = (mountainNoise - 0.5) * 2; // 0 to 1
    const mountainScale = 40 + noise.noise(xCoord * 0.1, 0, zCoord * 0.1) * 200;
    height += mountainHeight * mountainScale;
  }
  
  // Add plateaus.
  const plateauNoise = noise.noise(xCoord * 0.15 * gSpread, 0, zCoord * 0.15 * gSpread);
  if (plateauNoise > 0.7) {
    const plateauHeight = 15;
    const plateauBlend = (plateauNoise - 0.7) * 3.33; // 0 to 1
    height = height * (1 - plateauBlend) + plateauHeight * plateauBlend;
  }
  
  // Add valleys/canyons.
  const valleyNoise = noise.noise(xCoord * 0.2 * gSpread, 0, zCoord * 0.2 * gSpread);
  if (valleyNoise < 0.2) {
    const valleyDepth = -10;
    const valleyBlend = (0.2 - valleyNoise) * 5; // 0 to 1
    height *= (1 - valleyBlend * 0.8);
  }

  let biomes = true;
  let erosion = true;
  let ridges = true;
  
  // Add biomes.
  if (biomes) {
    height += getBiomeHeight(x, z, gSpread);
  }
  
  // Add ridges.
  if (ridges) {
    const ridgeNoise = getRidgeNoise(xCoord * 0.5, zCoord * 0.5);
    height += ridgeNoise * ridgeNoise * 12; // Square it for sharper ridges.
  }
  
  // Add erosion.
  if (erosion) {
    height += getErosionNoise(xCoord, zCoord);
  }
  
  return height;
}

// Helper function for biome calculations
function getBiomeHeight(x, z, gSpread) {
  const xCoord = x * 0.05 * gSpread;
  const zCoord = z * 0.05 * gSpread;
  
  // Biome selection.
  const biomeNoise = noise.noise(xCoord * 0.002, 0, zCoord * 0.002);
  
  let height = 0;
  
  // Default < 0.5.
  // Hills is 0.6.
  if (biomeNoise < 0.5) {
    // Plains biome
    height += noise.noise(xCoord * 1, 0, zCoord * 1) * 8;
    height += noise.noise(xCoord * 2, 0, zCoord * 2) * 4;
    
  } else if (biomeNoise < 0.6) {
    // Hills biome
    height += noise.noise(xCoord * 0.5, 0, zCoord * 0.5) * 20;
    height += noise.noise(xCoord * 1, 0, zCoord * 1) * 10;
    
  } else {
    // Mountains biome
    height += noise.noise(xCoord * 0.3, 0, zCoord * 0.3) * 35;
    height += noise.noise(xCoord * 0.8, 0, zCoord * 0.8) * 15;
    
    // Sharp peaks
    const peakNoise = noise.noise(xCoord * 1.5, 0, zCoord * 1.5);
    if (peakNoise > 0.7) {
      height += Math.pow(peakNoise - 0.7, 2) * 60;
    }
  }
  
  return height;
}

// Helper for ridge noise
function getRidgeNoise(x, z) {
  const n = noise.noise(x, 0, z);
  return 1 - Math.abs(n); // Creates sharp ridges
}

// Helper for erosion effects
function getErosionNoise(xCoord, zCoord) {
  // Erosion effect.
  const erosionNoise = noise.noise(xCoord * 3, 0, zCoord * 3);
  const slope = Math.abs(
    noise.noise(xCoord + 0.1, 0, zCoord) - 
    noise.noise(xCoord - 0.1, 0, zCoord)
  );
  
  // More erosion on steeper slopes.
  const erosionStrength = 16;
  if (slope > 0.2) {
    return -erosionNoise * slope * erosionStrength;
  } else return 0;
}

// Helper for terrain color
function getTerrainColor(height) {
  if (height < -11.5) return '#000F00';
  if (height < 0) return '#003200';     
  if (height < 5) return '#003900';     
  if (height < 10) return '#004400';    
  if (height < 30) return '#005800';    
  if (height < 50) return '#006500';    
  if (height < 70) return '#6B776B';    
  return '#FFFFFF';
}

// Cache for height calculations
const heightCache = new Map();
const colorCache = new Map();

// Initialize noise
noise.init(worldSeed);

// Listen for messages from the main thread
self.onmessage = function(e) {
  const data = e.data;
  
  switch(data.type) {
    case 'init':
      // Initialize noise with the provided seed
      worldSeed = getSeed(data.seed || '1');
      noise.init(worldSeed);
      self.postMessage({ type: 'initialized', seed: worldSeed });
      break;
      
    case 'generateChunk':
      // Generate terrain data for a chunk
      generateChunkData(data.chunkX, data.chunkZ, data.chunkSize, data.resolution);
      break;
      
    case 'calculateHeight':
      // Calculate height at a specific point
      const x = data.x;
      const z = data.z;
      
      // Check cache first
      const key = `${x},${z}`;
      let height;
      
      if (heightCache.has(key)) {
        height = heightCache.get(key);
      } else {
        height = getTerrainHeight(x, z);
        // Cache the result
        if (heightCache.size < 10000) {
          heightCache.set(key, height);
        }
      }
      
      self.postMessage({
        type: 'heightResult',
        id: data.id,
        x: x,
        z: z,
        height: height
      });
      break;
      
    case 'clearCache':
      // Clear caches to free memory
      heightCache.clear();
      colorCache.clear();
      self.postMessage({ type: 'cacheCleared' });
      break;
  }
};

// Generate terrain data for a chunk
function generateChunkData(chunkX, chunkZ, chunkSize, resolution) {
  const startTime = performance.now();
  
  // Calculate world offset
  const offsetX = chunkX * chunkSize;
  const offsetZ = chunkZ * chunkSize;
  
  // Vertices per row/column
  const verticesPerRow = Math.ceil(chunkSize / resolution) + 1;
  
  // Arrays to store vertex data
  const vertices = new Float32Array(verticesPerRow * verticesPerRow * 3);
  const colors = new Float32Array(verticesPerRow * verticesPerRow * 3);
  
  // Generate vertex data
  let vertexIndex = 0;
  for (let z = 0; z < verticesPerRow; z++) {
    for (let x = 0; x < verticesPerRow; x++) {
      const worldX = offsetX + x * resolution;
      const worldZ = offsetZ + z * resolution;
      
      // Get terrain height at this position
      const height = getTerrainHeight(worldX, worldZ);
      
      // Set vertex position
      const baseIndex = vertexIndex * 3;
      vertices[baseIndex] = worldX;
      vertices[baseIndex + 1] = height;
      vertices[baseIndex + 2] = worldZ;
      
      // Set vertex color
      const colorStr = getTerrainColor(height);
      const color = hexToRgb(colorStr);
      colors[baseIndex] = color.r / 255;
      colors[baseIndex + 1] = color.g / 255;
      colors[baseIndex + 2] = color.b / 255;
      
      vertexIndex++;
    }
  }
  
  // Generate indices
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
  
  const endTime = performance.now();
  
  // Send the generated data back to the main thread
  self.postMessage({
    type: 'chunkData',
    chunkX: chunkX,
    chunkZ: chunkZ,
    vertices: vertices.buffer,
    colors: colors.buffer,
    indices: indices,
    generationTime: endTime - startTime
  }, [vertices.buffer, colors.buffer]);
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
  // Check cache
  if (colorCache.has(hex)) {
    return colorCache.get(hex);
  }
  
  // Parse hex color
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const color = result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
  
  // Cache result
  if (colorCache.size < 200) {
    colorCache.set(hex, color);
  }
  
  return color;
}
