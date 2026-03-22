import { NxWelcome } from './nx-welcome';
import { Route } from '@angular/router';
import { authGuard } from '@junction-hub/feature-auth';

export const appRoutes: Route[] = [
  {
    path: '',
    component: NxWelcome,
    canActivate: [authGuard],
  },
];
