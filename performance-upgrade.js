// Performance Upgrade Bundle
// This script integrates all terrain optimizations and provides an easy way to add them to the existing project

// Add this script to your HTML after all other scripts and before the closing </body> tag:
// <script src="performance-upgrade.js"></script>

(function() {
  // Configuration options
  const config = {
    enablePooledTerrain: true,      // Use optimized pooled terrain generator
    enableWorkerTerrain: true,      // Use web worker for terrain calculations
    enableShaderOptimizations: true, // Use optimized shaders
    monitorPerformance: false,       // Add performance monitoring
    adaptToDeviceCapability: true,  // Automatically adjust settings based on device performance
    showDebugInfo: false            // Show debug information
  };
  
  // Wait for page to load before applying upgrades
  window.addEventListener('load', function() {
    console.log('Applying Eigengrau Light performance upgrades...');
    
    // Detect device capabilities
    const deviceCapabilities = detectDeviceCapabilities();
    
    // Apply appropriate optimizations based on device capability
    if (config.adaptToDeviceCapability) {
      adaptConfigToDevice(deviceCapabilities);
    }
    
    // Apply performance upgrades
    applyPerformanceUpgrades();
    
    // Add performance monitoring if enabled
    if (config.monitorPerformance) {
      addPerformanceMonitoring();
    }
    
    console.log('Performance upgrades applied!');
    
    // Show configuration in debug mode
    if (config.showDebugInfo) {
      displayDebugInfo();
    }
  });
  
  // Detect device capabilities
  function detectDeviceCapabilities() {
    const capabilities = {
      isMobile: AFRAME.utils.device.isMobile(),
      isVR: AFRAME.utils.device.checkHeadsetConnected(),
      memoryEstimate: navigator.deviceMemory || 4, // Default to 4GB if not available
      cpuCores: navigator.hardwareConcurrency || 4, // Default to 4 cores if not available
      webgl2Support: (function() {
        try {
          const canvas = document.createElement('canvas');
          return !!(window.WebGL2RenderingContext && 
                   canvas.getContext('webgl2'));
        } catch(e) {
          return false;
        }
      })(),
      workerSupport: typeof Worker !== 'undefined'
    };
    
    // Estimate device performance score (0-100)
    capabilities.performanceScore = calculatePerformanceScore(capabilities);
    
    console.log('Device capabilities detected:', capabilities);
    return capabilities;
  }
  
  // Calculate a performance score based on device capabilities
  function calculatePerformanceScore(capabilities) {
    // Start with base score
    let score = 50;
    
    // Adjust based on device type
    if (capabilities.isMobile) {
      score -= 15;
    }
    
    // Adjust based on memory
    score += (capabilities.memoryEstimate - 4) * 5; // +/- 5 points per GB difference from 4GB
    
    // Adjust based on CPU cores
    score += (capabilities.cpuCores - 4) * 2.5; // +/- 2.5 points per core difference from 4
    
    // Adjust based on WebGL support
    if (capabilities.webgl2Support) {
      score += 10;
    }
    
    // Adjust based on VR mode
    if (capabilities.isVR) {
      score -= 10; // VR requires more performance
    }
    
    // Clamp score to 0-100 range
    return Math.max(0, Math.min(100, score));
  }
  
  // Adapt configuration based on device capabilities
  function adaptConfigToDevice(capabilities) {
    // For low-end devices
    if (capabilities.performanceScore < 30) {
      config.enablePooledTerrain = true;
      config.enableWorkerTerrain = false; // Workers might be too heavy for very low-end devices
      config.enableShaderOptimizations = true;
      
      // Lower global settings for urizen.js
      window.adaptiveTerrain = {
        chunkSize: 64,          // Keep chunk size the same
        chunksToRender: 9,      // Reduce visible chunks (3x3 grid)
        updateThreshold: 40,    // Less frequent updates
        resolution: 2,          // Lower resolution terrain
        poolSize: 16            // Smaller pool size
      };
    }
    // For mid-range devices
    else if (capabilities.performanceScore < 70) {
      config.enablePooledTerrain = true;
      config.enableWorkerTerrain = capabilities.workerSupport;
      config.enableShaderOptimizations = true;
      
      window.adaptiveTerrain = {
        chunkSize: 64,
        chunksToRender: 25,     // 5x5 grid
        updateThreshold: 32,
        resolution: 1,
        poolSize: 36
      };
    }
    // For high-end devices
    else {
      config.enablePooledTerrain = true;
      config.enableWorkerTerrain = capabilities.workerSupport;
      config.enableShaderOptimizations = true;
      
      window.adaptiveTerrain = {
        chunkSize: 64,
        chunksToRender: 49,     // 7x7 grid
        updateThreshold: 32,
        resolution: 1,
        poolSize: 64
      };
    }
    
    console.log('Configuration adapted to device capabilities:', window.adaptiveTerrain);
  }
  
  // Apply the performance upgrades
  function applyPerformanceUpgrades() {
    // Add the script tags to the document
    if (config.enablePooledTerrain) {
      loadScript('pooled-terrain.js');
    }
    
    if (config.enableWorkerTerrain && typeof Worker !== 'undefined') {
      // First load the worker script
      loadScript('terrain-worker.js');
      // Then load the manager script
      setTimeout(() => {
        loadScript('worker-terrain-manager.js');
      }, 100);
    }
    
    if (config.enableShaderOptimizations) {
      loadScript('terrain-optimizations.js');
    }
    
    // Load the bridge script last to ensure all components are ready
    setTimeout(() => {
      loadScript('terrain-bridge.js');
    }, 200);
  }
  
  // Helper function to load a script
  function loadScript(src) {
    // Check if script already exists
    if (document.querySelector(`script[src="${src}"]`)) {
      console.log(`Script ${src} already loaded`);
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // Load in order
    script.onerror = function() {
      console.error(`Failed to load script: ${src}`);
    };
    document.body.appendChild(script);
    console.log(`Loaded script: ${src}`);
  }
  
  // Add a simple FPS counter and performance monitor
  function addPerformanceMonitoring() {
    // Create container for monitoring display
    const monitorContainer = document.createElement('div');
    monitorContainer.id = 'performance-monitor';
    Object.assign(monitorContainer.style, {
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      color: 'white',
      padding: '5px 10px',
      borderRadius: '5px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: '9999',
      pointerEvents: 'none'
    });
    
    // Add FPS counter
    const fpsDisplay = document.createElement('div');
    fpsDisplay.id = 'fps-counter';
    fpsDisplay.textContent = 'FPS: --';
    monitorContainer.appendChild(fpsDisplay);
    
    // Add memory usage display
    const memoryDisplay = document.createElement('div');
    memoryDisplay.id = 'memory-usage';
    memoryDisplay.textContent = 'MEM: --';
    monitorContainer.appendChild(memoryDisplay);
    
    // Add active chunks counter
    const chunksDisplay = document.createElement('div');
    chunksDisplay.id = 'chunks-counter';
    chunksDisplay.textContent = 'Chunks: --';
    monitorContainer.appendChild(chunksDisplay);
    
    // Add to document
    document.body.appendChild(monitorContainer);
    
    // Start monitoring loop
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 0;
    
    function updateMonitor() {
      // Count frames
      frameCount++;
      
      // Calculate FPS every second
      const currentTime = performance.now();
      const elapsedTime = currentTime - lastTime;
      
      if (elapsedTime >= 1000) {
        // Calculate FPS
        fps = Math.round(frameCount * 1000 / elapsedTime);
        
        // Reset counters
        frameCount = 0;
        lastTime = currentTime;
        
        // Update displays
        fpsDisplay.textContent = `FPS: ${fps}`;
        fpsDisplay.style.color = fps > 40 ? '#7FFF7F' : fps > 20 ? '#FFFF7F' : '#FF7F7F';
        
        // Update memory usage if available
        if (window.performance && window.performance.memory) {
          const memory = window.performance.memory;
          const usedMb = Math.round(memory.usedJSHeapSize / (1024 * 1024));
          const totalMb = Math.round(memory.jsHeapSizeLimit / (1024 * 1024));
          const percentage = Math.round((usedMb / totalMb) * 100);
          
          memoryDisplay.textContent = `MEM: ${usedMb}MB / ${totalMb}MB (${percentage}%)`;
          memoryDisplay.style.color = percentage < 70 ? '#7FFF7F' : percentage < 85 ? '#FFFF7F' : '#FF7F7F';
        }
        
        // Update chunk count
        const activeChunks = document.querySelectorAll('[id^="pooled-terrain"] a-entity').length || 
                             document.querySelectorAll('[id^="enhanced-terrain"] a-entity').length || 
                             '--';
        chunksDisplay.textContent = `Chunks: ${activeChunks}`;
      }
      
      // Schedule next update
      requestAnimationFrame(updateMonitor);
    }
    
    // Start monitoring
    requestAnimationFrame(updateMonitor);
  }
  
  // Display debug info
  function displayDebugInfo() {
    console.log('Performance upgrade configuration:', config);
    console.log('Adaptive terrain settings:', window.adaptiveTerrain);
  }
  
  // Create toggle for monitor visibility
  document.addEventListener('keydown', function(e) {
    // Press 'P' to toggle performance monitor
    if (e.key === 'p' || e.key === 'P') {
      const monitor = document.getElementById('performance-monitor');
      if (monitor) {
        monitor.style.display = monitor.style.display === 'none' ? 'block' : 'none';
      }
    }
  });
})();

// Expose configuration as global for scripts that need it
window.terrainPoolConfig = {
  chunkSize: 64,               // Size of chunks in units
  poolSize: 36,                // Number of chunks to pre-allocate
  chunksToRender: 25,          // Number of chunks to show at once (5x5 grid)
  updateThreshold: 32,         // Distance player must move for update
  resolution: 1,               // Terrain resolution (higher values = less detail)
  useWorker: true,             // Use web worker for terrain calculations
  adaptiveDetail: true         // Use higher detail for nearby chunks
};
