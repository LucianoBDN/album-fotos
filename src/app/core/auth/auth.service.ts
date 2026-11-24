import { Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../supabase/supabase.client';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  readonly session = signal<Session | null>(null);
  readonly initialized = signal(false);

  private initialization?: Promise<void>;

initialize(): Promise<void> {

  if (!this.initialization) {
    this.initialization = this.initializeSession();
  }

  return this.initialization;
}

private async initializeSession(): Promise<void> {

  try {

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    this.session.set(data.session);

    supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
    });

  } catch (error) {

    console.error('Error inicializando autenticación:', error);

    this.session.set(null);

  } finally {

    this.initialized.set(true);

  }
}

  async login(email: string, password: string): Promise<void> {

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    this.session.set(data.session);
  }

  async logout(): Promise<void> {

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    this.session.set(null);
  }

  get isAuthenticated(): boolean {
    return this.session() !== null;
  }

  get userId(): string | null {
    return this.session()?.user.id ?? null;
  }
}