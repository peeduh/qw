// Utility functions for video quality options
import Hls from 'hls.js';

export function setupQualityOptions(
  qualityMenu, iphoneQualityMenu, qualityBtn, qualityToggleBtn, 
  player, customPlayer, qualityOptions, isIPhone, isNativeEmbed, 
  fetchVideoUrlCallback = null, // New parameter for callback function
  isIframeEmbed = false // New parameter to indicate if using iframe embeds
) {
  if (!qualityOptions || qualityOptions.length <= 1) {
    if (qualityBtn) qualityBtn.parentElement.classList.add('hidden');
    if (qualityToggleBtn) qualityToggleBtn.classList.add('hidden');
    return;
  }
  
  // Show quality button
  if (qualityBtn) qualityBtn.parentElement.classList.remove('hidden');
  if (qualityToggleBtn) qualityToggleBtn.classList.remove('hidden');
  
  // Populate quality menu
  const targetMenu = isIPhone ? iphoneQualityMenu : qualityMenu;
  if (!targetMenu) return;
  
  targetMenu.innerHTML = '';
  
  qualityOptions.forEach(option => {
    const qualityItem = document.createElement('div');
    qualityItem.className = 'quality-item py-1 px-3 text-sm text-text-primary hover:bg-zinc-700 cursor-pointer';
    qualityItem.dataset.url = option.url;
    qualityItem.dataset.quality = option.name;
    qualityItem.textContent = option.name;
    targetMenu.appendChild(qualityItem);
  });
  
  // Setup event listeners
  setupQualityOptionEvents(
    qualityBtn, qualityToggleBtn, targetMenu, player, 
    customPlayer, isIPhone, isNativeEmbed, fetchVideoUrlCallback, isIframeEmbed
  );
}

function setupQualityOptionEvents(
  qualityBtn, qualityToggleBtn, qualityMenu, player, 
  customPlayer, isIPhone, isNativeEmbed,
  fetchVideoUrlCallback, // Use the callback function
  isIframeEmbed = false // Parameter to indicate if using iframe embeds
) {
  // Toggle quality menu
  const toggleQualityMenu = () => {
    if (isIPhone) {
      qualityMenu.classList.toggle('hidden');
    } else {
      qualityMenu.classList.toggle('opacity-0');
      qualityMenu.classList.toggle('pointer-events-none');
    }
  };
  
  if (qualityBtn) {
    qualityBtn.addEventListener('click', toggleQualityMenu);
  }
  
  if (qualityToggleBtn) {
    qualityToggleBtn.addEventListener('click', toggleQualityMenu);
  }
  
  // Handle quality selection
  const qualityItems = qualityMenu.querySelectorAll('.quality-item');
  
  qualityItems.forEach(item => {
    item.addEventListener('click', async () => {
      const url = item.dataset.url;
      const quality = item.dataset.quality;
      const currentTime = player.currentTime;
      
      // Show loading state
      customPlayer.classList.add('loading');
      
      try {
        let videoUrl = url;
        
        // Update active quality indicator
        qualityItems.forEach(qi => qi.classList.remove('active'));
        item.classList.add('active');
        
        // Handle iframe embeds differently
        if (isIframeEmbed) {
          // Use the callback to get the iframe URL if available
          if (fetchVideoUrlCallback) {
            videoUrl = await fetchVideoUrlCallback({ name: quality, url: url });
          }
          
          // Find existing iframe or create a new one
          let iframe = customPlayer.querySelector('iframe');
          if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.className = 'w-full h-full border-none';
            iframe.allowFullscreen = true;
            
            // Clear the player container and append the iframe
            const videoElement = customPlayer.querySelector('video');
            if (videoElement) {
              videoElement.style.display = 'none';
            }
            
            customPlayer.appendChild(iframe);
          }
          
          // Update iframe source
          iframe.src = videoUrl;
          
          // Add load event listener to remove loading state
          iframe.addEventListener('load', () => {
            customPlayer.classList.remove('loading');
          }, { once: true });
        } else {
          // Regular video source handling
          // If not a native embed and we need to fetch the actual URL
          if (!isNativeEmbed && url.includes('kwik.cx') && fetchVideoUrlCallback) {
            videoUrl = await fetchVideoUrlCallback({ name: quality, url: url });
            if (!videoUrl) {
              console.error('Failed to fetch video URL');
              customPlayer.classList.remove('loading');
              return;
            }
          }
          
          // Update player source
          if (Hls.isSupported() && videoUrl.includes('.m3u8')) {
            if (player.hlsInstance) {
              player.hlsInstance.destroy();
            }
            
            const hls = new Hls();
            hls.loadSource(videoUrl);
            hls.attachMedia(player);
            player.hlsInstance = hls;
          } else {
            player.src = videoUrl;
          }
          
          // Restore playback position and state
          player.currentTime = currentTime;
          
          const wasPlaying = !player.paused;
          player.addEventListener('loadedmetadata', () => {
            if (wasPlaying) {
              player.play().catch(e => console.error('Error playing video:', e));
            }
            customPlayer.classList.remove('loading');
          }, { once: true });
        }
        
        // Hide quality menu
        toggleQualityMenu();
      } catch (error) {
        console.error('Error changing quality:', error);
        customPlayer.classList.remove('loading');
      }
    });
  });
}