import config from '../../../config.json';

export function setupSubtitles(player, subtitleBtn, subtitleMenu) {
  if (!subtitleBtn || !subtitleMenu) return;
  
  let currentSubtitleIndex = -1;
  let subtitles = [];

  // load subtitles from tracks data
  let subtitleData = null;
  let subtitleContainer = null;
  let subtitleUpdateInterval = null;
  
  const createSubtitleContainer = () => {
    if (subtitleContainer) return subtitleContainer;
    
    const container = document.createElement('div');
    container.className = 'subtitle-container absolute left-0 right-0 bottom-16 z-30 text-center';
    container.style.cssText = 'pointer-events: none;';
    player.parentNode.appendChild(container);
    
    return container;
  };
  
  const parseSubtitle = async (url) => {
    try {
      const response = await fetch(config.proxy, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          method: 'GET'
        })
      });
      
      const subtitleText = await response.text();
      
      if (typeof window.Subtitle === 'undefined') {
        return parseSubtitleManually(subtitleText);
      }
      
      return window.Subtitle.parse(subtitleText);
    } catch (error) {
      console.error('Error parsing subtitle:', error);
      return [];
    }
  };
  
  const parseSubtitleManually = (subtitleText) => {
    const cues = [];
    
    const isVTT = subtitleText.trim().startsWith('WEBVTT');
    const entries = subtitleText.split(/\r?\n\r?\n/);
    
    entries.forEach(entry => {
      if (!entry.trim()) return;
      
      if (isVTT && entry.trim() === 'WEBVTT') return;
      const lines = entry.split(/\r?\n/);
      if (lines.length < 2) return;
      
      const timingLineIndex = lines.findIndex(line => line.includes('-->'));
      if (timingLineIndex === -1) return;
      
      const timingLine = lines[timingLineIndex];
      const timeParts = timingLine.split('-->').map(t => t.trim());
      if (timeParts.length !== 2) return;
      
      const start = parseTimeToMs(timeParts[0]);
      const end = parseTimeToMs(timeParts[1]);
      
      if (isNaN(start) || isNaN(end)) return;
      
      const text = lines.slice(timingLineIndex + 1).join('\n');
      
      cues.push({ start, end, text });
    });
    
    return cues;
  };
  
  const parseTimeToMs = (timeString) => {
    timeString = timeString.replace(',', '.');
    timeString = timeString.split(' ')[0];
    
    const parts = timeString.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseFloat(parts[2]);
      
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseFloat(parts[1]);
      
      return (minutes * 60 + seconds) * 1000;
    }
    
    return NaN;
  };
  
  const updateSubtitle = (time) => {
    if (!subtitleData || !subtitleContainer) return;
    
    const currentTime = time * 1000;
    let text = '';
    
    for (const cue of subtitleData) {
      if (currentTime >= cue.start && currentTime <= cue.end) {
        text = cue.text;
        break;
      }
    }
    
    subtitleContainer.innerHTML = text ? `<p class="text-white text-xl font-normal px-4 py-2 inline-block font-['Inter'] backdrop-filter backdrop-blur-[10px] bg-[#00000069] rounded-lg">${text}</p>` : '';
  };
  
  const startSubtitleDisplay = async (subtitle) => {
    stopSubtitleDisplay();
    
    subtitleContainer = createSubtitleContainer();
    subtitleData = await parseSubtitle(subtitle.url);
    
    subtitleUpdateInterval = setInterval(() => {
      if (player && !player.paused) {
        updateSubtitle(player.currentTime);
      }
    }, 100);
    
    player.addEventListener('seeked', () => updateSubtitle(player.currentTime));
  };
  
  const stopSubtitleDisplay = () => {
    if (subtitleUpdateInterval) {
      clearInterval(subtitleUpdateInterval);
      subtitleUpdateInterval = null;
    }
    
    if (subtitleContainer) {
      subtitleContainer.innerHTML = '';
    }
    
    subtitleData = null;
  };
  
  const loadSubtitles = (tracks) => {
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      subtitleBtn.parentElement.classList.add('hidden');
      return [];
    }
    
    subtitles = tracks;
    renderSubtitleOptions();
    return tracks;
  };
  
  // render subtitle options in the menu
  const renderSubtitleOptions = () => {
    let subtitleOptionsHTML = `
      <button 
        class="subtitle-option min-w-[8rem] w-full text-left px-3 py-1.5 text-white text-sm hover:bg-zinc-700 rounded transition"
        data-index="-1"
      >
        Off
      </button>
    `;
    
    // Add all available subtitles
    subtitleOptionsHTML += subtitles.map((subtitle, index) => {
      return `
        <button 
          class="subtitle-option min-w-[8rem] w-full text-left px-3 py-1.5 text-white text-sm hover:bg-zinc-700 rounded transition"
          data-index="${index}"
          data-url="${subtitle.url}"
          data-lang="${subtitle.lang}"
        >
          ${subtitle.lang}
        </button>
      `;
    }).join('');
    
    subtitleMenu.innerHTML = subtitleOptionsHTML;
    setupSubtitleOptionEvents();
  };
  
  const setupSubtitleOptionEvents = () => {
    const options = subtitleMenu.querySelectorAll('.subtitle-option');
    options.forEach(option => {
      option.addEventListener('click', async () => {
        const index = parseInt(option.dataset.index);
        
        while (player.textTracks.length > 0) {
          const track = player.textTracks[0];
          if (track.mode) track.mode = 'disabled';
          player.removeChild(player.querySelector('track'));
        }
        
        stopSubtitleDisplay();
        
        if (index === -1) {
          currentSubtitleIndex = -1;
          subtitleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 25 20"><path transform="translate(-3 -6)" d="M25.5,6H5.5A2.507,2.507,0,0,0,3,8.5v15A2.507,2.507,0,0,0,5.5,26h20A2.507,2.507,0,0,0,28,23.5V8.5A2.507,2.507,0,0,0,25.5,6ZM5.5,16h5v2.5h-5ZM18,23.5H5.5V21H18Zm7.5,0h-5V21h5Zm0-5H13V16H25.5Z" fill="currentColor"></path></svg>';
          subtitleBtn.style.backgroundColor = '';
          subtitleBtn.style.color = '';
        } else {
          const subtitle = subtitles[index];
          currentSubtitleIndex = index;
          
          await startSubtitleDisplay(subtitle);
          
          subtitleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 25 20"><path transform="translate(-3 -6)" d="M25.5,6H5.5A2.507,2.507,0,0,0,3,8.5v15A2.507,2.507,0,0,0,5.5,26h20A2.507,2.507,0,0,0,28,23.5V8.5A2.507,2.507,0,0,0,25.5,6ZM5.5,16h5v2.5h-5ZM18,23.5H5.5V21H18Zm7.5,0h-5V21h5Zm0-5H13V16H25.5Z" fill="currentColor"></path></svg>';
          subtitleBtn.style.backgroundColor = '#fff';
          subtitleBtn.style.color = '#000';
        }
        
        subtitleMenu.classList.add('hidden');
      });
    });
  };
  
  subtitleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    subtitleMenu.classList.toggle('hidden');
  });
  
  document.addEventListener('click', (e) => {
    if (subtitleBtn && !subtitleBtn.contains(e.target) && !subtitleMenu.contains(e.target)) {
      subtitleMenu.classList.add('hidden');
    }
  });
  
  const cleanup = () => {
    stopSubtitleDisplay();
    if (subtitleContainer && subtitleContainer.parentNode) {
      subtitleContainer.parentNode.removeChild(subtitleContainer);
    }
  };
  
  return {
    loadSubtitles,
    renderSubtitleOptions,
    setupSubtitleOptionEvents,
    cleanup
  };
}