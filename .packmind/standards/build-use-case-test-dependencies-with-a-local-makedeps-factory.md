# Build Use-Case Test Dependencies With a Local makeDeps Factory

Application use-case tests construct their dependencies with a per-file `makeDeps()` helper that returns fully-stubbed port objects and captures calls in local variables for assertions. There is no shared fixture or builder library — each test file owns its stubs, typed against the real `domain/ports` interfaces so they stay honest when a port changes.

## Scope

Use-case tests under `backend/src/application/**/*.test.ts` (`bun:test`).

## Rules

* Define a local `function makeDeps(...)` per test file that returns the `deps` object the use case expects.
* Type each stubbed dependency against its `I*Repository` / gateway interface so unimplemented methods are caught by `tsc`.
* Capture side effects (e.g. audit log entries, call counts) in closure variables returned alongside the stubs, then assert on them.
* Stub only the methods the use case touches with realistic return values; keep the rest as trivial async no-ops (`async () => []`, `async () => null`).
* Import test primitives from `bun:test` (`describe`, `it`, `expect`) — do not add Jest or Vitest.
