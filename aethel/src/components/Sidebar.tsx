import React from 'react';
import { Home, Search, Library, Radio, ListMusic, Heart, Settings as SettingsIcon } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

interface SidebarProps {
  currentView: 'dashboard' | 'settings' | 'explore' | 'library' | 'playlists';
  setCurrentView: (view: 'dashboard' | 'settings' | 'explore' | 'library' | 'playlists') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const handleWipClick = () => alert('This section is locked for Phase 10+ development. Use Dashboard or Settings for now!');

  return (
    <aside className="sidebar">
      <div className="logo" style={{ marginBottom: '40px', padding: '0 8px' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 800, 
          background: 'linear-gradient(to right, var(--color-accent-primary), var(--color-accent-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          AETHEL
        </h1>
      </div>

      <nav className="nav-menu">
        <div className="nav-group">
          <div className="nav-group-title">Menu</div>
          <a href="#" className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('dashboard'); }}>
            <Home size={20} />
            Dashboard
          </a>
          <a href="#" className={`nav-item ${currentView === 'explore' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('explore'); }}>
            <Search size={20} />
            Explore (Global)
          </a>
          <a href="#" className={`nav-item ${currentView === 'library' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('library'); }}>
            <Library size={20} />
            Library
          </a>
        </div>

        <div className="nav-group" style={{ marginTop: '32px' }}>
          <div className="nav-group-title">Your Music</div>
          <a href="#" className="nav-item" onClick={handleWipClick}>
            <Heart size={20} />
            Favorites
          </a>
          <a href="#" className="nav-item" onClick={handleWipClick}>
            <Radio size={20} />
            Local Mixes
          </a>
          <a href="#" className={`nav-item ${currentView === 'playlists' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('playlists'); }}>
            <ListMusic size={20} />
            Playlists
          </a>
        </div>

        <div className="nav-group" style={{ marginTop: 'auto' }}>
          <a href="#" className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('settings'); }}>
            <SettingsIcon size={20} />
            Settings & Providers
          </a>
        </div>
      </nav>
    </aside>
  );
};
