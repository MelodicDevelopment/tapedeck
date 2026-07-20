//! In-process DNS for Tapedeck's HTTP client.
//!
//! macOS resolution on this machine intermittently returns "no such host"
//! for valid names (flaky upstream at cache-miss moments, briefly negative-
//! cached system-wide, so quick retries keep failing). Resolving in-process
//! with hickory sidesteps the system resolver entirely: system nameservers
//! first, public resolvers as fallback, successes cached for their TTL.

use std::{net::SocketAddr, sync::Arc};

use hickory_resolver::{
    config::{NameServerConfigGroup, ResolverConfig, ResolverOpts},
    TokioAsyncResolver,
};
use reqwest::dns::{Addrs, Name, Resolve, Resolving};

pub struct TapedeckResolver {
    resolver: TokioAsyncResolver,
}

impl TapedeckResolver {
    pub fn new() -> Arc<Self> {
        let (system_config, mut opts) = hickory_resolver::system_conf::read_system_conf()
            .unwrap_or_else(|_| (ResolverConfig::default(), ResolverOpts::default()));

        let mut servers = NameServerConfigGroup::new();
        for server in system_config.name_servers() {
            servers.push(server.clone());
        }
        for fallback in [
            NameServerConfigGroup::google(),
            NameServerConfigGroup::cloudflare(),
        ] {
            for server in fallback.iter() {
                if !servers.contains(server) {
                    servers.push(server.clone());
                }
            }
        }

        let config = ResolverConfig::from_parts(None, Vec::new(), servers);
        opts.timeout = std::time::Duration::from_secs(3);
        opts.attempts = 2;

        Arc::new(Self {
            resolver: TokioAsyncResolver::tokio(config, opts),
        })
    }
}

impl Resolve for TapedeckResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let resolver = self.resolver.clone();
        Box::pin(async move {
            let lookup = resolver.lookup_ip(name.as_str()).await?;
            let addrs: Addrs = Box::new(
                lookup
                    .into_iter()
                    .map(|ip| SocketAddr::new(ip, 0))
                    .collect::<Vec<_>>()
                    .into_iter(),
            );
            Ok(addrs)
        })
    }
}
