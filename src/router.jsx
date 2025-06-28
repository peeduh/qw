import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/browse/Home.jsx';
import Movies from './pages/browse/Movies.jsx';
import Tv from './pages/browse/Tv.jsx';
import Details from './pages/details/Details.jsx';
import Watchlist from './pages/Watchlist.jsx';
import Search from './pages/Search.jsx';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/tv" element={<Tv />} />
        <Route path="/movie/:tmdbId" element={<Details />} />
        <Route path="/tv/:tmdbId" element={<Details />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/search" element={<Search />} />
      </Routes>
      <Toaster 
        position="bottom-center"
        theme="dark"
        duration={3000}
        unstyled
        closeButton
      />
    </Router>
  )
}