export interface LocationData {
  name: string;
  url: string;
}

export interface Character {
  id: number;
  name: string;
  status: 'Alive' | 'Dead' | 'unknown';
  species: string;
  type: string;
  gender: 'Female' | 'Male' | 'Genderless' | 'unknown';
  origin: LocationData;
  location: LocationData;
  image: string;
  episode: string[];
  url: string;
  created: string;
}

export interface ApiResponse {
  info: {
    count: number;
    pages: number;
    next: string | null;
    prev: string | null;
  };
  results: Character[];
}
export interface characterStat {
  name: string;
  value: number;
}

export interface CharacterListItem {
  id: number;
  name: string;
  url: string;
}

export interface CharacterListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CharacterListItem[];
}

export type ViewMode = 'scroll' | 'paged';
