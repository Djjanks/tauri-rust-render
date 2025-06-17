use std::{collections::HashMap, sync::Mutex};

use tauri::Manager;
use wgpu::PipelineCompilationOptions;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn srgb_to_linear(c: u8) -> f64 {
    let c = c as f64 / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

#[derive(serde::Deserialize)]
struct Color {
    r: u8,
    g: u8,
    b: u8,
}

#[derive(serde::Deserialize, Clone)]
struct Position {
    x: f64,
    y: f64,
}

#[derive(serde::Deserialize)]
struct Size {
    width: f64,
    height: f64,
}

struct OverlayWindowConfig {
    position: Position,
}

struct AppState {
    render_windows: Mutex<HashMap<String, OverlayWindowConfig>>,
}

struct WgpuState {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: Mutex<wgpu::SurfaceConfiguration>,
    pipeline: wgpu::RenderPipeline,
}

fn create_render_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    label: String,
    position: Position,
    size: Size,
) -> Result<(), Box<dyn std::error::Error>> {
    let main_window = app.get_window("main").expect("Main window should exist");
    let main_position = main_window.inner_position()?;

    let x = position.x + main_position.x as f64;
    let y = position.y + main_position.y as f64;

    let _window = tauri::window::WindowBuilder::new(&app, &label)
        .inner_size(size.width, size.height)
        .position(x, y)
        .decorations(false)
        .transparent(false)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        .parent(&main_window)
        .and_then(|builder| builder.build())?;

    main_window.set_focus()?;

    let mut render_windows = state.render_windows.lock().unwrap();
    let window_config = OverlayWindowConfig { position };
    render_windows.insert(label, window_config);

    Ok(())
}

#[tauri::command]
fn c_create_render_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    label: String,
    position: Position,
    size: Size,
) -> Result<(), String> {
    create_render_window(app, state, label, position, size).map_err(|e| e.to_string())?;

    Ok(())
}

fn initialize_renderer(
    window: &tauri::Window,
) -> Result<(), Box<dyn std::error::Error + '_>> {
    let size = window.inner_size()?;
    let instance = wgpu::Instance::default();
    let surface = instance.create_surface(window)?;

    // Преобразуем поверхность в 'static с помощью unsafe
    let surface =
        unsafe { std::mem::transmute::<wgpu::Surface<'_>, wgpu::Surface<'static>>(surface) };

    let adapter =
        tauri::async_runtime::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            // Request an adapter which can render to our surface
            compatible_surface: Some(&surface),
        }))
        .expect("Failed to find an appropriate adapter");

    let (device, queue) =
        tauri::async_runtime::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: None,
            required_features: wgpu::Features::empty(),
            // Make sure we use the texture resolution limits from the adapter, so we can support images the size of the swapchain.
            required_limits:
                wgpu::Limits::downlevel_webgl2_defaults().using_resolution(adapter.limits()),
            memory_hints: wgpu::MemoryHints::Performance,
            trace: wgpu::Trace::Off,
        }))
        .expect("Failed to create device");

    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: None,
        source: wgpu::ShaderSource::Wgsl(std::borrow::Cow::Borrowed(
            r#"
          @vertex
          fn vs(
            @builtin(vertex_index) VertexIndex : u32
          ) -> @builtin(position) vec4f {
            var pos = array<vec2f, 3>(              vec2(0.0, 1.0),
              vec2(-1.0, -1.0),
              vec2(1.0, -1.0)

            );

            return vec4f(pos[VertexIndex], 0.0, 1.0);
          }
            
          @fragment
          fn fs() -> @location(0) vec4f {
            return vec4(0.0, 1.0, 0.0, 1.0);
          }
"#,
        )),
    });

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: None,
        bind_group_layouts: &[],
        push_constant_ranges: &[],
    });

    let swapchain_capabilities = surface.get_capabilities(&adapter);
    let swapchain_format = swapchain_capabilities.formats[0];

    let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: None,
        layout: Some(&pipeline_layout),
        vertex: wgpu::VertexState {
            module: &shader,
            entry_point: Some("vs"),
            buffers: &[],
            compilation_options: PipelineCompilationOptions::default(),
        },
        fragment: Some(wgpu::FragmentState {
            module: &shader,
            entry_point: Some("fs"),
            targets: &[Some(swapchain_format.into())],
            compilation_options: PipelineCompilationOptions::default(),
        }),
        primitive: wgpu::PrimitiveState::default(),
        depth_stencil: None,
        multisample: wgpu::MultisampleState::default(),
        multiview: None,
        cache: None,
    });

    let config = wgpu::SurfaceConfiguration {
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
        format: swapchain_format,
        width: size.width,
        height: size.height,
        present_mode: wgpu::PresentMode::Fifo,
        alpha_mode: swapchain_capabilities.alpha_modes[0],
        view_formats: vec![],
        desired_maximum_frame_latency: 2,
    };

    surface.configure(&device, &config);

    let config = Mutex::new(config);

    window.manage(WgpuState {
        surface,
        device,
        queue,
        config,
        pipeline,
    });

    Ok(())
}

fn recalc_surface(window: &tauri::Window) -> Result<(), Box<dyn std::error::Error>> {
    let size = window.inner_size()?;
    let wgpu_state = window.state::<WgpuState>();
    let mut config = wgpu_state.config.lock().unwrap();

    config.width = size.width;
    config.height = size.height;

    wgpu_state.surface.configure(&wgpu_state.device, &config);
    Ok(())
}

fn render_frame(window: &tauri::Window, color: Color) {
    let wgpu = window.state::<WgpuState>();
    let frame = wgpu
        .surface
        .get_current_texture()
        .expect("Failed to acquire next swap chain texture");
    let view = frame
        .texture
        .create_view(&wgpu::TextureViewDescriptor::default());
    let mut encoder = wgpu
        .device
        .create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
    {
        let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: srgb_to_linear(color.r),
                        g: srgb_to_linear(color.g),
                        b: srgb_to_linear(color.b),
                        a: (1.0),
                    }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });
        rpass.set_pipeline(&wgpu.pipeline);
        rpass.draw(0..3, 0..1);
    }

    wgpu.queue.submit(Some(encoder.finish()));
    frame.present();
}

#[tauri::command]
fn c_render_triangle(app: tauri::AppHandle, label: String, color: Color) -> Result<(), String> {
    // render_triangle(app, label, color).map_err(|e| e.to_string())?;
    let render_window = app.get_window(&label).unwrap();
    initialize_renderer(&render_window).map_err(|e| e.to_string())?;

    render_frame(&render_window, color);

    Ok(())
}

fn update_overlay_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    label: String,
    position: Position,
    size: Size,
    color: Color,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_window(&label) {
        let main_window = app.get_window("main").unwrap();
        let mut render_windows = state.render_windows.lock().unwrap();
        let config = OverlayWindowConfig {
            position: position.clone(),
        };
        render_windows.insert(label.clone(), config);

        let inner = main_window.inner_position().unwrap();

        window.set_position(tauri::PhysicalPosition {
                x: (inner.x as f64 + position.x),
                y: (inner.y as f64 + position.y),
            })?;
        window.set_size(tauri::Size::Physical(
            (size.width as u32, size.height as u32).into(),
        ))?;

        // recalc_surface(&window);

        render_frame(&window, color);
    }
    Ok(())
}

#[tauri::command]
fn c_update_overlay_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    label: String,
    position: Position,
    size: Size,
    color: Color,
) -> Result<(), String> {
    update_overlay_window(app, state, label, position, size, color).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            render_windows: Mutex::new(HashMap::new()),
            // wgpu: Mutex::new(HashMap::new()),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            let main_window = app.get_window("main").unwrap();

            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::Moved(_) = event {
                    let main_window = app_handle.get_window("main").unwrap();
                    let state = app_handle.state::<AppState>();
                    let render_windows = state.render_windows.lock().unwrap();

                    let inner = main_window.inner_position().unwrap();

                    for (label, config) in render_windows.iter() {
                        if let Some(window) = app_handle.get_window(label) {
                            let new_pos = tauri::PhysicalPosition {
                                x: (inner.x as f64 + config.position.x),
                                y: (inner.y as f64 + config.position.y),
                            };

                            let _ = window.set_position(new_pos);
                        }
                    }
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            c_create_render_window,
            c_render_triangle,
            c_update_overlay_window
        ])
        // .on_window_event(handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
