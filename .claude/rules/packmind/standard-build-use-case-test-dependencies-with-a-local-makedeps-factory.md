---
name: 'Build Use-Case Test Dependencies With a Local makeDeps Factory'
alwaysApply: true
description: 'Standardize use-case tests under `backend/src/application/**/*.test.ts` on per-file `makeDeps()` factories using TypeScript-typed `domain/ports` stubs and `bun:test`, capturing stub side effects in closure variables for assertions to keep tests isolated and catch port changes at compile time.'
---

# Standard: Build Use-Case Test Dependencies With a Local makeDeps Factory

Standardize use-case tests under `backend/src/application/**/*.test.ts` on per-file `makeDeps()` factories using TypeScript-typed `domain/ports` stubs and `bun:test`, capturing stub side effects in closure variables for assertions to keep tests isolated and catch port changes at compile time. :
* Capture side effects (e.g. audit log entries, call counts) in closure variables returned alongside the stubs, then assert on them.
* Define a local `function makeDeps(...)` per test file that returns the `deps` object the use case expects.
* Import test primitives from `bun:test` (`describe`, `it`, `expect`) — do not add Jest or Vitest.
* Stub only the methods the use case touches with realistic return values; keep the rest as trivial async no-ops (`async () => []`, `async () => null`).
* Type each stubbed dependency against its `I*Repository` / gateway interface so unimplemented methods are caught by `tsc`.

Full standard is available here for further request: [Build Use-Case Test Dependencies With a Local makeDeps Factory](../../../.packmind/standards/build-use-case-test-dependencies-with-a-local-makedeps-factory.md)