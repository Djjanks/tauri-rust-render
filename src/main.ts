import { invoke } from "@tauri-apps/api/core";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

async function greet() {
  if (greetMsgEl && greetInputEl) {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value,
    });
  }
}

// Основная функция инициализации
async function init() {
  // Инициализация UI элементов
  window.addEventListener("DOMContentLoaded", () => {
    greetInputEl = document.querySelector("#greet-input");
    greetMsgEl = document.querySelector("#greet-msg");
    document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      greet();
    });
  });

  // Инициализация WebGPU
  const canvas = document.querySelector('#canvas-webgpu') as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }

  // Проверка поддержки WebGPU
  if (!navigator.gpu) {
    console.error("WebGPU not supported!");
    return;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    
    if (!adapter) {
      throw new Error("No GPU adapter found");
    }

    const device = await adapter?.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Установка размеров canvas
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    
    context.configure({
      device,
      format: presentationFormat,
      alphaMode: "premultiplied"
    });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: `
          @vertex
          fn main(
            @builtin(vertex_index) VertexIndex : u32
          ) -> @builtin(position) vec4f {
            var pos = array<vec2f, 3>(
              vec2(0.0, 0.5),
              vec2(-0.5, -0.5),
              vec2(0.5, -0.5)
            );

            return vec4f(pos[VertexIndex], 0.0, 1.0);
          }`,
      }),
    },
    fragment: {
      module: device.createShaderModule({
        code: `
          @fragment
          fn main() -> @location(0) vec4f {
            return vec4(1.0, 0.0, 0.0, 1.0);
          }`,
      }),
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  // Функция рендеринга кадра
  function render() {
    if (!device) return;

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.draw(3);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(render);
  }

  // Запуск цикла рендеринга
  requestAnimationFrame(render);

  } catch(error) {
    console.error("Error initializing WebGPU:", error);
  }

}

// Запуск приложения
init();