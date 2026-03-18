import { inject, Injectable } from '@angular/core';
import { AppConfig } from './config.types';
import { tap } from 'rxjs';
import { HttpBackend, HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private _config!: AppConfig;
  private http = new HttpClient(inject(HttpBackend));

  load() {
    return this.http.get<AppConfig>('/config.json').pipe(
      tap((c) => {
        this._config = c;
      }),
    );
  }

  get config() {
    return this._config;
  }
}
