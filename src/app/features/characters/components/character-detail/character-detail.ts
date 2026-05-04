import { Component, input, resource } from '@angular/core';
import { Character } from '../../../../core/models/character-interface';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-character-detail',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink],
  template: `
    <button routerLink="/">⬅ Volver al catálogo</button>

    @if (characterResource.isLoading()) {
      <p>Cargando detalles del personaje...</p>
    } @else if (characterResource.error()) {
      <p>Error: No se pudo cargar el personaje.</p>
    } @else if (characterResource.value(); as character) {
      <div class="detail-layout">
        <div class="main-info">
          <!-- Eliminamos el $any ya que el tipado ahora es correcto -->
          <img
            [ngSrc]="character.image"
            width="300"
            height="300"
            alt="{{ character.name }}"
            priority
          />
          <h2>{{ character.name }}</h2>
          <ul>
            <li><strong>Estado:</strong> {{ character.status }}</li>
            <li><strong>Especie:</strong> {{ character.species }}</li>
            <li><strong>Género:</strong> {{ character.gender }}</li>
            <li><strong>Origen:</strong> {{ character.origin.name }}</li>
          </ul>
        </div>

        @defer (on viewport) {
          <div class="episodes-section">
            <h3>Apariciones ({{ character.episode.length }} episodios)</h3>
            <ul class="episode-list">
              @for (episodeUrl of character.episode; track episodeUrl) {
                <li>Episodio #{{ episodeUrl.split('/').pop() }}</li>
              }
            </ul>
          </div>
        } @placeholder {
          <div class="placeholder">Desplázate hacia abajo para ver los episodios...</div>
        } @loading {
          <p>Cargando episodios...</p>
        }
      </div>
    }
  `,
  styles: [
    `
      .detail-layout {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        margin-top: 1rem;
        align-items: center;
      }
      .main-info {
        text-align: center;
      }
      .main-info img {
        border-radius: 8px;
      }
      ul {
        list-style: none;
        padding: 0;
      }
      .episodes-section {
        margin-top: 50vh;
        margin-bottom: 50px;
      }
      .episode-list {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .placeholder {
        padding: 2rem;
        background: #eee;
        text-align: center;
      }
    `,
  ],
})
export class CharacterDetailComponent {
  // Recibe el ID directamente desde el Router (con withComponentInputBinding habilitado en app.config.ts)
  id = input.required<string>();

  // Consumo de datos con Resource API
  characterResource = resource({
    // 1. Cambiamos 'request' por 'params'
    params: () => ({ id: this.id() }),

    // 2. Extraemos 'params' en lugar de 'request'
    loader: async ({ params }) => {
      // 3. Usamos params.id en tu fetch
      const response = await fetch(`https://rickandmortyapi.com/api/character/${params.id}`);
      if (!response.ok) throw new Error('Personaje no encontrado');
      return (await response.json()) as Character;
    },
  });
}
