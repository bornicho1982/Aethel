import React from 'react';
import { ChevronDown, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic, Maximize2, Mic2, FileText } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

export const NowPlayingExpanded: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    isShuffled,
    repeatMode,
    togglePlay,
    toggleExpanded,
    nextTrack,
    previousTrack,
    toggleShuffle,
    setRepeatMode,
    seek,
    currentLyrics,
    currentHdCover,
  } = usePlayerStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = currentTrack && currentTrack.duration > 0 ? (currentTime / currentTrack.duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentTrack && currentTrack.duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      seek(pos * currentTrack.duration);
    }
  };

  // Use HD cover if available, fallback to local cover, fallback to gradient
  const displayCover = currentHdCover || currentTrack?.coverArt;
  const backgroundStyle = displayCover ? `url(${displayCover})` : 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-accent-tertiary))';

  return (
    <div className="now-playing-expanded" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--color-bg-base)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      backgroundImage: backgroundStyle,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      {/* Heavy blur overlay to keep the background visible but not distracting */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backdropFilter: 'blur(100px) brightness(0.4)',
        WebkitBackdropFilter: 'blur(100px) brightness(0.4)',
        zIndex: -1
      }} />

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px' }}>
        <button className="control-btn" onClick={toggleExpanded} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
          <ChevronDown size={32} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--color-text-secondary)' }}>
            Playing from Library
          </div>
          <div style={{ fontWeight: 600 }}>{currentTrack?.album || 'Unknown Album'}</div>
        </div>
        <button className="control-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
          <ListMusic size={24} />
        </button>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10%', gap: '64px' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: '300px' }}>
          <div style={{
            width: '100%',
            maxWidth: '500px',
            aspectRatio: '1/1',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 40px rgba(217, 0, 255, 0.2)',
            background: backgroundStyle,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'background 0.5s ease',
          }} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '500px' }}>
          <div>
            <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '8px', lineHeight: 1.1 }}>
              {currentTrack?.title || 'No Track'}
            </h1>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>
              {currentTrack?.artist || 'Unknown Artist'}
            </h2>
          </div>

          {currentLyrics && (
            <div className="lyrics-container" style={{ 
              maxHeight: '150px', 
              overflowY: 'auto', 
              color: 'var(--color-text-secondary)', 
              fontSize: '1.1rem',
              lineHeight: 1.6,
              background: 'rgba(0,0,0,0.2)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {currentLyrics.split('\n').map((line, i) => {
                const cleanLine = line.replace(/\[\d{2}:\d{2}\.\d{2}\]/, '');
                return <p key={i} style={{ margin: '4px 0' }}>{cleanLine}</p>;
              })}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              type="range" 
              min="0" 
              max={currentTrack?.duration || 100} 
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              style={{ 
                width: '100%',
                background: `linear-gradient(to right, var(--color-text-primary) ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`,
                boxShadow: '0 0 10px rgba(255,255,255,0.2)'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              <span>{formatTime(currentTime)}</span>
              <span>{currentTrack ? formatTime(currentTrack.duration) : '0:00'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Shuffle size={24} className={`control-btn ${isShuffled ? 'active' : ''}`} onClick={toggleShuffle} />
            <SkipBack size={32} className="control-btn" onClick={previousTrack} style={{ color: 'var(--color-text-primary)' }} />
            
            <div className="play-btn" onClick={togglePlay} style={{ width: '72px', height: '72px', background: 'var(--color-text-primary)', color: 'var(--color-bg-base)' }}>
              {isPlaying ? (
                <Pause size={32} style={{ fill: 'currentColor' }} />
              ) : (
                <Play size={32} style={{ marginLeft: '6px', fill: 'currentColor' }} />
              )}
            </div>
            
            <SkipForward size={32} className="control-btn" onClick={nextTrack} style={{ color: 'var(--color-text-primary)' }} />
            <Repeat 
              size={24} 
              className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`} 
              onClick={() => {
                if (repeatMode === 'off') setRepeatMode('all');
                else if (repeatMode === 'all') setRepeatMode('one');
                else setRepeatMode('off');
              }} 
              style={{ position: 'relative' }}
            >
              {repeatMode === 'one' && (
                <div style={{ position: 'absolute', top: '-8px', right: '-8px', fontSize: '10px', background: 'var(--color-accent-secondary)', color: '#000', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</div>
              )}
            </Repeat>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '16px' }}>
            <Heart size={24} className="control-btn" />
            <FileText 
              size={24} 
              className={`control-btn ${currentLyrics ? 'active' : ''}`} 
              style={{ color: currentLyrics ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }} 
              onClick={async () => {
                if (currentLyrics) {
                  usePlayerStore.setState({ currentLyrics: null });
                } else if (currentTrack) {
                  try {
                    const { getLyrics } = await import('../lib/api');
                    usePlayerStore.setState({ currentLyrics: 'Buscando letra...' });
                    const lyrics = await getLyrics(currentTrack.title, currentTrack.artist);
                    usePlayerStore.setState({ currentLyrics: lyrics });
                  } catch (e) {
                    usePlayerStore.setState({ currentLyrics: 'Letra no encontrada.' });
                  }
                }
              }}
            />
            <Maximize2 size={24} className="control-btn" />
          </div>
        </div>
      </main>
    </div>
  );
};
