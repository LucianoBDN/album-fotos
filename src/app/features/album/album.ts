import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MemoriesService, type Memory, type MemoryCategory } from '../../core/memories/memories.service';

@Component({
  selector: 'app-album',
  imports: [],
  templateUrl: './album.html',
  styleUrl: './album.scss'
})
export class Album implements OnInit, OnDestroy {
  private readonly memoriesService = inject(MemoriesService);

  readonly memories = signal<Memory[]>([]);
  readonly categories = signal<MemoryCategory[]>([]);
  readonly categoryId = signal<number | null>(null);
  readonly year = signal<string>('all');
  readonly page = signal(1);
  readonly pageSize = signal(window.innerWidth <= 600 ? 8 : 12);
  readonly selectedMemory = signal<Memory | null>(null);
  readonly selectedDedication = signal<Memory | null>(null);
  readonly flippedCards = signal<Set<string>>(new Set());
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly loading = signal(true);
  readonly imageLoaded = signal<Set<string>>(new Set());
  private readonly route = inject(ActivatedRoute);

  private resizeHandler = () => {
    const nextSize = window.innerWidth <= 600 ? 8 : 12;
    if (nextSize !== this.pageSize()) {
      this.pageSize.set(nextSize);
      this.page.set(1);
    }
  };

  async ngOnInit(): Promise<void> {
    window.addEventListener('resize', this.resizeHandler);
    this.successMessage.set(
      this.route.snapshot.queryParamMap.has('saved')
        ? 'Recuerdo guardado correctamente.'
        : ''
    );
    await this.loadPage();
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const [memories, categories] = await Promise.all([
        this.memoriesService.getMemories(),
        this.memoriesService.getCategories()
      ]);
      this.memories.set(memories);
      this.categories.set(categories);
    } catch (error) {
      console.error('Error cargando el álbum:', error);
      this.errorMessage.set(
        error instanceof Error
          ? `No pudimos cargar el álbum: ${error.message}`
          : 'No pudimos cargar el álbum. Intentá nuevamente.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  markImageLoaded(memoryId: string): void {
    this.imageLoaded.update(ids => {
      const next = new Set(ids);
      next.add(memoryId);
      return next;
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
  }

  setCategory(categoryId: number | null): void {
    this.categoryId.set(categoryId);
    this.page.set(1);
  }

  setYear(year: string): void {
    this.year.set(year);
    this.page.set(1);
  }

  get years(): string[] {
    return [...new Set(this.memories().map(memory => memory.photo_date.slice(0, 4)))].sort().reverse();
  }

  get filteredMemories(): Memory[] {
    return this.memories().filter(memory => {
      const matchesCategory = this.categoryId() === null || memory.category_id === this.categoryId();
      const matchesYear = this.year() === 'all' || memory.photo_date.startsWith(this.year());
      return matchesCategory && matchesYear;
    });
  }

  get pagedMemories(): Memory[] {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredMemories.slice(start, start + this.pageSize());
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredMemories.length / this.pageSize()));
  }

  previousPage(): void {
    if (this.page() > 1) this.page.update(value => value - 1);
  }

  nextPage(): void {
    if (this.page() < this.totalPages) this.page.update(value => value + 1);
  }

  openPhoto(memory: Memory): void {
    this.selectedMemory.set(memory);
  }

  closePhoto(): void {
    this.selectedMemory.set(null);
  }

  toggleCard(id: string): void {
    if (window.matchMedia('(max-width: 600px)').matches) {
      const memory = this.memories().find(item => item.id === id);
      if (memory) this.selectedDedication.set(memory);
      return;
    }

    const updated = new Set(this.flippedCards());
    updated.has(id) ? updated.delete(id) : updated.add(id);
    this.flippedCards.set(updated);
  }

  async toggleFavorite(memory: Memory): Promise<void> {
    const nextValue = !memory.is_favorite;
    try {
      await this.memoriesService.setFavorite(memory.id, nextValue);
      this.memories.update(items =>
        items.map(item =>
          item.id === memory.id
            ? { ...item, is_favorite: nextValue }
            : item
        )
      );
    } catch (error) {
      console.error('Error cambiando favorito:', error);
      this.errorMessage.set('No pudimos actualizar el favorito.');
    }
  }
}
