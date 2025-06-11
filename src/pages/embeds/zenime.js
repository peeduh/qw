// Zenime Embed
import { initializePlayer } from '../../components/player/index.js';
import { PlayerConfig } from '../../components/player/config.js';
import { createProxyUrl, shouldUseProxy, createProxyHeaders } from '../../components/player/proxy.js';
import { renderFullPageSpinner, renderSpinner } from '../../components/misc/loading.js';
import config from '../../config.json';

export async function renderZenimeEmbed(container, params) {
  let { episodeId, server, type } = params;
  episodeId = decodeURIComponent(episodeId);

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
    const zenimeStep = window.splashScreen?.addStep('Loading video data...');
    
    const zenimeResponse = await fetch(config.proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://api.zenime.site/api/stream?id=${episodeId}&server=${server}&type=${type}`,
        method: 'GET',
        headers: { 'Origin': 'https://zenime.site' },
      })
    });

    const zenimeData = await zenimeResponse.json();
    
    window.splashScreen?.completeStep(zenimeStep);
    
    if (!zenimeData.success || !zenimeData.results) {
      throw new Error('Failed to load video data');
    }
    
    if (!zenimeData.results.streamingLink || 
        Array.isArray(zenimeData.results.streamingLink) && zenimeData.results.streamingLink.length === 0 ||
        !zenimeData.results.streamingLink.link) {
      throw new Error('Sorry, we couldn\'t find a video');
    }
    
    const streamData = zenimeData.results.streamingLink;
    const playerContainer = container.querySelector('#player-container');
    
    if (playerContainer) {
      playerContainer.innerHTML = `
        <div class="flex justify-center items-center h-full">
          ${renderSpinner('large')}
        </div>
      `;
      
      const m3u8Step = window.splashScreen?.addStep('Preparing video stream...');
      
      let videoSource = streamData.link.file;
      
      if (shouldUseProxy(videoSource)) {
        const headers = createProxyHeaders("https://megacloud.blog/");
        videoSource = createProxyUrl(videoSource, headers);
      }
      
      const subtitleTracks = streamData.tracks ? streamData.tracks
        .filter(track => track.kind === 'captions' || track.kind === 'subtitles')
        .map(track => {
          let trackUrl = track.file;
          if (shouldUseProxy(trackUrl)) {
            const headers = createProxyHeaders(trackUrl);
            trackUrl = createProxyUrl(trackUrl, headers);
          }
          
          return {
            url: trackUrl,
            lang: track.label || 'Unknown',
            default: !!track.default
          };
        }) : [];
      
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
      
      await renderVideoPlayer(playerContainer, videoSource, 'Auto', qualityOptions, episodeId, episodeId, subtitleTracks);
    }
  } catch (error) {
    console.error('Error loading Zenime video:', error);
    container.innerHTML = `<div class="flex h-screen w-full items-center justify-center text-4xl font-medium tracking-[-0.015em] text-text-primary px-[10%] text-center" style="font-family: 'Inter';">${error.message}</div>`;
    
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
  }
}

async function renderVideoPlayer(container, videoSource, initialQuality, qualityOptions, showId, episodeNumber, subtitleTracks = []) {
  // Clean the showId by removing URL parameters for anime content
  const cleanShowId = showId.split('?')[0];
  
  const config = new PlayerConfig({
    showId: cleanShowId,
    episodeNumber: episodeNumber,
    mediaType: 'anime',
    isNativeEmbed: false,
    autoplay: true,
    qualityOptions: qualityOptions,
    subtitleTracks: subtitleTracks,
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