// Details Page
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '../../router.js';
import { renderHeader } from '../../components/header.js';
import { renderSpinner, renderFullPageSpinner } from '../../components/misc/loading.js';
import { renderError } from '../../components/misc/error.js';
import { initTabSwitcher } from '../../components/watch/tabs/tabSwitcher.js';
import { loadRelatedContent, loadDetailsContent, isMobileDevice } from '../../components/watch/tabs/tabContent.js';
import { renderPlayerModal, initPlayerModal } from '../../components/watch/playerModal.js';
import { initTrailerButton } from '../../components/watch/trailerModal.js';
import { renderEpisodeList, initEpisodeList } from '../../components/watch/tv/episodeList.js';
import { renderSeasonSelector, initSeasonSelector } from '../../components/watch/tv/seasonSelector.js';
import { getProgress } from '../../components/watch/progress/index.js';
import { initShareModal } from '../../components/watch/shareModal.js';
import { sources } from './sources.js'
import { showToast } from '../../components/toast.js';

export function renderDetailsPage(container, params) {
  if (window.splashScreen) {
    window.splashScreen.show();
  }
  
  container.innerHTML = `
    ${renderHeader()}
    <div id="details-container">
      ${renderFullPageSpinner()}
    </div>
  `;
  
  loadMediaDetails(params.type, params.id);
}

async function loadMediaDetails(type, id) {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const autoPlay = urlParams.get('w') === 'true';
    
    const mediaDetailsStep = window.splashScreen?.addStep('Loading media details...');
    
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Authorization': TMDB_API_KEY
      }
    };
    
    const response = await fetch(`${TMDB_BASE_URL}/${type}/${id}?language=en-US&append_to_response=images&include_image_language=en`, options);
    const data = await response.json();
    
    const mediaTitle = data.title || data.name;
    document.title = `QW | ${mediaTitle}`;
    
    const currentPath = window.location.pathname;
    const titleSlug = mediaTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    if (!currentPath.includes('-')) {
      const newPath = `/${type}/${id}-${titleSlug}`;
      history.replaceState(null, null, newPath);
    }
    
    // Fetch content ratings
    let contentRating = type === 'movie' ? 'MOVIE' : 'TV';
    if (type === 'tv') {
      try {
        const ratingsResponse = await fetch(`${TMDB_BASE_URL}/tv/${id}/content_ratings`, options);
        const ratingsData = await ratingsResponse.json();
        
        const usRating = ratingsData.results?.find(rating => rating.iso_3166_1 === 'US');
        if (usRating && usRating.rating) { contentRating = usRating.rating; }
      } catch (error) {
        console.error('Error fetching content ratings:', error);
      }
    }
    
    window.splashScreen?.completeStep(mediaDetailsStep);
    
    const seasonStep = window.splashScreen?.addStep('Fetching season data...');
    
    let seasonData = null;
    if (type === 'tv') {
      const seasonResponse = await fetch(`${TMDB_BASE_URL}/tv/${id}/season/1?language=en-US`, options);
      seasonData = await seasonResponse.json();
    }
    
    let initialSeason = 1;
    let initialEpisode = 1;
    
    if (type === 'tv') {
      const continueWatching = JSON.parse(localStorage.getItem('quickwatch-continue') || '[]');
      
      const showItems = continueWatching
        .filter(item => item.id === parseInt(id) && item.mediaType === type)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      
      if (showItems.length > 0) {
        const mostRecentItem = showItems[0];
        initialSeason = parseInt(mostRecentItem.season);
        initialEpisode = parseInt(mostRecentItem.episode);
        
        if (initialSeason !== 1) {
          const seasonResponse = await fetch(`${TMDB_BASE_URL}/tv/${id}/season/${initialSeason}?language=en-US`, options);
          seasonData = await seasonResponse.json();
        }
      }
    }
    
    window.splashScreen?.completeStep(seasonStep);
    
    const renderStep = window.splashScreen?.addStep('Rendering page...');

    const detailsContainer = document.getElementById('details-container');
    if (!detailsContainer) return;

    let initialSourceIndex = 0;
    if (type === 'tv') {
      const continueWatching = JSON.parse(localStorage.getItem('quickwatch-continue') || '[]');
      
      const showItems = continueWatching
        .filter(item => item.id === parseInt(id) && item.mediaType === type)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      
      if (showItems.length > 0 && showItems[0].sourceIndex !== undefined) {
        initialSourceIndex = parseInt(showItems[0].sourceIndex);
      }
    }
    
    const defaultSource = sources[initialSourceIndex];
    let iframeUrl;
    if (type === 'movie') {
      iframeUrl = defaultSource.movieUrl
        .replace('{id}', String(id));
    } else {
      iframeUrl = defaultSource.tvUrl
        .replace('{id}', String(id))
        .replace('{season}', String(initialSeason))
        .replace('{episode}', String(initialEpisode));
      
      // Special handling for animepahe source
      if (defaultSource.name === 'Pahe (Anime)') {
        const mediaName = data.title || data.name;
        iframeUrl = iframeUrl
          .replace('{urlepisodeId}', encodeURIComponent(String(id)))
          .replace('{name}', encodeURIComponent(mediaName));
      }
    }
    
    // genres
    const genresText = data.genres?.slice(0, 3).map(genre => genre.name).join(' • ') || '';
    
    // release year
    const year = new Date(data.release_date || data.first_air_date).getFullYear() || 'N/A';
    
    // (white) network logo
    const networkLogo = data.networks && data.networks.length > 0 ? 
      `<img src="${TMDB_IMAGE_BASE_URL}w500${data.networks[0].logo_path}" class="max-w-[6rem] mb-4" style="filter: invert(50%) brightness(10000%);">` : '';
    
    // title logo with title fallback
    const titleDisplay = data.images?.logos && data.images.logos.length > 0 ?
      `<img src="${TMDB_IMAGE_BASE_URL}w500${data.images.logos[0].file_path}" id="titleofmedia" alt="${data.title || data.name}" class="max-w-[26rem] max-h-[15rem] mb-8">` :
      `<h1 id="titleofmedia" class="text-4xl font-bold mb-8" alt="${data.title || data.name}">${data.title || data.name}</h1>`;

      function formatRemainingTime(duration, watched) {
        const remainingMinutes = Math.round((duration - watched) / 60);
        if (remainingMinutes <= 0) return "Completed";
        
        if (remainingMinutes >= 60) {
          const hours = Math.floor(remainingMinutes / 60);
          const minutes = remainingMinutes % 60;
          return `${hours}h${minutes}m left`;
        }
        return `${remainingMinutes}min left`;
      }
    
    detailsContainer.innerHTML = `
      <section class="w-full relative" style="height: calc(100vh - 4rem);">
        <img class="object-cover w-full h-full object-right-top" src="${TMDB_IMAGE_BASE_URL}original${data.backdrop_path}">
        
        <div class="absolute inset-0 bg-gradient-to-t from-background-primary via-transparent to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-background-primary via-background-primary/50 to-transparent w-full">
          <div class="absolute bottom-0 left-0 pl-16 pb-16 w-full">
            
            ${networkLogo}
            ${titleDisplay}
            
            ${type === 'tv' ? `
            ${renderSeasonSelector(data, initialSeason)}
            ` : ''}
            
            <p class="text-lg mb-3 max-w-3xl">
              ${data.overview || 'No overview available'}
            </p>
            
            <div class="flex items-center gap-4 mb-3 text-[0.95rem] text-zinc-400 font-bold">
              <span>TMDB ${data.vote_average?.toFixed(1) || 'N/A'}</span>
              <span>${year}</span>
              ${type === 'tv' ? `<span>${data.number_of_episodes || 0} episodes</span>` : ''}
              <button class="bg-button-primary px-2.5 py-0 rounded-[0.275rem] text-text-primary">
                ${contentRating}
              </button>
              ${type === 'tv' ? `
              <button class="bg-button-primary px-2.5 py-0 rounded-[0.275rem] text-text-primary">
                ${data.status || 'Returning series'}
              </button>
              ` : ''}
            </div>
            
            <div class="flex items-center text-[0.95rem] gap-2 mb-12">
              ${genresText}
            </div>
            
            <div class="flex items-center gap-4 mb-6">
              
              <button class="px-6 py-3 rounded-lg bg-button-primary text-lg md:text-xl pagebtn font-medium flex flex-row items-center justify-center gap-4" id="play-button">
                <i class="fas fa-play text-[1.65rem]"></i>
                <div class="flex flex-col items-start justify-center text-lg leading-tight">
                  ${(() => {
                    if (type === 'tv') {
                      const progress = getProgress(id, 'tv', initialSeason, initialEpisode);
                      const remainingMinutes = progress ? Math.round((progress.fullDuration - progress.watchedDuration) / 60) : 0;
                      
                      if (progress && remainingMinutes <= 5) {
                        // Check if there are more episodes in current season
                        const nextEpisode = initialEpisode + 1;
                        if (nextEpisode <= seasonData.episodes.length) {
                          return `
                            <span class="mr-2 font-bold">Watch Episode ${nextEpisode}</span>
                            <span class="mr-2 text-base font-regular text-text-secondary">Next episode</span>
                            <span class="hidden" id="next-episode-data" 
                              data-season="${initialSeason}" 
                              data-episode="${nextEpisode}">
                            </span>
                          `;
                        } else {
                          // Check if there are more seasons
                          const nextSeason = initialSeason + 1;
                          if (nextSeason <= data.number_of_seasons) {
                            return `
                              <span class="mr-2 font-bold">Watch Season ${nextSeason}</span>
                              <span class="mr-2 text-base font-regular text-text-secondary">Next season</span>
                              <span class="hidden" id="next-episode-data" 
                                data-season="${nextSeason}" 
                                data-episode="1">
                              </span>
                            `;
                          } else {
                            // No more seasons: rewatch
                            return `
                              <span class="mr-2 font-bold">Rewatch Episode 1</span>
                              <span class="mr-2 text-base font-regular text-text-secondary">Start over</span>
                              <span class="hidden" id="next-episode-data" 
                                data-season="1" 
                                data-episode="1">
                              </span>
                            `;
                          }
                        }
                      }
                      
                      return `
                        <span class="mr-2 font-bold">Continue Episode ${initialEpisode}</span>
                        <span class="mr-2 text-base font-regular text-text-secondary">${progress && progress.watchedDuration > 0 ? 
                          `${remainingMinutes}min left` : 
                          'Start watching'}</span>
                      `;
                    } else {
                      const progress = getProgress(id, 'movie');
                      return progress && progress.watchedDuration > 0 ? 
                        `<span class="mr-2 font-bold">Continue Watching</span>
                        <span class="mr-2 text-base font-regular text-text-secondary">${formatRemainingTime(progress.fullDuration, progress.watchedDuration)}</span>` :
                        `<span class="mr-2">Play movie</span>
                        <span class="mr-2 text-base font-regular text-text-secondary">${
                          data.runtime 
                            ? data.runtime >= 60
                              ? `${Math.floor(data.runtime/60)}h${data.runtime % 60}m left`
                              : `${data.runtime}min left`
                            : 'N/A'
                        }</span>`;
                    }
                  })()}
                </div>
              </button>
              
              <button id="trailer-button" class="pagebtn bg-button-primary w-[4.3125rem] aspect-square rounded-full"><i class="icon-film text-3xl"></i></button>
              <button class="pagebtn bg-button-primary w-[4.3125rem] aspect-square rounded-full add-to-watchlist"><i class="icon-plus text-4xl"></i></button>
              <a href="/dl/${type}/${id}" class="pagebtn bg-button-primary w-[4.3125rem] aspect-square rounded-full flex items-center justify-center"><i class="icon-download text-3xl"></i></a>
              <button id="share-button" class="pagebtn bg-button-primary w-[4.3125rem] aspect-square rounded-full"><i class="icon-share text-3xl"></i></button>
            </div>
          </div>
        </div>
      </section>
      
      <section class="w-full mb-16 relative">
        <div class="flex flex-row gap-8 px-16 text-xl text-bold">
          ${type === 'tv' ? `<span class="tab-item active border-b-2 border-text-primary pb-2 cursor-pointer" data-tab="episodes">Episodes</span>` : ''}
          <span class="tab-item ${type === 'movie' ? 'active border-b-2 border-text-primary pb-2' : 'text-zinc-400'} cursor-pointer" data-tab="related">Related</span>
          <span class="tab-item text-zinc-400 cursor-pointer" data-tab="details">Details</span>
        </div>
        <div class="px-16 mt-8">
          ${type === 'tv' ? `
          <div id="episodes-tab" class="tab-content active">
            ${renderEpisodeList(seasonData.episodes, contentRating)}
          </div>
          ` : ''}
          
          <div id="related-tab" class="tab-content ${type === 'movie' ? 'active' : 'hidden'} min-h-screen">
            <div class="related-content-container"></div>
          </div>
          <div id="details-tab" class="tab-content hidden min-h-screen">
            <div class="details-content-container"></div>
          </div>
        </div>
      </section>
      
      ${renderPlayerModal(type, id, sources, initialSourceIndex, initialSeason, initialEpisode, mediaTitle)}
    `;

    initPlayerModal(id, type, sources, initialSourceIndex, initialSeason, initialEpisode, false, mediaTitle);
  
    if (type === 'tv') {
      const playButton = document.getElementById('play-button');
      const nextEpisodeData = document.getElementById('next-episode-data');
      
      if (playButton && nextEpisodeData) {
        const originalClickHandler = playButton.onclick;
        playButton.onclick = null;
        
        playButton.addEventListener('click', () => {
          // if we have next episode data, update the initialSeason and initialEpisode
          if (nextEpisodeData) {
            const nextSeason = parseInt(nextEpisodeData.dataset.season);
            const nextEpisode = parseInt(nextEpisodeData.dataset.episode);
            
            if (!isNaN(nextSeason) && !isNaN(nextEpisode)) {
              const modal = document.getElementById('player-modal');
              if (modal) {
                // BUG: for some reason the previous episode is still playing when the next episode is clicked. !todo
                const modalContent = renderPlayerModal(type, id, sources, initialSourceIndex, nextSeason, nextEpisode, mediaTitle);
                modal.outerHTML = modalContent;
                initPlayerModal(id, type, sources, initialSourceIndex, nextSeason, nextEpisode, false, mediaTitle);
                
                document.getElementById('player-modal').classList.remove('hidden');
                return;
              }
            }
          }
          
          const playerModal = document.getElementById('player-modal');
          if (playerModal) {
            playerModal.classList.remove('hidden');
          }
        });
      }
    }
    
    // watchlist button
    const watchlistButton = detailsContainer.querySelector('.add-to-watchlist');
    if (watchlistButton) {
      watchlistButton.addEventListener('click', () => {
        const watchlist = JSON.parse(localStorage.getItem('quickwatch-watchlist') || '[]');
        const existingItem = watchlist.find(item => item.id === id && item.mediaType === type);
        if (!existingItem) {
          watchlist.push({
            id,
            mediaType: type,
            title: data.title || data.name,
            posterPath: `${TMDB_IMAGE_BASE_URL}w500${data.poster_path}`,
            dateAdded: new Date().toISOString()
          });
          
          localStorage.setItem('quickwatch-watchlist', JSON.stringify(watchlist));
          showToast('Added to watchlist', 'success');
        } else {
          showToast('Already in your watchlist!', 'error');
        }
      });
    }
    
    initTrailerButton(type, id, mediaTitle);
    
    if (type === 'tv') {
      window.currentPlayingEpisode = null;
      
      initEpisodeList(id, initialSeason, initialEpisode, sources, initialSourceIndex, '', false);
      initSeasonSelector(id, data, seasonData, initialSeason, initialEpisode, sources, initialSourceIndex, contentRating);
    }
    
    initShareModal(type, id, mediaTitle);
    initTabSwitcher(type, id, data);
    
    const activeTab = document.querySelector('.tab-item.active');
    if (activeTab && activeTab.dataset.tab !== 'episodes') {
      if (activeTab.dataset.tab === 'related') {
        loadRelatedContent(type, id, document.querySelector('.related-content-container'));
      } else if (activeTab.dataset.tab === 'details') {
        loadDetailsContent(type, data, document.querySelector('.details-content-container'));
      }
    }
    
    window.splashScreen?.completeStep(renderStep);
    
    if (window.splashScreen) {
      setTimeout(() => {
        window.splashScreen.hide();
        
        if (autoPlay) {
          const playButton = document.getElementById('play-button');
          if (playButton) {
            playButton.click();
          }
        }
      }, 800);
    }
    
    initTabSwitcher(type, id, data);
    
  } catch (error) {
    console.error('Error loading media details:', error);
    const detailsContainer = document.getElementById('details-container');
    if (detailsContainer) {
      detailsContainer.innerHTML = renderError('Failed to load media details. Please try again later.');
    }
    
    window.splashScreen?.hide();
  }
}

const relatedContainer = document.querySelector('.related-content-container');
const detailsContainer = document.querySelector('.details-content-container');

if (relatedContainer && detailsContainer) {
  if (type === 'movie') {
    loadRelatedContent(type, id, relatedContainer);
  }
  
  const relatedTab = document.querySelector('[data-tab="related"]');
  const detailsTab = document.querySelector('[data-tab="details"]');
  
  relatedTab?.addEventListener('click', () => {
    if (!relatedContainer.innerHTML.trim()) {
      loadRelatedContent(type, id, relatedContainer);
    }
  });
  
  detailsTab?.addEventListener('click', () => {
    if (!detailsContainer.innerHTML.trim()) {
      loadDetailsContent(type, data, detailsContainer);
    }
  });
}