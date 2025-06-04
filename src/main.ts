import { invoke } from "@tauri-apps/api/core";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

const canvas = document.querySelector('#canvas-webgpu') as HTMLCanvasElement;

async function greet() {
  if (greetMsgEl && greetInputEl) {
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value,
    });
  }
}

async function init() {
  window.addEventListener("DOMContentLoaded", () => {
    greetInputEl = document.querySelector("#greet-input");
    greetMsgEl = document.querySelector("#greet-msg");
    document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      greet();
    });
  });

  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }

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
    
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    
    context.configure({
      device,
      format: presentationFormat,
      alphaMode: "premultiplied"
    });

  const shaderModule = device.createShaderModule({
        code: `
          @vertex
          fn vs(
            @builtin(vertex_index) VertexIndex : u32
          ) -> @builtin(position) vec4f {
            var pos = array<vec2f, 3>(
              vec2(0.0, 1.0),
              vec2(-1.0, -1.0),
              vec2(1.0, -1.0)
            );

            return vec4f(pos[VertexIndex], 0.0, 1.0);
          }
            
          @fragment
          fn fs() -> @location(0) vec4f {
            return vec4(1.0, 0.0, 0.0, 1.0);
          }
          `,
      });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule
    },
    fragment: {
      module: shaderModule,
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

  requestAnimationFrame(render);

  } catch(error) {
    console.error("Error initializing WebGPU:", error);
  }

}

init();


const divWebgpu = document.getElementById("div-webgpu");

const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const contentBoxSize = Array.isArray(entry.contentBoxSize)
      ? entry.contentBoxSize[0]
      : entry.contentBoxSize;

    const width = contentBoxSize.inlineSize;
    const height = contentBoxSize.blockSize;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
});

observer.observe(divWebgpu!);




const wgpu1Div = document.getElementById("canvas-wgpu1")!;
const rect = wgpu1Div.getBoundingClientRect();
const divBackgroundColor = window.getComputedStyle(wgpu1Div).backgroundColor;
const [r, g, b] = divBackgroundColor.match(/\d+/g)?.map(Number) ?? [0, 0, 0];

console.log(window.getComputedStyle(wgpu1Div).backgroundColor);


await invoke("command_create_overlay_window", {
  label: "wgpu1",
  x: rect.left,
  y: rect.top,
  width: rect.width,
  height: rect.height,
  r, g, b
});

// import { getCurrentWindow } from "@tauri-apps/api/window";

// const overlayLabel = "wgpu1";
// const targetElement = document.getElementById("div-webgpu1");

// function updateOverlayBounds() {
//   if (!targetElement) return;

//   const rect = targetElement.getBoundingClientRect();
//   const bg = getComputedStyle(targetElement).backgroundColor;
//   const [r, g, b] = bg.match(/\d+/g)?.map(Number) ?? [0, 0, 0];

//   getCurrentWindow().innerPosition().then((mainPos) => {
//     invoke("command_create_overlay_window", {
//       label: overlayLabel,
//       x: rect.x,
//       y: rect.y,
//       width: rect.width,
//       height: rect.height,
//       r,
//       g,
//       b,
//     });
//   });
// }


// const resizeObserver = new ResizeObserver(updateOverlayBounds);
// if (targetElement) resizeObserver.observe(targetElement);

// getCurrentWindow().onMoved(updateOverlayBounds);