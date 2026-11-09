// The heat background ("Fluted Isotherm, blended", approved Nov 5 2026).
// A WebGL2 field with two heat areas (H rises from the bottom left, H2 comes in from the top right),
// read through fine fluted glass. C is a quiet zone that keeps text readable. Q calms the peak on reading screens.

export type HeatParams = {
  E: number; // energy
  S: number; // speed
  Q: number; // calm (0 lively, 1 quiet)
  hx: number; hy: number; // heat area 1 (0..1, y up)
  h2x: number; h2y: number; // heat area 2
  cx: number; cy: number; cz: number; // quiet zone centre and strength
};

export type Heat = { to(p: Partial<HeatParams>): void; set(p: Partial<HeatParams>): void; dispose(): void };

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FS = `#version 300 es
precision highp float; out vec4 o;
uniform vec2 R; uniform float T, E, S, Q, DN, RF; uniform vec2 H, H2; uniform vec3 C;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm3(vec2 p){ float v=0., a=.5; for(int i=0;i<3;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v/.875; }
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
vec3 lab(vec3 c){ c=lin(c); vec3 l=vec3(.4122214708*c.r+.5363325363*c.g+.0514459929*c.b, .2119034982*c.r+.6806995451*c.g+.1073969566*c.b, .0883024619*c.r+.2817188376*c.g+.6299787005*c.b);
  l=pow(max(l,0.),vec3(1./3.)); return vec3(.2104542553*l.x+.7936177850*l.y-.0040720468*l.z, 1.9779984951*l.x-2.4285922050*l.y+.4505937099*l.z, .0259040371*l.x+.7827717662*l.y-.8086757660*l.z); }
vec3 unlab(vec3 c){ vec3 l=vec3(c.x+.3963377774*c.y+.2158037573*c.z, c.x-.1055613458*c.y-.0638541728*c.z, c.x-.0894841775*c.y-1.2914855480*c.z); l=l*l*l;
  vec3 r=vec3(4.0767416621*l.x-3.3077115913*l.y+.2309699292*l.z, -1.2684380046*l.x+2.6097574011*l.y-.3413193965*l.z, -.0041960863*l.x-.7034186147*l.y+1.7076147010*l.z); return pow(max(r,0.),vec3(1./2.2)); }
vec3 rampLab(float x){
  vec3 c0=vec3(.122,.125,.161), c1=vec3(.204,.212,.271), c2=vec3(.122,.306,.451), c3=vec3(.384,.753,.965), c4=vec3(.698,.965,.004), c5=vec3(.902,1.,.651);
  x=clamp(x,0.,1.); vec3 a,b; float k;
  if(x<.20){a=c0;b=c1;k=x/.20;} else if(x<.42){a=c1;b=c2;k=(x-.20)/.22;} else if(x<.64){a=c2;b=c3;k=(x-.42)/.22;} else if(x<.83){a=c3;b=c4;k=(x-.64)/.19;} else {a=c4;b=c5;k=(x-.83)/.17;}
  k=k*k*(3.-2.*k); return mix(lab(a),lab(b),k); }
vec3 rampL(float x){ vec3 s=rampLab(x-.08)+rampLab(x-.04)+rampLab(x)+rampLab(x+.04)+rampLab(x+.08); return unlab(s/5.); }
float lobe(vec2 w, vec2 c, float r, float L){ vec2 d=(w-c*R)/(L*r); return exp(-dot(d,d)); }
float heat(vec2 uv){ float L=.26*(R.x+R.y)*.5; vec2 px=uv*R; vec2 p=px/L; float t=T*S;
  vec2 q=vec2(fbm3(p*.45+vec2(0.,t*.07)), fbm3(p*.45+vec2(5.2,1.3)-t*.06));
  vec2 w=px+(q-.5)*L*2.2;
  float g=E*(1.25*lobe(w,H,2.5,L)+1.05*lobe(w,H2,2.1,L));
  float h=.16+g*.9+(fbm3(p*.7+q*1.3+vec2(t*.03,0.))-.5)*.16;
  vec2 cz=(uv-C.xy)/vec2(.46,.26); h-=C.z*exp(-dot(cz,cz));
  h=clamp(h,0.,mix(.86,.5,Q));
  float x=h*7.; float st=(floor(x)+smoothstep(.1,.9,fract(x)))/7.;
  return mix(h,st,.12); }
float ridgeAt(float local){ float rd=(local+.365)*36.; return exp(-rd*rd); }
vec3 glass(vec2 uv){ float ar=R.x/R.y; vec2 p0=(uv-.5)*vec2(ar,1.);
  float x=p0.x*DN; float local=fract(x)-.5;
  vec3 nl=normalize(vec3(local*2.,0.,sqrt(max(.02,1.-local*local*3.7))));
  vec3 ray=refract(vec3(0.,0.,-1.),nl,.68);
  vec2 p=p0+vec2(ray.x*RF,0.);
  vec3 col=rampL(heat(p/vec2(ar,1.)+.5));
  float dx=DN/R.y*.25, rid=0.;
  for(int i=0;i<4;i++){ rid+=ridgeAt(fract(x+(float(i)-1.5)*dx)-.5); } rid*=.25;
  float edge=pow(abs(local)*2.,7.);
  float gate=.15+.85*smoothstep(.04,.55,dot(col,vec3(.2126,.7152,.0722)));
  col*=1.-edge*.78*.55;
  return mix(col,vec3(.988,1.,1.),clamp(rid*gate*.76,0.,1.)); }
void main(){
  vec2 uv=gl_FragCoord.xy/R;
  vec3 col=glass(uv); float g=(h21(gl_FragCoord.xy+vec2(floor(T*12.)*7.,1.))-.5)*.016;
  o=vec4(col*(1.+g*2.)+g*.4,1.);
}`;

const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createHeat(canvas: HTMLCanvasElement, initial: HeatParams): Heat {
  const cur: HeatParams = { ...initial };
  const tgt: HeatParams = { ...initial };
  const noop: Heat = { to: p => Object.assign(tgt, p), set: p => { Object.assign(tgt, p); Object.assign(cur, p); }, dispose: () => {} };
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
  if (!gl) { canvas.classList.add('heat-fallback'); return noop; }

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); canvas.classList.add('heat-fallback'); return noop; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = { R: U('R'), T: U('T'), E: U('E'), S: U('S'), Q: U('Q'), DN: U('DN'), RF: U('RF'), H: U('H'), H2: U('H2'), C: U('C') };

  const fit = () => {
    const r = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * r));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * r));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const ro = new ResizeObserver(fit); ro.observe(canvas); fit();

  let simT = 3, last = performance.now(), raf = 0, alive = true;
  const frame = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = Math.min(1, dt * 1.4);
    for (const key of Object.keys(cur) as (keyof HeatParams)[]) cur[key] += (tgt[key] - cur[key]) * k;
    if (!reduceMotion()) simT += dt;
    gl.uniform2f(u.R, canvas.width, canvas.height); gl.uniform1f(u.T, simT);
    gl.uniform1f(u.E, cur.E); gl.uniform1f(u.S, cur.S); gl.uniform1f(u.Q, cur.Q);
    gl.uniform1f(u.DN, 44); gl.uniform1f(u.RF, 0.04);
    gl.uniform2f(u.H, cur.hx, cur.hy); gl.uniform2f(u.H2, cur.h2x, cur.h2y); gl.uniform3f(u.C, cur.cx, cur.cy, cur.cz);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    to: p => { Object.assign(tgt, p); },
    set: p => { Object.assign(tgt, p); Object.assign(cur, p); },
    dispose: () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); gl.deleteProgram(prog); gl.deleteBuffer(buf); },
  };
}
