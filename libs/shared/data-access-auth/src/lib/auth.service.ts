import { inject, Injectable } from '@angular/core';
import Keycloak, { KeycloakLogoutOptions } from 'keycloak-js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly keycloak = inject(Keycloak);

  logout(opts?: KeycloakLogoutOptions) {
    this.keycloak.logout({
      ...opts,
      redirectUri: window.location.origin + '/',
    });
  }
}
