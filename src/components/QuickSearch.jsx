import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import { fetchTmdb } from '../utils.jsx';

const QuickSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (location.pathname.startsWith('/anime')) {
        return;
      }
      
      // Open spotlight with Ctrl+G / Cmd+G
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        setIsOpen(true);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedIndex(-1);
      }
      
      // Close with Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedIndex(-1);
      }
      
      // Navigate results with arrow keys
      if (isOpen && searchResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : 0
          );
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : searchResults.length - 1
          );
        }
        if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          const selectedItem = searchResults[selectedIndex];
          handleItemClick(selectedItem);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex, location.pathname]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      if (inputRef.current) {
        setTimeout(() => inputRef.current.focus(), 100);
      }
    } else {
      // Restore body scroll
      document.body.style.overflow = 'unset';
    }

    return () => { document.body.style.overflow = 'unset' };
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSelectedIndex(-1);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async (query) => {
    if (!query.trim()) return;

    try {
      setIsLoading(true);
      const searchRoute = `/search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1`;
      const data = await fetchTmdb(searchRoute);
      
      // filter out people and, limit to 20 results
      const filteredResults = data.results
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .slice(0, 20);
      
      setSearchResults(filteredResults);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Error searching:', err);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = (item) => {
    const path = item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;
    navigate(path);
    setIsOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedIndex(-1);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedIndex(-1);
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) { handleClose(); }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm"
      onClick={handleBackgroundClick}
    >
      <div className="w-full max-w-2xl mx-4">
        <div className="mb-4">
          <div className="bg-white/10 border border-white/20 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
            <SearchIcon className="w-4 h-4 text-white" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for movies and TV shows..."
              className="flex-1 bg-transparent text-white text-sm font-medium placeholder-white/60 focus:outline-none"
            />
            <button
              onClick={handleClose}
              className="p-1 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {(searchResults.length > 0 || isLoading || (searchQuery.trim() && !isLoading)) && (
          <div ref={resultsRef} className="overflow-y-auto space-y-2 rounded-xl" style={{ maxHeight: 'calc(100vh - 550px)' }}>
            {isLoading ? (
              <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-4">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-xl h-6 w-6 border-b-2 border-white"></div>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`bg-white/10 border border-white/20 rounded-xl px-4 py-3 cursor-pointer transition-all hover:bg-white/15 shadow-lg ${
                    index === selectedIndex ? 'bg-white/20 border-white/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-14 flex-shrink-0">
                      <img
                        src={
                          item.poster_path
                            ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
                            : `https://placehold.co/92x138/141414/fff/?text=${encodeURIComponent(item.title || item.name || 'Unknown')}&font=poppins`
                        }
                        alt={item.title || item.name}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm truncate">
                        {item.title || item.name}
                      </h3>
                      <p className="text-white/60 text-xs">
                        {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                        {item.release_date || item.first_air_date ? (
                          <span className="ml-2">
                            {new Date(item.release_date || item.first_air_date).getFullYear()}
                          </span>
                        ) : null}
                      </p>
                      {item.overview && (
                        <p className="text-white/40 text-xs mt-1 line-clamp-1">
                          {item.overview.length > 80 
                            ? `${item.overview.substring(0, 80)}...` 
                            : item.overview
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : searchQuery.trim() && !isLoading ? (
              <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-4">
                <div className="flex items-center justify-center">
                  <p className="text-white/60 text-sm">No results found</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickSearch;