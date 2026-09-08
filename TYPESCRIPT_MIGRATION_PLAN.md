# TypeScript Migration Plan

## Objective

Convert the complete library implementation and demo from JavaScript to TypeScript while preserving the published runtime API, the currently accepted TypeScript API, rendered behavior, asynchronous loading behavior, styling, and package entry points.

The migration will be a direct translation of the existing class components. It will not redesign the components around hooks, change state ownership, fix unrelated behavioral defects, rename props, or upgrade runtime dependencies. This keeps the runtime diff reviewable and makes parity testable.

This file is the implementation checklist and decision log. Check items only after their validation gate passes. Record any unavoidable compatibility exception in the final section before merging.

## Compatibility contract

The following are release-blocking requirements.

- [x] The package continues to expose `IntelligentTreeSelect` as both the default and a named export.
- [x] The package continues to expose `VirtualizedTreeSelect`, `ToggleMinusIcon`, and `TogglePlusIcon` as named exports.
- [x] The CJS entry remains `dist/cjs/index.js`, the ESM entry remains `dist/esm/index.js`, and the stylesheet remains available from `intelligent-tree-select/styles.css`.
- [x] All currently exported type names remain available: `BaseOption`, `Multi`, `Clearable`, `SingleValue`, `MultiValue`, `OnChangeValue`, `FetchParams`, `FetchOptionsFn`, `CommonTreeSelectProps`, `IntelligentTreeSelectProps`, and `VirtualizedTreeSelectProps`.
- [x] Existing generic argument order and defaults on `IntelligentTreeSelect` and its props remain source-compatible. New trailing generics may be added only when existing calls still compile.
- [x] The imperative ref methods retain their names and behavior: `focus`, `blurInput`, `resetOptions`, and `getOptions` on `IntelligentTreeSelect`; `focus`, `blurInput`, and `resetOptions` on `VirtualizedTreeSelect`.
- [ ] Every current prop name, default value, callback shape, and `react-select` pass-through remains accepted. In particular, retain the library-specific `multi` and `isMenuOpen` names instead of replacing them with `react-select` names.
- [x] Runtime `propTypes` and `defaultProps` remain present and equivalent so JavaScript consumers keep development-time validation and identical defaults.
- [x] Existing CSS class names, inline style output, icons, option DOM structure, tooltip lookup, highlight behavior, and menu positioning remain unchanged.
- [x] Consumer support for React 17, 18, and 19 remains represented by the existing peer dependency range.

Physical relocation of the declaration entry from the repository-root `index.d.ts` to generated declarations under `dist/types` is allowed because package-root type resolution remains unchanged. No consumer import path or exported symbol may change.

## Fixed implementation decisions

- Keep `IntelligentTreeSelect` and `VirtualizedTreeSelect` as class components. Preserve method bodies, lifecycle order, binding, mutation points, `setState` callbacks, and ref timing unless a syntax-only adjustment is required by TypeScript.
- Convert `src/index.js` and the utility/constants modules to `.ts`; convert all JSX-bearing component files to `.tsx`.
- Convert `examples/demo.js` to `examples/demo.tsx` so the example acts as a real consumer of the new types. Keep `webpack.config.js` as JavaScript, but teach its loader and resolver about `.ts` and `.tsx`.
- Continue using Babel to emit the CJS and ESM JavaScript trees. Add the TypeScript Babel preset so the emitted runtime stays as close as possible to the current Babel output.
- Use `tsc` separately for strict checking and declaration emission. Babel must never be treated as the type checker.
- Generate declarations from the TypeScript source into `dist/types`; update both `package.json#types` and `exports["."].types` to `./dist/types/index.d.ts`. Remove the hand-maintained root declaration after generated declarations match its public surface.
- Retain the classic React JSX transform and existing Babel targets. A JSX-runtime change or browser-target change would create unrelated output differences.
- Retain `prop-types` and move it from `devDependencies` to direct `dependencies`, because shipped modules import it at runtime. This corrects dependency ownership without changing component behavior.
- Preserve the advertised Node 14 development/runtime floor. Select tool versions whose engines support Node 14: TypeScript 5.x, Babel 7.x, Jest 29.x, and compatible releases of supporting packages.
- Use Jest 29, `jest-environment-jsdom`, `babel-jest`, and React Testing Library for characterization tests. Use fake timers and deferred promises for debounce, loading, and pagination cases.
- Keep the existing formatter settings. Update lint parsing for TypeScript only if lint is made an active script; do not combine the migration with a broad style-rule rewrite.

## Phase 1: Establish the JavaScript baseline

Create tests against the current JavaScript source before renaming any implementation file. These tests define behavior; they must pass before and after conversion with no assertion changes other than import extensions or type annotations.

- [x] Add the test environment, Babel/Jest transform, DOM setup, and reusable option fixtures. Mock only browser APIs absent from JSDOM and the `react-window` list ref method needed to observe scrolling.
- [x] Capture root exports for both default and named imports, plus icon rendering and the low-level component export.
- [ ] Capture simple flat option processing, nested-data simplification, custom `labelKey`/`valueKey`/`childrenKey`/`titleKey`, numeric identifiers, duplicate identifiers in multiple paths, and loop prevention.
- [ ] Verify the existing mutation semantics: processed options receive `value`, `depth`, `parent`, `path`, `expanded`, and `visible` fields at the same points; nested input is deep-cloned only through the current simplification path.
- [ ] Verify initial expansion, click expansion/collapse, recursive descendant collapse, flat-list mode, focused-option retention after paging, selected-path expansion, and the one-time centered scroll to the selected option.
- [ ] Verify keyboard Space toggling when the search is empty, suppression during search, and chaining of a consumer-supplied `onKeyDown`.
- [ ] Verify default matching, a custom `matchCheck`, ancestor visibility during filtering, highlighted labels, restoration after clearing search, and forwarding of `onInputChange` with the same arguments currently exposed by the wrapper.
- [ ] Verify controlled values supplied as IDs, option objects, arrays, `null`, and changed props; verify pending IDs become selected as options arrive. Verify single mode keeps the first resolved/pending value.
- [ ] Verify uncontrolled mode uses the value only for initialization, updates local selection on change, and forwards the exact single/multi/null value received from `react-select`.
- [ ] Verify initial async loading, request payloads, child loading, root and child pagination, search pagination, completion markers, loading/no-results messages, debounce delay/cancellation/flush behavior, and suppression of overlapping requests.
- [ ] Verify local-storage cache hit, expiry, serialization shape, configured lifetime units, invalid lifetime errors, cache update after merges, and `resetOptions` behavior for both fetched and prop-provided options.
- [ ] Verify custom option/value renderers, custom label/value extractors, disabled/selected/focused classes, child-loading indicator, URL selected-value links, style overrides, floating/non-floating menus, always-open menus, and supported `react-select` pass-through props.
- [ ] Verify all imperative methods, including null-ref safety where it exists and cloned array behavior from `getOptions`.

Do not turn known pre-existing discrepancies into migration fixes. Examples include the documented `optionLeftOffset` versus the hard-coded option indent and the function form of `optionHeight` flowing into a fixed-size list. Characterize observable behavior and keep accepted prop types; address defects in separate changes.

**Gate 1:** the new characterization suite passes against the untouched JavaScript implementation, the demo webpack build still succeeds, and `git diff` contains test/tooling additions only.

## Phase 2: Define the source type model

Create `src/types.ts` as the single source of truth for public and shared internal types. Re-export public types from `src/index.ts`; components import the same definitions they expose to consumers.

- [x] Preserve the public types listed in the compatibility contract. Default generic option parameters to `BaseOption` rather than invalid `unknown` constraints, while retaining the permissive string index signature required for arbitrary option schemas.
- [ ] Model option identity as `string | number`. Model raw values separately from option objects because `value` and `passedValue` intentionally accept both throughout asynchronous resolution.
- [x] Define an internal processed-option intersection that adds optional runtime metadata (`value`, `depth`, `parent`, `path`, `expanded`, `visible`, and `fetchingChild`) without requiring consumers to provide those fields.
- [x] Define named internal types for component state, fetch/cache records, option-lifetime parts, scroll metrics, focused-scroll state, and callbacks. Keep dictionaries string-keyed to match JavaScript property coercion; do not replace them with `Map` or `Set` where that would change equality or ordering.
- [x] Compose the public props with compatible `react-select` state-manager props so documented pass-through props are typed. Omit or override fields owned by this library (`options`, `value`, `onChange`, `onInputChange`, `styles`, components, loading/menu state, and multi state), then re-declare their current wrapper shapes.
- [ ] Add accurate exported renderer and scroll callback types where the runtime already accepts them. Strengthening must be additive: usages accepted by the current `index.d.ts` remain valid even when a more precise overload or trailing generic is introduced.
- [x] Keep `FetchParams` property optionality and `FetchOptionsFn` return shape source-compatible even though runtime calls normally provide all paging fields.
- [x] Keep the existing conditional `OnChangeValue` behavior for `IntelligentTreeSelect`. Do not silently adopt `react-select`'s differently named `isMulti` API.
- [x] Type the `VirtualizedTreeSelect` low-level value and change callback without invalidating its current `T[] | null` consumers. If precise single/multi typing is added, use trailing generics/overloads and compatibility signatures.
- [x] Type styles through `react-select` where possible while preserving the existing permissive `Record<string, any>` acceptance. Type custom option props as the standard `OptionProps` plus this library's injected `selectProps` callbacks.
- [x] Use `import type` for type-only dependencies so Babel does not create new runtime imports.

Create two TypeScript configurations:

- `tsconfig.json`: `strict: true`, `noEmit: true`, `allowJs: false`, classic React JSX, DOM and modern ECMAScript libraries, Node module resolution, JSON modules, synthetic/default import interoperability, `isolatedModules: true`, `useDefineForClassFields: false`, and `skipLibCheck: true`. Include source, example, and tests.
- `tsconfig.build.json`: extend the base configuration, include only `src`, set `rootDir` to `src`, and enable declaration-only output plus declaration maps under `dist/types`.

Keep `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` disabled for this migration. Enabling either would force semantic normalization around optional callbacks and arbitrary keyed option data and belongs in a later hardening change.

**Gate 2:** public type fixtures compile, expected-invalid fixtures fail through `@ts-expect-error`, and generated declarations expose every existing public type/export before implementation conversion begins.

## Phase 3: Convert implementation modules directly

Convert one dependency layer at a time so failures stay localized: constants/utilities, icons/default option, `VirtualizedTreeSelect`, `IntelligentTreeSelect`, then the root entry and demo.

- [x] Type constants with literal values and convert utility functions with generics for array normalization, option-list comparison, label extraction, and monotonic assignment. Preserve truthiness, null handling, property filtering, equality, hash, and URL checks exactly.
- [x] Type the SVG icon components with `React.FC<React.SVGProps<SVGSVGElement>>` compatibility and preserve their rendered attributes and paths.
- [x] Type the default option renderer from `react-select` option props plus injected tree-select props. Preserve click suppression for disabled options, toggle event bubbling, hard-coded current indentation, title lookup, highlighting, classes, and loading markup.
- [x] Give `VirtualizedTreeSelect` explicit props/state generics and typed instance fields for processed data, search text, toggled options, pending selected scroll, focused-scroll bookkeeping, and refs.
- [x] Type `react-select` and `react-window` refs using their public instance types. Where the implementation deliberately reaches into `react-select` state/input internals or injects custom select props, isolate the smallest possible adapter/intersection type rather than spreading `any` through the component.
- [x] Type menu, menu-list, filter candidate, option renderer, keyboard event, scroll event target, layout effect, and style callbacks. Preserve the current custom component replacement order and style-merge precedence.
- [x] Preserve `structuredClone`, `Set` traversal order, identity comparisons, option mutation, branch-local visited sets, duplicate-path cloning, focus restoration, and scroll de-duplication exactly.
- [x] Give `IntelligentTreeSelect` explicit props/state generics and type every instance field: the in-flight promise/false sentinel, completed/toggled dictionaries, search page, root count, debounced search, and the child ref.
- [x] Preserve `getDerivedStateFromProps`, pending raw values, merge precedence, state update sequencing, cache reads/writes, fetch callback timing, pagination arithmetic, renderer wrapping, prop deletion, and prop-spread order exactly.
- [x] Retain runtime `propTypes` and `defaultProps`. Use typed default objects or `satisfies` checks without changing which defaults are emitted at runtime.
- [ ] Keep necessary assertions at external-library and dynamic-key boundaries. Each assertion must have a short comment explaining the runtime invariant; do not use file-wide `any`, `@ts-ignore`, or disable strict mode.
- [x] Rename the public entry to `src/index.ts`, re-export the same runtime values and all public types, and keep the same default export identity.
- [x] Convert the demo to TSX, type its fetch callback and data shape, and keep its rendered behavior. Remove example-only props that are proven obsolete only if doing so does not hide a public compatibility requirement; otherwise retain and type them as pass-through inputs.

After each module conversion, run type checking and the complete characterization suite. Do not defer errors to the end or change tests merely to satisfy a new implementation shape.

**Gate 3:** no JavaScript implementation remains under `src`, the demo is TSX, strict type checking passes without broad suppression, and every Gate 1 behavior test is unchanged and green.

## Phase 4: Build, packaging, and developer tooling

- [x] Add `@babel/preset-typescript` after the existing environment and React presets. Configure Babel CLI scripts to process `.ts` and `.tsx` explicitly and retain the existing CJS/ESM environment transforms and `--copy-files` behavior.
- [x] Add direct development types for React 18, React DOM 18, PropTypes, `lodash.debounce`, `react-window` 1.x, and `react-highlight-words`. Pin the `react-window` declaration package to its 1.x-compatible line.
- [x] Add `typescript`, `cross-env`, and a Node-14-compatible cross-platform copy utility. Use `cross-env BABEL_ENV=...` so CJS/ESM scripts work on Windows as well as Unix; replace `mkdir -p`/`cp` in the style script with the copy utility.
- [x] Add `typecheck`, `build:types`, `test`, and `test:watch` scripts. Include `build:types` in `lib` and its watch equivalent in `lib:watch`; keep CJS, ESM, declarations, and styles in disjoint output paths so concurrent builds cannot race.
- [x] Update webpack's source rule and resolver for `.ts`/`.tsx`, and point the demo entry at `demo.tsx`. Keep production mode, source maps, CSS handling, output location, dev-server behavior, and HTML handling unchanged.
- [x] Point package type metadata at `dist/types/index.d.ts`. Keep `main`, `module`, runtime `exports`, stylesheet export, peer dependencies, and package name/version unchanged during migration.
- [x] Ensure publishing still contains CJS and ESM component trees, root stylesheet, generated declaration tree, README, license, package metadata, and source. Do not accidentally publish tests, fixtures, coverage, or temporary package-smoke directories.
- [ ] Update README examples to show typed option/ref/fetch callback usage and state that declarations are generated from source. Do not rename props or rewrite behavioral documentation as part of the conversion.
- [x] Keep the pre-commit formatter working for `.ts`/`.tsx`. If the dormant legacy ESLint config is retained, update its parser/extensions to understand TypeScript; if lint remains unused, document that cleanup separately rather than adding a migration-blocking lint rewrite.

The current `lib` command is Unix-specific and fails on Windows because of inline `BABEL_ENV`, `mkdir -p`, and `cp`. The cross-platform script change is required for this repository and must produce the same artifact layout as the current successful Unix build.

**Gate 4:** a clean `npm run lib` succeeds on Windows and Unix-compatible shells; `npm run build` builds the demo; no declaration file references source-only paths; and `npm pack --dry-run` lists every required artifact.

## Phase 5: Public API and release verification

- [ ] Add compile fixtures for default/named imports, all exported types, custom option keys, string and numeric IDs, nested and flattened data, raw-ID and object values, controlled/uncontrolled usage, single/multi callbacks, fetch callbacks, custom renderers, style functions, `react-select` pass-through props, and all ref methods.
- [ ] Build a temporary consumer against the packed tarball and compile it using package-root imports only. This verifies the exports map and generated declaration graph rather than source-relative imports.
- [ ] Smoke-test the packed CJS entry with `require` and the ESM entry through the same bundler path supported before migration. Assert identical export keys and that default export identity equals the named `IntelligentTreeSelect` export.
- [x] Compare pre/post Babel artifacts structurally: same module tree, CSS bytes, runtime imports, export names, `propTypes`, and `defaultProps`. Ignore formatting/helper differences introduced solely by stripping types.
- [ ] Run the behavior suite with React 17, 18, and 19 installations, using matching React DOM versions. At minimum, mount, select, expand, search, async-load, and call refs in each peer version.
- [ ] Run the final command set from a clean install: format check, type check, tests, library build, demo build, package dry run, packed-consumer type test, and peer-version smoke matrix.
- [x] Review the final diff for accidental logic edits. Any runtime change must be explained by a failing baseline test or listed as a compatibility exception; otherwise revert it from the migration.

## Definition of done

The migration is complete when all source and demo code selected above is TypeScript, strict checking passes, declarations are generated from source, CJS/ESM/CSS entry points remain usable, all old valid type fixtures still compile, runtime characterization tests pass unchanged, package contents are correct, and React 17/18/19 smoke checks pass.

Implementation evidence (including results from the migration session):

- Type check: `npm run typecheck` passes in strict mode, including source, demo, behavior tests, and source-level API fixtures.
- Characterization tests: the same 12 Jest/Testing Library tests pass against a temporary checkout of the original JavaScript source and the migrated TypeScript source. They cover exports, utilities, tree processing, controlled and uncontrolled values, filtering, fetch/cache behavior, and refs.
- Library and demo builds: cross-platform CJS, ESM, declaration, CSS, and production webpack builds pass.
- Packed consumer checks: package-root type fixture, CJS export identity smoke test, and `npm pack --dry-run` pass; the package contains all runtime and declaration artifacts and excludes tests/tooling.
- Runtime artifact comparison: five of the seven original source modules produce byte-identical CJS output. The two component differences are erased type adapters expressed as local component aliases and an object-property shorthand; logic, prop spread order, imports, exports, `propTypes`, and `defaultProps` match the original output.
- React peer matrix: packed CJS artifact server-renders with React 17.0.2 and React 19.2.8; the full DOM behavior suite passes with the repository's React 18.3.1.
- Compatibility exceptions: no runtime regression identified by the existing tests and artifact review; exhaustive source compatibility and the full release matrix remain unverified.

## Validation audit — 2026-09-07

Audited commit `1d2bfcc` with the existing untracked demo, package fixtures, and this plan. Checked boxes represent implemented requirements supported by source inspection, current passing commands, or the explicitly recorded baseline comparison from the migration session. Unchecked compound items are not complete merely because some of their cases pass.

### Checks rerun in this audit

| Check                                         | Result                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run prettier:check`                      | PASS                                                                                                                  |
| `npm run typecheck`                           | PASS, strict source/demo/test checking                                                                                |
| `npm test -- --runInBand --silent`            | PASS, 3 suites and 12 tests on React 18                                                                               |
| `npm run lib`                                 | PASS, CJS/ESM/declarations/CSS on Windows with existing dependencies                                                  |
| `npm run build`                               | PASS, with three webpack bundle-size/performance warnings                                                             |
| `npm run test:package-types`                  | PASS, repository package self-reference using Node16 resolution                                                       |
| `npm pack --dry-run --json --ignore-scripts`  | PASS, 47 entries; runtime, declarations, source and CSS included; tests/tooling excluded                              |
| Built CJS API and CSS checks                  | PASS, original runtime export keys, default/named identity, and identical source/output stylesheet bytes              |
| Low-level two-argument renderer compile probe | PASS under the installed React 18 types; changed renderer declaration alone did not establish a compatibility failure |

The prior session's original-JavaScript baseline run and artifact comparison remain recorded above; they were not rerun in this audit. React 17/19 results above are server-render checks from that session, not the full DOM interaction matrix required by Phase 5.

### Remaining work and limits of the evidence

- **Phase 1:** the 12 tests provide partial coverage. Numeric and duplicate IDs, cycles, recursive collapse, selected/focused scrolling, keyboard chaining, all controlled/uncontrolled value forms, pagination, overlap suppression, debounce cancellation/flush, cache expiry/errors, renderer/style variants, and low-level ref edge cases do not all have dedicated assertions. Leave these compound checklist items open.
- **Gate 1 chronology:** baseline tests were run retrospectively against the JavaScript snapshot. The original requirement to pass the entire planned suite before conversion, with a tooling-only diff, was not met.
- **Phase 2:** `passedValue` is declared as an array but initialized using an assertion over the legacy scalar-or-array value. Raw IDs have a public union, but the internal model is not fully accurate. Public named renderer/scroll type exports and exhaustive additive API compatibility still need review.
- **Gate 2 / Phase 5 fixtures:** current positive fixtures pass, but there are no expected-invalid `@ts-expect-error` cases and not all planned renderer, style, nested-data, value, and ref combinations are covered. The low-level renderer probe passed; it does not prove every old valid consumer still compiles.
- **Phase 3:** assertions are not individually documented as required by the plan. Strict checking passes, but that documentation item remains open.
- **Phase 4 documentation:** README includes typed option/ref usage; it does not yet include the planned typed fetch callback example. The unused legacy ESLint configuration remains a separate cleanup task; the existing pre-commit formatter supports TS/TSX.
- **Gate 4:** Windows builds passed with the installed dependency tree. A clean install, Unix build, and Node 14 execution were not performed. Installed TypeScript requires Node >=14.17; cross-env and shx engine ranges include Node 14, but this is not a full toolchain compatibility test.
- **Phase 5 packaging:** the package self-reference type fixture is not an isolated tarball consumer. Packed ESM bundler import and isolated packed declaration compilation remain unchecked; the demo imports source.
- **Phase 5 peers:** run the planned mount/select/expand/search/async/ref DOM checks with matching React/React DOM 17 and 19. Historical server rendering is insufficient to check that item.
- **Repository completeness:** `examples/demo.tsx`, `package-tests/`, and this plan are untracked at audit time. Include them in the migration commit before relying on a fresh checkout.
- **Known preserved behavior:** named async loading with no local-storage entry can fail when `componentDidMount` reads `data.length` from an undefined cache result. The cache test seeds an empty valid entry. This is a pre-existing behavior preserved by the migration, not a newly validated successful cache-miss path.

The implementation builds and its current tests pass. The complete migration plan's release-validation gates are **not yet all satisfied**.
