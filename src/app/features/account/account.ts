import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { supabase } from '../../core/supabase/supabase.client';
import {
  MemoriesService,
  type Memory,
  type MemoryCategory
} from '../../core/memories/memories.service';

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule],
  templateUrl: './account.html',
  styleUrl: './account.scss'
})
export class Account implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly memoriesService = inject(MemoriesService);

  readonly memories = signal<Memory[]>([]);
  readonly categories = signal<MemoryCategory[]>([]);
  readonly activeSection = signal<'profile' | 'memories' | 'categories'>('profile');
  readonly editingMemory = signal<Memory | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly loading = signal(false);
  readonly ownUserId = signal<string | null>(null);
  readonly pendingMemoryDelete = signal<Memory | null>(null);
  readonly pendingCategoryDelete = signal<MemoryCategory | null>(null);

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(30)]]
  });

  readonly memoryForm = this.fb.nonNullable.group({
    title: ['', Validators.maxLength(80)],
    description: [''],
    dedication: [''],
    photoDate: ['', Validators.required],
    categoryId: [null as number | null, Validators.required],
    isFavorite: [false]
  });

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }


  async loadData(): Promise<void> {
    try {
      await this.auth.initialize();
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      this.ownUserId.set(sessionData.session?.user.id ?? this.auth.userId);

      const [memories, categories] = await Promise.all([
        this.memoriesService.getMemories(),
        this.memoriesService.getCategories()
      ]);
      this.memories.set(memories);
      this.categories.set(categories);
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No pudimos cargar los datos de la cuenta.');
    }
  }

  setSection(section: 'profile' | 'memories' | 'categories'): void {
    this.activeSection.set(section);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  get ownMemories(): Memory[] {
    const userId = this.ownUserId();
    if (!userId) return [];
    return this.memories().filter(memory => memory.user_id === userId);
  }

  beginMemoryEdit(memory: Memory): void {
    this.editingMemory.set(memory);
    this.memoryForm.reset({
      title: memory.title ?? '',
      description: memory.description ?? '',
      dedication: memory.dedication ?? '',
      photoDate: memory.photo_date,
      categoryId: memory.category_id,
      isFavorite: memory.is_favorite
    });
  }

  cancelMemoryEdit(): void {
    this.editingMemory.set(null);
  }

  async saveMemory(): Promise<void> {
    const memory = this.editingMemory();
    if (!memory || this.memoryForm.invalid) {
      this.memoryForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const value = this.memoryForm.getRawValue();
      await this.memoriesService.updateMemory(memory.id, {
        categoryId: value.categoryId as number,
        title: value.title,
        description: value.description,
        dedication: value.dedication,
        photoDate: value.photoDate,
        isFavorite: value.isFavorite
      });
      this.successMessage.set('Recuerdo actualizado.');
      this.editingMemory.set(null);
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos actualizar el recuerdo.');
    } finally {
      this.loading.set(false);
    }
  }

  requestMemoryDelete(memory: Memory): void {
    this.pendingMemoryDelete.set(memory);
  }

  cancelMemoryDelete(): void {
    this.pendingMemoryDelete.set(null);
  }

  async confirmMemoryDelete(): Promise<void> {
    const memory = this.pendingMemoryDelete();
    if (!memory) return;

    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.memoriesService.deleteMemory(memory);
      this.successMessage.set('Recuerdo eliminado.');
      this.pendingMemoryDelete.set(null);
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos eliminar el recuerdo.');
    } finally {
      this.loading.set(false);
    }
  }

  async createCategory(): Promise<void> {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.memoriesService.createCategory(this.categoryForm.controls.name.value);
      this.categoryForm.reset({ name: '' });
      this.successMessage.set('Categoría creada.');
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos crear la categoría.');
    } finally {
      this.loading.set(false);
    }
  }

  async renameCategory(category: MemoryCategory): Promise<void> {
    const name = window.prompt('Nuevo nombre de la categoría', category.name)?.trim();
    if (!name) return;

    try {
      await this.memoriesService.updateCategory(category.id, name);
      this.successMessage.set('Categoría renombrada.');
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos renombrar la categoría.');
    }
  }

  async deleteCategory(category: MemoryCategory): Promise<void> {
    this.pendingCategoryDelete.set(category);
  }

  cancelCategoryDelete(): void {
    this.pendingCategoryDelete.set(null);
  }

  async confirmCategoryDelete(): Promise<void> {
    const category = this.pendingCategoryDelete();
    if (!category) return;

    try {
      await this.memoriesService.deleteCategory(category.id);
      this.successMessage.set('Categoría eliminada.');
      this.pendingCategoryDelete.set(null);
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos eliminar la categoría.');
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
