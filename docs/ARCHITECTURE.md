# Architecture

Dependency direction is `mcp-deadmansnitch -> deadmanssnitch`; the independent `deadmanssnitch-twin` shares no production code. `deadmanssnitch-conformance` probes an HTTP target.

- `deadmanssnitch`: typed domain model, bounded HTTP client, retries, and error taxonomy.
- `mcp-deadmanssnitch`: process configuration, ten MCP tools, stdio and stateless HTTP transports.
- `deadmanssnitch-twin`: deterministic in-memory API/check-in simulator and control plane.
- `deadmanssnitch-conformance`: black-box contract smoke test.
