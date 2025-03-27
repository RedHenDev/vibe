// improved-rocky-archways.js - Natural stone arches that emerge organically from terrain

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const entity = document.createElement('a-entity');
      entity.setAttribute('id', 'rocky-archways');
      entity.setAttribute('rocky-archways', '');
      scene.appendChild(entity);
      console.log('Rocky archways system initialized');
    });
  }
});

AFRAME.registerComponent('rocky-archways', {
  schema: {
    distance: { type: 'number', default: 800 },     // Render distance 
    count: { type: 'number', default: 8 },          // Number of archways
    minSize: { type: 'number', default: 60 },       // Min overall size
    maxSize: { type: 'number', default: 180 },      // Max overall size
    segmentCount: { type: 'number', default: 16 },  // Points along arch path
    sphereCount: { type: 'number', default: 30 },   // Spheres to use (higher = better quality)
    noiseScale: { type: 'number', default: 0.35 },  // Amount of irregularity (0-1)
    lumpiness: { type: 'number', default: 0.7 },    // How lumpy the arches are (0-1)
    optimizeForMobile: { type: 'boolean', default: true } // Use lower detail on mobile
  },
  
  init: function() {
    this.archways = new Map();
    this.positions = [];
    this.player = document.querySelector('#player').object3D;
    
    // Check if we're on mobile for optimization
    this.isMobile = AFRAME.utils.device.isMobile();
    if (this.isMobile && this.data.optimizeForMobile) {
      // Use lower quality settings on mobile
      this.data.sphereCount = 18;
      this.data.segmentCount = 12;
    }
    
    // Generate positions after terrain is loaded
    setTimeout(() => {
      this.generatePositions();
      console.log(`Generated ${this.positions.length} archway positions`);
      // Create first set of archways immediately
      this.createNearbyArchways();
      // Start regular updates
      this.updateVisibility();
    }, 2000);
  },
  
  // Simple seeded random number generator
  seededRandom: function(seed) {
    let state = seed || 1;
    return function() {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  },
  
  // Gets terrain color based on height (from urizen.js)
  getTerrainColor: function(height) {
    if (height < -11.5) return '#000F00';
    if (height < 0) return '#003200';     
    if (height < 5) return '#003900';     
    if (height < 10) return '#004400';    
    if (height < 30) return '#005800';    
    if (height < 50) return '#006500';    
    if (height < 70) return '#6B776B';    
    return '#FFFFFF';
  },
  
  // Interpolate between two colors
  lerpColor: function(color1, color2, factor) {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    
    const r = c1.r + (c2.r - c1.r) * factor;
    const g = c1.g + (c2.g - c1.g) * factor;
    const b = c1.b + (c2.b - c1.b) * factor;
    
    return new THREE.Color(r, g, b);
  },
  
  generatePositions: function() {
    // Use world seed for deterministic placement
    const seed = typeof worldSeed !== 'undefined' ? worldSeed : getSeed("1");
    const random = this.seededRandom(seed);
    
    // Create a grid with spacing to avoid too many archways in one area
    const gridSize = 400;
    const gridCells = 5;
    const cellSize = gridSize / gridCells;
    
    const grid = new Array(gridCells).fill(0).map(() => new Array(gridCells).fill(false));
    
    for (let i = 0; i < this.data.count; i++) {
      // Try to find an empty grid cell
      let attempts = 0;
      let foundEmpty = false;
      let gridX, gridZ;
      
      while (!foundEmpty && attempts < 20) {
        gridX = Math.floor(random() * gridCells);
        gridZ = Math.floor(random() * gridCells);
        
        if (!grid[gridX][gridZ]) {
          foundEmpty = true;
          grid[gridX][gridZ] = true;
        }
        attempts++;
      }
      
      if (!foundEmpty) {
        // If all cells are taken or we couldn't find an empty one, just pick a random one
        gridX = Math.floor(random() * gridCells);
        gridZ = Math.floor(random() * gridCells);
      }
      
      // Add some randomness within the cell
      const cellOffsetX = (random() - 0.5) * cellSize * 0.8;
      const cellOffsetZ = (random() - 0.5) * cellSize * 0.8;
      
      // Convert to world coordinates
      const x = (gridX - gridCells/2) * cellSize + cellOffsetX;
      const z = (gridZ - gridCells/2) * cellSize + cellOffsetZ;
      
      // Get height at position
      const y = getTerrainHeight(x, z);
      
      // Skip underwater positions
      if (y < -5) {
        continue;
      }
      
      // Skip positions that are too high (mountaintops)
      if (y > 60) {
        continue;
      }
      
      // Calculate size and orientation
      const size = this.data.minSize + random() * (this.data.maxSize - this.data.minSize);
      
      // Face the arch in a random direction, but with some bias toward cardinal directions
      let rotation = random() * Math.PI * 2;
      if (random() < 0.6) {
        // 60% chance to align more with cardinal directions
        rotation = Math.round(rotation / (Math.PI/2)) * (Math.PI/2) + (random() - 0.5) * (Math.PI/6);
      }
      
      // Get terrain color and add slight variation
      const baseColor = this.getTerrainColor(y);
      
      // Store archway data for later creation
      this.positions.push({
        pos: new THREE.Vector3(x, y, z),
        size,
        rotation,
        baseColor,
        seed: seed + i // Unique seed for this arch
      });
    }
  },
  
  createNearbyArchways: function() {
    if (!this.player) return;
    
    // Create the closest archways immediately
    const playerPos = this.player.position;
    
    // Sort by distance to player
    this.positions.sort((a, b) => 
      a.pos.distanceTo(playerPos) - b.pos.distanceTo(playerPos)
    );
    
    // Create the closest few archways
    for (let i = 0; i < Math.min(3, this.positions.length); i++) {
      const arch = this.positions[i];
      this.createArchway(i, arch);
    }
  },
  
  updateVisibility: function() {
    if (!this.player) {
      this.player = document.querySelector('#player').object3D;
      if (!this.player) {
        setTimeout(() => this.updateVisibility(), 2000);
        return;
      }
    }
    
    const playerPos = this.player.position;
    
    // Process each potential archway
    this.positions.forEach((arch, index) => {
      const distance = arch.pos.distanceTo(playerPos);
      
      if (distance < this.data.distance) {
        if (!this.archways.has(index)) {
          this.createArchway(index, arch);
        }
      } else if (this.archways.has(index)) {
        this.removeArchway(index);
      }
    });
    
    // Check again after delay
    setTimeout(() => this.updateVisibility(), 2000);
  },
  
  createArchway: function(index, data) {
    const { pos, size, rotation, baseColor, seed } = data;
    
    // Initialize a random generator specific to this arch
    const random = this.seededRandom(seed);
    
    // Create main entity
    const arch = document.createElement('a-entity');
    arch.setAttribute('position', `${pos.x} ${pos.y - 1} ${pos.z}`); // Slightly sunk into terrain
    arch.setAttribute('rotation', `0 ${rotation * (180/Math.PI)} 0`);
    
    // Create parameters for the arch shape
    const width = size * 0.9;               // Arch width
    const height = size * (0.5 + random() * 0.3); // Arch height
    const thickness = size * (0.15 + random() * 0.15); // Base thickness of the arch
    
    // Create control points for the arch curve
    const points = this.generateArchPath(width, height, thickness, random);
    
    // Create a visual representation of the arch using spheres
    this.createSphereTube(arch, points, thickness, baseColor, random);
    
    this.el.appendChild(arch);
    this.archways.set(index, arch);
  },
  
  generateArchPath: function(width, height, thickness, random) {
    const segmentCount = this.data.segmentCount;
    const points = [];
    
    // Parameters for arch path variation
    const twistFactor = (random() - 0.5) * 0.8; // How much the arch twists
    const bendFactor = (random() - 0.5) * 0.7;  // How much the arch bends sideways
    const skewFactor = (random() - 0.5) * 0.4;  // How much the arch is skewed
    const flattenFactor = 0.7 + random() * 0.6; // How flat/tall the arch is
    
    // Generate a base arch path
    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount; // 0 to 1 along the arch
      
      // Start with a basic arch shape (parabola)
      const x = (t - 0.5) * width;
      
      // Height follows a modified parabola curve for arch shape
      let y = 4 * height * t * (1 - t) * flattenFactor;
      
      // Add vertical asymmetry (one side higher than the other)
      y += height * skewFactor * (t - 0.5);
      
      // Add noise to the height to make it irregular
      const heightNoise = (random() * 2 - 1) * height * this.data.noiseScale * Math.sin(t * Math.PI);
      y += heightNoise;
      
      // Add sideways bend and twisting
      const z = bendFactor * width * Math.sin(t * Math.PI) + 
                twistFactor * width * 0.2 * Math.sin(t * Math.PI * 2);
      
      // Add some horizontal noise
      const xNoise = (random() * 2 - 1) * width * 0.05;
      const zNoise = (random() * 2 - 1) * width * 0.05;
      
      points.push({
        x: x + xNoise,
        y: Math.max(0, y), // Keep y above ground
        z: z + zNoise,
        // Calculate thickness variation along the path
        thickness: thickness * (0.7 + Math.sin(t * Math.PI) * 0.5) * (0.8 + random() * 0.4)
      });
    }
    
    return points;
  },
  
  createSphereTube: function(parentEntity, points, baseThickness, baseColor, random) {
    // Number of rock shapes to place along the tube
    const rockCount = this.data.sphereCount * 1.4; // Increase count since we're using smaller elements
    
    // Color variation parameters
    const baseColorObj = new THREE.Color(baseColor);
    const darkColor = this.lerpColor(baseColor, '#000000', 0.3);
    const lightColor = this.lerpColor(baseColor, '#FFFFFF', 0.3);
    
    // Choose which primitive types to use for more angular appearance
    const primitiveTypes = ['a-octahedron', 'a-dodecahedron', 'a-box', 'a-tetrahedron'];
    
    // Create a tube-like structure using angular rocks
    for (let i = 0; i < rockCount; i++) {
      const t = i / (rockCount - 1); // 0 to 1 along the path
      
      // Find position along the path using interpolation
      const pos = this.interpolateAlongPath(points, t);
      
      // Get base thickness at this position and make it smaller
      const baseRadiusAtPosition = pos.thickness * 0.6; // Reduce size by 40%
      
      // Apply lumpiness
      let radius = baseRadiusAtPosition;
      if (random() < this.data.lumpiness) {
        // Add variation to create lumps
        radius *= 0.7 + random() * 0.6;
      }
      
      // Randomly choose primitive type
      const primitiveIdx = Math.floor(random() * primitiveTypes.length);
      const primitiveType = primitiveTypes[primitiveIdx];
      
      // Create rock shape
      const rock = document.createElement(primitiveType);
      rock.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      
      // Set size attribute based on primitive type
      if (primitiveType === 'a-box') {
        // Use width/height/depth for boxes with random proportions for irregularity
        const xScale = radius * (0.8 + random() * 0.4);
        const yScale = radius * (0.8 + random() * 0.4);
        const zScale = radius * (0.8 + random() * 0.4);
        rock.setAttribute('width', xScale);
        rock.setAttribute('height', yScale);
        rock.setAttribute('depth', zScale);
      } else {
        // Use radius for spherical primitives
        rock.setAttribute('radius', radius);
      }
      
      // Add random rotation for more angular appearance
      const rotX = random() * 360;
      const rotY = random() * 360;
      const rotZ = random() * 360;
      rock.setAttribute('rotation', `${rotX} ${rotY} ${rotZ}`);
      
      // Calculate color variation based on position and random factors
      let color;
      if (random() < 0.7) {
        // Most rocks use a color close to the base with slight variation
        const variation = -0.2 + random() * 0.4;
        if (variation < 0) {
          color = this.lerpColor(baseColor, darkColor, Math.abs(variation) * 2);
        } else {
          color = this.lerpColor(baseColor, lightColor, variation * 2);
        }
      } else {
        // Some rocks use more extreme variations for visual interest
        color = random() < 0.5 ? darkColor : lightColor;
      }
      
      rock.setAttribute('color', '#' + color.getHexString());
      
      // Add roughness for a more natural rock appearance
      rock.setAttribute('roughness', 0.95);
      rock.setAttribute('metalness', 0.05);
      
      parentEntity.appendChild(rock);
    }
    
    // Add some additional lumps for more character
    const extraLumps = Math.floor(5 + random() * 7); // 5-11 extra lumps
    for (let i = 0; i < extraLumps; i++) {
      // Pick a random position along the arch
      const t = random();
      const pos = this.interpolateAlongPath(points, t);
      
      // Random offset from center
      const offsetX = (random() * 2 - 1) * pos.thickness * 1.0;
      const offsetY = (random() * 2 - 1) * pos.thickness * 1.0;
      const offsetZ = (random() * 2 - 1) * pos.thickness * 1.0;
      
      // Choose random primitive for lump
      const primitiveIdx = Math.floor(random() * primitiveTypes.length);
      const primitiveType = primitiveTypes[primitiveIdx];
      
      // Create lump
      const lump = document.createElement(primitiveType);
      lump.setAttribute('position', `${pos.x + offsetX} ${pos.y + offsetY} ${pos.z + offsetZ}`);
      
      // Random radius for the lump - smaller than before
      const radius = pos.thickness * (0.2 + random() * 0.5);
      
      // Set size attribute based on primitive type
      if (primitiveType === 'a-box') {
        const xScale = radius * (0.8 + random() * 0.4);
        const yScale = radius * (0.8 + random() * 0.4);
        const zScale = radius * (0.8 + random() * 0.4);
        lump.setAttribute('width', xScale);
        lump.setAttribute('height', yScale);
        lump.setAttribute('depth', zScale);
      } else {
        lump.setAttribute('radius', radius);
      }
      
      // Add random rotation
      const rotX = random() * 360;
      const rotY = random() * 360;
      const rotZ = random() * 360;
      lump.setAttribute('rotation', `${rotX} ${rotY} ${rotZ}`);
      
      // Similar coloring to main rocks
      const variation = -0.3 + random() * 0.5;
      let color;
      if (variation < 0) {
        color = this.lerpColor(baseColor, darkColor, Math.abs(variation) * 2);
      } else {
        color = this.lerpColor(baseColor, lightColor, variation * 2);
      }
      
      lump.setAttribute('color', '#' + color.getHexString());
      lump.setAttribute('roughness', 0.95);
      lump.setAttribute('metalness', 0.05);
      
      parentEntity.appendChild(lump);
    }
  },
  
  // Interpolate to find position along curve
  interpolateAlongPath: function(points, t) {
    // t is 0-1 position along path
    // Convert to index
    const segments = points.length - 1;
    const indexFloat = t * segments;
    const index = Math.floor(indexFloat);
    const fract = indexFloat - index;
    
    // Handle edge cases
    if (index >= segments) {
      return points[segments];
    }
    
    if (index < 0) {
      return points[0];
    }
    
    // Get points to interpolate between
    const p1 = points[index];
    const p2 = points[index + 1];
    
    // Interpolate between points
    return {
      x: p1.x + (p2.x - p1.x) * fract,
      y: p1.y + (p2.y - p1.y) * fract,
      z: p1.z + (p2.z - p1.z) * fract,
      thickness: p1.thickness + (p2.thickness - p1.thickness) * fract
    };
  },
  
  removeArchway: function(index) {
    const arch = this.archways.get(index);
    if (arch && arch.parentNode) {
      arch.parentNode.removeChild(arch);
    }
    this.archways.delete(index);
  },
  
  remove: function() {
    // Cleanup
    this.archways.forEach(arch => {
      if (arch.parentNode) arch.parentNode.removeChild(arch);
    });
    this.archways.clear();
  }
});