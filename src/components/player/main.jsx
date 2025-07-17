import React, { useEffect, useState, useRef } from 'react';
import PlayerTemplate from './template';
import { initializeHLS, setupVideoEventListeners, handleSeek, skipTime, togglePlay, toggleMute, handleVolumeChange, toggleFullscreen, togglePictureInPicture, showControlsTemporarily, parseTimeToSeconds, changePlaybackSpeed, changeQuality } from './helpers';

const VideoPlayer = ({ videoUrl, onError, showCaptionsPopup, setShowCaptionsPopup, subtitlesEnabled, subtitleError, subtitlesLoading, availableSubtitles, selectedSubtitle, onSelectSubtitle, subtitleCues }) => {
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
  
  // Subtitle state
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  
  // Settings state
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);

  // Initialize HLS when videoUrl changes
  useEffect(() => {
    if (videoUrl) {
      setQualitiesLoading(true);
      initializeHLS(videoUrl, videoRef, hlsRef, onError, setAvailableQualities);
      setQualitiesLoading(false);
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
    />
  );
};

export default VideoPlayer;