"use client";

import { useEffect, useRef } from "react";
import { HeroOverlay } from "./hero-overlay";

/*
 * HeroCanvas — the cinematic descent, rendered in real time by a WebGL
 * fragment shader. No pre-rendered frames, no video, no dependency: the
 * bioluminescent root-network is generated per pixel, and the scroll drives a
 * downward camera through parallaxed depth layers of glowing filaments.
 *
 * Palette is locked to the LabIA tokens. Type accents (amber/violet/cyan/green)
 * dominate the strands; emerald is RARE — only the travelling sap pulses.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  iResolution;
uniform float iTime;
uniform float uScroll;   // 0..1 descent progress
uniform float uReduced;  // 1.0 when prefers-reduced-motion

// ---- token palette ----
const vec3 BG     = vec3(0.039, 0.043, 0.055); // #0A0B0E
const vec3 AMBER  = vec3(1.000, 0.769, 0.420); // copy
const vec3 VIOLET = vec3(0.545, 0.486, 1.000); // image
const vec3 CYAN   = vec3(0.302, 0.847, 1.000); // video
const vec3 GREEN  = vec3(0.369, 0.890, 0.545); // publish
const vec3 EMER   = vec3(0.239, 0.874, 0.651); // reagent-bright (rare)

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// One depth layer of glowing filaments: domain-warped ridge lines.
// Thin bright line + a hotter core; everything off the ridge stays dark.
float strands(vec2 uv, float t, float scale) {
  vec2 p = uv * scale;
  vec2 w = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  float n = fbm(p * vec2(1.0, 1.35) + w * 1.7);
  float ridge = abs(n - 0.5);
  float line = smoothstep(0.016, 0.0, ridge);
  float core = smoothstep(0.005, 0.0, ridge);
  return line * 0.38 + core * 1.0;
}

vec3 fireflies(vec2 uv, float t, float camY) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float sc = 3.5 + fk * 2.5;
    vec2 p = uv * sc + vec2(0.0, camY * (0.6 + fk * 0.45));
    vec2 cell = floor(p);
    vec2 f = fract(p);
    for (int oy = -1; oy <= 1; oy++) {
      for (int ox = -1; ox <= 1; ox++) {
        vec2 o = vec2(float(ox), float(oy));
        vec2 id = cell + o;
        float h = hash(id + fk * 13.7);
        if (h < 0.62) continue; // sparse
        vec2 pos = o + vec2(hash(id + 1.3), hash(id + 2.7));
        pos += 0.18 * vec2(sin(t * 0.5 + h * 30.0), cos(t * 0.4 + h * 20.0));
        float dd = length(f - pos);
        float glow = smoothstep(0.14, 0.0, dd);
        float tw = 0.45 + 0.55 * sin(t * 1.6 + h * 40.0);
        vec3 col = mix(EMER, vec3(0.90, 0.95, 1.0), h);
        acc += col * glow * tw * 0.55;
      }
    }
  }
  return acc;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  float t = mix(iTime, 9.0, uReduced); // frozen-ish when reduced motion
  float camY = uScroll * 7.5 + t * 0.02;

  vec3 glow = vec3(0.0);

  // Four parallaxed depth layers — the four node-type accents, far to near.
  for (int i = 0; i < 4; i++) {
    float d = float(i) / 3.0;
    float scale  = mix(5.5, 2.2, d);
    float yOff   = camY * mix(0.22, 1.15, d);
    float bright = mix(0.10, 0.8, d);
    vec3 col = i == 0 ? VIOLET : (i == 1 ? CYAN : (i == 2 ? AMBER : GREEN));
    vec2 puv = uv + vec2(sin(t * 0.05 + d * 3.0) * 0.08, yOff);
    float s = strands(puv, t * 0.06 + d, scale);
    glow += col * s * bright;
  }

  // Rare emerald sap: a travelling highlight along a near strand field.
  vec2 spuv = uv + vec2(0.0, camY * 1.0);
  float sap = strands(spuv, t * 0.06 + 0.5, 2.4);
  float pulse = smoothstep(0.86, 1.0, sin((uv.y * 2.4 - t * 0.55) * 3.14159) * 0.5 + 0.5);
  glow += EMER * sap * pulse * 1.3;

  // Drifting bioluminescent motes.
  glow += fireflies(uv, t, camY);

  // Compress highlights so the bright cores bloom without clipping to white,
  // while keeping the void deep — most of the frame stays near #0A0B0E.
  glow = glow / (glow + vec3(1.0));

  vec3 col = BG + glow * 1.05;

  // Faint cool ambient near the top (the canopy), fading into the descent.
  col += vec3(0.006, 0.010, 0.018) * smoothstep(0.9, -0.4, uv.y) * (1.0 - uScroll * 0.7);

  // Vignette + fine grain.
  float vig = smoothstep(1.25, 0.25, length(uv * vec2(0.85, 1.0)));
  col *= mix(0.5, 1.0, vig);
  col += (hash(gl_FragCoord.xy * 0.5 + t) - 0.5) * 0.025;

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("shader compile:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function HeroCanvas() {
  const wrapperRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) return; // graceful: container stays #0A0B0E, overlay still readable

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("link:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "iResolution");
    const uTime = gl.getUniformLocation(prog, "iTime");
    const uScroll = gl.getUniformLocation(prog, "uScroll");
    const uReduced = gl.getUniformLocation(prog, "uReduced");

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    gl.uniform1f(uReduced, reduced ? 1 : 0);

    // Cap internal resolution — the scene is soft, so 1x DPR is plenty and keeps
    // the fragment cost sane on the FBM-heavy shader.
    const scale = Math.min(window.devicePixelRatio || 1, 1.25);
    let w = 0,
      h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const nw = Math.max(1, Math.round(r.width * scale));
      const nh = Math.max(1, Math.round(r.height * scale));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };

    let progress = 0;
    const readScroll = () => {
      const rect = wrapper.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      progress =
        scrollable <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / scrollable));
    };

    // Only run the loop while the hero is on screen.
    let visible = true;
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !reduced) loop();
      },
      { threshold: 0 },
    );
    io.observe(wrapper);

    let raf = 0;
    const start = performance.now();
    const draw = () => {
      resize();
      readScroll();
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform1f(uScroll, progress);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const loop = () => {
      cancelAnimationFrame(raf);
      const tick = () => {
        draw();
        if (visible && !reduced) raf = requestAnimationFrame(tick);
      };
      tick();
    };

    // Reduced motion: redraw only on scroll/resize, never animate.
    const onScroll = () => {
      if (reduced) draw();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    if (reduced) draw();
    else loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <section
      ref={wrapperRef}
      id="hero"
      className="relative z-10 w-full"
      style={{ height: "300vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-lab-bg">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {/* Soft floor gradient so the roots dissolve into the dark at the seam. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 z-10"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--lab-bg))",
          }}
        />
        <HeroOverlay />
      </div>
    </section>
  );
}
