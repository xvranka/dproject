import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// #### MATRIX HELPERS ####

function perspective(fovRad, aspect, near, far) {
  const f  = 1 / Math.tan(fovRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0,                    0,
    0,          f, 0,                    0,
    0,          0, (far + near) * nf,   -1,
    0,          0, 2 * far * near * nf,  0,
  ]);
}

function lookAt([ex, ey, ez], [cx, cy, cz], [ux, uy, uz]) {
  let fx = cx-ex, fy = cy-ey, fz = cz-ez, fl = Math.hypot(fx,fy,fz);
  fx/=fl; fy/=fl; fz/=fl;
  let sx = fy*uz-fz*uy, sy = fz*ux-fx*uz, sz = fx*uy-fy*ux, sl = Math.hypot(sx,sy,sz);
  sx/=sl; sy/=sl; sz/=sl;
  const rx = sy*fz-sz*fy, ry = sz*fx-sx*fz, rz = sx*fy-sy*fx;
  return new Float32Array([
     sx,  rx, -fx, 0,
     sy,  ry, -fy, 0,
     sz,  rz, -fz, 0,
    -(sx*ex+sy*ey+sz*ez), -(rx*ex+ry*ey+rz*ez), fx*ex+fy*ey+fz*ez, 1,
  ]);
}

function mat4mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++)
        o[i + j*4] += a[i + k*4] * b[k + j*4];
  return o;
}

// #### SHADERS ####

// vertex: transforms position into clip space; point size shrinks naturally with depth
const VertexShader = `#version 300 es
in vec3 aPos;
in vec3 aColor;
uniform mat4 uMVP;
out vec3 vColor;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  gl_PointSize = 100.0 / gl_Position.w;
  vColor = aColor;
}`;

// point fragment: soft anti-aliased circle with a bright core highlight
const PointFragShader = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() {
  vec2  coord = gl_PointCoord - 0.5;
  float r     = dot(coord, coord);
  if (r > 0.25) discard;
  float alpha = 1.0 - smoothstep(0.15, 0.25, r);
  float core  = 1.0 - smoothstep(0.0,  0.08, r);
  vec3  color = mix(vColor, vec3(1.0), core * 0.4);
  fragColor   = vec4(color, alpha);
}`;

// line fragment: semi-transparent so edges don't overpower nodes
const LineFragShader = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() {
  fragColor = vec4(vColor * 0.7, 0.35);
}`;

// pick vertex: encodes gl_VertexID as RGB — index+1 so node 0 doesn't collide with black background
const PickVertShader = `#version 300 es
in vec3 aPos;
in vec3 aColor;
uniform mat4 uMVP;
out vec3 vPickColor;
void main() {
  gl_Position   = uMVP * vec4(aPos, 1.0);
  gl_PointSize  = 100.0 / gl_Position.w;
  float idx     = float(gl_VertexID + 1);
  vPickColor    = vec3(
    mod(idx, 256.0),
    mod(floor(idx / 256.0), 256.0),
    floor(idx / 65536.0)
  ) / 255.0;
}`;

// pick fragment: outputs encoded index, discards corners so only circle area is pickable
const PickFragShader = `#version 300 es
precision mediump float;
in vec3 vPickColor;
out vec4 fragColor;
void main() {
  vec2 coord = gl_PointCoord - 0.5;
  if (dot(coord, coord) > 0.25) discard;
  fragColor = vec4(vPickColor, 1.0);
}`;

// #### SHADER HELPERS ####

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   vsSrc));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

// #### COMPONENT ####

const VizModule = forwardRef(function VizModule(
  { vertices, indices, nodeCount = 0, edgeCount = 0,
    onNodeClick, onZoomChange, onViewportStats },
  ref
) {
  const canvasRef = useRef(null);

  // persistent refs to GPU resources — avoids tearing down GL on re-render
  const glRef      = useRef(null);
  const programRef = useRef(null);  // { point, line, pick } — each has { prog, uMVP }
  const bufferRef  = useRef(null);  // { vbo, ebo, pointVAO, lineVAO, pickVAO }
  const pickFBORef = useRef(null);  // { fbo, texture, rbo }
  const rafRef     = useRef(null);
  const countRef   = useRef({ nodes: 0, edges: 0 });

  // camera state mutated directly in event handlers without triggering re-renders
  const camRef     = useRef({ theta: 0.6, phi: 0.25, radius: 14 });
  const dragRef    = useRef({ active: false, lastX: 0, lastY: 0 });
  const didDragRef = useRef(false);  // distinguishes a click from the end of a drag

  // keep callback refs current so closures in the mount effect always call the latest version
  const onZoomChangeRef    = useRef(onZoomChange);
  const onViewportStatsRef = useRef(onViewportStats);
  useEffect(() => { onZoomChangeRef.current    = onZoomChange;    });
  useEffect(() => { onViewportStatsRef.current = onViewportStats; });

  // #### IMPERATIVE API ####
  // exposed to the parent controller via ref

  useImperativeHandle(ref, () => ({

    // point camera directly at a node by reading its world position from the vertex buffer
    focusNode(index) {
      if (!vertices || index < 0) return;
      const x = vertices[index * 6];
      const y = vertices[index * 6 + 1];
      const z = vertices[index * 6 + 2];
      camRef.current.theta  = Math.atan2(x, z);
      camRef.current.phi    = Math.atan2(y, Math.hypot(x, z));
    },

    resetCamera() {
      camRef.current = { theta: 0.6, phi: 0.25, radius: 14 };
    },

    // TODO: implement via a per-node highlight attribute buffer (bufferSubData on a second VBO)
    highlight(_indices) {},

  }), [vertices]);

  // #### GL INITIALISATION ####
  // runs once on mount — compiles shaders, builds VAOs, creates pick FBO

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const gl = canvas.getContext('webgl2');
    if (!gl) { console.error('WebGL2 not supported'); return; }
    glRef.current = gl;

    // compile the three programs: points, lines, GPU picking
    const pointProg = createProgram(gl, VertexShader,   PointFragShader);
    const lineProg  = createProgram(gl, VertexShader,   LineFragShader);
    const pickProg  = createProgram(gl, PickVertShader, PickFragShader);

    programRef.current = {
      point: { prog: pointProg, uMVP: gl.getUniformLocation(pointProg, 'uMVP') },
      line:  { prog: lineProg,  uMVP: gl.getUniformLocation(lineProg,  'uMVP') },
      pick:  { prog: pickProg,  uMVP: gl.getUniformLocation(pickProg,  'uMVP') },
    };

    // one VBO shared by all programs; data uploaded in the data effect below
    const vbo = gl.createBuffer();
    const ebo = gl.createBuffer();

    // interleaved layout: [x, y, z, r, g, b] — 6 floats, 24 bytes stride
    const F      = Float32Array.BYTES_PER_ELEMENT;
    const STRIDE = 6 * F;

    // bind program attribute pointers to the shared VBO
    function makeVAO(prog, withEBO) {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

      const posLoc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, STRIDE, 0);

      // pick shader has no aColor attribute — skip if not present
      const colLoc = gl.getAttribLocation(prog, 'aColor');
      if (colLoc >= 0) {
        gl.enableVertexAttribArray(colLoc);
        gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, STRIDE, 3 * F);
      }

      if (withEBO) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bindVertexArray(null);
      return vao;
    }

    const pointVAO = makeVAO(pointProg, false);
    const lineVAO  = makeVAO(lineProg,  true);
    const pickVAO  = makeVAO(pickProg,  false);
    bufferRef.current = { vbo, ebo, pointVAO, lineVAO, pickVAO };

    // PICK FRAMEBUFFER
    // offscreen render target used by pickNode() to identify clicked nodes
    const pickTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, pickTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const pickRBO = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, pickRBO);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);

    const pickFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickRBO);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    pickFBORef.current = { fbo: pickFBO, texture: pickTex, rbo: pickRBO };

    // resize canvas + pick FBO together whenever the container changes size
    const observer = new ResizeObserver(() => {
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, pickTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, pickRBO);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);
    });
    observer.observe(canvas);

    // RENDER LOOP
    function render() {
      rafRef.current = requestAnimationFrame(render);
      if (countRef.current.nodes === 0) return;

      const { theta, phi, radius } = camRef.current;
      const eye = [
        radius * Math.cos(phi) * Math.sin(theta),
        radius * Math.sin(phi),
        radius * Math.cos(phi) * Math.cos(theta),
      ];

      const aspect = canvas.width / canvas.height;
      const mvp    = mat4mul(
        perspective(Math.PI / 3, aspect, 0.1, 200),
        lookAt(eye, [0, 0, 0], [0, 1, 0])
      );

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.05, 0.05, 0.08, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // draw edges first so nodes render on top
      if (countRef.current.edges > 0) {
        gl.useProgram(programRef.current.line.prog);
        gl.uniformMatrix4fv(programRef.current.line.uMVP, false, mvp);
        gl.bindVertexArray(bufferRef.current.lineVAO);
        gl.drawElements(gl.LINES, countRef.current.edges * 2, gl.UNSIGNED_INT, 0);
      }

      gl.useProgram(programRef.current.point.prog);
      gl.uniformMatrix4fv(programRef.current.point.uMVP, false, mvp);
      gl.bindVertexArray(bufferRef.current.pointVAO);
      gl.drawArrays(gl.POINTS, 0, countRef.current.nodes);

      gl.bindVertexArray(null);
    }

    render();

    // ORBIT CONTROLS — mouse
    function onMouseDown(e) {
      didDragRef.current = false;
      dragRef.current    = { active: true, lastX: e.clientX, lastY: e.clientY };
    }
    function onMouseMove(e) {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      if (Math.hypot(dx, dy) > 3) didDragRef.current = true;
      dragRef.current.lastX  = e.clientX;
      dragRef.current.lastY  = e.clientY;
      camRef.current.theta  -= dx * 0.005;
      camRef.current.phi     = Math.max(-1.48, Math.min(1.48, camRef.current.phi + dy * 0.005));
    }
    function onMouseUp() { dragRef.current.active = false; }
    function onWheel(e) {
      e.preventDefault();
      camRef.current.radius = Math.max(2, Math.min(80, camRef.current.radius + e.deltaY * 0.02));
      onZoomChangeRef.current?.(camRef.current.radius);
    }

    // ORBIT CONTROLS — touch
    let lastTouchDist = 0;
    function onTouchStart(e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        didDragRef.current = false;
        dragRef.current    = { active: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        dragRef.current.active = false;
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }
    function onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 1 && dragRef.current.active) {
        const dx = e.touches[0].clientX - dragRef.current.lastX;
        const dy = e.touches[0].clientY - dragRef.current.lastY;
        if (Math.hypot(dx, dy) > 3) didDragRef.current = true;
        dragRef.current.lastX  = e.touches[0].clientX;
        dragRef.current.lastY  = e.touches[0].clientY;
        camRef.current.theta  -= dx * 0.005;
        camRef.current.phi     = Math.max(-1.48, Math.min(1.48, camRef.current.phi + dy * 0.005));
      } else if (e.touches.length === 2) {
        const dist  = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        camRef.current.radius = Math.max(2, Math.min(80, camRef.current.radius + (lastTouchDist - dist) * 0.05));
        lastTouchDist = dist;
        onZoomChangeRef.current?.(camRef.current.radius);
      }
    }
    function onTouchEnd() { dragRef.current.active = false; }

    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('wheel',      onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);
    window.addEventListener('mousemove',  onMouseMove);
    window.addEventListener('mouseup',    onMouseUp);

    // CLEANUP
    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      canvas.removeEventListener('mousedown',  onMouseDown);
      canvas.removeEventListener('wheel',      onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseup',    onMouseUp);
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ebo);
      gl.deleteVertexArray(pointVAO);
      gl.deleteVertexArray(lineVAO);
      gl.deleteVertexArray(pickVAO);
      gl.deleteProgram(pointProg);
      gl.deleteProgram(lineProg);
      gl.deleteProgram(pickProg);
      gl.deleteTexture(pickTex);
      gl.deleteRenderbuffer(pickRBO);
      gl.deleteFramebuffer(pickFBO);
      glRef.current     = null;
      bufferRef.current = null;
    };
  }, []);

  // #### DATA UPLOAD ####
  // re-runs only when scene data changes — no shader recompile, no VAO rebuild

  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !vertices || !bufferRef.current) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, bufferRef.current.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    if (indices && edgeCount > 0) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferRef.current.ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    countRef.current = { nodes: nodeCount, edges: edgeCount };
  }, [vertices, indices, nodeCount, edgeCount]);

  // #### GPU PICKING ####
  // renders scene to an offscreen FBO with index-encoded colors, reads one pixel to identify clicked node

  function pickNode(mouseX, mouseY) {
    const gl = glRef.current;
    if (!gl || !pickFBORef.current || countRef.current.nodes === 0) return null;

    const canvas = canvasRef.current;
    const { theta, phi, radius } = camRef.current;
    const eye = [
      radius * Math.cos(phi) * Math.sin(theta),
      radius * Math.sin(phi),
      radius * Math.cos(phi) * Math.cos(theta),
    ];
    const mvp = mat4mul(
      perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 200),
      lookAt(eye, [0, 0, 0], [0, 1, 0])
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBORef.current.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(programRef.current.pick.prog);
    gl.uniformMatrix4fv(programRef.current.pick.uMVP, false, mvp);
    gl.bindVertexArray(bufferRef.current.pickVAO);
    gl.drawArrays(gl.POINTS, 0, countRef.current.nodes);
    gl.bindVertexArray(null);

    // read the single pixel at click position — WebGL y-axis runs bottom-up
    const pixel = new Uint8Array(4);
    gl.readPixels(mouseX, canvas.height - mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // alpha 0 means background — nothing was hit
    if (pixel[3] === 0) return null;

    // decode RGB back to node index (we stored index+1 to avoid colliding with black background)
    return pixel[0] + pixel[1] * 256 + pixel[2] * 65536 - 1;
  }

  function handleClick(e) {
    // ignore if the mouse moved during the click — that was a drag, not a selection
    if (didDragRef.current) return;
    const rect  = canvasRef.current.getBoundingClientRect();
    const index = pickNode(e.clientX - rect.left, e.clientY - rect.top);
    if (index !== null) onNodeClick?.(index);
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
});

export default VizModule;