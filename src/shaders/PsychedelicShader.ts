export const PsychedelicShader = {
  name: 'PsychedelicShader',
  uniforms: {
    tDiffuse: { value: null },
    tScenery: { value: null },
    uSceneryBlend: { value: 0.0 }, // 0.0 to 1.0 (blends drawing elements in when trip > 50%)
    uTime: { value: 0.0 },
    uIntensity: { value: 0.0 }, // 0.0 (clean) to 1.0 (full trip)
    uAberration: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tScenery;
    uniform float uSceneryBlend;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uAberration;
    varying vec2 vUv;

    // Helper: Rotate RGB color in hue space
    vec3 hueRotate(vec3 color, float angle) {
      const vec3 k = vec3(0.57735, 0.57735, 0.57735);
      float cosAngle = cos(angle);
      return vec3(color * cosAngle + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - cosAngle));
    }

    // Helper: Boost saturation
    vec3 adjustSaturation(vec3 color, float sat) {
      float grey = dot(color, vec3(0.299, 0.587, 0.114));
      return mix(vec3(grey), color, sat);
    }

    void main() {
      // 0. Clean pass-through if intensity is zero
      if (uIntensity <= 0.0001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      // 1. Wave warp distortion: sin(vUv.y * 12.0 + uTime * 2.0) * 0.015 * uIntensity
      float waveX = sin(vUv.y * 12.0 + uTime * 2.0) * 0.015 * uIntensity;
      float waveY = cos(vUv.x * 10.0 + uTime * 1.8) * 0.010 * uIntensity;
      vec2 warpedUv = vUv + vec2(waveX, waveY);
      warpedUv = clamp(warpedUv, vec2(0.001), vec2(0.999));

      // 2. Chromatic aberration: horizontal RGB offsets proportional to (uAberration * uIntensity)
      float aberrationFactor = (uAberration > 0.0 ? uAberration : 1.0) * uIntensity * 0.012;
      float r = texture2D(tDiffuse, warpedUv + vec2(aberrationFactor, 0.0)).r;
      float g = texture2D(tDiffuse, warpedUv).g;
      float b = texture2D(tDiffuse, warpedUv - vec2(aberrationFactor, 0.0)).b;
      vec3 color = vec3(r, g, b);

      // 3. Color cycle (Hue rotation) & Saturation boost
      float hueAngle = sin(uTime * 0.8) * 1.5 * uIntensity;
      color = hueRotate(color, hueAngle);

      float saturation = 1.0 + 1.25 * uIntensity;
      color = adjustSaturation(color, saturation);

      // 4. Subtle vignette darkening at screen edges
      vec2 normUv = vUv - vec2(0.5);
      float dist = length(normUv);
      float vignette = smoothstep(0.75, 0.35, dist * (0.8 + 0.4 * uIntensity));
      color *= mix(1.0, vignette, 0.45 * uIntensity + 0.15);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
