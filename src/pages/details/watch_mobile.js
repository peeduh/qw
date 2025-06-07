// Details Page
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '../../router.js';
import { renderHeader } from '../../components/header.js';
import { renderSpinner, renderFullPageSpinner } from '../../components/misc/loading.js';
import { renderError } from '../../components/misc/error.js';
import { loadRelatedContentMobile, loadDetailsContentMobile } from '../../components/watch/tabs/tabContent.js';
import { initTabSwitcherMobile } from '../../components/watch/tabs/tabSwitcher.js';
import { renderPlayerModal, initPlayerModal } from '../../components/watch/playerModal.js';
import { initTrailerButton } from '../../components/watch/trailerModal.js';
import { renderEpisodeList, initEpisodeList } from '../../components/watch/tv/episodeList.js';
import { renderSeasonSelector, initSeasonSelector } from '../../components/watch/tv/seasonSelector.js';
import { getProgress } from '../../components/watch/progress/index.js';
import { sources } from './sources.js'
import { showToast } from '../../components/toast.js';

export function renderDetailsMobilepage(container, params) {
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
      
      if (showItems.length > 0) {
        const mostRecentItem = showItems[0];
        
        if (mostRecentItem.sourceIndex !== undefined && 
            mostRecentItem.sourceIndex >= 0 && 
            mostRecentItem.sourceIndex < sources.length) {
          initialSourceIndex = parseInt(mostRecentItem.sourceIndex);
        }
      }
    } else {
      const continueWatching = JSON.parse(localStorage.getItem('quickwatch-continue') || '[]');
      
      const groupedItems = continueWatching.reduce((acc, item) => {
        const key = `${item.id}_${item.mediaType}`;
        if (!acc[key]) {
          acc[key] = item;
        } else {
          if (item.timestamp > acc[key].timestamp) {
            acc[key] = item;
          }
        }
        return acc;
      }, {});
      
      const savedItem = Object.values(groupedItems).find(item => item.id === id && item.mediaType === type);
    
      if (savedItem && savedItem.sourceIndex !== undefined && savedItem.sourceIndex >= 0 && savedItem.sourceIndex < sources.length) {
        initialSourceIndex = savedItem.sourceIndex;
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
    const genresText = data.genres?.slice(0, 2).map(genre => genre.name.toUpperCase()).join('  ') || '';
    // release year
    const year = new Date(data.release_date || data.first_air_date).getFullYear() || 'N/A';
    
    // (white) network logo
    const networkLogo = data.networks && data.networks.length > 0 ? 
      `<img src="${TMDB_IMAGE_BASE_URL}w500${data.networks[0].logo_path}" class="max-w-[4rem] mb-3" style="filter: invert(50%) brightness(10000%);">` : '';
    
    // title logo with title fallback
    const titleDisplay = data.images?.logos && data.images.logos.length > 0 ?
      `<img id="titleofmedia" src="${TMDB_IMAGE_BASE_URL}w500${data.images.logos[0].file_path}" class="max-w-[16rem] max-h-[15rem] mb-4" alt="${data.title || data.name}">` :
      `<h1 id="titleofmedia" class="text-4xl font-bold mb-8" alt="${data.title || data.name}">${data.title || data.name}</h1>`;

    function formatRemainingTime(duration, watched) {
      const remainingMinutes = Math.round((duration - watched) / 60);
      if (remainingMinutes <= 0) return null;
      
      if (remainingMinutes >= 60) {
        const hours = Math.floor(remainingMinutes / 60);
        const minutes = remainingMinutes % 60;
        return `${hours}h${minutes}m left`;
      }
      return `${remainingMinutes}min left`;
    }
    
    detailsContainer.innerHTML = `
      <section class="w-full relative h-[60vh]">
        <img class="object-cover w-full h-full object-center" src="${TMDB_IMAGE_BASE_URL}original${data.backdrop_path}">
        
        <div class="absolute inset-0 bg-gradient-to-t from-background-primary via-background-primary/70 via-background-primary/40 via-transparent to-transparent bottom-[-2px]"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-background-primary/80 via-background-primary/60 via-background-primary/30 via-transparent to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-background-primary/30 via-transparent to-transparent"></div>
        
        <div class="absolute bottom-0 left-0 w-full px-5 py-4">
          ${networkLogo ? `<div class="mb-2">${networkLogo}</div>` : ''}
          <div class="mb-2">
            ${titleDisplay}
          </div>
          
          <div class="flex items-center gap-1 mb-1 text-[0.83rem] text-bold">
            <span class="bg-[#3B54F6] px-1.5 pt-0.5 pb-[0.07rem] rounded text-text-primary">${data.status.toUpperCase()}</span>
            <span class="px-2 py-0.5 rounded text-text-primary">TMDB ${data.vote_average?.toFixed(1) || 'N/A'}</span>
          </div>
          
          <div class="flex items-center gap-3 text-[0.8rem] text-text-primary/80 mb-4 ml-1 font-light">
            ${year}
            ${type === 'tv' ? `<span>${data.number_of_seasons || 0} SEASONS</span>` : ''}
            ${contentRating}
          </div>
        </div>
      </section>
      
      <section class="px-5 py-6 bg-background-primary">
        <div class="flex flex-col w-full items-center justify-center mb-6">
          <button class="flex-1 py-3 bg-text-primary text-black rounded-lg font-medium flex items-center justify-center gap-2 w-full mb-3" id="play-button">
            <i class="fas fa-play"></i>            
            ${(() => {
              if (type === 'tv') {
                const progress = getProgress(id, 'tv', initialSeason, initialEpisode);
                const remainingMinutes = progress ? Math.round((progress.fullDuration - progress.watchedDuration) / 60) : 0;
                
                if (progress && remainingMinutes <= 5) {
                  // Check if there are more episodes in current season
                  const nextEpisode = initialEpisode + 1;
                  if (nextEpisode <= seasonData.episodes.length) {
                    return `
                      <span class="mr-2">Watch S${initialSeason}E${nextEpisode} <span class="font-light">(Next episode)</span></span>
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
                        <span class="mr-2">Watch S${nextSeason}E1 <span class="font-light">(Next season)</span></span>
                        <span class="hidden" id="next-episode-data" 
                          data-season="${nextSeason}" 
                          data-episode="1">
                        </span>
                      `;
                    } else {
                      // No more seasons: rewatch
                      return `
                        <span class="mr-2">Rewatch S1E1 <span class="font-light">(Start over)</span></span>
                        <span class="hidden" id="next-episode-data" 
                          data-season="1" 
                          data-episode="1">
                        </span>
                      `;
                    }
                  }
                }
                
                return `
                  <span class="mr-2">Continue S${initialSeason}E${initialEpisode} ${progress && progress.watchedDuration > 0 ? 
                    `<span class="font-light">(${remainingMinutes}min left)</span>` : ''}</span>
                `;
              } else {
                const progress = getProgress(id, 'movie');
                return progress && progress.watchedDuration > 0 ? 
                  `<span class="mr-2">Continue Watching <span class="font-light">(${formatRemainingTime(progress.fullDuration, progress.watchedDuration)})</span></span>` :
                  `<span class="mr-2">Play movie</span>`;
              }
            })()}
          </button>
          
          <div class="flex flex-row gap-8 ml-4 p-2 w-full items-center justify-start">
            <button class="h-12 bg-background-primary flex flex-col items-center justify-center add-to-watchlist">
              <i class="icon-plus text-3xl"></i>
              <span class="text-xs font-light">My List</span>
            </button>
            <button id="trailer-button" class="h-12 bg-background-primary flex flex-col items-center justify-center">
              <i class="icon-film text-2xl mb-1"></i>
              <span class="text-xs font-light">Trailer</span>
            </button>
            <button id="share-button" class="h-12 bg-background-primary flex flex-col items-center justify-center">
              <i class="icon-share text-2xl mb-1"></i>
              <span class="text-xs font-light">Share</span>
            </button>
          </div>
        </div>
        
        <p class="text-[1.07rem] text-text-primary/80 mb-2 font-light leading-tight overflow-hidden line-clamp-4 text-ellipsis">
          ${data.overview || 'No overview available'}
        </p>
        
        <div class="flex items-center text-xs text-text-primary/60 gap-2 mb-4 font-light">
          ${genresText}
        </div>
      </section>
      
      <section class="w-full mb-16 relative">
        <div class="flex flex-row gap-8 px-5 text-xl text-bold">
          ${type === 'tv' ? `<span class="tab-item active border-b-2 border-text-primary pb-2 cursor-pointer" data-tab="episodes">Episodes</span>` : ''}
          <span class="tab-item ${type === 'movie' ? 'active border-b-2 border-text-primary pb-2' : 'text-zinc-400'} cursor-pointer" data-tab="related">Related</span>
          <span class="tab-item text-zinc-400 cursor-pointer" data-tab="details">Details</span>
        </div>

        <div class="mt-4 pb-16">
          ${type === 'tv' ? `
          <div id="episodes-tab" class="tab-content active">
            ${renderSeasonSelector(data, initialSeason, true)}
            ${renderEpisodeList(seasonData.episodes, contentRating, true)}
            </div>
          </div>
          ` : ''}
          
          <div id="related-tab" class="tab-content ${type === 'movie' ? 'active' : 'hidden'}">
            <div class="related-content-container px-4"></div>
          </div>
          
          <div id="details-tab" class="tab-content hidden">
            <div class="details-content-container px-4"></div>
          </div>
        </div>
      </section>
      
      ${renderPlayerModal(type, id, sources, initialSourceIndex, initialSeason, initialEpisode, data.title || data.name, true)}
    `;
    
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

    initPlayerModal(id, type, sources, initialSourceIndex, initialSeason, initialEpisode, true, data.title || data.name);
    
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
                const modalContent = renderPlayerModal(type, id, sources, initialSourceIndex, nextSeason, nextEpisode, data.title || data.name, true);
                modal.outerHTML = modalContent;
                initPlayerModal(id, type, sources, initialSourceIndex, nextSeason, nextEpisode, true, data.title || data.name);
                
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

    initTrailerButton(type, id, mediaTitle);
    
    if (type === 'tv') {
      initEpisodeList(id, initialSeason, initialEpisode, sources, initialSourceIndex, '', true);
      initSeasonSelector(id, data, seasonData, initialSeason, initialEpisode, sources, initialSourceIndex, contentRating, true);
    }

    const shareButton = document.getElementById('share-button');
    if (shareButton) {
      shareButton.addEventListener('click', () => {
        const shareUrl = window.location.href;
        const shareTitle = data.title || data.name;
        const shareText = data.overview ? data.overview.substring(0, 100) + '...' : 'Check out this title on QuickWatch!';
        
        if (navigator.share) {
          navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
          })
          .then(() => console.log('Shared successfully'))
          .catch((error) => console.error('Error sharing:', error));
        } else {
          alert(`Share this link: ${shareUrl}`);
          
          const textArea = document.createElement('textarea');
          textArea.value = shareUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          alert('Link copied to clipboard!');
        }
      });
    }

    initTabSwitcherMobile(type, id, data);
    
    if (type === 'movie') {
      const relatedContainer = document.querySelector('.related-content-container');
      if (relatedContainer) {
        loadRelatedContentMobile(type, id, relatedContainer);
      }
    }
    
    if (detailsContainer && detailsContainer.innerHTML.trim() === '') {
      loadDetailsContentMobile(type, data, detailsContainer);
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

  } catch (error) {
    console.error('Error loading media details:', error);
    document.getElementById('details-container').innerHTML = renderError(
      'Error', 
      'Failed to load details', 
      'Back to Home',
      "window.history.pushState(null, null, '/'); window.dispatchEvent(new PopStateEvent('popstate'))"
    );
    
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
  }
}
