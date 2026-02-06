use serde_json::Value;

pub struct CmdProxyState {
    pub last_refresh_time_proxies: std::time::Instant,
    pub need_refresh_proxies: bool,
    pub last_refresh_time_providers: std::time::Instant,
    pub need_refresh_providers: bool,
    pub proxies: Box<Value>,
    pub providers_proxies: Box<Value>,
}

impl Default for CmdProxyState {
    fn default() -> Self {
        Self {
            last_refresh_time_proxies: std::time::Instant::now(),
            need_refresh_proxies: true,
            last_refresh_time_providers: std::time::Instant::now(),
            need_refresh_providers: true,
            proxies: Box::new(Value::Null),
            providers_proxies: Box::new(Value::Null),
        }
    }
}
