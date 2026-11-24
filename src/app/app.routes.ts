import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'home',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    canActivate: [authGuard],
  },
  {
    path: 'add-memory',
    loadComponent: () => import('./features/add-memory/add-memory').then((m) => m.AddMemory),
    canActivate: [authGuard],
  },
  {
    path: 'album',
    loadComponent: () => import('./features/album/album').then((m) => m.Album),
    canActivate: [authGuard],
  },
  {
    path: 'chat',
    loadComponent: () => import('./features/chat/chat').then((m) => m.Chat),
    canActivate: [authGuard],
  },
  {
    path: 'account',
    loadComponent: () => import('./features/account/account').then((m) => m.Account),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'home'
  },
];
