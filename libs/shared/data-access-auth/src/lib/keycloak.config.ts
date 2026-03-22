import {
  provideKeycloak,
  withAutoRefreshToken,
  AutoRefreshTokenService,
  UserActivityService,
} from 'keycloak-angular';

export const provideKeycloakAngular = () =>
  provideKeycloak({
    config: {
      realm: 'keycloak-angular-sandbox',
      url: 'http://localhost:8080',
      clientId: 'keycloak-angular',
    },
    initOptions: {
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri:
        window.location.origin + '/silent-check-sso.html',
      redirectUri: window.location.origin + '/',
    },
    features: [
      withAutoRefreshToken({
        onInactivityTimeout: 'logout',
        sessionTimeout: 1000,
      }),
    ],
    providers: [AutoRefreshTokenService, UserActivityService],
  });
