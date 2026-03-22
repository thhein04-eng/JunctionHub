import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import Keycloak from 'keycloak-js';
import { ConfigService } from '@junction-hub/data-access-config';
import { EMPTY, filter, from, switchMap, take } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private configService = inject(ConfigService);
  private keycloak!: Keycloak;
  private initialized = false;

  init() {
    if (this.initialized) return EMPTY;

    return toObservable(this.configService.ready).pipe(
      filter((ready) => ready),
      take(1),
      switchMap(() => {
        this.keycloak = new Keycloak(this.configService.config.keycloak);
        return from(
          this.keycloak
            .init({
              onLoad: 'login-required',
              pkceMethod: 'S256',
              redirectUri: 'http://localhost:9090/callback',
            })
            .then(() => {
              this.initialized = true;
            })
            .catch((e) => {
              console.error('Error from Keycloak: ', e);
            }),
        );
      }),
    );
  }
}
