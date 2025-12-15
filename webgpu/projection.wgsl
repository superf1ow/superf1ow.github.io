// projection.wgsl
// 端的に言うと「速度テクスチャから圧力勾配を引く」だけ。
// - velocity_in  : u(x,y)  （rg32float 推奨）
// - pressure     : p(x,y)  （r32float）
// - velocity_out : 発散ゼロにした u'
//   ※ velocity_in へ上書きするなら storage → readonly に変更し Ping–Pong 無しでも可

@group(0) @binding(0) var velocity_in  : texture_2d<f32>;
@group(0) @binding(1) var pressure     : texture_2d<f32>;
@group(0) @binding(2) var velocity_out : texture_storage_2d<rg32float, write>;

const h : f32 = 1.0;                    // グリッド間隔（セルサイズ）

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let size = textureDimensions(velocity_in);
    if (gid.x >= size.x || gid.y >= size.y) { return; }

    let x = i32(gid.x);
    let y = i32(gid.y);

    // ---- 1. 速度を取得 ---------------------------------
    let u = textureLoad(velocity_in, vec2<i32>(x, y), 0).xy;

    // ---- 2. 圧力勾配 ∇p を中心差分で求める --------------
    let pL = textureLoad(pressure, vec2<i32>(max(0, x - 1), y), 0).x;
    let pR = textureLoad(pressure, vec2<i32>(min(x + 1, i32(size.x - 1)), y), 0).x;
    let pB = textureLoad(pressure, vec2<i32>(x, max(0, y - 1)), 0).x;
    let pT = textureLoad(pressure, vec2<i32>(x, min(y + 1, i32(size.y - 1))), 0).x;

    let gradP = vec2<f32>((pR - pL), (pT - pB)) * (0.5 / h);

    // ---- 3. 勾配を引いて発散ゼロに -----------------------
    let u_proj = u - gradP;

    // ---- 4. 書き戻し ------------------------------------
    textureStore(velocity_out, vec2<i32>(x, y),
                 vec4<f32>(u_proj, 0.0, 0.0));
}
