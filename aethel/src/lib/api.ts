import { invoke } from '@tauri-apps/api/core';

export interface TrackData {
  id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
}

/**
 * Scans a directory for music files and adds them to the database.
 * @param path The absolute path to the directory to scan.
 * @returns The number of tracks found and added.
 */
export const scanDirectory = async (path: string): Promise<number> => {
  try {
    return await invoke<number>('scan_directory', { path });
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
};

/**
 * Fetches all tracks from the database.
 * @returns A list of TrackData objects.
 */
export const getTracks = async (): Promise<TrackData[]> => {
  try {
    return await invoke<TrackData[]>('get_tracks');
  } catch (error) {
    console.error('Error fetching tracks:', error);
    throw error;
  }
};

/**
 * Fetches the port of the local streaming server.
 */
export const getServerPort = async (): Promise<number> => {
  return await invoke<number>('get_server_port');
};

export const logPlay = async (trackId: number, duration: number): Promise<void> => {
  return await invoke('log_play', { trackId, duration });
};

export const getTopTracks = async (limit: number = 10): Promise<TrackData[]> => {
  return await invoke<TrackData[]>('get_top_tracks', { limit });
};

export const getRecentTracks = async (limit: number = 10): Promise<TrackData[]> => {
  return await invoke<TrackData[]>('get_recent_tracks', { limit });
};

export const resolveAudioStream = async (query: string): Promise<string> => {
  return await invoke<string>('resolve_audio_stream', { query });
};

export const deleteTrack = async (id: number, moveToTrash: boolean): Promise<void> => {
  return await invoke('delete_track', { id, moveToTrash });
};

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  duration?: number;
}

export const searchYouTube = async (query: string): Promise<YouTubeSearchResult[]> => {
  try {
    return await invoke<YouTubeSearchResult[]>('search_youtube', { query });
  } catch (e) {
    console.error('Failed to search YouTube', e);
    return [];
  }
};

// Búsqueda en YouTube local (Rust fallback)
export const searchYoutubeMusic = async (query: string): Promise<DashboardTrack[]> => {
  try {
    const results = await invoke<DashboardTrack[]>('get_youtube_trends', { query });
    return results;
  } catch (error) {
    console.error('Error fetching youtube search:', error);
    return [];
  }
};

export interface UnifiedMediaItem {
  id: string;
  title: string;
  artist?: string;
  cover_url?: string;
  platform: string;
  item_type: string;
}

export const getSpotifyTopTracks = async (): Promise<UnifiedMediaItem[]> => {
  return await invoke<UnifiedMediaItem[]>('get_spotify_top_tracks');
};

export const getSpotifyPlaylists = async (): Promise<UnifiedMediaItem[]> => {
  return invoke('get_spotify_playlists');
};

export const getLastfmGlobalCharts = async (): Promise<UnifiedMediaItem[]> => {
  return invoke('get_lastfm_global_charts');
};

export const getLastfmUserTopTracks = async (username: string): Promise<UnifiedMediaItem[]> => {
  return invoke('get_lastfm_user_top_tracks', { username });
};

export const getYoutubeLikedMusic = async (): Promise<UnifiedMediaItem[]> => {
  return invoke('get_youtube_liked_music');
};

export const getLyrics = async (title: string, artist: string): Promise<string> => {
  return invoke('get_lyrics', { title, artist });
};

export interface LyricsData {
  id?: number;
  trackName?: string;
  artistName?: string;
  syncedLyrics?: string;
  plainLyrics?: string;
}

export const fetchLyrics = async (artist: string, track: string): Promise<LyricsData | null> => {
  try {
    return await invoke<LyricsData | null>('fetch_lyrics', { artist, track });
  } catch (e) {
    console.error('Failed to fetch lyrics', e);
    return null;
  }
};

export const fetchCoverArt = async (artist: string, album: string): Promise<string | null> => {
  try {
    return await invoke<string | null>('fetch_cover_art', { artist, album });
  } catch (e) {
    console.error('Failed to fetch cover art', e);
    return null;
  }
};

export interface Playlist {
  id: number;
  name: string;
  cover_url: string | null;
}

export interface PlaylistTrack {
  id: number;
  track_name: string;
  artist_name: string | null;
  source_url: string | null;
  cover_url: string | null;
}

export const getPlaylists = async (): Promise<Playlist[]> => {
  return await invoke<Playlist[]>('get_playlists');
};

export const getPlaylistTracks = async (playlistId: number): Promise<PlaylistTrack[]> => {
  return await invoke<PlaylistTrack[]>('get_playlist_tracks', { playlistId });
};

export const removePlaylistTrack = async (id: number): Promise<void> => {
  return await invoke<void>('remove_playlist_track', { id });
};

export const deletePlaylist = async (id: number): Promise<void> => {
  return await invoke('delete_playlist', { id });
};

export const updatePlaylistCover = async (id: number, sourcePath: string): Promise<void> => {
  return await invoke('update_playlist_cover', { id, sourcePath });
};

export const updateTrackCover = async (id: number, sourcePath: string): Promise<void> => {
  return await invoke('update_track_cover', { id, sourcePath });
};

export const importExternalPlaylist = async (url: string): Promise<Playlist> => {
  return await invoke<Playlist>('import_external_playlist', { url });
};

export interface ItunesTrackInfo {
  trackName: string | null;
  artistName: string | null;
  collectionName: string | null;
  releaseDate: string | null;
  primaryGenreName: string | null;
  trackTimeMillis: number | null;
  artworkUrl100: string | null;
}

export const fetchTrackInfo = async (artist: string, track: string): Promise<ItunesTrackInfo | null> => {
  try {
    return await invoke<ItunesTrackInfo | null>('fetch_track_info', { artist, track });
  } catch (e) {
    console.error('Failed to fetch track info', e);
    return null;
  }
};

export interface DashboardTrack {
  id: string;
  title: string;
  artist: string;
  platform: string;
  cover_url: string | null;
}

export const getGlobalMixer = async (): Promise<DashboardTrack[]> => {
  try {
    return await invoke<DashboardTrack[]>('get_global_mixer');
  } catch (e) {
    console.error('Global mixer error:', e);
    return [];
  }
};

export const getYouTubeTrends = async (): Promise<DashboardTrack[]> => {
  try {
    const res: any[] = await invoke('search_youtube', { query: 'top trending music videos 2025' });
    return res.map((v, i) => ({
      id: `trend_${i}_${v.id}`,
      title: v.title,
      artist: v.channel || 'YouTube Music',
      platform: 'YouTube Music',
      cover_url: v.thumbnail || null,
    }));
  } catch (e) {
    console.error('Failed to get YouTube trends', e);
    return [];
  }
};

export const getYouTubeMoods = async (mood: string): Promise<DashboardTrack[]> => {
  const res: any[] = await invoke('search_youtube', { query: mood + ' music playlist' });
  return res.map((v, i) => ({
    id: `mood_${i}_${v.id}`,
    title: v.title,
    artist: v.channelTitle || 'YouTube Music',
    platform: 'YouTube Music',
    cover_url: v.thumbnailUrl || null,
  }));
};

export const cleanTitle = (title: string): string => {
  if (!title) return '';
  const cleanRegex = /\s*(\(|\[)?\s*(official\s+video|official\s+audio|official\s+music\s+video|official\s+lyric\s+video|audio|lyrics?|lyric\s+video|remix|hd|4k|\d{4})\s*(\)|\])?/gi;
  return title.replace(cleanRegex, '').trim();
};
