export class PlayerConfig {
  constructor(options = {}) {
    // Player settings
    this.autoplay = options.autoplay ?? false;
    this.crossOrigin = options.crossOrigin ?? 'anonymous';
    this.objectFit = options.objectFit ?? 'contain';
    
    // Feature toggles
    this.features = {
      qualitySelector: options.features?.qualitySelector ?? true,
      subtitles: options.features?.subtitles ?? true,
      download: options.features?.download ?? true,
      preview: options.features?.preview ?? true,
      skipButtons: options.features?.skipButtons ?? true,
      aspectToggle: options.features?.aspectToggle ?? true,
      pip: options.features?.pip ?? true,
      isM3U8: options.features?.isM3U8 ?? false
    };
    
    // Data
    this.showId = options.showId;
    this.episodeNumber = options.episodeNumber;
    this.mediaType = options.mediaType || 'tv';
    this.isNativeEmbed = options.isNativeEmbed ?? false;
    this.isIframeEmbed = options.isIframeEmbed ?? false;
    
    // Callbacks
    this.callbacks = {
      fetchVideoUrl: options.callbacks?.fetchVideoUrl || null,
      onQualityChange: options.callbacks?.onQualityChange || null,
      onError: options.callbacks?.onError || null
    };
    
    // Data sources
    this.subtitleTracks = options.subtitleTracks || [];
    this.qualityOptions = options.qualityOptions || [];
  }
}