import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CharacterList } from "./features/characters/components/character-list/character-list";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CharacterList],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('rick-and-morty-app');
}
