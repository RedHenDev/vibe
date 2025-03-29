// collectibles-system.js - Complete working version

// ===============================================
// COLLECTIBLE TYPE DEFINITIONS
// ===============================================
const COLLECTIBLE_TYPES = {
    "vibe": {
        type: "procedural",
        shape: "sphere",
        color: "#FF9500",
        scale: "1 1 1",
        glow: true,
        effect: "speed",
        effectDuration: 30,
        spawnRate: 10,
        points: 1
    },
    "kaparthy": {
        type: "procedural",
        shape: "diamond",
        color: "#00DDFF",
        scale: "1.5 1.5 1.5",
        glow: true,
        rotate: true,
        effect: "special",
        effectDuration: 5,
        spawnRate: 1,
        points: 10
    },
    "crystal": {
        type: "model",
        model: "#mGlasst",
        scale: "3 3 3",
        color: "#AA00FF",
        rotate: true,
        effect: "flight",
        effectDuration: 20,
        spawnRate: 3,
        points: 5
    },
    "cubelit": {
        type: "model",
        model: "#mCublit",
        scale: "5 5 5",
        color: "#00FF88",
        rotate: true,
        effect: "luna",
        effectDuration: 30,
        spawnRate: 2,
        points: 5
    },
    "pyramid": {
        type: "procedural",
        shape: "pyramid",
        color: "#FF00CC",
        scale: "1.2 1.2 1.2",
        glow: true,
        rotate: true,
        effect: "all",
        effectDuration: 15,
        spawnRate: 1,
        points: 15
    },
    "torus": {
        type: "procedural",
        shape: "torus",
        color: "#FFFF00",
        scale: "1 1 1",
        glow: true,
        rotate: true,
        effect: "speed",
        effectDuration: 25,
        spawnRate: 3,
        points: 3
    },
    "cube": {
        type: "procedural",
        shape: "cube",
        color: "#00FFFF",
        scale: "0.8 0.8 0.8",
        glow: true,
        rotate: true,
        effect: "luna",
        effectDuration: 20,
        spawnRate: 4,
        points: 2
    },
    "octahedron": {
        type: "procedural",
        shape: "octahedron",
        color: "#FF0000",
        scale: "1 1 1",
        glow: true,
        rotate: true,
        effect: "flight",
        effectDuration: 15,
        spawnRate: 3,
        points: 4
    },
    "tetrahedron": {
        type: "procedural",
        shape: "tetrahedron",
        color: "#00FF00",
        scale: "1.2 1.2 1.2",
        glow: true,
        rotate: true,
        effect: "speed",
        effectDuration: 15,
        spawnRate: 4,
        points: 3
    },
    "decahedron": {
        type: "procedural",
        shape: "decahedron",
        color: "#8844FF",
        scale: "1.3 1.3 1.3",
        glow: true,
        rotate: true,
        effect: "special",
        effectDuration: 5,
        spawnRate: 1,
        points: 8
    }
};

// ===============================================
// COLLECTIBLE COMPONENT
// ===============================================
AFRAME.registerComponent('collectible', {
    schema: {
        type: { type: 'string', default: 'vibe' },
        collectedBy: { type: 'string', default: '' },
        uniqueId: { type: 'string', default: '' }
    },

    init: function() {
        const typeConfig = COLLECTIBLE_TYPES[this.data.type];
        if (!typeConfig) {
            console.error(`Unknown collectible type: ${this.data.type}`);
            return;
        }

        // Create visual elements
        if (typeConfig.type === 'procedural') {
            this.createProceduralVisual(typeConfig);
        } else if (typeConfig.type === 'model') {
            this.createModelVisual(typeConfig);
        }

        // Add animations
        if (typeConfig.rotate) {
            this.el.setAttribute('animation__rotate', {
                property: 'rotation',
                dur: 10000,
                easing: 'linear',
                loop: true,
                to: '0 360 0'
            });
        }

        // Add glow effects
        if (typeConfig.glow) {
            const light = document.createElement('a-entity');
            light.setAttribute('light', {
                type: 'point',
                color: typeConfig.color,
                intensity: 1.0,
                distance: 8,
                decay: 1.2
            });
            this.el.appendChild(light);
        }

        this.playerEl = document.querySelector('#player');
        this.collectionRadius = 8;
        this.syncSystem = this.el.sceneEl.systems['collectible-sync'];
    },

    tick: function() {
        if (this.data.collectedBy || !this.playerEl) return;
        if (this.isPlayerInRange()) this.collectItem();
    },

    isPlayerInRange: function() {
        const playerPos = this.playerEl.object3D.position;
        const itemPos = this.el.object3D.position;
        const dx = playerPos.x - itemPos.x;
        const dy = playerPos.y - itemPos.y;
        const dz = playerPos.z - itemPos.z;
        return (dx*dx + dy*dy + dz*dz) < (this.collectionRadius * this.collectionRadius);
    },

    collectItem: function() {
        const playerId = window.playerId || 'local-player';
        this.data.collectedBy = playerId;

        // Update systems
        if (window.collectiblesSystem) {
            window.collectiblesSystem.recordCollection(this.data.type);
        }
        if (this.syncSystem) {
            this.syncSystem.reportCollection(this.data.uniqueId, playerId);
        }

        // Apply effects
        this.applyEffect();
        this.playCollectionAnimation().then(() => {
            if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
        });
    },

    createProceduralVisual: function(typeConfig) {
        const geometries = {
            sphere: { primitive: 'sphere', radius: 0.5 },
            cube: { primitive: 'box', width: 1, height: 1, depth: 1 },
            pyramid: { primitive: 'cone', radiusBottom: 0.7, radiusTop: 0, height: 1, segmentsRadial: 4 },
            diamond: { primitive: 'sphere', radius: 0.5, segmentsWidth: 4, segmentsHeight: 2 },
            torus: { primitive: 'torus', radius: 0.5, radiusTubular: 0.1 },
            octahedron: { primitive: 'sphere', radius: 0.5, segmentsWidth: 4, segmentsHeight: 2 },
            tetrahedron: { primitive: 'cone', radiusBottom: 0.7, radiusTop: 0, height: 1, segmentsRadial: 3 },
            decahedron: { primitive: 'sphere', radius: 0.5, segmentsWidth: 5, segmentsHeight: 3 }
        };

        this.el.setAttribute('geometry', geometries[typeConfig.shape] || geometries.sphere);
        this.el.setAttribute('material', {
            color: typeConfig.color,
            metalness: 0.7,
            roughness: 0.3,
            emissive: typeConfig.glow ? typeConfig.color : '#000',
            emissiveIntensity: typeConfig.glow ? 0.5 : 0
        });
        this.el.setAttribute('scale', typeConfig.scale);
    },

    createModelVisual: function(typeConfig) {
        this.el.setAttribute('gltf-model', typeConfig.model);
        this.el.setAttribute('scale', typeConfig.scale);
        
        this.el.addEventListener('model-loaded', () => {
            this.el.object3D.traverse(node => {
                if (node.isMesh && typeConfig.color) {
                    node.material.color.set(typeConfig.color);
                    if (typeConfig.glow) {
                        node.material.emissive.set(typeConfig.color);
                        node.material.emissiveIntensity = 0.5;
                    }
                }
            });
        });
    },

    applyEffect: function() {
        const typeConfig = COLLECTIBLE_TYPES[this.data.type];
        if (!typeConfig?.effect) return;

        const player = document.querySelector('#player');
        const movement = player?.components['terrain-movement'];
        if (!movement) return;

        switch(typeConfig.effect) {
            case 'speed': movement.running = true; break;
            case 'flight': movement.flying = true; break;
            case 'luna': movement.lunaBounce = true; break;
            case 'all':
                movement.running = true;
                movement.flying = true;
                movement.lunaBounce = true;
                break;
            case 'special': this.showEffectSelectionMenu(); break;
        }

        this.showEffectMessage(typeConfig.effect, typeConfig.effectDuration);
        
        if (typeConfig.effectDuration > 0 && typeConfig.effect !== 'special') {
            setTimeout(() => this.deactivateEffect(typeConfig.effect), typeConfig.effectDuration * 1000);
        }
    },

    deactivateEffect: function(effect) {
        const player = document.querySelector('#player');
        const movement = player?.components['terrain-movement'];
        if (!movement) return;

        switch(effect) {
            case 'speed': movement.running = false; break;
            case 'flight': movement.flying = false; break;
            case 'luna': movement.lunaBounce = false; break;
            case 'all':
                movement.running = false;
                movement.flying = false;
                movement.lunaBounce = false;
                break;
        }
        this.showEffectEndMessage(effect);
    },

    showEffectMessage: function(effect, duration) {
        const messages = {
            speed: `Speed boost for ${duration}s!`,
            flight: `Flight mode for ${duration}s!`,
            luna: `Luna bounce for ${duration}s!`,
            all: `All powers for ${duration}s!`,
            special: 'Choose an effect!'
        };
        createVRNotification(messages[effect] || 'Item collected!');
    },

    showEffectEndMessage: function(effect) {
        const messages = {
            speed: 'Speed boost ended',
            flight: 'Flight mode ended',
            luna: 'Luna bounce ended',
            all: 'All powers ended'
        };
        createVRNotification(messages[effect] || 'Effect ended');
    },

    playCollectionAnimation: function() {
        return new Promise(resolve => {
            this.el.setAttribute('animation', {
                property: 'scale',
                to: '0 0 0',
                dur: 500,
                easing: 'easeInQuad'
            });
            setTimeout(resolve, 500);
        });
    },

    showEffectSelectionMenu: function() {
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            padding: 20px; background: rgba(0,0,0,0.8);
            border-radius: 10px; display: flex;
            flex-direction: column; gap: 10px;
        `;

        const effects = [
            { name: 'Super Speed', effect: 'speed', duration: 60 },
            { name: 'Flight', effect: 'flight', duration: 45 },
            { name: 'Luna Bounce', effect: 'luna', duration: 60 }
        ];

        effects.forEach(e => {
            const btn = document.createElement('button');
            btn.textContent = `${e.name} (${e.duration}s)`;
            btn.style.cssText = `
                padding: 10px; border: none; border-radius: 5px;
                background: #00DDFF; color: #000; cursor: pointer;
            `;
            btn.onclick = () => {
                this.applySpecialEffect(e.effect, e.duration);
                menu.remove();
            };
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
    },

    applySpecialEffect: function(effect, duration) {
        const player = document.querySelector('#player');
        const movement = player?.components['terrain-movement'];
        if (!movement) return;

        switch(effect) {
            case 'speed': movement.running = true; break;
            case 'flight': movement.flying = true; break;
            case 'luna': movement.lunaBounce = true; break;
        }

        this.showEffectMessage(effect, duration);
        setTimeout(() => this.deactivateEffect(effect), duration * 1000);
    }
});

// ===============================================
// COLLECTIBLE MANAGER SYSTEM
// ===============================================
AFRAME.registerSystem('collectible-manager', {
    schema: {
        spawnRadius: { default: 100 },
        maxCollectibles: { default: 20 },
        spawnInterval: { default: 10000 },
        renderDistance: { default: 128 }
    },

    init: function() {
        this.collectibles = new Map();
        this.spawnContainer = document.createElement('a-entity');
        this.spawnContainer.id = 'collectibles-container';
        this.el.sceneEl.appendChild(this.spawnContainer);
        this.lastSpawn = 0;
        this.player = document.querySelector('#player')?.object3D;
    },

    tick: function(time) {
        if (!this.player || time - this.lastSpawn < this.data.spawnInterval) return;
        this.lastSpawn = time;
        this.spawnCollectibles();
    },

    spawnCollectibles: function() {
        const needed = this.data.maxCollectibles - this.collectibles.size;
        for (let i = 0; i < Math.min(3, needed); i++) {
            this.spawnCollectible();
        }
    },

    spawnCollectible: function() {
        const type = this.chooseType();
        const id = `collectible-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const pos = this.getSpawnPosition();

        const entity = document.createElement('a-entity');
        entity.setAttribute('collectible', { type, uniqueId: id });
        entity.setAttribute('position', pos);
        entity.id = id;

        entity.addEventListener('loaded', () => {
            this.collectibles.set(id, { entity, spawnTime: Date.now() });
        });

        this.spawnContainer.appendChild(entity);
    },

    chooseType: function() {
        const types = Object.keys(COLLECTIBLE_TYPES);
        const total = types.reduce((sum, t) => sum + COLLECTIBLE_TYPES[t].spawnRate, 0);
        let random = Math.random() * total;
        
        for (const type of types) {
            random -= COLLECTIBLE_TYPES[type].spawnRate;
            if (random <= 0) return type;
        }
        return types[0];
    },

    getSpawnPosition: function() {
        const playerPos = this.player.position;
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 35;
        return {
            x: playerPos.x + Math.cos(angle) * distance,
            y: (typeof getTerrainHeight === 'function' ? getTerrainHeight(playerPos.x, playerPos.z) : playerPos.y) + 3,
            z: playerPos.z + Math.sin(angle) * distance
        };
    }
});

// ===============================================
// COLLECTIBLE TRACKER COMPONENT
// ===============================================
AFRAME.registerComponent('collectibles-tracker', {
    init: function() {
        this.stats = {
            collected: 0,
            points: 0,
            types: {}
        };
        
        window.collectiblesSystem = {
            recordCollection: (type) => {
                const config = COLLECTIBLE_TYPES[type];
                if (!config) return;

                this.stats.collected++;
                this.stats.points += config.points;
                this.stats.types[type] = (this.stats.types[type] || 0) + 1;
                
                const hud = document.querySelector('#collectibles-hud-text');
                if (hud) {
                    hud.setAttribute('value', `Items: ${this.stats.collected} | Points: ${this.stats.points}`);
                }
            }
        };
    }
});

// ===============================================
// HUD COMPONENT
// ===============================================
AFRAME.registerComponent('collectibles-hud', {
    init: function() {
        const camera = document.querySelector('#cam');
        if (!camera) return;

        const hud = document.createElement('a-entity');
        hud.setAttribute('position', '0 -0.3 -0.5');
        
        const panel = document.createElement('a-entity');
        panel.setAttribute('geometry', { primitive: 'plane', width: 0.6, height: 0.15 });
        panel.setAttribute('material', { color: '#04849d', opacity: 0.7 });
        hud.appendChild(panel);

        const text = document.createElement('a-text');
        text.setAttribute('id', 'collectibles-hud-text');
        text.setAttribute('value', 'Items: 0 | Points: 0');
        text.setAttribute('align', 'center');
        text.setAttribute('color', 'white');
        text.setAttribute('scale', '0.25 0.25 0.25');
        hud.appendChild(text);

        camera.appendChild(hud);
    }
});

// ===============================================
// NOTIFICATION SYSTEM
// ===============================================
function createVRNotification(message, duration = 3000) {
    const camera = document.querySelector('#cam');
    if (!camera) return;

    const notification = document.createElement('a-entity');
    notification.setAttribute('position', '0 -0.2 -1');
    notification.setAttribute('text', {
        value: message,
        align: 'center',
        width: 2,
        color: 'white'
    });
    notification.setAttribute('scale', '0.25 0.25 0.25');

    camera.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
}

// ===============================================
// INITIALIZATION
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (!scene) return;

    scene.addEventListener('loaded', () => {
        scene.appendChild(document.createElement('a-entity').setAttribute('collectibles-tracker', ''));
        scene.appendChild(document.createElement('a-entity').setAttribute('collectibles-hud', ''));
    });
});