// The app talks to CulinaryServer straight from the WebView; nothing native is exposed to it.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().run(tauri::generate_context!()).expect("No se pudo iniciar Culinary Dueño");
}
