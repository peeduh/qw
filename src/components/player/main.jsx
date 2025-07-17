import React, { useEffect, useState, useRef } from 'react';
import PlayerTemplate from './template';
import { initializeHLS, setupVideoEventListeners, handleSeek, skipTime, togglePlay, toggleMute, handleVolumeChange, toggleFullscreen, togglePictureInPicture, showControlsTemporarily, parseTimeToSeconds, changePlaybackSpeed, changeQuality } from './helpers';
import { saveProgress, getProgress } from '../progress';

const VideoPlayer = ({ videoUrl, onError, showCaptionsPopup, setShowCaptionsPopup, subtitlesEnabled, subtitleError, subtitlesLoading, availableSubtitles, selectedSubtitle, onSelectSubtitle, subtitleCues, mediaId, mediaType, season = 0, episode = 0, sourceIndex = 0 }) => {
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bufferedAmount, setBufferedAmount] = useState(0);
  const [isProgressHovered, setIsProgressHovered] = useState(false);
  
  // Volume slider state
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  
  // Subtitle state
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  
  // Settings state
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);
  
  // Progress tracking state
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);
  
  // Refs
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);
  const progressSaveTimeoutRef = useRef(null);
  const volumeTimeoutRef = useRef(null);
  const volumeSliderRef = useRef(null);

  useEffect(() => {
    if (mediaId && mediaType) {
      const existingProgress = getProgress(parseInt(mediaId), mediaType, parseInt(season), parseInt(episode));
      setSavedProgress(existingProgress);
      setProgressLoaded(false);
      console.log('Loaded saved progress:', existingProgress);
    }
  }, [mediaId, mediaType, season, episode]);

  useEffect(() => {
    if (!progressLoaded && savedProgress && savedProgress.watchedDuration > 0 && videoRef.current) {
      const restorePosition = () => {
        if (videoRef.current && videoRef.current.duration > 0 && videoRef.current.readyState >= 2) {
          const targetTime = savedProgress.watchedDuration;
          console.log(`Restoring video position to: ${targetTime} seconds`);
          videoRef.current.currentTime = targetTime;
          setProgressLoaded(true);
          
          // Remove all event listeners
          videoRef.current.removeEventListener('loadedmetadata', restorePosition);
          videoRef.current.removeEventListener('loadeddata', restorePosition);
          videoRef.current.removeEventListener('canplay', restorePosition);
          videoRef.current.removeEventListener('canplaythrough', restorePosition);
        }
      };

      // Try to restore immediately if video is already ready
      if (videoRef.current.duration > 0 && videoRef.current.readyState >= 2) {
        restorePosition();
      } else {
        // Add multiple event listeners to catch when video becomes ready
        videoRef.current.addEventListener('loadedmetadata', restorePosition);
        videoRef.current.addEventListener('loadeddata', restorePosition);
        videoRef.current.addEventListener('canplay', restorePosition);
        videoRef.current.addEventListener('canplaythrough', restorePosition);
      }

      // Cleanup function
      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', restorePosition);
          videoRef.current.removeEventListener('loadeddata', restorePosition);
          videoRef.current.removeEventListener('canplay', restorePosition);
          videoRef.current.removeEventListener('canplaythrough', restorePosition);
        }
      };
    } else if (!savedProgress || savedProgress.watchedDuration <= 0) {
      setProgressLoaded(true);
    }
  }, [savedProgress, progressLoaded, videoUrl]);

  // Save progress periodically
  useEffect(() => {
    if (mediaId && mediaType && currentTime > 0 && duration > 0 && progressLoaded) {
      // Clear existing timeout
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }
      
      // Save progress after 2 seconds of no time updates
      progressSaveTimeoutRef.current = setTimeout(() => {
        saveProgress({
          id: parseInt(mediaId),
          mediaType: mediaType,
          season: parseInt(season),
          episode: parseInt(episode),
          sourceIndex: parseInt(sourceIndex),
          fullDuration: Math.floor(duration),
          watchedDuration: Math.floor(currentTime),
          timestamp: Date.now()
        });
      }, 2000);
    }
    
    return () => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }
    };
  }, [currentTime, duration, mediaId, mediaType, season, episode, sourceIndex, progressLoaded]);

  // Save progress when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (mediaId && mediaType && currentTime > 0 && duration > 0) {
        saveProgress({
          id: parseInt(mediaId),
          mediaType: mediaType,
          season: parseInt(season),
          episode: parseInt(episode),
          sourceIndex: parseInt(sourceIndex),
          fullDuration: Math.floor(duration),
          watchedDuration: Math.floor(currentTime),
          timestamp: Date.now()
        });
      }
    };
  }, [videoUrl, mediaId, mediaType, season, episode, sourceIndex]);

  // Initialize HLS when videoUrl changes
  useEffect(() => {
    if (videoUrl) {
      setQualitiesLoading(true);
      initializeHLS(videoUrl, videoRef, hlsRef, onError, setAvailableQualities);
      setQualitiesLoading(false);
      setProgressLoaded(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl, onError]);

  useEffect(() => {
    return setupVideoEventListeners(videoRef, setCurrentTime, setDuration, setIsPlaying, setVolume, setIsMuted, setIsPictureInPicture, setBufferedAmount);
  }, [videoUrl]);

  useEffect(() => {
    if (availableQualities.length > 0 && !selectedQuality) {
      setSelectedQuality(availableQualities[0]);
    }
  }, [availableQualities, selectedQuality]);

  useEffect(() => {
    if (!subtitlesEnabled || !selectedSubtitle || !subtitleCues || subtitleCues.length === 0) {
      setCurrentSubtitleText('');
      return;
    }

    const currentCue = subtitleCues.find(cue => {
      const startTime = parseTimeToSeconds(cue.startTime);
      const endTime = parseTimeToSeconds(cue.endTime);
      return currentTime >= startTime && currentTime <= endTime;
    });

    setCurrentSubtitleText(currentCue ? currentCue.text : '');
  }, [currentTime, subtitlesEnabled, selectedSubtitle, subtitleCues]);

  // Handle progress bar dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e) => {
        if (isDragging) { handleSeek(e, videoRef, duration, progressBarRef) };
      };
      const handleGlobalMouseUp = () => setIsDragging(false);

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, duration]);

  // Handle volume slider dragging
  useEffect(() => {
    if (isVolumeDragging) {
      const handleGlobalMouseMove = (e) => {
        if (isVolumeDragging) { handleVolumeSliderSeek(e) };
      };
      const handleGlobalMouseUp = () => setIsVolumeDragging(false);

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isVolumeDragging]);

  // Volume slider timeout management
  const showVolumeSliderTemporarily = () => {
    setShowVolumeSlider(true);
    
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 5000);
  };

  const handleVolumeMouseEnter = () => {
    showVolumeSliderTemporarily();
  };

  const handleVolumeMouseLeave = () => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 300);
  };

  const handleVolumeSliderMouseEnter = () => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    setShowVolumeSlider(true);
    setIsVolumeHovered(true);
  };

  const handleVolumeSliderMouseLeave = () => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 300);
    setIsVolumeHovered(false);
  };

  // Event handlers
  const handleMouseMove = () => {
    showControlsTemporarily(setShowControls, controlsTimeoutRef, isPlaying);
  };

  const handleTogglePlay = () => {
    togglePlay(isPlaying, videoRef);
  };

  const handleProgressMouseDown = (e) => {
    setIsDragging(true);
    handleSeek(e, videoRef, duration, progressBarRef);
    e.preventDefault();
  };

  const handleProgressMouseEnter = () => {
    setIsProgressHovered(true);
  };

  const handleProgressMouseLeave = () => {
    setIsProgressHovered(false);
  };

  const handleSkipTime = (seconds) => {
    skipTime(seconds, videoRef);
  };

  const handleToggleMute = () => {
    toggleMute(videoRef);
  };

  const handleVolumeChangeEvent = (e) => {
    handleVolumeChange(e, videoRef);
  };

  const handleVolumeSliderMouseDown = (e) => {
    setIsVolumeDragging(true);
    handleVolumeSliderSeek(e);
    e.preventDefault();
  };

  const handleVolumeSliderSeek = (e) => {
    if (volumeSliderRef.current && videoRef.current) {
      const rect = volumeSliderRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.volume = pos;
      videoRef.current.muted = pos === 0;
    }
  };

  const handleToggleFullscreen = () => {
    toggleFullscreen(playerRef, setIsFullscreen);
  };

  const handleTogglePictureInPicture = () => {
    togglePictureInPicture(videoRef, isPictureInPicture);
  };

  const handleSelectSubtitle = (subtitle) => {
    onSelectSubtitle(subtitle, videoRef);
  };

  const handleVideoError = (e) => {
    console.error('Video playback error:', e);
    onError('Video playback failed. Please try again.');
  };

  // Settings handlers
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    changePlaybackSpeed(speed, videoRef);
  };

  const handleQualityChange = (quality) => {
    setSelectedQuality(quality);
    changeQuality(quality, hlsRef, videoRef, currentTime);
  };

  return (
    <PlayerTemplate
      // Video refs
      videoRef={videoRef}
      playerRef={playerRef}
      progressBarRef={progressBarRef}
      
      // Video state
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      isMuted={isMuted}
      bufferedAmount={bufferedAmount}
      isProgressHovered={isProgressHovered}
      isDragging={isDragging}
      showControls={showControls}
      isFullscreen={isFullscreen}
      isPictureInPicture={isPictureInPicture}
      
      // Volume slider state
      showVolumeSlider={showVolumeSlider}
      isVolumeDragging={isVolumeDragging}
      isVolumeHovered={isVolumeHovered}
      volumeSliderRef={volumeSliderRef}
      
      // Subtitle state
      showCaptionsPopup={showCaptionsPopup}
      setShowCaptionsPopup={setShowCaptionsPopup}
      subtitlesEnabled={subtitlesEnabled}
      subtitleError={subtitleError}
      subtitlesLoading={subtitlesLoading}
      availableSubtitles={availableSubtitles}
      selectedSubtitle={selectedSubtitle}
      currentSubtitleText={currentSubtitleText}
      
      // Settings state
      showSettingsPopup={showSettingsPopup}
      setShowSettingsPopup={setShowSettingsPopup}
      playbackSpeed={playbackSpeed}
      availableQualities={availableQualities}
      selectedQuality={selectedQuality}
      qualitiesLoading={qualitiesLoading}
      
      // Event handlers
      onMouseMove={handleMouseMove}
      onTogglePlay={handleTogglePlay}
      onProgressMouseDown={handleProgressMouseDown}
      onProgressMouseEnter={handleProgressMouseEnter}
      onProgressMouseLeave={handleProgressMouseLeave}
      onSkipTime={handleSkipTime}
      onToggleMute={handleToggleMute}
      onVolumeChange={handleVolumeChangeEvent}
      onToggleFullscreen={handleToggleFullscreen}
      onTogglePictureInPicture={handleTogglePictureInPicture}
      onSelectSubtitle={handleSelectSubtitle}
      onVideoError={handleVideoError}
      onSpeedChange={handleSpeedChange}
      onQualityChange={handleQualityChange}
      
      // Volume slider handlers
      onVolumeMouseEnter={handleVolumeMouseEnter}
      onVolumeMouseLeave={handleVolumeMouseLeave}
      onVolumeSliderMouseEnter={handleVolumeSliderMouseEnter}
      onVolumeSliderMouseLeave={handleVolumeSliderMouseLeave}
      onVolumeSliderMouseDown={handleVolumeSliderMouseDown}
      onVolumeSliderHoverEnter={handleVolumeSliderMouseEnter}
      onVolumeSliderHoverLeave={handleVolumeSliderMouseLeave}
    />
  );
};

export default VideoPlayer;