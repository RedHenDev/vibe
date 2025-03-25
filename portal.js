// Portal System for Eigengrau Light
// Allows travel between games in the Vibeverse webring

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const portalSystemEntity = document.createElement('a-entity');
      portalSystemEntity.setAttribute('id', 'portal-system');
      portalSystemEntity.setAttribute('portal-system', '');
      scene.appendChild(portalSystemEntity);
      console.log('Portal system initialized');
    });
  }
});

// Main portal system component
AFRAME.registerComponent('portal-system', {
  init: function() {
    // Check if we should create a start portal (coming from another game)
    const urlParams = new URLSearchParams(window.location.search);
    const fromPortal = urlParams.get('portal') === 'true';
    const refUrl = urlParams.get('ref');
    
    // Always create exit portal
    this.createExitPortal();
    
    // Create start portal if coming from another game
    if (fromPortal && refUrl) {
      this.createStartPortal(refUrl, urlParams);
    }
    
    // Get player reference for collision detection
    this.playerEl = document.querySelector('#player');
    
    // Set up interval to check for portal collisions
    this.checkInterval = setInterval(() => {
      this.checkPortalCollisions();
    }, 200); // Check every 500ms
  },
  
  createExitPortal: function() {
    // Create exit portal entity
    const exitPortal = document.createElement('a-entity');
    exitPortal.setAttribute('id', 'exit-portal');
    
    // Position the portal in the world
    exitPortal.setAttribute('position', '-200 30 -300');
    
    // Create visible portal ring (torus)
    const portalRing = document.createElement('a-torus');
    portalRing.setAttribute('color', '#00ff00');
    portalRing.setAttribute('radius', '15');
    portalRing.setAttribute('radius-tubular', '2');
    portalRing.setAttribute('segments-tubular', '32');
    portalRing.setAttribute('segments-radial', '16');
    portalRing.setAttribute('material', 'emissive: #00ff00; emissiveIntensity: 0.5; transparent: true; opacity: 0.8');
    exitPortal.appendChild(portalRing);
    
    // Create portal inner surface (disc)
    const portalInner = document.createElement('a-circle');
    portalInner.setAttribute('color', '#00ff00');
    portalInner.setAttribute('radius', '13');
    portalInner.setAttribute('material', 'transparent: true; opacity: 0.5; side: double');
    exitPortal.appendChild(portalInner);
    
    // Add portal label
    const portalLabel = document.createElement('a-text');
    portalLabel.setAttribute('value', 'VIBEVERSE PORTAL');
    portalLabel.setAttribute('position', '0 20 0');
    portalLabel.setAttribute('color', '#000000');
    portalLabel.setAttribute('align', 'center');
    portalLabel.setAttribute('scale', '10 10 10');
    portalLabel.setAttribute('side', 'double');
    exitPortal.appendChild(portalLabel);
    
    // Add to scene
    this.el.appendChild(exitPortal);
    
    // Store for collision detection
    this.exitPortal = exitPortal;
  },
  
  createStartPortal: function(refUrl, urlParams) {
    // Create start portal entity
    const startPortal = document.createElement('a-entity');
    startPortal.setAttribute('id', 'start-portal');
    
    // Position near player spawn
    startPortal.setAttribute('position', '10 10 -10');
    
    // Create visible portal ring (torus)
    const portalRing = document.createElement('a-torus');
    portalRing.setAttribute('color', '#ff0000');
    portalRing.setAttribute('radius', '15');
    portalRing.setAttribute('radius-tubular', '2');
    portalRing.setAttribute('segments-tubular', '32');
    portalRing.setAttribute('segments-radial', '16');
    portalRing.setAttribute('material', 'emissive: #ff0000; emissiveIntensity: 0.5; transparent: true; opacity: 0.8');
    startPortal.appendChild(portalRing);
    
    // Create portal inner surface (disc)
    const portalInner = document.createElement('a-circle');
    portalInner.setAttribute('color', '#ff0000');
    portalInner.setAttribute('radius', '13');
    portalInner.setAttribute('material', 'transparent: true; opacity: 0.5; side: double');
    startPortal.appendChild(portalInner);
    
    // Add portal label - extract domain from refUrl for display
    let domain = refUrl;
    if (domain.startsWith('http://')) domain = domain.substring(7);
    if (domain.startsWith('https://')) domain = domain.substring(8);
    if (domain.startsWith('www.')) domain = domain.substring(4);
    
    const portalLabel = document.createElement('a-text');
    portalLabel.setAttribute('value', `RETURN TO ${domain.toUpperCase()}`);
    portalLabel.setAttribute('position', '0 20 0');
    portalLabel.setAttribute('color', '#ff0000');
    portalLabel.setAttribute('align', 'center');
    portalLabel.setAttribute('scale', '10 10 10');
    portalLabel.setAttribute('side', 'double');
    startPortal.appendChild(portalLabel);
    
    // Store original URL for return journey
    startPortal.setAttribute('data-ref-url', refUrl);
    
    // Add all URL parameters to data attributes
    for (const [key, value] of urlParams.entries()) {
      startPortal.setAttribute(`data-param-${key}`, value);
    }
    
    // Add to scene
    this.el.appendChild(startPortal);
    
    // Store for collision detection
    this.startPortal = startPortal;
    
    // Set player position near start portal (they're coming out of it)
    if (this.playerEl) {
      // Position player 20 units in front of portal
      const portalPos = startPortal.getAttribute('position');
      this.playerEl.setAttribute('position', `${portalPos.x} ${portalPos.y} ${portalPos.z + 20}`);
    }
  },
  
  checkPortalCollisions: function() {
    // Skip if no player
    if (!this.playerEl) return;
    
    const playerPos = this.playerEl.getAttribute('position');
    
    // Check exit portal collision
    if (this.exitPortal) {
      const exitPortalPos = this.exitPortal.getAttribute('position');
      const distanceToExit = this.calculateDistance(playerPos, exitPortalPos);
      
      // If player is close to exit portal
      if (distanceToExit < 30) {
        this.enterExitPortal();
      }
    }
    
    // Check start portal collision
    if (this.startPortal) {
      const startPortalPos = this.startPortal.getAttribute('position');
      const distanceToStart = this.calculateDistance(playerPos, startPortalPos);
      
      // If player is close to start portal
      if (distanceToStart < 30) {
        this.enterStartPortal();
      }
    }
  },
  
  calculateDistance: function(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  },
  
  enterExitPortal: function() {
    // Prevent multiple executions
    if (this.transitioning) return;
    this.transitioning = true;
    
    // Create URL for portal.pieter.com with necessary parameters
    const params = new URLSearchParams();
    
    // Add required parameters
    params.append('portal', 'true');
    
    // Add username (use player name from game.js if available)
    const playerName = window.playerName || 'Eigengrau';
    params.append('username', playerName);
    
    // Add color
    params.append('color', 'white');
    
    // Add speed - get from terrain-movement component if available
    let speed = 5;
    if (this.playerEl.components['terrain-movement']) {
      const tmc = this.playerEl.components['terrain-movement'];
      speed = tmc.running ? 10 : 5;
    }
    params.append('speed', speed);
    
    // Add ref URL (current page)
    params.append('ref', window.location.href.split('?')[0]);
    
    // Get player position and rotation for continuity
    const playerPos = this.playerEl.getAttribute('position');
    const cameraRotation = document.querySelector('#cam').getAttribute('rotation');
    
    // Add optional position and rotation
    params.append('speed_x', 0);
    params.append('speed_y', 0);
    params.append('speed_z', speed);
    params.append('rotation_x', cameraRotation.x);
    params.append('rotation_y', cameraRotation.y);
    params.append('rotation_z', cameraRotation.z);
    
    // Construct final URL
    const portalUrl = `https://portal.pieter.com/?${params.toString()}`;
    
    // Redirect after slight delay for visual effect
    setTimeout(() => {
      window.location.href = portalUrl;
    }, 500);
  },
  
  enterStartPortal: function() {
    // Prevent multiple executions
    if (this.transitioning) return;
    this.transitioning = true;
    
    // Get return URL from portal data attribute
    let returnUrl = this.startPortal.getAttribute('data-ref-url');
    
    // Ensure URL has proper protocol
    if (!returnUrl.startsWith('http://') && !returnUrl.startsWith('https://')) {
      returnUrl = 'https://' + returnUrl;
    }
    
    // Create URL parameters for return journey
    const params = new URLSearchParams();
    
    // Add portal=true to indicate coming from portal
    params.append('portal', 'true');
    
    // Add all parameters from when we arrived
    const allAttributes = this.startPortal.getAttributeNames();
    for (const attr of allAttributes) {
      if (attr.startsWith('data-param-') && attr !== 'data-param-ref' && attr !== 'data-param-portal') {
        const paramName = attr.substring('data-param-'.length);
        const paramValue = this.startPortal.getAttribute(attr);
        params.append(paramName, paramValue);
      }
    }
    
    // Add our game as the ref
    params.append('ref', window.location.href.split('?')[0]);
    
    // Get player position and rotation for continuity
    const playerPos = this.playerEl.getAttribute('position');
    const cameraRotation = document.querySelector('#cam').getAttribute('rotation');
    
    // Add optional position and rotation
    params.append('speed_x', 0);
    params.append('speed_y', 0);
    params.append('speed_z', 5);
    params.append('rotation_x', cameraRotation.x);
    params.append('rotation_y', cameraRotation.y);
    params.append('rotation_z', cameraRotation.z);
    
    // Construct final URL
    const returnPortalUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}${params.toString()}`;
    
    // Redirect after slight delay for visual effect
    setTimeout(() => {
      window.location.href = returnPortalUrl;
    }, 500);
  },
  
  remove: function() {
    // Clean up
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
});
