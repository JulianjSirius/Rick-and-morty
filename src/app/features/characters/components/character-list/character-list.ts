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

  @ViewChild('scrollSentinel', { static: false }) // Cambiado a false para asegurar que esté en el DOM
  scrollSentinel!: ElementRef<HTMLDivElement>;

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.characterService.init();
  }

  ngAfterViewInit(): void {
    // Usamos el Observer porque es más preciso que calcular pixeles a mano
    this.observer = new IntersectionObserver(
      (entries) => {
        const sentinel = entries[0];
        // Si el centinela es visible Y el modo es scroll Y NO estamos cargando ya
        if (
          sentinel.isIntersecting && 
          this.characterService.viewMode() === 'scroll' &&
          !this.characterService.isLoading() // Importante: no pedir si ya está cargando
        ) {
          this.characterService.loadNextPage();
        }
      },
      { 
        root: null, // usa el viewport del navegador
        rootMargin: '400px', // Carga 400px antes de llegar al final para que sea fluido
        threshold: 0.1 
      }
    );

    if (this.scrollSentinel) {
      this.observer.observe(this.scrollSentinel.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  // ELIMINA EL @HostListener('window:scroll')
  // Ya no lo necesitas, el IntersectionObserver hace el trabajo mejor.

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
