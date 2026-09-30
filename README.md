# `@module-federation/vite`: build fails on a type-only import written without `import type`

Minimal reproduction for `@module-federation/vite` 1.23.0 (every release since 1.16.14; 1.16.13 builds fine):
when a module in an expose's import graph imports a type with a value-style import — `import { JsonValue } from 'type-fest'`
instead of `import type { JsonValue } from 'type-fest'` — `vite build` and `vite dev` fail in
`buildStart` with a resolver error, even though the same project builds fine without the plugin.

## Reproduce

```sh
npm install
npm run build
```

Actual (vite 7.3.6, `@module-federation/vite` 1.23.0, type-fest 5.10.0):

```
error during build:
[proxyRemoteEntry] Failed to resolve entry for package "type-fest". The package may have incorrect main/module/exports specified in its package.json: No known conditions for "." specifier in "type-fest" package
```

`npm run dev` fails while starting the dev server with the same resolver error (`Error: Failed to resolve entry for package "type-fest"`).
On Vite 8 (Rolldown) the build fails too, reported as `[plugin proxyRemoteEntry] Error: Errored while resolving "type-fest" in `this.resolve``.

Expected: the build succeeds. TypeScript erases `import { JsonValue } from 'type-fest'` (the binding is only
used as a type), so the bundler never resolves `type-fest`; the plugin should not fail the build over an
import the bundler would never resolve.

Control: change the import in [`src/Widget.ts`](src/Widget.ts) to `import type { JsonValue } from 'type-fest'`
and the build passes. Removing `federation()` from [`vite.config.ts`](vite.config.ts) also makes it pass.

## Cause

`proxyRemoteEntry` collects each expose's remote dependencies by walking the whole import graph from the
expose (`refreshExposeRemoteDependencies` → `collectRemoteDependencies`) in `buildStart`, and in `load` /
`transform` of the virtual exposes module. For every import that is neither a remote nor written with the
`type` keyword it calls `ctx.resolve(source, importer)` without a `try`/`catch`:

```js
const resolved = await ctx.resolve(source, id);
if (!resolved?.id || !shouldScanResolvedImport(resolved.id)) continue;
```

Vite's resolver does not return `null` for these cases — it throws:

- a package with no runtime entry (`type-fest` ships only `types`) → `ERR_RESOLVE_PACKAGE_ENTRY_FAIL`;
- a deep import that is not exposed in the package's `exports` (for example `some-lib/dist/types`) →
  `Missing "./dist/types" specifier in "some-lib" package`.

The error propagates out of `buildStart` and aborts the build. An import the resolver cannot resolve can never
be a remote, so the scanner can skip it and keep going.

## Fix

Wrap the `ctx.resolve` call in `collectRemoteDependencies` in `try`/`catch` and `continue` on failure.

## Files

- [`vite.config.ts`](vite.config.ts) — one expose, nothing else.
- [`src/Widget.ts`](src/Widget.ts) — the exposed module with the value-style type import.
- [`src/main.ts`](src/main.ts), [`index.html`](index.html) — a trivial entry so `vite build` has an input.
