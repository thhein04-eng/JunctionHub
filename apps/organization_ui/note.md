# Microfrontend Architecture — Module Federation + NX

---

## 1. Generate Apps

Run these in order — shell first, then remotes.

```bash
# Shell (host)
nx g @nx/angular:host shell --remotes=onboarding,dashboard,resource-management,settings --style=none --standalone

# If remotes weren't created automatically, generate them individually
nx g @nx/angular:remote onboarding --host=shell --style=none --standalone
nx g @nx/angular:remote dashboard --host=shell --style=none --standalone
nx g @nx/angular:remote resource-management --host=shell --style=none --standalone
nx g @nx/angular:remote settings --host=shell --style=none --standalone
```

---

## 2. Shared State Library

```bash
nx g @nx/angular:library shared-state --buildable --standalone
```

---

## libs/shared-state/src/lib/org-state.service.ts

```typescript
import { Injectable, signal, computed } from '@angular/core';

export interface OrgContext {
  orgId: string;
  orgName: string;
  industryTypeSlug: string;
  industryTypeId: string;
  resourceMap: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class OrgStateService {
  private _org = signal<OrgContext | null>(null);

  // Public read-only signals
  readonly org = this._org.asReadonly();
  readonly orgId = computed(() => this._org()?.orgId ?? '');
  readonly orgName = computed(() => this._org()?.orgName ?? '');
  readonly industryTypeSlug = computed(() => this._org()?.industryTypeSlug ?? '');
  readonly hasOrg = computed(() => this._org() !== null);

  setOrg(org: OrgContext) {
    this._org.set(org);
    // Persist across page refreshes
    sessionStorage.setItem('org_context', JSON.stringify(org));
  }

  clearOrg() {
    this._org.set(null);
    sessionStorage.removeItem('org_context');
  }

  // Rehydrate from sessionStorage on app init
  rehydrate() {
    const stored = sessionStorage.getItem('org_context');
    if (stored) {
      try {
        this._org.set(JSON.parse(stored));
      } catch {
        this.clearOrg();
      }
    }
  }
}
```

---

## libs/shared-state/src/index.ts

```typescript
export { OrgStateService } from './lib/org-state.service';
export type { OrgContext } from './lib/org-state.service';
```

---

## 3. Shell (Host) App

### apps/shell/module-federation.config.ts

```typescript
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: ['onboarding', 'dashboard', 'resource-management', 'settings'],
};

export default config;
```

### apps/shell/src/app/app.routes.ts

```typescript
import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { OrgStateService } from '@your-org/shared-state';
import { Router } from '@angular/router';

const orgGuard = () => {
  const state = inject(OrgStateService);
  const router = inject(Router);
  if (!state.hasOrg()) {
    router.navigate(['/onboarding']);
    return false;
  }
  return true;
};

export const routes: Routes = [
  { path: '', redirectTo: 'onboarding', pathMatch: 'full' },
  {
    path: 'onboarding',
    loadChildren: () => import('onboarding/Routes').then((m) => m.remoteRoutes),
  },
  {
    path: 'dashboard',
    canActivate: [orgGuard],
    loadChildren: () => import('dashboard/Routes').then((m) => m.remoteRoutes),
  },
  {
    path: 'resources',
    canActivate: [orgGuard],
    loadChildren: () => import('resource-management/Routes').then((m) => m.remoteRoutes),
  },
  {
    path: 'settings',
    loadChildren: () => import('settings/Routes').then((m) => m.remoteRoutes),
  },
];
```

### apps/shell/src/app/app.component.ts

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OrgStateService } from '@your-org/shared-state';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private orgState = inject(OrgStateService);

  ngOnInit() {
    // Rehydrate org context on shell boot
    this.orgState.rehydrate();
  }
}
```

### apps/shell/src/app/app.config.ts

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()],
};
```

---

## 4. Onboarding Remote

### apps/onboarding/module-federation.config.ts

```typescript
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'onboarding',
  exposes: {
    './Routes': 'apps/onboarding/src/app/remote-entry/entry.routes.ts',
  },
};

export default config;
```

### apps/onboarding/src/app/remote-entry/entry.routes.ts

```typescript
import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./onboarding.component').then((m) => m.OnboardingComponent),
  },
];
```

### apps/onboarding/src/app/remote-entry/onboarding.component.ts

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, IndustryType } from '@your-org/api';
import { OrgStateService } from '@your-org/shared-state';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div class="w-full max-w-lg">
        <div class="mb-10">
          <div class="w-10 h-10 rounded-xl bg-amber-400 mb-6 flex items-center justify-center">
            <span class="text-zinc-900 font-black text-lg">J</span>
          </div>
          <h1 class="text-3xl font-bold text-white tracking-tight">Set up your organization</h1>
          <p class="text-zinc-500 mt-2 text-sm">Tell us about your organization to get started.</p>
        </div>

        <!-- Step indicator -->
        <div class="flex gap-2 mb-8">
          <div class="h-1 flex-1 rounded-full" [class]="step() >= 1 ? 'bg-amber-400' : 'bg-zinc-800'"></div>
          <div class="h-1 flex-1 rounded-full" [class]="step() >= 2 ? 'bg-amber-400' : 'bg-zinc-800'"></div>
        </div>

        <!-- Step 1: Industry Type -->
        @if (step() === 1) {
          <div class="space-y-4">
            <h2 class="text-white font-semibold text-lg">What kind of organization is this?</h2>
            @if (loading()) {
              <div class="text-zinc-500 text-sm text-center py-8">Loading templates...</div>
            } @else {
              <div class="grid gap-3">
                @for (type of industryTypes(); track type.id) {
                  <button (click)="selectedType.set(type)" class="w-full text-left p-4 rounded-xl border transition-all" [class]="selectedType()?.id === type.id ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-white'">
                    <div class="font-medium">{{ type.label }}</div>
                    <div class="text-xs mt-1 opacity-60">{{ type.resourceTypeDefs.length }} resource types</div>
                  </button>
                }
              </div>
            }
            <button (click)="step.set(2)" [disabled]="!selectedType()" class="w-full mt-4 py-3 rounded-xl font-semibold text-sm transition-all" [class]="selectedType() ? 'bg-amber-400 text-zinc-900 hover:bg-amber-300' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'">Continue</button>
          </div>
        }

        <!-- Step 2: Org Name -->
        @if (step() === 2) {
          <div class="space-y-4">
            <h2 class="text-white font-semibold text-lg">Name your organization</h2>
            <input [(ngModel)]="orgName" placeholder="e.g. Springfield Elementary" class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 text-sm" />
            @if (error()) {
              <div class="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-3">{{ error() }}</div>
            }
            <div class="flex gap-3">
              <button (click)="step.set(1)" class="flex-1 py-3 rounded-xl text-sm border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all">Back</button>
              <button (click)="submit()" [disabled]="!orgName.trim() || submitting()" class="flex-1 py-3 rounded-xl text-sm font-semibold transition-all" [class]="orgName.trim() && !submitting() ? 'bg-amber-400 text-zinc-900 hover:bg-amber-300' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'">
                {{ submitting() ? 'Creating...' : 'Create organization' }}
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class OnboardingComponent implements OnInit {
  private api = inject(ApiService);
  private orgState = inject(OrgStateService);
  private router = inject(Router);

  step = signal(1);
  industryTypes = signal<IndustryType[]>([]);
  selectedType = signal<IndustryType | null>(null);
  orgName = '';
  loading = signal(true);
  submitting = signal(false);
  error = signal('');

  ngOnInit() {
    this.api.getIndustryTypes().subscribe({
      next: (types) => {
        this.industryTypes.set(types);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit() {
    if (!this.orgName.trim() || !this.selectedType()) return;
    this.submitting.set(true);
    this.error.set('');

    this.api.onboard({ orgName: this.orgName.trim(), industryTypeSlug: this.selectedType()!.slug }).subscribe({
      next: (res) => {
        this.orgState.setOrg({
          orgId: res.orgId,
          orgName: res.orgName,
          industryTypeSlug: res.industryTypeSlug,
          industryTypeId: this.selectedType()!.id,
          resourceMap: res.resourceMap,
        });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Something went wrong.');
        this.submitting.set(false);
      },
    });
  }
}
```

---

## 5. Dashboard Remote

### apps/dashboard/module-federation.config.ts

```typescript
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'dashboard',
  exposes: {
    './Routes': 'apps/dashboard/src/app/remote-entry/entry.routes.ts',
  },
};

export default config;
```

### apps/dashboard/src/app/remote-entry/entry.routes.ts

```typescript
import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
];
```

### apps/dashboard/src/app/remote-entry/dashboard.component.ts

```typescript
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService, Resource } from '@your-org/api';
import { OrgStateService } from '@your-org/shared-state';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-zinc-950 text-white">
      <header class="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <span class="text-zinc-900 font-black text-sm">J</span>
          </div>
          <span class="font-semibold">{{ orgState.orgName() }}</span>
          <span class="text-zinc-600 text-xs px-2 py-1 bg-zinc-900 rounded-md border border-zinc-800">
            {{ orgState.industryTypeSlug() }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <a routerLink="/settings" class="text-zinc-500 hover:text-white text-sm transition-colors">Settings</a>
          <a routerLink="/resources" class="bg-amber-400 text-zinc-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-300 transition-colors"> Manage Resources </a>
        </div>
      </header>

      <div class="p-6 max-w-5xl mx-auto">
        <!-- Stats -->
        <div class="grid grid-cols-3 gap-4 mb-8">
          @for (stat of stats(); track stat.label) {
            <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div class="text-2xl font-bold">{{ stat.count }}</div>
              <div class="text-zinc-500 text-sm mt-1">{{ stat.label }}</div>
            </div>
          }
        </div>

        <!-- Tree -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 class="font-semibold mb-6">Resource Hierarchy</h2>
          @if (loading()) {
            <div class="text-zinc-500 text-sm">Loading...</div>
          } @else if (tree()) {
            <ng-container *ngTemplateOutlet="treeNode; context: { node: tree(), depth: 0 }"></ng-container>
          } @else {
            <div class="text-zinc-600 text-sm">No resources found.</div>
          }
        </div>
      </div>
    </div>

    <ng-template #treeNode let-node="node" let-depth="depth">
      <div [style.paddingLeft.px]="depth * 24">
        <div class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800 transition-colors">
          <div class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></div>
          <span class="text-sm font-medium">{{ node.name }}</span>
          <span class="text-zinc-600 text-xs">{{ node.resourceTypeDef?.slug }}</span>
        </div>
        @if (node.children?.length) {
          <div class="border-l border-zinc-800 ml-4">
            @for (child of node.children; track child.resource.id) {
              <div class="pl-2">
                <div class="text-zinc-600 text-xs px-3 py-1">{{ child.relation }}</div>
                <ng-container *ngTemplateOutlet="treeNode; context: { node: child.resource, depth: 0 }"></ng-container>
              </div>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class DashboardComponent implements OnInit {
  readonly orgState = inject(OrgStateService);
  private api = inject(ApiService);

  tree = signal<Resource | null>(null);
  resources = signal<Resource[]>([]);
  loading = signal(true);

  stats = computed(() => {
    const grouped = this.resources().reduce(
      (acc, r) => {
        const slug = r.resourceTypeDef?.slug ?? 'unknown';
        acc[slug] = (acc[slug] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(grouped).map(([label, count]) => ({ label, count }));
  });

  ngOnInit() {
    const orgId = this.orgState.orgId();
    if (!orgId) return;

    this.api.getResources(orgId).subscribe({
      next: (resources) => {
        this.resources.set(resources);
        const root = resources[0];
        if (root) {
          this.api.getResourceTree(orgId, root.id).subscribe({
            next: (tree) => {
              this.tree.set(tree);
              this.loading.set(false);
            },
            error: () => this.loading.set(false),
          });
        } else {
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
```

---

## 6. Shared API Library

```bash
nx g @nx/angular:library api --buildable --standalone
```

Move `api.service.ts` (from the previous single-app build) into this lib so all remotes share the same HTTP service without duplicating it.

### libs/api/src/index.ts

```typescript
export { ApiService } from './lib/api.service';
export type { IndustryType, ResourceTypeDef, ResourceTypeRelationship, Organization, Resource, ResourceRelationship, OnboardingResponse } from './lib/api.service';
```

---

## 7. tsconfig.base.json paths

Add these to your root `tsconfig.base.json` so all apps can import shared libs:

```json
{
  "compilerOptions": {
    "paths": {
      "@your-org/shared-state": ["libs/shared-state/src/index.ts"],
      "@your-org/api": ["libs/api/src/index.ts"]
    }
  }
}
```

---

## 8. Dev ports

Each app runs on its own port. Update `project.json` for each:

| App                 | Port |
| ------------------- | ---- |
| shell               | 4200 |
| onboarding          | 4201 |
| dashboard           | 4202 |
| resource-management | 4203 |
| settings            | 4204 |

```bash
# Run all at once
nx run-many --target=serve --projects=shell,onboarding,dashboard,resource-management,settings --parallel
```

---

## 9. Type declarations for remote imports

Create `apps/shell/src/decl.d.ts` so TypeScript doesn't complain about remote imports:

```typescript
declare module 'onboarding/Routes' {
  import { Route } from '@angular/router';
  export const remoteRoutes: Route[];
}

declare module 'dashboard/Routes' {
  import { Route } from '@angular/router';
  export const remoteRoutes: Route[];
}

declare module 'resource-management/Routes' {
  import { Route } from '@angular/router';
  export const remoteRoutes: Route[];
}

declare module 'settings/Routes' {
  import { Route } from '@angular/router';
  export const remoteRoutes: Route[];
}
```
