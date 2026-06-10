# Packmind Commands Index

This file contains all available coding commands that can be used by AI agents (like Cursor, Claude Code, GitHub Copilot) to find and use proven patterns in coding tasks.

## Available Commands

- [Create drizzle repository](commands/create-drizzle-repository.md) : Scaffold a new Drizzle-backed repository by defining a domain port, implementing it with typed Drizzle queries, and wiring it into DI to provide consistent, testable persistence whenever a use case needs read/write access to a new or refactored table.
- [Create use case](commands/create-use-case.md) : Scaffold a hexagonal, framework-agnostic application use case as a pure deps+input function with a colocated bun:test using makeDeps so business operations stay easily testable and cleanly separated from HTTP concerns when adding or refactoring backend application logic.
- [Pre pr quality check](commands/pre-pr-quality-check.md) : Run the full local pre-PR quality gate (frozen-lockfile install, lint, typecheck, tests, build, and optional Docker build) to catch CI and type errors early and ensure your pull request against main passes on the first try.


---

*This file was automatically generated from deployed command versions.*