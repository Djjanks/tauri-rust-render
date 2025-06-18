#[derive(serde::Deserialize, Clone)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(serde::Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}


#[derive(serde::Deserialize)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

pub struct OverlayWindowConfig {
    pub position: Position,
}

pub fn srgb_to_linear(c: u8) -> f64 {
    let c = c as f64 / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

pub fn calculate_overlay_position(
    main_pos: tauri::PhysicalPosition<i32>,
    offset: &Position,
) -> tauri::PhysicalPosition<i32> {
    tauri::PhysicalPosition {
        x: (main_pos.x as f64 + offset.x) as i32,
        y: (main_pos.y as f64 + offset.y) as i32,
    }
}