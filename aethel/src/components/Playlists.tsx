import React, { useEffect, useState } from 'react';
import { ListMusic, Plus, Play, ArrowLeft, DownloadCloud, Grid, List, AlignJustify, Trash2, Info, X, Image as ImageIcon } from 'lucide-react';
import { getPlaylists, getPlaylistTracks, importExternalPlaylist, removePlaylistTrack, deletePlaylist, updatePlaylistCover, updateTrackCover, fetchTrackInfo, Playlist, PlaylistTrack, ItunesTrackInfo } from '../lib/api';
import { usePlayerStore, Track } from '../store/usePlayerStore';
import { open } from '@tauri-apps/plugin-dialog';

const TrackCover = ({ artist, title, defaultCover, size = 40 }: { artist: string, title: string, defaultCover?: string, size?: number }) => {
  const [cover, setCover] = useState<string | null>(defaultCover || null);
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    setImageError(false);
    if (defaultCover) {
      setCover(defaultCover);
      return;
    }
    if (!cover && artist && title) {
      import('../lib/api').then(({ fetchCoverArt }) => {
        fetchCoverArt(artist, title).then(res => {
          if (res) setCover(res);
        });
      });
    }
  }, [artist, title, cover, defaultCover]);
  
  return (
    <div style={{ 
      width: `${size}px`, height: `${size}px`, 
      borderRadius: size > 64 ? '12px' : '6px', 
      background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-tertiary))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
      boxShadow: size > 64 ? '0 8px 16px rgba(0,0,0,0.3)' : 'none'
    }}>
      {(cover && !imageError) ? <img src={cover} alt="Cover" onError={() => setImageError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ListMusic size={size * 0.4} opacity={0.5} />}
    </div>
  );
};

export const Playlists: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [infoModalTrack, setInfoModalTrack] = useState<{track: PlaylistTrack, info: ItunesTrackInfo | null} | null>(null);
  const [isHoveringCover, setIsHoveringCover] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);

  const { setCurrentTrack, setQueue } = usePlayerStore();

  useEffect(() => {
    import('../lib/api').then(({ getServerPort }) => {
      getServerPort().then(port => setServerPort(port)).catch(console.error);
    });
  }, []);

  const fetchPlaylists = async () => {
    try {
      setIsLoading(true);
      const data = await getPlaylists();
      const updatedData = await Promise.all(data.map(async (pl) => {
        if (!pl.cover_url) {
          try {
            const tracks = await getPlaylistTracks(pl.id);
            if (tracks.length > 0) {
              const { fetchCoverArt } = await import('../lib/api');
              const cover = await fetchCoverArt(tracks[0].artist_name || '', pl.name);
              if (cover) return { ...pl, cover_url: cover };
            }
          } catch (e) {}
        }
        return pl;
      }));
      setPlaylists(updatedData);
      
      // Update selected playlist cover if it changed
      if (selectedPlaylist) {
        const updatedSelected = updatedData.find(p => p.id === selectedPlaylist.id);
        if (updatedSelected) setSelectedPlaylist(updatedSelected);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    
    // Restore view mode from local storage if available
    const savedViewMode = localStorage.getItem('playlistViewMode');
    if (savedViewMode === 'list' || savedViewMode === 'grid' || savedViewMode === 'compact') {
      setViewMode(savedViewMode);
    }
  }, []);

  const handleSetViewMode = (mode: 'list' | 'grid' | 'compact') => {
    setViewMode(mode);
    localStorage.setItem('playlistViewMode', mode);
  };

  const renderImportSection = (platform: 'Spotify' | 'YouTube Music' | 'Deezer', icon: React.ReactNode, color: string) => {
    return (
      <div style={{ padding: '16px', borderRadius: '12px', borderTop: `4px solid ${color}`, background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          {icon}
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Import from {platform}</h2>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '0.85rem' }}>
          Paste a public playlist URL from {platform} to import it directly into your Aethel library without needing an API key.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder={`https://${platform === 'Spotify' ? 'open.spotify.com' : platform === 'Deezer' ? 'deezer.com' : 'music.youtube.com'}/playlist...`}
            style={{ 
              flex: 1, padding: '10px 16px', borderRadius: '8px', 
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' 
            }} 
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const url = e.currentTarget.value;
                if (url) {
                  importExternalPlaylist(url).then(() => {
                    fetchPlaylists();
                    setIsImportModalOpen(false);
                  }).catch(err => alert(`Failed: ${err}`));
                }
              }
            }}
          />
          <button 
            style={{ padding: '10px 16px', borderRadius: '8px', background: color, border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={(e) => {
              const input = e.currentTarget.previousSibling as HTMLInputElement;
              if (input.value) {
                importExternalPlaylist(input.value).then(() => {
                  fetchPlaylists();
                  setIsImportModalOpen(false);
                }).catch(err => alert(`Failed: ${err}`));
              }
            }}
          >
            Import
          </button>
        </div>
      </div>
    );
  };

  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    try {
      const tracks = await getPlaylistTracks(playlist.id);
      setPlaylistTracks(tracks);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlaylist = async (playlist: Playlist, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm(`Are you sure you want to permanently delete the playlist "${playlist.name}"?`)) {
      try {
        await deletePlaylist(playlist.id);
        if (selectedPlaylist?.id === playlist.id) setSelectedPlaylist(null);
        await fetchPlaylists();
      } catch (error) {
        alert(`Failed to delete playlist: ${error}`);
      }
    }
  };

  const handleEditCover = async () => {
    if (!selectedPlaylist) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        const absolutePath = selected.replace(/\\/g, '/');
        // Ensure path starts with / for Windows C:/ format so it works via static server, unless it already starts with /
        const formattedPath = absolutePath.startsWith('/') ? absolutePath : `/${absolutePath}`;
        await updatePlaylistCover(selectedPlaylist.id, formattedPath);
        await fetchPlaylists();
      }
    } catch (e) {
      console.error("Failed to select image:", e);
    }
  };

  const handleDeleteTrack = async (e: React.MouseEvent, trackId: number) => {
    e.stopPropagation();
    try {
      await removePlaylistTrack(trackId);
      setPlaylistTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (error) {
      alert(`Failed to delete track: ${error}`);
    }
  };

  const handleEditTrackCover = async (e: React.MouseEvent, trackId: number) => {
    e.stopPropagation();
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        const absolutePath = selected.replace(/\\/g, '/');
        const formattedPath = absolutePath.startsWith('/') ? absolutePath : `/${absolutePath}`;
        await updateTrackCover(trackId, formattedPath);
        
        // Refetch current playlist tracks
        if (selectedPlaylist) {
          const updatedTracks = await getPlaylistTracks(selectedPlaylist.id);
          setPlaylistTracks(updatedTracks);
        }
      }
    } catch (err) {
      console.error("Failed to select image for track:", err);
    }
  };

  const handleShowInfo = async (e: React.MouseEvent, track: PlaylistTrack) => {
    e.stopPropagation();
    setInfoModalTrack({ track, info: null }); // Show loading state
    
    try {
      const info = await fetchTrackInfo(track.artist_name || '', track.track_name);
      setInfoModalTrack({ track, info });
    } catch (error) {
      console.error(error);
      setInfoModalTrack({ track, info: null });
    }
  };

  const handlePlayTrack = (track: PlaylistTrack, allTracks: PlaylistTrack[]) => {
    const queueTracks: Track[] = allTracks.map(t => ({
      id: `pl_${t.id}`,
      title: t.track_name,
      artist: t.artist_name || 'Unknown Artist',
      duration: 0,
      fileUrl: `ytsearch:${t.track_name} ${t.artist_name || ''}`,
      coverArt: getCoverUrl(t.cover_url) || undefined,
      isRemote: true,
    }));
    
    setQueue(queueTracks);

    setCurrentTrack({
      id: `pl_${track.id}`,
      title: track.track_name,
      artist: track.artist_name || 'Unknown Artist',
      duration: 0,
      fileUrl: `ytsearch:${track.track_name} ${track.artist_name || ''}`,
      coverArt: getCoverUrl(track.cover_url) || undefined,
      isRemote: true,
    });
  };

  const handlePlayAll = () => {
    if (playlistTracks.length > 0) {
      handlePlayTrack(playlistTracks[0], playlistTracks);
    }
  };
  
  const getCoverUrl = (url?: string | null) => {
    if (!url || url === 'null' || url === 'undefined') return undefined;
    if (url.startsWith('http')) return url;
    if (!serverPort) return undefined; // Wait until port is loaded
    const formattedUrl = url.startsWith('/') ? url : `/${url}`;
    return `http://127.0.0.1:${serverPort}${formattedUrl}`;
  };

  if (selectedPlaylist) {
    const finalCoverUrl = getCoverUrl(selectedPlaylist.cover_url);
    
    return (
      <main className="main-content" style={{ overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', marginBottom: '32px' }}>
          <button 
            onClick={() => setSelectedPlaylist(null)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          
          <div 
            style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 16px 32px rgba(0,0,0,0.5)', cursor: 'pointer' }}
            onMouseEnter={() => setIsHoveringCover(true)}
            onMouseLeave={() => setIsHoveringCover(false)}
            onClick={handleEditCover}
          >
            {finalCoverUrl ? (
              <img src={finalCoverUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'var(--color-accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ListMusic size={64} color="white" />
              </div>
            )}
            
            {/* Edit Cover Overlay */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isHoveringCover ? 1 : 0, transition: 'opacity 0.2s',
              flexDirection: 'column', gap: '8px'
            }}>
              <Plus size={32} color="white" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Edit Cover</span>
            </div>
          </div>
          
          <div style={{ flex: 1, paddingBottom: '8px' }}>
            <p style={{ color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem', margin: '0 0 8px 0', fontWeight: 600 }}>Playlist</p>
            <h1 style={{ fontSize: '4rem', margin: '0 0 16px 0', fontWeight: 900, lineHeight: 1.1 }}>{selectedPlaylist.name}</h1>
            <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 16px 0', fontSize: '1.1rem' }}>{playlistTracks.length} tracks</p>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <button 
                  onClick={handlePlayAll}
                  className="hover-scale"
                  disabled={playlistTracks.length === 0}
                  style={{
                    background: 'var(--color-accent-primary)', border: 'none', color: 'white',
                    width: '56px', height: '56px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    opacity: playlistTracks.length === 0 ? 0.5 : 1
                  }}
                >
                  <Play size={28} fill="currentColor" style={{ marginLeft: '4px' }} />
                </button>
                
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                  <button onClick={() => handleSetViewMode('list')} style={{ background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><List size={20} /></button>
                  <button onClick={() => handleSetViewMode('compact')} style={{ background: viewMode === 'compact' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><AlignJustify size={20} /></button>
                  <button onClick={() => handleSetViewMode('grid')} style={{ background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><Grid size={20} /></button>
                </div>
              </div>
              
              <button 
                onClick={(e) => handleDeletePlaylist(selectedPlaylist, e)}
                className="hover-scale"
                style={{
                  background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.2)', color: '#ff4d4d',
                  padding: '12px 16px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600
                }}
              >
                <Trash2 size={18} />
                Delete Playlist
              </button>
            </div>
          </div>
        </div>

        <div style={{ 
          display: viewMode === 'grid' ? 'grid' : 'flex', 
          flexDirection: viewMode === 'grid' ? 'row' : 'column',
          gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(180px, 1fr))' : 'none',
          gap: viewMode === 'grid' ? '24px' : (viewMode === 'compact' ? '2px' : '8px') 
        }}>
          {playlistTracks.map((track, idx) => (
            viewMode === 'grid' ? (
              <div 
                key={track.id}
                className="glass-panel"
                style={{ padding: '16px', borderRadius: '16px', position: 'relative', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ width: '100%', aspectRatio: '1/1', marginBottom: '16px', position: 'relative' }}>
                  <TrackCover artist={track.artist_name || ''} title={track.track_name} defaultCover={getCoverUrl(track.cover_url)} size={148} />
                  <button 
                    onClick={() => handlePlayTrack(track, playlistTracks)}
                    className="hover-scale"
                    style={{
                      position: 'absolute', bottom: '8px', right: '8px',
                      background: 'var(--color-accent-primary)', border: 'none', color: 'white',
                      width: '40px', height: '40px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                </div>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.track_name}</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: '0 0 12px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist_name}</p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <button onClick={(e) => handleShowInfo(e, track)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px' }}><Info size={18} /></button>
                  <button onClick={(e) => handleEditTrackCover(e, track.id)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px' }}><ImageIcon size={18} /></button>
                  <button onClick={(e) => handleDeleteTrack(e, track.id)} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '4px' }}><Trash2 size={18} /></button>
                </div>
              </div>
            ) : (
              <div 
                key={track.id}
                className="glass-panel hover-bg"
                style={{
                  display: 'flex', alignItems: 'center', 
                  padding: viewMode === 'compact' ? '8px 16px' : '12px 16px', 
                  gap: '16px',
                  borderRadius: viewMode === 'compact' ? '4px' : '8px',
                  background: viewMode === 'compact' ? 'transparent' : undefined,
                  borderBottom: viewMode === 'compact' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}
              >
                <div style={{ width: '30px', color: 'var(--color-text-secondary)', textAlign: 'right', fontSize: '0.9rem' }}>
                  {idx + 1}
                </div>
                <TrackCover artist={track.artist_name || ''} title={track.track_name} defaultCover={getCoverUrl(track.cover_url)} size={viewMode === 'compact' ? 32 : 48} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: viewMode === 'compact' ? '0.95rem' : '1rem' }}>{track.track_name}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: viewMode === 'compact' ? '0.85rem' : '0.9rem' }}>{track.artist_name}</span>
                </div>
                
                <div className="track-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={(e) => handleShowInfo(e, track)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '8px' }}
                  >
                    <Info size={18} />
                  </button>
                  <button 
                    onClick={(e) => handleEditTrackCover(e, track.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '8px' }}
                  >
                    <ImageIcon size={18} />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteTrack(e, track.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '8px' }}
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => handlePlayTrack(track, playlistTracks)}
                    style={{
                      background: 'var(--color-accent-primary)', border: 'none', color: 'white',
                      width: viewMode === 'compact' ? '32px' : '40px', 
                      height: viewMode === 'compact' ? '32px' : '40px', 
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <Play size={viewMode === 'compact' ? 14 : 18} fill="currentColor" />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>

        {/* Track Info Modal */}
        {infoModalTrack && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setInfoModalTrack(null)}>
            <div style={{
              background: 'var(--color-bg-elevated)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '500px',
              display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative'
            }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setInfoModalTrack(null)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
              
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <TrackCover artist={infoModalTrack.track.artist_name || ''} title={infoModalTrack.track.track_name} defaultCover={infoModalTrack.info?.artworkUrl100 || undefined} size={120} />
                <div>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem' }}>{infoModalTrack.info?.trackName || infoModalTrack.track.track_name}</h2>
                  <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>{infoModalTrack.info?.artistName || infoModalTrack.track.artist_name}</p>
                </div>
              </div>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Album</span>
                  <span style={{ fontWeight: 500 }}>{infoModalTrack.info?.collectionName || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Genre</span>
                  <span style={{ fontWeight: 500 }}>{infoModalTrack.info?.primaryGenreName || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Year</span>
                  <span style={{ fontWeight: 500 }}>{infoModalTrack.info?.releaseDate ? new Date(infoModalTrack.info.releaseDate).getFullYear() : 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Duration</span>
                  <span style={{ fontWeight: 500 }}>
                    {infoModalTrack.info?.trackTimeMillis 
                      ? `${Math.floor(infoModalTrack.info.trackTimeMillis / 60000)}:${String(Math.floor((infoModalTrack.info.trackTimeMillis % 60000) / 1000)).padStart(2, '0')}` 
                      : '--:--'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="main-content" style={{ overflowY: 'auto' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '3rem', marginBottom: '8px', fontWeight: 800 }}>Playlists</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>Your custom mixes and imported collections.</p>
        </div>
        
        <button 
          onClick={() => setIsImportModalOpen(true)}
          className="glass-panel hover-scale"
          style={{ 
            padding: '12px 20px', color: 'var(--color-bg-base)', background: 'var(--color-accent-primary)',
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none', fontWeight: 600
          }}
        >
          <DownloadCloud size={18} />
          Importar desde enlace
        </button>
      </header>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setIsImportModalOpen(false)}>
          <div style={{
            background: 'var(--color-bg-elevated)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '600px',
            display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setIsImportModalOpen(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem' }}>Import Playlists</h2>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Centralize your music from other platforms into Aethel.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {renderImportSection('Spotify', <div style={{width:24,height:24,borderRadius:'50%',background:'#1DB954'}}/>, '#1DB954')}
              {renderImportSection('YouTube Music', <div style={{width:24,height:24,borderRadius:'50%',background:'#FF0000'}}/>, '#FF0000')}
              {renderImportSection('Deezer', <div style={{width:24,height:24,borderRadius:'50%',background:'#FEAA2D'}}/>, '#FEAA2D')}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '48px' }}>Loading playlists...</div>
      ) : playlists.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          You don't have any playlists yet. Click 'Importar desde enlace' to paste a Spotify, YouTube Music, or Deezer link.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
          {playlists.map(pl => (
            <div 
              key={pl.id}
              className="glass-panel"
              onClick={() => handleSelectPlaylist(pl)}
              style={{
                padding: '16px', cursor: 'pointer', borderRadius: '16px',
                transition: 'transform 0.2s, background 0.2s', position: 'relative'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
            >
              <button 
                onClick={(e) => handleDeletePlaylist(pl, e)}
                style={{
                  position: 'absolute', top: '24px', right: '24px',
                  background: 'rgba(255, 77, 77, 0.8)', border: 'none', color: 'white',
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  zIndex: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                <Trash2 size={16} />
              </button>
              
              {pl.cover_url ? (
                <img src={getCoverUrl(pl.cover_url)} alt={pl.name} style={{ width: '100%', aspectRatio: '1/1', borderRadius: '12px', objectFit: 'cover', marginBottom: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }} />
              ) : (
                <div style={{ 
                  width: '100%', aspectRatio: '1/1', 
                  background: 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-accent-tertiary))', 
                  borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
                }}>
                  <ListMusic size={48} color="white" opacity={0.5} />
                </div>
              )}
              
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pl.name}
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                Aethel Playlist
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
