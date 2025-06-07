export function generatePlayerHTML(config) {
  const isIPhone = /iPhone/i.test(navigator.userAgent);
  const hasQualityOptions = config.qualityOptions.length > 0;
  
  // Generate video or iframe element based on embed type
  const mediaElement = config.isIframeEmbed ? 
    `<iframe 
      id="custom-player" 
      class="w-full h-full border-none" 
      allowfullscreen
      src="${config.qualityOptions.length > 0 ? config.qualityOptions[0].url : ''}"
    ></iframe>` :
    `<video 
      id="custom-player"
      class="w-full h-full" 
      style="object-fit: ${config.objectFit}; object-position: center"
      ${config.autoplay ? 'autoplay' : ''}
      ${config.crossOrigin ? `crossorigin="${config.crossOrigin}"` : ''}
      x-webkit-airplay="allow"
      preload="metadata"
    ></video>`;
  
  return `
    <div class="custom-player relative w-full h-full bg-black overflow-hidden group">
      ${mediaElement}

      ${config.features.centerPlayButton ? `
      <div class="center-play-button absolute inset-0 flex items-center justify-center z-10 ${isIPhone ? 'hidden' : 'hidden'}">
        <button class="w-16 h-16 bg-text-primary bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all duration-200 transform hover:scale-110">
          <i class="fas fa-play text-black text-2xl ml-[2.5px]"></i>
        </button>
      </div>
      ` : ''}

      <div class="top-controls absolute top-4 right-4 flex space-x-2 z-[30]">
        ${config.features.subtitles && isIPhone ? `
        <button class="subtitle-toggle-btn bg-black bg-opacity-50 hover:bg-opacity-70 text-text-primary p-2 rounded-full transition-opacity duration-300 opacity-0 w-8 h-8 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 25 20"><path transform="translate(-3 -6)" d="M25.5,6H5.5A2.507,2.507,0,0,0,3,8.5v15A2.507,2.507,0,0,0,5.5,26h20A2.507,2.507,0,0,0,28,23.5V8.5A2.507,2.507,0,0,0,25.5,6ZM5.5,16h5v2.5h-5ZM18,23.5H5.5V21H18Zm7.5,0h-5V21h5Zm0-5H13V16H25.5Z" fill="currentColor"></path></svg>
        </button>
        <div class="iphone-subtitle-menu absolute top-10 right-0 bg-zinc-900 rounded shadow-lg p-2 hidden z-30">
        </div>
        ` : ''}
        ${config.features.aspectToggle ? `
        <button class="aspect-toggle-btn bg-black bg-opacity-50 hover:bg-opacity-70 text-text-primary p-2 rounded-full transition-opacity duration-300 opacity-0 w-8 h-8 flex items-center justify-center">
          <i class="icon-shrink"></i>
        </button>
        ` : ''}
      </div>
      
      ${config.features.preview ? `
      <div class="video-preview hidden opacity-0 absolute bg-black rounded-lg shadow-lg z-[30] transition-opacity duration-300 pointer-events-none" style="width: 160px; height:80px; transform: translateX(-50%) translateY(-100%) translateY(-10px); bottom: 50px;">
        <canvas id="preview-canvas" width="160" height="90"></canvas>
        <div class="preview-time text-text-primary text-xs text-center py-1 bottom-0 absolute w-full rounded-b-lg" style="filter: drop-shadow(0 2px 1px black) drop-shadow(0 2px 6px black) drop-shadow(0 0 6px black)"></div>
      </div>
      ` : ''}
      
      <div class="player-controls flex items-end justify-center width-full h-full absolute bottom-0 left-0 right-0 bg-opacity-100 px-4 pb-4 transition-opacity duration-300 z-[20] ${isIPhone ? 'hidden' : 'opacity-0'}" style="background: linear-gradient(to top, rgb(0 0 0 / 84%) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0) 80%, rgb(0 0 0 / 60%) 100%)">
        <div class="w-full">
          <div class="progress-container-hitbox flex-grow cursor-pointer relative mx-2 py-2.5 mb-3">
              <div class="progress-container w-full h-[6px] bg-progress-bar-bg rounded-full relative">
                <div class="buffer-bar h-full bg-progress-buffer rounded-full" style="width: 0%"></div>
                <div class="progress-bar h-full bg-text-primary rounded-full mt-[-6px]" style="width: 0%"></div>
                <div class="progress-thumb absolute w-4 h-4 bg-text-primary rounded-full mt-[-10px] hidden shadow-md" style="left: 0%"></div>
              </div>
          </div>

          <div class="flex flex-row items-center justify-between mx-4">
            <div class="flex flex-row items-center gap-1">
              <button onkeydown="if (event.key === ' ') event.preventDefault();" class="play-pause-btn text-text-primary transition text-2xl mr-3">
                <i class="fas fa-play"></i>
              </button>

              ${config.features.skipButtons ? `
              <button class="back-10s text-text-primary transition text-3xl mr-3 p-[0.45rem]">
                <svg width="1em" height="1em" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.6667 12.3333L9 7.66667M9 7.66667L13.6667 3M9 7.66667H18.3333C19.571 7.66667 20.758 8.15833 21.6332 9.0335C22.5083 9.90867 23 11.0957 23 12.3333C23 13.571 22.5083 14.758 21.6332 15.6332C20.758 16.5083 19.571 17 18.3333 17H16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4.50426 14.2727V23H2.65909V16.0241H2.60795L0.609375 17.277V15.6406L2.76989 14.2727H4.50426ZM10.0004 23.1918C9.2674 23.1889 8.63672 23.0085 8.10831 22.6506C7.58274 22.2926 7.17791 21.7741 6.89382 21.0952C6.61257 20.4162 6.47337 19.5994 6.47621 18.6449C6.47621 17.6932 6.61683 16.8821 6.89808 16.2116C7.18217 15.5412 7.587 15.0312 8.11257 14.6818C8.64098 14.3295 9.27024 14.1534 10.0004 14.1534C10.7305 14.1534 11.3583 14.3295 11.8839 14.6818C12.4123 15.0341 12.8185 15.5455 13.1026 16.2159C13.3867 16.8835 13.5273 17.6932 13.5245 18.6449C13.5245 19.6023 13.3825 20.4205 13.0984 21.0994C12.8171 21.7784 12.4137 22.2969 11.8881 22.6548C11.3626 23.0128 10.7333 23.1918 10.0004 23.1918ZM10.0004 21.6619C10.5004 21.6619 10.8995 21.4105 11.1978 20.9077C11.4961 20.4048 11.6438 19.6506 11.641 18.6449C11.641 17.983 11.5728 17.4318 11.4364 16.9915C11.3029 16.5511 11.1126 16.2202 10.8654 15.9986C10.6211 15.777 10.3327 15.6662 10.0004 15.6662C9.5032 15.6662 9.10547 15.9148 8.80717 16.4119C8.50888 16.9091 8.35831 17.6534 8.35547 18.6449C8.35547 19.3153 8.42223 19.875 8.55575 20.3239C8.69212 20.7699 8.88388 21.1051 9.13104 21.3295C9.3782 21.5511 9.66797 21.6619 10.0004 21.6619Z" fill="currentColor"></path></svg>
              </button>

              <button class="forwards-10s text-text-primary transition text-3xl mr-3 p-[0.45rem]">
                <svg width="1em" height="1em" viewBox="0 0 26 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.3333 12.3333L16 7.66667M16 7.66667L11.3333 3M16 7.66667H6.66667C5.42899 7.66667 4.242 8.15833 3.36684 9.0335C2.49167 9.90867 2 11.0957 2 12.3333C2 13.571 2.49167 14.758 3.36684 15.6332C4.242 16.5083 5.42899 17 6.66667 17H9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16.5043 14.2727V23H14.6591V16.0241H14.608L12.6094 17.277V15.6406L14.7699 14.2727H16.5043ZM22.0004 23.1918C21.2674 23.1889 20.6367 23.0085 20.1083 22.6506C19.5827 22.2926 19.1779 21.7741 18.8938 21.0952C18.6126 20.4162 18.4734 19.5994 18.4762 18.6449C18.4762 17.6932 18.6168 16.8821 18.8981 16.2116C19.1822 15.5412 19.587 15.0312 20.1126 14.6818C20.641 14.3295 21.2702 14.1534 22.0004 14.1534C22.7305 14.1534 23.3583 14.3295 23.8839 14.6818C24.4123 15.0341 24.8185 15.5455 25.1026 16.2159C25.3867 16.8835 25.5273 17.6932 25.5245 18.6449C25.5245 19.6023 25.3825 20.4205 25.0984 21.0994C24.8171 21.7784 24.4137 22.2969 23.8881 22.6548C23.3626 23.0128 22.7333 23.1918 22.0004 23.1918ZM22.0004 21.6619C22.5004 21.6619 22.8995 21.4105 23.1978 20.9077C23.4961 20.4048 23.6438 19.6506 23.641 18.6449C23.641 17.983 23.5728 17.4318 23.4364 16.9915C23.3029 16.5511 23.1126 16.2202 22.8654 15.9986C22.6211 15.777 22.3327 15.6662 22.0004 15.6662C21.5032 15.6662 21.1055 15.9148 20.8072 16.4119C20.5089 16.9091 20.3583 17.6534 20.3555 18.6449C20.3555 19.3153 20.4222 19.875 20.5558 20.3239C20.6921 20.7699 20.8839 21.1051 21.131 21.3295C21.3782 21.5511 21.668 21.6619 22.0004 21.6619Z" fill="currentColor"></path></svg>
              </button>
              ` : ''}

              <div class="volume-container relative flex items-center">
                <button class="volume-btn text-text-primary transition text-3xl">
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 640 512"><path fill="currentColor" d="M473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"></path></svg>
                </button>
                <div class="volume-slider h-[6px] bg-zinc-800 rounded-full cursor-pointer hidden transition-all duration-300" style="width: 0">
                  <div class="volume-level h-full bg-text-primary rounded-full" style="width: 100%"></div>
                </div>
              </div>

              <div class="time-display text-text-primary text-lg font-medium cursor-pointer select-none min-w-[40px] !ml-3">
                <span class="current-time">0:00</span>
              </div>
            </div>

            <div class="flex-grow"></div>
            
            <div class="flex flex-row items-center gap-1">
              <div class="settings-selector relative mr-2">
                <button class="settings-btn text-text-primary transition text-3xl">
                  <svg fill="currentColor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1em" height="1em" viewBox="0 0 48.4 48.4" xml:space="preserve"><g><path d="M48.4,24.2c0-1.8-1.297-3.719-2.896-4.285s-3.149-1.952-3.6-3.045c-0.451-1.093-0.334-3.173,0.396-4.705 c0.729-1.532,0.287-3.807-0.986-5.08c-1.272-1.273-3.547-1.714-5.08-0.985c-1.532,0.729-3.609,0.848-4.699,0.397 s-2.477-2.003-3.045-3.602C27.921,1.296,26,0,24.2,0c-1.8,0-3.721,1.296-4.29,2.895c-0.569,1.599-1.955,3.151-3.045,3.602 c-1.09,0.451-3.168,0.332-4.7-0.397c-1.532-0.729-3.807-0.288-5.08,0.985c-1.273,1.273-1.714,3.547-0.985,5.08 c0.729,1.533,0.845,3.611,0.392,4.703c-0.453,1.092-1.998,2.481-3.597,3.047S0,22.4,0,24.2s1.296,3.721,2.895,4.29 c1.599,0.568,3.146,1.957,3.599,3.047c0.453,1.089,0.335,3.166-0.394,4.698s-0.288,3.807,0.985,5.08 c1.273,1.272,3.547,1.714,5.08,0.985c1.533-0.729,3.61-0.847,4.7-0.395c1.091,0.452,2.476,2.008,3.045,3.604 c0.569,1.596,2.49,2.891,4.29,2.891c1.8,0,3.721-1.295,4.29-2.891c0.568-1.596,1.953-3.15,3.043-3.604 c1.09-0.453,3.17-0.334,4.701,0.396c1.533,0.729,3.808,0.287,5.08-0.985c1.273-1.273,1.715-3.548,0.986-5.08 c-0.729-1.533-0.849-3.61-0.398-4.7c0.451-1.09,2.004-2.477,3.603-3.045C47.104,27.921,48.4,26,48.4,24.2z M24.2,33.08 c-4.91,0-8.88-3.97-8.88-8.87c0-4.91,3.97-8.88,8.88-8.88c4.899,0,8.87,3.97,8.87,8.88C33.07,29.11,29.1,33.08,24.2,33.08z"></path></g></svg>
                </button>
                <div class="settings-menu absolute bottom-12 right-0 bg-zinc-900 rounded shadow-lg opacity-0 pointer-events-none transition-all duration-200 z-40 overflow-x-hidden max-h-80">
                </div>
              </div>
              
              ${config.features.download ? `
              <button class="download-btn text-text-primary transition text-3xl mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              </button>
              ` : ''}
              
              ${config.features.pip ? `
              <button class="pip-btn text-text-primary transition text-3xl mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-picture-in-picture-2"><path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4"/><rect width="10" height="7" x="12" y="13" rx="2"/></svg>
              </button>
              ` : ''}
              
              <button class="fullscreen-btn text-text-primary transition text-3xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      ${isIPhone ? `
      <div class="iphone-quality-menu absolute bottom-16 right-4 bg-zinc-900 rounded shadow-lg p-2 hidden z-30">
      </div>
      ` : ''}
    </div>
  `;
}