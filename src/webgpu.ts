export async function initWebGpu(canvas: HTMLCanvasElement) {
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
      powerPreference: "high-performance"
    });

    if (!adapter) {
      throw new Error("No GPU adapter found");
    }

    const device = await adapter?.requestDevice();
    const context = canvas.getContext("webgpu") as GPUCanvasContext;
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
          `
    });

    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule
      },
      fragment: {
        module: shaderModule,
        targets: [
          {
            format: presentationFormat
          }
        ]
      },
      primitive: {
        topology: "triangle-list"
      }
    });

    function render() {
      if (!device) return;

      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view: textureView,
            loadOp: "clear",
            storeOp: "store"
          }
        ]
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.draw(3);
      passEncoder.end();

      device.queue.submit([commandEncoder.finish()]);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  } catch (error) {
    console.error("Error initializing WebGPU:", error);
  }
}
