# RogueZero agent rules

Read `WORKFLOW.md`, `GPT-HUMAN-PLAN.md`, and `CLAUDE.md` before changing Helius or Solana code.

## Helius setup for this repo

- Use the repo-local `.mcp.json` to auto-start `helius-mcp` in MCP-compatible tools.
- Use `HELIUS_API_KEY` from environment or set it through the Helius MCP account action; never hardcode keys in code or docs.
- Prefer the Helius MCP tool surface for live wallet, asset, transaction, webhook, and docs lookups when available.

## RogueZero-specific invariants

- Preserve `owner_wallet` vs `session_wallet`; do not collapse them.
- Preserve the current API + worker split.
- Treat the current stored `session_keys` flow as implementation truth, not permission to redesign custody.
- Do not refactor existing `@solana/web3.js` execution code into `helius-sdk` wholesale unless the task explicitly asks for that migration.

## Helius coding rules

- For new Helius-specific app code, prefer `helius-sdk` instead of hand-rolled REST wrappers when it fits the task.
- For transaction history, prefer `getTransactionsForAddress` over `getSignaturesForAddress` + `getTransaction` fan-out.
- For multi-asset fetches, prefer `getAssetBatch` over looping `getAsset`.
- For real-time monitoring, prefer webhooks or WebSockets over polling where architecture allows.
- For time-sensitive transaction sends, prefer Helius Sender patterns over generic submission patterns when the task is latency-sensitive.
- If you use SDK smart-send helpers, do not manually add duplicate compute budget instructions.

## Safety rules

- Keep Helius secrets server-side only.
- Do not expose API keys in `apps/web` or browser-delivered code.
- Respect rate limits, retries, and budget tracking requirements documented in `WORKFLOW.md`.
