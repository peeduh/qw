import React from 'react';
import { PlaySolid, PauseSolid, SoundOffSolid, SoundLowSolid, SoundHighSolid, Expand, Collapse } from 'iconoir-react';
import SubtitleManager from './subtitles';
import { formatTime } from './helpers';

const ControlButton = ({ onClick, children, className = "", ...props }) => {
  const baseClasses = "border-none cursor-pointer p-2 rounded-lg flex items-center justify-center transition-all duration-200 ease-in-out w-[46px] h-[46px] relative overflow-hidden";
  const defaultClasses = "bg-transparent text-white hover:bg-white/10 hover:scale-110 active:bg-white/20 active:scale-95";
  
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${className || defaultClasses}`}
      {...props}
    >
      {children}
    </button>
  );
};

const PlayerTemplate = ({
  // Video refs
  videoRef,
  playerRef,
  progressBarRef,
  
  // Video state
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  bufferedAmount,
  isProgressHovered,
  isDragging,
  showControls,
  isFullscreen,
  isPictureInPicture,
  
  // Subtitle state
  showCaptionsPopup,
  setShowCaptionsPopup,
  subtitlesEnabled,
  subtitleError,
  subtitlesLoading,
  availableSubtitles,
  selectedSubtitle,
  
  // Event handlers
  onMouseMove,
  onTogglePlay,
  onProgressMouseDown,
  onProgressMouseEnter,
  onProgressMouseLeave,
  onSkipTime,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onTogglePictureInPicture,
  onSelectSubtitle,
  onVideoError
}) => {
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) { return <SoundOffSolid width="24" height="24" />; }
    else if (volume < 0.7) { return <SoundLowSolid width="24" height="24" />; }
    else { return <SoundHighSolid width="24" height="24" />; }
  };

  return (
    <div ref={playerRef} className={`fixed top-0 left-0 w-screen h-screen bg-black ${showControls ? 'cursor-default' : 'cursor-none'}`} onMouseMove={onMouseMove} onClick={onTogglePlay}>
      <video ref={videoRef} className="w-full h-full object-contain" onError={onVideoError}/>
      
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10 px-5 pb-5 transition-opacity duration-300 ease-in-out ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
        <div ref={progressBarRef} className="relative w-full h-1 bg-white/30 rounded-sm mb-4 cursor-pointer group" onMouseDown={onProgressMouseDown} onMouseEnter={onProgressMouseEnter} onMouseLeave={onProgressMouseLeave}>
          <div 
            className="absolute top-0 left-0 h-full bg-white/50 rounded-sm transition-all duration-200"
            style={{ width: `${bufferedAmount}%` }}
          />
          
          <div 
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-sm"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
          
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-lg transition-all ${isProgressHovered || isDragging ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
            style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 8px)` }}
          />
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ControlButton onClick={onTogglePlay}>
              {isPlaying ? (<PauseSolid width="28" height="28" />
              ) : (<PlaySolid width="28" height="28" />)}
            </ControlButton>

            <ControlButton onClick={() => onSkipTime(-10)}>
              <img src="/icons/back10.svg" alt="Back 10 seconds" className="w-6 h-6 select-none"/>
            </ControlButton>

            <ControlButton onClick={() => onSkipTime(10)}>
              <img src="/icons/forwards10.svg" alt="Forward 10 seconds" className="w-6 h-6 select-none"/>
            </ControlButton>

            <div className="flex items-center gap-2">
              <ControlButton onClick={onToggleMute}>{getVolumeIcon()}</ControlButton>
              <input type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} onChange={onVolumeChange} className="w-20 h-1 bg-white/30 outline-none rounded-sm"/>
            </div>

            <span className="text-sm text-white min-w-[140px] select-none">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-2">
            <ControlButton 
              onClick={onTogglePictureInPicture}
              className={isPictureInPicture 
                ? "bg-white text-black hover:bg-gray-200 hover:scale-110 active:bg-gray-300 active:scale-95" 
                : "bg-transparent text-white hover:bg-white/10 hover:scale-110 active:bg-white/20 active:scale-95"
              }
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4"/>
                <rect width="10" height="7" x="12" y="13" rx="2"/>
              </svg>
            </ControlButton>

            <SubtitleManager
              showCaptionsPopup={showCaptionsPopup}
              setShowCaptionsPopup={setShowCaptionsPopup}
              subtitlesEnabled={subtitlesEnabled}
              subtitleError={subtitleError}
              subtitlesLoading={subtitlesLoading}
              availableSubtitles={availableSubtitles}
              selectedSubtitle={selectedSubtitle}
              selectSubtitle={onSelectSubtitle}
            />

            <ControlButton onClick={() => {}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
              </svg>
            </ControlButton>

            <ControlButton onClick={onToggleFullscreen}>
              {isFullscreen ? (
                <Collapse width="24" height="24" />
              ) : (
                <Expand width="24" height="24" />
              )}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerTemplate;