import React, { useEffect, useState, useMemo } from 'react';
import { Folder, ArrowLeft, Plus, LayoutGrid, List, Trash2 } from 'lucide-react';
import { getTracks, scanDirectory, deleteTrack, TrackData } from '../lib/api';
import { usePlayerStore, Track } from '../store/usePlayerStore';
import { open } from '@tauri-apps/plugin-dialog';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  track?: TrackData;
  children?: Map<string, FileNode>;
}

export const Library: React.FC = () => {
  const [allTracks, setAllTracks] = useState<TrackData[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('root');
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('aethel_view_mode') as 'grid' | 'list') || 'grid';
  });
  
  const [libraryRoots, setLibraryRoots] = useState<string[]>(() => {
    const saved = localStorage.getItem('aethel_library_roots');
    return saved ? JSON.parse(saved) : [];
  });
  
  const { setCurrentTrack, setQueue } = usePlayerStore();

  const fetchTracks = async () => {
    try {
      const tracks = await getTracks();
      setAllTracks(tracks);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const handleToggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('aethel_view_mode', mode);
  };

  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Folder to Add to Library',
      });
      
      if (!selected) return;
      
      const path = Array.isArray(selected) ? selected[0] : selected;
      
      if (!libraryRoots.includes(path)) {
        const newRoots = [...libraryRoots, path];
        setLibraryRoots(newRoots);
        localStorage.setItem('aethel_library_roots', JSON.stringify(newRoots));
      }
      
      setIsLoading(true);
      const count = await scanDirectory(path);
      alert(count > 0 ? `Added ${count} new tracks!` : `Folder scanned successfully.`);
      await fetchTracks();
    } catch (error) {
      alert(`Failed to scan directory: ${error}`);
      setIsLoading(false);
    }
  };

  const handleRemoveRoot = (e: React.MouseEvent, pathToRemove: string) => {
    e.stopPropagation();
    const newRoots = libraryRoots.filter(r => r !== pathToRemove);
    setLibraryRoots(newRoots);
    localStorage.setItem('aethel_library_roots', JSON.stringify(newRoots));
    
    if (currentPath.startsWith(pathToRemove)) {
      setCurrentPath('root');
    }
  };

  const handleDeleteTrack = async (e: React.MouseEvent, trackId: number) => {
    e.stopPropagation();
    try {
      await deleteTrack(trackId, false);
      setAllTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (error) {
      alert(`Failed to delete track: ${error}`);
    }
  };

  const fileTree = useMemo(() => {
    const root: FileNode = { name: 'root', path: 'root', isDirectory: true, children: new Map() };
    
    libraryRoots.forEach(rootPath => {
       const rootName = rootPath.split('/').pop() || rootPath;
       root.children!.set(rootName, {
           name: rootName,
           path: rootPath,
           isDirectory: true,
           children: new Map()
       });
    });

    allTracks.forEach(track => {
      const matchingRoot = libraryRoots.find(r => track.path.startsWith(r + '/'));
      if (!matchingRoot) return; 

      const rootName = matchingRoot.split('/').pop() || matchingRoot;
      let current = root.children!.get(rootName)!;
      let currentPathStr = matchingRoot;

      const relativePath = track.path.substring(matchingRoot.length + 1);
      const parts = relativePath.split('/');
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        currentPathStr += `/${part}`;
        
        if (!current.children!.has(part)) {
          current.children!.set(part, {
            name: part,
            path: currentPathStr,
            isDirectory: true,
            children: new Map()
          });
        }
        current = current.children!.get(part)!;
      }
      
      const fileName = parts[parts.length - 1];
      currentPathStr += `/${fileName}`;
      current.children!.set(fileName, {
        name: fileName,
        path: track.path,
        isDirectory: false,
        track: track
      });
    });
    
    return root;
  }, [allTracks, libraryRoots]);

  const currentDirectoryNode = useMemo(() => {
    if (currentPath === 'root') return fileTree;
    
    const matchingRoot = libraryRoots.find(r => currentPath.startsWith(r));
    if (!matchingRoot) return null;

    const rootName = matchingRoot.split('/').pop() || matchingRoot;
    let current = fileTree.children!.get(rootName);
    
    if (!current) return null;

    if (currentPath === matchingRoot) return current;

    const relativePath = currentPath.substring(matchingRoot.length + 1);
    const parts = relativePath.split('/').filter(Boolean);
    
    for (const part of parts) {
      if (current!.children && current!.children.has(part)) {
        current = current!.children.get(part)!;
      } else {
        return null;
      }
    }
    return current;
  }, [currentPath, fileTree, libraryRoots]);

  const items = useMemo(() => {
    if (!currentDirectoryNode || !currentDirectoryNode.children) return [];
    return Array.from(currentDirectoryNode.children.values()).sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [currentDirectoryNode]);

  const navigateUp = () => {
    if (currentPath === 'root') return;
    
    const matchingRoot = libraryRoots.find(r => currentPath === r);
    if (matchingRoot) {
      setCurrentPath('root');
      return;
    }

    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath('/' + parts.join('/'));
  };

  const handleItemClick = (item: FileNode) => {
    if (item.isDirectory) {
      setCurrentPath(item.path);
    } else if (item.track) {
      const directoryTracks: Track[] = items
        .filter(i => !i.isDirectory && i.track)
        .map(i => ({
          id: i.track!.id.toString(),
          title: i.track!.title || i.track!.path.split('/').pop() || 'Unknown Track',
          artist: i.track!.artist || 'Unknown Artist',
          album: i.track!.album || undefined,
          duration: 0,
          fileUrl: i.track!.path
        }));
        
      setQueue(directoryTracks);
      
      setCurrentTrack({
        id: item.track.id.toString(),
        title: item.track.title || item.track.path.split('/').pop() || 'Unknown Track',
        artist: item.track.artist || 'Unknown Artist',
        album: item.track.album || undefined,
        duration: 0,
        fileUrl: item.track.path
      });
    }
  };

  const renderGridItem = (item: FileNode) => (
    <div 
      key={item.path}
      className="glass-panel"
      onClick={() => handleItemClick(item)}
      style={{
        position: 'relative', padding: '24px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '16px', cursor: 'pointer', borderRadius: '16px',
        textAlign: 'center', transition: 'transform 0.2s, background 0.2s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        const trash = e.currentTarget.querySelector('.trash-btn') as HTMLElement;
        if (trash) trash.style.opacity = '1';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        const trash = e.currentTarget.querySelector('.trash-btn') as HTMLElement;
        if (trash) trash.style.opacity = '0';
      }}
    >
      {item.isDirectory && currentPath === 'root' && (
        <button
          onClick={(e) => handleRemoveRoot(e, item.path)}
          style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff6b6b',
            width: '24px', height: '24px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
          title="Remove folder from library"
        >×</button>
      )}

      {!item.isDirectory && item.track && (
        <button
          className="trash-btn"
          onClick={(e) => handleDeleteTrack(e, item.track!.id)}
          style={{
            position: 'absolute', top: '8px', right: '8px', opacity: 0, transition: 'opacity 0.2s',
            background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff6b6b',
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
          title="Delete track"
        >
          <Trash2 size={16} />
        </button>
      )}
      
      {item.isDirectory ? (
        <div style={{ color: 'var(--color-accent-primary)' }}><Folder size={64} /></div>
      ) : (
        <div style={{ 
          width: '64px', height: '64px', 
          background: 'linear-gradient(135deg, var(--color-accent-tertiary), var(--color-bg-base))', 
          borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>🎵</div>
      )}
      
      <div style={{ width: '100%' }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.isDirectory ? item.name : item.track?.title || item.name}
        </div>
        {!item.isDirectory && item.track?.artist && (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.track.artist}
          </div>
        )}
      </div>
    </div>
  );

  const renderListItem = (item: FileNode) => (
    <div 
      key={item.path}
      className="glass-panel"
      onClick={() => handleItemClick(item)}
      style={{
        display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '16px',
        cursor: 'pointer', borderRadius: '12px', transition: 'background 0.2s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        const trash = e.currentTarget.querySelector('.trash-btn') as HTMLElement;
        if (trash) trash.style.opacity = '1';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        const trash = e.currentTarget.querySelector('.trash-btn') as HTMLElement;
        if (trash) trash.style.opacity = '0';
      }}
    >
      {item.isDirectory ? (
        <div style={{ color: 'var(--color-accent-primary)', display: 'flex' }}><Folder size={24} /></div>
      ) : (
        <div style={{ color: 'var(--color-accent-tertiary)', display: 'flex' }}>🎵</div>
      )}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
          {item.isDirectory ? item.name : item.track?.title || item.name}
        </span>
        {!item.isDirectory && item.track?.artist && (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            {item.track.artist}
          </span>
        )}
      </div>

      {item.isDirectory && currentPath === 'root' && (
        <button
          onClick={(e) => handleRemoveRoot(e, item.path)}
          style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '8px' }}
          title="Remove folder"
        >×</button>
      )}

      {!item.isDirectory && item.track && (
        <button
          className="trash-btn"
          onClick={(e) => handleDeleteTrack(e, item.track!.id)}
          style={{
            background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '8px',
            opacity: 0, transition: 'opacity 0.2s'
          }}
          title="Delete track"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );

  return (
    <main className="main-content" style={{ overflowY: 'auto' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '3rem', marginBottom: '8px', fontWeight: 800 }}>Library</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>Browse your local music folders.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="glass-panel" style={{ display: 'flex', padding: '4px', borderRadius: '8px' }}>
            <button 
              onClick={() => handleToggleView('grid')}
              style={{
                background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', color: viewMode === 'grid' ? 'white' : 'var(--color-text-secondary)',
                padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => handleToggleView('list')}
              style={{
                background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', color: viewMode === 'list' ? 'white' : 'var(--color-text-secondary)',
                padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <List size={18} />
            </button>
          </div>

          <button 
            onClick={handleAddFolder}
            className="glass-panel"
            style={{ 
              padding: '12px 20px', color: 'var(--color-bg-base)', background: 'var(--color-accent-secondary)',
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none', fontWeight: 600
            }}
          >
            <Plus size={18} />
            Add Folder
          </button>
        </div>
      </header>

      {/* Path Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px' }}>
        <button 
          onClick={navigateUp}
          disabled={currentPath === 'root'}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
            width: '40px', height: '40px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: currentPath === 'root' ? 'not-allowed' : 'pointer', opacity: currentPath === 'root' ? 0.5 : 1
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontSize: '1.1rem', fontFamily: 'monospace', color: 'var(--color-accent-secondary)' }}>
          {currentPath === 'root' ? 'My Folders' : currentPath}
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading library...</div>
      ) : currentPath === 'root' && libraryRoots.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          Your library is empty. Click 'Add Folder' to import your music.
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          This folder is empty.
        </div>
      ) : (
        <div style={{ 
          display: viewMode === 'grid' ? 'grid' : 'flex', 
          gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : 'none', 
          flexDirection: viewMode === 'list' ? 'column' : 'row',
          gap: '16px' 
        }}>
          {items.map(item => viewMode === 'grid' ? renderGridItem(item) : renderListItem(item))}
        </div>
      )}
    </main>
  );
};
