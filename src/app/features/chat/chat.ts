import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ChatService, type ChatMessage, type ChatPartner } from '../../core/chat/chat.service';

@Component({
  selector: 'app-chat',
  imports: [ReactiveFormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss'
})
export class Chat implements OnInit, OnDestroy {
  private readonly chat = inject(ChatService);
  private readonly fb = inject(FormBuilder);

  readonly messages = signal<ChatMessage[]>([]);
  readonly partner = signal<ChatPartner | null>(null);
  readonly currentUserId = signal('');
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly pendingDelete = signal<ChatMessage | null>(null);

  readonly form = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(4000)]]
  });

  async ngOnInit(): Promise<void> {
    this.currentUserId.set(await this.chat.getCurrentUserId() ?? '');
    await this.loadChat();

    this.chat.subscribe(async () => {
      const before = this.messages();
      await this.loadMessages();
      const latest = this.messages().at(-1);
      if (
        latest &&
        latest.sender_id !== this.currentUserId() &&
        !before.some(message => message.id === latest.id)
      ) {
        this.chat.showNotification('Nuevo mensaje', latest.content);
      }
      await this.chat.markUnreadAsRead();
      await this.chat.refreshUnreadCount();
    });
  }

  ngOnDestroy(): void {
    this.chat.unsubscribe();
  }

  async loadChat(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.partner.set(await this.chat.getPartner());
      await this.loadMessages();
      await this.chat.markUnreadAsRead();
    } catch (error) {
      console.error('Error cargando chat:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos cargar el chat.');
    } finally {
      this.loading.set(false);
      this.scrollToEnd();
    }
  }

  async retryLoad(): Promise<void> {
    await this.loadChat();
  }

  async loadMessages(): Promise<void> {
    this.messages.set(await this.chat.getMessages());
    this.scrollToEnd();
  }

  async sendMessage(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const content = this.form.controls.content.value.trim();
    if (!content) return;

    this.errorMessage.set('');
    try {
      const message = await this.chat.sendMessage(content);
      this.messages.update(items => [...items, message]);
      this.form.reset({ content: '' });
      this.scrollToEnd();
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos enviar el mensaje.');
    }
  }

  async enableNotifications(): Promise<void> {
    await this.chat.requestNotificationPermission();
  }

  requestDelete(message: ChatMessage): void {
    if (message.sender_id !== this.currentUserId()) return;
    this.pendingDelete.set(message);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  async confirmDelete(): Promise<void> {
    const message = this.pendingDelete();
    if (!message) return;

    try {
      await this.chat.deleteMessage(message.id);
      this.messages.update(items => items.filter(item => item.id !== message.id));
      this.pendingDelete.set(null);
    } catch (error) {
      console.error('Error eliminando mensaje:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'No pudimos eliminar el mensaje.');
    }
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private scrollToEnd(): void {
    setTimeout(() => {
      const container = document.querySelector('.messages-scroll');
      if (container) container.scrollTop = container.scrollHeight;
    });
  }
}
