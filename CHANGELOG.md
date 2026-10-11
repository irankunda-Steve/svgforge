# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Newer release notes are published on the GitHub release page: <https://github.com/svgforge/svgforge/releases>

## Unreleased

### Changed

* `@resvg/resvg-js` is now declared as a **peer dependency** (installed automatically by default) instead of a regular dependency — no action required. Making it an *optional* peer (never installed automatically) is planned for the next major release; see [docs/TODO.md](docs/TODO.md).

## 3.0.0 — Vento templating, dependency modernization

### Added

* The spriter emits a `progress` event for each shape that finished processing,
  carrying `{processed, total}` — useful for CLI progress bars.

* The «symbol» mode now preserves the `aria-hidden`, `aria-label` and `role`
  attributes on generated `<symbol>` elements, so that accessibility metadata
  from the source icons survives into the sprite.

### Changed (breaking)

* The Mustache templating engine was replaced by [Vento](https://vento.js.org):
  all built-in templates (`tmpl/**/*.vto`) and any custom template now use
  Vento syntax (`{{ value }}`, `{{ value |> safe }}`, `{{ if }}…{{ /if }}`,
  `{{ for … of }}…{{ /for }}`). The default HTML example template path
  changed from `tmpl/<mode>/sprite.html` to `tmpl/<mode>/sprite.vto`, and the
  default stylesheet resource template is now `tmpl/common/sprite.<ext>.vto`.
* The formerly Mustache-style `variables` functions (`(string_, render) => …`)
  are now called directly as JavaScript functions from the templates
  (e.g. `{{ classname(raw) }}` instead of `{{#classname}}{{raw}}{{/classname}}`).
* The default console logger is now a small built-in logger (no longer
  `winston`), producing the same `YYYY-MM-DD HH:MM:ss.SSS - level: message`
  output. A custom logger (e.g. a `winston.Logger`) can still be passed via the
  `log` config option.

### Changed

* The startup log message no longer claims to use "threads" — the value is a
  task concurrency limit, not OS threads. It now reads
  `Processing up to N shapes concurrently`.

* The preview documents now hint that they have to be opened from a directory
  URL with a trailing slash (e.g. `…/icons/`). Without it the relative
  reference to the sprite file resolves against the parent directory and no
  icons are shown.

* The HTML previews are now built from a shared Vento layout
  (`tmpl/common/layout.vto`): the per-mode templates provide their sections via
  slots, the `inline` option of the «defs» and «symbol» modes selects the
  embedded or external variant (named in the page heading).

### Fixed

* Namespace-based CSS selector rewriting (`@font-face` / `@keyframes` rules)
  no longer produces corrupted output — the abandoned `cssom` parser was
  replaced by `css-tree`.
* Errors thrown while laying out a sprite are now passed to the `compile()`
  callback as-is instead of crashing with `Object.values(undefined)`, which
  previously masked the underlying failure.
* Shape transformations that throw an error no longer crash the build with a
  `TypeError` during `compile()`: erroring shapes are skipped instead of being
  queued as `undefined`.
* `trimStart()` now returns an empty string when all characters are to be
  trimmed (it previously returned the last character), and `zipObject()` now
  throws a `TypeError` when either argument is not an array (previously only
  when both were not).

### Removed

* Dropped the `mustache`, `prettysize`, `import-lazy`, `winston`, `xpath` and `cssom`
  runtime dependencies: file sizes are formatted by an internal helper, lazy
  imports are replaced by native ESM imports, the XPath-based namespace
  rewriting uses the native `@xmldom/xmldom` DOM traversal, and CSS selector
  substitution uses `css-tree`. New dependencies: `ventojs` (templating) and
  `css-tree` (CSS parsing).

---

## 2.1.0 — Public utils export

### Added

* Public `@svgforge/svgforge/utils` export (`deepMerge`, `isObject`, `zipObject`, …).
  The previous CLI deep-import path `lib/svg-sprite/utils` remains available.

## 2.0.1 — Preview templates, robust shape naming

### Changed: Preview templates reflect the `inline` option

* The `defs`, `symbol` and `stack` preview templates now adapt to the `inline`
  option: with `inline: true` the embedded-sprite sections (`A`) are shown and
  the `<use>` references point to the local sprite, while with external sprites
  the external variant is shown instead. The shared footer partial is used
  consistently across all modes.

### Fixed: Shape naming with mixed or unnormalized paths

* `SVGSpriter.add()` now resolves the vinyl file path, so base and path always
  share the same absolute frame (previously a relative `file.path` combined
  with an absolute `file.base` produced inconsistent shapes).
* Shape names are now derived with `path.relative()` instead of manual string
  slicing, which is more robust with differing path separators and trailing
  separator edge cases.

## 2.0.0 — Scoped package names

### Breaking: Scoped package name

* The package is now published as **`@svgforge/svgforge`** on both
  [npmjs](https://www.npmjs.com/package/@svgforge/svgforge) and
  [GitHub Packages](https://github.com/svgforge/svgforge/pkgs/npm/svgforge)
  (GitHub's package registry requires scoped package names).
* **Upgrade path from 1.x:** the unscoped `svgforge` package is deprecated and
  no longer receives updates. Existing installs must switch the dependency to
  `@svgforge/svgforge@^2.0.0` and update imports from
  `require('svgforge')` to `require('@svgforge/svgforge')`.
* The command line interface is likewise published as
  [`@svgforge/svgforge-cli`](https://www.npmjs.com/package/@svgforge/svgforge-cli).

### Changed: Examples use the modern «symbol» mode

* All code examples (README, `docs/api.md`, `example.js`) now demonstrate the
  «symbol» mode instead of the legacy «defs» mode. The «defs» mode itself stays
  supported.

## 1.1.0 — View-mode `.dims` stylesheet, example previews and fixes

### Changed: bring back the `.dims` size API for the «view» mode

* The «view» mode can again render the plain `.dims` size stylesheet via
  `render: {css: true}` (using the shared `tmpl/common/sprite.css`), providing
  `width`/`height`-only classes (`<icon>-dims`) so consumers can size an icon by
  class name without knowing its dimensions — exactly like defs/symbol/stack.
* The «view» preview HTML sets the `.svg-…-dims` class on its `<img>` elements
  and inlines the matching dimension rules (stack-style), so the preview renders
  at the correct icon size even without an external stylesheet.

### Changed: Example documents

* Switch the example tiles of the defs, symbol, stack and view modes to a
  responsive CSS grid (`auto-fit`/`minmax`) with flex-centered icon boxes
  stretching to the full tile width
* Add a stacksvg-style sizing preview (an `<use>`-based inline SVG sized by
  `viewBox` only) to the defs, symbol and stack examples, plus a
  background-image usage example for the stack mode
* Populate the per-icon `fileSize` in the example HTML (the example flag is
  now read from the per-mode configuration, so it no longer stays
  `undefined` and the tiles show no dangling trailing comma)

### Fixed: Invalid XML reliably raises `XmlFixingError`

* `@xmldom/xmldom` throws its parse error synchronously instead of invoking
  the `DOMParser` error callback, so the documented `XmlFixingError` was
  never actually raised. The parser error is now caught and rethrown as
  `XmlFixingError`

### Hardened: Test matcher and view-mode coverage

* The synchronous `toThrow` matcher now honors its expected argument
  (error constructor, `Error` instance, message substring or regular
  expression) instead of accepting any thrown error
* Add non-visual unit tests for the «view» mode (fragment composition,
  sprite dimensions, `.dims` stylesheet, dimensions placeholder), raising the
  line coverage of `mode/view.js` and `mode/viewbase.js` to 100% and 98%

### Documentation

* Restore the README introduction and migrate the code examples to ESM
* Fix typos and outdated sprite filenames in the documentation
* Improve the mode documentation and link the DeepWiki API reference

---

## 1.0.1 — Patch release (first publishable fix)

### Refactor: Drop remaining lodash/async dependencies

* Replace the `async` package with native Promise-based helpers
  (`runWaterfall`/`runParallelLimit`) and drop `async` from the dependencies;
  the shape processing queue now uses a fixed concurrency limit of 4 instead
  of scaling with the CPU core count
* Replace `lodash.merge` with a native `deepMerge` utility
  (`lib/svg-sprite/utils/index.js`) and drop `lodash.merge` from the
  dependencies
* Replace `lodash.escape` with a native `escapeHtml` utility
  (`lib/svg-sprite/utils/index.js`) and drop `lodash.escape` from the
  dependencies

## 1.0.0 — First release (based on old svg-sprite package)

### Removed: «css» sprite mode and view stylesheet rendering

* Drop the «css» sprite mode completely (mode registration, configuration,
  templates, tests and documentation)
* Slim the «view» mode down to a pure `<view>`-based SVG fragment sprite (no
  more `render: {css, scss}` stylesheet generation and no more
  `background`/`background-position` CSS)
* **Remove bin-packing layout from «view» mode** — replace with simple
  horizontal row placement (shapes placed sequentially in a single row)
* Remove the `mode/css/packer.js` and its test (was the bin-packing engine
  originating from the css mode)
* Rename `mode/css.js` to `mode/viewbase.js` (`SVGSpriteCss` →
  `SVGSpriteViewBase`) as a layout base kept only for the view mode
* Move the default CSS/SCSS templates from `tmpl/css/` to `tmpl/common/` (left
  in place for the `defs`, `symbol` and `stack` modes, which keep their plain
  non-`background-position` stylesheet rendering) and remove the obsolete
  `tmpl/css/` directory
* Remove the `scss` (Sass) stylesheet template `tmpl/common/sprite.scss`
  (identical to `sprite.css` — plain CSS is sufficient without background-position)
* Recommend the `stack` mode (SVG fragment identifiers) as an alternative for
  background-image sprite usage

### Refactor: ES6 classes and xo-default linting

* Convert `SVGSpriter`, `SVGShape` and all sprite mode classes from
  prototype-based to ES6 classes (`SVGSpriteBase` + subclasses, `SVGSpriteCss`,
  `SVGSpriteView`, `SVGSpriteDefs`, `SVGSpriteStack`, `SVGSpriteSymbol`,
  `SVGSpriteStandalone`)
* Strip all `off` rules from `xo.config.js`; fixed lint findings in code with
  justified line/file-level disables
* Add `require-unicode-regexp` enforcement (`u` flag, per `requireFlag: 'u'`)
  and raise `max-nested-calls` to 6 (required by `path.resolve(...)` chains)
* Migrate the complete test suite from Jest to `node --test` with a
  `jest-compat.js` compatibility layer (`createMock`/`spyOn` instead of
  `jest.*`, dependency injection via `lib/deps.js`)
* Drop LESS/Stylus support entirely (code, dependencies, documentation)
* Raise pixelmatch tolerance (`MAX_MISMATCH` 5 → 130) for AA differences under
  the upgraded Chromium/Playwright rendering pipeline
* Change primary author to svgforge; Joschi Kuphal remains as contributor
* Replace the `glob` package with the native `fs.globSync`/`node:fs` API and
  drop `glob` from the (dev) dependencies; `engines.node` is `>= 22` (required
  for the glob API introduced in Node 22)
* Normalize the `file` and `name` arguments of `SVGSpriter.prototype.add()` via
  `path.normalize()` so both values use the same path separators (fixes
  svgforge/svgforge#942, per PR svgforge/svgforge#944); the now
  redundant `trimStart()` call on `name` was dropped


# About

The `1.0` release is **rewritten from scratch** and introduces a bunch of new features like **less dependencies**, support for **inline sprite formats** and the **removal of file-system access** so that other libraries can build on top of it more easily.
