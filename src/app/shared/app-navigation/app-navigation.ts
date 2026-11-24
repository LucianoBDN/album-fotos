import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ChatService } from '../../core/chat/chat.service';

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-navigation.html',
  styleUrl: './app-navigation.scss'
})
export class AppNavigation implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly chat = inject(ChatService);

  readonly visible = signal(false);
  readonly activeUrl = signal('/home');

  constructor() {
    this.updateVisibility(this.router.url);
    void this.chat.refreshUnreadCount();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.updateVisibility(event.urlAfterRedirects);
        void this.chat.refreshUnreadCount();
      });
  }

  ngOnInit(): void {
    this.chat.subscribeGlobal(() => {
      void this.chat.refreshUnreadCount();
    });
  }

  ngOnDestroy(): void {
    this.chat.unsubscribeGlobal();
  }

  private updateVisibility(url: string): void {
    this.visible.set(!url.startsWith('/login'));
    this.activeUrl.set(url);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
