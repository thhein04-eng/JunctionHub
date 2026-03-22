import {
  provideKeycloak,
  withAutoRefreshToken,
  AutoRefreshTokenService,
  UserActivityService,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  createInterceptorCondition,
  IncludeBearerTokenCondition,
} from 'keycloak-angular';
import { KeycloakConfig, KeycloakInitOptions } from 'keycloak-js';

const urlCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: /^(http:\/\/localhost:8181)(\/.*)?$/i,
  bearerPrefix: 'Bearer',
});

export const provideAuth = (opts: {
  config: KeycloakConfig;
  initOpts: KeycloakInitOptions;
}) =>
  provideKeycloak({
    config: opts.config,
    initOptions: {
      ...opts.initOpts,
      redirectUri: window.location.origin + '/',
    },
    features: [
      withAutoRefreshToken({
        onInactivityTimeout: 'logout',
        sessionTimeout: 1000,
      }),
    ],
    providers: [
      AutoRefreshTokenService,
      UserActivityService,
      {
        provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
        useValue: [urlCondition],
      },
    ],
  });
