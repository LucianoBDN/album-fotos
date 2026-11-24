import { Component, inject, signal } from '@angular/core';

import { proposalConfig } from '../../core/proposal/proposal.config';
import { ProposalService } from '../../core/proposal/proposal.service';

@Component({
  selector: 'app-proposal',
  imports: [],
  templateUrl: './proposal.html',
  styleUrl: './proposal.scss'
})
export class Proposal {
  readonly proposalService = inject(ProposalService);
  readonly stage = signal<'question' | 'confirm' | 'yes-only' | 'celebration'>('question');
  readonly config = proposalConfig;

  decline(): void {
    if (this.stage() === 'question') {
      this.stage.set('confirm');
    } else if (this.stage() === 'confirm') {
      this.stage.set('yes-only');
    }
  }

  accept(): void {
    this.stage.set('celebration');
  }

  async continueToApp(): Promise<void> {
    await this.proposalService.accept();
  }
}
