import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, CheckCircle, Database, Server, User, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface AuthStatus {
  provider: string;
  connected: boolean;
  accountName?: string;
  accountPicture?: string;
}

export const Settings: React.FC = () => {
  const [authStatuses, setAuthStatuses] = useState<Record<string, AuthStatus>>({});
  const [isAuthenticating, setIsAuthenticating] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthStatuses();
  }, []);

  const fetchAuthStatuses = async () => {
    try {
      const statuses = await invoke<AuthStatus[]>('get_auth_statuses');
      const statusMap = statuses.reduce((acc, status) => {
        acc[status.provider] = status;
        return acc;
      }, {} as Record<string, AuthStatus>);
      setAuthStatuses(statusMap);
    } catch (e) {
      console.error("Failed to fetch auth statuses", e);
    }
  };

  const handleConnect = async (provider: string) => {
    setIsAuthenticating(provider);
    try {
      await invoke('authenticate_provider', { provider });
      await fetchAuthStatuses();
    } catch (e) {
      console.error(`Authentication failed for ${provider}`, e);
      alert(`Error al conectar con ${provider}: ${e}`);
    } finally {
      setIsAuthenticating(null);
    }
  };

  const renderProviderCard = (name: string, providerId: string, color: string, description: string) => {
    const status = authStatuses[providerId];
    const isConnected = status?.connected;
    const isLoading = isAuthenticating === providerId;

    return (
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', background: color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LinkIcon size={24} color={providerId === 'spotify' ? '#000' : '#fff'} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{name}</h3>
              <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>{description}</p>
            </div>
          </div>
          <div style={{ padding: '8px 16px', background: isConnected ? `${color}22` : 'rgba(255,255,255,0.05)', borderRadius: '24px', color: isConnected ? color : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isConnected ? <CheckCircle size={16} /> : null}
            {isConnected ? 'Conectado' : 'No Conectado'}
          </div>
        </div>

        {isConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
            {status.accountPicture ? (
              <img src={status.accountPicture} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontWeight: 600 }}>Conectado como {status.accountName || 'Usuario'}</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  onClick={() => handleConnect(providerId)} 
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '0.85rem', padding: 0, marginTop: '4px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Reconectar
                </button>
                <button 
                  onClick={async () => {
                    if (confirm(`¿Seguro que quieres desconectar ${name}?`)) {
                      await invoke('disconnect_provider', { provider: providerId });
                      fetchAuthStatuses();
                    }
                  }} 
                  style={{ background: 'none', border: 'none', color: '#ff4444', fontSize: '0.85rem', padding: 0, marginTop: '4px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Desconectar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => handleConnect(providerId)}
            disabled={isLoading}
            style={{ 
              padding: '12px 24px', 
              background: color, 
              color: providerId === 'spotify' ? '#000' : '#fff', 
              fontWeight: 700, 
              border: 'none', 
              borderRadius: '24px',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: 'fit-content',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? <Loader2 size={18} className="spin" /> : <LinkIcon size={18} />}
            {isLoading ? 'Esperando al navegador...' : `Conectar con ${name}`}
          </button>
        )}
      </div>
    );
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

      <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Server color="var(--color-accent-secondary)" />
          External Providers
        </h2>
        
        {renderProviderCard('Spotify Sync', 'spotify', '#1DB954', 'Sincroniza tus playlists y canciones favoritas de Spotify.')}
        {renderProviderCard('YouTube Music Sync', 'youtube', '#FF0000', 'Sincroniza tu biblioteca y Liked Music de YouTube.')}

        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#D51007', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} color="#fff" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Last.fm Stats</h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Introduce tu nombre de usuario para ver tus canciones más escuchadas.</p>
              </div>
            </div>
            <div style={{ padding: '8px 16px', background: authStatuses['lastfm']?.connected ? '#D5100722' : 'rgba(255,255,255,0.05)', borderRadius: '24px', color: authStatuses['lastfm']?.connected ? '#D51007' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {authStatuses['lastfm']?.connected ? <CheckCircle size={16} /> : null}
              {authStatuses['lastfm']?.connected ? `Conectado: ${authStatuses['lastfm']?.accountName}` : 'No Conectado'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <input 
              id="lastfm-username"
              type="text" 
              placeholder="Nombre de usuario Last.fm"
              defaultValue={authStatuses['lastfm']?.accountName || ''}
              style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
            <button 
              onClick={async () => {
                const input = document.getElementById('lastfm-username') as HTMLInputElement;
                if (input.value) {
                  await invoke('save_lastfm_username', { username: input.value });
                  await fetchAuthStatuses();
                }
              }}
              style={{ padding: '12px 24px', background: '#D51007', color: 'white', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Guardar Usuario
            </button>
            {authStatuses['lastfm']?.connected && (
              <button 
                onClick={async () => {
                  if (confirm('¿Seguro que quieres desconectar Last.fm?')) {
                    await invoke('disconnect_provider', { provider: 'lastfm' });
                    const input = document.getElementById('lastfm-username') as HTMLInputElement;
                    if (input) input.value = '';
                    await fetchAuthStatuses();
                  }
                }}
                style={{ padding: '12px 24px', background: 'transparent', color: '#ff4444', fontWeight: 700, border: '1px solid #ff4444', borderRadius: '8px', cursor: 'pointer' }}
              >
                Desconectar
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
