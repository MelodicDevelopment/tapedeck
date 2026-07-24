// Without this, release builds on Windows open an extra console window
// alongside the app (the default Rust binary subsystem is "console").
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tapedeck_lib::run();
}
