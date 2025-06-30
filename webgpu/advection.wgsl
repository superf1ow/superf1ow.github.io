@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var vel : texture_2d<f32>;
@group(0) @binding(2) var dst : texture_storage_2d<rgba8unorm, write>; // ← ここ変更

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let size = textureDimensions(src);
    if (gid.x >= size.x || gid.y >= size.y) { return; }

    let uv   = (vec2<f32>(gid.xy) + 0.5) / vec2<f32>(size);
    let v    = textureLoad(vel,   gid.xy, 0).xy;
    let dt   = 1.0 / 60.0;                       // Δt
    let back = uv - v * dt;                      // 逆方向へ１ステップ
    let samplePos = vec2<i32>(back * vec2<f32>(size));
    let col  = textureLoad(src, samplePos, 0);
    textureStore(dst, gid.xy, col);
}
