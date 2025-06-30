const canvas = document.getElementById('gpu');
if (!navigator.gpu) { console.warn('WebGPU unavailable'); canvas.remove(); }

const adapter = await navigator.gpu.requestAdapter();
const device  = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format  = navigator.gpu.getPreferredCanvasFormat();      // :contentReference[oaicite:1]{index=1}
context.configure({device, format, alphaMode:'premultiplied'});

let simSize = [256, 256];
function tex(fmt) {
    return device.createTexture({
        size: simSize, format: fmt,
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    });
}

function initDye(texture){
    const w = 256, h = 256, bytes = new Uint8Array(w*h*4);
    for(let y=0; y<h; ++y){
        for(let x=0; x<w; ++x){
            const i = (y*w + x)*4;
            // 白銀ノイズ：明度 200‒255, 彩度ほぼ 0
            const g = 200 + Math.floor(Math.random()*55);
            bytes.set([g,g,g,255], i);
        }
    }
    device.queue.writeTexture(
        {texture}, bytes, {bytesPerRow:w*4}, {width:w, height:h});
}

const dyeTexA = tex('rgba8unorm');
const dyeTexB = tex('rgba8unorm');
initDye(dyeTexA);                // 1 回だけで OK
initDye(dyeTexB);                // Pong も同じトーン


function initVelocity(tex){
    const w = simSize[0], h = simSize[1];
    const buf = new Float32Array(w*h*2);
    for(let y=0; y<h; ++y){
        for(let x=0; x<w; ++x){
            const i = (y*w + x)*2;
            // 単純な一定右向き + ちょっと揺らぎ
            buf[i  ] =  0.6 + (Math.random()-0.5)*0.1; // vx
            buf[i+1] = -0.1 + (Math.random()-0.5)*0.1; // vy
        }
    }
    device.queue.writeTexture(
        {texture: tex},
        buf,
        {bytesPerRow: w*8},                // 2 comps × 4byte
        {width:w, height:h});
}
const velocityTex = tex('rg32float');
initVelocity(velocityTex);

const advectWGSL = await (await fetch('advection.wgsl')).text();  // 例
const advectModule = device.createShaderModule({ code: advectWGSL });
const advectPipeline = device.createComputePipeline({
    layout: 'auto',               // or device.createPipelineLayout({bindGroupLayouts:[...]})
    compute: {
        module: advectModule,
        entryPoint: 'main'          // WGSL 内の @compute 関数名
    }
});
function advectBG(src, dst){
    return device.createBindGroup({
        layout: advectPipeline.getBindGroupLayout(0),
        entries:[
            {binding:0, resource: src.createView()},  // src
            {binding:1, resource: velocityTex.createView()}, // vel
            {binding:2, resource: dst.createView()}   // dst
        ]
    });
}
let ping = dyeTexA, pong = dyeTexB;

// ---- render pipeline (silver) ----
const blitPipe = device.createRenderPipeline({
    layout:'auto',
    vertex:{module: device.createShaderModule({code: await fetch('blit_silver.wgsl').then(r=>r.text())}),
        entryPoint:'vs'},
    fragment:{module: device.createShaderModule({code: await fetch('blit_silver.wgsl').then(r=>r.text())}),
        entryPoint:'fs',
        targets:[{format: format}]}
});
const blitSampler = device.createSampler({magFilter:'linear',minFilter:'linear'});

const debugModule = device.createShaderModule({
    code: await fetch('debug_fill.wgsl').then(r => r.text())
});



const debugPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: debugModule, entryPoint: 'main' }
});

function debugBG(dstTex) {
    return device.createBindGroup({
        layout: debugPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: dstTex.createView() },   // dummy
            { binding: 1, resource: velocityTex.createView() }, // dummy
            { binding: 2, resource: dstTex.createView() }    // ★ dst = dye ping/pong
        ]
    });
}



function step(){
    const encoder = device.createCommandEncoder();


    function injectSmoke(tex){
        const w = 5, h = simSize[1];
        const buf = new Uint8Array(w*h*4);
        for(let i=0;i<w*h;++i){
            const g = 200+Math.random()*55;
            buf.set([g,g,g,255], i*4);
        }
        device.queue.writeTexture(
            {texture: tex, origin:{x:0,y:0,z:0}},
            buf,{bytesPerRow:w*4},
            {width:w,height:h});
    }
    // requestAnimationFrame 内の冒頭
    injectSmoke(ping);

    // 1) Advection
    {
        const pass = encoder.beginComputePass();
        pass.setPipeline(advectPipeline);
        pass.setBindGroup(0, advectBG(ping, pong));
        pass.dispatchWorkgroups(simSize[0]/8, simSize[1]/8);
        pass.end();
        [ping, pong] = [pong, ping];           // swap
    }

    // 2) Silver-blit
    {
        const view = context.getCurrentTexture().createView();
        const render = encoder.beginRenderPass({
            colorAttachments:[{
                view, loadOp:'clear', storeOp:'store',
                clearValue:{r:0,g:0,b:0,a:1}
            }]
        });
        render.setPipeline(blitPipe);
        render.setBindGroup(0, device.createBindGroup({
            layout: blitPipe.getBindGroupLayout(0),
            entries:[
                {binding:0, resource: blitSampler},
                {binding:1, resource: ping.createView()}
            ]
        }));
        render.draw(3);
        render.end();
    }

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(step);
}
step();
