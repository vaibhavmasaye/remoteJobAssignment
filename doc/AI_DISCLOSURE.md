# AI usage disclosure

This project was built with substantial assistance from Claude and OpenAI Codex/ChatGPT.

## How AI was used

- Interpreting the assignment and proposing the adapter/orchestrator architecture.
- Drafting and revising TypeScript source adapters, repositories, middleware, tests, Docker configuration, and documentation.
- Migrating the raw PostgreSQL data layer to Prisma ORM.
- Diagnosing local port conflicts and Render Docker build/startup failures from logs.
- Reviewing failure handling, deployment configuration, and submission readiness.

## Human direction and review

The developer selected the requirements and deployment approach, supplied integration and Render context, reviewed proposed changes, ran the application, and provided real build/deployment logs. Generated changes were checked with:

```bash
npm run build
npm test
npx prisma validate
git diff --check
```

At the time of this disclosure, the build and Prisma validation pass and 51 unit tests pass. A live integration run must still be confirmed on the final Render deployment.

## Known limitations identified during review

- Jobs run inside the web process rather than a durable worker queue.
- `prisma db push` is used for assignment-scale schema deployment instead of versioned production migrations.
- The current connection model uses one configured account per source.
- Request idempotency keys are not persisted as unique job keys.
- Existing external IDs are skipped; version-aware update handling is future work.
- Unit coverage is focused on error classification and rate limiting; live API contract tests remain desirable.
- Webhook verification helpers exist, but complete ingestion and replay processing are not implemented.

## Conversation history

Submission requires a public share/export of the relevant AI conversation:

- Claude conversation: **TODO: add public share URL if applicable**
- OpenAI Codex/ChatGPT conversation: **TODO: add public share/export URL**

Remove unused placeholders and replace every applicable `TODO` before submission. Review the export to ensure it does not expose database URLs, API keys, OAuth tokens, or other secrets.

Disclosure updated: July 29, 2026.
