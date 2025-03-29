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
      
      // Also send our current score to server
      this.sendScoreUpdate();
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
    
    // Wait for WebSocket to be initialized by game.js
    const checkForSocket = setInterval(() => {
      if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        clearInterval(checkForSocket);
        
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
            
            // Process players message for updating scores
            if (message.type === 'players') {
              self.processPlayersUpdate(message.players);
            }
            
            // Handle specific score updates
            if (message.type === 'playerScore') {
              self.updatePlayerScore(message.id, message.score, message.name);
            }
          } catch (e) {
            console.error('Error in leaderboard WebSocket handler:', e);
          }
        };
        
        console.log('Leaderboard WebSocket handlers initialized');
      }
    }, 500);
  },
  
  processPlayersUpdate: function(players) {
    // Process the full players object from server
    for (const id in players) {
      const player = players[id];
      
      // Add or update player in our scores map
      this.playerScores.set(id, {
        name: player.name || 'Unknown Player',
        score: player.score || 0,
        isLocal: id === window.playerId
      });
    }
  },
  
  updatePlayerScore: function(id, score, name) {
    // Update a specific player's score
    const playerData = this.playerScores.get(id) || { 
      name: name || 'Unknown Player',
      score: 0,
      isLocal: id === window.playerId
    };
    
    playerData.score = score;
    this.playerScores.set(id, playerData);
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
  }
});