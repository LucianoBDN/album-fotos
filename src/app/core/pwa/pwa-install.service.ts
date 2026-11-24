import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  readonly canInstall = signal(false);
  readonly installed = signal(false);
  readonly isIos = signal(
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !('MSStream' in window)
  );
  private promptEvent?: BeforeInstallPromptEvent;

  constructor() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      this.promptEvent = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.promptEvent = undefined;
      this.canInstall.set(false);
      this.installed.set(true);
    });

    if (
      typeof window.matchMedia === 'function'
      && window.matchMedia('(display-mode: standalone)').matches
    ) {
      this.installed.set(true);
    }
  }

  async install(): Promise<void> {
    if (!this.promptEvent) return;
    await this.promptEvent.prompt();
    await this.promptEvent.userChoice;
    this.promptEvent = undefined;
    this.canInstall.set(false);
  }
}
