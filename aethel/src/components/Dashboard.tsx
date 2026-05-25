import React, { useEffect, useState, useRef } from 'react';
import { Activity, Clock, Flame, Zap, Crosshair, PartyPopper, CloudRain, Play, User, X, Disc3, ChevronLeft, ChevronRight, Music, Radio, History, Mic2, Coffee, Moon, Sun, Sparkles } from 'lucide-react';
import { SmartCover } from './SmartCover';
import { convertFileSrc } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { getTopTracks, TrackData, Playlist, getPlaylists, getGlobalMixer, getYouTubeTrends, getYouTubeMoods, DashboardTrack, cleanTitle, searchYouTube, getSpotifyTopTracks, getSpotifyPlaylists, getLastfmGlobalCharts, getLastfmUserTopTracks, getYoutubeLikedMusic, UnifiedMediaItem } from '../lib/api';
import { usePlayerStore } from '../store/usePlayerStore';

// Skeletons
const SkeletonCard = () => (
  <div style={{
    minWidth: '180px', maxWidth: '180px', padding: '16px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', flexDirection: 'column', gap: '12px'
  }}>
    <div style={{ width: '100%', aspectRatio: '1/1', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out' }} />
    <div style={{ width: '80%', height: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
    <div style={{ width: '50%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
  </div>
);

// Scroll Arrow Utility
const ScrollArrows = ({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) => {
  const scroll = (offset: number) => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => scroll(-400)} className="glass-panel" style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'white', cursor: 'pointer' }}>
        <ChevronLeft size={20} />
      </button>
      <button onClick={() => scroll(400)} className="glass-panel" style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'white', cursor: 'pointer' }}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  // Local Data
  const [topTracks, setTopTracks] = useState<TrackData[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  
  // Remote Data
  const [mixerTracks, setMixerTracks] = useState<DashboardTrack[]>([]);
  const [trendTracks, setTrendTracks] = useState<DashboardTrack[]>([]);
  const [lastfmTracks, setLastfmTracks] = useState<DashboardTrack[]>([]);
  
  const [isMixerLoading, setIsMixerLoading] = useState(true);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);
  const [isLastfmLoading, setIsLastfmLoading] = useState(true);
  
  // Moods
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [moodTracks, setMoodTracks] = useState<DashboardTrack[]>([]);
  const [isMoodLoading, setIsMoodLoading] = useState(false);

  // Auth
  const [authStatuses, setAuthStatuses] = useState<any[]>([]);

  // Modals
  const [artistModal, setArtistModal] = useState<string | null>(null);
  const [artistTracks, setArtistTracks] = useState<any[]>([]);
  const [isArtistLoading, setIsArtistLoading] = useState(false);

  // Refs for scrolling
  const mixerRef = useRef<HTMLDivElement>(null);
  const moodsRef = useRef<HTMLDivElement>(null);
  const trendsRef = useRef<HTMLDivElement>(null);
  const lastfmRef = useRef<HTMLDivElement>(null);

  const { setCurrentTrack } = usePlayerStore();

  useEffect(() => {
    // Add pulse animation style if not present
    if (!document.getElementById('pulse-anim')) {
      const style = document.createElement('style');
      style.id = 'pulse-anim';
      style.innerHTML = `@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 0.3; } 100% { opacity: 0.6; } }`;
      document.head.appendChild(style);
    }

    const loadLocal = async () => {
      try {
        setTopTracks(await getTopTracks(4));
        setPlaylists(await getPlaylists());
      } catch (e) { console.error(e); }
    };
    
    const loadRemote = async () => {
      try {
        const statuses = await invoke<any[]>('get_auth_statuses');
        setAuthStatuses(statuses);
        const spotifyStatus = statuses.find(s => s.provider === 'spotify');
        const lastfmStatus = statuses.find(s => s.provider === 'lastfm');
        const youtubeStatus = statuses.find(s => s.provider === 'youtube');

        const mapUnified = (u: UnifiedMediaItem): DashboardTrack => ({
          id: u.id,
          title: u.title,
          artist: u.artist || 'Unknown',
          platform: u.platform,
          cover_url: u.cover_url || ''
        });

        // 1. Fetch all data independently
        let spTracks: DashboardTrack[] = [];
        let ytTracks: DashboardTrack[] = [];
        let lfTracks: DashboardTrack[] = [];

        if (spotifyStatus?.connected) {
          try {
            const sp = await getSpotifyTopTracks();
            spTracks = sp.map(mapUnified);
          } catch (e) { console.error("Spotify failed", e); }
        }

        if (youtubeStatus?.connected) {
          try {
            const yt = await getYoutubeLikedMusic();
            ytTracks = yt.map(mapUnified);
          } catch (e) { console.error("YouTube failed", e); }
        } else {
          try {
            ytTracks = await getYouTubeTrends();
          } catch (e) { console.error("YouTube fallback failed", e); }
        }

        try {
          const lf = lastfmStatus?.connected && lastfmStatus?.accountName 
              ? await getLastfmUserTopTracks(lastfmStatus.accountName)
              : await getLastfmGlobalCharts();
          lfTracks = lf.map(mapUnified);
        } catch (e) { console.error("Last.fm failed", e); }

        // Update individual carousels
        setTrendTracks(ytTracks);
        setIsTrendsLoading(false);

        setLastfmTracks(lfTracks);
        setIsLastfmLoading(false);

        // Missing covers will now be fetched automatically by SmartCover components on render.

        // 2. Build the true Global Mixer
        let mixed: DashboardTrack[] = [];
        const maxLen = Math.max(spTracks.length, ytTracks.length, lfTracks.length);
        
        for (let i = 0; i < maxLen; i++) {
          if (spTracks[i]) mixed.push(spTracks[i]);
          if (ytTracks[i]) mixed.push(ytTracks[i]);
          if (lfTracks[i]) mixed.push(lfTracks[i]);
        }

        // 3. Fallback to local mixer if nothing remote was found
        if (mixed.length === 0) {
          try {
            mixed = await getGlobalMixer();
          } catch (e) { console.error("Local mixer failed", e); }
        }

        setMixerTracks(mixed);
        setIsMixerLoading(false);

      } catch (err) {
        console.error("Error loading remote info:", err);
      }
    };

    loadLocal();
    loadRemote();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const playRemoteTrack = (t: DashboardTrack) => {
    const query = `${t.artist} - ${cleanTitle(t.title)}`;
    setCurrentTrack({
      id: t.id,
      title: cleanTitle(t.title),
      artist: t.artist,
      duration: 0,
      fileUrl: `ytsearch:${query}`
    });
  };

  const handleMoodClick = async (mood: string) => {
    if (activeMood === mood) {
      setActiveMood(null);
      return;
    }
    setActiveMood(mood);
    setIsMoodLoading(true);
    try {
      const tracks = await getYouTubeMoods(mood);
      setMoodTracks(tracks);
    } catch (e) {
      console.error(e);
    } finally {
      setIsMoodLoading(false);
    }
  };

  const handleArtistClick = async (e: React.MouseEvent, artist: string) => {
    e.stopPropagation();
    setArtistModal(artist);
    setIsArtistLoading(true);
    try {
      const res = await searchYouTube(`${artist} top tracks`);
      setArtistTracks(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsArtistLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'Spotify') return <div style={{width: 12, height: 12, borderRadius: '50%', background: '#1DB954'}} title="Spotify" />;
    if (platform === 'YouTube Music') return <div style={{width: 12, height: 12, borderRadius: '50%', background: '#FF0000'}} title="YouTube Music" />;
    if (platform === 'Last.fm') return <div style={{width: 12, height: 12, borderRadius: '50%', background: '#FFB300'}} title="Last.fm" />;
    return <div style={{width: 12, height: 12, borderRadius: '50%', background: '#888'}} />;
  };

  const renderDashboardCard = (t: DashboardTrack, isVideo = false) => (
    <div 
      key={t.id} 
      className="glass-panel hover-scale" 
      onClick={() => playRemoteTrack(t)}
      style={{ 
        minWidth: isVideo ? '280px' : '180px', maxWidth: isVideo ? '280px' : '180px', 
        padding: '16px', borderRadius: '12px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', flexShrink: 0
      }}
    >
      <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 2 }}>
        {getPlatformIcon(t.platform)}
      </div>
      <SmartCover src={t.cover_url} alt={t.title} artist={t.artist} title={t.title} isVideo={isVideo} />
      <div>
        <h3 style={{ fontSize: '1.05rem', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cleanTitle(t.title)}>
          {cleanTitle(t.title)}
        </h3>
        <p 
          onClick={(e) => handleArtistClick(e, t.artist)}
          style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        >
          {t.artist}
        </p>
      </div>
    </div>
  );

  return (
    <div className="main-content" style={{ padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
      
      {/* HEADER: Dynamic Welcome & Quick Access */}
      <header>
        <h1 style={{ margin: '0 0 24px 0', fontSize: '3rem', fontWeight: 800 }}>
          {getGreeting()}, <span style={{ background: 'linear-gradient(to right, var(--color-accent-primary), var(--color-accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Bornicho</span>
        </h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {topTracks.length === 0 && playlists.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)' }}>No recent local activity.</div>
          ) : (
            <>
              {topTracks.slice(0, 2).map(t => (
                <div key={`quick_${t.id}`} className="glass-panel hover-scale" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', borderRadius: '12px' }} onClick={() => {
                  setCurrentTrack({ id: t.id.toString(), title: t.title || 'Unknown', artist: t.artist || 'Unknown', duration: 0, fileUrl: t.path });
                }}>
                  <div style={{ width: 40, height: 40, background: 'var(--color-accent-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={20} fill="white" />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Local Track</span>
                  </div>
                </div>
              ))}
              {playlists.slice(0, 2).map(p => (
                <div 
                  key={`quick_pl_${p.id}`} 
                  className="glass-panel hover-scale" 
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', borderRadius: '12px' }}
                  onClick={async () => {
                    try {
                      const { getPlaylistTracks } = await import('../lib/api');
                      const tracks = await getPlaylistTracks(p.id);
                      if (tracks.length > 0) {
                        const queueTracks = tracks.map(t => ({
                          id: t.id.toString(),
                          title: t.track_name,
                          artist: t.artist_name || 'Unknown',
                          duration: 0,
                          fileUrl: t.source_url || ''
                        }));
                        usePlayerStore.getState().setQueue(queueTracks);
                        usePlayerStore.getState().setCurrentTrack(queueTracks[0]);
                      } else {
                        alert("Esta playlist no tiene canciones.");
                      }
                    } catch (e) {
                      console.error("Failed to play playlist", e);
                      alert("Error al cargar la playlist.");
                    }
                  }}
                >
                  <SmartCover src={p.cover_url} alt={p.name} artist={undefined} title={p.name} size="40px" />
                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Playlist</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </header>

      {/* ROW 1: Global Mixer */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--color-accent-primary)" />
            {authStatuses.find(s => s.provider === 'spotify')?.connected ? 'Tus Top Tracks (Spotify)' : 'El Mezclador Global'}
          </h2>
          <ScrollArrows containerRef={mixerRef} />
        </div>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>Éxitos del momento intercalados (Spotify, YouTube, Last.fm).</p>
        
        <div ref={mixerRef} style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '16px', scrollbarWidth: 'none' }}>
          {isMixerLoading 
            ? Array.from({length: 6}).map((_, i) => <SkeletonCard key={i} />)
            : mixerTracks.length === 0 ? <p style={{color: 'var(--color-text-secondary)'}}>No se pudo cargar el mezclador global.</p> 
            : mixerTracks.map(t => renderDashboardCard(t))
          }
        </div>
      </section>

      {/* ROW 2: Mood Pills */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <Zap size={24} color="#F5D300" />
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Píldoras de Estado de Ánimo</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {[
            { id: 'Energía', search: 'Energy', icon: <Zap size={18}/>, color: '#FF4500' },
            { id: 'Concentración', search: 'Focus', icon: <Crosshair size={18}/>, color: '#4169E1' },
            { id: 'Fiesta', search: 'Party', icon: <PartyPopper size={18}/>, color: '#9400D3' },
            { id: 'Relax', search: 'Relax', icon: <CloudRain size={18}/>, color: '#20B2AA' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => handleMoodClick(m.search)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '32px',
                border: `1px solid ${activeMood === m.search ? m.color : 'rgba(255,255,255,0.1)'}`,
                background: activeMood === m.search ? `${m.color}33` : 'var(--color-bg-elevated)',
                color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <span style={{ color: m.color }}>{m.icon}</span>
              {m.id}
            </button>
          ))}
        </div>

        {activeMood && (
          <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Selección para ti</h3>
              <ScrollArrows containerRef={moodsRef} />
            </div>
            <div ref={moodsRef} style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '16px', scrollbarWidth: 'none' }}>
              {isMoodLoading 
                ? Array.from({length: 4}).map((_, i) => <SkeletonCard key={i} />)
                : moodTracks.map(t => renderDashboardCard(t, true))
              }
            </div>
          </div>
        )}
      </section>

      {/* ROW 3: YouTube Trends */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Flame color="#FF0000" />
            {authStatuses.find(s => s.provider === 'youtube')?.connected ? 'Tu Música Favorita (YouTube Music)' : 'Tendencias en Vídeo'}
          </h2>
          <ScrollArrows containerRef={trendsRef} />
        </div>
        
        <div ref={trendsRef} style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '16px', scrollbarWidth: 'none' }}>
          {isTrendsLoading 
            ? Array.from({length: 4}).map((_, i) => <div key={i} style={{minWidth: '280px', flexShrink: 0, height: '157px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', animation: 'pulse 1.5s infinite ease-in-out'}} />)
            : trendTracks.length === 0 ? <p style={{color: 'var(--color-text-secondary)'}}>No se pudieron cargar las tendencias.</p>
            : trendTracks.map(t => renderDashboardCard(t, true))
          }
        </div>
      </section>

      {/* ROW 4: Last.fm Top Charts */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Zap color="#D51007" />
            {authStatuses.find(s => s.provider === 'lastfm')?.connected && authStatuses.find(s => s.provider === 'lastfm')?.accountName 
              ? `Tus Artistas Más Escuchados` 
              : 'Top Global (Last.fm)'}
          </h2>
          <ScrollArrows containerRef={lastfmRef} />
        </div>
        
        <div ref={lastfmRef} style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '16px', scrollbarWidth: 'none' }}>
          {isLastfmLoading 
            ? Array.from({length: 6}).map((_, i) => <SkeletonCard key={i} />)
            : lastfmTracks.length === 0 ? <p style={{color: 'var(--color-text-secondary)'}}>No se pudieron cargar los éxitos.</p>
            : lastfmTracks.map(t => renderDashboardCard(t))
          }
        </div>
      </section>

      {/* Artist Modal */}
      {artistModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(15px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }} onClick={() => setArtistModal(null)}>
          <div style={{
            background: 'var(--color-bg-base)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px', width: '90%', maxWidth: '900px', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ height: '200px', flexShrink: 0, background: 'linear-gradient(to bottom, var(--color-accent-primary), var(--color-bg-base))', position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '32px' }}>
              <button 
                onClick={() => setArtistModal(null)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <User size={64} opacity={0.5} />
                </div>
                <div>
                  <span style={{ color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.8rem', fontWeight: 600 }}>Perfil de Artista</span>
                  <h2 style={{ margin: '8px 0 0 0', fontSize: '3rem', fontWeight: 800 }}>{artistModal}</h2>
                </div>
              </div>
            </div>

            <div style={{ padding: '32px', overflowY: 'auto' }}>
              <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.5rem' }}>Top Temas Populares</h3>
              {isArtistLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                  {Array.from({length: 6}).map((_, i) => <div key={i} style={{ height: '64px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />)}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {artistTracks.map((t, idx) => (
                    <div 
                      key={t.id}
                      className="glass-panel hover-scale"
                      onClick={() => {
                        setCurrentTrack({
                          id: t.id,
                          title: cleanTitle(t.title),
                          artist: artistModal,
                          duration: 0,
                          fileUrl: `ytsearch:${artistModal} - ${cleanTitle(t.title)}`
                        });
                      }}
                      style={{ padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                    >
                      <div style={{ width: '30px', color: 'var(--color-text-secondary)', textAlign: 'right', fontWeight: 600 }}>{idx + 1}</div>
                      <SmartCover src={t.thumbnailUrl} alt={t.title} artist={undefined} title={t.title} size="48px" />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanTitle(t.title)}</h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{t.duration || '0:00'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
