import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AppNavigation } from './shared/app-navigation/app-navigation';
import { Proposal } from './shared/proposal/proposal';
import { ProposalService } from './core/proposal/proposal.service';
import { proposalConfig } from './core/proposal/proposal.config';
import { RelationshipCounter } from './shared/relationship-counter/relationship-counter';
import { AuthService } from './core/auth/auth.service';
import { PwaInstallService } from './core/pwa/pwa-install.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNavigation, Proposal, RelationshipCounter],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  readonly proposal = inject(ProposalService);
  readonly auth = inject(AuthService);
  readonly pwa = inject(PwaInstallService);
  private readonly router = inject(Router);
  readonly isMobile = signal(
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  );
  readonly installPromptDismissed = signal(
    sessionStorage.getItem('pwa-install-dismissed') === 'true'
  );
  readonly showInstallPrompt = computed(() =>
    this.isMobile()
    && !this.pwa.installed()
    && !this.installPromptDismissed()
  );
  private readonly mobileMedia =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)')
      : null;
  private readonly mobileMediaHandler = (event: MediaQueryListEvent) =>
    this.isMobile.set(event.matches);
  readonly proposalEnabled = proposalConfig.enabled;
  readonly activeUrl = signal(this.router.url);
  readonly showProposal = computed(() =>
    this.proposal.initialized()
    && this.auth.initialized()
    && this.auth.isAuthenticated
    && !this.activeUrl().startsWith('/login')
    && this.proposalEnabled
    && !this.proposal.accepted()
  );

  constructor() {
    void this.auth.initialize();
    void this.proposal.initialize();
    this.mobileMedia?.addEventListener('change', this.mobileMediaHandler);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.activeUrl.set(event.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.mobileMedia?.removeEventListener('change', this.mobileMediaHandler);
  }

  dismissInstallPrompt(): void {
    sessionStorage.setItem('pwa-install-dismissed', 'true');
    this.installPromptDismissed.set(true);
  }

  async installApp(): Promise<void> {
    if (this.pwa.canInstall()) {
      await this.pwa.install();
      if (this.pwa.installed()) {
        this.dismissInstallPrompt();
      }
      return;
    }

    if (this.pwa.isIos()) {
      alert('En Safari: tocá Compartir y elegí “Agregar a pantalla de inicio”.');
      return;
    }

    alert('En tu navegador: abrí el menú y elegí “Instalar aplicación” o “Agregar a inicio”.');
  }
}