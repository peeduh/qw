import Hls from 'hls.js';

export async function setupM3U8Player(player, videoSource, config) {
  try {
    // Parse M3U8 for quality options if quality selector is enabled
    if (config.features.qualitySelector) {
      try {
        const m3u8Response = await fetch(videoSource);
        const m3u8Content = await m3u8Response.text();
        
        const extractedOptions = parseM3U8ForQualities(m3u8Content, videoSource);
        if (extractedOptions.length > 0) {
          config.qualityOptions = extractedOptions;
        }
      } catch (error) {
        console.error('Error parsing m3u8 for qualities:', error);
      }
    }

    // Setup HLS player
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
      });
      
      hls.loadSource(videoSource);
      hls.attachMedia(player);
      
      // Store HLS instance for cleanup and quality switching
      player.hlsInstance = hls;
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (config.autoplay) {
          player.play().catch(e => console.log('Autoplay prevented:', e));
        }
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Fatal network error encountered, trying to recover');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Fatal media error encountered, trying to recover');
              hls.recoverMediaError();
              break;
            default:
              console.log('Fatal error, cannot recover');
              hls.destroy();
              break;
          }
        }
      });
    } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      player.src = videoSource;
      if (config.autoplay) {
        player.play().catch(e => console.log('Autoplay prevented:', e));
      }
    } else {
      console.error('HLS is not supported in this browser');
    }
  } catch (error) {
    console.error('Error setting up M3U8 player:', error);
  }
}

export function parseM3U8ForQualities(m3u8Content, sourceUrl) {
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
        
        // Handle proxy URLs
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
  
  // Add Auto option at the beginning if we found quality options
  if (qualityOptions.length > 0) {
    qualityOptions.unshift({
      url: sourceUrl,
      name: 'Auto'
    });
  }
  
  return qualityOptions;
}

export function switchHLSQuality(player, quality, videoUrl) {
  if (!player.hlsInstance || !Hls.isSupported()) {
    return false;
  }
  
  try {
    if (quality === 'Auto') {
      player.hlsInstance.currentLevel = -1; // Auto quality
      return true;
    } else {
      // Find the level that matches the quality
      const levels = player.hlsInstance.levels;
      const targetLevel = levels.findIndex(level => {
        const height = level.height;
        return quality.includes(`${height}p`);
      });
      
      if (targetLevel !== -1) {
        player.hlsInstance.currentLevel = targetLevel;
        return true;
      } else {
        // Fallback: reload with new source
        player.hlsInstance.loadSource(videoUrl);
        return true;
      }
    }
  } catch (error) {
    console.error('Error switching HLS quality:', error);
    return false;
  }
}

export function cleanupHLS(player) {
  if (player && player.hlsInstance) {
    try {
      player.hlsInstance.destroy();
      delete player.hlsInstance;
    } catch (error) {
      console.error('Error cleaning up HLS instance:', error);
    }
  }
}