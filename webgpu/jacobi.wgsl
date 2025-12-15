@group(0) @binding(0) var prev : texture_2d<f32>;         // p^{n-1}
@group(0) @binding(1) var div  : texture_2d<f32>;
@group(0) @binding(2) var next : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let size = textureDimensions(prev);
  if (gid.x >= size.x || gid.y >= size.y) { return; }

  let L = textureLoad(prev, vec2<i32>(max(1, i32(gid.x)-1), i32(gid.y)), 0).x;
  let R = textureLoad(prev, vec2<i32>(min(i32(size.x-1), i32(gid.x)+1), i32(gid.y)), 0).x;
  let B = textureLoad(prev, vec2<i32>(i32(gid.x), max(1, i32(gid.y)-1)), 0).x;
  let T = textureLoad(prev, vec2<i32>(i32(gid.x), min(i32(size.y-1), i32(gid.y)+1)), 0).x;
  let divVal = textureLoad(div, gid.xy, 0).x;

  let p = (L + R + B + T - divVal) * 0.25;
  textureStore(next, gid.xy, vec4<f32>(p, 0.0, 0.0, 0.0));
}
