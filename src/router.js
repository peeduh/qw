// Vite Router

import { renderHomePage } from './pages/browse/home.js';
import { renderWatchlistPage } from './pages/watchlist/watchlist.js';
import { renderSearchPage } from './pages/search/search.js';
import { renderDetailsPage } from './pages/details/watch.js';
import { renderDetailsMobilepage } from './pages/details/watch_mobile.js';
import { render404Page } from './pages/404.js';
import { renderDownloadDetailsPage } from './pages/details/download.js';
import { renderIOSAppPage } from './pages/iosapp.js';

import { renderAnimePaheEmbed } from './pages/embeds/animepahe.js';
import { renderNativeEmbed } from './pages/embeds/native.js';
import { renderAniplayEmbed} from './pages/embeds/aniplay.js';
import { renderZenimeEmbed } from './pages/embeds/zenime.js';
import { renderOnionEmbed } from './pages/embeds/onionflixer.js'

import { renderMoviesPage } from './pages/browse/movies.js';
import { renderTvPage } from './pages/browse/tv.js';
import { renderGenresPage } from './pages/genres/genres.js';
import { renderGenreDetailsPage } from './pages/genres/genreDetails.js';
import { renderAnimePage } from './pages/anime/home.js';
import { renderAnimeDetailsPage } from './pages/anime/details.js';

export const TMDB_API_KEY = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MmJhMTBjNDI5OTE0MTU3MzgwOGQyNzEwNGVkMThmYSIsInN1YiI6IjY0ZjVhNTUwMTIxOTdlMDBmZWE5MzdmMSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.84b7vWpVEilAbly4RpS01E9tyirHdhSXjcpfmTczI3Q';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

let currentPagePromise = Promise.resolve();

export function initRouter() {
  const appContainer = document.querySelector('#app');
  if (!appContainer) return;
  
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#')) {
      return;
    }
    
    e.preventDefault();
    navigateTo(href);
  });
  
  window.addEventListener('popstate', () => {
    handleRoute();
  });
  
  handleRoute();
  
  return {
    getCurrentPagePromise: () => currentPagePromise
  };
}

export function navigateTo(path) {
  if (path.match(/^\/dl\/movie\/[\d]+$/) || path.match(/^\/dl\/tv\/[\d]+$/)) {
    if (window.splashScreen && !path.match(/^\/download/) && !path.match(/^\/search/) && !path.match(/^\/watchlist/)) {
      window.splashScreen.show();
    }
  }
  
  history.pushState(null, null, path);
  handleRoute();
}

function handleRoute() {
  const path = window.location.pathname;
  const appContainer = document.querySelector('#app');
  
  if (path === '/search' || path === '/watchlist') {
    if (window.splashScreen) {
      window.splashScreen.hide();
    }
  }
  
  if (path === '/') {
    document.title = 'QuickWatch';
    currentPagePromise = Promise.resolve(renderHomePage(appContainer));
  } 
  else if (path === '/watchlist') {
    document.title = 'Watchlist';
    currentPagePromise = Promise.resolve(renderWatchlistPage(appContainer));
  } 
  else if (path === '/search') {
    document.title = 'Search';
    currentPagePromise = Promise.resolve(renderSearchPage(appContainer));
  }
  else if (path.match(/^\/movie\/[\d]+(-[a-z0-9-]*)?$/)) {
    const pathParts = path.split('/')[2];
    const id = pathParts.split('-')[0];
    document.title = 'Loading...';
    if (window.innerWidth <= 768) {
      currentPagePromise = Promise.resolve(renderDetailsMobilepage(appContainer, { type: 'movie', id }));
    } else {
      currentPagePromise = Promise.resolve(renderDetailsPage(appContainer, { type: 'movie', id }));
    }
  } 
  else if (path.match(/^\/tv\/[\d]+(-[a-z0-9-]*)?$/)) {
    const pathParts = path.split('/')[2];
    const id = pathParts.split('-')[0];
    document.title = 'Loading...';
    if (window.innerWidth <= 768) {
      currentPagePromise = Promise.resolve(renderDetailsMobilepage(appContainer, { type: 'tv', id }));
    } else {
      currentPagePromise = Promise.resolve(renderDetailsPage(appContainer, { type: 'tv', id }));
    }
  }
  else if (path.match(/^\/dl\/movie\/[\d]+$/) || path.match(/^\/dl\/tv\/[\d]+$/)) {
    document.title = 'QW Download'; // make dynamic
    const parts = path.split('/');
    const type = parts[2];
    const id = parts[3];
    currentPagePromise = renderDownloadDetailsPage(appContainer, { type, id });
  }
  else if (path === '/iosapp') {
    document.title = 'QuickWatch iOS';
    currentPagePromise = Promise.resolve(renderIOSAppPage(appContainer));
  }
  else if (path.match(/^\/embed\/animepahe\/[A-Za-z0-9\W_]+\/[A-Za-z0-9\W_]+\/[0-9]+\/[0-9]+$/)) {
    document.title = 'AnimePahe Embed';
    const parts = path.split('/');
    const episodeId = parts[3];
    const name = parts[4];
    const season = parts[5];
    const episode = parts[6];
    currentPagePromise = Promise.resolve(renderAnimePaheEmbed(appContainer, { episodeId, name, season, episode  }));
  }
  else if (path.match(/^\/embed\/native\/[\d]+\/[\d]+\/[\d]+\/\w+$/)) {
    document.title = 'Native Embed';
    const parts = path.split('/');
    const id = parts[3];
    const season = parts[4];
    const episode = parts[5];
    const type = parts[6];
    currentPagePromise = Promise.resolve(renderNativeEmbed(appContainer, { id, episode, season, type }));
  }
  else if (path.match(/^\/embed\/aniplay\/[A-Za-z0-9\W_]+\/[\d]+\/[a-z]+$/)) {
    document.title = 'Aniplay Embed';
    const parts = path.split('/');
    const episodeId = parts[3];
    const episode = parts[4];
    const type = parts[5];
    currentPagePromise = Promise.resolve(renderAniplayEmbed(appContainer, { episodeId, episode, type }));
  }
  else if (path.match(/^\/embed\/zenime\/[A-Za-z0-9\W_]+\/[A-Za-z0-9\W_]+\/[a-z]+$/)) {
    document.title = 'Zenime Embed';
    const parts = path.split('/');
    const episodeId = parts[3];
    const server = parts[4];
    const type = parts[5];
    currentPagePromise = Promise.resolve(renderZenimeEmbed(appContainer, { episodeId, server, type }));
  }
  else if (path.match(/^\/embed\/onion\/[\d]+\/[\d]+\/[\d]+\/\w+$/)) {
    document.title = 'Native Embed';
    const parts = path.split('/');
    const id = parts[3];
    const season = parts[4];
    const episode = parts[5];
    const type = parts[6];
    currentPagePromise = Promise.resolve(renderOnionEmbed(appContainer, { id, episode, season, type }));
  }
  else if (path === '/movies') {
    document.title = 'Movies';
    currentPagePromise = Promise.resolve(renderMoviesPage(appContainer));
  }
  else if (path === '/tv') {
    document.title = 'TV Shows';
    currentPagePromise = Promise.resolve(renderTvPage(appContainer));
  }
  else if (path === '/genres') {
    document.title = 'Genres';
    currentPagePromise = Promise.resolve(renderGenresPage(appContainer));
  }
  else if (path.match(/^\/genre\/[\d]+$/)) {
    const id = path.split('/')[2];
    document.title = 'Loading Genre...';
    currentPagePromise = Promise.resolve(renderGenreDetailsPage(appContainer, { id }));
  }
  else if (path === '/anime') {
    document.title = 'Anime';
    currentPagePromise = Promise.resolve(renderAnimePage(appContainer));
  }
  else if (path.match(/^\/anime\/([\w-]+)$/)) {
    const id = path.split('/')[2];
    document.title = 'Loading...';
    currentPagePromise = Promise.resolve(renderAnimeDetailsPage(appContainer, id)); 
  }
  else {
    document.title = '404';
    currentPagePromise = Promise.resolve(render404Page(appContainer));
  }
  
  return currentPagePromise;
  
}