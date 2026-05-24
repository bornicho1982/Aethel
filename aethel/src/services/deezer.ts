export interface DeezerTrack {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
}

export class DeezerService {
    private token: string | null = null;

    async authenticate(token: string): Promise<void> {
        this.token = token;
    }

    async search(query: string): Promise<DeezerTrack[]> {
        return [
            {
                id: 'dz-1',
                title: `${query} - Track 1`,
                artist: 'Deezer Artist',
                album: 'Deezer Album',
                duration: 210
            }
        ];
    }
}
