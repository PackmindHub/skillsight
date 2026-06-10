# Data Access Lives Behind Repository Ports

All persistence goes through a port interface declared in `backend/src/domain/ports/` and implemented by a single Drizzle class in `backend/src/infrastructure/repositories/`. The application and HTTP layers depend on the `I*Repository` interface, never on Drizzle directly. This is the data-access half of the hexagonal architecture and is consistent across all 12 repositories.

## Scope

Database access in the backend — `backend/src/domain/ports/`, `backend/src/infrastructure/repositories/`.

## Rules

* Declare every data-access contract as an `I<Name>Repository` interface in `domain/ports/`, returning domain entities (from `domain/`), not Drizzle row types.
* Implement each port with exactly one `class Drizzle<Name>Repository implements I<Name>Repository` in `infrastructure/repositories/`.
* Inject the database handle via `constructor(private readonly db: AppDb) {}`; do not import a global db singleton inside repository methods.
* Return `row ?? null` for single-row lookups so callers get an explicit `null` instead of `undefined`.
* Never run Drizzle queries (`this.db.select()`, `.insert()`, …) outside `infrastructure/repositories/`; keep `application/` and `http/` free of ORM calls.
