import Hls from 'hls.js';
import { createProxyUrl, createTsProxyUrl, createProxyHeaders, isProxiedUrl } from './proxy.js';

export async function setupM3U8Player(player, videoSource, config) {
  try {
    // Setup HLS player
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        // Add loader configuration for proxy support
        loader: class extends Hls.DefaultConfig.loader {
          load(context, config, callbacks) {
            // If URL is already proxied, use it as-is
            if (isProxiedUrl(context.url)) {
              return super.load(context, config, callbacks);
            }
            
            // For non-proxied URLs, check if we need to proxy them
            if (context.url.includes('.m3u8') || context.url.includes('.ts')) {
              const headers = createProxyHeaders(context.url);
              const proxyUrl = context.url.includes('.ts') 
                ? createTsProxyUrl(context.url, headers)
                : createProxyUrl(context.url, headers);
              
              context.url = proxyUrl;
            }
            
            return super.load(context, config, callbacks);
          }
        }
      });
      
      hls.loadSource(videoSource);
      hls.attachMedia(player);
      
      // Store HLS instance for cleanup and quality switching
      player.hlsInstance = hls;
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Extract quality options from hls.js levels after manifest is parsed
        if (config.features.qualitySelector && hls.levels && hls.levels.length > 0) {
          const qualityOptions = extractQualitiesFromHLS(hls.levels, videoSource);
          config.qualityOptions = qualityOptions;
        }
        
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

// Extract quality options from hls.js levels
function extractQualitiesFromHLS(levels, sourceUrl) {
  const qualityOptions = [];
  
  // Add Auto option first
  qualityOptions.push({
    url: sourceUrl,
    name: 'Auto'
  });
  
  // Process each level from hls.js
  levels.forEach((level, index) => {
    let qualityName = 'Unknown';
    
    if (level.height) {
      qualityName = `${level.height}p`;
      
      if (level.bitrate) {
        const mbps = (level.bitrate / 1000000).toFixed(1);
        qualityName += ` (${mbps} Mbps)`;
      }
    } else if (level.bitrate) {
      const mbps = (level.bitrate / 1000000).toFixed(1);
      qualityName = `${mbps} Mbps`;
    }
    
    qualityOptions.push({
      url: level.url || sourceUrl,
      name: qualityName,
      level: index // Store the hls.js level index for switching
    });
  });
  
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
      let targetLevel = -1;
      
      // First try to match by height
      targetLevel = levels.findIndex(level => {
        const height = level.height;
        return height && quality.includes(`${height}p`);
      });
      
      // If no height match, try to match by bitrate
      if (targetLevel === -1) {
        targetLevel = levels.findIndex(level => {
          if (level.bitrate) {
            const mbps = (level.bitrate / 1000000).toFixed(1);
            return quality.includes(`${mbps} Mbps`);
          }
          return false;
        });
      }
      
      if (targetLevel !== -1) {
        player.hlsInstance.currentLevel = targetLevel;
        return true;
      } else {
        console.warn('Could not find matching quality level:', quality);
        return false;
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

// Legacy function kept for backward compatibility but no longer used
export function parseM3U8ForQualities(m3u8Content, sourceUrl) {
  console.warn('parseM3U8ForQualities is deprecated. Quality parsing is now handled by hls.js');
  return [];
}