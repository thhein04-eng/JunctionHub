import { inject, provideAppInitializer } from '@angular/core';
import { AuthService } from './auth.service';

export function provideAuth() {
  return provideAppInitializer(() => {
    return inject(AuthService).init();
  });
}
