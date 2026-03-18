import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import Keycloak from 'keycloak-js';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'shell_ui';

  constructor() {
    (async () => {
      const keycloak = new Keycloak({
        url: 'http://localhost:8080',
        realm: 'dev',
        clientId: 'junction-hub',
      });

      try {
        const authenticated = await keycloak.init({
          onLoad: 'login-required',
          redirectUri: 'http://localhost:9090/callback',
        });
        if (authenticated) {
          console.log('User is authenticated');
        } else {
          console.log('User is not authenticated');
        }
      } catch (error) {
        console.error('Failed to initialize adapter:', error);
      }
    })();
  }
}
