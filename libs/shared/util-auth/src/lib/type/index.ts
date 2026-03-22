import { KeycloakConfig, KeycloakInitOptions } from 'keycloak-js';

export interface AuthConfig {
  keycloak: {
    config: KeycloakConfig;
    initOptions: KeycloakInitOptions;
  };
}
