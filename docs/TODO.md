# To-do

Changes that are planned but **intentionally postponed** to a later release.

## 4.x — Make `@resvg/resvg-js` an optional peer dependency

As of **3.1.0** `@resvg/resvg-js` is a regular **peer dependency** (declared without
`peerDependenciesMeta.optional`), so npm (≥ 7) and pnpm (≥ 8) install it automatically by
default and the dimension fallback works out of the box.

Declaring it as an **optional** peer dependency — so it is *never* installed automatically
and consumers opt in explicitly — would change behaviour for anyone whose icon set
contains SVGs that have neither a `viewBox` nor `width`/`height` attributes: those shapes
would be skipped — with a warning, no invalid `NaN` viewBox values — unless the package is
installed manually. That is a breaking change, so it is postponed to the next major
release (**4.0.0**).

The runtime already degrades gracefully (the `shape-skipped` event, `isResvgAvailable()`
and a warning naming the install command), so the release is mostly a declaration change:

* `svgforge/package.json`: set `peerDependenciesMeta['@resvg/resvg-js'].optional = true`.
* `svgforge/pnpm-workspace.yaml` and `svgforge-cli/pnpm-workspace.yaml`: keep
  `autoInstallPeers: false` + `peerDependencyRules.ignoreMissing` so the local dev install
  stays free of the package.
* `svgforge-cli/package.json`: bump the `@svgforge/svgforge` dependency to `^4.0.0`.
* CHANGELOGs (both repos): document the breaking change.

See the CHANGELOG `Unreleased` section (3.1.0) for the introduction of the peer
dependency.

## 4.x — Load `@resvg/resvg-js` with a lazy ESM `import()`

`lib/svgforge/utils/calculate-svg-dimensions.js` loads the optional dependency through
`createRequire(import.meta.url)`, i.e. with a CommonJS `require()` inside an otherwise ESM
package. A dynamic `import('@resvg/resvg-js')` inside a `try/catch` would be the idiomatic
equivalent and resolves the same way (relative to the module; the package exposes `Resvg`
as a named export). The blocker is that `import()` is always **asynchronous**, so
`loadResvgModule()` would return a `Promise` and the public helpers

* `isResvgAvailable()` (documented, re-exported by `utils/index.js`), and
* `calculateSvgDimensions()`

would have to become async — or they would silently hand a `Promise` to callers that expect
a boolean or dimensions. That is a breaking change, so it is postponed to **4.0.0** (the
same major release as the optional-peer change above).

A top-level `await import(...)` would keep both helpers synchronous, but it is evaluated
eagerly on module load: it would pull the optional package (and its native binding) into
every `import '@svgforge/svgforge'`, which defeats the purpose of the optional dependency.

Call sites to convert:

* `lib/svgforge/utils/calculate-svg-dimensions.js`: `loadResvgModule()`, `isResvgAvailable()`.
* `lib/svgforge/shape/dimensions.js` (`_determineDimensions`), via a promise-returning
  `calculateSvgDimensions()`.
* `svgforge-cli/bin/svgforge.js`: `await isResvgAvailable()` for the `resvg` summary row.
* Tests: `test/calculate-svg-dimensions.test.js`,
  `test/svgforge/shape/shape.complement.test.js`, `test/shape.test.js`,
  `test/svgforge/minimal-configuration/modes/{defs,symbol,stack}.test.js` (the
  `describe`-body self-skip has to be awaited or moved) and
  `test/svgforge/shape/shape.dimension-fallback.test.js`.

Side note: a literal `import('@resvg/resvg-js')` is statically visible to bundlers, which
then try to resolve the optional package; the `createRequire` form stays opaque to them.
