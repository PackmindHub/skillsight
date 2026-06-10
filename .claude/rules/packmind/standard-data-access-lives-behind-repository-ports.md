---
name: 'Data Access Lives Behind Repository Ports'
alwaysApply: true
description: 'Enforce repository port interfaces (`I*Repository`) in `backend/src/domain/ports/` with single Drizzle implementations in `backend/src/infrastructure/repositories/` that inject `AppDb`, return domain entities and `row ?? null`, and forbid Drizzle queries outside infrastructure to preserve hexagonal boundaries and improve testability and maintainability.'
---

# Standard: Data Access Lives Behind Repository Ports

Enforce repository port interfaces (`I*Repository`) in `backend/src/domain/ports/` with single Drizzle implementations in `backend/src/infrastructure/repositories/` that inject `AppDb`, return domain entities and `row ?? null`, and forbid Drizzle queries outside infrastructure to preserve hexagonal boundaries and improve testability and maintainability. :
* Declare every data-access contract as an `I<Name>Repository` interface in `domain/ports/`, returning domain entities (from `domain/`), not Drizzle row types.
* Implement each port with exactly one `class Drizzle<Name>Repository implements I<Name>Repository` in `infrastructure/repositories/`.
* Inject the database handle via `constructor(private readonly db: AppDb) {}`; do not import a global db singleton inside repository methods.
* Never run Drizzle queries (`this.db.select()`, `.insert()`, …) outside `infrastructure/repositories/`; keep `application/` and `http/` free of ORM calls.
* Return `row ?? null` for single-row lookups so callers get an explicit `null` instead of `undefined`.

Full standard is available here for further request: [Data Access Lives Behind Repository Ports](../../../.packmind/standards/data-access-lives-behind-repository-ports.md)