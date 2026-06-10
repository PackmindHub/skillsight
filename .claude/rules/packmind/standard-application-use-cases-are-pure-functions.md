---
name: 'Application Use Cases Are Pure Functions'
alwaysApply: true
description: 'Enforce TypeScript use cases in `backend/src/application/` as exported async pure functions that take typed `deps` port interfaces and a single `input`, avoid instantiating dependencies or importing Hono/Drizzle, and return expected failures as discriminated unions to keep business logic framework-agnostic and trivially testable.'
---

# Standard: Application Use Cases Are Pure Functions

Enforce TypeScript use cases in `backend/src/application/` as exported async pure functions that take typed `deps` port interfaces and a single `input`, avoid instantiating dependencies or importing Hono/Drizzle, and return expected failures as discriminated unions to keep business logic framework-agnostic and trivially testable. :
* Accept all dependencies through a typed `deps` object whose fields are `domain/ports` interfaces (e.g. `{ skills: ISkillRepository; audit: IAuditRepository }`); never `new` a repository or gateway inside a use case.
* Accept call parameters through a single typed `input` object as the second argument.
* Do not import Hono, Drizzle, or any infrastructure module from the application layer — depend only on `domain/` types and ports.
* Export use cases as named `async function`s, not classes — `export async function updateSkillStatus(deps, input)`.
* Return expected failures as discriminated unions (e.g. `Promise<Skill | { error: "not_found" | "not_editable" }>`) instead of throwing.

Full standard is available here for further request: [Application Use Cases Are Pure Functions](../../../.packmind/standards/application-use-cases-are-pure-functions.md)