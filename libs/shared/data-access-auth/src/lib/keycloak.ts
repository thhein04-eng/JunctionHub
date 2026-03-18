import Keycloak from 'keycloak-js';

const KEYCLOAK_CONFIG = {
  url: 'http://keycloak-server',
  realm: 'my-realm',
  clientId: 'my-app',
};

const keycloak = new Keycloak(KEYCLOAK_CONFIG);

try {
  const authenticated = await keycloak.init();
  if (authenticated) {
    console.log('User is authenticated');
  } else {
    console.log('User is not authenticated');
  }
} catch (error) {
  console.error('Failed to initialize adapter:', error);
}
