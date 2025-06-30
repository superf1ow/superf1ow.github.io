// blit_silver.wgsl
@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var tex  : texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) i:u32)->@builtin(position)vec4<f32>{
  var pos = array<vec2<f32>,3>(vec2(-1,-1), vec2(3,-1), vec2(-1,3));
  return vec4<f32>(pos[i],0,1);
}

fn luminance(c:vec3<f32>) -> f32 {          // NTSC luma
  return dot(c, vec3<f32>(0.299,0.587,0.114));
}

@fragment
fn fs(@builtin(position) pos:vec4<f32>) -> @location(0) vec4<f32>{
  let uv   = pos.xy / vec2<f32>(1980,1080);
  let col  = textureSample(tex,samp,uv).rgb;

  // ---- グレイスケール化して銀色トーンに ----
  let lum  = luminance(col);                    // 0‒1
  let silver = mix(vec3<f32>(0.75), vec3<f32>(0.9), lum); // 少し輝度差
  return vec4<f32>(silver, 1.0);
}
