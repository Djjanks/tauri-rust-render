import { invoke } from "@tauri-apps/api/core";
import { initWebGpu } from "./webgpu";

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
const canvas = document.querySelector("#webgpu") as HTMLCanvasElement;

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

const wgpu1Div = document.getElementById("wgpu1")!;
const rect = wgpu1Div.getBoundingClientRect();
const divBackgroundColor = window.getComputedStyle(wgpu1Div).backgroundColor;
const [r, g, b] = divBackgroundColor.match(/\d+/g)?.map(Number) ?? [0, 0, 0];

await invoke("c_create_render_window", {
  label: "wgpu1",
  position: { x: rect.left, y: rect.top },
  size: { width: rect.width, height: rect.height }
});

await invoke("c_render_triangle", {
  label: "wgpu1",
  color: { r, g, b }
});

type ResizeStartCallback = () => void;
type ResizeEndCallback = () => void;

class ResizeObserverWithStartEnd {
  private observer: ResizeObserver;
  private resizeTimer: number | null = null;
  private isResizing: boolean = false;
  private readonly delay: number;

  constructor(
    onResizeStart: ResizeStartCallback,
    onResizeEnd: ResizeEndCallback,
    delay: number = 200
  ) {
    this.delay = delay;

    this.observer = new ResizeObserver((entries) => {
      if (!this.isResizing) {
        this.isResizing = true;
        onResizeStart();
      }

      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }

      this.resizeTimer = window.setTimeout(() => {
        this.isResizing = false;

        for (const entry of entries) {
          const rect = entry.target.getBoundingClientRect();

          invoke("c_update_overlay_window", {
            label: "wgpu1",
            position: { x: rect.x, y: rect.y },
            size: { width: rect.width, height: rect.height },
            color: { r, g, b }
          });
        }

        onResizeEnd();
      }, this.delay);
    });
  }

  observe(target: Element): void {
    this.observer.observe(target);
  }

  unobserve(target: Element): void {
    this.observer.unobserve(target);
  }

  disconnect(): void {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    this.observer.disconnect();
  }
}

const resizeTracker = new ResizeObserverWithStartEnd(
  () => console.log("Resize started!"),
  () => console.log("Resize ended!")
);

if (wgpu1Div) {
  resizeTracker.observe(wgpu1Div);
}
