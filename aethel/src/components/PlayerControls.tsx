import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Mic2, Maximize2, Heart } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

export const PlayerControls: React.FC = () => {
  const {
    isPlaying,
    volume,
    currentTime,
    currentTrack,
    isMuted,
    isShuffled,
    repeatMode,
    togglePlay,
    setVolume,
    toggleMute,
    seek,
    nextTrack,
    previousTrack,
    toggleShuffle,
    setRepeatMode,
    toggleExpanded,
  } = usePlayerStore();

  const [dynamicCover, setDynamicCover] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
    if (currentTrack && !currentTrack.coverArt) {
      import('../lib/api').then(({ fetchCoverArt }) => {
        fetchCoverArt(currentTrack.artist, currentTrack.title).then(res => {
          if (res) setDynamicCover(res);
        });
      });
    } else {
      setDynamicCover(null);
    }
  }, [currentTrack]);

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Auto-progress is now handled by HTMLAudioElement timeupdate events in the store.

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && currentTrack) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      seek(pos * currentTrack.duration);
    }
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (volumeRef.current) {
      const rect = volumeRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVolume(pos);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = currentTrack ? (currentTime / currentTrack.duration) * 100 : 0;
  const volumePercent = isMuted ? 0 : volume * 100;

  return (
    <footer className="player-bar">
      <div className="now-playing" style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '30%' }}>
        <div 
          style={{ 
            width: '56px', height: '56px', 
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-tertiary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
            boxShadow: '0 0 10px rgba(217, 0, 255, 0.3)'
          }} 
        >
          {((currentTrack?.coverArt || dynamicCover) && !imageError) ? (
            <img src={currentTrack?.coverArt || dynamicCover || ''} alt="Cover" onError={() => setImageError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ opacity: 0.5 }}>🎵</div>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            {currentTrack?.title || 'No Track'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {currentTrack?.artist || 'Unknown Artist'}
          </div>
        </div>
        <Heart size={18} className="control-btn" style={{ marginLeft: '8px' }} />
      </div>

      <div className="player-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Shuffle 
            size={18} 
            className={`control-btn ${isShuffled ? 'active' : ''}`} 
            onClick={toggleShuffle} 
          />
          <SkipBack 
            size={24} 
            className="control-btn" 
            onClick={previousTrack} 
            style={{ color: 'var(--color-text-primary)' }}
          />
          <div className="play-btn" onClick={togglePlay}>
            {isPlaying ? (
              <Pause size={20} style={{ fill: 'currentColor' }} />
            ) : (
              <Play size={20} style={{ marginLeft: '4px', fill: 'currentColor' }} />
            )}
          </div>
          <SkipForward 
            size={24} 
            className="control-btn" 
            onClick={nextTrack} 
            style={{ color: 'var(--color-text-primary)' }}
          />
          <Repeat 
            size={18} 
            className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`} 
            onClick={() => {
              if (repeatMode === 'off') setRepeatMode('all');
              else if (repeatMode === 'all') setRepeatMode('one');
              else setRepeatMode('off');
            }} 
            style={{ position: 'relative' }}
          >
            {repeatMode === 'one' && (
              <div style={{ position: 'absolute', top: '-6px', right: '-6px', fontSize: '10px', background: 'var(--color-accent-secondary)', color: '#000', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</div>
            )}
          </Repeat>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          <span>{formatTime(currentTime)}</span>
          <input 
            type="range" 
            min="0" 
            max={currentTrack?.duration || 100} 
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ 
              width: '100%',
              background: `linear-gradient(to right, var(--color-text-primary) ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`
            }}
          />
          <span>{currentTrack ? formatTime(currentTrack.duration) : '0:00'}</span>
        </div>
      </div>

      <div className="player-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', width: '30%' }}>
        <Mic2 size={18} className="control-btn" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px' }}>
          {isMuted || volume === 0 ? (
            <VolumeX size={18} className="control-btn" onClick={toggleMute} />
          ) : (
            <Volume2 size={18} className="control-btn" onClick={toggleMute} />
          )}
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ 
              width: '100%',
              background: `linear-gradient(to right, var(--color-text-primary) ${volumePercent}%, rgba(255,255,255,0.2) ${volumePercent}%)`
            }}
          />
        </div>
        <Maximize2 size={18} className="control-btn" onClick={toggleExpanded} />
      </div>
    </footer>
  );
};
