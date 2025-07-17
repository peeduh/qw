export const formatTime = (time) => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

export const initializeHLS = async (videoUrl, videoRef, hlsRef, setError) => {
  if (!videoUrl || !videoRef.current) return;

  try {
    const Hls = (await import('hls.js')).default;
    
    if (Hls.isSupported()) {
      if (hlsRef.current) { hlsRef.current.destroy(); }

      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90 });
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Fatal error occurred during video playback');
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(videoUrl);
      hls.attachMedia(videoRef.current);
      
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoRef.current.src = videoUrl;
    } else {
      setError('HLS is not supported in this browser');
    }
  } catch (err) {
    console.error('Error loading HLS:', err);
    setError('Failed to initialize video player');
  }
};

export const setupVideoEventListeners = (videoRef, setCurrentTime, setDuration, setIsPlaying, setVolume, setIsMuted, setIsPictureInPicture, setBufferedAmount) => {
  const video = videoRef.current;
  if (!video) return null;

  const handleTimeUpdate = () => setCurrentTime(video.currentTime);
  const handleDurationChange = () => setDuration(video.duration);
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleVolumeChange = () => { setVolume(video.volume); setIsMuted(video.muted); };
  const handleEnterpictureinpicture = () => setIsPictureInPicture(true);
  const handleLeavepictureinpicture = () => setIsPictureInPicture(false);
  const handleProgress = () => {
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const duration = video.duration;
      if (duration > 0) { setBufferedAmount((bufferedEnd / duration) * 100); }
    }
  };

  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('durationchange', handleDurationChange);
  video.addEventListener('play', handlePlay);
  video.addEventListener('pause', handlePause);
  video.addEventListener('volumechange', handleVolumeChange);
  video.addEventListener('enterpictureinpicture', handleEnterpictureinpicture);
  video.addEventListener('leavepictureinpicture', handleLeavepictureinpicture);
  video.addEventListener('progress', handleProgress);

  return () => {
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('durationchange', handleDurationChange);
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('volumechange', handleVolumeChange);
    video.removeEventListener('enterpictureinpicture', handleEnterpictureinpicture);
    video.removeEventListener('leavepictureinpicture', handleLeavepictureinpicture);
    video.removeEventListener('progress', handleProgress);
  };
};

export const handleSeek = (e, videoRef, duration, progressBarRef) => {
  if (videoRef.current && duration && progressBarRef.current) {
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
  }
};

export const skipTime = (seconds, videoRef) => {
  if (videoRef.current) {
    videoRef.current.currentTime += seconds;
  }
};

export const togglePlay = (isPlaying, videoRef) => {
  if (videoRef.current) {
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }
};

export const toggleMute = (videoRef) => {
  if (videoRef.current) {
    videoRef.current.muted = !videoRef.current.muted;
  }
};

export const handleVolumeChange = (e, videoRef) => {
  const newVolume = parseFloat(e.target.value);
  if (videoRef.current) {
    videoRef.current.volume = newVolume;
    videoRef.current.muted = newVolume === 0;
  }
};

export const toggleFullscreen = (playerRef, setIsFullscreen) => {
  if (!document.fullscreenElement) {
    playerRef.current?.requestFullscreen();
    setIsFullscreen(true);
  } else {
    document.exitFullscreen();
    setIsFullscreen(false);
  }
};

export const togglePictureInPicture = (videoRef, isPictureInPicture) => {
  if (videoRef.current && document.pictureInPictureEnabled) {
    if (isPictureInPicture) {
      document.exitPictureInPicture();
    } else {
      videoRef.current.requestPictureInPicture();
    }
  }
};

export const showControlsTemporarily = (
  setShowControls,
  controlsTimeoutRef,
  isPlaying
) => {
  setShowControls(true);
  if (controlsTimeoutRef.current) {
    clearTimeout(controlsTimeoutRef.current);
  }
  controlsTimeoutRef.current = setTimeout(() => {
    if (isPlaying) {
      setShowControls(false);
    }
  }, 3000);
};