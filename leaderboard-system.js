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
    refreshInterval: { type: 'number', default: 2000 } // Refresh every 2 seconds
  },
  
  init: function() {
    // Player score data
    this.playerScores = new Map();
    
    // Create leaderboard panel
    this.createLeaderboard();
    
    // Set up WebSocket message handlers for updating scores
    this.setupWebSocketHandlers();
    
    // Refresh leaderboard periodically
    this.lastRefresh = 0;
    
    // Make the leaderboard manager globally available
    window.leaderboardManager = this;
  },
  
  tick: function(time) {
    // Update leaderboard periodically
    if (time - this.lastRefresh > this.data.refreshInterval) {
      this.lastRefresh = time;
      this.updateLeaderboard();
    }
  },
  
  createLeaderboard: function() {
    // Create leaderboard panel
    const leaderboard = document.createElement('div');
    leaderboard.id = 'leaderboard-panel';
    
    // Style the panel
    Object.assign(leaderboard.style, {
      position: 'fixed',
      top: '80px',
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
    
    // Create scores container
    const scoresContainer = document.createElement('div');
    scoresContainer.id = 'leaderboard-scores';
    leaderboard.appendChild(scoresContainer);
    
    // Add to document
    document.body.appendChild(leaderboard);
  },
  
  setupWebSocketHandlers: function() {
    // Use existing socket if available
    if (window.socket) {
      const originalOnMessage = window.socket.onmessage;
      
      window.socket.onmessage = (event) => {
        // Call original handler
        if (originalOnMessage) {
          originalOnMessage.call(window.socket, event);
        }
        
        // Handle our messages
        try {
          const message = JSON.parse(event.data);
          
          // Handle different message types
          if (message.type === 'players') {
            this.updatePlayerScores(message.players);
          } else if (message.type === 'playerScore') {
            this.updatePlayerScore(message.id, message.score);
          }
        } catch (e) {
          console.error('Error parsing leaderboard message:', e);
        }
      };
      
      // Send our initial score
      this.sendScoreUpdate();
    }
  },
  
  sendScoreUpdate: function() {
    // Only send if socket is available
    if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Get current score
    let score = 0;
    
    // Try to get score from collectibles manager
    if (window.collectiblesManager && window.collectiblesManager.getStats) {
      const stats = window.collectiblesManager.getStats();
      score = stats.points;
    } else {
      // Try to get from system directly
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems['collectible-manager']) {
        score = scene.systems['collectible-manager'].stats.points;
      }
    }
    
    // Send score update
    window.socket.send(JSON.stringify({
      type: 'playerScore',
      score: score
    }));
  },
  
  updatePlayerScores: function(players) {
    for (const id in players) {
      const player = players[id];
      
      // Skip if no name
      if (!player.name) continue;
      
      // Update or add player
      this.playerScores.set(id, {
        name: player.name,
        score: player.score || 0
      });
    }
    
    // Update local player
    if (window.playerId && window.playerName) {
      // Get current score
      let score = 0;
      
      // Try to get from system directly
      const scene = document.querySelector('a-scene');
      if (scene && scene.systems['collectible-manager']) {
        score = scene.systems['collectible-manager'].stats.points;
      }
      
      this.playerScores.set(window.playerId, {
        name: window.playerName,
        score: score,
        isLocal: true
      });
    }
    
    // Update the leaderboard display
    this.updateLeaderboard();
  },
  
  updatePlayerScore: function(id, score) {
    if (!this.playerScores.has(id)) {
      // We don't have this player yet, ignore
      return;
    }
    
    // Update score
    const playerData = this.playerScores.get(id);
    playerData.score = score;
    this.playerScores.set(id, playerData);
    
    // Update the leaderboard display
    this.updateLeaderboard();
  },
  
  updateLeaderboard: function() {
    const scoresContainer = document.getElementById('leaderboard-scores');
    if (!scoresContainer) return;
    
    // Clear current scores
    scoresContainer.innerHTML = '';
    
    // Convert to array and sort by score (highest first)
    const sortedPlayers = Array.from(this.playerScores.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.score - a.score);
    
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
    }
    
    // Send our score update to others (but not too often)
    if (Math.random() < 0.2) { // Only 20% of updates to reduce traffic
      this.sendScoreUpdate();
    }
  }
});

// Helper function to update the server.js code
function updateServerJS() {
  // This is just a reference for server-side changes needed
  // These changes would need to be made to the actual server.js file
  
  /*
  // Add to the existing WebSocket message handler in server.js
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        // Existing cases...
        
        case 'playerScore':
          // Update player's score
          if (players[playerId]) {
            players[playerId].score = data.score;
            
            // Broadcast updated players
            broadcastToAll({
              type: 'players',
              players: players
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Modify the players object structure to include scores
  const playerId = uuidv4();
  players[playerId] = {
    position: data.position,
    rotation: data.rotation || { x: 0, y: 0, z: 0 },
    color: data.color,
    model: data.model,
    name: playerName,
    score: 0 // Initialize score
  };
  */
}
