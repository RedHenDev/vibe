// Leaderboard System for Eigengrau Light
// Tracks and displays scores of all connected players

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      // Create and add leaderboard manager entity
      const leaderboardEntity = document.createElement('a-entity');
      leaderboardEntity.setAttribute('id', 'leaderboard-manager');
      leaderboardEntity.setAttribute('leaderboard-manager', '');
      scene.appendChild(leaderboardEntity);
      
      // Create leaderboard toggle button
      createLeaderboardButton();
      
      console.log('Leaderboard system initialized');
    });
  }
});

// Create a button to toggle the leaderboard
function createLeaderboardButton() {
  const toggleButton = document.createElement('button');
  toggleButton.id = 'leaderboard-toggle-btn';
  toggleButton.innerHTML = '🏆';
  toggleButton.title = 'Show Leaderboard';
  
  // Style the button
  Object.assign(toggleButton.style, {
    position: 'fixed',
    top: '120px',
    right: '10px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(4, 132, 157, 0.7)',
    color: 'white',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
    zIndex: '1000',
    transition: 'background-color 0.3s, transform 0.1s'
  });
  
  // Add hover and active effects
  toggleButton.addEventListener('mouseenter', () => {
    toggleButton.style.backgroundColor = 'rgba(4, 152, 177, 0.9)';
  });
  
  toggleButton.addEventListener('mouseleave', () => {
    toggleButton.style.backgroundColor = 'rgba(4, 132, 157, 0.7)';
  });
  
  toggleButton.addEventListener('mousedown', () => {
    toggleButton.style.transform = 'scale(0.95)';
  });
  
  toggleButton.addEventListener('mouseup', () => {
    toggleButton.style.transform = 'scale(1)';
  });
  
  // Add click handler to toggle leaderboard
  toggleButton.addEventListener('click', () => {
    toggleLeaderboard();
  });
  
  // Also respond to 'L' key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'l' || e.key === 'L') {
      toggleLeaderboard();
    }
  });
  
  document.body.appendChild(toggleButton);
}

// Toggle leaderboard visibility
function toggleLeaderboard() {
  const leaderboard = document.getElementById('leaderboard-panel');
  if (leaderboard) {
    const isVisible = leaderboard.style.display !== 'none';
    leaderboard.style.display = isVisible ? 'none' : 'block';
    
    // Update button text
    const toggleButton = document.getElementById('leaderboard-toggle-btn');
    if (toggleButton) {
      toggleButton.innerHTML = isVisible ? '🏆' : '❌';
      toggleButton.title = isVisible ? 'Show Leaderboard' : 'Hide Leaderboard';
    }
  }
}

// Main leaderboard manager component
AFRAME.registerComponent('leaderboard-manager', {
  schema: {
    refreshInterval: { type: 'number', default: 1000 }, // Refresh every 1 second (more frequent)
    debug: { type: 'boolean', default: true }           // Enable debug output
  },
  
  init: function() {
    // Player score data
    this.playerScores = new Map();
    this.localScore = 0; // Track local player's score
    this.debugLog("Leaderboard manager initializing");
    
    // Create leaderboard panel
    this.createLeaderboard();
    
    // Set up WebSocket message handlers for updating scores
    this.setupWebSocketHandlers();
    
    // Refresh leaderboard periodically
    this.lastRefresh = 0;
    
    // Make the leaderboard manager globally available
    window.leaderboardManager = this;
    
    // Listen for score changes from vibes-manager
    this.listenForScoreChanges();
    
    // Add local player to leaderboard immediately if player ID exists
    this.initializeLocalPlayer();
    
    // Set a flag to force initial update 
    this.needsInitialUpdate = true;
    
    this.debugLog("Leaderboard manager initialized and connected to WebSocket");
  },
  
  debugLog: function(message, data) {
    if (this.data.debug) {
      if (data) {
        // console.log(`[Leaderboard] ${message}`, data);
      } else {
        // console.log(`[Leaderboard] ${message}`);
      }
    }
  },
  
  tick: function(time) {
    // Update leaderboard on specific intervals
    if (time - this.lastRefresh > this.data.refreshInterval || this.needsInitialUpdate) {
      this.lastRefresh = time;
      this.needsInitialUpdate = false;
      
      // Check if we need to initialize local player again (in case playerId now exists)
      if (window.playerId && !this.playerScores.has(window.playerId)) {
        this.initializeLocalPlayer();
      }
      
      // Check if local score has changed, if so, send update to server
      const currentScore = this.getLocalPlayerScore();
      if (currentScore !== this.localScore) {
        this.debugLog(`Local score changed from ${this.localScore} to ${currentScore}`);
        this.localScore = currentScore;
        this.sendScoreUpdate();
      }
      
      // Always update the leaderboard to catch any missed updates
      this.updateLeaderboard();
    }
  },
  
  // Improved initializeLocalPlayer method for the leaderboard-system.js file

initializeLocalPlayer: function() {
  // More thorough check for player identification
  if (window.playerId && window.playerName) {
    this.debugLog(`Initializing local player: ${window.playerName} (${window.playerId})`);
    
    // Get current score
    const score = this.getLocalPlayerScore();
    
    // Add to player scores
    this.playerScores.set(window.playerId, {
      name: window.playerName,
      score: score,
      isLocal: true
    });
    
    // Update leaderboard UI
    this.updateLeaderboard();
    
    // Send score update to server (with a delay to ensure connection is ready)
    setTimeout(() => this.sendScoreUpdate(), 1000);
    
    return true; // Successfully initialized
  } else {
    // Log what variables are missing to help with debugging
    const missingVars = [];
    if (!window.playerId) missingVars.push('playerId');
    if (!window.playerName) missingVars.push('playerName');
    
    this.debugLog(`Cannot initialize local player - missing: ${missingVars.join(', ')}`);
    
    // If we have player name but no ID, try to force a socket update to get the ID
    if (window.playerName && !window.playerId && window.socket && window.socket.readyState === WebSocket.OPEN) {
      this.debugLog("Have playerName but no playerId - forcing socket update");
      this.sendForcedUpdate();
    }
    
    return false; // Failed to initialize
    }
  },
  
  createLeaderboard: function() {
    // Create leaderboard panel
    const leaderboard = document.createElement('div');
    leaderboard.id = 'leaderboard-panel';
    
    // Style the panel
    Object.assign(leaderboard.style, {
      position: 'fixed',
      top: '120px',
      right: '10px',
      width: '250px',
      maxHeight: '60%',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      color: 'white',
      borderRadius: '10px',
      padding: '15px',
      zIndex: '999',
      overflowY: 'auto',
      display: 'none', // Hidden by default
      fontFamily: 'Arial, sans-serif',
      border: '2px solid rgba(4, 132, 157, 0.9)'
    });
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = 'Vibes Leaderboard';
    Object.assign(title.style, {
      margin: '0 0 10px 0',
      padding: '0 0 5px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
      textAlign: 'center',
      fontSize: '18px'
    });
    leaderboard.appendChild(title);
    
    // Add connection status indicator
    const statusElem = document.createElement('div');
    statusElem.id = 'leaderboard-status';
    statusElem.textContent = 'Connecting...';
    Object.assign(statusElem.style, {
      textAlign: 'center',
      fontSize: '12px',
      fontStyle: 'italic',
      marginBottom: '10px',
      color: '#AAAAAA'
    });
    leaderboard.appendChild(statusElem);
    
    // Create scores container
    const scoresContainer = document.createElement('div');
    scoresContainer.id = 'leaderboard-scores';
    leaderboard.appendChild(scoresContainer);
    
    // Add to document
    document.body.appendChild(leaderboard);
  },
  
  setupWebSocketHandlers: function() {
    // We need to hook into the existing WebSocket system from game.js
    const self = this;
    
    // If socket already exists and is open, set up handlers immediately
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      this.attachSocketHandlers();
    }
    
    // Also check periodically to catch when socket gets initialized
    const checkForSocket = setInterval(() => {
      if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        clearInterval(checkForSocket);
        this.attachSocketHandlers();
      }
    }, 500);
    
    // Add a backup handler for when socket is created or reconnects
    // This ensures we catch the socket creation even if we miss it initially
    const originalWebSocket = WebSocket;
    window.WebSocket = function(url, protocols) {
      const socket = new originalWebSocket(url, protocols);
      
      // Override the onopen method to add our handlers
      const originalOnOpen = socket.onopen;
      socket.onopen = function(event) {
        if (originalOnOpen) originalOnOpen.call(this, event);
        
        // Small delay to ensure socket is fully initialized
        setTimeout(() => {
          if (this === window.socket) {
            self.attachSocketHandlers();
          }
        }, 500);
      };
      
      return socket;
    };
    window.WebSocket.prototype = originalWebSocket.prototype;
    window.WebSocket.CONNECTING = originalWebSocket.CONNECTING;
    window.WebSocket.OPEN = originalWebSocket.OPEN;
    window.WebSocket.CLOSING = originalWebSocket.CLOSING;
    window.WebSocket.CLOSED = originalWebSocket.CLOSED;
  },
  
  // This is the fixed attachSocketHandlers method for the leaderboard-system.js file

attachSocketHandlers: function() {
  // Check more thoroughly for the socket availability and avoid re-attaching
  if (!window.socket || window.socket.leaderboardHandlersAttached) return;
  
  const self = this;
  this.debugLog("Attaching leaderboard handlers to socket");
  
  // Update UI status
  const statusElem = document.getElementById('leaderboard-status');
  if (statusElem) {
    statusElem.textContent = 'Connected to server';
    statusElem.style.color = '#66FF66';
  }
  
  // Store the original message handler
  const originalOnMessage = window.socket.onmessage;
  
  // Replace with our handler that still calls the original
  window.socket.onmessage = function(event) {
    // Call the original handler
    if (originalOnMessage) {
      originalOnMessage.call(this, event);
    }
    
    // Add our handler
    try {
      const message = JSON.parse(event.data);
      
      // Process different message types
      switch (message.type) {
        case 'id':
          // Make sure we check that window.playerId is set here
          self.debugLog(`Received player ID: ${message.id}, name: ${message.name}`);
          
          // Ensure our global variables are set correctly
          if (!window.playerId && message.id) {
            window.playerId = message.id;
          }
          
          if (!window.playerName && message.name) {
            window.playerName = message.name;
          }
          
          // Now initialize after ensuring variables are set
          self.initializeLocalPlayer();
          break;
          
        case 'players':
          self.debugLog("Received players update", message.players);
          self.processPlayersUpdate(message.players);
          break;
          
        case 'playerScore':
          self.debugLog(`Received player score update: ID ${message.id}, score ${message.score}`);
          self.updatePlayerScore(message.id, message.score, message.name);
          break;
          
        case 'join':
          // A new player joined, refresh the leaderboard soon
          self.debugLog(`Player joined: ${message.id} (${message.name || 'Unknown'})`);
          setTimeout(() => self.updateLeaderboard(), 500);
          break;
          
        case 'leave':
          // A player left, remove them from scores and refresh
          self.debugLog(`Player left: ${message.id} (${message.name || 'Unknown'})`);
          if (self.playerScores.has(message.id)) {
            self.playerScores.delete(message.id);
            self.updateLeaderboard();
          }
          break;
      }
    } catch (e) {
      console.error('Error in leaderboard WebSocket handler:', e);
    }
  };
  
  // Set handler for socket close
  const originalOnClose = window.socket.onclose;
  window.socket.onclose = function(event) {
    if (originalOnClose) {
      originalOnClose.call(this, event);
    }
    
    // Update UI status
    const statusElem = document.getElementById('leaderboard-status');
    if (statusElem) {
      statusElem.textContent = 'Disconnected from server';
      statusElem.style.color = '#FF6666';
    }
    
    self.debugLog("WebSocket connection closed");
  };
  
  // Mark that we've attached handlers to avoid doing it twice
  window.socket.leaderboardHandlersAttached = true;
  
  // Request players list to make sure we're up to date
  if (window.socket.readyState === WebSocket.OPEN) {
    // We can't directly request this, but we can force a position update
    // which will cause the server to send a full players list
    self.sendForcedUpdate();
  }
  
  this.debugLog("Leaderboard WebSocket handlers initialized");
},
  
  sendForcedUpdate: function() {
    // Force a position update to trigger server to send latest player data
    if (!window.socket || window.socket.readyState !== WebSocket.OPEN) return;
    
    const playerEntity = document.querySelector('#player');
    if (!playerEntity) return;
    
    const position = playerEntity.getAttribute('position');
    const camera = document.querySelector('#cam');
    if (!camera) return;
    
    const rotation = camera.object3D.rotation;
    
    window.socket.send(JSON.stringify({
      type: 'update',
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      rotation: {
        x: -rotation.x,
        y: rotation.y+3.14, 
        z: rotation.z
      }
    }));
    
    this.debugLog("Sent forced position update to get latest player data");
  },
  
  processPlayersUpdate: function(players) {
    if (!players) return;
    
    // Process the full players object from server
    let updatedAny = false;
    
    for (const id in players) {
      const player = players[id];
      
      // Check if this is a new player or updated score
      const existing = this.playerScores.get(id);
      const isLocal = id === window.playerId;
      
      // Only update if there's a change
      if (!existing || 
          existing.score !== player.score || 
          existing.name !== player.name) {
        
        this.playerScores.set(id, {
          name: player.name || 'Unknown Player',
          score: player.score || 0,
          isLocal: isLocal
        });
        
        updatedAny = true;
      }
    }
    
    // Update the leaderboard display if anything changed
    if (updatedAny) {
      this.updateLeaderboard();
    }
  },
  
  updatePlayerScore: function(id, score, name) {
    // Don't update if score is undefined
    if (score === undefined) return;
    
    // Get existing player data or create new entry
    const playerData = this.playerScores.get(id) || { 
      name: name || 'Unknown Player',
      score: 0,
      isLocal: id === window.playerId
    };
    
    // Only update if score has changed
    if (playerData.score !== score) {
      // Update the score
      playerData.score = score;
      this.playerScores.set(id, playerData);
      
      // Update the leaderboard
      this.updateLeaderboard();
    }
  },
  
  listenForScoreChanges: function() {
    // Option 1: Listen for custom events from vibes-manager
    document.addEventListener('score-updated', (event) => {
      if (event.detail && typeof event.detail.score === 'number') {
        // Update our local score tracker
        this.debugLog(`Received score-updated event: ${event.detail.score}`);
        this.localScore = event.detail.score;
        // Send update to server
        this.sendScoreUpdate();
      }
    });
    
    // Option 2: Override collectiblesManager.recordCollection to notify us
    if (window.collectiblesManager && window.collectiblesManager.recordCollection) {
      const originalRecordCollection = window.collectiblesManager.recordCollection;
      
      window.collectiblesManager.recordCollection = (type) => {
        // Call the original function to update the score
        const stats = originalRecordCollection(type);
        
        // Now send the updated score to server
        if (stats && typeof stats.points === 'number') {
          this.debugLog(`collectiblesManager.recordCollection called, points: ${stats.points}`);
          this.localScore = stats.points;
          this.sendScoreUpdate();
        }
        
        return stats;
      };
      
      this.debugLog("Overrode collectiblesManager.recordCollection");
    } else {
      this.debugLog("Warning: collectiblesManager not available for score change detection");
    }
  },
  
  getLocalPlayerScore: function() {
    // Get the current score from vibe collection system
    let score = 0;
    
    // Try various possible ways to get the vibe count
    try {
      // First, try to access collectible manager if it exists
      const scene = document.querySelector('a-scene');
      if (scene.systems['collectible-manager']) {
        const stats = scene.systems['collectible-manager'].stats;
        if (stats && typeof stats.points === 'number') {
          score = stats.points;
        }
      }
      
      // If that didn't work, try the global collectiblesManager
      if (score === 0 && window.collectiblesManager) {
        if (typeof window.collectiblesManager.getStats === 'function') {
          const stats = window.collectiblesManager.getStats();
          if (stats && typeof stats.points === 'number') {
            score = stats.points;
          }
        } else if (window.collectiblesManager.stats) {
          score = window.collectiblesManager.stats.points || 0;
        }
      }
      
      // As a fallback, check for any vibes element in the DOM
      if (score === 0) {
        const vibesElement = document.querySelector('#collectibles-hud-text');
        if (vibesElement) {
          const text = vibesElement.getAttribute('value');
          if (text) {
            const match = text.match(/vibes\s+(\d+)/i);
            if (match && match[1]) {
              score = parseInt(match[1]);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error getting local player score:', e);
    }
    
    return score;
  },
  
  sendScoreUpdate: function() {
    // Don't send if socket isn't ready
    if (!window.socket || window.socket.readyState !== WebSocket.OPEN || !window.playerId) {
      this.debugLog("Cannot send score update - socket not ready or playerId missing");
      return;
    }
    
    // Get current score
    const score = this.getLocalPlayerScore();
    
    // Update our local entry
    if (window.playerId) {
      this.updatePlayerScore(window.playerId, score, window.playerName);
    }
    
    // Send to server
    window.socket.send(JSON.stringify({
      type: 'playerScore',
      score: score
    }));
    
    //this.debugLog(`Sent score update to server: ${score}`);
  },
  
  updateLeaderboard: function() {
    const scoresContainer = document.getElementById('leaderboard-scores');
    if (!scoresContainer) return;
    
    // Clear current scores
    scoresContainer.innerHTML = '';
    
    // Get the player count
    const playerCount = this.playerScores.size;
    
    // Update the status with player count
    const statusElem = document.getElementById('leaderboard-status');
    if (statusElem) {
      statusElem.textContent = `Connected to server (${playerCount} player${playerCount !== 1 ? 's' : ''})`;
    }
    
    // Convert to array and sort by score (highest first)
    const sortedPlayers = Array.from(this.playerScores.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.score - a.score);
    
    //this.debugLog(`Updating leaderboard with ${sortedPlayers.length} players`);
    
    // Add players to leaderboard
    sortedPlayers.forEach((player, index) => {
      const playerRow = document.createElement('div');
      playerRow.className = 'leaderboard-player-row';
      Object.assign(playerRow.style, {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '5px 8px',
        margin: '2px 0',
        borderRadius: '5px',
        backgroundColor: player.isLocal ? 'rgba(4, 132, 157, 0.5)' : 'rgba(255, 255, 255, 0.1)'
      });
      
      // Rank and name
      const rankAndName = document.createElement('div');
      rankAndName.className = 'leaderboard-rank-name';
      rankAndName.textContent = `${index + 1}. ${player.name}`;
      Object.assign(rankAndName.style, {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '70%'
      });
      
      // Score
      const score = document.createElement('div');
      score.className = 'leaderboard-score';
      score.textContent = player.score;
      Object.assign(score.style, {
        fontWeight: 'bold',
        color: player.isLocal ? '#FFF' : '#AAA'
      });
      
      // Add to row
      playerRow.appendChild(rankAndName);
      playerRow.appendChild(score);
      
      // Add to container
      scoresContainer.appendChild(playerRow);
    });
    
    // If no players, add a message
    if (sortedPlayers.length === 0) {
      const noPlayers = document.createElement('div');
      noPlayers.textContent = 'No players connected';
      Object.assign(noPlayers.style, {
        textAlign: 'center',
        padding: '10px',
        color: '#AAA'
      });
      scoresContainer.appendChild(noPlayers);
      
      // Also add a debug message to help troubleshoot
      if (this.data.debug) {
        const debugMessage = document.createElement('div');
        debugMessage.innerHTML = 'Debug info:<br>' +
          `Player ID: ${window.playerId || 'Missing'}<br>` +
          `Player name: ${window.playerName || 'Missing'}<br>` +
          `Socket connected: ${window.socket && window.socket.readyState === WebSocket.OPEN ? 'Yes' : 'No'}`;
        
        Object.assign(debugMessage.style, {
          marginTop: '10px',
          fontSize: '11px',
          color: '#AAA',
          textAlign: 'left',
          padding: '5px',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)'
        });
        
        scoresContainer.appendChild(debugMessage);
      }
    }
  }
});