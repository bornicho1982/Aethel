import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { getServerPort, logPlay } from '../lib/api';

// Create a singleton audio instance
const audio = new window.Audio();

let cachedServerPort: number | null = null;
let hasLoggedCurrentTrack = false;
getServerPort().then(port => cachedServerPort = port).catch(console.error);

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverArt?: string;
  duration: number; // in seconds
  fileUrl: string;
  isRemote?: boolean;
}

interface PlayerState {
  isPlaying: boolean;
  volume: number; // 0 to 1
  currentTime: number; // in seconds
  currentTrack: Track | null;
  queue: Track[];
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isExpanded: boolean;
  currentLyrics: string | null;
  currentHdCover: string | null;
  isLoading: boolean;
  
  // Actions
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleExpanded: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  seek: (time: number) => void;
  setCurrentTrack: (track: Track) => void;
  _finalizeTrackPlay: (track: Track) => void;
  setQueue: (tracks: Track[]) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: 'off' | 'all' | 'one') => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  currentTrack: null,
  queue: [
    {
      id: 'mock-1',
      title: 'Neon Nights',
      artist: 'Cyber Synth',
      duration: 242, // 4:02
      fileUrl: '#'
    }
  ], // Adding a mock track for initial display
  isMuted: false,
  isShuffled: false,
  repeatMode: 'off',
  isExpanded: false,
  currentLyrics: null,
  currentHdCover: null,
  isLoading: false,

  play: () => {
    if (get().currentTrack) {
      audio.play().catch(console.error);
      set({ isPlaying: true });
      invoke('update_mpris_playback', { isPlaying: true }).catch(console.error);
    }
  },
  pause: () => {
    audio.pause();
    set({ isPlaying: false });
    invoke('update_mpris_playback', { isPlaying: false }).catch(console.error);
  },
  togglePlay: () => {
    const state = get();
    if (state.isPlaying) {
      state.pause();
    } else {
      state.play();
    }
  },
  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
  setVolume: (volume) => {
    const vol = Math.max(0, Math.min(1, volume));
    audio.volume = vol;
    set({ volume: vol, isMuted: vol === 0 });
  },
  toggleMute: () => {
    const state = get();
    if (state.isMuted) {
      audio.volume = state.volume;
      set({ isMuted: false });
    } else {
      audio.volume = 0;
      set({ isMuted: true });
    }
  },
  seek: (time) => {
    audio.currentTime = time;
    set({ currentTime: time });
  },
  setCurrentTrack: async (track) => {
    try {
      set({ isLoading: true });
      audio.pause();
      
      const isActuallyRemote = track.isRemote || track.fileUrl.startsWith('ytsearch:');
      
      if (isActuallyRemote) {
        import('../lib/api').then(async ({ resolveAudioStream }) => {
          try {
            // If it's explicitly a ytsearch: URL, use that as the query.
            // Otherwise construct the query from artist and title.
            const query = track.fileUrl.startsWith('ytsearch:') 
              ? track.fileUrl.replace('ytsearch:', '') 
              : `${track.artist} ${track.title}`;
              
            const streamUrl = await resolveAudioStream(query);
            if (!streamUrl) {
              throw new Error("Stream URL is empty");
            }
            audio.src = streamUrl;
            get()._finalizeTrackPlay(track);
          } catch (e) {
            console.error("Failed to resolve remote stream:", e);
            set({ isPlaying: false, isLoading: false });
            alert(`Failed to resolve audio: ${e}`);
          }
        });
        return;
      }
      
      if (track.fileUrl.startsWith('/')) {
        const port = cachedServerPort || await import('../lib/api').then(m => m.getServerPort());
        cachedServerPort = port;
        audio.src = `http://127.0.0.1:${port}${track.fileUrl}`;
      } else {
        audio.src = track.fileUrl;
      }
      
      get()._finalizeTrackPlay(track);
    } catch (error) {
      console.error('Error setting current track:', error);
      set({ isPlaying: false, isLoading: false });
    }
  },
  _finalizeTrackPlay: (track: Track) => {
    audio.play().catch(console.error);
    
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('update_mpris_metadata', { 
        title: track.title, 
        artist: track.artist, 
        album: track.album || '', 
        length: track.duration 
      }).catch(console.error);
      invoke('update_mpris_playback', { isPlaying: true }).catch(console.error);
    });

    set({ 
      currentTrack: track, 
      currentTime: 0, 
      isPlaying: true,
      currentLyrics: null,
      currentHdCover: null,
      isLoading: false
    });
    hasLoggedCurrentTrack = false;

    import('../lib/api').then(({ fetchLyrics, fetchCoverArt }) => {
      if (track.artist) {
        fetchLyrics(track.artist, track.title).then(lyrics => {
          if (lyrics?.syncedLyrics || lyrics?.plainLyrics) {
            set({ currentLyrics: lyrics.syncedLyrics || lyrics.plainLyrics });
          }
        });
        if (track.album) {
          fetchCoverArt(track.artist, track.album).then(cover => {
            if (cover) set({ currentHdCover: cover });
          });
        }
      }
    });
  },
  setQueue: (tracks) => set({ queue: tracks }),
  nextTrack: async () => {
    const { queue, currentTrack, isShuffled, repeatMode } = get();
    if (!queue.length) return;
    
    if (repeatMode === 'one' && currentTrack) {
      audio.currentTime = 0;
      audio.play().catch(console.error);
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    let nextIndex = 0;
    if (currentTrack) {
      const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
      if (isShuffled) {
        nextIndex = Math.floor(Math.random() * queue.length);
      } else {
        nextIndex = currentIndex + 1;
        if (nextIndex >= queue.length) {
          if (repeatMode === 'all') {
            nextIndex = 0;
          } else {
            // End of queue, stop playing
            audio.pause();
            audio.currentTime = 0;
            set({ isPlaying: false, currentTime: 0 });
            return;
          }
        }
      }
    }
    
    const nextTrack = queue[nextIndex];
    get().setCurrentTrack(nextTrack);
  },
  previousTrack: async () => {
    const { queue, currentTrack, currentTime } = get();
    if (!queue.length) return;
    
    // If playing for more than 3 seconds, previous goes to start of current song
    if (currentTime > 3 || !currentTrack) {
      audio.currentTime = 0;
      set({ currentTime: 0 });
      return;
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1; // Wrap around to end
    }

    const prevTrack = queue[prevIndex];
    get().setCurrentTrack(prevTrack);
  },
  toggleShuffle: () => set((state) => ({ isShuffled: !state.isShuffled })),
  setRepeatMode: (mode) => set({ repeatMode: mode }),
}));

// Add event listeners to sync time periodically
audio.addEventListener('timeupdate', () => {
  usePlayerStore.setState({ currentTime: audio.currentTime });
  
  // Log play if listened to for > 30 seconds or > 50% of the track
  if (!hasLoggedCurrentTrack && audio.duration > 0) {
    if (audio.currentTime > 30 || audio.currentTime > (audio.duration / 2)) {
      const state = usePlayerStore.getState();
      if (state.currentTrack) {
        logPlay(Number(state.currentTrack.id), audio.duration).catch(console.error);
        hasLoggedCurrentTrack = true;
      }
    }
  }
});

// Capture actual duration when audio loads, but don't overwrite remote tracks which already have precise durations
audio.addEventListener('loadedmetadata', () => {
  if (isFinite(audio.duration) && audio.duration > 0) {
    const current = usePlayerStore.getState().currentTrack;
    if (current && (!current.isRemote || current.duration === 0)) {
      usePlayerStore.setState({ 
        currentTrack: { ...current, duration: audio.duration } 
      });
    }
  }
});

audio.addEventListener('ended', () => {
  usePlayerStore.getState().nextTrack();
});

audio.addEventListener('error', (e) => {
  const err = audio.error;
  let msg = 'Unknown Error';
  if (err) {
    switch (err.code) {
      case err.MEDIA_ERR_ABORTED: msg = 'Playback aborted by user'; break;
      case err.MEDIA_ERR_NETWORK: msg = 'Network error loading audio'; break;
      case err.MEDIA_ERR_DECODE: msg = 'Error decoding audio (corrupted or unsupported format)'; break;
      case err.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = 'Audio source not supported or blocked by CORS/security'; break;
      default: msg = 'Error code: ' + err.code;
    }
  }
  alert(`Audio Playback Error: ${msg}\nSource: ${audio.src}`);
});

