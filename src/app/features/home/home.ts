
import { Component, inject, OnInit, signal } from '@angular/core';
import { MemoriesService, type Memory } from '../../core/memories/memories.service';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit {

  private readonly memoriesService = inject(MemoriesService);

  readonly memories = signal<Memory[]>([]);
  readonly errorMessage = signal('');
  readonly flippedCards = signal<Set<string>>(new Set());
  readonly selectedMemory = signal<Memory | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(window.innerWidth <= 600 ? 6 : 8);

  private resizeHandler = () => {
    const nextSize = window.innerWidth <= 600 ? 6 : 8;
    if (nextSize !== this.pageSize()) {
      this.pageSize.set(nextSize);
      this.page.set(1);
    }
  };
  async ngOnInit(): Promise<void> {
    window.addEventListener('resize', this.resizeHandler);
    await this.loadPage();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
  }

  async loadPage(): Promise<void> {
    try {
      this.memories.set(await this.memoriesService.getMemories());
    } catch (error) {
      console.error('Error cargando recuerdos:', error);
      this.errorMessage.set('No pudimos cargar tus recuerdos.');
    }
  }

  toggleCard(id: string): void {
    const updated = new Set(this.flippedCards());
    updated.has(id) ? updated.delete(id) : updated.add(id);
    this.flippedCards.set(updated);
  }

  openPhoto(memory: Memory): void {
    this.selectedMemory.set(memory);
  }

  closePhoto(): void {
    this.selectedMemory.set(null);
  }

  get favoriteMemories(): Memory[] {
    return this.memories().filter(memory => memory.is_favorite);
  }

  get pagedFavoriteMemories(): Memory[] {
    const start = (this.page() - 1) * this.pageSize();
    return this.favoriteMemories.slice(start, start + this.pageSize());
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.favoriteMemories.length / this.pageSize()));
  }

  nextPage(): void {
    if (this.page() < this.totalPages) this.page.update(value => value + 1);
  }

  previousPage(): void {
    if (this.page() > 1) this.page.update(value => value - 1);
  }
}
