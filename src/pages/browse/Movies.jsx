import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTmdb, getTmdbImage, formatReleaseDate, getContentRating, isInWatchlist, toggleWatchlist } from '../../utils.jsx';
import { Play, ThumbsUp, Plus, Info } from 'lucide-react';
import { toast } from 'sonner';
import CarouselItem from '../../components/carouselItem.jsx';
import Header from '../../components/Header.jsx';
import Footer from '../../components/Footer.jsx';
import { SpotlightSkeleton, CategorySkeleton } from '../../components/Skeletons.jsx';
import config from '../../config.json';

const { tmdbBaseUrl } = config;

const movieCategories = [
  {
    title: 'Action',
    url: `${tmdbBaseUrl}/discover/movie?with_genres=28&language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl,
    updateHero: true
  },
  {
    title: 'Comedy',
    url: `${tmdbBaseUrl}/discover/movie?with_genres=35&language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl
  },
  {
    title: 'Drama',
    url: `${tmdbBaseUrl}/discover/movie?with_genres=18&language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl
  },
  {
    title: 'Sci-Fi',
    url: `${tmdbBaseUrl}/discover/movie?with_genres=878&language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl
  },
  {
    title: 'Horror',
    url: `${tmdbBaseUrl}/discover/movie?with_genres=27&language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl
  },
  {
    title: 'Animation',
    url: `${tmdbBaseUrl}/discover/movie?with_genres=16&language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl
  },
  {
    title: 'Upcoming',
    url: `${tmdbBaseUrl}/movie/upcoming?language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl
  },
  {
    title: 'Now Playing',
    url: `${tmdbBaseUrl}/movie/now_playing?language=en-US&page=1&append_to_response=images,content_ratings&include_image_language=en`,
    detailUrl: tmdbBaseUrl
  }
];

const SpotlightSection = ({ item, isLoading }) => {
  const [inWatchlist, setInWatchlist] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (item && item.id) { setInWatchlist(isInWatchlist(item.id)); }
  }, [item]);
  
  if (isLoading || !item) {
    return <SpotlightSkeleton />;
  }
  
  const backgroundImage = getTmdbImage(item.backdrop_path) || getTmdbImage(item.poster_path);
  const logoImage = item.images?.logos?.find(logo => logo.iso_639_1 === 'en')?.file_path;
  const mediaType = item.title ? 'movie' : 'tv';
  
  const handleWatchlistToggle = (e) => {
    e.stopPropagation();
    const isAdded = toggleWatchlist(item);
    setInWatchlist(isAdded);
  };

  const handleWatchClick = () => { navigate(`/${mediaType}/${item.id}?watch=1`); };
  const handleInfoClick = () => { navigate(`/${mediaType}/${item.id}`); };
  const handleLikeClick = () => { toast(`Liked ${item.title || item.name}`); };

  return (
    <div id="spotlight" className="relative w-full h-[80vh] bg-cover bg-center bg-no-repeat flex items-end animate-slide-up" style={{backgroundImage: `url('${backgroundImage}')`}}>
      <div className="absolute inset-0 bg-gradient-to-r from-[#090a0a]/70 via-black/20 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#090a0a]/80 via-black/40 md:via-black/20 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#090a0a]/80 md:from-[#090a0a]/60 via-[#090a0a]/10 to-transparent"></div>

      {/* Content container */}
      <div className="relative z-10 p-4 md:p-8 pb-0 w-full md:pl-8 md:pr-0 md:text-left text-center">
        {logoImage ? (
          <img src={getTmdbImage(logoImage)} className="w-[80%] md:max-h-72 max-w-sm min-w-[13rem] mb-4 animate-fade-in-delayed mx-auto md:mx-0" alt={item.title || item.name} />
        ) : (
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 w-full md:w-[24rem] animate-fade-in-delayed">
            {item.title || item.name}
          </h1>
        )}
        
        {/* Rating and info */}
        <div className="flex items-center gap-2 mb-4 animate-fade-in-delayed-2 justify-center md:justify-start">
          <div className="bg-gradient-to-r from-[#90cea1] to-[#01b4e4] text-black px-1 py-[1px] rounded font-black tracking-tighter text-sm">TMDB</div>
          <span className="text-neutral-300">{item.vote_average?.toFixed(1) || '8.0'}</span>
          <span className="text-neutral-300">•</span>
          <span className="text-neutral-300">{formatReleaseDate(item.release_date || item.first_air_date)}</span>
          <span className="text-neutral-300">•</span>
          <span className="text-neutral-300">
            {item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : 
             item.number_of_seasons ? `${item.number_of_seasons} seasons` : '0-100 seasons'}
          </span>
          <span className="text-neutral-300">•</span>
          <span className="text-green-400">100% match</span>
        </div>
        
        {/* Description */}
        <p className="text-white text-base md:text-lg mb-8 md:mb-16 leading-6 max-w-xl line-clamp-3 overflow-ellipsis animate-fade-in-delayed-3 mx-auto md:mx-0">
          {item.overview}
        </p>
        
        {/* Action buttons */}
        <div className="flex flex-col md:flex-row mb-4 w-full md:justify-between items-center gap-4 animate-fade-in-delayed-4">
          <div className="flex items-center gap-2 justify-center">
            <button onClick={handleWatchClick} className="bg-white text-black px-6 py-2 rounded-full font-semibold text-lg flex items-center gap-2 hover:bg-neutral-200 transition-all cursor-pointer">
              <Play className="w-6 h-6" fill="currentColor" />
              Watch now
            </button>
            <button onClick={handleInfoClick} className="bg-white/15 text-white p-2.5 rounded-full hover:bg-white/25 transition-all cursor-pointer">
              <Info className="w-6 h-6" />
            </button>
            <button onClick={handleLikeClick} className="bg-white/15 text-white p-2.5 rounded-full hover:bg-white/25 transition-all cursor-pointer">
              <ThumbsUp className="w-6 h-6" />
            </button>
            <button 
              onClick={handleWatchlistToggle}
              className={`text-white p-2.5 rounded-full transition-all cursor-pointer ${inWatchlist ? 'bg-white/25' : 'bg-white/15 hover:bg-white/25'}`}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="bg-white/15 text-white p-2 pl-3 pr-12 font-light">{getContentRating(item)}</span>
          </div>
        </div>
        
        {/* Genre tags */}
        <div className="flex gap-2 text-neutral-600 text-sm mb-3 animate-fade-in-delayed-5 justify-center md:justify-start">
          {
            item.genres.slice(0, 3).map((genre, index) => (
              <React.Fragment key={genre.id}>
                <span>{genre.name}</span>
                {index < Math.min(item.genres.length - 1, 2) && <span>•</span>}
              </React.Fragment>
            ))
          }
        </div>
      </div>
    </div>
  );
};

const MediaCard = ({ item }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => { setIsMobile(window.innerWidth < 768); };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return (
    <div className="flex-shrink-0 w-40 md:w-96 cursor-pointer animate-scale-in">
      <CarouselItem item={item} usePoster={isMobile} />
    </div>
  );
};

const CategorySection = ({ title, items, isLoading: categoryLoading }) => {
  const [visibleItems, setVisibleItems] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = React.useRef(null);

  const handleScroll = (e) => {
    const container = e.target;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    // check if user has scrolled near the end (within 200px)
    if (scrollLeft + clientWidth >= scrollWidth - 200 && !isLoading && visibleItems < items.length) {
      setIsLoading(true);
      
      // load 4 more items
      setVisibleItems(prev => Math.min(prev + 4, items.length));
      setIsLoading(false);
    }
  };

  const displayedItems = items.slice(0, visibleItems);

  if (categoryLoading) {
    return <CategorySkeleton title={title} />;
  }

  return (
    <div className="mb-8 animate-slide-up">
      <h2 className="text-2xl text-white mb-1">{title}</h2>
      <div 
        ref={scrollContainerRef}
        className="flex space-x-4 overflow-x-auto scrollbar-hide py-4 pl-4 -ml-4"
        onScroll={handleScroll}
      >
        {displayedItems.map((item, index) => (
          <div key={item.id} className="animate-stagger" style={{animationDelay: `${index * 100}ms`}}>
            <MediaCard item={item} />
          </div>
        ))}
        {isLoading && (
          <div className="flex-shrink-0 w-96 h-56 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-solid border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};

const Movies = () => {
  const [spotlightItem, setSpotlightItem] = useState(null);
  const [categoryData, setCategoryData] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [spotlightLoading, setSpotlightLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const promises = movieCategories.map(async (category) => {
          const route = category.url.replace(category.detailUrl, '');
          const data = await fetchTmdb(route);
          return { ...category, data: data.results || [] };
        });

        const results = await Promise.all(promises);
        const newCategoryData = {};
        
        results.forEach((result) => {
          newCategoryData[result.title] = result.data;
          
          // Set spotlight item from trending movies with detailed data
          if (result.updateHero && result.data.length > 0) {
            const heroItem = result.data[0];
            const detailRoute = `/movie/${heroItem.id}?language=en-US&append_to_response=images,content_ratings,release_dates&include_image_language=en`;
            
            fetchTmdb(detailRoute).then(detailedItem => {
              setSpotlightItem(detailedItem);
              setSpotlightLoading(false);
            }).catch(err => {
              console.error('Error fetching detailed hero data:', err);
              setSpotlightItem(heroItem);
              setSpotlightLoading(false);
            });
          }
        });
        
        setCategoryData(newCategoryData);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
        setSpotlightLoading(false);
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-500 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0a] pb-12 md:pb-0">
      <Header />
      
      <SpotlightSection item={spotlightItem} isLoading={spotlightLoading} />
      
      <div className="px-8 py-8 space-y-8">
        {movieCategories.map((category, index) => {
          const items = categoryData[category.title] || [];
          return (
            <div key={category.title} className="animate-stagger" style={{animationDelay: `${index * 200}ms`}}>
              <CategorySection 
                title={category.title}
                items={items}
                isLoading={isLoading}
              />
            </div>
          );
        })}
      </div>
      
      <Footer />
    </div>
  );
};

export default Movies;