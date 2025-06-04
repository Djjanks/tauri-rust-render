use tauri::Manager;
use wgpu::PipelineCompilationOptions;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn srgb_to_linear(c: i32) -> f64 {
    let c = c as f64 / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn create_overlay_window(
    app: tauri::AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    r: i32,
    g: i32,
    b: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    let main_window = app.get_window("main").expect("Main window should exist");
    let main_position = main_window.inner_position()?;

    let x = x + main_position.x as f64;
    let y = y + main_position.y as f64;

    let window = tauri::window::WindowBuilder::new(&app, label)
        .inner_size(width, height)
        .position(x, y)
        .decorations(false)
        .transparent(false)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        .parent(&main_window)
        .and_then(|builder| builder.build())?;

    main_window.set_focus()?;

    let size = window.inner_size()?;
    let instance = wgpu::Instance::default();
    let surface = instance.create_surface(window)?;

    let adapter =
        tauri::async_runtime::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            // Request an adapter which can render to our surface
            compatible_surface: Some(&surface),
        }))
        .expect("Failed to find an appropriate adapter");

    // Create the logical device and command queue
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

    let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
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

    let frame = surface
        .get_current_texture()
        .expect("Failed to acquire next swap chain texture");
    let view = frame
        .texture
        .create_view(&wgpu::TextureViewDescriptor::default());
    let mut encoder =
        device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
    {
        let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: srgb_to_linear(r),
                        g: srgb_to_linear(g),
                        b: srgb_to_linear(b),
                        a: (1.0),
                    }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });
        rpass.set_pipeline(&render_pipeline);
        rpass.draw(0..3, 0..1);
    }

    queue.submit(Some(encoder.finish()));
    frame.present();

    Ok(())
}

fn update_or_create_overlay_window(
    app: tauri::AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    r: i32,
    g: i32,
    b: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_window(&label) {
        window.set_position(tauri::Position::Physical((x as i32, y as i32).into()))?;
        window.set_size(tauri::Size::Physical((width as u32, height as u32).into()))?;
        // Надо тут надо дернуть рендер функцию
        // return Ok(());
    }

    create_overlay_window(app, label, x, y, width, height, r, g, b)
}

#[tauri::command]
fn command_create_overlay_window(
    app: tauri::AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    r: i32,
    g: i32,
    b: i32,
) -> Result<(), String> {
    update_or_create_overlay_window(app, label, x, y, width, height, r, g, b).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // .manage(state)
        // .setup(|app| {
        //     let main_window = app.get_window("main")?;
            
        // })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            command_create_overlay_window
        ])
        // .on_window_event(handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
