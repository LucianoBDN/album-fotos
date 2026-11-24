import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { ProposalService } from '../../core/proposal/proposal.service';

@Component({
  selector: 'app-relationship-counter',
  imports: [],
  templateUrl: './relationship-counter.html',
  styleUrl: './relationship-counter.scss'
})
export class RelationshipCounter implements OnInit, OnDestroy {
  readonly proposal = inject(ProposalService);
  private readonly router = inject(Router);
  readonly visible = signal(true);
  readonly now = signal(new Date());

  ngOnInit(): void {
    this.updateVisibility(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.updateVisibility(event.urlAfterRedirects));
  }

  ngOnDestroy(): void {
  }

  private updateVisibility(url: string): void {
    this.visible.set(
      !url.startsWith('/chat')
      && !url.startsWith('/login')
    );
  }
}
