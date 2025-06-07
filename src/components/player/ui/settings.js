import Hls from 'hls.js';
import config from '../../../config.json';

export function setupSettingsMenu(settingsBtn, settingsMenu, player, customPlayer, options) {
  if (!settingsBtn || !settingsMenu) return;
  
  const {
    qualityOptions = [],
    subtitleTracks = [],
    isIPhone = false,
    isNativeEmbed = false,
    fetchVideoUrlCallback = null,
    isIframeEmbed = false
  } = options;
  
  let currentPage = 'main';
  let currentSubtitleIndex = -1;
  let currentQuality = null;
  let currentSpeed = 1;
  let isTransitioning = false;
  
  // Subtitle handling
  let subtitleData = null;
  let subtitleContainer = null;
  let subtitleUpdateInterval = null;
  
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  
  const formatQualityOption = (optionName) => {
    return optionName
      .replace('SubsPlease', 'SubsPls')
      .replace('Bunny-Apocalypse', 'Bunny');
  };
  
  const createSubtitleContainer = () => {
    if (subtitleContainer) return subtitleContainer;
    
    const container = document.createElement('div');
    container.className = 'subtitle-container absolute left-0 right-0 bottom-16 z-30 text-center';
    container.style.cssText = 'pointer-events: none;';
    player.parentNode.appendChild(container);
    
    return container;
  };
  
  const parseSubtitle = async (url) => {
    try {
      const response = await fetch(config.proxy, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          method: 'GET'
        })
      });
      
      const subtitleText = await response.text();
      
      if (typeof window.Subtitle === 'undefined') {
        return parseSubtitleManually(subtitleText);
      }
      
      return window.Subtitle.parse(subtitleText);
    } catch (error) {
      console.error('Error parsing subtitle:', error);
      return [];
    }
  };
  
  const parseSubtitleManually = (subtitleText) => {
    const cues = [];
    
    const isVTT = subtitleText.trim().startsWith('WEBVTT');
    const entries = subtitleText.split(/\r?\n\r?\n/);
    
    entries.forEach(entry => {
      if (!entry.trim()) return;
      
      if (isVTT && entry.trim() === 'WEBVTT') return;
      const lines = entry.split(/\r?\n/);
      if (lines.length < 2) return;
      
      const timingLineIndex = lines.findIndex(line => line.includes('-->'));
      if (timingLineIndex === -1) return;
      
      const timingLine = lines[timingLineIndex];
      const timeParts = timingLine.split('-->').map(t => t.trim());
      if (timeParts.length !== 2) return;
      
      const start = parseTimeToMs(timeParts[0]);
      const end = parseTimeToMs(timeParts[1]);
      
      if (isNaN(start) || isNaN(end)) return;
      
      const text = lines.slice(timingLineIndex + 1).join('\n');
      
      cues.push({ start, end, text });
    });
    
    return cues;
  };
  
  const parseTimeToMs = (timeString) => {
    timeString = timeString.replace(',', '.');
    timeString = timeString.split(' ')[0];
    
    const parts = timeString.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseFloat(parts[2]);
      
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseFloat(parts[1]);
      
      return (minutes * 60 + seconds) * 1000;
    }
    
    return NaN;
  };
  
  const updateSubtitle = (time) => {
    if (!subtitleData || !subtitleContainer) return;
    
    const currentTime = time * 1000;
    let text = '';
    
    for (const cue of subtitleData) {
      if (currentTime >= cue.start && currentTime <= cue.end) {
        text = cue.text;
        break;
      }
    }
    
    subtitleContainer.innerHTML = text ? `<p class="text-lg font-medium px-3 py-2 inline-block font-['Inter'] text-text-primary backdrop-blur-lg bg-background-secondary border border-background-tertiary rounded-lg shadow-2xl">${text}</p>` : '';
  };
  
  const startSubtitleDisplay = async (subtitle) => {
    stopSubtitleDisplay();
    
    subtitleContainer = createSubtitleContainer();
    subtitleData = await parseSubtitle(subtitle.url);
    
    subtitleUpdateInterval = setInterval(() => {
      if (player && !player.paused) {
        updateSubtitle(player.currentTime);
      }
    }, 100);
    
    player.addEventListener('seeked', () => updateSubtitle(player.currentTime));
  };
  
  const stopSubtitleDisplay = () => {
    if (subtitleUpdateInterval) {
      clearInterval(subtitleUpdateInterval);
      subtitleUpdateInterval = null;
    }
    
    if (subtitleContainer) {
      subtitleContainer.innerHTML = '';
    }
    
    subtitleData = null;
  };
  
  // Page transition helper functions
  const slideOut = (direction = 'left') => {
    return new Promise((resolve) => {
      const content = settingsMenu.querySelector('.settings-content');
      if (!content) {
        resolve();
        return;
      }
      
      const translateX = direction === 'left' ? '-100%' : '100%';
      content.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
      content.style.transform = `translateX(${translateX})`;
      content.style.opacity = '0';
      
      setTimeout(resolve, 250);
    });
  };
  
  const slideIn = (direction = 'right') => {
    return new Promise((resolve) => {
      const content = settingsMenu.querySelector('.settings-content');
      if (!content) {
        resolve();
        return;
      }
      
      const initialTranslateX = direction === 'right' ? '100%' : '-100%';
      content.style.transform = `translateX(${initialTranslateX})`;
      content.style.opacity = '0';
      content.style.transition = 'none';
      
      content.offsetHeight;
      
      content.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
      content.style.transform = 'translateX(0)';
      content.style.opacity = '1';
      
      setTimeout(resolve, 250);
    });
  };
  
  const transitionToPage = async (renderFunction, slideDirection = 'right') => {
    if (isTransitioning) return;
    isTransitioning = true;
    
    await slideOut(slideDirection === 'right' ? 'left' : 'right');
    renderFunction();
    await slideIn(slideDirection);
    
    isTransitioning = false;
  };
  
  const toggleSettingsMenu = () => {
    settingsMenu.classList.toggle('opacity-0');
    settingsMenu.classList.toggle('pointer-events-none');
    if (!settingsMenu.classList.contains('opacity-0')) {
      renderMainPage();
    }
  };
  
  const renderMainPage = () => {
    currentPage = 'main';
    settingsMenu.innerHTML = `
      <div class="settings-content p-3 min-w-[280px] bg-background-secondary backdrop-blur-xl border border-background-tertiary rounded-xl shadow-2xl transition-all duration-300 ease-out overflow-hidden">
        <div class="settings-header mb-3">
          <h3 class="text-text-primary text-base font-semibold m-0">Settings</h3>
        </div>
        
        <div class="settings-options space-y-1">
          ${qualityOptions.length > 0 ? `
          <button class="settings-option group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 ease-out border border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary hover:border-button-primary hover:-translate-y-px" data-page="quality">
            <div class="flex items-center gap-2">
              <div class="p-1 rounded-md transition-all duration-300 bg-button-primary">
                <svg class="w-3.5 h-3.5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                </svg>
              </div>
              <span class="font-medium">Quality</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-md text-text-secondary bg-button-primary" id="current-quality">Auto</span>
              <svg class="w-3.5 h-3.5 transition-transform duration-300 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
          ` : ''}
          
          <button class="settings-option group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 ease-out border border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary hover:border-button-primary hover:-translate-y-px" data-page="speed">
            <div class="flex items-center gap-2">
              <div class="p-1 rounded-md transition-all duration-300 bg-button-primary">
                <svg class="w-3.5 h-3.5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                </svg>
              </div>
              <span class="font-medium">Speed</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-md text-text-secondary bg-button-primary" id="current-speed">${currentSpeed}x</span>
              <svg class="w-3.5 h-3.5 transition-transform duration-300 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
          
          ${subtitleTracks.length > 0 ? `
          <button class="settings-option group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 ease-out border border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary hover:border-button-primary hover:-translate-y-px" data-page="subtitles">
            <div class="flex items-center gap-2">
              <div class="p-1 rounded-md transition-all duration-300 bg-button-primary">
                <svg class="w-3.5 h-3.5 text-text-secondary" fill="currentColor" viewBox="0 0 25 20">
                  <path transform="translate(-3 -6)" d="M25.5,6H5.5A2.507,2.507,0,0,0,3,8.5v15A2.507,2.507,0,0,0,5.5,26h20A2.507,2.507,0,0,0,28,23.5V8.5A2.507,2.507,0,0,0,25.5,6ZM5.5,16h5v2.5h-5ZM18,23.5H5.5V21H18Zm7.5,0h-5V21h5Zm0-5H13V16H25.5Z"/>
                </svg>
              </div>
              <span class="font-medium">Subtitles</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded-md text-text-secondary bg-button-primary" id="current-subtitle">${currentSubtitleIndex === -1 ? 'Off' : subtitleTracks[currentSubtitleIndex]?.lang || 'Off'}</span>
              <svg class="w-3.5 h-3.5 transition-transform duration-300 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
          ` : ''}
        </div>
      </div>
    `;
    
    setupMainPageEvents();
  };
  
  const setupMainPageEvents = () => {
    const options = settingsMenu.querySelectorAll('.settings-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        const page = option.dataset.page;
        switch (page) {
          case 'quality':
            transitionToPage(() => renderQualityPage(false), 'right');
            break;
          case 'speed':
            transitionToPage(() => renderSpeedPage(false), 'right');
            break;
          case 'subtitles':
            transitionToPage(() => renderSubtitlesPage(false), 'right');
            break;
        }
      });
    });
  };
  
  const renderQualityPage = (immediate = true) => {
    currentPage = 'quality';
    settingsMenu.innerHTML = `
      <div class="settings-content p-3 min-w-[280px] bg-background-secondary backdrop-blur-xl border border-background-tertiary rounded-xl shadow-2xl transition-all duration-300 ease-out overflow-hidden">
        <div class="settings-header flex items-center justify-between mb-3">
          <button class="back-btn flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-300 ease-out text-text-secondary hover:text-text-primary hover:bg-background-tertiary">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            <span class="text-sm font-medium">Back</span>
          </button>
          <h3 class="text-text-primary text-base font-semibold m-0">Quality</h3>
          <div class="w-16"></div>
        </div>
        
        <div class="quality-options space-y-1">
          ${qualityOptions.map((option, index) => `
            <button class="quality-option group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 ease-out border border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary hover:border-button-primary hover:-translate-y-px" data-index="${index}" data-url="${option.url}" data-quality="${option.name}">
              <span class="font-medium">${formatQualityOption(option.name)}</span>
              <div class="relative">
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 border-button-primary">
                  <div class="w-2 h-2 rounded-full hidden quality-selected bg-accent"></div>
                </div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    setupQualityPageEvents();
  };
  
  const setupQualityPageEvents = () => {
    const backBtn = settingsMenu.querySelector('.back-btn');
    backBtn.addEventListener('click', () => {
      transitionToPage(() => renderMainPage(), 'left');
    });
    
    const qualityOptions = settingsMenu.querySelectorAll('.quality-option');
    qualityOptions.forEach(option => {
      option.addEventListener('click', async () => {
        const url = option.dataset.url;
        const quality = option.dataset.quality;
        const currentTime = player.currentTime;
        
        customPlayer.classList.add('loading');
        
        try {
          let videoUrl = url;
          
          qualityOptions.forEach(opt => {
            opt.querySelector('.quality-selected').classList.add('hidden');
          });
          option.querySelector('.quality-selected').classList.remove('hidden');
          
          currentQuality = quality;
          
          const currentQualityEl = document.getElementById('current-quality');
          if (currentQualityEl) {
            currentQualityEl.textContent = quality;
          }
          
          if (isIframeEmbed) {
            if (fetchVideoUrlCallback) {
              videoUrl = await fetchVideoUrlCallback({ name: quality, url: url });
            }
            
            let iframe = customPlayer.querySelector('iframe');
            if (!iframe) {
              iframe = document.createElement('iframe');
              iframe.className = 'w-full h-full border-none';
              iframe.allowFullscreen = true;
              
              const videoElement = customPlayer.querySelector('video');
              if (videoElement) {
                videoElement.style.display = 'none';
              }
              
              customPlayer.appendChild(iframe);
            }
            
            iframe.src = videoUrl;
            iframe.addEventListener('load', () => {
              customPlayer.classList.remove('loading');
            }, { once: true });
          } else {
            // Regular video source handling
            if (!isNativeEmbed && url.includes('kwik.cx') && fetchVideoUrlCallback) {
              videoUrl = await fetchVideoUrlCallback({ name: quality, url: url });
              if (!videoUrl) {
                console.error('Failed to fetch video URL');
                customPlayer.classList.remove('loading');
                return;
              }
            }
            
            // Update player source
            if (Hls.isSupported() && videoUrl.includes('.m3u8')) {
              if (player.hlsInstance) {
                player.hlsInstance.destroy();
              }
              
              const hls = new Hls();
              hls.loadSource(videoUrl);
              hls.attachMedia(player);
              player.hlsInstance = hls;
            } else {
              player.src = videoUrl;
            }
            
            player.currentTime = currentTime;
            
            const wasPlaying = !player.paused;
            player.addEventListener('loadedmetadata', () => {
              if (wasPlaying) {
                player.play().catch(e => console.error('Error playing video:', e));
              }
              customPlayer.classList.remove('loading');
            }, { once: true });
          }
          
          toggleSettingsMenu();
        } catch (error) {
          console.error('Error changing quality:', error);
          customPlayer.classList.remove('loading');
        }
      });
    });
  };
  
  const renderSpeedPage = (immediate = true) => {
    currentPage = 'speed';
    settingsMenu.innerHTML = `
      <div class="settings-content p-3 min-w-[280px] bg-background-secondary backdrop-blur-xl border border-background-tertiary rounded-xl shadow-2xl transition-all duration-300 ease-out overflow-hidden">
        <div class="settings-header flex items-center justify-between mb-3">
          <button class="back-btn flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-300 ease-out text-text-secondary hover:text-text-primary hover:bg-background-tertiary">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            <span class="text-sm font-medium">Back</span>
          </button>
          <h3 class="text-text-primary text-base font-semibold m-0">Speed</h3>
          <div class="w-16"></div>
        </div>
        
        <div class="speed-options space-y-1">
          ${speedOptions.map(speed => `
            <button class="speed-option group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 ease-out border border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary hover:border-button-primary hover:-translate-y-px" data-speed="${speed}">
              <span class="font-medium">${speed}x</span>
              <div class="relative">
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 border-button-primary">
                  <div class="w-2 h-2 rounded-full ${speed === currentSpeed ? '' : 'hidden'} speed-selected bg-accent"></div>
                </div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    setupSpeedPageEvents();
  };
  
  const setupSpeedPageEvents = () => {
    const backBtn = settingsMenu.querySelector('.back-btn');
    backBtn.addEventListener('click', () => {
      transitionToPage(() => renderMainPage(), 'left');
    });
    
    const speedOptions = settingsMenu.querySelectorAll('.speed-option');
    speedOptions.forEach(option => {
      option.addEventListener('click', () => {
        const speed = parseFloat(option.dataset.speed);
        
        player.playbackRate = speed;
        currentSpeed = speed;
        
        speedOptions.forEach(opt => {
          opt.querySelector('.speed-selected').classList.add('hidden');
        });
        option.querySelector('.speed-selected').classList.remove('hidden');
        
        const currentSpeedEl = document.getElementById('current-speed');
        if (currentSpeedEl) {
          currentSpeedEl.textContent = `${speed}x`;
        }
        
        toggleSettingsMenu();
      });
    });
  };
  
  const renderSubtitlesPage = (immediate = true) => {
    currentPage = 'subtitles';
    settingsMenu.innerHTML = `
      <div class="settings-content p-3 min-w-[280px] bg-background-secondary backdrop-blur-xl border border-background-tertiary rounded-xl shadow-2xl transition-all duration-300 ease-out overflow-hidden">
        <div class="settings-header flex items-center justify-between mb-3">
          <button class="back-btn flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-300 ease-out text-text-secondary hover:text-text-primary hover:bg-background-tertiary">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            <span class="text-sm font-medium">Back</span>
          </button>
          <h3 class="text-text-primary text-base font-semibold m-0">Subtitles</h3>
          <div class="w-16"></div>
        </div>
        
        <div class="subtitle-options space-y-1">
          <button class="subtitle-option group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 ease-out border border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary hover:border-button-primary hover:-translate-y-px" data-index="-1">
            <span class="font-medium">Off</span>
            <div class="relative">
              <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 border-button-primary">
                <div class="w-2 h-2 rounded-full ${currentSubtitleIndex === -1 ? '' : 'hidden'} subtitle-selected bg-accent"></div>
              </div>
            </div>
          </button>
          ${subtitleTracks.map((subtitle, index) => `
            <button class="subtitle-option group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-300 ease-out border border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary hover:border-button-primary hover:-translate-y-px" data-index="${index}" data-url="${subtitle.url}" data-lang="${subtitle.lang}">
              <span class="font-medium">${subtitle.lang}</span>
              <div class="relative">
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 border-button-primary">
                  <div class="w-2 h-2 rounded-full ${index === currentSubtitleIndex ? '' : 'hidden'} subtitle-selected bg-accent"></div>
                </div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    setupSubtitlesPageEvents();
  };
  
  const setupSubtitlesPageEvents = () => {
    const backBtn = settingsMenu.querySelector('.back-btn');
    backBtn.addEventListener('click', () => {
      transitionToPage(() => renderMainPage(), 'left');
    });
    
    const subtitleOptions = settingsMenu.querySelectorAll('.subtitle-option');
    subtitleOptions.forEach(option => {
      option.addEventListener('click', async () => {
        const index = parseInt(option.dataset.index);
        
        // Clear existing text tracks
        while (player.textTracks.length > 0) {
          const track = player.textTracks[0];
          if (track.mode) track.mode = 'disabled';
          const trackElement = player.querySelector('track');
          if (trackElement) {
            player.removeChild(trackElement);
          }
        }
        
        // Update selected indicator
        subtitleOptions.forEach(opt => {
          opt.querySelector('.subtitle-selected').classList.add('hidden');
        });
        option.querySelector('.subtitle-selected').classList.remove('hidden');
        
        if (index === -1) {
          currentSubtitleIndex = -1;
          stopSubtitleDisplay();
        } else {
          currentSubtitleIndex = index;
          const subtitle = subtitleTracks[index];
          await startSubtitleDisplay(subtitle);
        }
        
        const currentSubtitleEl = document.getElementById('current-subtitle');
        if (currentSubtitleEl) {
          currentSubtitleEl.textContent = index === -1 ? 'Off' : subtitleTracks[index]?.lang || 'Off';
        }
        
        toggleSettingsMenu();
      });
    });
  };
  
  settingsBtn.addEventListener('click', toggleSettingsMenu);
  
  settingsMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
      if (!settingsMenu.classList.contains('opacity-0')) {
        settingsMenu.classList.add('opacity-0');
        settingsMenu.classList.add('pointer-events-none');
      }
    }
  });
  
  return {
    loadSubtitles: (tracks) => {
      if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
        return [];
      }
      
      return tracks;
    },
    
    loadQualityOptions: (options) => {
      if (!options || !Array.isArray(options) || options.length === 0) {
        return [];
      }
      
      return options;
    },
    
    setQualityChangeCallback: (callback) => {
      window.playerQualityChangeCallback = callback;
    },
    
    getCurrentSubtitleIndex: () => currentSubtitleIndex,
    getCurrentSpeed: () => currentSpeed,
    
    cleanup: () => {
      stopSubtitleDisplay();
      if (subtitleContainer && subtitleContainer.parentNode) {
        subtitleContainer.parentNode.removeChild(subtitleContainer);
      }
    }
  };
}