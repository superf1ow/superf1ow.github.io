// Flow background ---------------------------
const canvas = document.getElementById('gpu');
if (!navigator.gpu) { console.warn('WebGPU unavailable'); canvas.remove(); }

const adapter = await navigator.gpu.requestAdapter();
const device  = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format  = navigator.gpu.getPreferredCanvasFormat();      // :contentReference[oaicite:1]{index=1}
context.configure({device, format, alphaMode:'premultiplied'});

// フルスクリーン三角形 1 枚で描画（Quad より 1 頂点少なく高速）  :contentReference[oaicite:2]{index=2}
const vertex = /* wgsl */`
  @vertex fn main(@builtin(vertex_index) vIdx:u32)
  -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>,3>(
      vec2(-1.0,-1.0), vec2( 3.0,-1.0), vec2(-1.0, 3.0));
    return vec4<f32>(pos[vIdx], 0.0, 1.0);
  }`;

const fragment = /* wgsl */`
  struct Uniforms { time:f32, }
  @group(0) @binding(0) var<uniform> u:Uniforms;

  fn hash(p:vec2<f32>) -> f32{
    let h = dot(p, vec2<f32>(127.1,311.7));
    return fract(sin(h)*43758.5453);
  }

  fn noise(p:vec2<f32>) -> f32{
    let i = floor(p);
    let f = fract(p);
    let a = hash(i);
    let b = hash(i+vec2(1.0,0.0));
    let c = hash(i+vec2(0.0,1.0));
    let d = hash(i+vec2(1.0,1.0));
    let u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) +
           (c - a)*u.y*(1.0-u.x) +
           (d - b)*u.x*u.y;
  }

  @fragment fn main(@builtin(position) pos:vec4<f32>)
  -> @location(0) vec4<f32>{
    let uv = pos.xy / vec2<f32>(1920, 1080);
    let n  = noise((uv) * 4.0 + u.time*0.5);
    let c  = 0.5 + 0.5 * cos(6.283*(n + vec3<f32>(0.0,0.33,0.67)));
    return vec4<f32>(c,1.0);
  }`;

const pipeline = device.createRenderPipeline({
    layout:'auto',
    vertex:{module:device.createShaderModule({code:vertex}), entryPoint:'main'},
    fragment:{
        module:device.createShaderModule({code:fragment}),
        entryPoint:'main',
        targets:[{format}]
    },
    primitive:{topology:'triangle-list'}
});

// Uniform buffer for time
const uniformBuffer = device.createBuffer({
    size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
const bindGroup = device.createBindGroup({
    layout:pipeline.getBindGroupLayout(0),
    entries:[{binding:0, resource:{buffer:uniformBuffer}}]});

function frame(ms){
    const time = ms/1000;
    device.queue.writeBuffer(uniformBuffer,0,new Float32Array([time]));
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments:[{
            view: context.getCurrentTexture().createView(),
            loadOp:'clear', storeOp:'store', clearValue:{r:0,g:0,b:0,a:1}
        }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3,1,0,0); // full-screen triangle
    pass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// リサイズ対応
const resize = ()=>{canvas.width=innerWidth*devicePixelRatio;
    canvas.height=innerHeight*devicePixelRatio;};
addEventListener('resize',resize); resize();
