//! Tauri desktop shell entry. The Rust side only does HTTP fetch + local cache
//! IO for the cdragon `tft.json`; all normalization and DPS math live in the
//! TypeScript frontend (see `src/data`, `src/engine`).

mod tft_cache;
mod tft_fetch;
mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::load_or_fetch_tft,
            commands::refresh_tft,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
