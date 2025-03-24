//LEGACY
// Game configuration.
const config = {
    websocketUrl: 'wss://weeble-server.glitch.me/',
    playerColors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'magenta']
};

// Game state
let socket;
let playerId;
let remotePlayers = {};

// Make player count globally accessible for a-loco.js
window.playerCount = 1;

// Initialize WebSocket connection
document.addEventListener('DOMContentLoaded', () => {
    // Connect to WebSocket server
    connectToServer();
    
    // Start sync loop
    setInterval(syncPlayerPosition, 100);
});

// Connect to the WebSocket server
function connectToServer() {
    try {
        socket = new WebSocket(config.websocketUrl);
        
        socket.onopen = () => {
            document.getElementById('connection-status').textContent = 'Connection status: Connected';
            
            // Wait a brief moment to ensure the player position is initialized
            setTimeout(() => {
                // Send initial player data with current position
                const playerEntity = document.querySelector('#player');
                const position = playerEntity.getAttribute('position');
                
                socket.send(JSON.stringify({
                    type: 'join',
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    color: getRandomColor()
                }));
            }, 1000);
        };
        
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'id':
                    playerId = message.id;
                    console.log('Connected with ID:', playerId);
                    break;
                    
                case 'players':
                    updatePlayers(message.players);
                    break;
                    
                case 'join':
                    console.log('Player joined:', message.id);
                    break;
                    
                case 'leave':
                    console.log('Player left:', message.id);
                    removePlayer(message.id);
                    break;
            }
        };
        
        socket.onclose = () => {
            document.getElementById('connection-status').textContent = 'Connection status: Disconnected';
            console.log('Connection closed');
            
            // Try to reconnect after 5 seconds
            setTimeout(connectToServer, 5000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Failed to connect to server:', error);
    }
}

// Random helper functions
function getRandomColor() {
    return config.playerColors[Math.floor(Math.random() * config.playerColors.length)];
}

// Sync local player position with server
function syncPlayerPosition() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !playerId) {
        return;
    }
    
    const playerEntity = document.querySelector('#player');
    const position = playerEntity.getAttribute('position');
    
    // Send updated position to server
    socket.send(JSON.stringify({
        type: 'update',
        position: {
            x: position.x,
            y: position.y,
            z: position.z
        }
    }));
    
    // Update global player count (will be used by a-loco.js)
    window.playerCount = Object.keys(remotePlayers).length + 1;
}

// Update other player entities based on server data
function updatePlayers(playerData) {
    const playersContainer = document.getElementById('players');
    
    // Update existing players and add new ones
    for (const id in playerData) {
        // Skip our own player - we'll handle that separately
        if (id === playerId) continue;
        
        const data = playerData[id];
        
        if (!remotePlayers[id]) {
            // Create new player entity
            const playerEntity = document.createElement('a-entity');
            playerEntity.setAttribute('id', `player-${id}`);
            
            // Create player body (box)
            const playerBody = document.createElement('a-box');
            playerBody.setAttribute('color', data.color);
            playerBody.setAttribute('width', '1');
            playerBody.setAttribute('height', '4.6'); // Match player height
            playerBody.setAttribute('depth', '1');
            playerBody.setAttribute('position', '0 2.3 0'); // Center at half height
            
            // Create player head (sphere)
            const playerHead = document.createElement('a-sphere');
            playerHead.setAttribute('color', data.color);
            playerHead.setAttribute('radius', '0.5');
            playerHead.setAttribute('position', '0 4.8 0'); // Place on top of body
            
            // Add parts to player entity
            playerEntity.appendChild(playerBody);
            playerEntity.appendChild(playerHead);
            
            // Add player entity to the scene
            playersContainer.appendChild(playerEntity);
            
            // Store player data
            remotePlayers[id] = data;
        }
        
        // Update player position
        const playerEntity = document.getElementById(`player-${id}`);
        if (playerEntity) {
            playerEntity.setAttribute('position', `${data.position.x} ${data.position.y} ${data.position.z}`);
        }
        
        // Update stored player data
        remotePlayers[id] = data;
    }
    
    // Remove players that are no longer in the data
    for (const id in remotePlayers) {
        if (!playerData[id]) {
            removePlayer(id);
        }
    }
}

// Remove a player who left the game
function removePlayer(id) {
    const playerEntity = document.getElementById(`player-${id}`);
    if (playerEntity) {
        playerEntity.parentNode.removeChild(playerEntity);
    }
    
    delete remotePlayers[id];
}