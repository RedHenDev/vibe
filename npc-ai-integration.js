// NPC AI Integration for Eigengrau Light
// Connects the enhanced AI system with the existing NPC manager and provides backward compatibility

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing enhanced NPC AI integration');
  
  // Wait for scene to be fully loaded
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      // Create integration entity
      const integrationEntity = document.createElement('a-entity');
      integrationEntity.setAttribute('id', 'npc-ai-integration');
      integrationEntity.setAttribute('npc-ai-integration', '');
      scene.appendChild(integrationEntity);
    });
  }
});

// Main integration component
AFRAME.registerComponent('npc-ai-integration', {
  schema: {
    enableNewAI: { type: 'boolean', default: true },      // Enable enhanced AI
    upgradeExistingNPCs: { type: 'boolean', default: true }, // Upgrade existing NPCs
    debug: { type: 'boolean', default: false }           // Show debug info
  },
  
  init: function() {
    // Track NPCs
    this.enhancedNPCs = new Set();
    
    // Connect to day-night cycle
    this.connectToDayNightCycle();
    
    // Connect to NPC Manager
    this.connectToNPCManager();
    
    // Upgrade existing NPCs
    if (this.data.upgradeExistingNPCs) {
      this.upgradeExistingNPCs();
    }
    
    // Set up observer to enhance new NPCs
    this.setupNPCObserver();
    
    // Inject enhanced AI creation into NPC manager spawn function
    this.enhanceNPCManagerSpawn();
    
    console.log('NPC AI integration initialized');
  },
  
  connectToDayNightCycle: function() {
    // Find the day-night-cycle component
    const dayNightCycle = document.querySelector('#day-night-cycle');
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      this.dayNightCycle = dayNightCycle.components['day-night-cycle'];
      this.isNightTime = this.dayNightCycle.isNight;
      
      // Extend the day-night cycle methods to notify our NPCs
      this.extendDayNightCycleMethods();
    } else {
      // Try again later
      setTimeout(() => this.connectToDayNightCycle(), 1000);
    }
  },
  
  connectToNPCManager: function() {
    // Find NPC manager
    const scene = document.querySelector('a-scene');
    if (scene && scene.systems['npc-manager']) {
      this.npcManager = scene.systems['npc-manager'];
      
      // Log NPC types for debugging
      if (this.data.debug) {
        console.log('NPC Types loaded:', this.npcManager.npcTypes);
      }
    } else {
      // Try again later
      setTimeout(() => this.connectToNPCManager(), 1000);
    }
  },
  
  extendDayNightCycleMethods: function() {
    if (!this.dayNightCycle) return;
    
    // Store original methods
    const originalCompleteNight = this.dayNightCycle.completeNightTransition;
    const originalCompleteDay = this.dayNightCycle.completeDayTransition;
    
    // Extend night transition
    this.dayNightCycle.completeNightTransition = () => {
      // Call original first
      if (originalCompleteNight) {
        originalCompleteNight.call(this.dayNightCycle);
      }
      
      // Now notify our enhanced NPCs
      this.updateAllNPCsTimeState(true);
    };
    
    // Extend day transition
    this.dayNightCycle.completeDayTransition = () => {
      // Call original first
      if (originalCompleteDay) {
        originalCompleteDay.call(this.dayNightCycle);
      }
      
      // Now notify our enhanced NPCs
      this.updateAllNPCsTimeState(false);
    };
    
    console.log('Day-night cycle methods extended for enhanced NPCs');
  },
  
  upgradeExistingNPCs: function() {
    // Find all NPCs in the scene
    const existingNPCs = document.querySelectorAll('[ai-locomotion], [ai-loco-legacy]');
    
    console.log(`Found ${existingNPCs.length} existing NPCs to upgrade`);
    
    // Upgrade each NPC
    existingNPCs.forEach(npc => {
      this.enhanceNPC(npc);
    });
  },
  
  setupNPCObserver: function() {
    // Set up mutation observer to catch new NPC creation
    const npcContainer = document.querySelector('#npcs');
    if (!npcContainer) {
      console.warn('NPC container not found, cannot observe new NPCs');
      return;
    }
    
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Check added nodes for new NPCs
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is an NPC entity
              if (node.hasAttribute('ai-locomotion') || 
                  node.hasAttribute('ai-loco-legacy') ||
                  node.hasAttribute('gltf-model')) {
                this.enhanceNPC(node);
              }
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(npcContainer, { childList: true });
    
    console.log('NPC observer set up for new NPC enhancement');
  },
  
  enhanceNPCManagerSpawn: function() {
    // Enhance the NPC manager's spawn function to add our AI
    if (!this.npcManager) return;
    
    // Store original function
    const originalSpawnMethod = this.npcManager.activateNPC;
    
    // Replace with enhanced version
    this.npcManager.activateNPC = function() {
      // Call original method
      const result = originalSpawnMethod.apply(this, arguments);
      
      // Find the entity that was just activated
      const activeNPCs = Array.from(this.activeNPCs);
      if (activeNPCs.length > 0) {
        const lastActivated = activeNPCs[activeNPCs.length - 1];
        if (lastActivated && lastActivated.el) {
          // Signal to enhance this NPC
          document.dispatchEvent(new CustomEvent('npc-spawned', {
            detail: { npcElement: lastActivated.el }
          }));
        }
      }
      
      return result;
    };
    
    // Listen for spawn events
    document.addEventListener('npc-spawned', (event) => {
      if (event.detail && event.detail.npcElement) {
        this.enhanceNPC(event.detail.npcElement);
      }
    });
    
    console.log('NPC Manager spawn method enhanced');
  },
  
  enhanceNPC: function(npcElement) {
    // Skip if already enhanced
    if (this.enhancedNPCs.has(npcElement) || 
        npcElement.hasAttribute('enhanced-ai')) {
      return;
    }
    
    // Determine the NPC type and configure accordingly
    const npcType = this.determineNPCType(npcElement);
    
    // Skip if not a valid NPC
    if (!npcType) return;
    
    // Apply appropriate enhancements based on type
    this.applyEnhancementsForType(npcElement, npcType);
    
    // Add to tracking set
    this.enhancedNPCs.add(npcElement);
    
    if (this.data.debug) {
      console.log(`Enhanced NPC: ${npcElement.id || 'unnamed'} as type: ${npcType}`);
    }
  },
  
  determineNPCType: function(npcElement) {
    // Try to determine NPC type based on attributes and model
    let npcType = null;
    
    // Check if the element has a model attribute
    const modelAttr = npcElement.getAttribute('gltf-model');
    
    if (modelAttr) {
      // Match model to known types
      if (modelAttr === '#mGlasst') {
        npcType = 'glasst';
      } else if (modelAttr === '#mCublit') {
        npcType = 'vibe-stealer';
      } else if (modelAttr === '#mWibbit') {
        npcType = 'wibbit';
      } else if (modelAttr === '#mShab' || modelAttr === '#mShelby') {
        npcType = 'simple';
      }
    }
    
    // Check based on ID if type still not determined
    if (!npcType && npcElement.id) {
      const id = npcElement.id.toLowerCase();
      if (id.includes('night')) {
        npcType = 'nocturnal';
      } else if (id.includes('day')) {
        npcType = 'diurnal';
      } else if (id.includes('glasst')) {
        npcType = 'glasst';
      } else if (id.includes('cublit')) {
        npcType = 'vibe-stealer';
      } else if (id.includes('wibbit')) {
        npcType = 'wibbit';
      }
    }
    
    // Default to basic if still not determined but has AI component
    if (!npcType && (npcElement.hasAttribute('ai-locomotion') || 
                       npcElement.hasAttribute('ai-loco-legacy'))) {
      npcType = 'basic';
    }
    
    return npcType;
  },
  
  applyEnhancementsForType: function(npcElement, npcType) {
    // Common enhancements for all NPCs
    const commonAIConfig = {
      targetID: '#player',
      height: 1.0,
      active: true
    };
    
    // Type-specific configurations
    let aiConfig = {};
    let isVibeHunter = false;
    let vibeHunterConfig = {};
    
    switch (npcType) {
      case 'glasst':
        // Glass tooth - fast and aggressive
        aiConfig = {
          speed: 5.0,
          maxSpeed: 12.0,
          behavior: 'hunt',
          huntingRange: 150,
          height: 6.0,
          nightBoost: 2.0
        };
        isVibeHunter = true;
        vibeHunterConfig = {
          stealRange: 4.0,
          stealAmount: 1,
          stealCooldown: 2000
        };
        break;
        
      case 'vibe-stealer':
        // Cublit - specifically designed to steal vibes
        aiConfig = {
          speed: 4.0,
          maxSpeed: 15.0,
          behavior: 'swarm',
          huntingRange: 200,
          height: 12.0,
          nightBoost: 2.5
        };
        isVibeHunter = true;
        vibeHunterConfig = {
          stealRange: 6.0,
          stealAmount: 2,
          stealCooldown: 3000,
          visualIndicator: true
        };
        break;
        
      case 'wibbit':
        // Wibbit - bouncy and playful
        aiConfig = {
          speed: 3.0,
          maxSpeed: 8.0,
          behavior: 'patrol',
          huntingRange: 100,
          height: 2.0,
          nightBoost: 1.5
        };
        isVibeHunter = false;
        break;
        
      case 'nocturnal':
        // Generic nocturnal - active at night
        aiConfig = {
          speed: 3.0,
          maxSpeed: 10.0,
          behavior: 'patrol',
          huntingRange: 120,
          nightBoost: 2.0
        };
        isVibeHunter = true;
        vibeHunterConfig = {
          stealRange: 3.5,
          stealAmount: 1,
          stealCooldown: 4000
        };
        break;
        
      case 'diurnal':
        // Generic diurnal - active during day
        aiConfig = {
          speed: 2.0,
          maxSpeed: 5.0,
          behavior: 'patrol',
          huntingRange: 50,
          nightBoost: 0.5 // Slower at night
        };
        isVibeHunter = false;
        break;
        
      case 'simple':
        // Simple/basic NPC - not very aggressive
        aiConfig = {
          speed: 1.5,
          maxSpeed: 3.0,
          behavior: 'patrol',
          huntingRange: 40
        };
        isVibeHunter = false;
        break;
        
      case 'basic':
      default:
        // Basic fallback
        aiConfig = {
          speed: 2.0,
          maxSpeed: 6.0,
          behavior: 'patrol',
          huntingRange: 80
        };
        isVibeHunter = false;
        break;
    }
    
    // Apply configurations
    const finalAIConfig = { ...commonAIConfig, ...aiConfig };
    
    // Apply enhanced AI
    try {
      // Remove old AI components first to avoid conflicts
      if (npcElement.hasAttribute('ai-locomotion')) {
        // Get height from original component if possible
        const oldAI = npcElement.components['ai-locomotion'];
        if (oldAI && oldAI.data.height) {
          finalAIConfig.height = oldAI.data.height;
        }
        npcElement.removeAttribute('ai-locomotion');
      }
      
      if (npcElement.hasAttribute('ai-loco-legacy')) {
        // Get height from original component if possible
        const oldAI = npcElement.components['ai-loco-legacy'];
        if (oldAI && oldAI.data.height) {
          finalAIConfig.height = oldAI.data.height;
        }
        npcElement.removeAttribute('ai-loco-legacy');
      }
      
      // Add enhanced AI
      npcElement.setAttribute('enhanced-ai', finalAIConfig);
      
      // Add vibe hunter if appropriate
      if (isVibeHunter) {
        npcElement.setAttribute('vibe-hunter', vibeHunterConfig);
      }
      
      // Set initial night mode if needed
      if (this.isNightTime) {
        setTimeout(() => {
          const aiComponent = npcElement.components['enhanced-ai'];
          if (aiComponent) {
            aiComponent.setNightMode(true);
          }
          
          const vibeHunterComponent = npcElement.components['vibe-hunter'];
          if (vibeHunterComponent) {
            vibeHunterComponent.updateNightState(true);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error enhancing NPC:', error);
    }
  },
  
  updateAllNPCsTimeState: function(isNight) {
    // Update all enhanced NPCs with new time state
    this.enhancedNPCs.forEach(npcElement => {
      // Update enhanced AI component
      const aiComponent = npcElement.components['enhanced-ai'];
      if (aiComponent) {
        aiComponent.setNightMode(isNight);
      }
      
      // Update vibe hunter component
      const vibeHunterComponent = npcElement.components['vibe-hunter'];
      if (vibeHunterComponent) {
        vibeHunterComponent.updateNightState(isNight);
      }
    });
    
    console.log(`Updated all NPCs to ${isNight ? 'night' : 'day'} mode`);
  },
  
  tick: function() {
    // Periodically check for new NPCs that might have been missed
    if (!this._lastCheck || Date.now() - this._lastCheck > 5000) {
      this._lastCheck = Date.now();
      
      // Check if we've lost day-night cycle reference
      if (!this.dayNightCycle) {
        this.connectToDayNightCycle();
      }
      
      // Check if we've lost NPC manager reference
      if (!this.npcManager) {
        this.connectToNPCManager();
      }
    }
  }
});
