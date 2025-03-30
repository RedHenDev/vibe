/**
 * Enhanced AI Night Chase Component
 * This script activates enhanced chase behavior for NPCs during night mode.
 * When night mode is active, NPCs will detect the player’s position and move toward them.
 * If the NPC gets close enough, it speeds up to increase the threat.
 *
 * To use, attach the component to any NPC entity:
 *   <a-entity night-chase></a-entity>
 *
 * It also listens for global events ("nightmodeactivated" / "nightmodedeactivated")
 * so that the behavior is only active during night mode.
 */

AFRAME.registerComponent('night-chase', {
    schema: {
      speed: {type: 'number', default: 0.05},        // Base movement speed
      boostSpeed: {type: 'number', default: 0.1},      // Speed when near the player
      chaseThreshold: {type: 'number', default: 5}     // Distance (in meters) to trigger boost
    },
    
    init: function () {
      // Reference to the player entity (make sure your player has an id="player")
      this.player = document.querySelector('#player');
      // Boolean flag to control night mode activation
      this.nightModeActive = false;
      
      // Listen for events that toggle night mode
      window.addEventListener('nightmodeactivated', () => {
        this.nightModeActive = true;
      });
      window.addEventListener('nightmodedeactivated', () => {
        this.nightModeActive = false;
      });
      
      // If needed, integrate with your vibe-stealing or vibes-manager systems here.
      // For example, you might add visual effects when chase mode starts.
      // vibesManager.activateChaseEffects(this.el);
    },
    
    tick: function (time, deltaTime) {
      // Only process chase behavior if night mode is active and the player is present
      if (!this.nightModeActive || !this.player) { return; }
      
      // Get the 3D positions of the NPC and the player
      const npcPos = this.el.object3D.position;
      const playerPos = this.player.object3D.position;
      
      // Compute the direction vector from NPC to player
      const direction = new THREE.Vector3();
      direction.subVectors(playerPos, npcPos);
      const distance = direction.length();
      
      // Normalize the direction for consistent movement
      direction.normalize();
      
      // Determine the movement speed: use boost speed if within the chase threshold
      const moveSpeed = (distance < this.data.chaseThreshold) ? this.data.boostSpeed : this.data.speed;
      
      // Move the NPC toward the player
      // (deltaTime is in milliseconds; scale the movement accordingly)
      npcPos.add(direction.multiplyScalar(moveSpeed * deltaTime / 16));
      
      // Rotate the NPC to face the player
      this.el.object3D.lookAt(playerPos);
      
      // (Optional) You can also incorporate additional effects here such as sound cues
      // or integrating with your NPC manager (npc-manager.js) for collision checks.
    }
  });
  