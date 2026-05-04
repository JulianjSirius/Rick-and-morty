import { TitleCasePipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { CharacterViewItem } from '../../services/favorites';
import { CharacterDetailComponent } from '../character-detail/character-detail';

@Component({
  selector: 'app-character-card',
  imports: [TitleCasePipe,],
  templateUrl: './character-card.html',
  styleUrls: ['./character-card.css'],
})
export class CharacterCard {
  character = input.required<CharacterDetailComponent>();

  isFavorite = input<boolean>(false);

  toggleFavorite = output<string>();

  showStats = signal<boolean>(false);

  onToggleFavorite() {
    this.toggleFavorite.emit(this.character().id());
  }
}
