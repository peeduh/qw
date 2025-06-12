// OnionFlixer Embed
import { initializePlayer } from '../../components/player/index.js';
import { PlayerConfig } from '../../components/player/config.js';
import { createProxyUrl, shouldUseProxy, createProxyHeaders } from '../../components/player/proxy.js';
import { renderFullPageSpinner, renderSpinner } from '../../components/misc/loading.js';
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '../../router.js';
import config from '../../config.json';

export async function renderOnionEmbed(container, params) {
  const { id, episode, season, type } = params;

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
    const onionStep = window.splashScreen?.addStep('Loading video data...');

    let imdb_id = ''

    if (type === 'movie') {    
      const response = await fetch(`${TMDB_BASE_URL}/movie/${id}/external_ids`, {
        headers: {
          Authorization: TMDB_API_KEY
        }
      });
      
      const data = await response.json();
      imdb_id = data.imdb_id
    }
    
    const onionResponse = await fetch(`${config.api}/onionflixer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type,
        imdbId: imdb_id,
        tmdb_id: id,
        season: season,
        episode: episode
      })
    });

    const onionData = await onionResponse.json();

    console.log(onionData);
    
    window.splashScreen?.completeStep(onionStep);
    
    if (!onionData.m3u8_url) {
      throw new Error('Sorry, we couldn\'t find a video');
    }
    
    const playerContainer = container.querySelector('#player-container');
    
    if (playerContainer) {
      playerContainer.innerHTML = `
        <div class="flex justify-center items-center h-full">
          ${renderSpinner('large')}
        </div>
      `;
      
      const m3u8Step = window.splashScreen?.addStep('Preparing video stream...');
      
      let videoSource = onionData.m3u8_url;
      
      if (shouldUseProxy(videoSource)) {
        const headers = createProxyHeaders("https://opflix.su/");
        videoSource = createProxyUrl(videoSource, headers);
      }
      
      const subtitleTracks = [];
      
      let qualityOptions = [{url: videoSource, name: 'Auto'}];
      
      window.splashScreen?.completeStep(m3u8Step);
      if (window.splashScreen) {
        window.splashScreen.hide();
      }
      
      const cleanup = () => {
        const player = playerContainer.querySelector('#custom-player');
        if (player && player.hlsInstance) {
          player.hlsInstance.destroy();
          delete player.hlsInstance;
        }
      };
      
      window.addEventListener('beforeunload', cleanup);
      
      await renderVideoPlayer(playerContainer, videoSource, qualityOptions, type, id, episode);
    }
  } catch (error) {
    console.error('Error loading Onion video:', error);
    container.innerHTML = `<div class="flex h-screen w-full items-center justify-center text-4xl font-medium tracking-[-0.015em] text-text-primary px-[10%] text-center" style="font-family: 'Inter';">${error.message}</div>`;
    
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
  }
}

async function renderVideoPlayer(container, videoSource, qualityOptions, type, id, episode) {  
  const config = new PlayerConfig({
    videoSource: videoSource,
    showId: id,
    episodeNumber: episode,
    mediaType: type === 'movie' ? 'movie' : 'tv',
    isNativeEmbed: false,
    autoplay: true,
    qualityOptions: qualityOptions,
    subtitleTracks: [],
    features: {
      qualitySelector: true,
      subtitles: true,
      download: true,
      preview: true,
      skipButtons: true,
      aspectToggle: true,
      pip: true,
      isM3U8: videoSource.includes('.m3u8')
    }
  });
  
  container.innerHTML = '';
  const playerInstance = await initializePlayer(container, config);
  
  
  // Enhanced cleanup function
  const cleanup = () => {
    if (playerInstance) {
      const player = playerInstance.player;
      if (player && player.hlsInstance) {
        player.hlsInstance.destroy();
        delete player.hlsInstance;
      }
      if (typeof playerInstance.cleanup === 'function') {
        playerInstance.cleanup();
      }
    }
  };
  
  window.addEventListener('beforeunload', cleanup);
  
  return { playerInstance, cleanup };
}