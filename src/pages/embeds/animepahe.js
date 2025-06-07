// AnimePahe Embed Page
import { renderFullPageSpinner, renderSpinner } from '../../components/misc/loading.js';
import { renderError } from '../../components/misc/error.js';
import { initializePlayer } from '../../components/player/index.js';
import { PlayerConfig } from '../../components/player/config.js';
import { fetchKwikVideoUrl } from '../../components/player/videoUtils.js';
import config from '../../config.json';

export async function renderAnimePaheEmbed(container, params) {
  const { id, name, episode, season } = params;

  if (window.splashScreen) {
    window.splashScreen.show();
  }

  container.innerHTML = `
    <div class="flex flex-col h-screen bg-black">
      <div id="player-container" class="flex-grow relative overflow-hidden">
        <div class="flex justify-center items-center h-full">
          ${renderFullPageSpinner()}
        </div>
      </div>
    </div>
  `;

  try {
    await loadAnimeContent(name, episode, season, container, params);
  } catch (error) {
    console.error('Error loading anime content:', error);
    container.innerHTML = renderError(
      'Error',
      error.message || 'Failed to load anime content',
      '',
      '',
      false
    );
    
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
  }
}

async function loadAnimeContent(animeName, episode, season, container, params) {
  const tmdbStep = window.splashScreen?.addStep('Loading anime details...');
  
  window.splashScreen?.completeStep(tmdbStep);
  const searchStep = window.splashScreen?.addStep('Searching for anime sources...');
  
  const seasonNumber = season || '1';
  const searchQuery = seasonNumber === '1' ? animeName : `${animeName} Season ${seasonNumber}`;

  const searchResponse = await fetch(config.proxy, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: `https://animepahe.ru/api?m=search&q=${encodeURIComponent(searchQuery)}`,
      method: 'GET',
      headers: {
        'cookie': '__ddg2_=;'
      }
    })
  });
  const searchData = await searchResponse.json();

  if (!searchData.data || searchData.data.length === 0) {
    window.splashScreen?.hide();
    throw new Error('Anime not found');
  }

  let bestMatch = searchData.data[0];
  
  window.splashScreen?.completeStep(searchStep);
  const episodesStep = window.splashScreen?.addStep('Loading episode list...');

  const seriesResponse = await fetch(config.proxy, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: `https://animepahe.ru/api?m=release&id=${bestMatch.session}&sort=episode_asc&page=1`,
      method: 'GET',
      headers: {
        'cookie': '__ddg2_=;'
      }
    })
  });
  const seriesData = await seriesResponse.json();

  if (!seriesData.data || seriesData.data.length === 0) {
    window.splashScreen?.hide();
    throw new Error('No episodes found');
  }

  const episodeIndex = parseInt(episode) - 1;
  if (episodeIndex < 0 || episodeIndex >= seriesData.data.length) { throw new Error('Episode not found'); }

  const episodeData = seriesData.data[episodeIndex];
  
  window.splashScreen?.completeStep(episodesStep);
  const linksStep = window.splashScreen?.addStep('Fetching streaming links...');

  const linksResponse = await fetch(`https://anime.apex-cloud.workers.dev/?method=episode&session=${bestMatch.session}&ep=${episodeData.session}`);
  const qualityOptions = await linksResponse.json();

  window.splashScreen?.completeStep(linksStep);

  if (!qualityOptions || qualityOptions.length === 0) {
    throw new Error('No streaming links found');
  }

  const playerContainer = container.querySelector('#player-container');
  if (playerContainer) {
    playerContainer.innerHTML = `
      <div class="flex justify-center items-center h-full">
        ${renderSpinner('large')}
      </div>
    `;

    const m3u8Step = window.splashScreen?.addStep('Preparing video stream...');
    
    fetchKwikVideoUrl(qualityOptions[0].link)
      .then(videoUrl => {
        window.splashScreen?.completeStep(m3u8Step);
        if (window.splashScreen) {
          window.splashScreen.hide();
        }
        
        if (videoUrl) {
          renderVideoPlayer(playerContainer, videoUrl, 'Auto', qualityOptions, params.episodeId, params.episodeId);
        } else {
          playerContainer.innerHTML = `
            <div class="flex justify-center items-center h-full">
              <p class="text-text-primary text-xl">Failed to load video. Please try another source.</p>
            </div>
          `;
        }
      })
      .catch(error => {
        window.splashScreen?.completeStep(m3u8Step);
        if (window.splashScreen) {
          window.splashScreen.hide();
        }
        
        console.error('Error fetching video URL:', error);
        playerContainer.innerHTML = `
          <div class="flex justify-center items-center h-full">
            <p class="text-text-primary text-xl">Failed to load video. Please try another source.</p>
          </div>
        `;
      });
  }
}

async function renderVideoPlayer(container, videoUrl, initialQuality, qualityOptions, showId, episodeNumber) {
  const isIPhone = /iPhone/i.test(navigator.userAgent);
  
  // Transform the array to include url property and add callback
  const enhancedQualityOptions = qualityOptions.map(option => ({
    name: option.name,
    url: option.link // Map 'link' to 'url' as expected by setupQualityOptions
  }));
  
  // Add the callback function as a property of the array
  enhancedQualityOptions.fetchVideoUrlCallback = fetchKwikVideoUrl;
  
  const config = new PlayerConfig({
    showId: showId,
    episodeNumber: episodeNumber,
    mediaType: 'tv',
    isNativeEmbed: false,
    autoplay: true,
    qualityOptions: enhancedQualityOptions,
    crossOrigin: '',
    features: {
      qualitySelector: true,
      subtitles: true,
      download: true,
      preview: true,
      skipButtons: true,
      aspectToggle: true,
      pip: true
    },
    callbacks: {
      fetchVideoUrl: fetchKwikVideoUrl
    }
  });
  
  container.innerHTML = '';
  const playerInstance = await initializePlayer(container, config);
  
  if (playerInstance) {
    playerInstance.player.src = videoUrl;
  }
  
  // Clean up function to remove event listeners when the page is unloaded
  window.addEventListener('beforeunload', () => {
    if (playerInstance && typeof playerInstance.cleanup === 'function') {
      playerInstance.cleanup();
    }
  });
}