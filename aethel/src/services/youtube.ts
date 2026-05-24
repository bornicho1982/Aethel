export interface YouTubeVideo {
    id: string;
    title: string;
    channelTitle: string;
    duration: string;
    thumbnailUrl: string;
}

export class YouTubeService {
    private token: string | null = null;

    async authenticate(token: string): Promise<void> {
        this.token = token;
    }

    async searchMusic(query: string): Promise<YouTubeVideo[]> {
        // Return mock videos
        return [
            {
                id: 'vid-1',
                title: `${query} - Official Music Video`,
                channelTitle: 'ArtistVEVO',
                duration: '3:45',
                thumbnailUrl: 'https://example.com/thumb1.jpg'
            },
            {
                id: 'vid-2',
                title: `${query} - Live Performance`,
                channelTitle: 'LiveMusic',
                duration: '4:20',
                thumbnailUrl: 'https://example.com/thumb2.jpg'
            },
            {
                id: 'vid-3',
                title: `${query} (Lyric Video)`,
                channelTitle: 'LyricsChannel',
                duration: '3:50',
                thumbnailUrl: 'https://example.com/thumb3.jpg'
            }
        ];
    }
    
    async search(query: string): Promise<YouTubeVideo[]> {
        return this.searchMusic(query);
    }
}
