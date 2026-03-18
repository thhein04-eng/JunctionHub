import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private keycloak = new Keycloak({
    url: 'http://localhost:8080',
    clientId: 'junction-hub',
    realm: 'dev',
  });
  private initialized = false;

  init() {
    this.keycloak.init({
      onLoad: 'login-required',
      redirectUri: 'http://localhost:9090/callback',
    });
  }
}
