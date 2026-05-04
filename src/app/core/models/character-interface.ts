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
