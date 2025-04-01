// Map System Integration for Eigengrau Light
// Integrates the map system with game mechanics and adds keyboard shortcuts

document.addEventListener('DOMContentLoaded', () => {
    // Set up the integration after the scene is loaded
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        // Wait briefly to ensure map system is initialized
        setTimeout(setupMapIntegration, 2000);
      });
    }
  });
  
  // Key bindings for map integration
  const MAP_KEYS = {
    TOGGLE: 'i',           // Toggle map
    ZOOM_IN: '+',          // Zoom in
    ZOOM_OUT: '-',         // Zoom out
    RESET_VIEW: 'r',       // Reset view
    BOOKMARK: 'b',         // Add bookmark
    EXPORT: 'e',           // Export map
    PATH_TOGGLE: 'p',      // Toggle path tracking
    BOOKMARK_LIST: 'l',    // List bookmarks
    HELP: 'h'              // Show map help
  };
  
  // Function to set up integration with game systems
  function setupMapIntegration() {
    // Check if map system is available
    if (!window.mapSystem) {
      console.warn('Map integration: Map system not found, retrying...');
      setTimeout(setupMapIntegration, 2000);
      return;
    }
  
    console.log('Setting up map integration with game systems');
  
    // Load any saved bookmarks
    window.mapSystem.loadBookmarks();
  
    // Add keyboard shortcuts
    setupKeyBindings();
  
    // Set up path tracking
    setupPathTracking();
  
    // Add UI buttons to map controls
    addHelpButton();
    addExportButton();
    addBookmarkButton();
  
    // Integrate with collectibles system
    //integrateWithCollectibles();
  
    // Notify user that the map is ready
    window.mapSystem.showNotification('Map available! Press I to open');
  }
  
  // Function to set up keyboard shortcuts
  function setupKeyBindings() {
    document.addEventListener('keydown', (e) => {
      if (!window.mapSystem) return;
  
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
      const key = e.key.toLowerCase();
      const map = window.mapSystem;
  
      // Only process shortcuts when map is visible, except for toggle
      switch (key) {
        case MAP_KEYS.TOGGLE:
          map.toggleMap();
          e.preventDefault();
          break;
        case MAP_KEYS.ZOOM_IN:
          if (map.isVisible) {
            map.zoom(1);
            e.preventDefault();
          }
          break;
        case MAP_KEYS.ZOOM_OUT:
          if (map.isVisible) {
            map.zoom(-1);
            e.preventDefault();
          }
          break;
        case MAP_KEYS.RESET_VIEW:
          if (map.isVisible) {
            map.resetView();
            e.preventDefault();
          }
          break;
        case MAP_KEYS.BOOKMARK:
          if (map.isVisible) {
            promptBookmark();
            e.preventDefault();
          }
          break;
        case MAP_KEYS.EXPORT:
          if (map.isVisible) {
            map.exportMap();
            e.preventDefault();
          }
          break;
        case MAP_KEYS.PATH_TOGGLE:
          if (map.isVisible) {
            togglePathTracking();
            e.preventDefault();
          }
          break;
        case MAP_KEYS.BOOKMARK_LIST:
          if (map.isVisible) {
            showBookmarkList();
            e.preventDefault();
          }
          break;
        case MAP_KEYS.HELP:
          if (map.isVisible) {
            showMapHelp();
            e.preventDefault();
          }
          break;
      }
    });
  }
  
  // Function to set up path tracking
  function setupPathTracking() {
    if (!window.mapSystem) return;
  
    // Initialize path tracking flag
    window.mapSystem.trackPath = true;
  
    // Set interval to track player position every 5 seconds
    setInterval(() => {
      if (!window.mapSystem.trackPath) return;
  
      const player = document.querySelector('#player');
      if (player && player.object3D) {
        window.mapSystem.addPathPoint(player.object3D.position);
      }
    }, 5000);
  }
  
  // Function to toggle path tracking
  function togglePathTracking() {
    if (!window.mapSystem) return;
  
    window.mapSystem.trackPath = !window.mapSystem.trackPath;
    window.mapSystem.showNotification(`Path tracking: ${window.mapSystem.trackPath ? 'ON' : 'OFF'}`);
  }
  
  // Function to prompt for bookmark creation
  function promptBookmark() {
    if (!window.mapSystem) return;
  
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '2000'
    });
  
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      padding: '20px',
      borderRadius: '10px',
      maxWidth: '400px',
      width: '80%',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    });
  
    const title = document.createElement('h3');
    title.textContent = 'Add Bookmark';
    title.style.margin = '0 0 15px 0';
    title.style.color = '#0CF';
    dialog.appendChild(title);
  
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter bookmark name';
    Object.assign(nameInput.style, {
      width: '100%',
      padding: '8px',
      marginBottom: '15px',
      boxSizing: 'border-box',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(0, 200, 255, 0.5)',
      borderRadius: '4px',
      color: 'white'
    });
    dialog.appendChild(nameInput);
  
    const colorContainer = document.createElement('div');
    colorContainer.textContent = 'Bookmark color: ';
    colorContainer.style.marginBottom = '15px';
    colorContainer.style.display = 'flex';
    colorContainer.style.alignItems = 'center';
  
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#FFCC00';
    colorInput.style.marginLeft = '10px';
    colorInput.style.cursor = 'pointer';
    colorContainer.appendChild(colorInput);
    dialog.appendChild(colorContainer);
  
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
  
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    Object.assign(cancelButton.style, {
      padding: '8px 15px',
      backgroundColor: 'rgba(100, 100, 100, 0.5)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    });
    buttonContainer.appendChild(cancelButton);
  
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    Object.assign(saveButton.style, {
      padding: '8px 15px',
      backgroundColor: 'rgba(0, 150, 200, 0.7)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    });
    buttonContainer.appendChild(saveButton);
  
    dialog.appendChild(buttonContainer);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
  
    nameInput.focus();
  
    cancelButton.addEventListener('click', () => document.body.removeChild(modal));
    saveButton.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (name) {
        const player = document.querySelector('#player');
        if (player && player.object3D) {
          window.mapSystem.addBookmark(name, player.object3D.position, colorInput.value);
        }
      }
      document.body.removeChild(modal);
    });
  
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.body.removeChild(modal);
      else if (e.key === 'Enter') saveButton.click();
    });
  }
  
  // Function to add help button to map controls
  function addHelpButton() {
    if (!window.mapSystem || !window.mapSystem.controls) return;
  
    const helpButton = document.createElement('button');
    helpButton.textContent = '?';
    helpButton.title = 'Map Help';
    Object.assign(helpButton.style, {
      backgroundColor: 'rgba(0, 120, 180, 0.7)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '5px 10px',
      fontSize: '14px',
      cursor: 'pointer',
      fontFamily: 'Arial, sans-serif',
      marginLeft: '5px'
    });
  
    helpButton.addEventListener('click', showMapHelp);
    window.mapSystem.controls.appendChild(helpButton);
  }
  
  // Function to add export button to map controls
  function addExportButton() {
    if (!window.mapSystem || !window.mapSystem.controls) return;
  
    const exportButton = document.createElement('button');
    exportButton.textContent = '📥';
    exportButton.title = 'Export Map Data';
    Object.assign(exportButton.style, {
      backgroundColor: 'rgba(0, 120, 180, 0.7)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '5px 10px',
      fontSize: '14px',
      cursor: 'pointer',
      fontFamily: 'Arial, sans-serif',
      marginLeft: '5px'
    });
  
    exportButton.addEventListener('click', () => {
      const menu = document.createElement('div');
      Object.assign(menu.style, {
        position: 'absolute',
        bottom: '40px',
        right: '10px',
        backgroundColor: 'rgba(0, 30, 60, 0.9)',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
        zIndex: '1002',
        padding: '5px 0'
      });
  
      const addMenuItem = (text, onClick) => {
        const item = document.createElement('div');
        item.textContent = text;
        Object.assign(item.style, {
          padding: '8px 15px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          color: 'white'
        });
  
        item.addEventListener('mouseover', () => item.style.backgroundColor = 'rgba(0, 150, 200, 0.5)');
        item.addEventListener('mouseout', () => item.style.backgroundColor = '');
        item.addEventListener('click', () => {
          onClick();
          document.body.removeChild(menu);
        });
  
        menu.appendChild(item);
      };
  
      addMenuItem('Export Map Image', () => window.mapSystem.exportMap());
      addMenuItem('Export Journey Data', () => window.mapSystem.exportJourney());
  
      document.body.appendChild(menu);
  
      const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== exportButton) {
          document.body.removeChild(menu);
          document.removeEventListener('click', closeHandler);
        }
      };
  
      setTimeout(() => document.addEventListener('click', closeHandler), 100);
    });
  
    window.mapSystem.controls.appendChild(exportButton);
  }
  
  // Function to add bookmark button to map controls
  function addBookmarkButton() {
    if (!window.mapSystem || !window.mapSystem.controls) return;
  
    const bookmarkButton = document.createElement('button');
    bookmarkButton.textContent = '📌';
    bookmarkButton.title = 'Add Bookmark';
    Object.assign(bookmarkButton.style, {
      backgroundColor: 'rgba(0, 120, 180, 0.7)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '5px 10px',
      fontSize: '14px',
      cursor: 'pointer',
      fontFamily: 'Arial, sans-serif',
      marginLeft: '5px'
    });
  
    bookmarkButton.addEventListener('click', promptBookmark);
    window.mapSystem.controls.appendChild(bookmarkButton);
  }
  
  // Function to show map help modal
  function showMapHelp() {
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '2000'
    });
  
    const helpContent = document.createElement('div');
    Object.assign(helpContent.style, {
      backgroundColor: 'rgba(0, 20, 40, 0.95)',
      padding: '20px',
      borderRadius: '10px',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '80%',
      overflowY: 'auto',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    });
  
    const title = document.createElement('h2');
    title.textContent = 'Map Controls';
    title.style.color = '#0CF';
    title.style.marginTop = '0';
    helpContent.appendChild(title);
  
    const shortcutsTitle = document.createElement('h3');
    shortcutsTitle.textContent = 'Keyboard Shortcuts';
    helpContent.appendChild(shortcutsTitle);
  
    const shortcuts = [
      ['I', 'Toggle map on/off'],
      ['+', 'Zoom in'],
      ['-', 'Zoom out'],
      ['R', 'Reset view'],
      ['B', 'Add bookmark at current position'],
      ['L', 'Show bookmark list'],
      ['P', 'Toggle path tracking'],
      ['E', 'Export map data'],
      ['H', 'Show this help']
    ];
  
    const shortcutsList = document.createElement('div');
    shortcuts.forEach(([key, description]) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.marginBottom = '8px';
  
      const keySpan = document.createElement('div');
      keySpan.textContent = key;
      Object.assign(keySpan.style, {
        backgroundColor: 'rgba(0, 100, 150, 0.7)',
        padding: '2px 8px',
        borderRadius: '4px',
        marginRight: '10px',
        fontFamily: 'monospace',
        minWidth: '20px',
        textAlign: 'center',
        fontWeight: 'bold'
      });
      item.appendChild(keySpan);
  
      const descSpan = document.createElement('div');
      descSpan.textContent = description;
      item.appendChild(descSpan);
  
      shortcutsList.appendChild(item);
    });
    helpContent.appendChild(shortcutsList);
  
    const usageTitle = document.createElement('h3');
    usageTitle.textContent = 'Map Usage';
    helpContent.appendChild(usageTitle);
  
    const usageInfo = document.createElement('p');
    usageInfo.innerHTML = `
      <ul>
        <li><strong>Drag</strong> the map to pan around</li>
        <li>Use <strong>mousewheel</strong> or <strong>+ / - buttons</strong> to zoom</li>
        <li><strong>Bookmarks</strong> save and name locations</li>
        <li>Your <strong>path</strong> is tracked as you explore</li>
        <li>See <strong>other players</strong> in real-time</li>
        <li><strong>Export</strong> map as image or journey data</li>
      </ul>
    `;
    helpContent.appendChild(usageInfo);
  
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    Object.assign(closeButton.style, {
      display: 'block',
      margin: '20px auto 0',
      padding: '8px 20px',
      backgroundColor: 'rgba(0, 150, 200, 0.7)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '16px'
    });
    closeButton.addEventListener('click', () => document.body.removeChild(modal));
    helpContent.appendChild(closeButton);
  
    modal.appendChild(helpContent);
    document.body.appendChild(modal);
  
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.body.removeChild(modal);
    });
  }
  
  // Function to show bookmark list modal
  function showBookmarkList() {
    if (!window.mapSystem) return;
  
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '2000'
    });
  
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      backgroundColor: 'rgba(0, 20, 40, 0.95)',
      padding: '20px',
      borderRadius: '10px',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '80%',
      overflowY: 'auto',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    });
  
    const title = document.createElement('h2');
    title.textContent = 'Bookmarks';
    title.style.color = '#0CF';
    title.style.marginTop = '0';
    dialog.appendChild(title);
  
    const bookmarkList = document.createElement('div');
    if (window.mapSystem.bookmarks.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent = 'No bookmarks yet. Press B on the map to add one.';
      bookmarkList.appendChild(emptyMessage);
    } else {
      window.mapSystem.bookmarks.forEach((bookmark, index) => {
        const item = document.createElement('div');
        Object.assign(item.style, {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px',
          borderBottom: '1px solid rgba(100, 150, 200, 0.2)',
          marginBottom: '5px'
        });
  
        const colorIndicator = document.createElement('div');
        Object.assign(colorIndicator.style, {
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: bookmark.color || '#FFCC00',
          marginRight: '10px'
        });
  
        const nameSpan = document.createElement('div');
        nameSpan.textContent = bookmark.name;
        nameSpan.style.flexGrow = '1';
  
        const coordsSpan = document.createElement('div');
        coordsSpan.textContent = `X: ${Math.floor(bookmark.position.x)}, Z: ${Math.floor(bookmark.position.z)}`;
        coordsSpan.style.color = '#AAA';
        coordsSpan.style.fontSize = '12px';
        coordsSpan.style.marginRight = '10px';
  
        const removeButton = document.createElement('button');
        removeButton.textContent = '✕';
        removeButton.title = 'Remove bookmark';
        Object.assign(removeButton.style, {
          backgroundColor: 'rgba(200, 50, 50, 0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        });
  
        removeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          window.mapSystem.removeBookmark(index);
          document.body.removeChild(modal);
          showBookmarkList(); // Refresh list
        });
  
        item.appendChild(colorIndicator);
        item.appendChild(nameSpan);
        item.appendChild(coordsSpan);
        item.appendChild(removeButton);
  
        item.addEventListener('click', () => {
          window.mapSystem.centerOffset = {
            x: bookmark.position.x - window.mapSystem.player.position.x,
            y: bookmark.position.z - window.mapSystem.player.position.z
          };
          window.mapSystem.drawMap();
          document.body.removeChild(modal);
        });
  
        item.addEventListener('mouseover', () => {
          item.style.backgroundColor = 'rgba(50, 100, 150, 0.3)';
          item.style.cursor = 'pointer';
        });
        item.addEventListener('mouseout', () => item.style.backgroundColor = '');
  
        bookmarkList.appendChild(item);
      });
    }
  
    dialog.appendChild(bookmarkList);
  
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    Object.assign(closeButton.style, {
      display: 'block',
      margin: '20px auto 0',
      padding: '8px 20px',
      backgroundColor: 'rgba(0, 150, 200, 0.7)',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '16px'
    });
    closeButton.addEventListener('click', () => document.body.removeChild(modal));
    dialog.appendChild(closeButton);
  
    modal.appendChild(dialog);
    document.body.appendChild(modal);
  
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.body.removeChild(modal);
    });
  }
  
  // Function to integrate with collectibles system
  function integrateWithCollectibles() {
    const checkInterval = setInterval(() => {
      if (window.collectiblesManager) {
        clearInterval(checkInterval);
  
        const originalRecordCollection = window.collectiblesManager.recordCollection;
  
        window.collectiblesManager.recordCollection = function(type) {
          const result = originalRecordCollection.call(window.collectiblesManager, type);
  
          if (type === 'vibe' && window.mapSystem) {
            const player = document.querySelector('#player');
            if (player && player.object3D) {
              window.mapSystem.recordVibeLocation(player.object3D.position);
            }
          }
  
          return result;
        };
  
        console.log('Map system integrated with collectibles');
      }
    }, 500);
  }