import { Injectable } from '@angular/core';
import { supabase } from '../supabase/supabase.client';
import type { OptimizedImage } from '../images/image-optimizer.service';

export interface MemoryCategory {
  id: number;
  name: string;
  slug: string;
}

export interface Memory {
  id: string;
  user_id: string;
  category_id: number;
  title: string | null;
  description: string | null;
  dedication: string | null;
  is_favorite: boolean;
  image_key: string;
  image_type: string;
  image_size: number;
  photo_date: string;
  created_at: string;
  updated_at: string;
  imageUrl?: string;
}

export interface CreateMemoryInput {
  categoryId: number;
  title: string;
  description: string;
  dedication: string;
  isFavorite: boolean;
  photoDate: string;
  image: OptimizedImage;
}

@Injectable({
  providedIn: 'root'
})
export class MemoriesService {
  async updateMemory(
    memoryId: string,
    changes: {
      categoryId: number;
      title: string;
      description: string;
      dedication: string;
      photoDate: string;
      isFavorite: boolean;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('memories')
      .update({
        category_id: changes.categoryId,
        title: changes.title.trim() || null,
        description: changes.description.trim() || null,
        dedication: changes.dedication.trim() || null,
        photo_date: changes.photoDate,
        is_favorite: changes.isFavorite
      })
      .eq('id', memoryId);

    if (error) throw error;
  }

  async deleteMemory(memory: Memory): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error('Iniciá sesión para eliminar recuerdos.');
    if (memory.user_id !== userId) {
      throw new Error('Solo el usuario que subió el recuerdo puede eliminarlo.');
    }

    const { error: deleteError } = await supabase
      .from('memories')
      .delete()
      .eq('id', memory.id)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    const { error: storageError } = await supabase.storage
      .from('memories')
      .remove([memory.image_key]);

    if (storageError) throw storageError;
  }

  async createCategory(name: string): Promise<MemoryCategory> {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Escribí el nombre de la categoría.');

    const slug = cleanName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `categoria-${Date.now()}`;

    const { data, error } = await supabase
      .from('memory_categories')
      .insert({ name: cleanName, slug })
      .select('id,name,slug')
      .single();

    if (error) throw error;
    return data as MemoryCategory;
  }

  async updateCategory(categoryId: number, name: string): Promise<MemoryCategory> {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Escribí el nombre de la categoría.');

    const slug = cleanName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `categoria-${categoryId}`;

    const { data, error } = await supabase
      .from('memory_categories')
      .update({ name: cleanName, slug })
      .eq('id', categoryId)
      .select('id,name,slug')
      .single();

    if (error) throw error;
    return data as MemoryCategory;
  }

  async deleteCategory(categoryId: number): Promise<void> {
    const { count, error: countError } = await supabase
      .from('memories')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new Error('No podés eliminar una categoría que tiene recuerdos.');
    }

    const { error } = await supabase
      .from('memory_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
  }

  async setFavorite(memoryId: string, isFavorite: boolean): Promise<void> {
    const { error } = await supabase
      .from('memories')
      .update({ is_favorite: isFavorite })
      .eq('id', memoryId);

    if (error) throw error;
  }

  async getCategories(): Promise<MemoryCategory[]> {
    const { data, error } = await supabase
      .from('memory_categories')
      .select('id,name,slug')
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async getMemories(): Promise<Memory[]> {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('photo_date', { ascending: false });

    if (error) throw error;

    const memories = data as Memory[];
    await Promise.all(memories.map(async memory => {
      const { data: signed } = await supabase.storage
        .from('memories')
        .createSignedUrl(memory.image_key, 3600);
      memory.imageUrl = signed?.signedUrl;
    }));

    return memories;
  }

  async createMemory(input: CreateMemoryInput): Promise<void> {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error('Iniciá sesión para agregar un recuerdo.');

    const memoryId = crypto.randomUUID();
    const imageKey = `${userId}/${memoryId}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('memories')
      .upload(imageKey, input.image.file, {
        contentType: 'image/webp',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase
      .from('memories')
      .insert({
        id: memoryId,
        user_id: userId,
        category_id: input.categoryId,
        title: input.title.trim() || null,
        description: input.description.trim() || null,
        dedication: input.dedication.trim() || null,
        is_favorite: input.isFavorite,
        image_key: imageKey,
        image_type: 'image/webp',
        image_size: input.image.file.size,
        photo_date: input.photoDate
      });

    if (insertError) {
      const { error: cleanupError } = await supabase.storage
        .from('memories')
        .remove([imageKey]);
      if (cleanupError) {
        console.error('No se pudo limpiar la imagen huérfana:', cleanupError);
      }
      throw insertError;
    }
  }
}
