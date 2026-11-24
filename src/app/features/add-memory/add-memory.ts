import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ImageOptimizerService, type OptimizedImage } from '../../core/images/image-optimizer.service';
import { MemoriesService, type MemoryCategory } from '../../core/memories/memories.service';

@Component({
  selector: 'app-add-memory',
  imports: [ReactiveFormsModule],
  templateUrl: './add-memory.html',
  styleUrl: './add-memory.scss'
})
export class AddMemory implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly imageOptimizer = inject(ImageOptimizerService);
  private readonly memoriesService = inject(MemoriesService);
  private readonly router = inject(Router);
  private successTimer?: ReturnType<typeof setTimeout>;

  readonly categories = signal<MemoryCategory[]>([]);
  readonly optimizedImage = signal<OptimizedImage | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    title: [''],
    description: [''],
    dedication: [''],
    photoDate: [new Date().toISOString().slice(0, 10), Validators.required],
    isFavorite: [false]
  });

  constructor() {
    void this.loadCategories();
  }

  ngOnDestroy(): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
  }

  async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.memoriesService.getCategories());
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No pudimos cargar las categorías.');
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.successMessage.set('');

    if (this.previewUrl()) {
      URL.revokeObjectURL(this.previewUrl() as string);
    }
    this.previewUrl.set(URL.createObjectURL(file));
    this.errorMessage.set('');
    try {
      this.optimizedImage.set(await this.imageOptimizer.optimize(file));
    } catch (error) {
      this.optimizedImage.set(null);
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
    }
  }

  removePreview(): void {
    if (this.previewUrl()) {
      URL.revokeObjectURL(this.previewUrl() as string);
    }
    this.previewUrl.set(null);
    this.optimizedImage.set(null);

    const input = document.querySelector<HTMLInputElement>('#memory-file');
    if (input) input.value = '';
  }

  async createMemory(): Promise<void> {
    if (this.form.invalid || !this.optimizedImage() || this.loading()) {
      this.form.markAllAsTouched();
      if (!this.optimizedImage()) this.errorMessage.set('Seleccioná una imagen.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const value = this.form.getRawValue();
      await this.memoriesService.createMemory({
        categoryId: value.categoryId as number,
        title: value.title,
        description: value.description,
        dedication: value.dedication,
        isFavorite: value.isFavorite,
        photoDate: value.photoDate,
        image: this.optimizedImage() as OptimizedImage
      });
      this.form.reset({
        categoryId: null,
        title: '',
        description: '',
        dedication: '',
        isFavorite: false,
        photoDate: new Date().toISOString().slice(0, 10)
      });
      this.optimizedImage.set(null);
      if (this.previewUrl()) {
        URL.revokeObjectURL(this.previewUrl() as string);
      }
      this.previewUrl.set(null);
      this.successMessage.set('Recuerdo guardado. Volviendo al álbum...');
      this.successTimer = setTimeout(() => {
        void this.router.navigate(['/album'], { queryParams: { saved: 'true' } });
      }, 900);
    } catch (error) {
      console.error(error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos guardar el recuerdo.');
    } finally {
      this.loading.set(false);
    }
  }
}
