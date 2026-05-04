import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CharacterListItem, CharacterListResponse } from '../../../core/models/character-interface';

interface CharacterTypeListResponse {
  results: CharacterListItem[];
}

interface CharacterDetailsResponse {
  id: number;
  name: string;
  types: { type: { name: string } }[];
}

type ViewMode = 'scroll' | 'paged';

export interface CharacterViewItem extends CharacterListItem {
  id: number;
  imageUrl: string;
  types?: string[];
  status?: string;
  species?: string;
  gender?: string;
  originName?: string;
  episodes?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class CharacterService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://rickandmortyapi.com/api/character';
  private readonly LOCATION_URL = 'https://rickandmortyapi.com/api/location';
  private readonly EPISODE_URL = 'https://rickandmortyapi.com/api/episode';
  private readonly PAGE_SIZE = 20;

  private offset = 0;
  private typeOffset = 0;
  private locationOffset = 0;
  private combinedOffset = 0;
  private locationCache = new Map<string, CharacterListItem[]>();
  private episodeCache = new Map<string, CharacterListItem[]>();
  private searchTimeout?: ReturnType<typeof setTimeout>;
  private readonly MIN_SEARCH_LENGTH = 2;
  private searchNotFound = new Set<string>();

  characterList = signal<CharacterViewItem[]>([]);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  hasMore = signal<boolean>(true);
  episodeCharacters: CharacterListItem[] = [];
  locationCharacters: CharacterListItem[] = [];
  combinedCharacters: CharacterListItem[] = [];
  searchQuery = signal<string>('');
  favorites = signal<number[]>([]);
  showFavoritesOnly = signal<boolean>(false);
  searchResults = signal<CharacterViewItem[]>([]);
  types = signal<CharacterListItem[]>([]);
  selectedEpisode = signal<string>('all');
  locations = signal<CharacterListItem[]>([]);
  selectedLocation = signal<string>('all');
  viewMode = signal<ViewMode>('scroll');
  currentPage = signal<number>(1);
  totalCount = signal<number>(0);
  totalPages = computed(() => {
    const total = this.totalCount();
    return total > 0 ? Math.ceil(total / this.PAGE_SIZE) : 1;
  });

  filteredCharacters = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    let list = this.characterList();
    if (query) {
      list = this.mergeSearchResults(list, this.searchResults());
    }
    if (this.showFavoritesOnly()) {
      list = list.filter((character) => this.favorites().includes(character.id));
    }

    if (!query) {
      return list;
    }

    return list.filter(
      (character) =>
        character.name.toLowerCase().includes(query) || character.id.toString().includes(query),
    );
  });

  constructor() {
    const savefavorites = localStorage.getItem('favorites');
    if (savefavorites) {
      this.favorites.set(JSON.parse(savefavorites));
    }
    effect(() => {
      localStorage.setItem('favorites', JSON.stringify(this.favorites()));
    });
  }

  init() {
    this.loadEpisodes();
    this.resetPagination();
    this.reloadFromFilter();
    this.loadLocations();
  }
  loadLocations() {
    if (this.locations().length > 0) return;
    this.http.get<any>(this.LOCATION_URL).subscribe({
      next: (response) => {
        // Guardamos los resultados en la señal de locations
        this.locations.set(response.results);
      },
      error: (error) => console.error('Error loading locations:', error),
    });
  }

  setViewMode(mode: ViewMode) {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);

    this.offset = 0;
    this.typeOffset = 0;
    this.locationOffset = 0;
    this.combinedOffset = 0;
    this.resetPagination();
    this.characterList.set([]);
    this.currentPage.set(1);
    this.hasMore.set(true);
    this.reloadFromFilter();
    this.refreshSearchResults();
  }

  loadEpisodes() {
    if (this.types().length > 0) return;

    this.http.get<CharacterTypeListResponse>(this.EPISODE_URL).subscribe({
      next: (response) => {
        const cleanTypes = response.results.filter(
          (type) => type.name !== 'unknown' && type.name !== 'shadow',
        );
        this.types.set(cleanTypes);
      },
      error: (error) => console.error('Error loading types:', error),
    });
  }

  setTypeFilter(type: string) {
    if (this.selectedEpisode() === type) return;
    this.selectedEpisode.set(type);
    this.resetPagination();
    this.reloadFromFilter();
    this.searchResults.set([]);
    this.refreshSearchResults();
  }

  setLocationFilter(location: string) {
    if (this.selectedLocation() === location) return;
    this.selectedLocation.set(location);
    this.resetPagination();
    this.reloadFromFilter();
    this.searchResults.set([]);
    this.refreshSearchResults();
  }

  loadNextPage() {
    if (this.viewMode() !== 'scroll') return;
    if (this.isLoading() || this.isLoadingMore() || !this.hasMore()) return;

    const isInitial = this.characterList().length === 0;
    const loadingSignal = isInitial ? this.isLoading : this.isLoadingMore;
    loadingSignal.set(true);

    // ESTA ES LA LÍNEA QUE DEBES ASEGURARTE DE TENER:
    const episodeActive = this.selectedEpisode() !== 'all';
    const locationActive = this.selectedLocation() !== 'all';

    if (episodeActive && locationActive) {
      if (!this.combinedCharacters.length) {
        this.buildCombinedList();
      }
      if (!this.combinedCharacters.length) {
        loadingSignal.set(false);
        return;
      }
      this.loadNextFromCombined(loadingSignal);
      return;
    }

    if (locationActive) {
      if (!this.locationCharacters.length) {
        loadingSignal.set(false);
        return;
      }
      this.loadNextFromLocation(loadingSignal);
      return;
    }

    if (!episodeActive) {
      // Rick and Morty usa ?page= en lugar de limit/offset
      // Calculamos la página actual basándonos en el offset
      const pageToLoad = Math.floor(this.offset / this.PAGE_SIZE) + 1;

      this.http.get<any>(`${this.API_URL}?page=${pageToLoad}`).subscribe({
        next: (response) => {
          // En esta API, los resultados vienen en response.results
          const mappedResults = this.mapToViewItems(response.results);
          this.characterList.update((list) => [...list, ...mappedResults]);

          // Actualizamos el offset para la siguiente carga
          this.offset += this.PAGE_SIZE;

          // El conteo total está en response.info.count
          this.totalCount.set(response.info.count);

          // Verificamos si hay una página siguiente en response.info.next
          this.hasMore.set(Boolean(response.info.next));

          this.currentPage.set(pageToLoad);
          loadingSignal.set(false);
        },
        error: (error) => {
          console.error('Error loading characters:', error);
          loadingSignal.set(false);
        },
      });
      return;
    }

    if (!this.episodeCharacters.length) {
      loadingSignal.set(false);
      return;
    }

    const nextSlice = this.episodeCharacters.slice(
      this.typeOffset,
      this.typeOffset + this.PAGE_SIZE,
    );
    const mappedResults = this.mapToViewItems(nextSlice);
    this.characterList.update((list) => [...list, ...mappedResults]);
    this.typeOffset += this.PAGE_SIZE;
    this.totalCount.set(this.episodeCharacters.length);
    this.hasMore.set(this.typeOffset < this.episodeCharacters.length);
    this.currentPage.set(Math.max(1, Math.ceil(this.typeOffset / this.PAGE_SIZE)));
    loadingSignal.set(false);
  }

  loadPage(page: number) {
    // 1. Definimos targetPage para que TypeScript sepa qué es
    const targetPage = page;

    const episodeActive = this.selectedEpisode() !== 'all';
    const locationActive = this.selectedLocation() !== 'all';

    if (!episodeActive && !locationActive) {
      this.isLoading.set(true);

      // 2. Usamos targetPage en la URL de Rick y Morty
      this.http.get<any>(`${this.API_URL}?page=${targetPage}`).subscribe({
        next: (response) => {
          const mappedResults = this.mapToViewItems(response.results);
          this.characterList.set(mappedResults);

          this.totalCount.set(response.info.count);
          this.currentPage.set(targetPage);
          this.hasMore.set(Boolean(response.info.next));
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error al cargar la página:', error);
          this.isLoading.set(false);
        },
      });
      return;
    }

    if (!episodeActive) {
      const offset = (targetPage - 1) * this.PAGE_SIZE;
      this.isLoading.set(true);
      this.http
        .get<CharacterListResponse>(`${this.API_URL}?limit=${this.PAGE_SIZE}&offset=${offset}`)
        .subscribe({
          next: (response) => {
            const mappedResults = this.mapToViewItems(response.results);
            this.characterList.set(mappedResults);
            this.totalCount.set(response.count);
            this.currentPage.set(targetPage);
            this.hasMore.set(targetPage < this.totalPages());
            this.isLoading.set(false);
          },
          error: (error) => {
            console.error('Error loading characters:', error);
            this.isLoading.set(false);
          },
        });
      return;
    }

    if (!this.episodeCharacters.length) {
      this.loadEpisodeList(this.selectedEpisode());
      return;
    }

    this.applyEpisodePage(targetPage);
  }
  private fetchCharactersByContext(
    url: string,
    cache: Map<string, any[]>,
    contextKey: string,
    dataKey: 'characters' | 'residents',
    targetArray: 'episodeCharacters' | 'locationCharacters',
  ) {
    const cached = cache.get(contextKey);
    if (cached) {
      this[targetArray] = cached;
      this.totalCount.set(cached.length);
      this.applyFiltersAfterLoad();
      return;
    }

    this.isLoading.set(true);
    this.http.get<any>(`${url}/${contextKey}`).subscribe({
      next: (response) => {
        const urls = response[dataKey] || [];
        const characterIds = urls
          .map((url: string) => url.split('/').filter(Boolean).pop())
          .join(',');

        if (!characterIds) {
          this[targetArray] = [];
          this.isLoading.set(false);
          this.totalCount.set(0);
          this.hasMore.set(false);
          this.applyFiltersAfterLoad();
          return;
        }

        this.http.get<any>(`${this.API_URL}/${characterIds}`).subscribe({
          next: (charsResponse) => {
            const charsArray = Array.isArray(charsResponse) ? charsResponse : [charsResponse];
            cache.set(contextKey, charsArray);
            this[targetArray] = charsArray;

            this.isLoading.set(false);
            this.totalCount.set(charsArray.length);
            this.hasMore.set(charsArray.length > 0);
            this.applyFiltersAfterLoad();
          },
          error: () => this.isLoading.set(false),
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.hasMore.set(false);
      },
    });
  }
  private loadEpisodeList(episode: string) {
    this.fetchCharactersByContext(
      this.EPISODE_URL,
      this.episodeCache,
      episode,
      'characters',
      'episodeCharacters',
    );
  }

  private loadLocationList(location: string) {
    this.fetchCharactersByContext(
      this.LOCATION_URL,
      this.locationCache,
      location,
      'residents',
      'locationCharacters',
    );
  }

  private resetPagination() {
    this.typeOffset = 0;
    this.locationOffset = 0;
    this.combinedOffset = 0;
    this.episodeCharacters = [];
    this.locationCharacters = [];
    this.combinedCharacters = [];
    this.hasMore.set(true);
    this.characterList.set([]);
    this.currentPage.set(1);
    this.totalCount.set(0);
    this.isLoading.set(false);
    this.isLoadingMore.set(false);
  }

  private reloadFromFilter() {
    if (this.selectedEpisode() === 'all' && this.selectedLocation() === 'all') {
      if (this.viewMode() === 'paged') {
        this.loadPage(1);
      } else {
        this.loadNextPage();
      }
      return;
    }

    if (this.selectedEpisode() !== 'all') {
      this.loadEpisodeList(this.selectedEpisode());
    }
    if (this.selectedLocation() !== 'all') {
      this.loadLocationList(this.selectedLocation());
    }
  }

  private applyEpisodePage(page: number) {
    const totalPages = this.totalPages();
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * this.PAGE_SIZE;
    const slice = this.episodeCharacters.slice(start, start + this.PAGE_SIZE);
    this.characterList.set(this.mapToViewItems(slice));
    this.currentPage.set(safePage);
    this.hasMore.set(safePage < totalPages);
  }

  private applyLocationPage(page: number) {
    const totalPages = this.totalPages();
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * this.PAGE_SIZE;
    const slice = this.locationCharacters.slice(start, start + this.PAGE_SIZE);
    this.characterList.set(this.mapToViewItems(slice));
    this.currentPage.set(safePage);
    this.hasMore.set(safePage < totalPages);
  }

  private applyCombinedPage(page: number) {
    const totalPages = this.totalPages();
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * this.PAGE_SIZE;
    const slice = this.combinedCharacters.slice(start, start + this.PAGE_SIZE);
    this.characterList.set(this.mapToViewItems(slice));
    this.currentPage.set(safePage);
    this.hasMore.set(safePage < totalPages);
  }

  private mapToViewItems(list: any[]): CharacterViewItem[] {
    return list.map((character) => {
      const id = parseInt(character.url.split('/').filter(Boolean).pop() || '0', 10);
      return {
        ...character,
        id,
        imageUrl: `https://rickandmortyapi.com/api/character/avatar/${id}.jpeg`,

        status: character.status || 'Desconocido',
        species: character.species || 'Desconocido',
        gender: character.gender || 'Desconocido',
        originName: character.origin?.name || 'Desconocido',
        episodes: character.episode
          ? character.episode.map((url: string) => url.split('/').filter(Boolean).pop())
          : [],
      };
    });
  }

  private applyFiltersAfterLoad() {
    const episodeActive = this.selectedEpisode() !== 'all';
    const locationActive = this.selectedLocation() !== 'all';

    if (episodeActive && locationActive) {
      if (!this.episodeCharacters.length || !this.locationCharacters.length) return;
      this.buildCombinedList();
      if (this.viewMode() === 'paged') {
        this.applyCombinedPage(this.currentPage());
      } else {
        this.loadNextFromLocation(this.isLoading);
      }
      return;
    }

    if (episodeActive) {
      if (this.viewMode() === 'paged') {
        this.applyEpisodePage(this.currentPage());
      } else {
        this.loadNextPage();
      }
      return;
    }

    if (locationActive) {
      if (this.viewMode() === 'paged') {
        this.applyLocationPage(this.currentPage());
      } else {
        this.loadNextFromLocation(this.isLoading);
      }
    }
  }

  private buildCombinedList() {
    const locationSet = new Set(this.locationCharacters.map((character) => character.name));
    this.combinedCharacters = this.episodeCharacters.filter((character) =>
      locationSet.has(character.name),
    );
    this.totalCount.set(this.combinedCharacters.length);
    this.hasMore.set(this.combinedCharacters.length > 0);
  }

  private loadNextFromLocation(loadingSignal: { set: (value: boolean) => void }) {
    const nextSlice = this.locationCharacters.slice(
      this.locationOffset,
      this.locationOffset + this.PAGE_SIZE,
    );
    const mappedResults = this.mapToViewItems(nextSlice);
    this.characterList.update((list) => [...list, ...mappedResults]);
    this.locationOffset += this.PAGE_SIZE;
    this.totalCount.set(this.locationCharacters.length);
    this.hasMore.set(this.locationOffset < this.locationCharacters.length);
    this.currentPage.set(Math.max(1, Math.ceil(this.locationOffset / this.PAGE_SIZE)));
    loadingSignal.set(false);
  }

  private loadNextFromCombined(loadingSignal: { set: (value: boolean) => void }) {
    const nextSlice = this.combinedCharacters.slice(
      this.combinedOffset,
      this.combinedOffset + this.PAGE_SIZE,
    );
    const mappedResults = this.mapToViewItems(nextSlice);
    this.characterList.update((list) => [...list, ...mappedResults]);
    this.combinedOffset += this.PAGE_SIZE;
    this.totalCount.set(this.combinedCharacters.length);
    this.hasMore.set(this.combinedOffset < this.combinedCharacters.length);
    this.currentPage.set(Math.max(1, Math.ceil(this.combinedOffset / this.PAGE_SIZE)));
    loadingSignal.set(false);
  }

  updateSearch(term: string) {
    this.searchQuery.set(term);
    const normalized = this.normalizeQuery(term);

    if (!normalized) {
      this.searchResults.set([]);
      return;
    }

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.requestSearch(normalized);
    }, 350);
  }

  toggleFavorite(id: number) {
    this.favorites.update((favs) => {
      if (favs.includes(id)) {
        return favs.filter((favId) => favId !== id);
      }
      return [...favs, id];
    });
  }
  toggleFavoriteview() {
    this.showFavoritesOnly.update((val) => !val);
  }

  private refreshSearchResults() {
    const normalized = this.normalizeQuery(this.searchQuery());
    if (!normalized) return;
    this.requestSearch(normalized);
  }

  private normalizeQuery(term: string): string {
    return term.toLowerCase().trim();
  }

  private requestSearch(query: string) {
    if (!this.shouldFetchQuery(query)) return;

    this.http.get<CharacterDetailsResponse>(`${this.API_URL}/${query}`).subscribe({
      next: (response) => {
        const types = response.types.map((entry) => entry.type.name);
        if (this.selectedEpisode() !== 'all' && !types.includes(this.selectedEpisode())) {
          return;
        }

        const result: CharacterViewItem = {
          id: response.id,
          name: response.name,
          url: `${this.API_URL}/${response.id}/`,
          imageUrl: `https://rickandmortyapi.com/api/character/avatar/${response.id}.jpeg`,
          types,
        };

        this.addSearchResult(result);
      },
      error: (error) => {
        if (error?.status === 404) {
          this.searchNotFound.add(query);
          return;
        }
        console.error('Error searching pokemon:', error);
      },
    });
  }

  private shouldFetchQuery(query: string): boolean {
    if (!query) return false;
    if (this.searchNotFound.has(query)) return false;

    const isNumeric = /^[0-9]+$/.test(query);
    if (!isNumeric && query.length < this.MIN_SEARCH_LENGTH) return false;

    const inList = this.characterList().some(
      (character) => character.name === query || character.id.toString() === query,
    );
    if (inList) return false;

    const inSearchResults = this.searchResults().some(
      (character) => character.name === query || character.id.toString() === query,
    );

    return !inSearchResults;
  }

  private addSearchResult(result: CharacterViewItem) {
    this.searchResults.update((list) =>
      list.some((character) => character.id === result.id) ? list : [...list, result],
    );
  }

  private mergeSearchResults(
    list: CharacterViewItem[],
    extras: CharacterViewItem[],
  ): CharacterViewItem[] {
    if (extras.length === 0) return list;
    const existingIds = new Set(list.map((character) => character.id));
    const merged = [...list];
    for (const extra of extras) {
      if (!existingIds.has(extra.id)) {
        merged.push(extra);
      }
    }
    return merged;
  }
}
