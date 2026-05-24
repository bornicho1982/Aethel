import { create } from 'zustand';
import { Track } from './usePlayerStore';

interface ExploreState {
  searchQuery: string;
  isSearching: boolean;
  results: Track[];
  
  setSearchQuery: (query: string) => void;
  setIsSearching: (isSearching: boolean) => void;
  setResults: (results: Track[]) => void;
}

export const useExploreStore = create<ExploreState>((set) => ({
  searchQuery: '',
  isSearching: false,
  results: [],

  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setResults: (results) => set({ results }),
}));
