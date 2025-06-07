// Native Embed Page
import { renderFullPageSpinner, renderSpinner } from '../../components/misc/loading.js';
import { renderError } from '../../components/misc/error.js';
import { initializePlayer } from '../../components/player/index.js';
import { PlayerConfig } from '../../components/player/config.js'; // Import from config.js instead
import { fetchVidSrcContent } from '../../components/player/videoUtils.js';

export async function renderNativeEmbed(container, params) {
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
    await loadVideoContent(id, episode, season, type, container);
  } catch (error) {
    console.error('Error loading video content:', error);
    container.innerHTML = renderError(
      'Error',
      error.message || 'Failed to load video content',
      '',
      '',
      false
    );
    
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
  }
}

async function loadVideoContent(id, episode, season, type, container) {
  const detailsStep = window.splashScreen?.addStep('Loading media details...');
  
  window.splashScreen?.completeStep(detailsStep);
  const streamStep = window.splashScreen?.addStep('Fetching streaming source...');
  
  try {
    const streamData = await fetchVidSrcContent(id, episode, season, type);
    window.splashScreen?.completeStep(streamStep);
    
    const playerContainer = container.querySelector('#player-container');
    if (playerContainer) {
      const videoStep = window.splashScreen?.addStep('Preparing video player...');
      
      try {
        const videoUrl = streamData.url;
        const subtitleTracks = streamData.tracks || [];
        const hasMultiQuality = streamData.hasMultiQuality === true;
        const qualityOptions = streamData.quality || [];

        const enhancedQualityOptions = qualityOptions.map(option => ({
          name: option.quality,
          url: option.url
        }));
        
        window.splashScreen?.completeStep(videoStep);
        if (window.splashScreen) {
          window.splashScreen.hide();
        }
        
        if (videoUrl) {
          // Configure player for native embed
          const config = new PlayerConfig({
            showId: id,
            episodeNumber: episode,
            mediaType: type === 'movie' ? 'movie' : 'tv',
            isNativeEmbed: true,
            autoplay: true,
            subtitleTracks,
            qualityOptions: enhancedQualityOptions || [],
            features: {
              qualitySelector: true, // Always enable quality selector
              subtitles: true, // Always enable subtitles
              download: true,
              preview: true,
              skipButtons: true,
              aspectToggle: true,
              pip: true
            }
          });
          
          // Set initial video source
          playerContainer.innerHTML = '';
          const playerInstance = await initializePlayer(playerContainer, config);
          
          if (playerInstance) {
            playerInstance.player.src = videoUrl;
          }
        } else {
          playerContainer.innerHTML = `
            <div class="flex justify-center items-center h-full">
              <p class="text-text-primary text-xl">Failed to load video. Please try another source.</p>
            </div>
          `;
        }
      } catch (error) {
        window.splashScreen?.completeStep(videoStep);
        if (window.splashScreen) {
          window.splashScreen.hide();
        }
        
        console.error('Error preparing video player:', error);
        playerContainer.innerHTML = `
          <div class="flex justify-center items-center h-full">
            <p class="text-text-primary text-xl">Failed to load video. Please try another source.</p>
          </div>
        `;
      }
    }
  } catch (error) {
    window.splashScreen?.completeStep(streamStep);
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
    throw error;
  }
}