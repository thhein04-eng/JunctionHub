import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // ─────────────────────────────────────────
            // LAYER RULES — type-to-type allowed deps
            // ─────────────────────────────────────────

            // util → only util (bottom of the chain)
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util'],
            },

            // ui → ui, util (no data-access, no feature)
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util'],
            },

            // data-access → data-access, util (no feature, no ui)
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:data-access', 'type:util'],
            },

            // feature → anything except app
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:ui',
                'type:util',
              ],
            },

            // app → anything
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:ui',
                'type:util',
              ],
            },

            // ─────────────────────────────────────────
            // SCOPE RULES — who can use what
            // ─────────────────────────────────────────

            // shared libs → usable by everyone
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },

            // shell → can use shared + its own scope
            {
              sourceTag: 'scope:shell',
              onlyDependOnLibsWithTags: ['scope:shell', 'scope:shared'],
            },

            // ─────────────────────────────────────────
            // DOMAIN RULES — cross-domain restrictions
            // ─────────────────────────────────────────

            // auth domain → can use config + util
            // {
            //   sourceTag: 'domain:auth',
            //   onlyDependOnLibsWithTags: [
            //     'domain:auth',
            //     'domain:config', // ← AuthService can inject ConfigService
            //     'type:util',
            //   ],
            // },

            // config domain → no auth, no feature domains
            // {
            //   sourceTag: 'domain:config',
            //   onlyDependOnLibsWithTags: ['domain:config', 'type:util'],
            // },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
