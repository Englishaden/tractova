// Lightweight ESLint gate — purpose-built to catch the ONE class of bug Vite
// won't: undefined references (missing imports, typo'd identifiers) that compile
// clean and only throw ReferenceError at runtime. (e.g. CompareTray.jsx using
// <Link> without importing it — a prod crash that nothing caught pre-push.)
//
// Deliberately NOT a style linter. Only no-undef / react/jsx-no-undef are on,
// as errors. Everything else is off so this stays a focused crash-catcher and
// never becomes a noisy 500-warning dump on the existing 230-file codebase.

import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    // react-hooks is registered but NOT enabled — the codebase carries
    // `// eslint-disable react-hooks/exhaustive-deps` comments, and ESLint
    // errors on a disable directive that names an unregistered rule. Registering
    // the plugin makes the name resolve; leaving the rule off keeps scope tight.
    plugins: { react, 'react-hooks': reactHooks },
    linterOptions: {
      // Those disable comments are no-ops here (the rule is off) — don't flag them.
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      // Match the actual React version so the plugin's JSX-runtime handling
      // (React 17+ automatic runtime — no `import React` needed) is correct.
      react: { version: 'detect' },
    },
    rules: {
      // The two rules that catch missing imports / undefined references.
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      // With the automatic JSX runtime, `React` doesn't need to be in scope —
      // turn off the legacy rules that would otherwise demand `import React`.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // jsx-uses-vars keeps no-undef from flagging components that are only
      // referenced inside JSX (otherwise <Foo /> looks like an unused import).
      'react/jsx-uses-vars': 'error',
      // ── Security (guardrails spec 2026-06-10) — all verified zero-hit at adoption ──
      // No raw HTML injection; rich text renders via src/lib/markdownRender.jsx (F-38).
      'react/no-danger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
]
