// Game config.
const config = {
    websocketUrl: 'wss://weeble-server.glitch.me/',
    terrainSize: 50,
    terrainResolution: 20,
    playerSize: 1,
    playerHeight: 0.5,
    playerColors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'magenta'],
    moveSpeed: 0.15
};

// Game state.
let socket;
let playerId;
let players = {};
let controls = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Random helper functions.
function getRandomColor() {
    return config.playerColors[Math.floor(Math.random() * config.playerColors.length)];
}

function getRandomPosition() {
    const pos = Math.floor(config.terrainSize / 4);
    return {
        x: Math.random() * pos * 2 - pos,
        y: 0,
        z: Math.random() * pos * 2 - pos
    };
}

// Initialize game.
document.addEventListener('DOMContentLoaded', () => {
    // Generate terrain.
    generateTerrain();
    
    // Connect to WebSocket server
    connectToServer();
    
    // Set up keyboard controls
    setupControls();
    
    // Start game loop
    setInterval(gameLoop, 50);
});

// Generate a random bumpy terrain.
function generateTerrain() {
    const terrain = document.getElementById('landscape');
    const size = config.terrainSize;
    const resolution = config.terrainResolution;
    const step = size / resolution;
    
    for (let x = 0; x < resolution; x++) {
        for (let z = 0; z < resolution; z++) {
            const posX = (x * step) - (size / 2);
            const posZ = (z * step) - (size / 2);
            
            // Create a random height for each terrain segment.
            const height = Math.random() * 2;
            
            // Create a plane for each segment.
            const plane = document.createElement('a-box');
            plane.setAttribute('position', `${posX} ${height/2} ${posZ}`);
            plane.setAttribute('width', step);
            plane.setAttribute('height', height);
            plane.setAttribute('depth', step);
            plane.setAttribute('color', `rgb(${100 + height * 50}, ${120 + height * 50}, ${80 + height * 20})`);
            
            terrain.appendChild(plane);
        }
    }
    
    // Add a large plane underneath for boundaries.
    const ground = document.createElement('a-plane');
    ground.setAttribute('position', '0 -0.1 0');
    ground.setAttribute('rotation', '-90 0 0');
    ground.setAttribute('width', size * 1.5);
    ground.setAttribute('height', size * 1.5);
    ground.setAttribute('color', '#7BC8A4');
    
    terrain.appendChild(ground);
}

// Connect to the WebSocket server.
function connectToServer() {
    try {
        socket = new WebSocket(config.websocketUrl);
        
        socket.onopen = () => {
            document.getElementById('connection-status').textContent = 'Connection status: Connected';
            
            // Send initial player data.
            const initialPosition = getRandomPosition();
            socket.send(JSON.stringify({
                type: 'join',
                position: initialPosition,
                color: getRandomColor()
            }));
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
            
            // Try to reconnect after 5 seconds.
            setTimeout(connectToServer, 5000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Failed to connect to server:', error);
    }
}

// Update player entities based on server data.
function updatePlayers(playerData) {
    const playersContainer = document.getElementById('players');
    
    // Update existing players and add new ones.
    for (const id in playerData) {
        const data = playerData[id];
        
        if (!players[id]) {
            // Create new player entity.
            const playerEntity = document.createElement('a-box');
            playerEntity.setAttribute('id', `player-${id}`);
            playerEntity.setAttribute('color', data.color);
            playerEntity.setAttribute('width', config.playerSize);
            playerEntity.setAttribute('height', config.playerHeight);
            playerEntity.setAttribute('depth', config.playerSize);
            
            // Add player entity to the scene.
            playersContainer.appendChild(playerEntity);
            
            // Store player data.
            players[id] = data;
        }
        
        // Update player position.
        const playerEntity = document.getElementById(`player-${id}`);
        if (playerEntity) {
            playerEntity.setAttribute('position', `${data.position.x} ${data.position.y + config.playerHeight/2} ${data.position.z}`);
        }
        
        // Update stored player data.
        players[id] = data;
    }
}

// Remove a player who left the game.
function removePlayer(id) {
    const playerEntity = document.getElementById(`player-${id}`);
    if (playerEntity) {
        playerEntity.parentNode.removeChild(playerEntity);
    }
    
    delete players[id];
}

// Set up keyboard controls.
function setupControls() {
    document.addEventListener('keydown', (event) => {
        if (controls.hasOwnProperty(event.key)) {
            controls[event.key] = true;
        }
    });
    
    document.addEventListener('keyup', (event) => {
        if (controls.hasOwnProperty(event.key)) {
            controls[event.key] = false;
        }
    });
}

// Main game loop.
function gameLoop() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !playerId || !players[playerId]) {
        return;
    }
    
    // Calculate movement based on controls.
    const position = players[playerId].position;
    let moved = false;
    
    if (controls.ArrowUp) {
        position.z -= config.moveSpeed;
        moved = true;
    }
    if (controls.ArrowDown) {
        position.z += config.moveSpeed;
        moved = true;
    }
    if (controls.ArrowLeft) {
        position.x -= config.moveSpeed;
        moved = true;
    }
    if (controls.ArrowRight) {
        position.x += config.moveSpeed;
        moved = true;
    }
    
    // Keep player within boundaries.
    position.x = Math.max(-config.terrainSize/2, Math.min(config.terrainSize/2, position.x));
    position.z = Math.max(-config.terrainSize/2, Math.min(config.terrainSize/2, position.z));
    
    // Send position update to server if moved.
    if (moved) {
        socket.send(JSON.stringify({
            type: 'update',
            position: position
        }));
    }
}