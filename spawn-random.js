
  // Random spawn system
  document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    
    // Wait for the scene to be fully loaded
    scene.addEventListener('loaded', () => {
      // Check URL params to see if we're coming from a portal
      const urlParams = new URLSearchParams(window.location.search);
      const fromPortal = urlParams.get('portal') === 'true';
      
      // Only randomize spawn if not coming from a portal
      if (!fromPortal) {
        const player = document.querySelector('#player');
        if (player) {
          // Get current spawn position
          const position = player.getAttribute('position');
          
          // Generate random offset within a 20-unit radius
          const radius = 128;
          const angle = Math.random() * Math.PI * 2; // Random angle
          const distance = 5 + Math.random() * (radius - 5); // Between 5 and radius units
          
          // Calculate new spawn position
          const newX = position.x + Math.cos(angle) * distance;
          const newZ = position.z + Math.sin(angle) * distance;
          
          // Get terrain height at new position for proper Y coordinate
          let newY = position.y;
          if (typeof getTerrainHeight === 'function') {
            newY = getTerrainHeight(newX, newZ) + 4.6; // Add player height offset
          }
          
          // Set new spawn position
          console.log(`Random spawn: ${newX.toFixed(1)}, ${newY.toFixed(1)}, ${newZ.toFixed(1)}`);
          player.setAttribute('position', {x: newX, y: newY, z: newZ});
        }
      }
    });
  });