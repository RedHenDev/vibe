const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running');
});

// Set the port based on environment or use 8080 as default
const PORT = process.env.PORT || 8080;

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected players
const players = {};

// Handle WebSocket connections
wss.on('connection', (ws) => {
    // Generate a unique ID for the player
    const playerId = uuidv4();
    
    console.log(`New player connected: ${playerId}`);
    
    // Send the player ID
    ws.send(JSON.stringify({
        type: 'id',
        id: playerId
    }));
    
    // Handle messages from clients
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join':
                    // Add new player
                    players[playerId] = {
                        position: data.position,
                        color: data.color
                    };
                    
                    // Broadcast join event
                    broadcastToAll({
                        type: 'join',
                        id: playerId
                    });
                    
                    // Send current players to all players
                    broadcastToAll({
                        type: 'players',
                        players: players
                    });
                    break;
                    
                case 'update':
                    // Update player position
                    if (players[playerId]) {
                        players[playerId].position = data.position;
                        
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
    
    // Handle client disconnection
    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        
        // Remove player
        delete players[playerId];
        
        // Broadcast leave event
        broadcastToAll({
            type: 'leave',
            id: playerId
        });
        
        // Broadcast updated players list
        broadcastToAll({
            type: 'players',
            players: players
        });
    });
});

// Broadcast message to all connected clients
function broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});