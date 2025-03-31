// 2D Map System for Eigengrau Light
// Shows player location, tracks journey, and displays points of interest

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const mapSystemEntity = document.createElement('a-entity');
        mapSystemEntity.setAttribute('id', 'map-system');
        mapSystemEntity.setAttribute('map-system', '');
        scene.appendChild(mapSystemEntity);
        console.log('Map system initialized');
      });
    }
  });
  
  AFRAME.registerComponent('map-system', {
    schema: {
      enabled: { type: 'boolean', default: true },
      mapSize: { type: 'number', default: 1000 },     // Size of the map in world units
      pixelSize: { type: 'number', default: 600 },    // Size of the map in pixels
      updateInterval: { type: 'number', default: 1000 }, // Milliseconds between updates
      showPlayers: { type: 'boolean', default: true },  // Show other players
      showVibes: { type: 'boolean', default: true },    // Show collected vibes
      showPath: { type: 'boolean', default: true },     // Show player's path
      maxPathPoints: { type: 'number', default: 500 },  // Maximum path points to store
      backgroundColor: { type: 'color', default: '#001122' }, // Map background color
      playerColor: { type: 'color', default: '#00FF00' },     // Player marker color
      pathColor: { type: 'color', default: '#FFFFFF' },       // Path color
      vibsColor: { type: 'color', default: '#00FFFF' },       // Collected vibes color
      portalColor: { type: 'color', default: '#00FF00' },     // Portal marker color
      otherPlayerColor: { type: 'color', default: '#FFFFFF' } // Other players color
    },
    
    init: function() {
      // Create map UI elements
      this.createMapUI();
      
      // Reference to player entity
      this.player = document.querySelector('#player').object3D;
      
      // Track player path
      this.pathPoints = [];
      
      // Track bookmarks
      this.bookmarks = [];
      
      // Toggle state
      this.isVisible = false;
      
      // Zoom level
      this.zoomLevel = 1;
      
      // Center offset for panning
      this.centerOffset = { x: 0, y: 0 };
      
      // Flag for path tracking
      this.trackPath = true;
      
      // Store the vibe locations
      this.vibeLocations = [];
      
      // Store portal locations
      this.portalLocations = [
        { x: -95, y: 55, z: -19, name: "Vibeverse Portal" } // Exit portal location
      ];
      
      // Set up update interval
      this.lastUpdate = 0;
      
      // Make accessible to other components
      window.mapSystem = this;
      
      // Bind keyboard events
      this.bindKeyEvents();
      
      console.log('Map system component ready');
    },
    
    createMapUI: function() {
      // Create map container
      this.mapContainer = document.createElement('div');
      this.mapContainer.id = 'map-container';
      
      // Style the container
      Object.assign(this.mapContainer.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${this.data.pixelSize}px`,
        height: `${this.data.pixelSize}px`,
        backgroundColor: this.data.backgroundColor,
        border: '3px solid rgba(0, 150, 200, 0.8)',
        borderRadius: '10px',
        boxShadow: '0 0 20px rgba(0, 150, 200, 0.5)',
        zIndex: '1000',
        display: 'none',
        overflow: 'hidden'
      });
      
      // Create canvas for drawing the map
      this.mapCanvas = document.createElement('canvas');
      this.mapCanvas.width = this.data.pixelSize;
      this.mapCanvas.height = this.data.pixelSize;
      
      // Style the canvas
      Object.assign(this.mapCanvas.style, {
        width: '100%',
        height: '100%'
      });
      
      // Add canvas to container
      this.mapContainer.appendChild(this.mapCanvas);
      
      // Get canvas context for drawing
      this.ctx = this.mapCanvas.getContext('2d');
      
      // Create coordinates display
      this.coordsDisplay = document.createElement('div');
      Object.assign(this.coordsDisplay.style, {
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px',
        padding: '5px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: '5px'
      });
      this.mapContainer.appendChild(this.coordsDisplay);
      
      // Create title
      this.titleDisplay = document.createElement('div');
      Object.assign(this.titleDisplay.style, {
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontWeight: 'bold',
        padding: '5px 10px',
        backgroundColor: 'rgba(0, 50, 100, 0.7)',
        borderRadius: '5px',
        textAlign: 'center'
      });
      this.titleDisplay.textContent = 'EIGENGRAU MAP';
      this.mapContainer.appendChild(this.titleDisplay);
      
      // Create legend
      this.createLegend();
      
      // Create controls
      this.createControls();
      
      // Add to document
      document.body.appendChild(this.mapContainer);
      
      // Add event listeners for drag to pan
      this.setupDragPan();
      
      // Add event listener for zoom
      this.setupZoom();
    },
    
    createLegend: function() {
      // Create legend container
      this.legend = document.createElement('div');
      Object.assign(this.legend.style, {
        position: 'absolute',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        padding: '8px',
        borderRadius: '5px',
        maxWidth: '150px'
      });
      
      // Add legend items
      this.legend.innerHTML = `
        <div style="margin-bottom: 4px; font-weight: bold;">Legend:</div>
        <div style="display: flex; align-items: center; margin: 2px 0;">
          <div style="width: 10px; height: 10px; background-color: ${this.data.playerColor}; margin-right: 5px;"></div>
          <span>You</span>
        </div>
        <div style="display: flex; align-items: center; margin: 2px 0;">
          <div style="width: 10px; height: 10px; background-color: ${this.data.otherPlayerColor}; margin-right: 5px;"></div>
          <span>Other Players</span>
        </div>
        <div style="display: flex; align-items: center; margin: 2px 0;">
          <div style="width: 10px; height: 10px; background-color: ${this.data.vibsColor}; margin-right: 5px;"></div>
          <span>Vibes</span>
        </div>
        <div style="display: flex; align-items: center; margin: 2px 0;">
          <div style="width: 10px; height: 10px; background-color: ${this.data.portalColor}; margin-right: 5px;"></div>
          <span>Portals</span>
        </div>
        <div style="display: flex; align-items: center; margin: 2px 0;">
          <div style="width: 10px; height: 2px; background-color: ${this.data.pathColor}; margin-right: 5px;"></div>
          <span>Your Path</span>
        </div>
      `;
      
      this.mapContainer.appendChild(this.legend);
    },
    
    createControls: function() {
      // Create controls container
      this.controls = document.createElement('div');
      Object.assign(this.controls.style, {
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        display: 'flex',
        gap: '5px'
      });
      
      // Helper function to create a control button
      const createButton = (text, onClick, tooltip) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.title = tooltip || text;
        Object.assign(button.style, {
          backgroundColor: 'rgba(0, 120, 180, 0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '5px 10px',
          fontSize: '14px',
          cursor: 'pointer',
          fontFamily: 'Arial, sans-serif'
        });
        button.addEventListener('click', onClick);
        return button;
      };
      
      // Create zoom buttons
      const zoomInButton = createButton('+', () => this.zoom(1), 'Zoom In');
      const zoomOutButton = createButton('-', () => this.zoom(-1), 'Zoom Out');
      const resetButton = createButton('⟲', () => this.resetView(), 'Reset View');
      
      // Add buttons to controls
      this.controls.appendChild(zoomInButton);
      this.controls.appendChild(zoomOutButton);
      this.controls.appendChild(resetButton);
      
      // Add controls to map
      this.mapContainer.appendChild(this.controls);
    },
    
    setupDragPan: function() {
      let isDragging = false;
      let lastX = 0;
      let lastY = 0;
      
      this.mapCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        this.mapCanvas.style.cursor = 'grabbing';
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        // Update center offset
        this.centerOffset.x += dx / this.zoomLevel;
        this.centerOffset.y += dy / this.zoomLevel;
        
        // Update last position
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Redraw map with new offset
        this.drawMap();
      });
      
      document.addEventListener('mouseup', () => {
        isDragging = false;
        this.mapCanvas.style.cursor = 'grab';
      });
      
      // Set initial cursor style
      this.mapCanvas.style.cursor = 'grab';
    },
    
    setupZoom: function() {
      this.mapCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Determine zoom direction
        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        
        // Apply zoom
        this.zoom(zoomDirection);
      });
    },
    
    zoom: function(direction) {
      // Change zoom level
      const oldZoom = this.zoomLevel;
      
      if (direction > 0) {
        // Zoom in - maximum zoom of 5x
        this.zoomLevel = Math.min(5, this.zoomLevel * 1.2);
      } else {
        // Zoom out - minimum zoom of 0.5x
        this.zoomLevel = Math.max(0.5, this.zoomLevel / 1.2);
      }
      
      // Redraw map with new zoom level
      this.drawMap();
    },
    
    resetView: function() {
      // Reset zoom and pan
      this.zoomLevel = 1;
      this.centerOffset = { x: 0, y: 0 };
      
      // Redraw map
      this.drawMap();
    },
    
    toggleMap: function() {
      if (this.isVisible) {
        this.hideMap();
      } else {
        this.showMap();
      }
    },
    
    showMap: function() {
      if (this.isVisible) return;
      
      this.isVisible = true;
      this.mapContainer.style.display = 'block';
      
      // Draw the map
      this.drawMap();
    },
    
    hideMap: function() {
      if (!this.isVisible) return;
      
      this.isVisible = false;
      this.mapContainer.style.display = 'none';
    },
    
    drawMap: function() {
      // Clear canvas
      this.ctx.fillStyle = this.data.backgroundColor;
      this.ctx.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
      
      // Calculate center point on canvas
      const canvasCenter = {
        x: this.mapCanvas.width / 2,
        y: this.mapCanvas.height / 2
      };
      
      // Get player position
      const playerPos = this.player.position;
      
      // Center of map excluding pan offset
      const mapCenter = {
        x: playerPos.x - this.centerOffset.x,
        y: playerPos.z - this.centerOffset.y
      };
      
      // Draw coordinate grid
      this.drawGrid(canvasCenter, mapCenter);
      
      // Draw player path
      if (this.data.showPath && this.pathPoints.length > 0) {
        this.drawPath(canvasCenter, mapCenter);
      }
      
      // Draw bookmarks
      this.drawBookmarks(canvasCenter, mapCenter);
      
      // Draw vibes locations
      if (this.data.showVibes && this.vibeLocations.length > 0) {
        this.drawVibes(canvasCenter, mapCenter);
      }
      
      // Draw portal locations
      this.drawPortals(canvasCenter, mapCenter);
      
      // Draw other players if enabled
      if (this.data.showPlayers) {
        this.drawOtherPlayers(canvasCenter, mapCenter);
      }
      
      // Draw player marker (draw last so it's on top)
      this.drawPlayerMarker(canvasCenter);
      
      // Update coordinates display
      this.updateCoordinatesDisplay(playerPos);
    },
    
    drawGrid: function(canvasCenter, mapCenter) {
      // Draw coordinate grid
      const gridSize = 64; // Size of grid cells in world units
      const gridColor = 'rgba(100, 100, 255, 0.2)';
      
      // Calculate grid offset
      const offsetX = canvasCenter.x - mapCenter.x * this.zoomLevel;
      const offsetY = canvasCenter.y - mapCenter.y * this.zoomLevel;
      
      this.ctx.strokeStyle = gridColor;
      this.ctx.lineWidth = 1;
      
      // Calculate grid bounds
      const mapSize = this.data.mapSize / this.zoomLevel;
      const gridCellsX = Math.ceil(this.mapCanvas.width / (gridSize * this.zoomLevel)) + 1;
      const gridCellsY = Math.ceil(this.mapCanvas.height / (gridSize * this.zoomLevel)) + 1;
      
      // Calculate grid start positions
      const startX = Math.floor(mapCenter.x / gridSize) * gridSize;
      const startY = Math.floor(mapCenter.y / gridSize) * gridSize;
      
      // Draw vertical grid lines
      for (let i = -gridCellsX; i <= gridCellsX; i++) {
        const x = startX + i * gridSize;
        const screenX = offsetX + x * this.zoomLevel;
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, 0);
        this.ctx.lineTo(screenX, this.mapCanvas.height);
        this.ctx.stroke();
        
        // Add grid coordinates
        if (i % 2 === 0) {
          this.ctx.fillStyle = 'rgba(150, 150, 255, 0.5)';
          this.ctx.font = '10px Arial';
          this.ctx.fillText(x.toString(), screenX + 2, 10);
        }
      }
      
      // Draw horizontal grid lines
      for (let j = -gridCellsY; j <= gridCellsY; j++) {
        const y = startY + j * gridSize;
        const screenY = offsetY + y * this.zoomLevel;
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, screenY);
        this.ctx.lineTo(this.mapCanvas.width, screenY);
        this.ctx.stroke();
        
        // Add grid coordinates
        if (j % 2 === 0) {
          this.ctx.fillStyle = 'rgba(150, 150, 255, 0.5)';
          this.ctx.font = '10px Arial';
          this.ctx.fillText(y.toString(), 2, screenY - 2);
        }
      }
    },
    
    drawPlayerMarker: function(canvasCenter) {
      // Draw player marker at center
      this.ctx.fillStyle = this.data.playerColor;
      
      // Draw player direction indicator (triangle)
      const size = 8;
      const rotation = this.player.rotation.y;
      
      this.ctx.save();
      this.ctx.translate(canvasCenter.x, canvasCenter.y);
      this.ctx.rotate(rotation);
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, -size * 1.5);
      this.ctx.lineTo(size, size);
      this.ctx.lineTo(-size, size);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Add a small dot in the center
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    },
    
    drawPath: function(canvasCenter, mapCenter) {
      if (this.pathPoints.length < 2) return;
      
      // Calculate offset for drawing
      const offsetX = canvasCenter.x - mapCenter.x * this.zoomLevel;
      const offsetY = canvasCenter.y - mapCenter.y * this.zoomLevel;
      
      // Draw path
      this.ctx.strokeStyle = this.data.pathColor;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      
      // Start from the first point
      const firstPoint = this.pathPoints[0];
      const firstScreenX = offsetX + firstPoint.x * this.zoomLevel;
      const firstScreenY = offsetY + firstPoint.z * this.zoomLevel;
      this.ctx.moveTo(firstScreenX, firstScreenY);
      
      // Draw lines to each subsequent point
      for (let i = 1; i < this.pathPoints.length; i++) {
        const point = this.pathPoints[i];
        const screenX = offsetX + point.x * this.zoomLevel;
        const screenY = offsetY + point.z * this.zoomLevel;
        this.ctx.lineTo(screenX, screenY);
      }
      
      this.ctx.stroke();
      
      // Draw small dots at path points
      this.ctx.fillStyle = this.data.pathColor;
      for (let i = 0; i < this.pathPoints.length; i += 5) { // Draw every 5th point for performance
        const point = this.pathPoints[i];
        const screenX = offsetX + point.x * this.zoomLevel;
        const screenY = offsetY + point.z * this.zoomLevel;
        
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 1, 0, Math.PI * 2);
        this.ctx.fill();
      }
    },
    
    drawBookmarks: function(canvasCenter, mapCenter) {
      // Calculate offset for drawing
      const offsetX = canvasCenter.x - mapCenter.x * this.zoomLevel;
      const offsetY = canvasCenter.y - mapCenter.y * this.zoomLevel;
      
      // Draw each bookmark
      for (const bookmark of this.bookmarks) {
        const screenX = offsetX + bookmark.position.x * this.zoomLevel;
        const screenY = offsetY + bookmark.position.z * this.zoomLevel;
        
        // Draw bookmark icon
        this.ctx.fillStyle = bookmark.color || '#FFCC00';
        
        // Draw a star shape
        const size = 6;
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, screenY - size);
        for (let i = 1; i < 5; i++) {
          const angle = (Math.PI * 2 * i / 5) - Math.PI / 2;
          const radius = i % 2 === 0 ? size : size / 2;
          this.ctx.lineTo(
            screenX + radius * Math.cos(angle),
            screenY + radius * Math.sin(angle)
          );
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw bookmark name
        if (this.zoomLevel > 0.8) { // Only show names at certain zoom levels
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(bookmark.name, screenX, screenY + size + 10);
        }
      }
    },
    
    drawVibes: function(canvasCenter, mapCenter) {
      // Calculate offset for drawing
      const offsetX = canvasCenter.x - mapCenter.x * this.zoomLevel;
      const offsetY = canvasCenter.y - mapCenter.y * this.zoomLevel;
      
      // Draw each vibe location
      this.ctx.fillStyle = this.data.vibsColor;
      
      for (const vibe of this.vibeLocations) {
        const screenX = offsetX + vibe.x * this.zoomLevel;
        const screenY = offsetY + vibe.z * this.zoomLevel;
        
        // Draw a small diamond
        const size = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, screenY - size);
        this.ctx.lineTo(screenX + size, screenY);
        this.ctx.lineTo(screenX, screenY + size);
        this.ctx.lineTo(screenX - size, screenY);
        this.ctx.closePath();
        this.ctx.fill();
      }
    },
    
    drawPortals: function(canvasCenter, mapCenter) {
      // Calculate offset for drawing
      const offsetX = canvasCenter.x - mapCenter.x * this.zoomLevel;
      const offsetY = canvasCenter.y - mapCenter.y * this.zoomLevel;
      
      // Draw each portal
      for (const portal of this.portalLocations) {
        const screenX = offsetX + portal.x * this.zoomLevel;
        const screenY = offsetY + portal.z * this.zoomLevel;
        
        // Draw portal icon (circle with ring)
        this.ctx.fillStyle = this.data.portalColor;
        
        // Draw outer ring
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw inner circle
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw portal name
        if (this.zoomLevel > 0.7) { // Only show names at certain zoom levels
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(portal.name, screenX, screenY + 20);
        }
      }
    },
    
    drawOtherPlayers: function(canvasCenter, mapCenter) {
      // Calculate offset for drawing
      const offsetX = canvasCenter.x - mapCenter.x * this.zoomLevel;
      const offsetY = canvasCenter.y - mapCenter.y * this.zoomLevel;
      
      // Get other players from the remote players object (from game.js)
      if (!window.remotePlayers) return;
      
      // Draw each other player
      for (const id in window.remotePlayers) {
        const playerData = window.remotePlayers[id];
        
        // Skip if no position data
        if (!playerData.position) continue;
        
        const screenX = offsetX + playerData.position.x * this.zoomLevel;
        const screenY = offsetY + playerData.position.z * this.zoomLevel;
        
        // Draw player marker (small circle)
        this.ctx.fillStyle = this.data.otherPlayerColor;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw player name if available
        if (playerData.name && this.zoomLevel > 0.8) {
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(playerData.name, screenX, screenY - 8);
        }
      }
    },
    
    updateCoordinatesDisplay: function(position) {
      // Update coordinates text
      this.coordsDisplay.textContent = `X: ${Math.floor(position.x)} Z: ${Math.floor(position.z)} Y: ${Math.floor(position.y)}`;
    },
    
    addPathPoint: function(position) {
      // Only add point if it's significantly different from the last one
      if (this.pathPoints.length > 0) {
        const lastPoint = this.pathPoints[this.pathPoints.length - 1];
        const dx = position.x - lastPoint.x;
        const dz = position.z - lastPoint.z;
        const distanceSquared = dx * dx + dz * dz;
        
        // Skip if too close to last point (less than 5 units)
        if (distanceSquared < 25) return;
      }
      
      // Add position to path
      this.pathPoints.push({
        x: position.x,
        y: position.y,
        z: position.z,
        timestamp: Date.now()
      });
      
      // Limit path length
      if (this.pathPoints.length > this.data.maxPathPoints) {
        this.pathPoints.shift(); // Remove oldest point
      }
      
      // Update map if visible
      if (this.isVisible) {
        this.drawMap();
      }
    },
    
    addBookmark: function(name, position, color = '#FFCC00') {
      // Add a new bookmark at the given position
      this.bookmarks.push({
        name,
        position: { ...position },
        color,
        timestamp: Date.now()
      });
      
      // Show notification
      this.showNotification(`Bookmark added: ${name}`);
      
      // Update map if visible
      if (this.isVisible) {
        this.drawMap();
      }
      
      // Save bookmarks to local storage
      this.saveBookmarks();
      
      return this.bookmarks.length - 1; // Return index of new bookmark
    },
    
    removeBookmark: function(index) {
      if (index >= 0 && index < this.bookmarks.length) {
        const removed = this.bookmarks.splice(index, 1);
        
        // Show notification
        this.showNotification(`Bookmark removed: ${removed[0].name}`);
        
        // Update map if visible
        if (this.isVisible) {
          this.drawMap();
        }
        
        // Save bookmarks to local storage
        this.saveBookmarks();
        
        return true;
      }
      return false;
    },
    
    saveBookmarks: function() {
      // Save bookmarks to local storage
      try {
        localStorage.setItem('eigengrau-bookmarks', JSON.stringify(this.bookmarks));
      } catch (e) {
        console.warn('Failed to save bookmarks to local storage:', e);
      }
    },
    
    loadBookmarks: function() {
      // Load bookmarks from local storage
      try {
        const stored = localStorage.getItem('eigengrau-bookmarks');
        if (stored) {
          this.bookmarks = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Failed to load bookmarks from local storage:', e);
      }
    },
    
    recordVibeLocation: function(position) {
      // Record the location of a collected vibe
      this.vibeLocations.push({
        x: position.x,
        y: position.y,
        z: position.z,
        timestamp: Date.now()
      });
      
      // Limit to 100 vibe locations
      if (this.vibeLocations.length > 100) {
        this.vibeLocations.shift(); // Remove oldest
      }
      
      // Update map if visible
      if (this.isVisible) {
        this.drawMap();
      }
    },
    
    exportMap: function() {
      // Export the map as an image
      try {
        const dataUrl = this.mapCanvas.toDataURL('image/png');
        
        // Create a download link
        const link = document.createElement('a');
        link.download = `eigengrau-map-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        
        this.showNotification('Map exported as PNG');
      } catch (e) {
        console.error('Failed to export map:', e);
        this.showNotification('Failed to export map', true);
      }
    },
    
    exportJourney: function() {
      // Export path data as JSON
      try {
        const journeyData = {
          player: window.playerName || 'Unknown',
          timestamp: Date.now(),
          pathPoints: this.pathPoints,
          bookmarks: this.bookmarks,
          vibeLocations: this.vibeLocations
        };
        
        // Convert to JSON string
        const jsonData = JSON.stringify(journeyData, null, 2);
        
        // Create a download link
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `eigengrau-journey-${Date.now()}.json`;
        link.href = url;
        link.click();
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        this.showNotification('Journey data exported as JSON');
      } catch (e) {
        console.error('Failed to export journey data:', e);
        this.showNotification('Failed to export journey data', true);
      }
    },
    
    showNotification: function(message, isError = false) {
      // Create or reuse notification element
      let notification = document.getElementById('map-notification');
      
      if (!notification) {
        notification = document.createElement('div');
        notification.id = 'map-notification';
        
        // Style the notification
        Object.assign(notification.style, {
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          backgroundColor: 'rgba(0, 100, 150, 0.8)',
          color: 'white',
          borderRadius: '5px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          zIndex: '1001',
          opacity: '0',
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: 'none'
        });
        
        document.body.appendChild(notification);
      }
      
      // Set message and color
      notification.textContent = message;
      notification.style.backgroundColor = isError ? 'rgba(200, 50, 50, 0.8)' : 'rgba(0, 100, 150, 0.8)';
      
      // Show notification
      notification.style.opacity = '1';
      
      // Hide after a delay
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = setTimeout(() => {
        notification.style.opacity = '0';
      }, 3000);
    },
    
    bindKeyEvents: function() {
      // Bind keyboard shortcut (I key) to toggle map
      document.addEventListener('keydown', (e) => {
        // Only respond if not typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Toggle map on 'I' key press
        if (e.key.toLowerCase() === 'i') {
          this.toggleMap();
        }
      });
    },
    
    tick: function(time) {
      // Skip processing if map is not visible
      if (!this.isVisible) return;
      
      // Only update at interval
      if (time - this.lastUpdate < this.data.updateInterval) return;
      this.lastUpdate = time;
      
      // Redraw map
      this.drawMap();
    },
    
    remove: function() {
      // Clean up
      if (this.mapContainer && this.mapContainer.parentNode) {
        this.mapContainer.parentNode.removeChild(this.mapContainer);
      }
      
      // Remove event listeners
      document.removeEventListener('keydown', this.bindKeyEvents);
      
      // Remove from global
      delete window.mapSystem;
    }
  });