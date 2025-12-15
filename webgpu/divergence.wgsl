@group(0) @binding(0) var vel : texture_2d<f32>;
@group(0) @binding(1) var div : texture_storage_2d<r32float, write>;

const h : f32 = 1.0;      // セル間隔

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let size = textureDimensions(vel);
  if (gid.x >= size.x || gid.y >= size.y) { return; }

  let L = textureLoad(vel, vec2<i32>(max(1, i32(gid.x)-1), i32(gid.y)), 0).x;
  let R = textureLoad(vel, vec2<i32>(min(i32(size.x-1), i32(gid.x)+1), i32(gid.y)), 0).x;
  let B = textureLoad(vel, vec2<i32>(i32(gid.x), max(1, i32(gid.y)-1)), 0).y;
  let T = textureLoad(vel, vec2<i32>(i32(gid.x), min(i32(size.y-1), i32(gid.y)+1)), 0).y;

  let d = 0.5 * ((R - L) + (T - B)) / h;
  textureStore(div, gid.xy, vec4<f32>(d, 0.0, 0.0, 0.0));
}
