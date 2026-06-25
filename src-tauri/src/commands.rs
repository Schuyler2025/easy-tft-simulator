//! Tauri commands exposed to the frontend. Return raw JSON; normalization
//! happens in TypeScript.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResult {
    pub raw: Value,
    pub from_cache: bool,
}

/// Load cached raw JSON for a set if present, else fetch + cache it.
/// `set` may be null to use the latest set present in the data.
#[tauri::command]
pub fn load_or_fetch_tft(set: Option<i32>) -> Result<LoadResult, String> {
    let set = set.unwrap_or(17); // default to Set 17; 0 means "use highest"
    if let Some(cached) = crate::tft_cache::load_cached(set)? {
        return Ok(LoadResult { raw: cached, from_cache: true });
    }
    let raw = crate::tft_fetch::fetch_tft_json()?;
    crate::tft_cache::save_cached(set, &raw)?;
    Ok(LoadResult { raw, from_cache: false })
}

/// Force a fresh fetch (bypass cache), then update the cache.
#[tauri::command]
pub fn refresh_tft(set: Option<i32>) -> Result<LoadResult, String> {
    let set = set.unwrap_or(17);
    let raw = crate::tft_fetch::fetch_tft_json()?;
    crate::tft_cache::save_cached(set, &raw)?;
    Ok(LoadResult { raw, from_cache: false })
}
