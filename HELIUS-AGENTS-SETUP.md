# Helius agents setup for RogueZero

This repo is now wired for the Helius agent toolchain in a project-local way.

## What is configured

- `.mcp.json`
  - Starts `helius-mcp@latest` through `npx` in MCP-compatible tools.
- `AGENTS.md`
  - Adds RogueZero-specific Helius and Solana rules for future agent work.
- `services/api/src/lib/heliusClient.ts`
  - Shared TypeScript SDK client scaffold for future Helius-native features in the API service.

## Local prerequisites

1. Keep `HELIUS_API_KEY` available in your environment.
2. Keep `HELIUS_RPC_URL` and existing Helius env values in `.env` for the current runtime.
3. Use Node.js 20+ for `helius-sdk`.

## MCP usage

The Helius docs recommend MCP as the default interface for AI-agent workflows.
This repo uses the standalone MCP setup:

- server: `helius-mcp@latest`
- config file: `.mcp.json`
- API key resolution order from Helius docs:
  1. set inside the MCP session via `setHeliusApiKey`
  2. `HELIUS_API_KEY`
  3. `~/.helius/config.json`

## CLI usage

Optional local setup for shell workflows:

- install: `npm install -g helius-cli`
- set existing key: `helius config set-api-key YOUR_API_KEY`
- inspect config: `helius config show`
- usage stats: `helius usage --json`

## Skills usage

The Helius docs say skills require the Helius MCP server.
If you want the standalone Build skill in a compatible toolchain, the docs point to:

- `npx skills add helius-labs/core-ai --skill build`

For this repo, the practical baseline is:

- project-local MCP config
- repo-local agent guidance
- shared SDK scaffold for future code changes

## SDK usage in RogueZero

The Helius TypeScript SDK is installed in `services/api` for new Helius-native work.
Use the shared helper:

- `services/api/src/lib/heliusClient.ts`

Current rule for this repo:

- new Helius-specific capabilities can use `helius-sdk`
- existing worker execution code remains on the current `@solana/web3.js` path unless a migration is explicitly scoped

## Recommended Helius patterns adopted from docs

- prefer `getTransactionsForAddress` over signature fan-out
- prefer `getAssetBatch` over loops of `getAsset`
- prefer webhooks or WebSockets over polling when possible
- prefer Sender for latency-sensitive transaction flows
- keep Helius API keys out of frontend code
