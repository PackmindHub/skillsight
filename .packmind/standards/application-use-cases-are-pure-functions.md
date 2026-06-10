# Application Use Cases Are Pure Functions

Every use case in `backend/src/application/` is an exported async function that takes a `deps` object (port interfaces) as its first argument and an `input` object as its second. Use cases never instantiate their own dependencies and never import framework code (Hono, Drizzle). Expected failures are returned as discriminated-union values, not thrown.

This keeps business logic framework-agnostic and trivially testable: a test supplies hand-built `deps` and asserts on the return value. The convention holds across all ~52 application files.

## Scope

TypeScript files under `backend/src/application/`.

## Rules

* Export use cases as named `async function`s, not classes — `export async function updateSkillStatus(deps, input)`.
* Accept all dependencies through a typed `deps` object whose fields are `domain/ports` interfaces (e.g. `{ skills: ISkillRepository; audit: IAuditRepository }`); never `new` a repository or gateway inside a use case.
* Accept call parameters through a single typed `input` object as the second argument.
* Return expected failures as discriminated unions (e.g. `Promise<Skill | { error: "not_found" | "not_editable" }>`) instead of throwing.
* Do not import Hono, Drizzle, or any infrastructure module from the application layer — depend only on `domain/` types and ports.
