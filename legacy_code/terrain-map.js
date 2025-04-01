// terrain-map.js - Adds terrain height visualization to the map system
// A simpler, more robust implementation for displaying elevation on the map

(function() {
    // Configuration options
    const config = {
      contourInterval: 10,        // Height between contour lines
      contourColor: '#FFFFFF',    // Color of contour lines
      contourThickness: 0.5,      // Thickness of contour lines
      majorContourInterval: 50,   // Interval for thicker contour lines
      majorContourThickness: 1.5, // Thickness of major contour lines
      showShading: true,          // Enable height-based shading
      shadingOpacity: 0.5,        // Opacity of terrain shading
      gridSize: 4,                // Size of grid cells for sampling (lower = more detailed)
      highColor: '#FFFFFF',       // Color for high elevation (mountains)
      midColor: '#888888',        // Color for mid elevation (hills)
      lowColor: '#444444',        // Color for low elevation (valleys)
      waterColor: '#0066FF',      // Color for water (below sea level)
      waterLevel: 0,              // Water level elevation
      debug: false                // Enable debug mode
    };
    
    // Wait for map system to initialize
    document.addEventListener('DOMContentLoaded', () => {
      // Wait for map system to be available
      const checkMapSystem = setInterval(() => {
        if (window.mapSystem) {
          clearInterval(checkMapSystem);
          enhanceMapSystem();
          console.log('Terrain map visualization activated');
        }
      }, 1000);
    });
    
    // Enhance the map system with terrain visualization
    function enhanceMapSystem() {
      // Get reference to the map system
      const mapSystem = window.mapSystem;
      
      // Store the original draw function
      const originalDrawMap = mapSystem.drawMap;
      
      // Create a property to store terrain data
      mapSystem.terrainData = {
        heightMap: new Map(),
        minHeight: Infinity,
        maxHeight: -Infinity,
        lastCenterX: 0,
        lastCenterZ: 0
      };
      
      // Override the draw map function
      mapSystem.drawMap = function() {
        // First, call the original draw function
        originalDrawMap.call(this);
        
        // Then add our terrain visualization
        renderTerrainOverlay.call(this);
      };
      
      // Create a new function to render terrain overlay
      function renderTerrainOverlay() {
        // Sample terrain heights
        sampleTerrainHeights.call(this);
        
        // Draw terrain visualization
        if (config.showShading) {
          drawTerrainShading.call(this);
        }
        
        // Draw contour lines
        drawContourLines.call(this);
        
        // Add elevation legend (if not already added)
        if (!document.getElementById('elevation-legend')) {
          addElevationLegend.call(this);
        } else {
          updateElevationLegend.call(this);
        }
      }
      
      // Function to sample terrain heights
      function sampleTerrainHeights() {
        // Calculate map center
        const playerPos = this.player.position;
        const mapCenter = {
          x: playerPos.x - this.centerOffset.x,
          z: playerPos.z - this.centerOffset.z
        };
        
        // Check if we've moved significantly
        const dx = mapCenter.x - this.terrainData.lastCenterX;
        const dz = mapCenter.z - this.terrainData.lastCenterZ;
        const moveDistance = Math.sqrt(dx*dx + dz*dz);
        
        // Skip if we haven't moved much
        if (moveDistance < 10 && this.terrainData.heightMap.size > 0) {
          return;
        }
        
        // Update center position
        this.terrainData.lastCenterX = mapCenter.x;
        this.terrainData.lastCenterZ = mapCenter.z;
        
        // Clear existing data if we've moved significantly
        if (moveDistance > 30) {
          this.terrainData.heightMap.clear();
          this.terrainData.minHeight = Infinity;
          this.terrainData.maxHeight = -Infinity;
        }
        
        // Calculate screen extents in world coordinates
        const width = this.mapCanvas.width / this.zoomLevel;
        const height = this.mapCanvas.height / this.zoomLevel;
        
        const minX = mapCenter.x - width/2;
        const maxX = mapCenter.x + width/2;
        const minZ = mapCenter.z - height/2;
        const maxZ = mapCenter.z + height/2;
        
        // Sample grid
        let samplesAdded = 0;
        for (let x = minX; x <= maxX; x += config.gridSize) {
          for (let z = minZ; z <= maxZ; z += config.gridSize) {
            // Round to avoid floating point issues
            const rx = Math.round(x);
            const rz = Math.round(z);
            const key = `${rx},${rz}`;
            
            // Skip if we already have this point
            if (this.terrainData.heightMap.has(key)) continue;
            
            // Get terrain height
            try {
              const h = getTerrainHeight(rx, rz);
              
              // Store height
              this.terrainData.heightMap.set(key, h);
              samplesAdded++;
              
              // Update min/max
              this.terrainData.minHeight = Math.min(this.terrainData.minHeight, h);
              this.terrainData.maxHeight = Math.max(this.terrainData.maxHeight, h);
            } catch (error) {
              if (config.debug) {
                console.warn(`Failed to get height at (${rx}, ${rz}):`, error);
              }
            }
          }
        }
        
        if (config.debug && samplesAdded > 0) {
          console.log(`Added ${samplesAdded} terrain samples. Height range: ${this.terrainData.minHeight.toFixed(1)} to ${this.terrainData.maxHeight.toFixed(1)}`);
        }
      }
      
      // Function to draw terrain shading
      function drawTerrainShading() {
        // Get canvas context
        const ctx = this.ctx;
        ctx.save();
        
        // Set appropriate drawing styles
        ctx.globalAlpha = config.shadingOpacity;
        
        // Calculate canvas center
        const canvasCenter = {
          x: this.mapCanvas.width / 2,
          y: this.mapCanvas.height / 2
        };
        
        // Calculate center point
        const playerPos = this.player.position;
        const mapCenter = {
          x: playerPos.x - this.centerOffset.x,
          z: playerPos.z - this.centerOffset.z
        };
        
        // Calculate height range for color interpolation
        const heightRange = this.terrainData.maxHeight - this.terrainData.minHeight;
        if (heightRange <= 0) return; // Skip if no height variation
        
        // Draw terrain grid
        const cellSize = config.gridSize * this.zoomLevel;
        
        // Iterate through grid cells
        for (let [key, height] of this.terrainData.heightMap) {
          // Parse coordinates from key
          const [x, z] = key.split(',').map(Number);
          
          // Calculate screen coordinates
          const screenX = canvasCenter.x + (x - mapCenter.x) * this.zoomLevel;
          const screenZ = canvasCenter.y + (z - mapCenter.z) * this.zoomLevel;
          
          // Skip if outside screen
          if (screenX < -cellSize || screenX > this.mapCanvas.width + cellSize ||
              screenZ < -cellSize || screenZ > this.mapCanvas.height + cellSize) {
            continue;
          }
          
          // Determine color based on height
          let color;
          
          if (height < config.waterLevel) {
            // Water color
            color = config.waterColor;
          } else {
            // Normalize height (0-1)
            const normalizedHeight = (height - config.waterLevel) / 
                                    (this.terrainData.maxHeight - config.waterLevel);
            
            // Choose color based on normalized height
            if (normalizedHeight < 0.5) {
              // Low to mid
              const t = normalizedHeight * 2;
              color = interpolateColors(config.lowColor, config.midColor, t);
            } else {
              // Mid to high
              const t = (normalizedHeight - 0.5) * 2;
              color = interpolateColors(config.midColor, config.highColor, t);
            }
          }
          
          // Draw cell
          ctx.fillStyle = color;
          ctx.fillRect(screenX - cellSize/2, screenZ - cellSize/2, cellSize, cellSize);
        }
        
        ctx.restore();
      }
      
      // Draw contour lines
      function drawContourLines() {
        const ctx = this.ctx;
        ctx.save();
        
        // Calculate canvas center
        const canvasCenter = {
          x: this.mapCanvas.width / 2,
          y: this.mapCanvas.height / 2
        };
        
        // Calculate center point
        const playerPos = this.player.position;
        const mapCenter = {
          x: playerPos.x - this.centerOffset.x,
          z: playerPos.z - this.centerOffset.z
        };
        
        // Determine contour levels
        const minContour = Math.floor(this.terrainData.minHeight / config.contourInterval) * config.contourInterval;
        const maxContour = Math.ceil(this.terrainData.maxHeight / config.contourInterval) * config.contourInterval;
        
        // Draw each contour level
        for (let level = minContour; level <= maxContour; level += config.contourInterval) {
          // Skip water levels if desired
          if (level < config.waterLevel) continue;
          
          // Determine if this is a major contour line
          const isMajorContour = level % config.majorContourInterval === 0;
          
          // Set line style
          ctx.beginPath();
          ctx.strokeStyle = config.contourColor;
          ctx.lineWidth = isMajorContour ? config.majorContourThickness : config.contourThickness;
          ctx.globalAlpha = isMajorContour ? 0.8 : 0.4;
          
          // Track if we've added any points to this contour
          let hasPoints = false;
          
          // Scan grid cells to find contour segments
          const gridPoints = [...this.terrainData.heightMap.entries()];
          
          // Sort by X then Z to ensure consistent traversal
          gridPoints.sort((a, b) => {
            const [x1, z1] = a[0].split(',').map(Number);
            const [x2, z2] = b[0].split(',').map(Number);
            return x1 !== x2 ? x1 - x2 : z1 - z2;
          });
          
          // For each grid cell, check adjacent points
          for (let i = 0; i < gridPoints.length; i++) {
            const [key, h1] = gridPoints[i];
            const [x, z] = key.split(',').map(Number);
            
            // Check if this point is at or crosses the contour level
            if ((h1 < level && h1 >= level - config.contourInterval) || 
                (h1 >= level && h1 < level + config.contourInterval)) {
              
              // Find adjacent points
              const rightKey = `${x + config.gridSize},${z}`;
              const bottomKey = `${x},${z + config.gridSize}`;
              
              // Get heights of adjacent points
              const h2 = this.terrainData.heightMap.get(rightKey); // Right
              const h3 = this.terrainData.heightMap.get(bottomKey); // Bottom
              
              // Draw line segments if contour crosses between points
              if (h2 !== undefined) {
                if ((h1 < level && h2 >= level) || (h1 >= level && h2 < level)) {
                  // Interpolate position where contour crosses
                  const t = (level - h1) / (h2 - h1);
                  const midX = x + t * config.gridSize;
                  
                  // Convert to screen coordinates
                  const screenX1 = canvasCenter.x + (midX - mapCenter.x) * this.zoomLevel;
                  const screenZ1 = canvasCenter.y + (z - mapCenter.z) * this.zoomLevel;
                  
                  // Add point to path
                  if (!hasPoints) {
                    ctx.moveTo(screenX1, screenZ1);
                    hasPoints = true;
                  } else {
                    ctx.lineTo(screenX1, screenZ1);
                  }
                }
              }
              
              if (h3 !== undefined) {
                if ((h1 < level && h3 >= level) || (h1 >= level && h3 < level)) {
                  // Interpolate position where contour crosses
                  const t = (level - h1) / (h3 - h1);
                  const midZ = z + t * config.gridSize;
                  
                  // Convert to screen coordinates
                  const screenX2 = canvasCenter.x + (x - mapCenter.x) * this.zoomLevel;
                  const screenZ2 = canvasCenter.y + (midZ - mapCenter.z) * this.zoomLevel;
                  
                  // Add point to path
                  if (!hasPoints) {
                    ctx.moveTo(screenX2, screenZ2);
                    hasPoints = true;
                  } else {
                    ctx.lineTo(screenX2, screenZ2);
                  }
                }
              }
            }
          }
          
          // Draw the contour
          ctx.stroke();
          
          // Add labels for major contours
          if (isMajorContour && hasPoints) {
            // Find a suitable position for the label (center of map)
            const screenX = canvasCenter.x + 80;
            const screenZ = canvasCenter.y;
            
            // Draw elevation label
            ctx.font = '10px Arial';
            ctx.fillStyle = config.contourColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = 0.9;
            ctx.fillText(level.toString(), screenX, screenZ);
          }
        }
        
        ctx.restore();
      }
      
      // Add elevation legend
      function addElevationLegend() {
        // Create legend container
        const legend = document.createElement('div');
        legend.id = 'elevation-legend';
        
        // Style the legend
        Object.assign(legend.style, {
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '8px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: '1000',
          pointerEvents: 'none'
        });
        
        // Add title
        const title = document.createElement('div');
        title.textContent = 'Elevation';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        legend.appendChild(title);
        
        // Create gradient bar
        const gradientBar = document.createElement('div');
        gradientBar.style.width = '120px';
        gradientBar.style.height = '15px';
        gradientBar.style.background = `linear-gradient(to top, ${config.lowColor}, ${config.midColor}, ${config.highColor})`;
        gradientBar.style.marginBottom = '4px';
        gradientBar.style.position = 'relative';
        legend.appendChild(gradientBar);
        
        // Add min/max labels container
        const labelsContainer = document.createElement('div');
        labelsContainer.style.display = 'flex';
        labelsContainer.style.justifyContent = 'space-between';
        
        // Add min label
        const minLabel = document.createElement('span');
        minLabel.id = 'min-height-label';
        labelsContainer.appendChild(minLabel);
        
        // Add max label
        const maxLabel = document.createElement('span');
        maxLabel.id = 'max-height-label';
        labelsContainer.appendChild(maxLabel);
        
        legend.appendChild(labelsContainer);
        
        // Add water level indicator if needed
        if (this.terrainData.minHeight < config.waterLevel) {
          const waterIndicator = document.createElement('div');
          waterIndicator.textContent = `Water level: ${config.waterLevel}`;
          waterIndicator.style.color = config.waterColor;
          waterIndicator.style.marginTop = '4px';
          legend.appendChild(waterIndicator);
        }
        
        // Add to map container
        this.mapContainer.appendChild(legend);
        
        // Update with current values
        updateElevationLegend.call(this);
        
        // Add controls for toggling terrain features
        addTerrainControls.call(this);
      }
      
      // Update elevation legend values
      function updateElevationLegend() {
        const minLabel = document.getElementById('min-height-label');
        const maxLabel = document.getElementById('max-height-label');
        
        if (minLabel && maxLabel) {
          minLabel.textContent = Math.round(this.terrainData.minHeight);
          maxLabel.textContent = Math.round(this.terrainData.maxHeight);
        }
      }
      
      // Add terrain toggle controls
      function addTerrainControls() {
        // Check if controls already exist
        if (document.getElementById('terrain-controls')) return;
        
        // Get controls container
        const controls = this.controls;
        if (!controls) return;
        
        // Create divider
        const divider = document.createElement('div');
        divider.style.width = '1px';
        divider.style.height = '20px';
        divider.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        divider.style.margin = '0 8px';
        controls.appendChild(divider);
        
        // Create contour toggle button
        const contourButton = document.createElement('button');
        contourButton.textContent = 'C';
        contourButton.title = 'Toggle Contour Lines';
        contourButton.id = 'toggle-contours';
        
        Object.assign(contourButton.style, {
          backgroundColor: 'rgba(0, 120, 180, 0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '5px 10px',
          cursor: 'pointer',
          fontSize: '14px',
          width: '30px',
          height: '30px'
        });
        
        // Handle contour toggle
        let contoursVisible = true;
        contourButton.addEventListener('click', () => {
          contoursVisible = !contoursVisible;
          contourButton.style.backgroundColor = contoursVisible ? 
            'rgba(0, 120, 180, 0.7)' : 'rgba(100, 100, 100, 0.5)';
          
          // Store original values
          const originalContourThickness = config.contourThickness;
          const originalMajorThickness = config.majorContourThickness;
          
          // Toggle contours by setting thickness to 0 or restoring original values
          if (contoursVisible) {
            config.contourThickness = originalContourThickness || 0.5;
            config.majorContourThickness = originalMajorThickness || 1.5;
          } else {
            config.contourThickness = 0;
            config.majorContourThickness = 0;
          }
          
          // Redraw map
          window.mapSystem.drawMap();
        });
        
        controls.appendChild(contourButton);
        
        // Create shading toggle button
        const shadingButton = document.createElement('button');
        shadingButton.textContent = 'S';
        shadingButton.title = 'Toggle Terrain Shading';
        shadingButton.id = 'toggle-shading';
        
        Object.assign(shadingButton.style, {
          backgroundColor: 'rgba(0, 120, 180, 0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '5px 10px',
          cursor: 'pointer',
          fontSize: '14px',
          marginLeft: '5px',
          width: '30px',
          height: '30px'
        });
        
        // Handle shading toggle
        shadingButton.addEventListener('click', () => {
          config.showShading = !config.showShading;
          shadingButton.style.backgroundColor = config.showShading ? 
            'rgba(0, 120, 180, 0.7)' : 'rgba(100, 100, 100, 0.5)';
          window.mapSystem.drawMap();
        });
        
        controls.appendChild(shadingButton);
        
        // Mark as added
        const controlsMarker = document.createElement('div');
        controlsMarker.id = 'terrain-controls';
        controlsMarker.style.display = 'none';
        controls.appendChild(controlsMarker);
      }
      
      // Helper function to interpolate between colors
      function interpolateColors(color1, color2, t) {
        // Parse colors
        const r1 = parseInt(color1.slice(1, 3), 16);
        const g1 = parseInt(color1.slice(3, 5), 16);
        const b1 = parseInt(color1.slice(5, 7), 16);
        
        const r2 = parseInt(color2.slice(1, 3), 16);
        const g2 = parseInt(color2.slice(3, 5), 16);
        const b2 = parseInt(color2.slice(5, 7), 16);
        
        // Interpolate
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
      
      // Set up key listener for toggling debug mode
      document.addEventListener('keydown', (e) => {
        // Alt+T toggles debug mode
        if (e.altKey && e.key === 't') {
          config.debug = !config.debug;
          console.log(`Terrain map debug mode: ${config.debug ? 'ON' : 'OFF'}`);
        }
      });
    }
  })();