// Simple FPS Counter with visible display
(function() {
    // Create FPS display element
    const fpsDisplay = document.createElement('div');
    fpsDisplay.id = 'fps-display';
    fpsDisplay.style.position = 'fixed';
    fpsDisplay.style.top = '60px';
    fpsDisplay.style.left = '50%';
    fpsDisplay.style.transform = 'translateX(-50%)';
    fpsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    fpsDisplay.style.color = 'white';
    fpsDisplay.style.padding = '5px 10px';
    fpsDisplay.style.borderRadius = '5px';
    fpsDisplay.style.fontFamily = 'monospace';
    fpsDisplay.style.fontSize = '14px';
    fpsDisplay.style.zIndex = '9999';
    fpsDisplay.textContent = 'FPS: 0';
    
    // Add to document when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(fpsDisplay);
      startFpsCounter();
    });
    
    // FPS tracking variables
    let frameCount = 0;
    let lastSecond = 0;
    let fps = 0;
    let fpsHistory = [];
    const historySize = 30;
    
    function startFpsCounter() {
      lastSecond = performance.now();
      requestAnimationFrame(updateFps);
    }
    
    function updateFps(timestamp) {
      // Count this frame
      frameCount++;
      
      // If a second has passed, update the FPS display
      if (timestamp > lastSecond + 1000) {
        // Calculate FPS
        const elapsed = (timestamp - lastSecond) / 1000;
        fps = Math.round(frameCount / elapsed);
        
        // Add to history
        fpsHistory.push(fps);
        
        // Keep history at the right size
        if (fpsHistory.length > historySize) {
          fpsHistory.shift();
        }
        
        // Calculate average and min
        const sum = fpsHistory.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / fpsHistory.length);
        const min = Math.min(...fpsHistory);
        
        // Update display
        fpsDisplay.textContent = `FPS: ${fps} (${avg} avg, ${min} min)`;
        
        // Color code based on performance
        if (avg >= 50) {
          fpsDisplay.style.color = '#7FFF7F'; // Green
        } else if (avg >= 30) {
          fpsDisplay.style.color = '#FFFF7F'; // Yellow
        } else {
          fpsDisplay.style.color = '#FF7F7F'; // Red
        }
        
        // Reset for next second
        lastSecond = timestamp;
        frameCount = 0;
      }
      
      // Request next frame
      requestAnimationFrame(updateFps);
    }
  })();