---
description: 'Scaffold a new Drizzle-backed repository by defining a domain port, implementing it with typed Drizzle queries, and wiring it into DI to provide consistent, testable persistence whenever a use case needs read/write access to a new or refactored table.'
---

# Create a Drizzle Repository

Scaffold a new data-access repository the way every existing one is built: a port interface in `domain/ports/`, a `Drizzle*Repository` implementation in `infrastructure/repositories/`, and DI wiring in `bootstrap/compose.ts`. Use this when a use case needs to read or write a new table.

## When to Use

- A new use case needs persistence for an entity that has no repository yet.
- You added a table to `backend/src/db/schema.ts` and need typed access to it.
- Splitting an over-broad repository into a focused one.

## Checkpoints

- What is the entity/aggregate name (drives `I<Name>Repository` and `Drizzle<Name>Repository`)?
- Does the table already exist in `backend/src/db/schema.ts`, or is a migration needed first?
- Which read/write methods does the consuming use case actually require?

## Steps

### 1. Declare the port

Add `backend/src/domain/ports/<name>-repository.ts` with an `interface I<Name>Repository`. Methods return domain entities (from `domain/`), use `Promise<Entity | null>` for single lookups, and never reference Drizzle row types.

### 2. Implement with Drizzle

Add `backend/src/infrastructure/repositories/drizzle-<name>-repository.ts`: `export class Drizzle<Name>Repository implements I<Name>Repository` with `constructor(private readonly db: AppDb) {}`. Use the Drizzle query builder; return `row ?? null` for single rows. For "IN (list)" filters use `inArray(column, jsArray)` from `drizzle-orm` — never `ANY(${arr}::text[])`.

### 3. Wire into the DI container

Instantiate the repository in `backend/src/bootstrap/compose.ts` and expose it so route handlers can inject it into use cases.

### 4. Migrate if the schema changed

If you touched `backend/src/db/schema.ts`, run `bun run migrate:generate` from `backend/` (never hand-author migration files), then `bun run migrate:run`.

### 5. Verify

Run `bun run typecheck` and `bun run lint`; add a use-case test that supplies a stubbed `I<Name>Repository`.
