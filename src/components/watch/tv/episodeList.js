// Episode List Component
import { TMDB_IMAGE_BASE_URL } from '../../../router.js';
import { getProgress } from '../../watch/progress/index.js';
import { renderPlayerModal, initPlayerModal } from '../../watch/playerModal.js';

function getEpisodeProgress(id, season, episode) {
  const savedItem = getProgress(parseInt(id), 'tv', parseInt(season), parseInt(episode));
  
  if (savedItem) {
    // calculate progress
    const progress = savedItem.fullDuration > 0 ? 
      savedItem.watchedDuration / savedItem.fullDuration : 0;
    
    return {
      progress: progress,
      duration: savedItem.fullDuration || 0,
      fullDuration: savedItem.fullDuration || 0,
      watchedDuration: savedItem.watchedDuration || 0,
      remaining: savedItem.fullDuration ? 
        Math.round((savedItem.fullDuration - savedItem.watchedDuration) / 60) : 0
    };
  }
  
  return null;
}

export function renderEpisodeList(episodes, contentRating, isMobile = false) {
  const urlPath = window.location.pathname;
  const idMatch = urlPath.match(/\/tv\/(\d+)/);
  const showId = idMatch ? idMatch[1] : '';
  
  if (isMobile) {
    return `
      <div class="flex flex-col" id="episodes-list">
        ${episodes.map(episode => `
        <div class="flex flex-row gap-3 p-3 px-5 transition duration-200 ease hover:bg-[#191E25] rounded-lg cursor-pointer episode-item" data-episode="${episode.episode_number}" data-season="${episode.season_number}">
          <div class="relative">
            <div class="bg-zinc-600 w-[8rem] aspect-video rounded-md overflow-hidden relative episode-thumbnail">
              <img class="object-cover w-full h-full" src="${episode.still_path ? `${TMDB_IMAGE_BASE_URL}original${episode.still_path}` : 'https://placehold.co/600x400/0e1117/fff/?text=No%20thumbnail%20found&font=poppins'}">
              <div class="absolute inset-0 flex items-end justify-start">
                <div class="w-10 h-10 rounded-full flex items-center justify-center">
                  <i class="fas fa-play text-text-primary text-lg" style="filter: drop-shadow(2px 2px 8px black);"></i>
                </div>
              </div>
              <div class="episode-status-overlay absolute inset-0 bg-black bg-opacity-70 hidden items-center justify-center">
                <span class="text-text-primary font-medium text-sm"></span>
              </div>
              ${(() => {
                const progress = getEpisodeProgress(showId, episode.season_number, episode.episode_number);
                if (progress) {
                  return `
                  <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent h-12"></div>
                  <div class="absolute inset-x-0 bottom-0 h-1 bg-gray-800">
                    <div class="h-full bg-accent" style="width: ${progress.progress * 100}%"></div>
                  </div>
                  `;
                }
                return '';
              })()}
            </div>
          </div>
          <div class="flex flex-col justify-center flex-1">
            <div class="flex justify-between items-start">
              <h3 class="text-base font-medium text-text-primary leading-tight w-[90%]">S${episode.season_number} E${episode.episode_number} - ${episode.name}</h3>
            </div>
            <div class="flex flex-row gap-2 text-sm text-zinc-400 font-light">
              <span>${episode.runtime || 0}m</span>
              <span>${new Date(episode.air_date).getFullYear()}</span>
              <span>${contentRating}</span>
            </div>
          </div>
        </div>
        <p class="text-[0.95] mx-2 mb-2 leading-tight text-[#ADACAC] font-light px-3 -mt-1 overflow-hidden line-clamp-2 text-ellipsis">${episode.overview || 'No overview available'}</p>
        `).join('')}
      </div>
    `;
  } else {
    return `
      <div class="flex flex-col gap-0" id="episodes-list">
        ${episodes.map(episode => `
        <div class="flex flex-row gap-6 -mx-4 p-4 transition duration-200 ease hover:bg-[#191E25] rounded-xl cursor-pointer episode-item" data-episode="${episode.episode_number}" data-season="${episode.season_number}">
          <div class="relative">
            <div class="bg-zinc-600 h-44 aspect-video rounded-lg overflow-hidden relative episode-thumbnail">
              <img class="object-cover w-full h-full" src="${episode.still_path ? `${TMDB_IMAGE_BASE_URL}original${episode.still_path}` : 'https://placehold.co/600x400/0e1117/fff/?text=No%20thumbnail%20found&font=poppins'}">
              <div class="episode-status-overlay absolute inset-0 bg-black bg-opacity-60 hidden items-center justify-center">
                <span class="text-text-primary font-medium text-lg"></span>
              </div>
              ${(() => {
                const progress = getEpisodeProgress(showId, episode.season_number, episode.episode_number);
                if (progress) {
                  return `
                  <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent h-16"></div>
                  <div class="absolute inset-x-0 bottom-0 h-1.5 bg-gray-800">
                    <div class="h-full bg-accent" style="width: ${progress.progress * 100}%"></div>
                  </div>
                  `;
                }
                return '';
              })()}
            </div>
          </div>
          <div class="flex flex-col justify-start">
            <h3 class="text-xl font-medium mb-2">S${episode.season_number} E${episode.episode_number} - ${episode.name}</h3>
            <div class="flex flex-row gap-3 mb-3 font-medium text-lg opacity-[95%]">
              <span>${new Date(episode.air_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span>${episode.runtime || 0} min</span>
              <span class="px-2 bg-button-primary rounded-[0.275rem]">${contentRating}</span>
            </div>

            <p class="text-[#aaa] text-xl font-light max-w-3xl mb-3 overflow-hidden line-clamp-2 text-ellipsis">${episode.overview || 'No overview available'}</p>

            <span class="text-base font-normal"><i class="fas fa-circle-check mr-1.5 text-accent"></i> Available on QuickWatch</span>
          </div>
        </div>
      `).join('')}
      </div>
    `;
  }
}

export function clearAllEpisodeStatus() {
  document.querySelectorAll('.episode-status-overlay').forEach(overlay => {
    overlay.classList.remove('flex');
    overlay.classList.add('hidden');
    overlay.querySelector('span').textContent = '';
  });
}

export function setEpisodeStatus(season, episode, status) {
  clearAllEpisodeStatus();
  
  const episodeItem = document.querySelector(`.episode-item[data-season="${season}"][data-episode="${episode}"]`);
  if (episodeItem) {
    const overlay = episodeItem.querySelector('.episode-status-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
      overlay.querySelector('span').textContent = status;
    }
  }
}

export function initEpisodeList(id, initialSeason, initialEpisode, sources, initialSourceIndex, mediaTitle = '', isMobile = false) {
  const episodesList = document.getElementById('episodes-list');

  updateProgressIndicators(id, initialSeason);
  
  const progressUpdateInterval = setInterval(() => {
    updateProgressIndicators(id, initialSeason);
  }, 2000);
  
  // Store the interval ID for cleanup
  window.progressUpdateInterval = progressUpdateInterval;
  
  if (!episodesList) return;
  
  let currentSeason = initialSeason;
  let currentEpisode = initialEpisode;
  
  if (!document.getElementById('player-modal')) {
    const playerModalHTML = renderPlayerModal('tv', id, sources, initialSourceIndex, currentSeason, currentEpisode, mediaTitle, isMobile);
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = playerModalHTML;
    document.body.appendChild(modalContainer.firstElementChild);
    
    initPlayerModal(id, 'tv', sources, initialSourceIndex, currentSeason, currentEpisode, isMobile, mediaTitle);
  }
  
  window.currentPlayingEpisode = null;
  
  episodesList.querySelectorAll('.episode-item').forEach(episodeItem => {
    episodeItem.addEventListener('click', () => {
      const episodeNumber = parseInt(episodeItem.dataset.episode);
      const seasonNumber = parseInt(episodeItem.dataset.season);
      
      if (isNaN(episodeNumber)) return;
      
      currentEpisode = episodeNumber;
      
      window.currentPlayerSeason = currentSeason;
      window.currentPlayerEpisode = currentEpisode;
      
      window.currentPlayingEpisode = {
        season: seasonNumber,
        episode: episodeNumber
      };
      
      setEpisodeStatus(seasonNumber, episodeNumber, 'Now Playing');
      
      const playerModal = document.getElementById('player-modal');
      if (playerModal) {
        playerModal.classList.remove('bg-background-primary', 'bg-opacity-90');
        playerModal.classList.add('bg-transparent');
        
        playerModal.classList.remove('hidden');
        
        void playerModal.offsetWidth;
        
        playerModal.classList.remove('bg-transparent');
        playerModal.classList.add('bg-background-primary', 'bg-opacity-90');
        
        const iframeContainer = document.getElementById('iframe-container');
        if (iframeContainer) {
          while (iframeContainer.querySelector('iframe')) {
            iframeContainer.querySelector('iframe').remove();
          }
          
          const selectedSource = sources[initialSourceIndex];
          const iframeUrl = selectedSource.tvUrl
            .replace('{id}', id)
            .replace('{season}', currentSeason)
            .replace('{episode}', currentEpisode);

          let episodeTitle = '';
          const titleElement = episodeItem.querySelector('h3');
          if (titleElement) {
            const titleText = titleElement.textContent;
            episodeTitle = titleText.includes('-') ? 
              titleText.split('-')[1].trim() : 
              titleText.replace(/^S\d+\s*E\d+\s*-\s*/, '').trim();
          }

          document.getElementById('current-media-indicator').innerText = 
            `S${currentSeason}E${currentEpisode}${episodeTitle ? ' - ' + episodeTitle : ''}`;
          
          const iframe = document.createElement('iframe');
          iframe.id = 'media-player';
          iframe.src = iframeUrl;
          iframe.className = isMobile ? 'w-full h-full rounded-none bg-[#272C36]' : 'w-full rounded-xl aspect-video bg-[#272C36]';
          iframe.allowFullscreen = true;
          
          iframeContainer.insertBefore(iframe, iframeContainer.firstChild);
          iframeContainer.classList.add('loading');
          
          iframe.addEventListener('load', () => {
            iframeContainer.classList.remove('loading');
          });
          
          void iframeContainer.offsetWidth;
          iframeContainer.classList.remove('scale-50', 'opacity-0');
          iframeContainer.classList.add('scale-100', 'opacity-100');
          
          import('../../watch/progress/index.js').then(module => {
            const { initializeSourceTracking, getProgress } = module;
            
            const existingProgress = getProgress(parseInt(id), 'tv', currentSeason, currentEpisode);
            const currentTrackerCleanup = initializeSourceTracking(iframe, selectedSource, parseInt(id), 'tv', currentSeason, currentEpisode, initialSourceIndex, existingProgress );
            
            window.currentTrackerCleanup = currentTrackerCleanup;
          });
        }
      }
    });
  });
  
  const closeModal = document.getElementById('close-modal');
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      const iframeContainer = document.getElementById('iframe-container');
      if (iframeContainer) {
        iframeContainer.classList.remove('scale-100', 'opacity-100');
        iframeContainer.classList.add('scale-50', 'opacity-0');
      }
      
      const playerModal = document.getElementById('player-modal');
      if (playerModal) {
        playerModal.classList.remove('bg-background-primary', 'bg-opacity-90');
        
        if (window.currentPlayingEpisode) {
          setEpisodeStatus(
            window.currentPlayingEpisode.season, 
            window.currentPlayingEpisode.episode, 
            'Just Watched'
          );
        }
        
        setTimeout(() => {
          playerModal.classList.add('hidden');
          
          if (window.currentTrackerCleanup) {
            window.currentTrackerCleanup();
            window.currentTrackerCleanup = null;
          }
          
          updateProgressIndicators(id, initialSeason);
          
          if (iframeContainer && iframeContainer.querySelector('iframe')) {
            iframeContainer.querySelector('iframe').remove();
          }
        }, 250);
      }
    });
  }
  
  const sourceButtons = document.querySelectorAll('.source-button');
  sourceButtons.forEach(button => {
    button.addEventListener('click', () => {
      const sourceIndex = parseInt(button.dataset.index);
      if (isNaN(sourceIndex) || sourceIndex < 0 || sourceIndex >= sources.length) return;
      
      initialSourceIndex = sourceIndex;
      
      sourceButtons.forEach(btn => {
        btn.classList.remove('bg-accent');
        btn.classList.add('bg-[#272c36]');
      });
      button.classList.remove('bg-[#272c36]');
      button.classList.add('bg-accent');
      
      if (window.currentTrackerCleanup) {
        window.currentTrackerCleanup();
        window.currentTrackerCleanup = null;
      }
      
      const iframeContainer = document.getElementById('iframe-container');
      if (iframeContainer) {
        while (iframeContainer.querySelector('iframe')) {
          iframeContainer.querySelector('iframe').remove();
        }
        
        const selectedSource = sources[sourceIndex];
        const iframeUrl = selectedSource.tvUrl
          .replace('{id}', id)
          .replace('{season}', currentSeason)
          .replace('{episode}', currentEpisode);

        let episodeTitle = '';
        const episodeItem = document.querySelector(`.episode-item[data-season="${currentSeason}"][data-episode="${currentEpisode}"]`);
        if (episodeItem) {
          const titleElement = episodeItem.querySelector('h3');
          if (titleElement) {
            const titleText = titleElement.textContent;
            episodeTitle = titleText.includes('-') ? 
              titleText.split('-')[1].trim() : 
              titleText.replace(/^S\d+\s*E\d+\s*-\s*/, '').trim();
          }
        }

        document.getElementById('current-media-indicator').innerText = 
          `S${currentSeason}E${currentEpisode}${episodeTitle ? ' - ' + episodeTitle : ''}`;
        
        const iframe = document.createElement('iframe');
        iframe.id = 'media-player';
        iframe.src = iframeUrl;
        iframe.className = isMobile ? 'w-full h-full rounded-none bg-[#272C36]' : 'w-full rounded-xl aspect-video bg-[#272C36]';
        iframe.allowFullscreen = true;
        
        iframeContainer.insertBefore(iframe, iframeContainer.firstChild);
        iframeContainer.classList.add('loading');
        
        iframe.addEventListener('load', () => {
          iframeContainer.classList.remove('loading');
        });
        
        import('../../watch/progress/index.js').then(module => {
          const { initializeSourceTracking, getProgress, saveProgress } = module;
          
          const existingProgress = getProgress(parseInt(id), 'tv', currentSeason, currentEpisode);
          
          window.currentTrackerCleanup = initializeSourceTracking(iframe, selectedSource, parseInt(id), 'tv', currentSeason, currentEpisode, sourceIndex, existingProgress);
          saveProgress({ id: parseInt(id), mediaType: 'tv', season: parseInt(currentSeason) || 0, episode: parseInt(currentEpisode) || 0, sourceIndex: sourceIndex, fullDuration: existingProgress?.fullDuration || 0, watchedDuration: existingProgress?.watchedDuration || 0, timestamp: Date.now() });
        });
      }
      
      const sourcesModal = document.getElementById('sources-modal');
      if (sourcesModal) {
        const modalContent = document.getElementById('sources-modal-content');
        if (modalContent) {
          modalContent.classList.remove('scale-100', 'opacity-100');
          modalContent.classList.add('scale-95', 'opacity-0');
        }
        
        const closeModalButton = document.getElementById('close-modal');
        if (iframeContainer) iframeContainer.style.filter = '';
        if (closeModalButton) closeModalButton.style.filter = '';
        
        setTimeout(() => {
          sourcesModal.classList.add('hidden');
        }, 300);
      }
    });
  });
}

export function cleanupEpisodeList() {
  if (window.progressUpdateInterval) {
    clearInterval(window.progressUpdateInterval);
    window.progressUpdateInterval = null;
  }
}

function updateProgressIndicators(id, season) {
  const episodeItems = document.querySelectorAll('.episode-item');
  
  episodeItems.forEach(item => {
    const episodeNumber = parseInt(item.dataset.episode);
    const progress = getEpisodeProgress(id, season, episodeNumber);
        
    let progressBar = item.querySelector('.progress-bar');
    let progressOverlay = item.querySelector('.progress-overlay');
    let remainingTime = item.querySelector('.remaining-time');
    
    if (progressBar) progressBar.remove();
    if (progressOverlay) progressOverlay.remove();
    if (remainingTime) remainingTime.remove();
    
    if (progress) {
      const thumbnailContainer = item.querySelector('.bg-zinc-600');
      if (thumbnailContainer) {
        progressOverlay = document.createElement('div');
        progressOverlay.className = 'progress-overlay absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent';
        progressOverlay.style.height = '16px';
        thumbnailContainer.appendChild(progressOverlay);
        
        progressBar = document.createElement('div');
        progressBar.className = 'progress-bar absolute inset-x-0 bottom-0 h-1.5 bg-gray-800';
        
        const progressValue = typeof progress.progress === 'number' ? 
          Math.min(Math.max(progress.progress, 0), 1) : 0;
        
        progressBar.innerHTML = `<div class="h-full bg-accent" style="width: ${progressValue * 100}%"></div>`;
        thumbnailContainer.appendChild(progressBar);
        
        remainingTime = document.createElement('div');
        remainingTime.className = 'remaining-time absolute bottom-2 right-3 text-sm text-text-primary font-medium';
        remainingTime.textContent = `${progress.remaining || 0}m left`;
        thumbnailContainer.appendChild(remainingTime);
      }
    }
  });
}