import { Injectable, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../supabase/supabase.client';

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  sent_at: string;
  read_at: string | null;
}

export interface ChatPartner {
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private channel?: RealtimeChannel;
  private globalChannel?: RealtimeChannel;
  readonly unreadCount = signal(0);

  async getCurrentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async getPartner(): Promise<ChatPartner | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    const { data: pair, error: pairError } = await supabase
      .from('couple_pairs')
      .select('user_a,user_b')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .maybeSingle();

    if (pairError) throw pairError;
    if (!pair) return null;

    const partnerId = pair.user_a === userId ? pair.user_b : pair.user_a;
    return {
      id: partnerId
    };
  }

  async getMessages(): Promise<ChatMessage[]> {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    const partner = await this.getPartner();
    if (!partner) return [];

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${partner.id}),` +
        `and(sender_id.eq.${partner.id},recipient_id.eq.${userId})`
      )
      .order('sent_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  }

  async sendMessage(content: string): Promise<ChatMessage> {
    const userId = await this.getCurrentUserId();
    const partner = await this.getPartner();
    if (!userId) throw new Error('Iniciá sesión para enviar mensajes.');
    if (!partner) throw new Error('Todavía no hay una pareja vinculada.');

    const cleanContent = content.trim();
    if (!cleanContent) throw new Error('Escribí un mensaje.');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: userId,
        recipient_id: partner.id,
        content: cleanContent
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as ChatMessage;
  }

  async markUnreadAsRead(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;

    const partner = await this.getPartner();
    if (!partner) return;

    const { error } = await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', partner.id)
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) throw error;
    this.unreadCount.set(0);
  }

  async refreshUnreadCount(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      this.unreadCount.set(0);
      return;
    }

    const partner = await this.getPartner();
    if (!partner) {
      this.unreadCount.set(0);
      return;
    }

    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', partner.id)
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (!error) this.unreadCount.set(count ?? 0);
  }

  async deleteMessage(messageId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('Iniciá sesión para eliminar mensajes.');

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (error) throw error;
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'default') {
      return Notification.requestPermission();
    }
    return Notification.permission;
  }

  showNotification(title: string, body: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;

    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'nuestro-album-chat'
    });
  }

  subscribe(onChange: () => void): void {
    this.unsubscribe();

    this.channel = supabase
      .channel('private-chat')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        onChange
      )
      .subscribe();
  }

  unsubscribe(): void {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = undefined;
    }
  }

  subscribeGlobal(onChange: () => void): void {
    if (this.globalChannel) {
      void supabase.removeChannel(this.globalChannel);
    }

    this.globalChannel = supabase
      .channel('private-chat-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        onChange
      )
      .subscribe();
  }

  unsubscribeGlobal(): void {
    if (this.globalChannel) {
      void supabase.removeChannel(this.globalChannel);
      this.globalChannel = undefined;
    }
  }
}
