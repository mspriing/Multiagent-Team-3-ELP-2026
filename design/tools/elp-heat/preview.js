
export default function Effect() {}

export function setup(device, frame) {
  var wgsl = `diagnostic(off,derivative_uniformity);
struct U {
  a: vec4f, // width, height, time (s), heat
  b: vec4f, // speed, style, steps, cool strength
  c: vec4f, // hot x, hot y, cool x, cool y (0..1, y from top)
  d: vec4f, // second hot x, second hot y (0..1, y from top), flute density, calm
  e: vec4f, // refraction, grain, -, -
};
@group(0) @binding(0) var<uniform> u: U;

struct VsIn { @location(0) pos: vec2f, @location(1) uv: vec2f };
struct VsOut { @builtin(position) position: vec4f, @location(0) uv: vec2f };

@vertex fn vs_main(i: VsIn) -> VsOut {
  var o: VsOut;
  o.position = vec4f(i.pos, 0.0, 1.0);
  o.uv = i.uv;
  return o;
}

fn h21(q: vec2f) -> f32 {
  var p = fract(q * vec2f(123.34, 456.21));
  p = p + dot(p, p + 45.32);
  return fract(p.x * p.y);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), f.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), f.x), f.y);
}
fn fbm(q: vec2f) -> f32 {
  var v = 0.0;
  var amp = 0.5;
  var p = q;
  for (var k = 0; k < 5; k = k + 1) {
    v = v + amp * vnoise(p);
    p = p * 2.03 + vec2f(1.7, 9.2);
    amp = amp * 0.5;
  }
  return v;
}
fn fbm3(q: vec2f) -> f32 {
  var v = 0.0;
  var amp = 0.5;
  var p = q;
  for (var k = 0; k < 3; k = k + 1) {
    v = v + amp * vnoise(p);
    p = p * 2.03 + vec2f(1.7, 9.2);
    amp = amp * 0.5;
  }
  return v / 0.875;
}
fn ramp(xin: f32) -> vec3f {
  let x = clamp(xin, 0.0, 1.0);
  let c0 = vec3f(0.122, 0.125, 0.161);
  let c1 = vec3f(0.204, 0.212, 0.271);
  let c2 = vec3f(0.122, 0.306, 0.451);
  let c3 = vec3f(0.384, 0.753, 0.965);
  let c4 = vec3f(0.698, 0.965, 0.004);
  let c5 = vec3f(0.902, 1.0, 0.651);
  let c6 = vec3f(0.988, 1.0, 1.0);
  if (x < 0.22) { return mix(c0, c1, x / 0.22); }
  if (x < 0.40) { return mix(c1, c2, (x - 0.22) / 0.18); }
  if (x < 0.58) { return mix(c2, c3, (x - 0.40) / 0.18); }
  if (x < 0.74) { return mix(c3, c4, (x - 0.58) / 0.16); }
  if (x < 0.88) { return mix(c4, c5, (x - 0.74) / 0.14); }
  return mix(c5, c6, (x - 0.88) / 0.12);
}

// OKLab blending, so the Fluted smooth style blends the way "effect background · test" does
fn toLab(cin: vec3f) -> vec3f {
  let c = pow(cin, vec3f(2.2));
  var l = vec3f(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,
                0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,
                0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  l = pow(max(l, vec3f(0.0)), vec3f(1.0 / 3.0));
  return vec3f(0.2104542553 * l.x + 0.7936177850 * l.y - 0.0040720468 * l.z,
               1.9779984951 * l.x - 2.4285922050 * l.y + 0.4505937099 * l.z,
               0.0259040371 * l.x + 0.7827717662 * l.y - 0.8086757660 * l.z);
}
fn fromLab(c: vec3f) -> vec3f {
  var l = vec3f(c.x + 0.3963377774 * c.y + 0.2158037573 * c.z,
                c.x - 0.1055613458 * c.y - 0.0638541728 * c.z,
                c.x - 0.0894841775 * c.y - 1.2914855480 * c.z);
  l = l * l * l;
  let r = vec3f(4.0767416621 * l.x - 3.3077115913 * l.y + 0.2309699292 * l.z,
                -1.2684380046 * l.x + 2.6097574011 * l.y - 0.3413193965 * l.z,
                -0.0041960863 * l.x - 0.7034186147 * l.y + 1.7076147010 * l.z);
  return pow(max(r, vec3f(0.0)), vec3f(1.0 / 2.2));
}
fn rampLab(xin: f32) -> vec3f {
  let x = clamp(xin, 0.0, 1.0);
  let c0 = vec3f(0.122, 0.125, 0.161);
  let c1 = vec3f(0.204, 0.212, 0.271);
  let c2 = vec3f(0.122, 0.306, 0.451);
  let c3 = vec3f(0.384, 0.753, 0.965);
  let c4 = vec3f(0.698, 0.965, 0.004);
  let c5 = vec3f(0.902, 1.0, 0.651);
  var a = c4; var b = c5; var k = (x - 0.83) / 0.17;
  if (x < 0.2) { a = c0; b = c1; k = x / 0.2; }
  else if (x < 0.42) { a = c1; b = c2; k = (x - 0.2) / 0.22; }
  else if (x < 0.64) { a = c2; b = c3; k = (x - 0.42) / 0.22; }
  else if (x < 0.83) { a = c3; b = c4; k = (x - 0.64) / 0.19; }
  k = k * k * (3.0 - 2.0 * k);
  return mix(toLab(a), toLab(b), k);
}
// Averaged over a wide window so the light blue melts into the deep blue and the chartreuse into the green
fn rampL(x: f32) -> vec3f {
  let s = rampLab(x - 0.08) + rampLab(x - 0.04) + rampLab(x) + rampLab(x + 0.04) + rampLab(x + 0.08);
  return fromLab(s / 5.0);
}

// Two big heat areas, warped smoothly and read in soft bands. Measured in pixels so any frame size keeps one proportion.
fn lobe(w: vec2f, c: vec2f, r: f32, L: f32, R: vec2f) -> f32 {
  let d = (w - c * R) / (L * r);
  return exp(-dot(d, d));
}
fn smoothField(ub: vec2f, R: vec2f, t: f32) -> f32 {
  let L = 0.26 * (R.x + R.y) * 0.5;
  let px = ub * R;
  let p = px / L;
  let q = vec2f(fbm3(p * 0.45 + vec2f(0.0, t * 0.07)), fbm3(p * 0.45 + vec2f(5.2, 1.3) - t * 0.06));
  let w = px + (q - 0.5) * L * 2.2;
  let h1 = vec2f(u.c.x, 1.0 - u.c.y);
  let h2 = vec2f(u.d.x, 1.0 - u.d.y);
  let g = u.a.w * (1.25 * lobe(w, h1, 2.5, L, R) + 1.05 * lobe(w, h2, 2.1, L, R));
  var h = 0.16 + g * 0.9 + (fbm3(p * 0.7 + q * 1.3 + vec2f(t * 0.03, 0.0)) - 0.5) * 0.16;
  let cool = vec2f(u.c.z, 1.0 - u.c.w);
  let cz = (ub - cool) / vec2f(0.46, 0.26);
  h = h - u.b.w * exp(-dot(cz, cz));
  h = clamp(h, 0.0, mix(0.86, 0.5, u.d.w));
  let x = h * 7.0;
  let st = (floor(x) + smoothstep(0.1, 0.9, fract(x))) / 7.0;
  return mix(h, st, 0.12);
}
fn ridgeAt(local: f32) -> f32 {
  let rd = (local + 0.365) * 36.0;
  return exp(-rd * rd);
}
// His glass from "effect background · test": fine flutes that refract the field, a dark edge and a thin white rib
fn fluted(ub: vec2f, R: vec2f, t: f32) -> vec3f {
  let ar = R.x / max(R.y, 1.0);
  let dn = max(u.d.z, 1.0);
  let p0 = (ub - 0.5) * vec2f(ar, 1.0);
  let x = p0.x * dn;
  let local = fract(x) - 0.5;
  let nl = normalize(vec3f(local * 2.0, 0.0, sqrt(max(0.02, 1.0 - local * local * 3.7))));
  let ray = refract(vec3f(0.0, 0.0, -1.0), nl, 0.68);
  let p = p0 + vec2f(ray.x * u.e.x, 0.0);
  var col = rampL(smoothField(p / vec2f(ar, 1.0) + 0.5, R, t));
  let dx = dn / R.y * 0.25;
  var rid = 0.0;
  for (var i = 0; i < 4; i = i + 1) { rid = rid + ridgeAt(fract(x + (f32(i) - 1.5) * dx) - 0.5); }
  rid = rid * 0.25;
  let edge = pow(abs(local) * 2.0, 7.0);
  let gate = 0.15 + 0.85 * smoothstep(0.04, 0.55, dot(col, vec3f(0.2126, 0.7152, 0.0722)));
  col = col * (1.0 - edge * 0.78 * 0.55);
  return mix(col, vec3f(0.988, 1.0, 1.0), clamp(rid * gate * 0.76, 0.0, 1.0));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ub = vec2f(uv.x, 1.0 - uv.y);
  let ar = u.a.x / max(u.a.y, 1.0);
  let energy = u.a.w;
  let style = u.b.y;
  let t = u.a.z * u.b.x;
  if (style > 2.5) {
    let R = vec2f(u.a.x, u.a.y);
    let col = fluted(ub, R, t);
    let g = (h21(ub * R + vec2f(floor(u.a.z * 12.0) * 7.0, 1.0)) - 0.5) * 0.016 * u.e.y;
    return vec4f(clamp(col * (1.0 + g * 2.0) + vec3f(g * 0.4), vec3f(0.0), vec3f(1.0)), 1.0);
  }
  var p = vec2f(ub.x * ar, ub.y) * 2.2;
  if (style > 1.5) {
    p = vec2f(p.x * 1.3, p.y * 0.55);
    p = vec2f(p.x, p.y - t * 0.35);
  }
  let q = vec2f(fbm(p + vec2f(0.0, t * 0.12)), fbm(p + vec2f(5.2, 1.3) - t * 0.1));
  let f = fbm(p + 1.7 * q + vec2f(t * 0.05, -t * 0.04));
  let hot = vec2f(u.c.x, 1.0 - u.c.y);
  let d = (ub - hot) * vec2f(ar, 1.0);
  let hs = exp(-dot(d, d) * 2.6);
  var heat = f * 1.05 - 0.30 + energy * 0.62 * hs + energy * 0.22;
  if (style > 1.5) { heat = heat + energy * 0.5 * pow(1.0 - ub.y, 2.2) - 0.08; }
  let cool = vec2f(u.c.z, 1.0 - u.c.w);
  let cz = (ub - cool) / vec2f(0.46, 0.26);
  heat = heat - u.b.w * exp(-dot(cz, cz));
  heat = clamp(heat, 0.0, 1.0);
  if (style > 0.5 && style < 1.5) {
    let steps = max(u.b.z, 2.0);
    let x = heat * steps;
    heat = (floor(x) + smoothstep(0.0, 0.08, fract(x))) / steps;
  }
  return vec4f(ramp(heat), 1.0);
}
`
  frame.state.module = device.createShaderModule({ code: wgsl })
  frame.state.pipeline = null
  frame.state.pipelineFormat = null
  frame.state.quad = device.createBuffer({ size: 6 * 4 * 4, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true })
  new Float32Array(frame.state.quad.getMappedRange()).set([
    -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0,
    -1, 1, 0, 0, 1, -1, 1, 1, 1, 1, 1, 0,
  ])
  frame.state.quad.unmap()
  frame.state.uniforms = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
}

export function render(device, frame) {
  var p = frame.params || {}
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d }
  var hot = p.hot || {}
  var hot2 = p.hot2 || {}
  var cool = p.cool || {}
  device.queue.writeBuffer(frame.state.uniforms, 0, new Float32Array([
    frame.output.width, frame.output.height, Number(frame.time) * 0.001, num(p.heat, 0.62),
    num(p.speed, 0.35), num(p.style, 3), num(p.steps, 9), num(p.coolStrength, 0.62),
    num(hot.x, 14) / 100, num(hot.y, 106) / 100, num(cool.x, 50) / 100, num(cool.y, 34) / 100,
    num(hot2.x, 88) / 100, num(hot2.y, 0) / 100, num(p.flutes, 44), num(p.calm, 0),
    num(p.refraction, 0.04), num(p.grain, 1), 0, 0,
  ]))
  var fmt = frame.output.format
  if (frame.state.pipeline == null || frame.state.pipelineFormat !== fmt) {
    frame.state.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: frame.state.module,
        entryPoint: 'vs_main',
        buffers: [{ arrayStride: 16, attributes: [
          { shaderLocation: 0, format: 'float32x2', offset: 0 },
          { shaderLocation: 1, format: 'float32x2', offset: 8 },
        ] }],
      },
      fragment: { module: frame.state.module, entryPoint: 'fs_main', targets: [{ format: fmt }] },
      primitive: { topology: 'triangle-list' },
    })
    frame.state.pipelineFormat = fmt
  }
  var encoder = device.createCommandEncoder()
  var pass = encoder.beginRenderPass({ colorAttachments: [{ view: frame.output.createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }] })
  pass.setPipeline(frame.state.pipeline)
  pass.setBindGroup(0, device.createBindGroup({ layout: frame.state.pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: frame.state.uniforms } }] }))
  pass.setVertexBuffer(0, frame.state.quad)
  pass.draw(6)
  pass.end()
  device.queue.submit([encoder.finish()])
}

