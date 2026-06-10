---
name: 'Array Membership Uses Drizzle inArray, Never Raw ANY/unnest'
alwaysApply: true
description: 'Enforce Drizzle ORM `inArray(column, jsArray)` for list filters in backend repository methods and forbid raw `ANY(${jsArray}::text[])`/`unnest(${jsArray}::text[], ...)` in `sql\`...\`` while avoiding swallowed `try/catch` and guarding empty arrays to prevent postgres-js array-flattening runtime errors and silent data inconsistency.'
---

# Standard: Array Membership Uses Drizzle inArray, Never Raw ANY/unnest

Enforce Drizzle ORM `inArray(column, jsArray)` for list filters in backend repository methods and forbid raw `ANY(${jsArray}::text[])`/`unnest(${jsArray}::text[], ...)` in `sql\`...\`` while avoiding swallowed `try/catch` and guarding empty arrays to prevent postgres-js array-flattening runtime errors and silent data inconsistency. :
* Do not wrap repository writes in a broad `try/catch` that swallows the error; let array-binding and constraint failures surface so they are not silently lost.
* Guard against empty arrays where the query semantics require it, since `inArray(col, [])` matches no rows.
* Never embed `ANY(${jsArray}::text[])` or `unnest(${jsArray}::text[], ...)` inside a `sql\`...\`` template with a raw JS array.
* Use `inArray(column, jsArray)` from `drizzle-orm` for "column IN (list)" filters — e.g. `this.db.delete(pluginSkills).where(inArray(pluginSkills.pluginName, pluginNames))`.

Full standard is available here for further request: [Array Membership Uses Drizzle inArray, Never Raw ANY/unnest](../../../.packmind/standards/array-membership-uses-drizzle-inarray-never-raw-anyunnest.md)