// Terrain Performance Stress Test
// This script allows testing different terrain configurations and measuring performance

// Add this script to your project and press 'T' key to activate stress test mode

(function() {
  // Constants
  const TEST_DURATION = 10000; // milliseconds
  const DISTANCE_PER_SECOND = 100; // Units traveled per second during automated movement
  const METRICS_UPDATE_INTERVAL = 500; // milliseconds between metrics updates
  
  // State variables
  let isTestRunning = false;
  let testStartTime = 0;
  let testEndTime = 0;
  let testFrameCount = 0;
  let testResultsEl = null;
  let originalPosition = null;
  let startingPosition = null;
  let movementDirection = 0;
  let metricsInterval = null;
  let currentConfig = null;
  let currentConfigIndex = 0;
  
  // Performance metrics
  const metrics = {
    fps: [],
    frameTimeMs: [],
    memoryUsage: [],
    chunkGenerationTime: [],
    activeChunks: []
  };
  
  // Test configurations to cycle through
  const testConfigurations = [
    {
      name: "Original Terrain",
      description: "Original unoptimized terrain generator",
      setupFn: setupOriginalTerrain,
      poolSize: 0, // N/A
      chunksToRender: 25,
      resolution: 1,
      useWorker: false
    },
    {
      name: "Basic Pooling",
      description: "Simple chunk pooling without worker",
      setupFn: setupPooledTerrain,
      poolSize: 36,
      chunksToRender: 25,
      resolution: 1,
      useWorker: false
    },
    {
      name: "Worker + Pooling",
      description: "Pooling with web worker for calculations",
      setupFn: setupWorkerTerrain,
      poolSize: 36,
      chunksToRender: 25,
      resolution: 1,
      useWorker: true
    },
    {
      name: "High Detail",
      description: "High detail settings for powerful hardware",
      setupFn: setupWorkerTerrain,
      poolSize: 64,
      chunksToRender: 49, // 7x7 grid
      resolution: 1,
      useWorker: true
    },
    {
      name: "Balanced",
      description: "Balanced settings for mid-range hardware",
      setupFn: setupWorkerTerrain,
      poolSize: 36,
      chunksToRender: 25, // 5x5 grid
      resolution: 1,
      useWorker: true
    },
    {
      name: "Performance",
      description: "Lower detail settings for better performance",
      setupFn: setupWorkerTerrain,
      poolSize: 25,
      chunksToRender: 9, // 3x3 grid
      resolution: 2,
      useWorker: true
    },
    {
      name: "Mobile",
      description: "Optimized for mobile devices",
      setupFn: setupPooledTerrain, // Mobile often struggles with workers
      poolSize: 16,
      chunksToRender: 9, // 3x3 grid
      resolution: 2,
      useWorker: false
    }
  ];
  
  // Initialize when document is ready
  document.addEventListener('DOMContentLoaded', initialize);
  
  function initialize() {
    // Add keyboard listener for test control
    document.addEventListener('keydown', function(e) {
      // 'T' key toggles test mode
      if (e.key === 'T') {
        toggleTest();
      }
    });
    
    // Create hidden UI elements for test results
    createTestUI();
  }
  
  function createTestUI() {
    // Create container for test results
    testResultsEl = document.createElement('div');
    testResultsEl.id = 'terrain-test-results';
    
    // Style the container
    Object.assign(testResultsEl.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '20px',
      borderRadius: '10px',
      width: '80%',
      maxWidth: '600px',
      maxHeight: '80%',
      overflowY: 'auto',
      fontFamily: 'monospace',
      fontSize: '14px',
      zIndex: '10000',
      display: 'none'
    });
    
    // Add initial content
    testResultsEl.innerHTML = `
      <h2 style="text-align: center; margin-top: 0;">Terrain Performance Test</h2>
      <p style="text-align: center;">Press 'T' to start/stop tests</p>
      <div id="test-status">Status: Ready</div>
      <div id="test-config">Configuration: None</div>
      <div id="test-metrics"></div>
      <div id="test-results-table"></div>
      <div id="test-controls" style="margin-top: 20px; text-align: center;">
        <button id="test-next-config">Next Configuration</button>
        <button id="test-export">Export Results</button>
      </div>
    `;
    
    // Add to document
    document.body.appendChild(testResultsEl);
    
    // Add button event listeners
    document.getElementById('test-next-config').addEventListener('click', cycleToNextConfig);
    document.getElementById('test-export').addEventListener('click', exportTestResults);
  }
  
  function toggleTest() {
    if (isTestRunning) {
      stopTest();
    } else {
      startTest();
    }
  }
  
  function startTest() {
    // Don't start if already running
    if (isTestRunning) return;
    
    // Show test UI
    testResultsEl.style.display = 'block';
    
    // Reset metrics
    resetMetrics();
    
    // If no configuration is set, use the first one
    if (!currentConfig) {
      currentConfig = testConfigurations[0];
      currentConfigIndex = 0;
    }
    
    // Update UI
    document.getElementById('test-status').textContent = `Status: Running test with "${currentConfig.name}"`;
    document.getElementById('test-config').textContent = `Configuration: ${currentConfig.description}`;
    
    // Save original player position
    const player = document.querySelector('#player');
    if (player) {
      originalPosition = player.getAttribute('position');
      // Clone position to avoid reference issues
      startingPosition = {
        x: originalPosition.x,
        y: originalPosition.y,
        z: originalPosition.z
      };
    }
    
    // Set up the current configuration
    currentConfig.setupFn(currentConfig);
    
    // Start collecting metrics
    startMetricsCollection();
    
    // Start automated movement
    startAutomatedMovement();
    
    // Start test timer
    isTestRunning = true;
    testStartTime = performance.now();
    testFrameCount = 0;
    
    // Set test end timer
    setTimeout(finishTest, TEST_DURATION);
  }
  
  function stopTest() {
    if (!isTestRunning) return;
    
    // Stop metrics collection
    stopMetricsCollection();
    
    // Stop automated movement
    stopAutomatedMovement();
    
    // Reset player position if available
    if (originalPosition) {
      const player = document.querySelector('#player');
      if (player) {
        player.setAttribute('position', originalPosition);
      }
    }
    
    // Update flags
    isTestRunning = false;
    
    // Update UI
    document.getElementById('test-status').textContent = 'Status: Test stopped';
  }
  
  function finishTest() {
    if (!isTestRunning) return;
    
    // Record end time
    testEndTime = performance.now();
    
    // Stop the test
    stopTest();
    
    // Calculate and display results
    calculateResults();
  }
  
  function resetMetrics() {
    // Clear all metrics arrays
    metrics.fps = [];
    metrics.frameTimeMs = [];
    metrics.memoryUsage = [];
    metrics.chunkGenerationTime = [];
    metrics.activeChunks = [];
  }
  
  function startMetricsCollection() {
    // Clear any existing interval
    if (metricsInterval) {
      clearInterval(metricsInterval);
    }
    
    // Last time for frame time calculation
    let lastFrameTime = performance.now();
    let framesSinceLastUpdate = 0;
    
    // Setup RAF for per-frame metrics
    function collectFrameMetrics() {
      if (!isTestRunning) return;
      
      // Count this frame
      testFrameCount++;
      framesSinceLastUpdate++;
      
      // Calculate frame time
      const now = performance.now();
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;
      
      // Save frame time
      metrics.frameTimeMs.push(frameTime);
      
      // Schedule next collection
      requestAnimationFrame(collectFrameMetrics);
    }
    
    // Start frame collection
    requestAnimationFrame(collectFrameMetrics);
    
    // Set up interval for less frequent metrics
    metricsInterval = setInterval(function() {
      if (!isTestRunning) return;
      
      // Calculate FPS since last update
      const currentFps = Math.round(framesSinceLastUpdate / (METRICS_UPDATE_INTERVAL / 1000));
      framesSinceLastUpdate = 0;
      metrics.fps.push(currentFps);
      
      // Get memory usage if available
      if (performance.memory) {
        const memoryMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        metrics.memoryUsage.push(memoryMB);
      }
      
      // Count active chunks
      const activeChunks = countActiveChunks();
      metrics.activeChunks.push(activeChunks);
      
      // Update display
      updateMetricsDisplay();
      
    }, METRICS_UPDATE_INTERVAL);
  }
  
  function stopMetricsCollection() {
    if (metricsInterval) {
      clearInterval(metricsInterval);
      metricsInterval = null;
    }
  }
  
  function countActiveChunks() {
    // Try to count chunks based on different terrain implementations
    const pooledChunks = document.querySelectorAll('[id^="pooled-terrain"] a-entity').length;
    const enhancedChunks = document.querySelectorAll('[id^="enhanced-terrain"] a-entity').length;
    const originalChunks = document.querySelectorAll('terrain-generator three-object [material]').length;
    
    return pooledChunks || enhancedChunks || originalChunks || 0;
  }
  
  function updateMetricsDisplay() {
    const metricsEl = document.getElementById('test-metrics');
    if (!metricsEl) return;
    
    // Get the most recent metrics
    const currentFps = metrics.fps.length > 0 ? metrics.fps[metrics.fps.length - 1] : 0;
    const avgFrameTime = metrics.frameTimeMs.length > 0 ? 
      metrics.frameTimeMs.reduce((a, b) => a + b, 0) / metrics.frameTimeMs.length : 0;
    const memoryUsage = metrics.memoryUsage.length > 0 ? 
      metrics.memoryUsage[metrics.memoryUsage.length - 1] : 'N/A';
    const activeChunks = metrics.activeChunks.length > 0 ? 
      metrics.activeChunks[metrics.activeChunks.length - 1] : 0;
    
    // Update display
    metricsEl.innerHTML = `
      <div>Current FPS: <span style="color: ${currentFps > 40 ? '#7FFF7F' : currentFps > 20 ? '#FFFF7F' : '#FF7F7F'}">${currentFps}</span></div>
      <div>Avg Frame Time: ${avgFrameTime.toFixed(2)}ms</div>
      <div>Memory Usage: ${memoryUsage} MB</div>
      <div>Active Chunks: ${activeChunks}</div>
      <div>Elapsed Time: ${((performance.now() - testStartTime) / 1000).toFixed(1)}s / ${TEST_DURATION/1000}s</div>
    `;
  }
  
  function startAutomatedMovement() {
    // Pick a random direction to move (in radians)
    movementDirection = Math.random() * Math.PI * 2;
    
    // Function to move player in the selected direction
    function movePlayer() {
      if (!isTestRunning) return;
      
      const player = document.querySelector('#player');
      if (!player) return;
      
      // Get current position
      const position = player.getAttribute('position');
      
      // Calculate new position based on direction and elapsed time
      const now = performance.now();
      const elapsedSeconds = (now - testStartTime) / 1000;
      const distanceTraveled = elapsedSeconds * DISTANCE_PER_SECOND;
      
      const newX = startingPosition.x + Math.cos(movementDirection) * distanceTraveled;
      const newZ = startingPosition.z + Math.sin(movementDirection) * distanceTraveled;
      
      // Update position
      position.x = newX;
      position.z = newZ;
      player.setAttribute('position', position);
      
      // Schedule next movement update
      requestAnimationFrame(movePlayer);
    }
    
    // Start movement
    requestAnimationFrame(movePlayer);
  }
  
  function stopAutomatedMovement() {
    // Nothing to do here since movement is handled by requestAnimationFrame
    // and will stop when isTestRunning is false
  }
  
  function calculateResults() {
    // Calculate overall metrics
    const testDuration = (testEndTime - testStartTime) / 1000;
    const avgFps = testFrameCount / testDuration;
    
    // Calculate percentiles for frame time
    metrics.frameTimeMs.sort((a, b) => a - b);
    const frameTime90th = metrics.frameTimeMs[Math.floor(metrics.frameTimeMs.length * 0.9)];
    const frameTime95th = metrics.frameTimeMs[Math.floor(metrics.frameTimeMs.length * 0.95)];
    const frameTime99th = metrics.frameTimeMs[Math.floor(metrics.frameTimeMs.length * 0.99)];
    
    // Get min/max/avg for other metrics
    const minFps = Math.min(...metrics.fps);
    const maxFps = Math.max(...metrics.fps);
    const avgFrameTime = metrics.frameTimeMs.reduce((a, b) => a + b, 0) / metrics.frameTimeMs.length;
    
    // Calculate memory metrics if available
    let memoryMin = 'N/A';
    let memoryMax = 'N/A';
    let memoryAvg = 'N/A';
    
    if (metrics.memoryUsage.length > 0) {
      memoryMin = Math.min(...metrics.memoryUsage);
      memoryMax = Math.max(...metrics.memoryUsage);
      memoryAvg = metrics.memoryUsage.reduce((a, b) => a + b, 0) / metrics.memoryUsage.length;
    }
    
    // Average active chunks
    const avgActiveChunks = metrics.activeChunks.reduce((a, b) => a + b, 0) / metrics.activeChunks.length;
    
    // Create results table
    const resultsTable = document.getElementById('test-results-table');
    
    // Store results for this configuration
    currentConfig.results = {
      avgFps,
      minFps,
      maxFps,
      avgFrameTime,
      frameTime90th,
      frameTime95th,
      frameTime99th,
      memoryMin,
      memoryMax,
      memoryAvg,
      avgActiveChunks,
      testDuration
    };
    
    // Display results
    resultsTable.innerHTML = `
      <h3>Results for "${currentConfig.name}"</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #555;">
          <td style="padding: 5px; text-align: left;">Average FPS:</td>
          <td style="padding: 5px; text-align: right; font-weight: bold; color: ${avgFps > 40 ? '#7FFF7F' : avgFps > 20 ? '#FFFF7F' : '#FF7F7F'}">
            ${avgFps.toFixed(1)}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #555;">
          <td style="padding: 5px; text-align: left;">FPS Range:</td>
          <td style="padding: 5px; text-align: right;">${minFps} - ${maxFps}</td>
        </tr>
        <tr style="border-bottom: 1px solid #555;">
          <td style="padding: 5px; text-align: left;">Avg Frame Time:</td>
          <td style="padding: 5px; text-align: right;">${avgFrameTime.toFixed(2)} ms</td>
        </tr>
        <tr style="border-bottom: 1px solid #555;">
          <td style="padding: 5px; text-align: left;">Frame Time (95th percentile):</td>
          <td style="padding: 5px; text-align: right;">${frameTime95th.toFixed(2)} ms</td>
        </tr>
        <tr style="border-bottom: 1px solid #555;">
          <td style="padding: 5px; text-align: left;">Memory Usage Avg:</td>
          <td style="padding: 5px; text-align: right;">${typeof memoryAvg === 'number' ? memoryAvg.toFixed(0) + ' MB' : memoryAvg}</td>
        </tr>
        <tr>
          <td style="padding: 5px; text-align: left;">Active Chunks Avg:</td>
          <td style="padding: 5px; text-align: right;">${avgActiveChunks.toFixed(1)}</td>
        </tr>
      </table>
      <div style="margin-top: 15px;">
        <strong>Configuration Details:</strong><br>
        PoolSize: ${currentConfig.poolSize}<br>
        ChunksToRender: ${currentConfig.chunksToRender}<br>
        Resolution: ${currentConfig.resolution}<br>
        UseWorker: ${currentConfig.useWorker ? 'Yes' : 'No'}
      </div>
      <div style="margin-top: 15px; text-align: center;">
        Press 'T' to restart test with current configuration<br>
        Click "Next Configuration" to test another setup
      </div>
    `;
    
    // Update status
    document.getElementById('test-status').textContent = 'Status: Test completed';
  }
  
  function cycleToNextConfig() {
    // Move to next configuration
    currentConfigIndex = (currentConfigIndex + 1) % testConfigurations.length;
    currentConfig = testConfigurations[currentConfigIndex];
    
    // Update UI
    document.getElementById('test-config').textContent = `Configuration: ${currentConfig.description}`;
    document.getElementById('test-status').textContent = 'Status: Ready with new configuration';
    document.getElementById('test-results-table').innerHTML = '';
    
    // Show message about starting test
    const metricsEl = document.getElementById('test-metrics');
    metricsEl.innerHTML = `<div style="text-align: center; padding: 10px;">Press 'T' to start test with "${currentConfig.name}"</div>`;
  }
  
  function exportTestResults() {
    // Generate CSV data
    let csv = 'Configuration,Avg FPS,Min FPS,Max FPS,Avg Frame Time (ms),95th Percentile Frame Time (ms),Avg Memory (MB),Avg Active Chunks,Pool Size,Chunks To Render,Resolution,Use Worker\n';
    
    // Add data for each configuration that has been tested
    testConfigurations.forEach(config => {
      if (config.results) {
        const r = config.results;
        csv += `"${config.name}",${r.avgFps.toFixed(1)},${r.minFps},${r.maxFps},${r.avgFrameTime.toFixed(2)},${r.frameTime95th.toFixed(2)},${typeof r.memoryAvg === 'number' ? r.memoryAvg.toFixed(0) : 'N/A'},${r.avgActiveChunks.toFixed(1)},${config.poolSize},${config.chunksToRender},${config.resolution},${config.useWorker ? 'Yes' : 'No'}\n`;
      }
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terrain-performance-results.csv';
    a.click();
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
  
  // Configuration setup functions
  function setupOriginalTerrain(config) {
    // Remove any existing terrain components
    const terrainEntities = document.querySelectorAll('[terrain-generator], [pooled-terrain-generator], [enhanced-terrain-generator]');
    terrainEntities.forEach(entity => {
      if (entity.hasAttribute('terrain-generator')) {
        entity.removeAttribute('terrain-generator');
      }
      if (entity.hasAttribute('pooled-terrain-generator')) {
        entity.removeAttribute('pooled-terrain-generator');
      }
      if (entity.hasAttribute('enhanced-terrain-generator')) {
        entity.removeAttribute('enhanced-terrain-generator');
      }
    });
    
    // Add original terrain generator
    const terrainEntity = document.querySelector('a-entity[terrain-generator]') || 
                         document.createElement('a-entity');
    terrainEntity.setAttribute('terrain-generator', '');
    
    // Add to scene if not already there
    if (!terrainEntity.parentNode) {
      document.querySelector('a-scene').appendChild(terrainEntity);
    }
  }
  
  function setupPooledTerrain(config) {
    // Remove any existing terrain components
    const terrainEntities = document.querySelectorAll('[terrain-generator], [pooled-terrain-generator], [enhanced-terrain-generator]');
    terrainEntities.forEach(entity => {
      if (entity.hasAttribute('terrain-generator')) {
        entity.removeAttribute('terrain-generator');
      }
      if (entity.hasAttribute('pooled-terrain-generator')) {
        entity.removeAttribute('pooled-terrain-generator');
      }
      if (entity.hasAttribute('enhanced-terrain-generator')) {
        entity.removeAttribute('enhanced-terrain-generator');
      }
    });
    
    // Add pooled terrain generator
    const terrainEntity = document.querySelector('a-entity[pooled-terrain-generator]') || 
                         document.createElement('a-entity');
    terrainEntity.setAttribute('id', 'pooled-terrain');
    terrainEntity.setAttribute('pooled-terrain-generator', {
      poolSize: config.poolSize,
      chunksToRender: config.chunksToRender,
      resolution: config.resolution,
      useWorker: false
    });
    
    // Add to scene if not already there
    if (!terrainEntity.parentNode) {
      document.querySelector('a-scene').appendChild(terrainEntity);
    }
  }
  
  function setupWorkerTerrain(config) {
    // Remove any existing terrain components
    const terrainEntities = document.querySelectorAll('[terrain-generator], [pooled-terrain-generator], [enhanced-terrain-generator]');
    terrainEntities.forEach(entity => {
      if (entity.hasAttribute('terrain-generator')) {
        entity.removeAttribute('terrain-generator');
      }
      if (entity.hasAttribute('pooled-terrain-generator')) {
        entity.removeAttribute('pooled-terrain-generator');
      }
      if (entity.hasAttribute('enhanced-terrain-generator')) {
        entity.removeAttribute('enhanced-terrain-generator');
      }
    });
    
    // Add enhanced terrain generator
    const terrainEntity = document.querySelector('a-entity[enhanced-terrain-generator]') || 
                         document.createElement('a-entity');
    terrainEntity.setAttribute('id', 'enhanced-terrain');
    terrainEntity.setAttribute('enhanced-terrain-generator', {
      poolSize: config.poolSize,
      chunksToRender: config.chunksToRender,
      resolution: config.resolution,
      useWorker: config.useWorker
    });
    
    // Add to scene if not already there
    if (!terrainEntity.parentNode) {
      document.querySelector('a-scene').appendChild(terrainEntity);
    }
  }
})();
