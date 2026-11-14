const LS = (() => {
// Property metadata is only used in Figma Design, so this is a no-op.
function defineProperties(
  _component,
  _properties,
) {}

function Effect() { }
function setup(device, frame) {
    var wgsl = `diagnostic(off,derivative_uniformity);
struct U {
  c0: vec4f,
  c1: vec4f,
  c2: vec4f,
  c3: vec4f,
  hl: vec4f,
  v0: vec4f,
  v1: vec4f,
  v2: vec4f,
  v3: vec4f,
  v4: vec4f,
  v5: vec4f,
  v6: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_main(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VsOut {
  var o: VsOut;
  o.position = vec4f(pos, 0.0, 1.0);
  o.uv = uv;
  return o;
}

fn hash2(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + vec3f(dot(p3, vec3f(p3.y, p3.z, p3.x) + vec3f(33.33)));
  return fract((p3.x + p3.y) * p3.z);
}

fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = hash2(i);
  let b = hash2(i + vec2f(1.0, 0.0));
  let c = hash2(i + vec2f(0.0, 1.0));
  let d = hash2(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var amp: f32 = 0.5;
  var total: f32 = 0.0;
  for (var i: i32 = 0; i < 4; i = i + 1) {
    total = total + amp * vnoise(p);
    p = p * 2.02 + vec2f(1.7, 9.2);
    amp = amp * 0.5;
  }
  return total / 0.9375;
}

fn rot2(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn toLin(c: vec3f) -> vec3f {
  let lo = c / 12.92;
  let hi = pow((c + vec3f(0.055)) / 1.055, vec3f(2.4));
  return select(hi, lo, c <= vec3f(0.04045));
}

fn toSrgb(c0: vec3f) -> vec3f {
  let c = max(c0, vec3f(0.0));
  let lo = c * 12.92;
  let hi = 1.055 * pow(c, vec3f(1.0 / 2.4)) - vec3f(0.055);
  return select(hi, lo, c <= vec3f(0.0031308));
}

fn toOklab(c: vec3f) -> vec3f {
  let l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  let m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  let s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  let l2 = pow(max(l, 0.0), 1.0 / 3.0);
  let m2 = pow(max(m, 0.0), 1.0 / 3.0);
  let s2 = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3f(
    0.2104542553 * l2 + 0.7936177850 * m2 - 0.0040720468 * s2,
    1.9779984951 * l2 - 2.4285922050 * m2 + 0.4505937099 * s2,
    0.0259040371 * l2 + 0.7827717662 * m2 - 0.8086757660 * s2
  );
}

fn fromOklab(c: vec3f) -> vec3f {
  let l2 = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  let m2 = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  let s2 = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  let l = l2 * l2 * l2;
  let m = m2 * m2 * m2;
  let s = s2 * s2 * s2;
  return vec3f(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

fn rampLab(v0: f32) -> vec3f {
  let v = clamp(v0, 0.0, 1.0);
  let s1 = clamp(u.v6.x, 0.05, 0.9);
  let s2 = clamp(u.v6.y, s1 + 0.02, 0.98);
  let L0 = toOklab(toLin(u.c0.rgb));
  let L1 = toOklab(toLin(u.c1.rgb));
  let L2 = toOklab(toLin(u.c2.rgb));
  let L3 = toOklab(toLin(u.c3.rgb));
  let a = mix(L0, L1, clamp(v / s1, 0.0, 1.0));
  let b = mix(L1, L2, clamp((v - s1) / (s2 - s1), 0.0, 1.0));
  let c = mix(L2, L3, clamp((v - s2) / (1.0 - s2), 0.0, 1.0));
  return select(select(c, b, v < s2), a, v < s1);
}

fn ramp(v: f32) -> vec3f {
  let lab = (rampLab(v - 0.05) + rampLab(v - 0.025) + rampLab(v) + rampLab(v + 0.025) + rampLab(v + 0.05)) / 5.0;
  return toSrgb(fromOklab(lab));
}

fn field(p0: vec2f) -> f32 {
  let t = u.v2.z;
  let seed = u.v3.w;
  let aspect = u.v2.w;
  let pos = vec2f((u.v3.x - 0.5) * aspect, u.v3.y - 0.5);
  let sp = max(u.v0.z, 0.05);
  let q = vec2f(fbm(p0 * 1.1 + vec2f(seed * 3.1, t * 0.05)), fbm(p0 * 1.1 + vec2f(5.2 + seed, 1.3 - t * 0.04))) - vec2f(0.5);
  let p = p0 + q * u.v0.w * 0.5;
  let lay = u32(u.v0.x + 0.5);
  let d = (p - pos) / sp;
  var g: f32 = 0.0;
  if (lay == 0u) {
    g = exp(-dot(d, d));
  } else if (lay == 1u) {
    g = exp(-(d.x * d.x * 0.18 + d.y * d.y * 1.6));
  } else if (lay == 2u) {
    let dir = normalize(vec2f(1.0, -0.8));
    let a = d - dir * 0.55;
    let b = d + dir * 0.55;
    g = exp(-dot(a, a) * 1.2) + 0.7 * exp(-dot(b, b) * 1.6);
  } else if (lay == 3u) {
    g = exp(-dot(d, d) * 0.6);
  } else if (lay == 4u) {
    let a = d - vec2f(-0.22, -0.45);
    let b = d - vec2f(0.22, 0.45);
    g = exp(-dot(a, a) * 1.5) + 0.85 * exp(-dot(b, b) * 1.5);
  } else {
    let n = fbm(p * 1.4 / sp + vec2f(seed, t * 0.03));
    g = smoothstep(0.3, 0.85, n) * (0.4 + 0.6 * exp(-dot(d, d) * 0.5)) * 1.6;
  }
  let v = 1.0 - exp(-g * u.v3.z);
  return pow(clamp(v, 0.0, 1.0), u.v6.z);
}

fn lum(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

fn aaLine(x: f32, width: f32) -> f32 {
  let fw = max(fwidth(x), 0.0001);
  let d = abs(fract(x + 0.5) - 0.5);
  return 1.0 - smoothstep(fw * width * 0.5, fw * (width * 0.5 + 1.0), d);
}

fn terrace(p: vec2f, steps: f32) -> f32 {
  return floor(field(p) * steps + 0.35) / steps;
}

fn fab(p: vec2f, t: f32) -> f32 {
  let q = p + vec2f(sin(p.y * 1.1 + t) * 0.7, cos(p.x * 1.3 - t * 0.4) * 0.6);
  return sin(q.x * 2.1 + sin(q.y * 1.7)) * 0.45 + sin(q.y * 3.1 + q.x * 0.7) * 0.22 + sin(q.x * 4.6 - q.y * 1.9) * 0.08;
}

fn lens(local: f32, gateCol: vec3f) -> vec2f {
  let edge = pow(abs(local) * 2.0, 7.0);
  let rd = (local + 0.365) * 36.0;
  let ridge = exp(-rd * rd);
  let gate = 0.15 + 0.85 * smoothstep(0.04, 0.55, lum(gateCol));
  return vec2f(edge, ridge * gate);
}

fn optic(uv: vec2f) -> vec3f {
  let aspect = u.v2.w;
  let p0 = (uv - vec2f(0.5)) * vec2f(aspect, 1.0);
  let mode = u32(u.v0.y + 0.5);
  let ang = u.v2.x;
  let dens = max(u.v1.x, 1.0);
  let refr = u.v1.y;
  let light = u.v1.z;
  let edgeAmt = u.v1.w;
  let t = u.v2.z;
  let rr = rot2(p0, ang);
  var col = vec3f(0.0);

  if (mode == 0u) {
    col = ramp(field(p0));
  } else if (mode == 1u || mode == 2u || mode == 5u) {
    var x = rr.x * dens;
    if (mode == 5u) {
      x = x + u.v4.z * rr.y * rr.y * dens * 0.5;
    }
    let local = fract(x) - 0.5;
    let nl = normalize(vec3f(local * 2.0, 0.0, sqrt(max(0.02, 1.0 - local * local * 3.7))));
    let ray = refract(vec3f(0.0, 0.0, -1.0), nl, 0.68);
    col = ramp(field(p0 + rot2(vec2f(ray.x, 0.0), -ang) * refr));
    let l = lens(local, col);
    col = col * (1.0 - l.x * 0.78 * edgeAmt);
    col = mix(col, u.hl.rgb, clamp(l.y * light * 0.8, 0.0, 1.0));
  } else if (mode == 3u) {
    let tile = rr * dens;
    let local = fract(tile) - vec2f(0.5);
    let corner = max(abs(local) - vec2f(0.33), vec2f(0.0));
    let dist = length(corner) - 0.16;
    let interior = 1.0 - smoothstep(-0.015, 0.015, dist);
    let slope = local * pow(abs(local) * 2.0, vec2f(2.8)) * 3.2;
    let n = normalize(vec3f(slope, 1.0));
    let ray = refract(vec3f(0.0, 0.0, -1.0), n, 0.65);
    col = ramp(field(p0 + rot2(ray.xy, -ang) * refr));
    let bv = dist * 55.0;
    let bevel = exp(-bv * bv);
    let dir = clamp(-n.x - n.y + 0.25, 0.0, 1.0);
    col = col * (0.8 + 0.2 * interior);
    col = mix(col, u.hl.rgb, clamp(bevel * dir * light * 0.55, 0.0, 1.0));
    col = col * (1.0 - bevel * (1.0 - dir) * 0.5 * edgeAmt);
  } else if (mode == 4u) {
    let tile = rr * dens;
    let local = fract(tile) - vec2f(0.5);
    let sft = vec2f(0.04);
    let c0 = max(abs(local) - vec2f(0.3), vec2f(0.0));
    let c1 = max(abs(local - sft) - vec2f(0.3), vec2f(0.0));
    let c2 = max(abs(local + sft) - vec2f(0.3), vec2f(0.0));
    let in0 = 1.0 - smoothstep(-0.012, 0.012, length(c0) - 0.12);
    let inL = 1.0 - smoothstep(-0.012, 0.012, length(c1) - 0.12);
    let inS = 1.0 - smoothstep(-0.012, 0.012, length(c2) - 0.12);
    col = ramp(field(p0));
    col = col * (0.88 + 0.12 * in0);
    col = mix(col, u.hl.rgb, clamp(in0 * (1.0 - inL) * light * 0.45, 0.0, 1.0));
    col = col * (1.0 - in0 * (1.0 - inS) * 0.45 * edgeAmt);
  } else if (mode == 6u) {
    let p = p0 * (1.0 + u.v0.z) + vec2f(u.v3.w * 0.7, u.v3.w * 0.4);
    let h = fab(p, t);
    let e = 0.006;
    let dx = (fab(p + vec2f(e, 0.0), t) - h) / e;
    let dy = (fab(p + vec2f(0.0, e), t) - h) / e;
    let n = normalize(vec3f(-dx * 0.85, -dy * 0.85, 1.0));
    let ray = reflect(vec3f(0.0, 0.0, -1.0), n);
    let fold = smoothstep(-0.6, 0.65, h);
    col = ramp(0.1 + 0.6 * fold + 0.25 * field(p0));
    let s1 = (ray.x + ray.y * 0.24 - 0.24) * 7.0;
    let s2 = (ray.y + 0.58) * 9.0;
    let refl = (exp(-s1 * s1) + exp(-s2 * s2) * u.v6.w) * smoothstep(-0.65, 0.7, ray.z) * light;
    col = mix(col, u.hl.rgb, clamp(refl, 0.0, 0.9));
  } else if (mode == 7u) {
    let v = field(p0);
    let hh = v + (fbm(p0 * 1.8 + vec2f(u.v3.w)) - 0.5) * 0.3 * u.v0.w;
    let line = aaLine(hh * dens, 1.1 + edgeAmt);
    col = mix(ramp(v), u.hl.rgb, line * clamp(light, 0.0, 1.0));
  } else if (mode == 8u) {
    let f = dens * 6.0;
    let a1 = sin(rr.x * f + u.v0.w * 2.0 * sin(rr.y * 1.7 + t));
    let p2 = rot2(rr, 0.05);
    let a2 = sin(p2.x * f * 1.015 + u.v0.w * 2.0 * sin(p2.y * 1.9 - t));
    let mo = 0.5 + 0.5 * a1 * a2;
    let v = field(p0);
    col = ramp(mix(v, mo * (0.35 + 0.65 * v), clamp(light * 0.5, 0.0, 0.9)));
  } else if (mode == 9u) {
    let steps = max(floor(dens), 2.0);
    let v0 = terrace(p0, steps);
    let off = vec2f(0.012, 0.012) * (0.6 + refr);
    var sh: f32 = 0.0;
    sh = sh + select(0.0, 0.45, terrace(p0 - off * 0.35, steps) > v0 + 0.001);
    sh = sh + select(0.0, 0.33, terrace(p0 - off * 0.7, steps) > v0 + 0.001);
    sh = sh + select(0.0, 0.22, terrace(p0 - off, steps) > v0 + 0.001);
    let hl = select(0.0, 1.0, terrace(p0 + off * 0.18, steps) < v0 - 0.001);
    col = ramp(v0) * (1.0 - 0.32 * sh * edgeAmt) + u.hl.rgb * 0.05 * hl * light;
  } else {
    let rc = vec2f(sin(ang), cos(ang)) * 1.4;
    let rel = p0 - rc;
    let s = length(rel) * dens;
    let local = fract(s) - 0.5;
    let rdir = normalize(rel);
    let nl = normalize(vec3f(local * 2.0, 0.0, sqrt(max(0.02, 1.0 - local * local * 3.7))));
    let ray = refract(vec3f(0.0, 0.0, -1.0), nl, 0.68);
    col = ramp(field(p0 + rdir * ray.x * refr));
    let l = lens(local, col);
    col = col * (1.0 - l.x * 0.78 * edgeAmt);
    col = mix(col, u.hl.rgb, clamp(l.y * light * 0.8, 0.0, 1.0));
  }
  return col;
}

fn shade(uv: vec2f) -> vec3f {
  var col = optic(uv);
  if (u.v5.x > 0.001) {
    let aspect = u.v2.w;
    let p0 = (uv - vec2f(0.5)) * vec2f(aspect, 1.0);
    let base = ramp(field(p0));
    let dir = vec2f(cos(u.v5.y), sin(u.v5.y));
    let s = dot(uv - vec2f(0.5), dir);
    let m = smoothstep(u.v5.w - u.v5.z, u.v5.w + u.v5.z, s);
    col = mix(base, col, mix(1.0, m, u.v5.x));
  }
  return col;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let w = max(u.v4.x, 1.0);
  let h = max(u.v4.y, 1.0);
  let px = vec2f(0.25 / w, 0.25 / h);
  var col = shade(uv + vec2f(-px.x, -px.y));
  col = col + shade(uv + vec2f(px.x, -px.y));
  col = col + shade(uv + vec2f(-px.x, px.y));
  col = col + shade(uv + vec2f(px.x, px.y));
  col = col * 0.25;
  let t = u.v2.z;
  let pp = uv * vec2f(w, h);
  let g = (hash2(pp + vec2f(floor(t * 12.0) * 7.0, 1.0)) - 0.5) * u.v2.y * 0.09;
  col = col * (1.0 + g * 2.0) + vec3f(g * 0.4);
  col = col + vec3f((hash2(pp + vec2f(17.0, 3.0)) - 0.5) / 255.0);
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
    frame.state.module = device.createShaderModule({ code: wgsl });
    frame.state.pipeline = null;
    frame.state.pipelineFormat = null;
    frame.state.quad = device.createBuffer({
        size: 6 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(frame.state.quad.getMappedRange()).set([
        -1, -1, 0, 1,
        1, -1, 1, 1,
        -1, 1, 0, 0,
        -1, 1, 0, 0,
        1, -1, 1, 1,
        1, 1, 1, 0,
    ]);
    frame.state.quad.unmap();
    frame.state.uniforms = device.createBuffer({
        size: 192,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
}
function render(device, frame) {
    var params = frame.params || {};
    function ch(color, channel, fallback) {
        var c = color || {};
        var value = Number(c[channel]);
        return Number.isFinite(value) ? value : fallback;
    }
    function num(v, fallback) {
        var value = Number(v);
        return Number.isFinite(value) ? value : fallback;
    }
    function col(c, f) {
        return [ch(c, 'r', f[0]), ch(c, 'g', f[1]), ch(c, 'b', f[2]), 1];
    }
    var pos = params.position || {};
    var w = frame.output.width;
    var h = frame.output.height;
    var t = Number(frame.time) * 0.001 * num(params.speed, 0.1);
    var data = [].concat(col(params.ground, [0.078, 0.020, 0.039]), col(params.mid, [0.345, 0.071, 0.165]), col(params.glow, [0.537, 0.161, 0.255]), col(params.core, [0.851, 0.812, 0.761]), col(params.highlight, [0.949, 0.937, 0.902]), [num(params.layout, 0), num(params.glass, 0), num(params.spread, 0.6), num(params.warp, 0.5)], [num(params.density, 28), num(params.refraction, 0.35), num(params.light, 0.7), num(params.edge, 0.7)], [num(params.angle, 0) * Math.PI / 180, num(params.grain, 0.25), t, w / Math.max(h, 1)], [num(pos.x, 50) / 100, num(pos.y, 55) / 100, num(params.intensity, 2.2), num(params.seed, 1)], [w, h, num(params.bow, 1), 0], [num(params.reveal, 0), num(params.revealAngle, 135) * Math.PI / 180, num(params.feather, 0.25), num(params.revealOffset, 0)], [num(params.stop1, 0.35), num(params.stop2, 0.72), num(params.contrast, 1), num(params.sheen2, 0.2)]);
    device.queue.writeBuffer(frame.state.uniforms, 0, new Float32Array(data));
    var outputFormat = frame.output.format;
    if (frame.state.pipeline == null || frame.state.pipelineFormat !== outputFormat) {
        frame.state.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: frame.state.module,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 16,
                        attributes: [
                            { shaderLocation: 0, format: 'float32x2', offset: 0 },
                            { shaderLocation: 1, format: 'float32x2', offset: 8 },
                        ],
                    }],
            },
            fragment: {
                module: frame.state.module,
                entryPoint: 'fs_main',
                targets: [{ format: outputFormat }],
            },
            primitive: { topology: 'triangle-list' },
        });
        frame.state.pipelineFormat = outputFormat;
    }
    var encoder = device.createCommandEncoder();
    var pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: frame.output.createView(),
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store',
            }],
    });
    pass.setPipeline(frame.state.pipeline);
    var bindGroup = device.createBindGroup({
        layout: frame.state.pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: frame.state.uniforms } }],
    });
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, frame.state.quad);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
defineProperties(Effect, {
    layout: {
        type: 'number',
        label: 'Light',
        defaultValue: 0,
        control: 'select',
        options: [
            { value: 0, label: 'Radial glow' },
            { value: 1, label: 'Horizon' },
            { value: 2, label: 'Diagonal sweep' },
            { value: 3, label: 'Corner bloom' },
            { value: 4, label: 'Twin lights' },
            { value: 5, label: 'Clouds' },
        ],
    },
    glass: {
        type: 'number',
        label: 'Surface',
        defaultValue: 0,
        control: 'select',
        options: [
            { value: 0, label: 'None' },
            { value: 1, label: 'Fine flutes' },
            { value: 2, label: 'Wide flutes' },
            { value: 3, label: 'Glass tiles' },
            { value: 4, label: 'Emboss grid' },
            { value: 5, label: 'Bowed flutes' },
            { value: 6, label: 'Liquid satin' },
            { value: 7, label: 'Contour lines' },
            { value: 8, label: 'Moire' },
            { value: 9, label: 'Paper layers' },
            { value: 10, label: 'Ring reeds' },
        ],
    },
    ground: { type: 'color', label: 'Ground', defaultValue: { r: 0.078, g: 0.020, b: 0.039, a: 1 } },
    mid: { type: 'color', label: 'Mid', defaultValue: { r: 0.345, g: 0.071, b: 0.165, a: 1 } },
    glow: { type: 'color', label: 'Glow', defaultValue: { r: 0.537, g: 0.161, b: 0.255, a: 1 } },
    core: { type: 'color', label: 'Core', defaultValue: { r: 0.851, g: 0.812, b: 0.761, a: 1 } },
    highlight: { type: 'color', label: 'Highlight', defaultValue: { r: 0.949, g: 0.937, b: 0.902, a: 1 } },
    position: { type: 'point', label: 'Light position', defaultValue: { x: 50, y: 55 }, mode: 'canvas_and_ui', unit: '%' },
    spread: { type: 'number', label: 'Spread', defaultValue: 0.6, min: 0.1, max: 2.5, step: 0.01, control: 'slider' },
    warp: { type: 'number', label: 'Warp', defaultValue: 0.5, min: 0, max: 3, step: 0.01, control: 'slider' },
    intensity: { type: 'number', label: 'Intensity', defaultValue: 2.2, min: 0.2, max: 6, step: 0.01, control: 'slider' },
    contrast: { type: 'number', label: 'Contrast', defaultValue: 1, min: 0.3, max: 3, step: 0.01, control: 'slider' },
    stop1: { type: 'number', label: 'Mid stop', defaultValue: 0.35, min: 0.05, max: 0.8, step: 0.01, control: 'slider' },
    stop2: { type: 'number', label: 'Glow stop', defaultValue: 0.72, min: 0.2, max: 0.95, step: 0.01, control: 'slider' },
    seed: { type: 'number', label: 'Variation', defaultValue: 1, min: 0, max: 10, step: 0.01, control: 'slider' },
    density: { type: 'number', label: 'Density', defaultValue: 28, min: 1, max: 90, step: 0.1, control: 'slider' },
    angle: { type: 'number', label: 'Angle', defaultValue: 0, min: -180, max: 180, step: 1, control: 'slider', unit: '°' },
    refraction: { type: 'number', label: 'Refraction', defaultValue: 0.35, min: 0, max: 1.5, step: 0.01, control: 'slider' },
    light: { type: 'number', label: 'Highlights', defaultValue: 0.7, min: 0, max: 1.5, step: 0.01, control: 'slider' },
    edge: { type: 'number', label: 'Edge shadow', defaultValue: 0.7, min: 0, max: 1.5, step: 0.01, control: 'slider' },
    bow: { type: 'number', label: 'Bow', defaultValue: 1, min: -3, max: 3, step: 0.01, control: 'slider' },
    reveal: { type: 'number', label: 'Feather reveal', defaultValue: 0, min: 0, max: 1, step: 0.01, control: 'slider' },
    revealAngle: { type: 'number', label: 'Reveal angle', defaultValue: 135, min: -180, max: 180, step: 1, control: 'slider', unit: '°' },
    feather: { type: 'number', label: 'Feather', defaultValue: 0.25, min: 0.01, max: 0.8, step: 0.01, control: 'slider' },
    revealOffset: { type: 'number', label: 'Reveal offset', defaultValue: 0, min: -0.8, max: 0.8, step: 0.01, control: 'slider' },
    sheen2: { type: 'number', label: 'Second sheen', defaultValue: 0.2, min: 0, max: 1, step: 0.01, control: 'slider' },
    grain: { type: 'number', label: 'Grain', defaultValue: 0.25, min: 0, max: 2, step: 0.01, control: 'slider' },
    speed: { type: 'number', label: 'Motion speed', defaultValue: 0.1, min: 0, max: 1, step: 0.01, control: 'slider' },
});

const manifest = {
  "isAnimated": true,
  "name": "OXS light studio",
  "usesMouse": false,
  "version": 2
}

return { setup, render };
})();
