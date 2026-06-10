# Packmind Standards Index

This standards index contains all available coding standards that can be used by AI agents (like Cursor, Claude Code, GitHub Copilot) to find and apply proven practices in coding tasks.

## Available Standards

- [Application Use Cases Are Pure Functions](./standards/application-use-cases-are-pure-functions.md) : Enforce TypeScript use cases in `backend/src/application/` as exported async pure functions that take typed `deps` port interfaces and a single `input`, avoid instantiating dependencies or importing Hono/Drizzle, and return expected failures as discriminated unions to keep business logic framework-agnostic and trivially testable.
- [Array Membership Uses Drizzle inArray, Never Raw ANY/unnest](./standards/array-membership-uses-drizzle-inarray-never-raw-anyunnest.md) : Enforce Drizzle ORM `inArray(column, jsArray)` for list filters in backend repository methods and forbid raw `ANY(${jsArray}::text[])`/`unnest(${jsArray}::text[], ...)` in `sql\`...\`` while avoiding swallowed `try/catch` and guarding empty arrays to prevent postgres-js array-flattening runtime errors and silent data inconsistency.
- [Build Use-Case Test Dependencies With a Local makeDeps Factory](./standards/build-use-case-test-dependencies-with-a-local-makedeps-factory.md) : Standardize use-case tests under `backend/src/application/**/*.test.ts` on per-file `makeDeps()` factories using TypeScript-typed `domain/ports` stubs and `bun:test`, capturing stub side effects in closure variables for assertions to keep tests isolated and catch port changes at compile time.
- [Data Access Lives Behind Repository Ports](./standards/data-access-lives-behind-repository-ports.md) : Enforce repository port interfaces (`I*Repository`) in `backend/src/domain/ports/` with single Drizzle implementations in `backend/src/infrastructure/repositories/` that inject `AppDb`, return domain entities and `row ?? null`, and forbid Drizzle queries outside infrastructure to preserve hexagonal boundaries and improve testability and maintainability.


---

*This standards index was automatically generated from deployed standard versions.*