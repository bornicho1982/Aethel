import React from 'react';
import { Search, Play, Globe } from 'lucide-react';
import { usePlayerStore, Track } from '../store/usePlayerStore';
import { useExploreStore } from '../store/useExploreStore';

export const Explore: React.FC = () => {
  const { searchQuery, isSearching, results, setSearchQuery, setIsSearching, setResults } = useExploreStore();
  const { setCurrentTrack, setQueue } = usePlayerStore();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    
    import('../lib/api').then(async ({ searchYouTube }) => {
      const apiResults = await searchYouTube(searchQuery);
      
      const tracks: Track[] = apiResults.map(res => ({
        id: `remote-${res.id}`,
        title: res.title,
        artist: res.channel || "YouTube",
        duration: res.duration || 0,
        fileUrl: "", // Will be resolved by the backend
        isRemote: true,
        coverArt: res.thumbnail
      }));
      
      setResults(tracks);
      setQueue(tracks);
      setIsSearching(false);
    });
  };

  const handlePlay = (track: Track) => {
    setCurrentTrack(track);
  };

  return (
    <main className="main-content" style={{ overflowY: 'auto' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '8px', fontWeight: 800 }}>Explore Global</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>Search and stream music from around the world without limits.</p>
      </header>

      <section style={{ marginBottom: '48px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', maxWidth: '600px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for any song or artist (e.g. 'Dua Lipa Levitating')"
              style={{ 
                width: '100%', 
                padding: '16px 16px 16px 48px', 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '24px',
                color: 'white',
                fontSize: '1.1rem'
              }} 
            />
          </div>
          <button 
            type="submit"
            disabled={isSearching}
            className="glass-panel"
            style={{ 
              padding: '0 32px', 
              color: 'var(--color-bg-base)', 
              background: 'var(--color-accent-primary)',
              border: 'none',
              borderRadius: '24px',
              fontWeight: 700,
              cursor: isSearching ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </section>

      {results.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Globe color="var(--color-accent-secondary)" />
            Global Results
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {results.map((track) => (
              <div 
                key={track.id} 
                className="glass-panel" 
                style={{ 
                  padding: '16px 24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  borderRadius: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ 
                    width: '48px', height: '48px', 
                    background: track.coverArt ? `url(${track.coverArt})` : 'linear-gradient(135deg, var(--color-accent-tertiary), var(--color-bg-base))', 
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {!track.coverArt && '🎵'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{track.title}</h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{track.artist}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handlePlay(track)}
                  style={{ 
                    width: '48px', height: '48px', 
                    borderRadius: '50%', 
                    border: 'none',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-accent-primary)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                  <Play size={24} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
