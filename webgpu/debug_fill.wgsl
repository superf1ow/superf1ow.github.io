@group(0) @binding(2) var dst : texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if (gid.x == 0u && gid.y == 0u) {
     textureStore(dst, vec2<i32>(0,0), vec4<f32>(1,0,0,1)); // 左上1pxを赤
  }
}