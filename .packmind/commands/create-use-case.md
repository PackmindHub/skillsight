# Create a Use Case

Scaffold a new application use case following the repository's hexagonal convention: a pure function that takes `deps` (ports) and `input`, plus a matching `bun:test` test built with a local `makeDeps`. Use this whenever you add a business operation to the backend so it stays framework-agnostic and testable.

## When to Use

- Adding a new business operation to `backend/src/application/`.
- Implementing the logic behind a new HTTP route before wiring the handler.
- Refactoring logic out of an HTTP handler into the application layer.

## Checkpoints

- What is the feature folder (e.g. `skills`, `plugins`, `integrations`) the use case belongs to?
- Which domain ports does it need (repositories, gateways)?
- What are the expected failure cases that should be returned as `{ error: ... }` instead of thrown?

## Steps

### 1. Create the use-case file

Add `backend/src/application/<feature>/<verb-noun>.ts`. Export an `async function` taking `deps` (an object of `domain/ports` interfaces) and `input` (a typed params object). Return the domain entity on success and a discriminated `{ error: "..." }` union for expected failures. Import only from `domain/` — no Hono, no Drizzle.

### 2. Write the test alongside it

Add `<verb-noun>.test.ts` in the same folder. Define a local `makeDeps(...)` that returns fully-stubbed ports typed against their `I*Repository` interfaces, capturing call side-effects in closure variables. Use `describe`/`it`/`expect` from `bun:test`. Cover the success path and each `{ error }` branch.

### 3. Wire it into the HTTP layer

In the relevant `backend/src/http/` handler, instantiate dependencies from the DI container (`bootstrap/compose.ts`) and call the use case, mapping `{ error }` results to the correct HTTP status. Keep the handler thin.

### 4. Verify

Run `bun test backend/src/application/<feature>/<verb-noun>.test.ts`, then `bun run lint` and `bun run typecheck`.
