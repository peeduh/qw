import React, { useState, useEffect, useRef } from 'react';
import { X, Tv, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSource } from './Sources.jsx';
import { initializeSourceTracking } from '../../components/progress/index.jsx';
import { fetchTmdb } from '../../utils.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

const Watch = ({ isOpen, onClose, onUpdateUrl, mediaType, tmdbId, season = 1, episode = 1, title, episodes = [], seasons = [], selectedSeason = null }) => {
  const [currentSource, setCurrentSource] = useState('VidLink');
  const [currentEpisode, setCurrentEpisode] = useState(episode);
  const [currentSeason, setCurrentSeason] = useState(season);
  const [currentSeasonDetails, setCurrentSeasonDetails] = useState(null);
  const [id, setId] = useState(tmdbId);
  const [currentTitle, setCurrentTitle] = useState(title);

  const iframeRef = useRef(null);
  const cleanupRef = useRef(null);
  
  const sources = [
    'VidLink', 
    'VidsrcXYZ',
    'VidFast',
    'Videasy',
    'VidsrcSU',
    'Vidora',
  ];

  const currentUrl = getSource(currentSource, mediaType, id, currentSeason, currentEpisode);

  // Update state when props change
  useEffect(() => {
    setCurrentEpisode(episode);
    setCurrentSeason(season);
    setId(tmdbId);
    setCurrentTitle(title);
  }, [episode, season, tmdbId, title]);

  // Fetch season details when season changes
  useEffect(() => {
    const fetchSeasonDetails = async () => {
      if (mediaType === 'tv' && currentSeason && id) {
        try {
          const seasonData = await fetchTmdb(`/tv/${id}/season/${currentSeason}`);
          setCurrentSeasonDetails(seasonData);
          
          const episodeData = seasonData.episodes?.find(ep => ep.episode_number === currentEpisode);
          if (episodeData) { setCurrentTitle(episodeData.name || title); }
        } catch (error) {
          console.error('Error fetching season details:', error);
        }
      }
    };

    fetchSeasonDetails();
  }, [currentSeason, id, mediaType, currentEpisode, title]);

  const goToPreviousEpisode = async () => {
    if (mediaType !== 'tv' || !currentSeasonDetails) return;
    
    if (currentEpisode > 1) {
      const newEpisode = currentEpisode - 1;
      const episodeData = currentSeasonDetails.episodes?.find(ep => ep.episode_number === newEpisode);
      setCurrentEpisode(newEpisode);
      setCurrentTitle(episodeData?.name || `Episode ${newEpisode}`);
      onUpdateUrl?.(currentSeason, newEpisode);
    } else {
      const availableSeasons = seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
      const currentSeasonIndex = availableSeasons.findIndex(s => s.season_number === currentSeason);
      
      if (currentSeasonIndex > 0) {
        const previousSeason = availableSeasons[currentSeasonIndex - 1];
        try {
          const previousSeasonData = await fetchTmdb(`/tv/${id}/season/${previousSeason.season_number}`);
          const lastEpisode = previousSeasonData.episodes?.length || 1;
          const lastEpisodeData = previousSeasonData.episodes?.find(ep => ep.episode_number === lastEpisode);
          
          setCurrentSeason(previousSeason.season_number);
          setCurrentEpisode(lastEpisode);
          setCurrentTitle(lastEpisodeData?.name || `Episode ${lastEpisode}`);
          setCurrentSeasonDetails(previousSeasonData);
          onUpdateUrl?.(previousSeason.season_number, lastEpisode);
        } catch (error) {
          console.error('Error fetching previous season:', error);
        }
      }
    }
  };

  const goToNextEpisode = async () => {
    if (mediaType !== 'tv' || !currentSeasonDetails) return;
    
    const maxEpisode = currentSeasonDetails.episodes?.length || 0;
    if (currentEpisode < maxEpisode) {
      const newEpisode = currentEpisode + 1;
      const episodeData = currentSeasonDetails.episodes?.find(ep => ep.episode_number === newEpisode);
      setCurrentEpisode(newEpisode);
      setCurrentTitle(episodeData?.name || `Episode ${newEpisode}`);
      onUpdateUrl?.(currentSeason, newEpisode);
    } else {
      const availableSeasons = seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
      const currentSeasonIndex = availableSeasons.findIndex(s => s.season_number === currentSeason);
      
      if (currentSeasonIndex < availableSeasons.length - 1) {
        const nextSeason = availableSeasons[currentSeasonIndex + 1];
        try {
          const nextSeasonData = await fetchTmdb(`/tv/${id}/season/${nextSeason.season_number}`);
          const firstEpisodeData = nextSeasonData.episodes?.find(ep => ep.episode_number === 1);
          
          setCurrentSeason(nextSeason.season_number);
          setCurrentEpisode(1);
          setCurrentTitle(firstEpisodeData?.name || 'Episode 1');
          setCurrentSeasonDetails(nextSeasonData);
          onUpdateUrl?.(nextSeason.season_number, 1);
        } catch (error) {
          console.error('Error fetching next season:', error);
        }
      }
    }
  };

  // Check if navigation is possible
  const canGoToPrevious = () => {
    if (mediaType !== 'tv') return false;
    
    // Can go to previous episode in current season
    if (currentEpisode > 1) return true;
    
    // Can go to previous season
    const availableSeasons = seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
    const currentSeasonIndex = availableSeasons.findIndex(s => s.season_number === currentSeason);
    return currentSeasonIndex > 0;
  };

  const canGoToNext = () => {
    if (mediaType !== 'tv' || !currentSeasonDetails) return false;
    
    // Can go to next episode in current season
    const maxEpisode = currentSeasonDetails.episodes?.length || 0;
    if (currentEpisode < maxEpisode) return true;
    
    // Can go to next season
    const availableSeasons = seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
    const currentSeasonIndex = availableSeasons.findIndex(s => s.season_number === currentSeason);
    return currentSeasonIndex < availableSeasons.length - 1;
  };

  const handleSourceChange = (source) => {
    // Cleanup previous tracking
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    setCurrentSource(source);
  };
  
  useEffect(() => {
    if (iframeRef.current && currentSource) {
      // Initialize progress tracking for the current source
      const sourceIndex = sources.indexOf(currentSource);
      cleanupRef.current = initializeSourceTracking(
        iframeRef.current,
        currentSource,
        id,
        mediaType,
        currentSeason,
        currentEpisode,
        sourceIndex
      );
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [currentSource, id, mediaType, currentSeason, currentEpisode]);
  
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#131315] border border-white/20 rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-center p-2 relative">
          {/* Centered Title */}
          <div className="flex items-center gap-3">
             {mediaType === 'tv' && (
               <button
                 onClick={goToPreviousEpisode}
                 disabled={!canGoToPrevious()}
                 className={`p-2 rounded-full transition-colors ${
                   canGoToPrevious() 
                     ? 'text-white hover:bg-white/20 cursor-pointer' 
                     : 'text-gray-500 cursor-not-allowed'
                 }`}
               >
                 <ChevronLeft className="w-6 h-6" />
               </button>
             )}
            
            <h2 className="text-white text-lg font-medium">
              {mediaType === 'tv' ? (
                <span>
                  S{currentSeason}E{currentEpisode} - {currentTitle}
                </span>
              ) : (
                currentTitle
              )}
            </h2>
            
             {mediaType === 'tv' && (
               <button
                 onClick={goToNextEpisode}
                 disabled={!canGoToNext()}
                 className={`p-2 rounded-full transition-colors ${
                   canGoToNext() 
                     ? 'text-white hover:bg-white/20 cursor-pointer' 
                     : 'text-gray-500 cursor-not-allowed'
                 }`}
               >
                 <ChevronRight className="w-6 h-6" />
               </button>
             )}
          </div>
          
          {/* Absolutely positioned controls on top right border */}
          <div className="absolute -top-4 -right-4 flex items-center gap-2">
            {/* Source Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-zinc-900 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-zinc-800 transition-colors border-l border border-white/20">
                <Tv className="w-4 h-4" />
                <span>{currentSource}</span>
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-xl shadow-lg z-50 min-w-[150px]">
                {sources.map((source) => (
                  <DropdownMenuItem
                    key={source}
                    onClick={() => handleSourceChange(source)}
                    className={`px-4 py-2 text-white hover:bg-white/10 transition-colors ${
                      currentSource === source ? 'bg-white/20' : ''
                    }`}
                  >
                    {source}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="bg-zinc-900 text-white p-2.5 rounded-full hover:bg-zinc-800 transition-colors border-l border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="flex-1 p-4 pt-0">
          <div className="w-full rounded-xl overflow-hidden aspect-video">
            <iframe
              ref={iframeRef}
              src={currentUrl}
              className="w-full h-full"
              frameBorder="0"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={currentSource}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;