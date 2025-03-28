// Game configuration.
const config = {
    websocketUrl: 'wss://weeble-server.glitch.me/',
    playerColors: ['white', 'black'],
    playerModels: ['#mShelby'] // Available models for player avatars
};

// Create a billboard component that makes entities always face the camera
AFRAME.registerComponent('billboard', {
    init: function() {
        this.camera = document.querySelector('#cam').object3D;
    },
    
    tick: function() {
        if (!this.camera) return;
        
        // Get the camera position
        const cameraPosition = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPosition);
        
        // Make this entity face the camera
        this.el.object3D.lookAt(cameraPosition);
        
        // Prevent X and Z rotation to keep text upright
        const rotation = this.el.object3D.rotation;
        rotation.x = 0;
        rotation.z = 0;
    }
});

// Name generation data
const mathematicians = [
    'Euclid', 'Pythagoras', 'Archimedes', 'Newton', 'Gauss', 'Euler', 'Fermat', 
    'Riemann', 'Ramanujan', 'Einstein', 'Hilbert', 'Turing', 'Gödel', 'Lovelace', 
    'Noether', 'Galois', 'Cantor', 'Cauchy', 'Lagrange', 'Leibniz', 'Pascal', 
    'Poincaré', 'Boole', 'Fibonacci', 'Bernoulli', 'Descartes', 'Fourier', 
    'Kolmogorov', 'Laplace', 'Hypatia', 'Karpathy'
];

const mathConcepts = [
    'Prime', 'Integer', 'Vector', 'Matrix', 'Tensor', 'Calculus', 'Infinity', 
    'Fractal', 'Quantum', 'Topology', 'Symmetry', 'Algorithm', 'Quaternion', 
    'Polynomial', 'Function', 'Manifold', 'Theorem', 'Equation', 'Probability', 
    'Derivative', 'Integral', 'Sequence', 'Series', 'Group', 'Ring', 'Field', 
    'Logic', 'Set', 'Graph', 'Dimension'
];

// Game state
let socket;
let playerId;
window.playerName; // Store our player's name
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

// Generate a unique mathematical name
function generateMathName() {
    const mathematician = mathematicians[Math.floor(Math.random() * mathematicians.length)];
    const concept = mathConcepts[Math.floor(Math.random() * mathConcepts.length)];
    return `${mathematician} ${concept}`;
}

// Connect to the WebSocket server
function connectToServer() {
    try {
        socket = new WebSocket(config.websocketUrl);
        
        socket.onopen = () => {
            // Generate a name for our player
            playerName = generateMathName();
            
            document.getElementById('connection-status').textContent = 'Connection status: Connecting...';
            
            // Wait a brief moment to ensure the player position is initialized
            setTimeout(() => {
                // Send initial player data with current position
                const playerEntity = document.querySelector('#player');
                const position = playerEntity.getAttribute('position');
                const camera = document.querySelector('#cam');
                const rotation = camera.object3D.rotation;
                
                socket.send(JSON.stringify({
                    type: 'join',
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    rotation: {
                        x: rotation.x,
                        y: rotation.y,
                        z: rotation.z
                    },
                    color: getRandomColor(),
                    model: getRandomModel(),
                    name: playerName
                }));
            }, 1000);
        };
        
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'id':
                    playerId = message.id;
                    console.log(`Connected with ID: ${playerId}, Name: ${message.name}`);
                    
                    // If server assigned a different name, update our local name
                    if (message.name && message.name !== playerName) {
                        playerName = message.name;
                    }
                    
                    // Update connection status with player name
                    document.getElementById('connection-status').textContent = 
                        `Connected as: ${playerName} (${message.playerCount} player${message.playerCount !== 1 ? 's' : ''} online)`;
                    break;
                    
                case 'players':
                    updatePlayers(message.players);
                    break;
                    
                case 'join':
                    console.log(`Player joined: ${message.id} (${message.name})`);
                    break;
                    
                case 'leave':
                    console.log(`Player left: ${message.id} (${message.name || 'Unknown'})`);
                    removePlayer(message.id);
                    break;
                    
                case 'playerCount':
                    document.getElementById('connection-status').textContent = 
                        `Connected as: ${playerName} (${message.count} player${message.count !== 1 ? 's' : ''} online)`;
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

function getRandomModel() {
    return config.playerModels[Math.floor(Math.random() * config.playerModels.length)];
}

// Sync local player position with server
function syncPlayerPosition() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !playerId) {
        return;
    }
    
    const playerEntity = document.querySelector('#player');
    const position = playerEntity.getAttribute('position');
    
    // Get camera rotation
    const camera = document.querySelector('#cam');
    const rotation = camera.object3D.rotation;
    
    // Send updated position and rotation to server
    socket.send(JSON.stringify({
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
    
    // Update global player count
    window.playerCount = Object.keys(remotePlayers).length + 1;
    
    // Update nametags to face camera (as an additional fallback)
    for (const id in remotePlayers) {
        const playerEntity = document.getElementById(`player-${id}`);
        if (playerEntity) {
            const nameTag = playerEntity.querySelector('a-text');
            if (nameTag && !nameTag.hasAttribute('billboard')) {
                // If a nametag doesn't have the billboard component, add it
                nameTag.setAttribute('billboard', '');
            }
        }
    }
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
            
            // Create player model using GLB
            const playerModel = document.createElement('a-entity');
            playerModel.setAttribute('gltf-model', data.model || config.playerModels[0]);
            playerModel.setAttribute('scale', '8 8 8'); // Scale to appropriate size
            playerModel.setAttribute('position', '0 0 0');
            
            // Create name tag (floating text above player)
            const nameTag = document.createElement('a-text');
            nameTag.setAttribute('value', data.name || 'Unknown Player');
            nameTag.setAttribute('position', '0 12 0'); // Position above player
            nameTag.setAttribute('align', 'center');
            nameTag.setAttribute('scale', '8 8 8'); // Scale for readability
            nameTag.setAttribute('color', data.color || '#FFFFFF');
            nameTag.setAttribute('billboard', ''); // Always face camera using a custom component
            
            // Add color to model if specified
            if (data.color) {
                playerModel.setAttribute('material', `color: ${data.color}`);
            }
            
            // Add model and name tag to player entity
            playerEntity.appendChild(playerModel);
            playerEntity.appendChild(nameTag);
            
            // Add player entity to the scene
            playersContainer.appendChild(playerEntity);
            
            console.log(`Created new remote player: ${data.name || 'Unknown'} with model ${data.model || 'default'}`);
            
            // Store player data
            remotePlayers[id] = data;
        }
        
        // Update player position
        const playerEntity = document.getElementById(`player-${id}`);
        if (playerEntity) {
            playerEntity.setAttribute('position', `${data.position.x} ${data.position.y} ${data.position.z}`);
            
            // Update player rotation if available
            if (data.rotation) {
                // Apply rotation to the model, not the parent entity (which contains the name tag)
                const playerModel = playerEntity.querySelector('[gltf-model]');
                if (playerModel) {
                    playerModel.setAttribute('rotation', {
                        x: data.rotation.x * (180/Math.PI), // Convert radians to degrees
                        y: data.rotation.y * (180/Math.PI),
                        z: data.rotation.z * (180/Math.PI)
                    });
                }
            }
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
        console.log(`Removed player entity for ${remotePlayers[id]?.name || id}`);
    }
    
    delete remotePlayers[id];
}