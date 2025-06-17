import { invoke } from "@tauri-apps/api/core";
import { initWebGpu } from "./webgpu";
import { throttle } from "lodash";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

async function greet() {
  if (greetMsgEl && greetInputEl) {
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });
});

const divWebgpu = document.getElementById("div-webgpu");
const canvas = document.querySelector("#canvas-webgpu") as HTMLCanvasElement;

initWebGpu(canvas);

const resizeWebGpuObserver = new ResizeObserver((entries) => {
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

resizeWebGpuObserver.observe(divWebgpu!);

const wgpu1Div = document.getElementById("canvas-wgpu1")!;
const rect = wgpu1Div.getBoundingClientRect();
const divBackgroundColor = window.getComputedStyle(wgpu1Div).backgroundColor;
const [r, g, b] = divBackgroundColor.match(/\d+/g)?.map(Number) ?? [0, 0, 0];

// await invoke("command_create_overlay_window", {
//   label: "wgpu1",
//   position: {x: rect.left, y: rect.top},
//   size: {width: rect.width, height: rect.height},
//   color: {r, g, b}
// });

await invoke("c_create_render_window", {
  label: "wgpu1",
  position: { x: rect.left, y: rect.top },
  size: { width: rect.width, height: rect.height }
});

await invoke("c_render_triangle", {
  label: "wgpu1",
  color: { r, g, b }
});

// const sendDivSize = throttle(async (label, position, size, color) => {
//   await invoke("c_update_overlay_window", {
//     label,
//     position,
//     size,
//     color
//   });
// }, 100); // Задержка 100 мс

const resizeWgpuObserver = new ResizeObserver((entries) => {
  
  
  for (const entry of entries) {
    const rect = entry.target.getBoundingClientRect();
        const contentBoxSize = Array.isArray(entry.contentBoxSize)
      ? entry.contentBoxSize[0]
      : entry.contentBoxSize;
    console.log({rect, contentBoxSize});
    

    invoke("c_update_overlay_window", {
      label: "wgpu1",
      position: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height },
      color: { r, g, b }
  });

    // sendDivSize(
    //   "wgpu1",
    //   { x: rect.left, y: rect.top },
    //   { width: rect.width, height: rect.height },
    //   { r, g, b }
    // );
  }
});

resizeWgpuObserver.observe(wgpu1Div);


