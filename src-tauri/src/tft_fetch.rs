//! HTTP fetch of the cdragon `tft.json`. Returns the raw JSON value; the
//! frontend normalizes it.

use serde_json::Value;

pub const TFT_JSON_URL: &str =
    "https://raw.communitydragon.org/latest/cdragon/tft/en_us/tft.json";

pub fn fetch_tft_json() -> Result<Value, String> {
    let resp = reqwest::blocking::get(TFT_JSON_URL).map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("fetch failed: {}", resp.status()));
    }
    resp.json::<Value>().map_err(|e| e.to_string())
}
