import { inject, Injectable, signal } from '@angular/core';
import { AppConfig } from './config.types';
import { tap } from 'rxjs';
import { HttpBackend, HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private _config!: AppConfig;
  private http = new HttpClient(inject(HttpBackend));

  readonly ready = signal(false);

  load() {
    return this.http.get<AppConfig>('/config.json').pipe(
      tap((c) => {
        this._config = c;
        console.log('2. Config loaded');
        this.ready.set(true);
      }),
    );
  }

  get config() {
    return this._config;
  }
}
