import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthGuardData, createAuthGuard } from 'keycloak-angular';

const isAuthenticated = async (
  _: ActivatedRouteSnapshot,
  __: RouterStateSnapshot,
  authData: AuthGuardData,
): Promise<boolean> => {
  const { authenticated } = authData;

  if (authenticated) return true;
  return false;
};

export const authGuard: CanActivateFn =
  createAuthGuard<CanActivateFn>(isAuthenticated);
