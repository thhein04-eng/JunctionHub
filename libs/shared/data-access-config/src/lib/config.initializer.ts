import { provideAppInitializer, inject } from '@angular/core';
import { ConfigService } from './config.service';

export function provideConfig() {
  return provideAppInitializer(() => {
    const config = inject(ConfigService);
    return config.load();
  });
}
