import React from 'react';
import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { Explore } from './components/Explore';
import { Library } from './components/Library';
import { PlayerControls } from './components/PlayerControls';
import { NowPlayingExpanded } from './components/NowPlayingExpanded';
import { Playlists } from './components/Playlists';
import { usePlayerStore } from './store/usePlayerStore';
import './App.css';

type ViewType = 'dashboard' | 'settings' | 'explore' | 'library' | 'playlists';

function App() {
  const { isExpanded } = usePlayerStore();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  useEffect(() => {
    const handleContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('contextmenu', handleContext);
    return () => document.removeEventListener('contextmenu', handleContext);
  }, []);

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'settings' && <Settings />}
      {currentView === 'explore' && <Explore />}
      {currentView === 'library' && <Library />}
      {currentView === 'playlists' && <Playlists />}
      <PlayerControls />
      {isExpanded && <NowPlayingExpanded />}
    </div>
  );
}

export default App;
