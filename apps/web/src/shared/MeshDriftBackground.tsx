import { useEffect, useRef } from 'react';
import fragmentShaderSource from './mesh-drift.frag.glsl?raw';

const vertexShaderSource = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const ambientColors = ['#FAFAFA', '#F7D797', '#F7C097'];

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader allocation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'WebGL shader compilation failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export function MeshDriftBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;

    let program: WebGLProgram | null = null;
    let positions: WebGLBuffer | null = null;
    let animationFrame = 0;
    let pointerPresent = 0;
    let pointerX = 0;
    let pointerY = 0;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = !document.hidden;

    try {
      const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      const activeProgram = gl.createProgram();
      if (!activeProgram) throw new Error('WebGL program allocation failed');
      program = activeProgram;
      gl.attachShader(activeProgram, vertex);
      gl.attachShader(activeProgram, fragment);
      gl.linkProgram(activeProgram);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(activeProgram, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(activeProgram) || 'WebGL program link failed');
      }

      positions = gl.createBuffer();
      if (!positions) throw new Error('WebGL buffer allocation failed');
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.useProgram(activeProgram);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);

      const uniform = (name: string) => gl.getUniformLocation(activeProgram, name);
      const sceneUniform = uniform('u_scene');
      const spaceUniform = uniform('u_space');
      const cursorUniform = uniform('u_cursor');
      const colors = ambientColors.flatMap(rgb);
      gl.uniform3fv(uniform('u_colors[0]'), new Float32Array([...colors, ...Array(15).fill(0)]));
      gl.uniform4f(uniform('u_shape'), 1.5, 0.5, 0.28, 0.0);
      gl.uniform4f(uniform('u_surface'), 1.82, 0.99, 0.0, 1.0);
      gl.uniform4f(uniform('u_finish'), 0.0, 0.0, 0.0, 0.07);
      gl.uniform4f(uniform('u_transform'), 1.0, 0.0, 0.12, 1.0);

      const draw = (timeSeconds: number) => {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform4f(sceneUniform, canvas.width, canvas.height, timeSeconds * 2, 3.0);
        gl.uniform4f(spaceUniform, 0.0, 0.0, pointerX, pointerY);
        gl.uniform4f(cursorUniform, pointerPresent, 2.0, 0.30, 0.62);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const resize = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(window.innerWidth * ratio));
        const height = Math.max(1, Math.round(window.innerHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
        draw(reducedMotion ? 0 : performance.now() / 1000);
      };

      const render = (now: number) => {
        if (!visible || reducedMotion) return;
        draw(now / 1000);
        animationFrame = window.requestAnimationFrame(render);
      };
      const start = () => {
        window.cancelAnimationFrame(animationFrame);
        resize();
        if (visible && !reducedMotion) animationFrame = window.requestAnimationFrame(render);
      };
      const onVisibilityChange = () => {
        visible = !document.hidden;
        if (visible) start();
        else window.cancelAnimationFrame(animationFrame);
      };
      const onMotionChange = (event: MediaQueryListEvent) => {
        reducedMotion = event.matches;
        start();
      };
      const onPointerMove = (event: PointerEvent) => {
        pointerPresent = 1;
        pointerX = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        pointerY = 1 - (event.clientY / Math.max(1, window.innerHeight)) * 2;
      };
      const onPointerLeave = () => { pointerPresent = 0; };
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const observer = new ResizeObserver(resize);
      observer.observe(document.documentElement);
      window.addEventListener('resize', resize, { passive: true });
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerleave', onPointerLeave);
      document.addEventListener('visibilitychange', onVisibilityChange);
      motionQuery.addEventListener('change', onMotionChange);
      start();

      return () => {
        observer.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        motionQuery.removeEventListener('change', onMotionChange);
        window.cancelAnimationFrame(animationFrame);
        if (program) gl.deleteProgram(program);
        if (positions) gl.deleteBuffer(positions);
      };
    } catch (error) {
      if (program) gl.deleteProgram(program);
      console.warn('Mesh background unavailable; using its CSS fallback.', error);
    }
  }, []);

  return <canvas ref={canvasRef} className="mesh-drift-canvas" aria-hidden="true" />;
}
