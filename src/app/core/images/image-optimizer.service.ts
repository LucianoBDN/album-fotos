import { Injectable } from '@angular/core';

export interface OptimizedImage {
  file: File;
  originalSize: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageOptimizerService {
  private readonly maxDimension = 1920;
  private readonly quality = 0.82;

  async optimize(file: File): Promise<OptimizedImage> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Selecciona una imagen JPG, PNG o WebP.');
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new Error('La imagen original no puede superar los 20 MB.');
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      this.maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('No se pudo procesar la imagen.');
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('No se pudo optimizar la imagen.')),
        'image/webp',
        this.quality
      );
    });

    if (blob.size > 5 * 1024 * 1024) {
      throw new Error('La imagen optimizada supera los 5 MB.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'recuerdo';
    const optimizedFile = new File([blob], `${baseName}.webp`, {
      type: 'image/webp'
    });

    return {
      file: optimizedFile,
      originalSize: file.size,
      width,
      height
    };
  }
}
