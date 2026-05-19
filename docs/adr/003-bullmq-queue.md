# 3. Background Job Processing with BullMQ

Date: 2026-05-19

## Status

Accepted

## Context

Document processing (parsing, chunking, and embedding) is computationally expensive and slow. These operations cannot be performed synchronously during HTTP requests. We need a reliable background job queuing system to handle these tasks asynchronously.

## Decision

We have decided to use **BullMQ** backed by **Redis** for managing background jobs.

## Rationale

1. **Reliability and Persistence**: BullMQ uses Redis to persistently store jobs, ensuring that tasks are not lost if the application crashes.
2. **Robust Features**: It provides out-of-the-box support for job retries, exponential backoff, rate limiting, and delayed jobs.
3. **Concurrency Control**: BullMQ allows us to strictly control the concurrency of processing workers to prevent CPU/memory exhaustion during massive document uploads.
4. **Ecosystem & Observability**: BullMQ has a strong ecosystem, including UI tools (like BullMQ Board or Taskforce.sh) that make it easy to monitor queue health and inspect failed jobs in production.

## Consequences

- **Positive**: We have a resilient, scalable asynchronous processing pipeline that can gracefully handle spikes in document uploads.
- **Negative**: We introduce a new infrastructure dependency (Redis), which adds to operational overhead and requires separate monitoring.
- **Mitigation**: We will use managed Redis instances in production to reduce maintenance burden and ensure high availability.
