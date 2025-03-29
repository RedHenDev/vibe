// Projectile System for Eigengrau Light
// Allows players to fire projectiles that can push other entities

document.addEventListener('DOMContentLoaded', function() {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', function() {
        const projectileSystemEntity = document.createElement('a-entity');
        projectileSystemEntity.setAttribute('id', 'projectile-system');
        projectileSystemEntity.setAttribute('projectile-system', '');
        scene.appendChild(projectileSystemEntity);
        console.log('Projectile system initialized');
      });
    }
  });
  
  // Main projectile system component
  AFRAME.registerComponent('projectile-system', {
    schema: {
      maxProjectiles: { type: 'number', default: 50 },       // Maximum number of projectiles
      projectileSpeed: { type: 'number', default: 90 },      // Speed of projectiles
      projectileLifetime: { type: 'number', default: 2000 }, // How long projectiles live (ms)
      impactLifetime: { type: 'number', default: 2000 },     // How long projectiles remain after impact (ms)
      cooldown: { type: 'number', default: 200 },            // Cooldown between shots (ms)
      pushForce: { type: 'number', default: 5 },             // Force applied when hitting targets
      projectileColor: { type: 'color', default: '#00CCFF' }, // Icy blue projectile color
      projectileSize: { type: 'number', default: 0.5 },      // Size of projectiles
      trailEnabled: { type: 'boolean', default: true },      // Enable trail effects
      showFireButton: { type: 'boolean', default: true },    // Show fire button on mobile
      debug: { type: 'boolean', default: false },             // Show debug info
      enabled: { type: 'boolean', default: true }            // Enable/disable the system
    },
    
    init: function() {
      // Initialize projectile instances
      this.initProjectileInstances();
      
      // Store active projectiles
      this.activeProjectiles = [];
      
      // Keep track of when we can fire next
      this.lastFireTime = 0;
      
      // Touch tracking for distinguishing taps from drags
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchStartTime = 0;
      this.touchMoved = false;
      this.maxTapDistance = 10; // Max pixels to consider a touch a tap, not a drag
      this.maxTapDuration = 300; // Max milliseconds to consider a touch a tap, not a drag
      
      // Get references to important elements
      this.player = document.querySelector('#player').object3D;
      this.camera = document.querySelector('#cam').object3D;
      
      // Get terrain function for height checks
      this.getTerrainHeight = window.getTerrainHeight;
      
      // Check if mobile device
      this.isMobile = AFRAME.utils.device.isMobile();
      
      // Bind event listeners
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      
      // Add appropriate event listeners based on device
      if (this.isMobile) {
        // Mobile: add touch events
        document.addEventListener('touchstart', this.onTouchStart);
        document.addEventListener('touchmove', this.onTouchMove);
        document.addEventListener('touchend', this.onTouchEnd);
        console.log('Projectile system using touch controls with tap detection');
      } else {
        // Desktop: add mouse events
        document.addEventListener('mousedown', this.onMouseDown);
        console.log('Projectile system using mouse controls');
      }
      
      // Set up interval to check for head tilt (useful for VR)
      this.checkInterval = setInterval(this.checkHeadTilt.bind(this), 100);
      
      // Add debug UI for projectile count
      if (this.data.debug) {
        this.createDebugUI();
      }
      
      console.log('Projectile system ready');
    },
    
    initProjectileInstances: function() {
      // Create a single geometry for all projectiles - larger size and more segments
      const geometry = new THREE.SphereGeometry(this.data.projectileSize, 12, 12);
      
      // Create material with icy blue color
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#00CCFF'),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      
      // Create instanced mesh
      this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.data.maxProjectiles);
      this.instancedMesh.count = 0; // Start with no visible instances
      this.instancedMesh.frustumCulled = false; // Ensure always rendered
      
      // Add instanced mesh to scene
      this.el.object3D.add(this.instancedMesh);
      
      // Initialize instance matrices and visibility
      this.matrices = new Array(this.data.maxProjectiles);
      this.active = new Array(this.data.maxProjectiles).fill(false);
      this.directions = new Array(this.data.maxProjectiles);
      this.startTimes = new Array(this.data.maxProjectiles);
      this.lastPositions = new Array(this.data.maxProjectiles);
      this.impactTimes = new Array(this.data.maxProjectiles).fill(0); // Add impact time tracking
      this.impacted = new Array(this.data.maxProjectiles).fill(false); // Track if projectile has impacted
      
      for (let i = 0; i < this.data.maxProjectiles; i++) {
        this.matrices[i] = new THREE.Matrix4();
        this.directions[i] = new THREE.Vector3();
        this.lastPositions[i] = new THREE.Vector3();
      }
      
      // Dummy objects for matrix calculations
      this.dummy = new THREE.Object3D();
      
      // Create trail effect if enabled
      if (this.data.trailEnabled) {
        this.createTrailEffect();
      }
      
      // On mobile, add a fire button
      if (this.isMobile && this.data.showFireButton) {
        this.createFireButton();
      }
    },
    
    createTrailEffect: function() {
      // Create a more transparent white trail
      this.trailMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#FFFFFF'),
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      
      // Create a simple trail geometry (elongated sphere)
      this.trailGeometry = new THREE.CylinderGeometry(0.2, 0.05, 2, 8, 1);
      this.trailGeometry.rotateX(Math.PI / 2); // Orient along z-axis
      
      // Create instanced mesh for trails
      this.trailMesh = new THREE.InstancedMesh(this.trailGeometry, this.trailMaterial, this.data.maxProjectiles);
      this.trailMesh.count = 0;
      this.trailMesh.frustumCulled = false;
      
      this.trailMatrices = new Array(this.data.maxProjectiles);
      for (let i = 0; i < this.data.maxProjectiles; i++) {
        this.trailMatrices[i] = new THREE.Matrix4();
      }
      
      this.el.object3D.add(this.trailMesh);
    },
    
    createFireButton: function() {
      // Create fire button for mobile
      this.fireButton = document.createElement('button');
      this.fireButton.className = 'fire-button';
      this.fireButton.textContent = '🔥 Fire';
      
      // Style the button
      Object.assign(this.fireButton.style, {
        position: 'fixed',
        bottom: '26px',
        right: '10px',
        padding: '15px 25px',
        border: 'none',
        borderRadius: '30px',
        backgroundColor: 'rgba(0, 204, 255, 0.7)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontWeight: 'bold',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        zIndex: '1000',
        transition: 'background-color 0.3s, transform 0.1s'
      });
      
      // Add touch handlers
      this.fireButton.addEventListener('touchstart', function(e) {
        e.preventDefault();
        this.style.transform = 'scale(0.95)';
        this.style.backgroundColor = 'rgba(0, 150, 255, 0.9)';
      });
      
      // Use a named function for the touchend event
      const fireButtonTouchEnd = function(e) {
        e.preventDefault();
        this.fireProjectile();
        this.fireButton.style.transform = '';
        this.fireButton.style.backgroundColor = 'rgba(0, 204, 255, 0.7)';
      }.bind(this);
      
      this.fireButton.addEventListener('touchend', fireButtonTouchEnd);
      
      // Add to DOM
      document.body.appendChild(this.fireButton);
    },
    
    createDebugUI: function() {
      const debugEl = document.createElement('div');
      debugEl.id = 'projectile-debug';
      Object.assign(debugEl.style, {
        position: 'fixed',
        top: '60px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: '1000'
      });
      document.body.appendChild(debugEl);
      
      // Update debug info periodically
      setInterval(function() {
        const activeCount = this.active.filter(active => active).length;
        debugEl.textContent = `Projectiles: ${activeCount}/${this.data.maxProjectiles}`;
      }.bind(this), 500);
    },
    
    onMouseDown: function(event) {
      // Only fire on left click
      if (event.button === 0) {
        this.fireProjectile();
      }
    },
    
    onTouchStart: function(event) {
      // Don't process if there's no event or if it's disabled
      if (!event || !this.data.enabled) return;
      
      // Get the touch
      const touch = event.touches[0];
      if (!touch) return;
      
      // Check if this is a tap on a UI element - don't fire projectiles when interacting with UI
      if (this.isTouchingUIElement(touch)) {
        return;
      }
      
      // Store touch start position and time for later comparison
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = Date.now();
      this.touchMoved = false;
      
      // Don't fire on touch start - wait for touch end to determine if it's a tap
    },
    
    onTouchMove: function(event) {
      // If touch has moved too much, mark as a drag action, not a tap
      if (!this.touchMoved && event.touches[0]) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If moved more than threshold, it's a drag not a tap
        if (distance > this.maxTapDistance) {
          this.touchMoved = true;
        }
      }
    },
    
    onTouchEnd: function(event) {
      // Calculate touch duration
      const touchDuration = Date.now() - this.touchStartTime;
      
      // Fire only if:
      // 1. Touch didn't move much (not a drag)
      // 2. Touch was short (quick tap)
      // 3. We're not touching a UI element
      if (!this.touchMoved && 
          touchDuration < this.maxTapDuration) {
        
        // Get the element at the end position
        const elementAtEnd = document.elementFromPoint(this.touchStartX, this.touchStartY);
        
        // Final check if we're on a UI element
        if (elementAtEnd && !this.isElementUIComponent(elementAtEnd)) {
          this.fireProjectile();
        }
      }
      
      // Reset touch tracking
      this.touchMoved = false;
    },
    
    isElementUIComponent: function(element) {
      // Check if element or any parent matches UI selectors
      let current = element;
      while (current) {
        // Check all selectors
        for (const selector of [
          '.move-toggle-btn', '.menu-toggle-btn', '.music-toggle-btn',
          '#welcome-message', 'button', '.a-enter-vr', '#npc-stats',
          '#projectile-debug', '#collectibles-hud', '#connection-status',
          '.fire-button'
        ]) {
          if (current.matches && current.matches(selector)) {
            return true;
          }
        }
        // Move up to parent
        current = current.parentElement;
      }
      return false;
    },
    
    isTouchingUIElement: function(touch) {
      // Get the element being touched
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!element) return false;
      
      return this.isElementUIComponent(element);
    },
    
    checkHeadTilt: function() {
      // Only check if we have the necessary elements
      if (!document.querySelector('#cam')) return;
      
      // Get the camera rotation
      const rotation = document.querySelector('#cam').object3D.rotation;
      const roll = rotation.z;
      
      // Check if head is tilted to the right (using similar values as a-loco.js)
      const RminZ = -0.3;
      const RmaxZ = -0.5;
      
      if (roll < RminZ && roll > RmaxZ) {
        // Fire projectile on head tilt
        this.fireProjectile();
      }
    },
    
    fireProjectile: function() {
      // Check cooldown
      const now = Date.now();
      if (now - this.lastFireTime < this.data.cooldown) {
        return;
      }
      this.lastFireTime = now;
      
      // Find an available instance slot
      let instanceIndex = -1;
      for (let i = 0; i < this.data.maxProjectiles; i++) {
        if (!this.active[i]) {
          instanceIndex = i;
          break;
        }
      }
      
      if (instanceIndex === -1) {
        console.log('No projectile slots available, forcing recycling of oldest projectile');
        // Find the oldest projectile and recycle it
        let oldestTime = Infinity;
        let oldestIndex = 0;
        
        for (let i = 0; i < this.data.maxProjectiles; i++) {
          if (this.startTimes[i] < oldestTime) {
            oldestTime = this.startTimes[i];
            oldestIndex = i;
          }
        }
        
        instanceIndex = oldestIndex;
      }
      
      // Get camera position and direction
      const cameraPosition = new THREE.Vector3();
      const cameraDirection = new THREE.Vector3();
      
      this.camera.getWorldPosition(cameraPosition);
      this.camera.getWorldDirection(cameraDirection);
      
      // Invert direction to match the camera's actual forward direction in this scene
      cameraDirection.negate();
      
      // Set projectile position slightly in front of camera
      const startPosition = cameraPosition.clone().add(
        cameraDirection.clone().multiplyScalar(1.5)
      );
      
      // Activate projectile instance
      this.active[instanceIndex] = true;
      this.directions[instanceIndex].copy(cameraDirection).normalize();
      this.startTimes[instanceIndex] = now;
      this.lastPositions[instanceIndex].copy(startPosition);
      
      // Reset impact state
      this.impacted[instanceIndex] = false;
      
      // Set initial matrix
      this.dummy.position.copy(startPosition);
      this.dummy.updateMatrix();
      this.matrices[instanceIndex].copy(this.dummy.matrix);
      
      // Update instanced mesh
      this.instancedMesh.setMatrixAt(instanceIndex, this.matrices[instanceIndex]);
      this.instancedMesh.count = Math.max(this.instancedMesh.count, instanceIndex + 1);
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      
      // Simple feedback
      this.playFireSound();
    },
    
    checkCollisions: function(instanceIndex, oldPos, newPos) {
      // Create vectors for raycasting
      const direction = new THREE.Vector3().subVectors(newPos, oldPos).normalize();
      const distance = oldPos.distanceTo(newPos);
      
      // Check terrain collision
      if (this.getTerrainHeight) {
        const terrainHeight = this.getTerrainHeight(newPos.x, newPos.z);
        if (newPos.y < terrainHeight) {
          this.createHitEffect(newPos);
          // Mark as impacted but don't deactivate immediately
          this.impacted[instanceIndex] = true;
          this.impactTimes[instanceIndex] = Date.now();
          return true;
        }
      }
      
      // Set up raycaster
      const raycaster = new THREE.Raycaster(oldPos, direction, 0, distance);
      
      // Check NPC collisions
      const npcs = document.querySelectorAll('[ai-locomotion]');
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc.object3D) continue;
        
        const intersects = raycaster.intersectObject(npc.object3D, true);
        if (intersects.length > 0) {
          this.applyPushForce(npc, direction, this.data.pushForce);
          // Mark as impacted but don't deactivate immediately
          this.impacted[instanceIndex] = true;
          this.impactTimes[instanceIndex] = Date.now();
          return true;
        }
      }
      
      // Check other player collisions
      const players = document.querySelectorAll('#players > a-entity');
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (!player.object3D) continue;
        
        const intersects = raycaster.intersectObject(player.object3D, true);
        if (intersects.length > 0) {
          // Just visual effect for other players
          this.createHitEffect(player.object3D.position);
          // Mark as impacted but don't deactivate immediately
          this.impacted[instanceIndex] = true;
          this.impactTimes[instanceIndex] = Date.now();
          return true;
        }
      }
      
      return false;
    },
    
    applyPushForce: function(entity, direction, force) {
      // Apply push force to an entity
      const aiComponent = entity.components['ai-locomotion'];
      
      if (aiComponent) {
        // Get entity position
        const position = entity.object3D.position;
        
        // Apply force in direction of projectile
        const pushX = direction.x * force;
        const pushZ = direction.z * force;
        
        // Update position
        position.x += pushX;
        position.z += pushZ;
        
        // Create hit effect
        this.createHitEffect(position);
      }
    },
    
    createHitEffect: function(position) {
      // Create a simple hit effect (flash sphere)
      const hitEffect = document.createElement('a-sphere');
      hitEffect.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
      hitEffect.setAttribute('radius', '1');
      hitEffect.setAttribute('color', '#FFFFFF');
      hitEffect.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.6');
      
      document.querySelector('a-scene').appendChild(hitEffect);
      
      // Animate and remove
      let scale = 1.0;
      const interval = setInterval(function() {
        scale += 0.5;
        hitEffect.setAttribute('scale', `${scale} ${scale} ${scale}`);
        hitEffect.setAttribute('material', 'opacity', 0.6 - scale * 0.1);
        
        if (scale >= 5) {
          clearInterval(interval);
          if (hitEffect.parentNode) {
            hitEffect.parentNode.removeChild(hitEffect);
          }
        }
      }, 50);
    },
    
    playFireSound: function() {
      // Simple visual feedback if sound not available
      document.body.style.backgroundColor = '#003366';
      setTimeout(function() {
        document.body.style.backgroundColor = '';
      }, 50);
    },
    
    tick: function(time, deltaTime) {
      if (!deltaTime) return;
      
      // Convert delta to seconds
      const delta = deltaTime / 1000;
      const now = Date.now();
      
      // Track if we need to update the instance matrix
      let needsUpdate = false;
      let trailNeedsUpdate = false;
      
      // Update each active projectile
      for (let i = 0; i < this.data.maxProjectiles; i++) {
        if (!this.active[i]) continue;
        
        // Check if impacted projectile should be removed
        if (this.impacted[i]) {
          if (now - this.impactTimes[i] > this.data.impactLifetime) {
            // Time to remove the impacted projectile
            this.active[i] = false;
            this.impacted[i] = false;
            needsUpdate = true;
            continue;
          }
          // Skip movement for impacted projectiles
          continue;
        }
        
        // Check lifetime for non-impacted projectiles
        if (now - this.startTimes[i] > this.data.projectileLifetime) {
          this.active[i] = false;
          needsUpdate = true;
          continue;
        }
        
        // Get current position and calculate new position
        const matrix = this.matrices[i];
        const position = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        
        matrix.decompose(position, rotation, scale);
        
        const oldPosition = position.clone();
        const velocity = this.directions[i].clone().multiplyScalar(this.data.projectileSpeed);
        
        position.x += velocity.x * delta;
        position.y += velocity.y * delta;
        position.z += velocity.z * delta;
        
        // Check for collisions
        if (this.checkCollisions(i, oldPosition, position)) {
          // Collision detected, projectile is now impacted but remains visible
          needsUpdate = true;
          continue;
        }
        
        // Update matrix
        this.dummy.position.copy(position);
        this.dummy.quaternion.copy(rotation);
        this.dummy.scale.copy(scale);
        this.dummy.updateMatrix();
        
        this.matrices[i].copy(this.dummy.matrix);
        this.instancedMesh.setMatrixAt(i, this.matrices[i]);
        
        // Update trail if enabled
        if (this.data.trailEnabled && this.trailMesh) {
          // Position trail between current and previous position
          const midPoint = new THREE.Vector3().addVectors(oldPosition, position).multiplyScalar(0.5);
          const trailDirection = new THREE.Vector3().subVectors(position, oldPosition).normalize();
          
          // Create quaternion to orient trail along direction
          const trailQuaternion = new THREE.Quaternion();
          if (trailDirection.length() > 0.001) {
            // Only set rotation if we have a valid direction
            const axis = new THREE.Vector3(0, 0, 1);
            trailQuaternion.setFromUnitVectors(axis, trailDirection);
          }
          
          // Set scale to stretch trail based on speed
          const trailLength = oldPosition.distanceTo(position) * 1.5;
          const trailScale = new THREE.Vector3(1, 1, Math.max(trailLength, 1));
          
          // Update trail matrix
          this.dummy.position.copy(midPoint);
          this.dummy.quaternion.copy(trailQuaternion);
          this.dummy.scale.copy(trailScale);
          this.dummy.updateMatrix();
          
          this.trailMatrices[i].copy(this.dummy.matrix);
          this.trailMesh.setMatrixAt(i, this.trailMatrices[i]);
          
          trailNeedsUpdate = true;
        }
        
        // Save position for next collision check
        this.lastPositions[i].copy(position);
        
        needsUpdate = true;
      }
      
      // Update instanced mesh if needed
      if (needsUpdate) {
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }
      
      if (trailNeedsUpdate && this.trailMesh) {
        this.trailMesh.instanceMatrix.needsUpdate = true;
        this.trailMesh.count = this.instancedMesh.count;
      }
    },
    
    remove: function() {
      // Clean up event listeners
      document.removeEventListener('mousedown', this.onMouseDown);
      document.removeEventListener('touchstart', this.onTouchStart);
      document.removeEventListener('touchmove', this.onTouchMove);
      document.removeEventListener('touchend', this.onTouchEnd);
      
      // Clear interval
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      
      // Remove instanced mesh
      if (this.instancedMesh) {
        this.el.object3D.remove(this.instancedMesh);
        this.instancedMesh.geometry.dispose();
        this.instancedMesh.material.dispose();
      }
      
      // Remove trail mesh
      if (this.trailMesh) {
        this.el.object3D.remove(this.trailMesh);
        this.trailGeometry.dispose();
        this.trailMaterial.dispose();
      }
      
      // Remove fire button if it exists
      if (this.fireButton && this.fireButton.parentNode) {
        this.fireButton.parentNode.removeChild(this.fireButton);
      }
      
      // Remove debug UI
      const debugEl = document.getElementById('projectile-debug');
      if (debugEl && debugEl.parentNode) {
        debugEl.parentNode.removeChild(debugEl);
      }
      
      console.log('Projectile system removed');
    }
  });