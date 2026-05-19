# 1. Selection of Elysia as the API Framework

Date: 2026-05-19

## Status

Accepted

## Context

We need a high-performance HTTP framework for the AI Document Platform. The platform will handle file uploads, document indexing jobs, and complex semantic search and RAG retrieval queries. We need a framework that is fast, type-safe, and integrates well with our chosen runtime.

## Decision

We have decided to use **Elysia.js** running on the **Bun** runtime.

## Rationale

1. **Performance**: Elysia is highly optimized for Bun and provides significantly better throughput and lower latency compared to Express, Fastify, or NestJS on Node.js.
2. **Type Safety**: Elysia offers end-to-end type safety out of the box using a unified schema validation approach, often integrating seamlessly with TypeScript and allowing for automatic Swagger/OpenAPI generation.
3. **Developer Experience**: The plugin ecosystem and declarative syntax make it easy to write clean and maintainable endpoint logic without excessive boilerplate.
4. **Bun Native**: Elysia is designed specifically for Bun, allowing us to leverage Bun's fast startup times, native SQLite/file I/O, and built-in package manager without friction.

## Consequences

- **Positive**: We will achieve higher request throughput and significantly lower response latency. Our APIs will be self-documenting and fully type-checked.
- **Negative**: The ecosystem around Elysia is smaller than Express or NestJS. We might need to write custom integrations for some third-party services that don't have official plugins yet.
- **Risk**: Bun is relatively new compared to Node.js, so we may encounter edge cases in production.
