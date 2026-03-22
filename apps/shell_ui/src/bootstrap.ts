import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { ConfigService } from '@junction-hub/data-access-config';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAuth } from '@junction-hub/data-access-auth';
import { appRoutes } from './app/app.routes';

const initializeApplicaton = async () => {
  await ConfigService.load();
  const authConfig = ConfigService.authConfig;
  const authInitOpts = ConfigService.authInitOpts;

  const appConfig: ApplicationConfig = {
    providers: [
      provideAuth({
        config: authConfig,
        initOpts: authInitOpts,
      }),
      provideBrowserGlobalErrorListeners(),
      provideRouter(appRoutes),
      provideHttpClient(),
    ],
  };

  await bootstrapApplication(App, appConfig);
};

initializeApplicaton().catch((error) =>
  console.error(
    `Failed to initialize the application. ${error.message || error}`,
  ),
);
