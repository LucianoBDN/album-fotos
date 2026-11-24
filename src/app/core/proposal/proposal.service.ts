import { Injectable, signal } from '@angular/core';
import { supabase } from '../supabase/supabase.client';

const acceptedKey = 'our-memories-relationship-start';

export interface RelationshipElapsed {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  hours: number;
  minutes: number;
  seconds: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProposalService {
  readonly accepted = signal(false);
  readonly startedAt = signal<Date | null>(null);
  readonly initialized = signal(false);
  private initialization?: Promise<void>;

  constructor() {
    const stored = localStorage.getItem(acceptedKey);
    if (stored) {
      const date = new Date(stored);
      if (!Number.isNaN(date.getTime())) {
        this.startedAt.set(date);
        this.accepted.set(true);
      }
    }
    void this.initialize();
  }

  initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initializeData();
    }
    return this.initialization;
  }

  private async initializeData(): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (userId) {
        const { data: pair } = await supabase
          .from('couple_pairs')
          .select('relationship_started_at')
          .or(`user_a.eq.${userId},user_b.eq.${userId}`)
          .maybeSingle();

        if (pair?.relationship_started_at) {
          const date = new Date(pair.relationship_started_at);
          if (!Number.isNaN(date.getTime())) {
            this.startedAt.set(date);
            this.accepted.set(true);
            localStorage.setItem(acceptedKey, date.toISOString());
          }
        }
      }
    } catch (error) {
      console.error('Error cargando la fecha de pareja:', error);
    } finally {
      if (!this.accepted()) {
        const stored = localStorage.getItem(acceptedKey);
        if (stored) {
          const date = new Date(stored);
          if (!Number.isNaN(date.getTime())) {
            this.startedAt.set(date);
            this.accepted.set(true);
          }
        }
      }
      this.initialized.set(true);
    }
  }

  async accept(): Promise<void> {
    const now = new Date();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (userId) {
      const { data: pair } = await supabase
        .from('couple_pairs')
        .select('id')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .maybeSingle();

      if (pair) {
        await supabase
          .from('couple_pairs')
          .update({
            relationship_started_at: now.toISOString(),
            relationship_accepted_by: userId
          })
          .eq('id', pair.id);
      }
    }

    localStorage.setItem(acceptedKey, now.toISOString());
    this.startedAt.set(now);
    this.accepted.set(true);
  }

  getElapsed(now: Date = new Date()): RelationshipElapsed {
    const startedAt = this.startedAt();
    if (!startedAt) {
      return { years: 0, months: 0, days: 0, totalDays: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    let years = now.getFullYear() - startedAt.getFullYear();
    let months = now.getMonth() - startedAt.getMonth();
    let days = now.getDate() - startedAt.getDate();

    if (days < 0) {
      months -= 1;
      days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    let elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
    const hours = Math.floor((elapsedSeconds % 86400) / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const totalDays = Math.floor(elapsedSeconds / 86400);

    return { years, months, days, totalDays, hours, minutes, seconds };
  }
}
