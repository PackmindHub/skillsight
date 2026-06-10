# Array Membership Uses Drizzle inArray, Never Raw ANY/unnest

In `sql\`...\`` template literals, postgres-js flattens a JS array into individual scalar parameters. Writing `ANY(${jsArray}::text[])` or `unnest(${jsArray}::text[], ...)` therefore casts a single text value and throws `malformed array literal` at runtime. Use Drizzle's query builder with `inArray(column, jsArray)` instead. This has bitten the skill-repository methods twice, and both times an outer `try/catch` swallowed the failure and left rows inconsistent rather than crashing visibly.

## Scope

Backend repository methods that filter by a list of values (`backend/src/infrastructure/repositories/`).

## Rules

* Use `inArray(column, jsArray)` from `drizzle-orm` for "column IN (list)" filters — e.g. `this.db.delete(pluginSkills).where(inArray(pluginSkills.pluginName, pluginNames))`.
* Never embed `ANY(${jsArray}::text[])` or `unnest(${jsArray}::text[], ...)` inside a `sql\`...\`` template with a raw JS array.
* Do not wrap repository writes in a broad `try/catch` that swallows the error; let array-binding and constraint failures surface so they are not silently lost.
* Guard against empty arrays where the query semantics require it, since `inArray(col, [])` matches no rows.
