import React, { useState, useEffect } from 'react';
import { Disc3 } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { fetchCoverArt } from '../lib/api';

interface SmartCoverProps {
  src?: string | null;
  alt: string;
  artist?: string;
  title?: string;
  size?: string | number;
  isVideo?: boolean;
}

export const SmartCover: React.FC<SmartCoverProps> = ({ src, alt, artist, title, size = '100%', isVideo = false }) => {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const resolveCover = async () => {
      // 1. If it's a star placeholder or missing, try to fetch it
      if (!src || src.includes('star') || src.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
        if (artist && title) {
          try {
            const fetchedCover = await fetchCoverArt(artist, title);
            if (isMounted && fetchedCover) {
              setCurrentSrc(fetchedCover);
              return;
            }
          } catch (e) {
            console.error("SmartCover fetch failed", e);
          }
        }
      }
      
      // 2. If it's a valid URL, use it
      if (src && !src.includes('star') && !src.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
        if (isMounted) setCurrentSrc(src);
      }
    };

    resolveCover();
    
    return () => {
      isMounted = false;
    };
  }, [src, artist, title]);

  if (!currentSrc || error) {
    return (
      <div style={{
        width: size, aspectRatio: isVideo ? '16/9' : '1/1',
        background: 'linear-gradient(135deg, var(--color-accent-tertiary), var(--color-bg-base))',
        borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Disc3 size={32} opacity={0.5} />
      </div>
    );
  }

  const finalSrc = currentSrc.startsWith('http') ? currentSrc : convertFileSrc(currentSrc);

  return (
    <img 
      src={finalSrc} 
      alt={alt} 
      onError={() => setError(true)}
      style={{
        width: size,
        aspectRatio: isVideo ? '16/9' : '1/1',
        objectFit: 'cover',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        display: 'block'
      }}
      loading="lazy"
    />
  );
};
