export function setupPreviewVideo(videoPreview, player, progressContainerHitbox, progressContainer, previewTime, linksData, isNativeEmbed = false, fetchVideoUrlCallback = null) {
  let previewReady = false;
  let isHoveringProgressContainer = false;
  
  const previewVideo = document.createElement('video');
  previewVideo.muted = true;
  previewVideo.preload = 'metadata';
  previewVideo.crossOrigin = player.crossOrigin;
  previewVideo.style.width = '100%';
  previewVideo.style.height = '100%';
  previewVideo.style.objectFit = 'cover';
  
  // replace canvas with video element
  videoPreview.querySelector('#preview-canvas').replaceWith(previewVideo);
  
  // format time for display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  const getLowestSizeVideoLink = () => {
    if (!linksData || linksData.length === 0) return null;
    
    if (isNativeEmbed) {
      const sortedOptions = [...linksData].sort((a, b) => {
        const resA = parseInt(a.name.replace(/[Pp]/g, '')) || 0;
        const resB = parseInt(b.name.replace(/[Pp]/g, '')) || 0;
        return resA - resB;
      });
      
      return sortedOptions[0]?.url || null;
    } 
    
    let lowestSizeLink = linksData[0];
    let lowestSize = Infinity;
    
    for (const link of linksData) {
      const sizeMatch = link.name.match(/\((\d+)MB\)/);
      if (sizeMatch && sizeMatch[1]) {
        const size = parseInt(sizeMatch[1]);
        if (size < lowestSize) {
          lowestSize = size;
          lowestSizeLink = link;
        }
      }
    }
    
    return lowestSizeLink.link;
  };
  
  const loadPreviewVideo = async () => {
    try {
      const videoSource = getLowestSizeVideoLink();
      if (!videoSource) return;
      
      if (isNativeEmbed) {
        previewVideo.src = videoSource;
        previewVideo.addEventListener('loadedmetadata', () => {
          previewReady = true;
        });
      } else if (fetchVideoUrlCallback) {
        const previewVideoUrl = await fetchVideoUrlCallback(videoSource);
        if (previewVideoUrl) {
          previewVideo.src = previewVideoUrl;
          previewVideo.addEventListener('loadedmetadata', () => {
            previewReady = true;
          });
        }
      }
    } catch (error) {
      console.error('Error loading preview video:', error);
    }
  };
  
  if (linksData && linksData.length > 0) {
    loadPreviewVideo();
  }
  
  const showPreview = (posX, time) => {
    videoPreview.classList.remove('hidden');
    setTimeout(() => {
      videoPreview.classList.remove('opacity-0');
    }, 10);
    
    videoPreview.style.left = `${posX}px`;
    videoPreview.style.bottom = `10px`;
    previewTime.textContent = formatTime(time);
    
    if (previewReady && previewVideo.readyState >= 2) {
      previewVideo.currentTime = time;
    }
  };
  
  progressContainerHitbox.addEventListener('mousemove', (e) => {
    if (!player.duration) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const previewTimeValue = player.duration * pos;
    
    showPreview(e.clientX, previewTimeValue);
  });
  
  progressContainerHitbox.addEventListener('mouseleave', () => {
    videoPreview.classList.add('opacity-0');
    setTimeout(() => {
      if (!isHoveringProgressContainer) {
        videoPreview.classList.add('hidden');
      }
    }, 300);
  });
  
  progressContainerHitbox.addEventListener('mouseenter', () => {
    isHoveringProgressContainer = true;
  });
  
  progressContainerHitbox.addEventListener('mouseleave', () => {
    isHoveringProgressContainer = false;
  });
  
  return {
    previewReady,
    isHoveringProgressContainer,
    formatTime
  };
}