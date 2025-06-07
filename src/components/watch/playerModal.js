// Player Modal Component
import { renderSpinner } from '../misc/loading.js';
import { clearAllEpisodeStatus, setEpisodeStatus } from '../watch/tv/episodeList.js'
import { TMDB_API_KEY } from '../../router.js'
  
export function renderPlayerModal(type, id, sources, initialSourceIndex, initialSeason, initialEpisode, mediaTitle, isMobile = false) {
  const filteredSources = sources.filter(source => type === 'movie' ? !source.tvOnly : true);
  
  if (isMobile) {
    return `
      <div id="player-modal" class="fixed inset-0 bg-transparent z-50 hidden flex flex-col items-center justify-between p-0 transition-all duration-300 ease-out">
        <div class="relative w-full h-full flex flex-col">
          <div class="iframe-container loading rounded-none flex-grow flex flex-col-reverse transform scale-50 opacity-0 transition-all duration-300 ease-out" id="iframe-container">
            <!-- iframe goes here -->
            <div class="iframe-loader">
              ${renderSpinner('large')}
            </div>

            <div id="mobile-topbar" class="bg-black p-3 flex items-center gap-6 justify-between">
              <button id="sources-button" class="px-3 py-[0.3rem] rounded-full whitespace-nowrap bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-md hover:scale-[107%] active:scale-90 text-text-primary select-none text-sm" style="font-family: Inter;">Sources</button>
              
              <div class="flex items-center gap-3 text-text-primary">
                ${type === 'tv' ? `<button id="previous-episode-btn" class="text-text-primary cursor-pointer transition duration-[250ms] ease text-sm z-[8] aspect-square bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-sm rounded-full p-[0.3rem] leading-[0] hover:scale-[115%] active:scale-90">←</button>` : ''}
                <div id="current-media-indicator" class="text-text-primary font-medium overflow-hidden line-clamp-1 text-ellipsis">S${initialSeason}E${initialEpisode}</div>
                ${type === 'tv' ? `<button id="next-episode-btn" class="text-text-primary cursor-pointer transition duration-[250ms] ease text-sm z-[8] aspect-square bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-sm rounded-full p-[0.3rem] leading-[0] hover:scale-[115%] active:scale-90">→</button>` : ''}
              </div>
              
              <button id="close-modal" class="text-text-primary text-[1.7rem] z-[8] aspect-square bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-sm rounded-full p-[0.3rem] leading-[0] hover:scale-[115%] active:scale-90"><i class="icon-x text-xl"></i></button>
            </div>
          </div>
        </div>

        <div id="sources-modal" class="fixed inset-x-0 bottom-0 z-[60] hidden transition-all duration-300 ease-out">
          <div class="bg-background-tertiary rounded-t-2xl p-4 w-full transform transition-all duration-300 ease-out opacity-0" id="sources-modal-content">
            <!-- Drag handle -->
            <div class="w-12 h-1 bg-gray-500 rounded-full mx-auto mb-4"></div>
            
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-lg font-medium">Select Source</h3>
              <button id="close-sources-modal" class="text-text-primary text-[1.7rem] z-[8] aspect-square bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-sm rounded-full p-[0.3rem] leading-[0] hover:scale-[115%] active:scale-90"><i class="icon-x"></i></button>
            </div>
            
            <div class="grid grid-cols-2 gap-2 mb-3">
              ${filteredSources
                .map((source, index) => `
                  <button class="source-button px-4 py-2 rounded-lg whitespace-nowrap ${index === initialSourceIndex ? 'bg-accent' : 'bg-[#272c36]'}" data-index="${index}">
                    ${source.name}
                  </button>
                `).join('')}
            </div>
            
            <div class="border-t border-button-primary my-3"></div>
            
            <button id="popup-blocker" class="w-full px-4 py-2 rounded-lg bg-[#272c36] whitespace-nowrap hover:bg-[#313845]">
              <i class="fas fa-shield-alt mr-2"></i>Disable Popups
            </button>
          </div>
        </div>
      </div>
    `;
  } else {
    return `
      <div id="player-modal" class="fixed inset-0 bg-transparent z-50 hidden flex gap-2 items-center justify-center p-4 transition-all duration-300 ease-out">
        <div class="relative w-full max-w-6xl">
          <button id="close-modal" class="absolute -top-2.5 -right-2.5 text-text-primary text-[1.7rem] z-[8] w-10 h-10 flex items-center justify-center bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-sm rounded-full p-[0.3rem] leading-[0] hover:scale-[115%] active:scale-75"><i class="icon-x"></i></button>
          <button id="sources-button" class="absolute -top-2.5 right-9 text-text-primary text-[1.7rem] z-[8] w-10 h-10 flex items-center justify-center bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-sm rounded-full p-[0.3rem] leading-[0] hover:scale-[115%] active:scale-75"><i class="icon-tv text-[1.45rem]"></i></button>
          
          <div class="iframe-container loading rounded-[1.25rem] p-4 pt-2 bg-[#151920] transform scale-50 opacity-0 transition-all duration-300 ease-out flex flex-col-reverse" id="iframe-container">
            <div id="topbar" class="w-full bg-[#151920] pb-2 pt-1 px-0 rounded-t-lg flex items-center justify-center">

              <div class="flex items-center gap-4">
                ${type === 'tv' ? `<button id="previous-episode-btn" class="text-text-primary cursor-pointer hover:scale-[1.2] transition duration-[250ms] ease">←</button>` : ''}
                <div id="current-media-indicator" class="text-text-primary font-medium">S${initialSeason}E${initialEpisode}</div>
                ${type === 'tv' ? `<button id="next-episode-btn" class="text-text-primary cursor-pointer hover:scale-[1.2] transition duration-[250ms] ease">→</button>` : ''}
              </div>

            </div>
            <div class="iframe-loader">
              ${renderSpinner('large')}
            </div>
          </div>
        </div>
        
        <!-- Sources Modal -->
        <div id="sources-modal" class="fixed inset-0 z-[60] hidden flex items-center justify-center transition-opacity duration-300 ease-out">
          <div class="bg-background-tertiary rounded-lg p-4 w-[90%] max-w-md transform transition-all duration-300 ease-out scale-95 opacity-0" id="sources-modal-content">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-lg font-medium">Select Source</h3>
              <button id="close-sources-modal" class="absolute -top-2.5 -right-2.5 text-text-primary text-[1.7rem] z-[8] aspect-square bg-[#ffffff29] hover:bg-[#ffffff40] border border-[#ffffff0f] backdrop-blur-sm rounded-full p-[0.3rem] leading-[0] hover:scale-[115%] active:scale-90"><i class="icon-x"></i></button>
            </div>
            
            <div class="grid grid-cols-2 gap-2 mb-3">
              ${filteredSources
                .map((source, index) => `
                  <button class="source-button px-4 py-2 rounded-lg whitespace-nowrap ${index === initialSourceIndex ? 'bg-accent' : 'bg-[#272c36]'}" data-index="${index}">
                    ${source.name}
                  </button>
                `).join('')}
            </div>
            
            <div class="border-t border-button-primary my-3"></div>
            
            <button id="popup-blocker" class="w-full px-4 py-2 rounded-lg bg-[#272c36] whitespace-nowrap hover:bg-[#313845]">
              <i class="fas fa-shield-alt mr-2"></i>Disable Popups
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

export function initPlayerModal(id, type, sources, initialSourceIndex, initialSeason, initialEpisode, isMobile = false, mediaTitle = '') {
  // play button and modal
  const playButton = document.getElementById('play-button');
  const playerModal = document.getElementById('player-modal');
  const closeModal = document.getElementById('close-modal');
  let mediaPlayer = null;
  let currentTrackerCleanup = null;
  
  // track current episode and season
  let currentSeason = initialSeason;
  let currentEpisode = initialEpisode;
  
  // make currentSeason and currentEpisode globally accessible
  window.currentPlayerSeason = currentSeason;
  window.currentPlayerEpisode = currentEpisode;
  
  const createIframe = (sourceIndex, container = 'iframe-container', className = isMobile ? 'w-full h-full rounded-none bg-[#11151c]' : 'w-full rounded-xl aspect-video bg-[#11151c]') => {
    const iframeContainer = document.getElementById(container);
    if (!iframeContainer) return null;
    
    while (iframeContainer.querySelector(`iframe`)) {
      iframeContainer.querySelector(`iframe`).remove();
    }
    
    // use current values from global state
    const selectedSource = sources[sourceIndex];
    let iframeUrl;
    if (type === 'movie') {
      iframeUrl = selectedSource.movieUrl.replace('{id}', id);
    } else {
      iframeUrl = selectedSource.tvUrl
        .replace('{id}', id)
        .replace('{season}', window.currentPlayerSeason)
        .replace('{episode}', window.currentPlayerEpisode);
      
      // Special handling for animepahe source
      if (selectedSource.name === 'Pahe (Anime)') {
        iframeUrl = iframeUrl
          .replace('{urlepisodeId}', encodeURIComponent(String(id)))
          .replace('{name}', encodeURIComponent(mediaTitle));
      }
    }

    let episodeTitle = '';
    if (type === 'tv') {
      const episodeItem = document.querySelector(`.episode-item[data-season="${window.currentPlayerSeason}"][data-episode="${window.currentPlayerEpisode}"]`);
      if (episodeItem) {
        const titleElement = episodeItem.querySelector('h3');
        if (titleElement) {
          const titleText = titleElement.textContent;
          episodeTitle = titleText.includes('-') ? 
            titleText.split('-')[1].trim() : 
            titleText.replace(/^S\d+\s*E\d+\s*-\s*/, '').trim();
        }
      }
    }

    const currentMediaIndicator = document.getElementById('current-media-indicator');
    const titleofmedia = document.getElementById('titleofmedia');
    if (currentMediaIndicator) {
      if (type === 'tv') {
        currentMediaIndicator.innerText = `S${window.currentPlayerSeason}E${window.currentPlayerEpisode}${episodeTitle ? ' - ' + episodeTitle : ''}`
      } else {
        currentMediaIndicator.innerText = titleofmedia.getAttribute('alt');
      };
    }
    
    const iframe = document.createElement('iframe');
    iframe.id = 'media-player';
    iframe.src = iframeUrl;
    iframe.className = isMobile ? 'w-full h-full rounded-none bg-[#11151c]' : 'w-full rounded-xl aspect-video bg-[#11151c]';
    iframe.allowFullscreen = true;
    
    iframeContainer.insertBefore(iframe, iframeContainer.firstChild);
    iframeContainer.classList.add('loading');
    
    iframe.addEventListener('load', () => {
      iframeContainer.classList.remove('loading');
    });
    
    return iframe;
  };
  
  import('../watch/progress/index.js').then(module => {
    const { initializeSourceTracking, getProgress } = module;
    
    if (playButton && playerModal && closeModal) {
      playButton.addEventListener('click', () => {
        playerModal.classList.remove('bg-background-primary', 'bg-opacity-90');
        playerModal.classList.add('bg-transparent');
        
        playerModal.classList.remove('hidden');
        
        void playerModal.offsetWidth;
        
        playerModal.classList.remove('bg-transparent');
        playerModal.classList.add('bg-background-primary', 'bg-opacity-90');
        
        // update global current values to initial values when play button clicked
        window.currentPlayerSeason = initialSeason;
        window.currentPlayerEpisode = initialEpisode;
        
        window.currentPlayingEpisode = {
          season: initialSeason,
          episode: initialEpisode
        };
        
        setEpisodeStatus(initialSeason, initialEpisode, 'Now Playing');
        
        mediaPlayer = createIframe(initialSourceIndex);
        
        const iframeContainer = document.getElementById('iframe-container');
        if (iframeContainer) {
          void iframeContainer.offsetWidth;
          
          iframeContainer.classList.remove('scale-50', 'opacity-0');
          iframeContainer.classList.add('scale-100', 'opacity-100');
        }
        
        if (mediaPlayer) {
          const currentSource = sources[initialSourceIndex];
          // get existing progress before initializing new tracking
          const existingProgress = getProgress(parseInt(id), type, window.currentPlayerSeason, window.currentPlayerEpisode);
          
          currentTrackerCleanup = initializeSourceTracking(
            mediaPlayer,
            currentSource,
            parseInt(id),
            type,
            window.currentPlayerSeason,
            window.currentPlayerEpisode,
            initialSourceIndex,
            existingProgress
          );
        }
      });
      
      closeModal.addEventListener('click', () => {
        const iframeContainer = document.getElementById('iframe-container');
        if (iframeContainer) {
          iframeContainer.classList.remove('scale-100', 'opacity-100');
          iframeContainer.classList.add('scale-50', 'opacity-0');
        }
        
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
          
          if (currentTrackerCleanup) {
            currentTrackerCleanup();
            currentTrackerCleanup = null;
          }
          
          if (iframeContainer && iframeContainer.querySelector('iframe')) {
            iframeContainer.querySelector('iframe').remove();
            mediaPlayer = null;
          }
        }, 250);
      });
    }
  
    const sourcesButton = document.getElementById('sources-button');
    const sourcesModal = document.getElementById('sources-modal');
    const closeSourcesModal = document.getElementById('close-sources-modal');
    
    if (sourcesButton && sourcesModal && closeSourcesModal) {
      sourcesButton.addEventListener('click', () => {
        const iframeContainer = document.getElementById('iframe-container');
        const modalContent = document.getElementById('sources-modal-content');
        
        sourcesModal.classList.remove('hidden');
        void sourcesModal.offsetWidth;
        
        sourcesModal.classList.add('opacity-100');
        iframeContainer.style.filter = 'brightness(0.3) blur(2px)';
        closeModal.style.filter = 'brightness(0.3) blur(2px)';
        sourcesButton.style.filter = 'brightness(0.3) blur(2px)';
        
        if (modalContent) {
          setTimeout(() => {
            modalContent.classList.remove('scale-95', 'opacity-0');
            modalContent.classList.add('scale-100', 'opacity-100');
          }, 10);
        }
      });
      
      closeSourcesModal.addEventListener('click', () => {
        const iframeContainer = document.getElementById('iframe-container');
        const modalContent = document.getElementById('sources-modal-content');
        
        if (modalContent) {
          modalContent.classList.remove('scale-100', 'opacity-100');
          modalContent.classList.add('scale-95', 'opacity-0');
          iframeContainer.style.filter = '';
          closeModal.style.filter = '';
          sourcesButton.style.filter = '';
        }
        
        setTimeout(() => {
          sourcesModal.classList.add('hidden');
        }, 300);
      });
    }
    
    // source selection
    const sourceButtons = document.querySelectorAll('.source-button');
    sourceButtons.forEach(button => {
      button.addEventListener('click', () => {
        const sourceIndex = parseInt(button.dataset.index);
        if (isNaN(sourceIndex) || sourceIndex < 0 || sourceIndex >= sources.length) return;
        
        initialSourceIndex = sourceIndex;
        const selectedSource = sources[sourceIndex];
        
        // update active button styling
        sourceButtons.forEach(btn => {
          btn.classList.remove('bg-accent');
          btn.classList.add('bg-[#272c36]');
        });
        button.classList.remove('bg-[#272c36]');
        button.classList.add('bg-accent');
        
        if (currentTrackerCleanup) {
          currentTrackerCleanup();
          currentTrackerCleanup = null;
        }
        
        mediaPlayer = createIframe(sourceIndex);
        
        if (mediaPlayer) {
          currentTrackerCleanup = initializeSourceTracking(
            mediaPlayer,
            selectedSource,
            id,
            type,
            window.currentPlayerSeason,
            window.currentPlayerEpisode,
            sourceIndex
          );
      }
        
        // replace the progress data section in the source button click handler
        import('../watch/progress/index.js').then(module => {
          const { saveProgress } = module;
          
          const existingProgress = module.getProgress(parseInt(id), type, 
            parseInt(window.currentPlayerSeason), parseInt(window.currentPlayerEpisode));
          
          saveProgress({
            id: parseInt(id),
            mediaType: type,
            season: parseInt(window.currentPlayerSeason) || 0,
            episode: parseInt(window.currentPlayerEpisode) || 0,
            sourceIndex: sourceIndex,
            fullDuration: existingProgress?.fullDuration || 0,
            watchedDuration: existingProgress?.watchedDuration || 0,
            timestamp: Date.now()
          });
        });
        
        initialSourceIndex = sourceIndex;
        
        const iframeContainer = document.getElementById('iframe-container');
        const closeModalButton = document.getElementById('close-modal');
        if (iframeContainer) iframeContainer.style.filter = '';
        if (closeModalButton) closeModalButton.style.filter = '';
        
        const modalContent = document.getElementById('sources-modal-content');
        if (modalContent) {
          modalContent.classList.remove('scale-100', 'opacity-100');
          modalContent.classList.add('scale-95', 'opacity-0');
        }
        
        setTimeout(() => {
          sourcesModal.classList.add('hidden');
        }, 300);
      });
    });
    
    if (type === 'tv') {
      const previousEpisodeBtn = document.getElementById('previous-episode-btn');
      const nextEpisodeBtn = document.getElementById('next-episode-btn');

      const options = { method: 'GET', headers: { 'accept': 'application/json', 'Authorization': TMDB_API_KEY } };
      
      const fetchSeasonData = async (seasonNumber) => {
        try {
          const response = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}?language=en-US`, options);
          return await response.json();
        } catch (error) { console.error('Error fetching season data:', error); return null; }
      };
      
      const fetchTVShowDetails = async () => {
        try {
          const response = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=en-US`, options);
          return await response.json();
        } catch (error) { console.error('Error fetching TV show details:', error); return null; }
      };
      
      const updatePlayer = (season, episode) => {
        window.currentPlayerSeason = season;
        window.currentPlayerEpisode = episode;
        window.currentPlayingEpisode = { season: season, episode: episode };
        
        setEpisodeStatus(season, episode, 'Now Playing');
        
        if (currentTrackerCleanup) {
          currentTrackerCleanup();
          currentTrackerCleanup = null;
        }
        
        mediaPlayer = createIframe(initialSourceIndex);
        
        if (mediaPlayer) {
          const currentSource = sources[initialSourceIndex];
          const existingProgress = getProgress(parseInt(id), type, season, episode);
          
          currentTrackerCleanup = initializeSourceTracking(mediaPlayer, currentSource, parseInt(id), type, season, episode, initialSourceIndex, existingProgress);
        }
        
        updateNavigationButtonsState(season, episode);
      };
      
      const updateNavigationButtons = async () => {
        const tvDetails = await fetchTVShowDetails();
        if (!tvDetails) return;
        
        const totalSeasons = tvDetails.number_of_seasons;
        updateNavigationButtonsState(window.currentPlayerSeason, window.currentPlayerEpisode, totalSeasons);
      };
      
      const updateNavigationButtonsState = async (currentSeason, currentEpisode, cachedTotalSeasons = null) => {
        if (!previousEpisodeBtn || !nextEpisodeBtn) return;
        
        let totalSeasons = cachedTotalSeasons;
        if (!totalSeasons) {
          const tvDetails = await fetchTVShowDetails();
          if (!tvDetails) return;
          totalSeasons = tvDetails.number_of_seasons;
        }
        
        const seasonData = await fetchSeasonData(currentSeason);
        if (!seasonData || !seasonData.episodes) return;
        
        const totalEpisodes = seasonData.episodes.length;
        
        if (currentEpisode <= 1 && currentSeason <= 1) {
          previousEpisodeBtn.classList.add('opacity-30', 'cursor-not-allowed');
          previousEpisodeBtn.classList.remove('cursor-pointer', 'hover:scale-[1.2]');
        } else {
          previousEpisodeBtn.classList.remove('opacity-30', 'cursor-not-allowed');
          previousEpisodeBtn.classList.add('cursor-pointer', 'hover:scale-[1.2]');
        }
        
        if (currentEpisode >= totalEpisodes && currentSeason >= totalSeasons) {
          nextEpisodeBtn.classList.add('opacity-30', 'cursor-not-allowed');
          nextEpisodeBtn.classList.remove('cursor-pointer', 'hover:scale-[1.2]');
        } else {
          nextEpisodeBtn.classList.remove('opacity-30', 'cursor-not-allowed');
          nextEpisodeBtn.classList.add('cursor-pointer', 'hover:scale-[1.2]');
        }
      };
      
      playButton.addEventListener('click', () => {
        if (type === 'tv') { updateNavigationButtons(); }
      });
      
      if (previousEpisodeBtn) {
        previousEpisodeBtn.addEventListener('click', async () => {
          let newSeason = parseInt(window.currentPlayerSeason);
          let newEpisode = parseInt(window.currentPlayerEpisode) - 1;
          
          if (newEpisode < 1) {
            newSeason -= 1;
            if (newSeason < 1) { return; }
            
            const seasonData = await fetchSeasonData(newSeason);
            if (!seasonData || !seasonData.episodes) return;
            
            newEpisode = seasonData.episodes.length;
          }
          
          updatePlayer(newSeason, newEpisode);
        });
      }
      
      if (nextEpisodeBtn) {
        nextEpisodeBtn.addEventListener('click', async () => {
          let newSeason = parseInt(window.currentPlayerSeason);
          let newEpisode = parseInt(window.currentPlayerEpisode) + 1;
          
          const seasonData = await fetchSeasonData(newSeason);
          if (!seasonData || !seasonData.episodes) return;
          
          if (newEpisode > seasonData.episodes.length) {
            newSeason += 1;
            
            const tvDetails = await fetchTVShowDetails();
            if (!tvDetails || newSeason > tvDetails.number_of_seasons) { return; }
            
            newEpisode = 1;
          }
          
          updatePlayer(newSeason, newEpisode);
        });
      }
    }
  });

  const popupBlocker = document.getElementById('popup-blocker');
  let popupBlockerEnabled = false;
  
  if (popupBlocker) {
    popupBlocker.addEventListener('click', () => {
      popupBlockerEnabled = !popupBlockerEnabled;
      
      const mediaPlayer = document.getElementById('media-player');
      const iframeContainer = document.getElementById('iframe-container');
      
      if (!mediaPlayer || !iframeContainer) return;
      
      if (popupBlockerEnabled) {
        mediaPlayer.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
        popupBlocker.classList.remove('bg-[#272c36]', 'hover:bg-[#313845]');
        popupBlocker.classList.add('bg-accent');
        popupBlocker.innerHTML = '<i class="fas fa-shield-alt mr-2"></i>Popups Disabled';
      } else {
        mediaPlayer.removeAttribute('sandbox');
        popupBlocker.classList.remove('bg-accent');
        popupBlocker.classList.add('bg-[#272c36]', 'hover:bg-[#313845]');
        popupBlocker.innerHTML = '<i class="fas fa-shield-alt mr-2"></i>Disable Popups';
      }
      
      const currentSrc = mediaPlayer.src;
      mediaPlayer.src = currentSrc;
      iframeContainer.classList.add('loading');
    });
  }
}