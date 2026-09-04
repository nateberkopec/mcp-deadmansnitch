# mcp-deadmansnitch

A Rust Model Context Protocol server and typed client for [Dead Man's Snitch](https://deadmanssnitch.com/).

Set `DEADMANSNITCH_API_KEY` and run `cargo run -p mcp-deadmansnitch`. The default transport is stdio.

HTTP mode: `mcp-deadmansnitch --transport http --listen 127.0.0.1:3000`.

Remote binding requires `--allow-remote` and a separate MCP bearer token. Put a TLS reverse proxy in front for remote use.

The server exposes list/get/create/update/delete, pause/unpause, tag management, and an opt-in `check_in` tool. Check-in is disabled unless `--allow-check-in` is passed because it can falsely report a job as healthy.

Use `--read-only` to expose only reads.

MIT licensed. Based in part on James Brink's original Python implementation retained in git history.
