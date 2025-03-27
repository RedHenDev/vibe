// Music System for Eigengrau Light (FIXED)
// A simple background music manager with controls and day/night cycle integration

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const musicEntity = document.createElement('a-entity');
        musicEntity.setAttribute('id', 'music-system');
        musicEntity.setAttribute('music-system', '');
        scene.appendChild(musicEntity);
        console.log('Music system initialized');
      });
    }
  });
  
  AFRAME.registerComponent('music-system', {
    schema: {
      enabled: { type: 'boolean', default: true },
      volume: { type: 'number', default: 0.5 },
      currentTrack: { type: 'number', default: 0 },
      lastPlayedTrack: { type: 'number', default: -1 }, // Track the last played track index
      autoplay: { type: 'boolean', default: true },
      fadeTime: { type: 'number', default: 2.0 }, // Fade in/out time in seconds
      randomizeFirst: { type: 'boolean', default: true }, // Start with a random track
      isNightTime: { type: 'boolean', default: false } // Track day/night state
    },
    
    init: function() {
      // Define your music tracks - update these paths to match your actual files
      this.tracks = [
        './assets/pixel_wonder.mp3',
        './assets/shadows_of_the_system.mp3',
        './assets/neon.mp3',
        './assets/eigengrau_light.mp3' // Night track
      ];
      
      // Track names for display
      this.trackNames = [
        'Pixel Wonder',
        'Shadows of the System',
        'Neon',
        'Eigengrau Light'
      ];
      
      // Track indices for day/night selection
      this.dayTracks = [0, 1, 2]; // Indices of tracks to use during day
      this.nightTrack = 3; // Index of eigengrau_light.mp3
      
      // Randomize starting track if enabled
      if (this.data.randomizeFirst && this.dayTracks.length > 0) {
        this.data.currentTrack = this.dayTracks[Math.floor(Math.random() * this.dayTracks.length)];
        console.log(`Music system: Randomized starting track: ${this.data.currentTrack + 1} - ${this.trackNames[this.data.currentTrack]}`);
      }
      
      // Create audio element
      this.audioElement = document.createElement('audio');
      this.audioElement.loop = false; // FIXED: Set to false to allow tracks to change automatically
      this.audioElement.volume = 0; // Start at 0 for fade-in
      this.audioElement.setAttribute('preload', 'auto');
      
      // Add audio element to DOM
      document.body.appendChild(this.audioElement);
      
      // Flag to track if music has been started by user interaction
      this.musicActivated = false;
      
      // Create control button (hidden initially)
      this.createMusicToggleButton();
      
      // Listen for welcome message dismissal
      this.setupWelcomeMessageListener();
      
      // Listen for key presses
      this.onKeyDown = this.onKeyDown.bind(this);
      document.addEventListener('keydown', this.onKeyDown);
      
      // Handle track ended event to play next track
      this.audioElement.addEventListener('ended', () => {
        // FIXED: This will now trigger since loop is false
        this.nextTrack();
      });
      
      // Set global reference for other components to access
      window.musicSystem = this;
      
      console.log(`Music system ready with ${this.tracks.length} tracks`);
    },
    
    setupWelcomeMessageListener: function() {
      // Listen for custom welcome-dismissed event
      document.addEventListener('welcome-dismissed', () => {
        console.log('Welcome message dismissed, starting music');
        
        if (this.data.autoplay && !this.musicActivated && this.data.enabled) {
          this.musicActivated = true;
          this.playTrack(this.data.currentTrack);
        }
        
        // Show the music control button after welcome is dismissed
        if (this.musicButton) {
          setTimeout(() => {
            this.musicButton.style.display = 'block';
            this.musicButton.style.opacity = '1';
          }, 1000); // Small delay after welcome is gone
        }
      });
      
      // Also listen for click on document as fallback
      document.addEventListener('click', () => {
        if (!this.musicActivated && this.data.autoplay && this.data.enabled) {
          this.musicActivated = true;
          this.playTrack(this.data.currentTrack);
          
          // Show the music control button if it's still hidden
          if (this.musicButton && this.musicButton.style.display === 'none') {
            this.musicButton.style.display = 'block';
            this.musicButton.style.opacity = '1';
          }
        }
      }, { once: true }); // Only need one click to enable audio
    },
    
    playTrack: function(trackIndex) {
      if (trackIndex >= 0 && trackIndex < this.tracks.length) {
        // Store the previous track before changing
        this.data.lastPlayedTrack = this.data.currentTrack;
        this.data.currentTrack = trackIndex;
        
        const changeAndPlay = () => {
          this.audioElement.src = this.tracks[trackIndex];
          this.audioElement.load();
          const playPromise = this.audioElement.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              this.fadeIn();
              this.updateMusicButton(true);
            }).catch(error => {
              console.log('Playback prevented by browser', error);
            });
          }
        };
        
        if (!this.audioElement.paused) {
          this.fadeOut(changeAndPlay);
        } else {
          changeAndPlay();
        }
        
        this.showTrackNotification(this.trackNames[trackIndex] || `Track ${trackIndex + 1}`);
      }
    },
    
    // Set night mode - called by day-night-cycle.js when night begins
    setNightMode: function() {
      // Only change if not already in night mode
      if (!this.data.isNightTime) {
        this.data.isNightTime = true;
        console.log('Music system: Switching to night mode');
        
        // Only change track if music is already playing
        if (!this.audioElement.paused) {
          this.playTrack(this.nightTrack);
        }
      }
    },
    
    // Set day mode - called by day-night-cycle.js when day begins
    setDayMode: function() {
      // Only change if not already in day mode
      if (this.data.isNightTime) {
        this.data.isNightTime = false;
        console.log('Music system: Switching to day mode');
        
        // Only change track if music is already playing
        if (!this.audioElement.paused) {
          this.playRandomDayTrack();
        }
      }
    },
    
    // Play a random day track (avoiding the last played track)
    playRandomDayTrack: function() {
      // Filter out the last played track from options
      const availableTracks = this.dayTracks.filter(index => 
        index !== this.data.lastPlayedTrack
      );
      
      // Pick a random track from available options
      const randomIndex = Math.floor(Math.random() * availableTracks.length);
      const trackToPlay = availableTracks[randomIndex];
      
      this.playTrack(trackToPlay);
    },
    
    nextTrack: function() {
      if (this.data.isNightTime) {
        // If night time, stick with night track
        this.playTrack(this.nightTrack);
      } else {
        // Store current as last played
        this.data.lastPlayedTrack = this.data.currentTrack;
        
        // Get available daylight tracks (exclude night track and last played)
        const availableTracks = this.dayTracks.filter(index => 
          index !== this.data.lastPlayedTrack
        );
        
        // Pick a random track from available options
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        const trackToPlay = availableTracks[randomIndex];
        
        this.playTrack(trackToPlay);
      }
    },
    
    previousTrack: function() {
      if (this.data.isNightTime) {
        // If night time, stick with night track
        this.playTrack(this.nightTrack);
      } else if (this.data.lastPlayedTrack >= 0 && this.dayTracks.includes(this.data.lastPlayedTrack)) {
        // Go to actual previous track that was played (if it's a day track)
        this.playTrack(this.data.lastPlayedTrack);
      } else {
        // If no valid previous track, get a random day track
        this.playRandomDayTrack();
      }
    },
    
    fadeIn: function() {
      // Cancel any existing fade
      if (this.fadeInterval) clearInterval(this.fadeInterval);
      
      const fadeDuration = this.data.fadeTime * 1000; // Convert to ms
      const steps = 20; // Number of steps in the fade
      const stepTime = fadeDuration / steps;
      const volumeStep = this.data.volume / steps;
      
      let currentStep = 0;
      
      this.fadeInterval = setInterval(() => {
        currentStep++;
        this.audioElement.volume = Math.min(this.data.volume, volumeStep * currentStep);
        
        if (currentStep >= steps) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
      }, stepTime);
    },
    
    fadeOut: function(callback) {
      // Cancel any existing fade
      if (this.fadeInterval) clearInterval(this.fadeInterval);
      
      const fadeDuration = this.data.fadeTime * 500; // Fade out is quicker
      const steps = 10;
      const stepTime = fadeDuration / steps;
      const volumeStep = this.audioElement.volume / steps;
      
      let currentStep = 0;
      
      this.fadeInterval = setInterval(() => {
        currentStep++;
        this.audioElement.volume = Math.max(0, this.audioElement.volume - volumeStep);
        
        if (currentStep >= steps) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
          
          if (callback) callback();
        }
      }, stepTime);
    },
    
    toggleMusic: function() {
      if (this.audioElement.paused) {
        // Start playing - appropriate track for current day/night state
        if (this.data.isNightTime) {
          this.playTrack(this.nightTrack);
        } else {
          // Play current track or a random day track
          const currentIsDay = this.dayTracks.includes(this.data.currentTrack);
          if (currentIsDay) {
            this.playTrack(this.data.currentTrack);
          } else {
            this.playRandomDayTrack();
          }
        }
      } else {
        // Pause with fade out
        this.fadeOut(() => {
          this.audioElement.pause();
        });
        this.updateMusicButton(false);
      }
    },
    
    updateMusicButton: function(isPlaying) {
      if (!this.musicButton) return;
      
      if (isPlaying) {
        this.musicButton.textContent = '🔊 Music: ON';
        this.musicButton.style.backgroundColor = 'rgba(2, 126, 150, 0.7)';
      } else {
        this.musicButton.textContent = '🔇 Music: OFF';
        this.musicButton.style.backgroundColor = 'rgba(100, 100, 100, 0.7)';
      }
    },
    
    createMusicToggleButton: function() {
      this.musicButton = document.createElement('button');
      this.musicButton.className = 'music-toggle-btn';
      this.musicButton.textContent = '🔊 Music: ON';
      
      Object.assign(this.musicButton.style, {
        position: 'fixed',
        bottom: '32px',
        left: '10px',
        padding: '10px 15px',
        border: 'none',
        borderRadius: '20px',
        backgroundColor: 'rgba(0, 170, 204, 0.7)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
        zIndex: '1000',
        cursor: 'pointer',
        display: 'none', // Hidden initially until welcome is dismissed
        opacity: '0',
        transition: 'opacity 0.5s ease-in-out'
      });
      
      this.musicButton.addEventListener('click', () => {
        this.toggleMusic();
      });
      
      document.body.appendChild(this.musicButton);
    },
    
    showTrackNotification: function(trackName) {
      // Create or update notification
      if (!this.trackNotification) {
        this.trackNotification = document.createElement('div');
        Object.assign(this.trackNotification.style, {
          position: 'fixed',
          bottom: '80px',
          left: '10px',
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          borderRadius: '15px',
          zIndex: '1000',
          opacity: '0',
          transition: 'opacity 0.5s ease-in-out',
          pointerEvents: 'none' // Don't interfere with clicks
        });
        document.body.appendChild(this.trackNotification);
      }
      
      // Set content and show
      this.trackNotification.textContent = `♫ Now playing: ${trackName}`;
      this.trackNotification.style.opacity = '1';
      
      // Hide after 3 seconds
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = setTimeout(() => {
        this.trackNotification.style.opacity = '0';
      }, 3000);
    },
    
    onKeyDown: function(event) {
      // 'M' key toggles music
      if (event.key === 'm' || event.key === 'M') {
        this.toggleMusic();
      }
      
      // 'N' key for next track
      if (event.key === 'n' || event.key === 'N') {
        this.nextTrack();
      }
      
      // 'P' key for previous track
      if (event.key === 'p' || event.key === 'P') {
        this.previousTrack();
      }
      
      // Number keys 1-9 for direct track selection - only allow day tracks during day
      const keyNum = parseInt(event.key);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= Math.min(9, this.tracks.length)) {
        const trackIndex = keyNum - 1;
        
        // If it's night time, only allow the night track
        if (this.data.isNightTime && trackIndex !== this.nightTrack) {
          this.showTrackNotification('Only night music is available during night time');
          return;
        }
        
        // If it's day time, only allow day tracks
        if (!this.data.isNightTime && trackIndex === this.nightTrack) {
          this.showTrackNotification('Night music is only available during night time');
          return;
        }
        
        this.playTrack(trackIndex);
      }
    },
    
    remove: function() {
      // Clean up
      document.removeEventListener('keydown', this.onKeyDown);
      
      // Stop any fades
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
      
      // Clear notification timeout
      if (this.notificationTimeout) {
        clearTimeout(this.notificationTimeout);
      }
      
      // Remove audio element
      if (this.audioElement) {
        this.audioElement.pause();
        if (this.audioElement.parentNode) {
          this.audioElement.parentNode.removeChild(this.audioElement);
        }
      }
      
      // Remove UI elements
      if (this.musicButton && this.musicButton.parentNode) {
        this.musicButton.parentNode.removeChild(this.musicButton);
      }
      
      if (this.trackNotification && this.trackNotification.parentNode) {
        this.trackNotification.parentNode.removeChild(this.trackNotification);
      }
      
      // Remove global reference
      delete window.musicSystem;
    }
  });