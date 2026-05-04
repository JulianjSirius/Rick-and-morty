import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CharacterService } from '../../services/favorites';
import { CharacterCard } from "../character-card/character-card";

@Component({
  selector: 'app-character-list',
  imports: [CharacterCard],
  templateUrl: './character-list.html',
  styleUrl: './character-list.css',
})
export class CharacterList implements OnInit, AfterViewInit, OnDestroy {
  characterService = inject(CharacterService);

  @ViewChild('scrollSentinel', { static: true })
  scrollSentinel!: ElementRef<HTMLDivElement>;

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.characterService.init();
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (
          this.characterService.viewMode() === 'scroll' &&
          entries.some((entry) => entry.isIntersecting)
        ) {
          this.characterService.loadNextPage();
        }
      },
      { rootMargin: '300px' },
    );

    this.observer.observe(this.scrollSentinel.nativeElement);
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

  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.characterService.viewMode() !== 'scroll') return;

    const threshold = 50;
    const position = window.innerHeight + window.scrollY;
    const height = document.body.offsetHeight;

    if (height - position <= threshold) {
      this.characterService.loadNextPage();
    }
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