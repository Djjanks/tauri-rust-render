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

class ResizeObserverWithStartEnd {
  private observer: ResizeObserver;
  private resizeTimer: number | null = null;
  private isResizing: boolean = false;
  private readonly delay: number;
  private loaderElement: HTMLElement | null = null;

  constructor(
    delay: number = 200
  ) {
    this.delay = delay;

    // Создаем элемент лоадера
    this.loaderElement = document.createElement('div');
    this.loaderElement.style.position = 'absolute';
    this.loaderElement.style.top = '0';
    this.loaderElement.style.left = '0';
    this.loaderElement.style.width = '100%';
    this.loaderElement.style.height = '100%';
    this.loaderElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.loaderElement.style.display = 'none';
    this.loaderElement.style.justifyContent = 'center';
    this.loaderElement.style.alignItems = 'center';
    this.loaderElement.style.zIndex = '1000';
this.loaderElement.innerHTML = `
  <div class="spinner"></div>
  <style>
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top: 4px solid #fff;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
`;

    this.observer = new ResizeObserver(async (entries) => {
      if (!this.isResizing) {
        this.isResizing = true;
          await invoke("c_hide_window", {
            label: "wgpu1",
          });
        for (const entry of entries) {
          // add loader
          entry.target.appendChild(this.loaderElement!);
          this.loaderElement!.style.display = 'flex';
        }
      }

      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }

      this.resizeTimer = window.setTimeout(async () => {
        this.isResizing = false;

        for (const entry of entries) {
          const rect = entry.target.getBoundingClientRect();

          await invoke("c_update_overlay_window", {
            label: "wgpu1",
            position: { x: rect.x, y: rect.y },
            size: { width: rect.width, height: rect.height },
            color: { r, g, b }
          });

          // hide loader
          if (this.loaderElement) {
            this.loaderElement.style.display = 'none';
          }
        }

      }, this.delay);
    });
  }

  observe(target: Element): void {
    this.observer.observe(target);
  }

  unobserve(target: Element): void {
    this.observer.unobserve(target);
    if (this.loaderElement && target.contains(this.loaderElement)) {
      target.removeChild(this.loaderElement);
    }
  }

  disconnect(): void {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    if (this.loaderElement && this.loaderElement.parentElement) {
      this.loaderElement.parentElement.removeChild(this.loaderElement);
    }
    this.observer.disconnect();
  }
}

const resizeTracker = new ResizeObserverWithStartEnd();

if (wgpu1Div) {
  resizeTracker.observe(wgpu1Div);
}