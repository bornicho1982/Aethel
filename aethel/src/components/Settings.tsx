import React, { useState } from 'react';
import { Key, Link as LinkIcon, CheckCircle, Database, Server } from 'lucide-react';

export const Settings: React.FC = () => {
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState('');

  const handleSpotifyConnect = () => {
    alert("Phase 9 Spotify OAuth sequence triggered. In a full implementation, this will open your system browser to authenticate via PKCE.");
  };

  return (
    <main className="main-content" style={{ overflowY: 'auto' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '8px', fontWeight: 800 }}>Settings & Providers</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>Configure integrations and app preferences.</p>
      </header>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Database color="var(--color-accent-primary)" />
          Local Data
        </h2>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Manage your local database and cache sizes.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button className="glass-panel" style={{ padding: '8px 16px', color: 'var(--color-text-primary)' }}>Clear Image Cache</button>
            <button className="glass-panel" style={{ padding: '8px 16px', color: 'var(--color-accent-tertiary)' }}>Reset Play History</button>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Server color="var(--color-accent-secondary)" />
          External Providers
        </h2>
        
        {/* Spotify Integration Card */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#1DB954', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinkIcon size={24} color="#000" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Spotify Sync</h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>Sync your playlists and saved tracks.</p>
              </div>
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '24px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} /> Not Connected
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Client ID</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                <input 
                  type="text" 
                  value={spotifyClientId}
                  onChange={(e) => setSpotifyClientId(e.target.value)}
                  placeholder="Enter your Spotify Developer Client ID"
                  style={{ 
                    width: '100%', 
                    padding: '12px 12px 12px 40px', 
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px',
                    color: 'white'
                  }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Client Secret</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                <input 
                  type="password" 
                  value={spotifyClientSecret}
                  onChange={(e) => setSpotifyClientSecret(e.target.value)}
                  placeholder="Enter your Spotify Developer Client Secret"
                  style={{ 
                    width: '100%', 
                    padding: '12px 12px 12px 40px', 
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px',
                    color: 'white'
                  }} 
                />
              </div>
            </div>

            <button 
              onClick={handleSpotifyConnect}
              style={{ 
                marginTop: '16px',
                padding: '12px 24px', 
                background: '#1DB954', 
                color: '#000', 
                fontWeight: 700, 
                border: 'none', 
                borderRadius: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: 'fit-content'
              }}
            >
              <LinkIcon size={18} /> Connect with Spotify
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Note: This requires a free Spotify Developer account to keep your data private.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
