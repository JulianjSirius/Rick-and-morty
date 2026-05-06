import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CharacterService } from '../../services/character';
import { CharacterCard } from '../character-card/character-card';

@Component({
  selector: 'app-character-list',
  imports: [CharacterCard],
  templateUrl: './character-list.html',
  styleUrl: './character-list.css',
})
export class CharacterList implements OnInit, AfterViewInit, OnDestroy {
  characterService = inject(CharacterService);

  @ViewChild('scrollSentinel', { static: false })
  scrollSentinel!: ElementRef<HTMLDivElement>;

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.characterService.init();
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        const sentinel = entries[0];
        if (
          sentinel.isIntersecting &&
          this.characterService.viewMode() === 'scroll' &&
          !this.characterService.isLoading() &&
          !this.characterService.isLoadingMore()
        ) {
          this.characterService.loadNextPage();
        }
      },
      {
        root: null, // usa el viewport del navegador
        rootMargin: '300px 0px', // Pre-carga mas arriba del scroll
        threshold: 0,
      },
    );

    if (this.scrollSentinel) {
      this.observer.observe(this.scrollSentinel.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  onSearch(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.characterService.updateSearch(inputElement.value);
  }

  onTypeChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.characterService.setTypeFilter(selectElement.value);
  }

  onLocationChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.characterService.setLocationFilter(selectElement.value);
  }

  setViewMode(mode: 'scroll' | 'paged') {
    this.characterService.setViewMode(mode);
  }

  goToPreviousPage() {
    this.characterService.loadPage(this.characterService.currentPage() - 1);
  }

  goToNextPage() {
    this.characterService.loadPage(this.characterService.currentPage() + 1);
  }
}
