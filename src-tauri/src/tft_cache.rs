//! Local cache of raw cdragon JSON, versioned by set. Stored under the app's
//! data dir: `<appData>/dps-sim/cache/tft-set{N}.json` + `manifest.json`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct Manifest {
    pub set: i32,
    pub url: String,
    pub fetched_at: u64,
}

fn cache_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or("no data dir")?;
    let dir = base.join("dps-sim").join("cache");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn set_path(set: i32) -> Result<PathBuf, String> {
    Ok(cache_dir()?.join(format!("tft-set{}.json", set)))
}

fn manifest_path() -> Result<PathBuf, String> {
    Ok(cache_dir()?.join("manifest.json"))
}

pub fn load_cached(set: i32) -> Result<Option<Value>, String> {
    let path = set_path(set)?;
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    Ok(Some(value))
}

pub fn save_cached(set: i32, value: &Value) -> Result<(), String> {
    let path = set_path(set)?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    let manifest = Manifest {
        set,
        url: crate::tft_fetch::TFT_JSON_URL.to_string(),
        fetched_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    };
    let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(manifest_path()?, manifest_bytes).map_err(|e| e.to_string())?;
    Ok(())
}
