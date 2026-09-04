# Contributing

Install the pinned Rust toolchain, then run:

```sh
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo nextest run --workspace
cargo build --workspace --release
cargo deny check
```

Use conventional commits. Tests never use a live account. Start the twin with `cargo run -p deadmanssnitch-twin`, then point the server at it with `DEADMANSNITCH_API_URL=http://127.0.0.1:3001/v1`.
