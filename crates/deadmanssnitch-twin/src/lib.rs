#![forbid(unsafe_code)]
//! Digital twin for the Dead Man's Snitch API.

/// Library version, used by workspace smoke tests.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    #[test]
    fn package_starts_at_new_lineage() {
        assert_eq!(super::VERSION, "0.1.0");
    }
}
