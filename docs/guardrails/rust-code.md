# Rust code guardrail

Parse at boundaries and model states with types. Keep `unsafe` forbidden. Do not pass `serde_json::Value` beyond wire decoding. Use a clock abstraction rather than reading wall time in state logic. Every lint allowance must be local and explain why.
