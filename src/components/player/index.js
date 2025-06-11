import { setupIPhoneSupport } from './checkiPhone.js';
import { setupPlayerData } from './savePlayerData.js';
import { setupTopControls } from './ui/topControls.js';
import { setupKeybinds } from './keybinds.js';
import { setupPreviewVideo } from './ui/previewVideo.js';
import { setupProgressBar, formatTime } from './ui/progressBar.js';
import { setupVolumeControls } from './ui/volume.js';
import { setupPlayPause } from './ui/playPause.js';
import { setupFullscreenPiP } from './ui/fullscreenPiP.js';
import { setupDownloadVideo } from './downloadVideo.js';
import { setupSkipButtons } from './ui/skipButtons.js';
import { PlayerConfig } from './config.js';
import { generatePlayerHTML } from './template.js';
import { setupM3U8Player, cleanupHLS } from './m3u8Utils.js';

// Main initialization function
export async function initializePlayer(playerContainer, config) {
  if (!(config instanceof PlayerConfig)) {
    config = new PlayerConfig(config);
  }
  
  // Generate and inject player HTML if container is empty or doesn't have player structure
  if (!playerContainer.querySelector('#custom-player')) {
    playerContainer.innerHTML = generatePlayerHTML(config);
  }
  
  // Get player elements
  const elements = getPlayerElements(playerContainer);
  if (!elements.player) {
    console.error('Player video element not found');
    return null;
  }
  
  // Setup core functionality
  const isIPhone = setupIPhoneSupport(elements.player, elements.customPlayer, elements.topControls);
  
  // Initialize all player features based on configuration
  const handlers = await initializePlayerFeatures(elements, config, isIPhone);
  
  // Setup controls visibility
  setupControlsVisibility(elements, handlers);
  
  // handle M3U8 streams if enabled
  if (config.features.isM3U8) {
    await setupM3U8Player(elements.player, config.videoSource, config);
  } else {
    // Regular video source setup
    elements.player.src = config.videoSource;
    if (config.autoplay) {
      elements.player.play().catch(e => console.log('Autoplay prevented:', e));
    }
  }
  
  // Return player instance with cleanup function
  return createPlayerInstance(elements.player, handlers);
}

function getPlayerElements(container) {
  return {
    player: container.querySelector('#custom-player'),
    customPlayer: container.querySelector('.custom-player'),
    playPauseBtn: container.querySelector('.play-pause-btn'),
    centerPlayButton: container.querySelector('.center-play-button'),
    volumeBtn: container.querySelector('.volume-btn'),
    volumeSlider: container.querySelector('.volume-slider'),
    volumeLevel: container.querySelector('.volume-level'),
    progressContainerHitbox: container.querySelector('.progress-container-hitbox'),
    progressContainer: container.querySelector('.progress-container'),
    progressBar: container.querySelector('.progress-bar'),
    progressThumb: container.querySelector('.progress-thumb'),
    currentTimeEl: container.querySelector('.current-time'),
    timeDisplay: container.querySelector('.time-display'),
    fullscreenBtn: container.querySelector('.fullscreen-btn'),
    settingsBtn: container.querySelector('.settings-btn'),
    settingsMenu: container.querySelector('.settings-menu'),
    bufferBar: container.querySelector('.buffer-bar'),
    videoPreview: container.querySelector('.video-preview'),
    previewTime: container.querySelector('.preview-time'),
    pipBtn: container.querySelector('.pip-btn'),
    aspectToggleBtn: container.querySelector('.aspect-toggle-btn'),
    topControls: container.querySelector('.top-controls'),
    volumeContainer: container.querySelector('.volume-container'),
    backwardBtn: container.querySelector('.back-10s'),
    forwardBtn: container.querySelector('.forwards-10s'),
    downloadBtn: container.querySelector('.download-btn')
  };
}

async function initializePlayerFeatures(elements, config, isIPhone) {
  const handlers = {config: config};
  
  // Core player data (volume, timestamp)
  if (config.showId) {
    handlers.playerData = setupPlayerData(
      elements.player, 
      elements.volumeLevel, 
      config.showId, 
      config.episodeNumber, 
      config.mediaType
    );
  }
  
  // Top controls (aspect ratio toggle)
  if (config.features.aspectToggle && elements.topControls) {
    handlers.topControls = setupTopControls(
      elements.topControls, 
      elements.aspectToggleBtn, 
      elements.player
    );
  }
  
  // Volume controls
  if (elements.volumeBtn) {
    handlers.volume = setupVolumeControls(
      elements.player, 
      elements.volumeBtn, 
      elements.volumeSlider, 
      elements.volumeLevel, 
      elements.volumeContainer
    );
  }
  
  // Keyboard shortcuts
  if (handlers.volume) {
    setupKeybinds(
      elements.player, 
      elements.customPlayer, 
      handlers.volume.mute, 
      handlers.volume.showVolumeSlider, 
      elements.volumeLevel, 
      handlers.volume.updateVolumeIcon
    );
  }
  
  // Video preview on hover
  if (config.features.preview && elements.videoPreview) {
    setupPreviewVideo(
      elements.videoPreview, 
      elements.player, 
      elements.progressContainerHitbox, 
      elements.progressContainer, 
      elements.previewTime, 
      config.qualityOptions, 
      config.isNativeEmbed
    );
  }
  
  // Progress bar
  if (elements.progressContainer) {
    setupProgressBar(
      elements.player, 
      elements.progressContainerHitbox, 
      elements.progressContainer, 
      elements.progressBar, 
      elements.progressThumb, 
      elements.currentTimeEl, 
      elements.timeDisplay, 
      elements.bufferBar, 
      formatTime
    );
  }
  
  // Play/pause controls
  if (elements.playPauseBtn) {
    setupPlayPause(elements.player, elements.playPauseBtn, elements.centerPlayButton);
  }
  
  // Fullscreen and Picture-in-Picture
  if (elements.fullscreenBtn) {
    setupFullscreenPiP(elements.player, elements.customPlayer, elements.fullscreenBtn, elements.pipBtn);
  }
  
  // Skip buttons (10s forward/backward)
  if (config.features.skipButtons && elements.backwardBtn) {
    setupSkipButtons(elements.player, elements.backwardBtn, elements.forwardBtn);
  }
  
  // Settings menu
  if (elements.settingsBtn && elements.settingsMenu) {
    const { setupSettingsMenu } = await import('./ui/settings.js');
    handlers.settings = setupSettingsMenu(
      elements.settingsBtn,
      elements.settingsMenu,
      elements.player,
      elements.customPlayer,
      {
        qualityOptions: config.features.qualitySelector && (config.qualityOptions.length > 0) 
          ? config.qualityOptions 
          : [],
        subtitleTracks: config.features.subtitles ? config.subtitleTracks : [],
        isIPhone,
        isNativeEmbed: config.isNativeEmbed,
        fetchVideoUrlCallback: config.callbacks.fetchVideoUrl,
        isIframeEmbed: config.isIframeEmbed
      }
    );
  }
  
  // Download functionality
  if (config.features.download && elements.downloadBtn) {
    setupDownloadVideo(elements.downloadBtn, elements.player);
  }
  
  return handlers;
}

function setupControlsVisibility(elements, handlers) {
  let controlsTimeout;
  
  const showControls = () => {
    const playerControls = elements.customPlayer.querySelector('.player-controls');
    if (!playerControls) return;
    
    playerControls.classList.remove('opacity-0');
    
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    
    controlsTimeout = setTimeout(() => {
      playerControls.classList.add('opacity-0');
    }, 2000);
  };
  
  elements.customPlayer.addEventListener('mousemove', () => {
    showControls();
    if (handlers.topControls?.showTopControls) {
      handlers.topControls.showTopControls();
    }
  });
  
  // Initially show controls
  showControls();
}

function createPlayerInstance(player, handlers) {
  const cleanup = () => {
    // Clean up HLS instance if it exists
    cleanupHLS(player);
    
    // Clean up settings menu
    if (handlers.cleanupSettings) {
      handlers.cleanupSettings();
    }
    
    // Clean up data handlers
    if (handlers.cleanupDataHandlers) {
      handlers.cleanupDataHandlers();
    }
  };

  player.cleanup = cleanup;

  return {
    player,
    cleanup,
    handlers,
    setupVideoSource: (videoSource) => setupM3U8Player(player, videoSource, handlers.config)
  };
}