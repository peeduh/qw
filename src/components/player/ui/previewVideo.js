export function setupPreviewVideo(videoPreview, player, progressContainerHitbox, progressContainer, previewTime, qualityOptions, isNativeEmbed = false) {
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
  
  const getLowestQualityVideoLink = () => {
    const dataSource = qualityOptions; // pure laziness
    
    if (!dataSource || dataSource.length === 0) {
      console.log('No lowest quality found');
      return null;
    }
    
     const qualityOptionsWithResolution = dataSource.filter(option => {
       const name = option.name ? option.name.toLowerCase() : '';
       return name !== 'auto' && (/\d+p/.test(name) || name.includes('144p'));
     });
    
    if (qualityOptionsWithResolution.length === 0) {
      console.log('No lowest quality found');
      return null;
    }
    
    // Sort by resolution number (ascending to get lowest first)
    const sortedOptions = qualityOptionsWithResolution.sort((a, b) => {
      const resA = parseInt(a.name.match(/\d+/)?.[0]) || 0;
      const resB = parseInt(b.name.match(/\d+/)?.[0]) || 0;
      return resA - resB;
    });
    
    const lowestQuality = sortedOptions[0];
    
    if (isNativeEmbed) {
      return lowestQuality.url || null;
    } else {
      // For animepahe and zenime embeds
      return lowestQuality.url || lowestQuality.link || null;
    }
  };
  
  const loadPreviewVideo = async () => {
    try {
      const videoSource = getLowestQualityVideoLink();
      if (!videoSource) return;
      
      if (isNativeEmbed) {
        previewVideo.src = videoSource;
        previewVideo.addEventListener('loadedmetadata', () => {
          previewReady = true;
        });
      } else if (qualityOptions.fetchVideoUrlCallback) {
        console.log(videoSource)
        const fetchVideoUrlCallback = qualityOptions.fetchVideoUrlCallback

        if (videoSource.includes('kwik.si')) {
          const previewVideoUrl = await fetchVideoUrlCallback(videoSource);
          if (previewVideoUrl) {
            previewVideo.src = previewVideoUrl;
            previewVideo.addEventListener('loadedmetadata', () => {
              previewReady = true;
            });
          } else {
            console.error('Failed to fetch preview video URL from kwik.cx');
          }
        } else {
          // For other URLs, try the callback first, fallback to direct URL
          const previewVideoUrl = await fetchVideoUrlCallback(videoSource);
          if (previewVideoUrl) {
            previewVideo.src = previewVideoUrl;
            previewVideo.addEventListener('loadedmetadata', () => {
              previewReady = true;
            });
          } else {
            // Fallback to direct URL if callback fails
            previewVideo.src = videoSource;
            previewVideo.addEventListener('loadedmetadata', () => {
              previewReady = true;
            });
          }
        }
      } else {
        // No callback available, use direct URL
        previewVideo.src = videoSource;
        previewVideo.addEventListener('loadedmetadata', () => {
          previewReady = true;
        });
      }
    } catch (error) {
      console.error('Error loading preview video:', error);
    }
  };

  console.log(qualityOptions);
    
  if ((qualityOptions && qualityOptions.length > 0)) {
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