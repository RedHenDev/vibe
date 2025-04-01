// Enhanced Topographic Map System for Eigengrau Light
// Shows player location, tracks journey, displays NPCs, and renders altitude contours

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const mapSystemEntity = document.createElement('a-entity');
        mapSystemEntity.setAttribute('id', 'map-system');
        mapSystemEntity.setAttribute('map-system', '');
        scene.appendChild(mapSystemEntity);
        console.log('Enhanced topographic map system initialized');
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
      showNPCs: { type: 'boolean', default: true },     // Show NPCs
      showPath: { type: 'boolean', default: true },     // Show player's path
      showContours: { type: 'boolean', default: true }, // Show altitude contours
      maxPathPoints: { type: 'number', default: 500 },  // Maximum path points to store
      backgroundColor: { type: 'color', default: '#001122' }, // Map background color
      playerColor: { type: 'color', default: '#00FF00' },     // Player marker color
      pathColor: { type: 'color', default: '#FFFFFF' },       // Path color
      portalColor: { type: 'color', default: '#00FF00' },     // Portal marker color
      npcColor: { type: 'color', default: '#FF4444' },        // NPC marker color
      nocturnalNpcColor: { type: 'color', default: '#FF0000' }, // Nocturnal NPC color
      otherPlayerColor: { type: 'color', default: '#FFFFFF' }, // Other players color
      contourInterval: { type: 'number', default: 10 },       // Height between contour lines
      contourColor: { type: 'color', default: '#30809E' },    // Base contour line color
      sampleResolution: { type: 'number', default: 8 }        // Terrain sampling resolution
    },
  
    init: function() {
      this.createMapUI();
      this.player = document.querySelector('#player').object3D;
      this.pathPoints = [];
      this.bookmarks = [];
      this.isVisible = false;
      this.zoomLevel = 1;
      this.centerOffset = { x: 0, y: 0 };
      this.trackPath = true;
      this.npcLocations = [];
      this.portalLocations = [
        { x: -95, y: 55, z: -19, name: "Vibeverse Portal" }
      ];
      this.terrainCache = new Map();
      this.contourData = null;
      this.contoursNeedUpdate = true;
      this.getTerrainHeight = window.getTerrainHeight;
      this.lastUpdate = 0;
      this.lastFullUpdate = 0;
      this.fullUpdateInterval = 5000;
      this.loadBookmarks();
      window.mapSystem = this;
      this.bindKeyEvents();
      console.log('Enhanced topographic map system ready');
    },
  
    createMapUI: function() {
      this.mapContainer = document.createElement('div');
      this.mapContainer.id = 'map-container';
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
  
      this.mapCanvas = document.createElement('canvas');
      this.mapCanvas.width = this.data.pixelSize;
      this.mapCanvas.height = this.data.pixelSize;
  
      this.contourCanvas = document.createElement('canvas');
      this.contourCanvas.width = this.data.pixelSize;
      this.contourCanvas.height = this.data.pixelSize;
      this.contourCanvas.style.position = 'absolute';
      this.contourCanvas.style.top = '0';
      this.contourCanvas.style.left = '0';
      this.contourCanvas.style.pointerEvents = 'none';
  
      Object.assign(this.mapCanvas.style, {
        width: '100%',
        height: '100%'
      });
  
      this.mapContainer.appendChild(this.mapCanvas);
      this.mapContainer.appendChild(this.contourCanvas);
  
      this.ctx = this.mapCanvas.getContext('2d');
      this.contourCtx = this.contourCanvas.getContext('2d');
  
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
      this.titleDisplay.textContent = 'EIGENGRAU TOPOGRAPHIC MAP';
      this.mapContainer.appendChild(this.titleDisplay);
  
      this.createLegend();
      this.createControls();
      document.body.appendChild(this.mapContainer);
      this.setupDragPan();
      this.setupZoom();
    },
  
    // Placeholder implementations for methods not fully provided in the query
    createLegend: function() { /* Implemented as per original */ },
    createControls: function() { /* Implemented as per original */ },
    setupDragPan: function() { /* Implemented as per original */ },
    setupZoom: function() { /* Implemented as per original */ },
    zoom: function(direction) { /* Implemented as per original */ },
    resetView: function() { /* Implemented as per original */ },
    toggleContours: function() { /* Implemented as per original */ },
    toggleMap: function() { /* Implemented as per original */ },
    showMap: function() { /* Implemented as per original */ },
    hideMap: function() { /* Implemented as per original */ },
    drawMap: function() { /* Implemented as per original */ },
    drawGrid: function(canvasCenter, mapCenter) { /* Implemented as per original */ },
    drawContours: function(canvasCenter, mapCenter) { /* Implemented as per original */ },
    drawContourLines: function(heightData, worldCoords, offsetX, offsetY) { /* Implemented as per original */ },
  
    marchingSquares: function(heightData, worldCoords, level, offsetX, offsetY) {
      const rows = heightData.length - 1;
      const cols = heightData[0].length - 1;
  
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const topLeft = heightData[y][x];
          const topRight = heightData[y][x + 1];
          const bottomLeft = heightData[y + 1][x];
          const bottomRight = heightData[y + 1][x + 1];
  
          const caseIndex = (topLeft > level ? 8 : 0) +
                            (topRight > level ? 4 : 0) +
                            (bottomRight > level ? 2 : 0) +
                            (bottomLeft > level ? 1 : 0);
  
          if (caseIndex === 0 || caseIndex === 15) continue;
  
          const screenTopLeft = {
            x: offsetX + worldCoords[y][x].x * this.zoomLevel,
            y: offsetY + worldCoords[y][x].z * this.zoomLevel
          };
          const screenTopRight = {
            x: offsetX + worldCoords[y][x + 1].x * this.zoomLevel,
            y: offsetY + worldCoords[y][x + 1].z * this.zoomLevel
          };
          const screenBottomLeft = {
            x: offsetX + worldCoords[y + 1][x].x * this.zoomLevel,
            y: offsetY + worldCoords[y + 1][x].z * this.zoomLevel
          };
          const screenBottomRight = {
            x: offsetX + worldCoords[y + 1][x + 1].x * this.zoomLevel,
            y: offsetY + worldCoords[y + 1][x + 1].z * this.zoomLevel
          };
  
          const interpolate = (p1, height1, p2, height2) => {
            const t = (level - height1) / (height2 - height1);
            return {
              x: p1.x + t * (p2.x - p1.x),
              y: p1.y + t * (p2.y - p1.y)
            };
          };
  
          let point1, point2;
  
          switch (caseIndex) {
            case 1: // Bottom left above
              point1 = interpolate(screenBottomLeft, bottomLeft, screenTopLeft, topLeft);
              point2 = interpolate(screenBottomLeft, bottomLeft, screenBottomRight, bottomRight);
              break;
            case 2: // Bottom right above
              point1 = interpolate(screenBottomRight, bottomRight, screenBottomLeft, bottomLeft);
              point2 = interpolate(screenBottomRight, bottomRight, screenTopRight, topRight);
              break;
            case 3: // Bottom left and bottom right above
              point1 = interpolate(screenBottomLeft, bottomLeft, screenTopLeft, topLeft);
              point2 = interpolate(screenBottomRight, bottomRight, screenTopRight, topRight);
              break;
            case 4: // Top right above
              point1 = interpolate(screenTopRight, topRight, screenTopLeft, topLeft);
              point2 = interpolate(screenTopRight, topRight, screenBottomRight, bottomRight);
              break;
            case 5: // Top right and bottom left above (saddle point)
              point1 = interpolate(screenTopRight, topRight, screenTopLeft, topLeft);
              point2 = interpolate(screenBottomLeft, bottomLeft, screenTopLeft, topLeft);
              this.contourCtx.beginPath();
              this.contourCtx.moveTo(point1.x, point1.y);
              this.contourCtx.lineTo(point2.x, point2.y);
              this.contourCtx.stroke();
              point1 = interpolate(screenTopRight, topRight, screenBottomRight, bottomRight);
              point2 = interpolate(screenBottomLeft, bottomLeft, screenBottomRight, bottomRight);
              break;
            case 6: // Top right and bottom right above
              point1 = interpolate(screenTopRight, topRight, screenTopLeft, topLeft);
              point2 = interpolate(screenBottomRight, bottomRight, screenBottomLeft, bottomLeft);
              break;
            case 7: // Top right, bottom right, bottom left above
              point1 = interpolate(screenTopRight, topRight, screenTopLeft, topLeft);
              point2 = interpolate(screenBottomLeft, bottomLeft, screenTopLeft, topLeft);
              break;
            case 8: // Top left above
              point1 = interpolate(screenTopLeft, topLeft, screenBottomLeft, bottomLeft);
              point2 = interpolate(screenTopLeft, topLeft, screenTopRight, topRight);
              break;
            case 9: // Top left and bottom left above
              point1 = interpolate(screenTopLeft, topLeft, screenTopRight, topRight);
              point2 = interpolate(screenBottomLeft, bottomLeft, screenBottomRight, bottomRight);
              break;
            case 10: // Top left and bottom right above (saddle point)
              point1 = interpolate(screenTopLeft, topLeft, screenBottomLeft, bottomLeft);
              point2 = interpolate(screenBottomRight, bottomRight, screenBottomLeft, bottomLeft);
              this.contourCtx.beginPath();
              this.contourCtx.moveTo(point1.x, point1.y);
              this.contourCtx.lineTo(point2.x, point2.y);
              this.contourCtx.stroke();
              point1 = interpolate(screenTopLeft, topLeft, screenTopRight, topRight);
              point2 = interpolate(screenBottomRight, bottomRight, screenTopRight, topRight);
              break;
            case 11: // Top left, bottom left, bottom right above
              point1 = interpolate(screenTopLeft, topLeft, screenTopRight, topRight);
              point2 = interpolate(screenBottomRight, bottomRight, screenTopRight, topRight);
              break;
            case 12: // Top left and top right above
              point1 = interpolate(screenTopLeft, topLeft, screenBottomLeft, bottomLeft);
              point2 = interpolate(screenTopRight, topRight, screenBottomRight, bottomRight);
              break;
            case 13: // Top left, top right, bottom left above
              point1 = interpolate(screenTopRight, topRight, screenBottomRight, bottomRight);
              point2 = interpolate(screenBottomLeft, bottomLeft, screenBottomRight, bottomRight);
              break;
            case 14: // Top left, top right, bottom right above
              point1 = interpolate(screenBottomLeft, bottomLeft, screenTopLeft, topLeft);
              point2 = interpolate(screenBottomRight, bottomRight, screenTopRight, topRight);
              break;
          }
  
          if (point1 && point2) {
            this.contourCtx.beginPath();
            this.contourCtx.moveTo(point1.x, point1.y);
            this.contourCtx.lineTo(point2.x, point2.y);
            this.contourCtx.stroke();
          }
        }
      }
    },
  
    // Remaining methods assumed to be implemented elsewhere
    bindKeyEvents: function() { /* Bind keys like 'M' to toggle map */ },
    loadBookmarks: function() { /* Load from local storage */ },
    drawPath: function(canvasCenter, mapCenter) { /* Draw player path */ },
    drawBookmarks: function(canvasCenter, mapCenter) { /* Draw bookmarks */ },
    drawPortals: function(canvasCenter, mapCenter) { /* Draw portals */ },
    updateNPCLocations: function() { /* Update NPC positions */ },
    drawNPCs: function(canvasCenter, mapCenter) { /* Draw NPCs */ },
    drawOtherPlayers: function(canvasCenter, mapCenter) { /* Draw other players */ },
    drawPlayerMarker: function(canvasCenter) { /* Draw player marker */ },
    updateCoordinatesDisplay: function(playerPos) { /* Update coords display */ },
    labelContour: function(level, heightData, worldCoords, offsetX, offsetY) { /* Label contours */ },
    exportMap: function() { /* Export map as image */ }
  });