import { Injectable } from '@angular/core';
import { AppConfig } from '@junction-hub/util-config';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private static config: AppConfig;

  static async load() {
    const res = await fetch('/config.json');
    const config = await res.json();
    ConfigService.config = config;
  }

  static get authConfig() {
    return { ...ConfigService.config.keycloak.config };
  }

  static get authInitOpts() {
    return { ...ConfigService.config.keycloak.initOptions };
  }
}
