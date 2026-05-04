import { TitleCasePipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { CharacterViewItem } from '../../services/character'; // Verifica que la ruta sea correcta según tu estructura

@Component({
  selector: 'app-character-card',
  imports: [TitleCasePipe],
  templateUrl: './character-card.html',
  styleUrls: ['./character-card.css'],
})
export class CharacterCard {
  character = input.required<CharacterViewItem>();

  isFavorite = input<boolean>(false);

  toggleFavorite = output<number>();

  showStats = signal<boolean>(false);

  onToggleFavorite() {
    this.toggleFavorite.emit(this.character().id);
  }
}
