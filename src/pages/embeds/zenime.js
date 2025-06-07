// Zenime Embed
import { initializePlayer } from '../../components/player/index.js';
import { PlayerConfig } from '../../components/player/config.js';
import { createProxyUrl, shouldUseProxy, createProxyHeaders } from '../../components/player/proxy.js';
import { renderFullPageSpinner, renderSpinner } from '../../components/misc/loading.js';
import Hls from 'hls.js';

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
    
    const zenimeResponse = await fetch('https://varunaditya.xyz/api/proxy', {
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
      
      if (videoSource.includes('.m3u8')) {
        try {
          const m3u8Response = await fetch(videoSource);
          const m3u8Content = await m3u8Response.text();
          
          const extractedOptions = parseM3U8ForQualities(m3u8Content, videoSource);
          if (extractedOptions.length > 0) {
            qualityOptions = extractedOptions;
          }
        } catch (error) {
          console.error('Error parsing m3u8 for qualities:', error);
        }
      }
      
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
      
      renderVideoPlayer(playerContainer, videoSource, 'Auto', qualityOptions, episodeId, episodeId, subtitleTracks);
    }
  } catch (error) {
    console.error('Error loading Zenime video:', error);
    container.innerHTML = `<div class="flex h-screen w-full items-center justify-center text-4xl font-medium tracking-[-0.015em] text-text-primary px-[10%] text-center" style="font-family: 'Inter';">${error.message}</div>`;
    
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
  }
}

function parseM3U8ForQualities(m3u8Content, sourceUrl) {
  const qualityOptions = [];
  const lines = m3u8Content.split('\n');
  const baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
      const streamInfo = lines[i];
      const nextLine = lines[i + 1];
      
      if (nextLine && !nextLine.startsWith('#')) {
        const resolutionMatch = streamInfo.match(/RESOLUTION=(\d+x\d+)/);
        const bandwidthMatch = streamInfo.match(/BANDWIDTH=(\d+)/);
        
        let qualityName = 'Unknown';
        if (resolutionMatch && resolutionMatch[1]) {
          const resolution = resolutionMatch[1];
          const height = resolution.split('x')[1];
          qualityName = `${height}p`;
          
          if (bandwidthMatch && bandwidthMatch[1]) {
            const bandwidth = parseInt(bandwidthMatch[1]);
            const mbps = (bandwidth / 1000000).toFixed(1);
            qualityName += ` (${mbps} Mbps)`;
          }
        }
        
        let qualityUrl = nextLine;
        if (!qualityUrl.startsWith('http')) {
          qualityUrl = new URL(qualityUrl, baseUrl).href;
        }
        
        if (sourceUrl.includes('proxy.varunaditya.xyz') && !qualityUrl.includes('proxy.varunaditya.xyz')) {
          const urlParams = new URLSearchParams(new URL(sourceUrl).search);
          const originalUrl = urlParams.get('url');
          const headers = urlParams.get('headers');
          
          const proxyBase = sourceUrl.substring(0, sourceUrl.indexOf('/m3u8-proxy'));
          qualityUrl = `${proxyBase}/m3u8-proxy?url=${encodeURIComponent(qualityUrl)}&headers=${headers}`;
        }
        
        qualityOptions.push({
          url: qualityUrl,
          name: qualityName
        });
      }
    }
  }
  
  if (qualityOptions.length > 0) {
    qualityOptions.unshift({
      url: sourceUrl,
      name: 'Auto'
    });
  }
  
  return qualityOptions;
}

function renderVideoPlayer(container, videoSource, initialQuality, qualityOptions, showId, episodeNumber, subtitleTracks = []) {
  const config = new PlayerConfig({
    showId: showId,
    episodeNumber: episodeNumber,
    mediaType: 'tv',
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
      pip: true
    }
  });
  
  container.innerHTML = '';
  const playerInstance = initializePlayer(container, config);
  
  if (playerInstance) {
    playerInstance.player.src = videoSource;
  }
  
  // Clean up function to remove event listeners when the page is unloaded
  window.addEventListener('beforeunload', () => {
    if (playerInstance && typeof playerInstance.cleanup === 'function') {
      playerInstance.cleanup();
    }
  });
}