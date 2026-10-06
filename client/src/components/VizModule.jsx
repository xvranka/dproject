import { useEffect, useImperativeHandle, useRef } from 'react'

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aColor;
uniform mat4 uMVP;
uniform int uSelectedIndex;
out vec3 vColor;
void main() {
  gl_Position = uMVP * vec4(aPosition, 1.0);
  bool isSelected = gl_VertexID == uSelectedIndex;
  bool hasSelection = uSelectedIndex >= 0;
  gl_PointSize = isSelected ? 16.0 : 6.0;
  vColor = (hasSelection && !isSelected) ? vec3(0.35, 0.35, 0.35) : aColor;
}`

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() {
  vec2 coord = gl_PointCoord - 0.5;
  if (dot(coord, coord) > 0.25) discard;
  fragColor = vec4(vColor, 1.0);
}`

// "#rrggbb" -> [r, g, b] floats in [0, 1]
function hexToRgb(hex) {
  const n = parseInt(hex?.slice(1) ?? '4db2ff', 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader))
  }
  return shader
}

function createProgram(gl, vsSource, fsSource) {
  const program = gl.createProgram()
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vsSource))
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fsSource))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program))
  }
  return program
}

function perspective(fovRad, aspect, near, far) {
  const f = 1 / Math.tan(fovRad / 2)
  const nf = 1 / (near - far)
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ])
}

function lookAt([ex, ey, ez], [cx, cy, cz], [ux, uy, uz]) {
  let fx = cx - ex, fy = cy - ey, fz = cz - ez
  const fl = Math.hypot(fx, fy, fz)
  fx /= fl; fy /= fl; fz /= fl
  let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux
  const sl = Math.hypot(sx, sy, sz)
  sx /= sl; sy /= sl; sz /= sl
  const rx = sy * fz - sz * fy, ry = sz * fx - sx * fz, rz = sx * fy - sy * fx
  return new Float32Array([
    sx, rx, -fx, 0,
    sy, ry, -fy, 0,
    sz, rz, -fz, 0,
    -(sx * ex + sy * ey + sz * ez), -(rx * ex + ry * ey + rz * ez), fx * ex + fy * ey + fz * ez, 1,
  ])
}

function mat4mul(a, b) {
  const out = new Float32Array(16)
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++)
        out[i + j * 4] += a[i + k * 4] * b[k + j * 4]
  return out
}

const MOVE_SPEED = 90 // world units per second
const MAX_DIST   = 350 // the camera can't be moved farther than this from the center of the mesh
const START_POS  = { x: 206, y: 80, z: 199 } // initial camera position
const LOOK_SPEED = 0.005 // radians per pixel of mouse drag

// keeps the camera position inside a sphere around the center of the mesh
function clampPosition(pos, center) {
  const dx = pos.x - center.x, dy = pos.y - center.y, dz = pos.z - center.z
  const dist = Math.hypot(dx, dy, dz)
  if (dist > MAX_DIST) {
    const scale = MAX_DIST / dist
    pos.x = center.x + dx * scale
    pos.y = center.y + dy * scale
    pos.z = center.z + dz * scale
  }
}

// puts the camera at its starting position, looking at the middle of the mesh
function placeCamera(cam, pos, center) {
  pos.x = START_POS.x
  pos.y = START_POS.y
  pos.z = START_POS.z
  const dx = center.x - pos.x, dy = center.y - pos.y, dz = center.z - pos.z
  cam.yaw = Math.atan2(dx, dz)
  cam.pitch = Math.asin(dy / Math.hypot(dx, dy, dz))
}

// unit view direction for a first-person camera (yaw turns around Y, pitch looks up/down)
function forwardVector(yaw, pitch) {
  return [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)]
}

const GUIDE_W = 120
const GUIDE_H = 140
const GUIDE_AXES = [
  { label: 'X', dir: [1, 0, 0], color: '#ff5555' },
  { label: 'Y', dir: [0, 1, 0], color: '#55dd66' },
  { label: 'Z', dir: [0, 0, 1], color: '#5599ff' },
]

// draws the orientation guide: one arrow per world axis, rotated by the camera's current look direction,
// with the camera position underneath
function drawGuide(ctx, yaw, pitch, pos) {
  const [fx, fy, fz] = forwardVector(yaw, pitch)
  const rx = -Math.cos(yaw), rz = Math.sin(yaw)              // camera right
  const ux = -fy * rz, uy = rz * fx - rx * fz, uz = fy * rx // camera up = right × forward
  const cx = GUIDE_W / 2, cy = 56, len = 38

  ctx.clearRect(0, 0, GUIDE_W, GUIDE_H)
  ctx.fillStyle = 'rgba(15, 15, 20, 0.7)'
  ctx.beginPath()
  ctx.roundRect(0, 0, GUIDE_W, GUIDE_H, 8)
  ctx.fill()

  // project each axis to the screen plane; draw the ones pointing away from the viewer first
  const arrows = GUIDE_AXES.map((axis) => {
    const [ax, ay, az] = axis.dir
    return {
      ...axis,
      sx: ax * rx + az * rz,
      sy: -(ax * ux + ay * uy + az * uz),
      depth: ax * fx + ay * fy + az * fz, // > 0 points away from the camera
    }
  }).sort((a, b) => b.depth - a.depth)

  ctx.lineWidth = 2
  ctx.font = '600 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const a of arrows) {
    const ex = cx + a.sx * len, ey = cy + a.sy * len
    ctx.globalAlpha = a.depth > 0 ? 0.55 : 1
    ctx.strokeStyle = ctx.fillStyle = a.color
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    const angle = Math.atan2(a.sy, a.sx)
    if (Math.hypot(a.sx, a.sy) > 0.08) {
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - 7 * Math.cos(angle - 0.45), ey - 7 * Math.sin(angle - 0.45))
      ctx.lineTo(ex - 7 * Math.cos(angle + 0.45), ey - 7 * Math.sin(angle + 0.45))
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillText(a.label, cx + a.sx * (len + 11), cy + a.sy * (len + 11))
  }

  ctx.globalAlpha = 1
  ctx.fillStyle = '#ccc'
  ctx.font = '10px monospace'
  ctx.fillText(`x ${pos.x.toFixed(0)}`, cx, 110)
  ctx.fillText(`y ${pos.y.toFixed(0)}  z ${pos.z.toFixed(0)}`, cx, 124)
}

// projects a world-space point through the MVP matrix to canvas pixel coordinates; null if behind the camera
function projectToScreen(mvp, x, y, z, width, height) {
  const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]
  const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]
  const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15]
  if (cw <= 0) return null
  return [
    (cx / cw * 0.5 + 0.5) * width,
    (1 - (cy / cw * 0.5 + 0.5)) * height,
  ]
}

export default function VizModule({ points, selectedIndex = -1, onPointClick, showGuide = true, ref }) {
  const canvasRef  = useRef(null)
  const guideRef   = useRef(null)
  const showGuideRef = useRef(showGuide)
  const glRef      = useRef(null)
  const programRef = useRef(null)
  const vaoRef     = useRef(null)
  const vboRef     = useRef(null)
  const colorVboRef = useRef(null)
  const countRef   = useRef(0)
  const mvpRef     = useRef(null)
  const selectedIndexRef = useRef(-1)

  const camRef    = useRef({ yaw: 0, pitch: 0 }) // first-person look direction
  const dragRef   = useRef({ active: false, lastX: 0, lastY: 0, moved: false })
  const posRef    = useRef({ x: 0, y: 0, z: 0 }) // camera position
  const centerRef = useRef({ x: 0, y: 0, z: 0 })
  const keysRef   = useRef({})
  const lastTimeRef = useRef(performance.now())

  // GL setup — runs once
  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width  = canvas.clientWidth
    canvas.height = canvas.clientHeight

    const guide = guideRef.current
    const dpr = window.devicePixelRatio || 1
    guide.width  = GUIDE_W * dpr
    guide.height = GUIDE_H * dpr
    const guideCtx = guide.getContext('2d')
    guideCtx.scale(dpr, dpr)

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      console.error('WebGL2 not supported')
      return
    }
    glRef.current = gl

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
    programRef.current = {
      program,
      uMVP: gl.getUniformLocation(program, 'uMVP'),
      uSelectedIndex: gl.getUniformLocation(program, 'uSelectedIndex'),
    }

    const vbo = gl.createBuffer()
    const colorVbo = gl.createBuffer()
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    const posLoc = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo)
    const colorLoc = gl.getAttribLocation(program, 'aColor')
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    vboRef.current = vbo
    colorVboRef.current = colorVbo
    vaoRef.current = vao

    let rafId
    function render() {
      rafId = requestAnimationFrame(render)

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width  = canvas.clientWidth
        canvas.height = canvas.clientHeight
      }
      if (countRef.current === 0) return

      const now = performance.now()
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = now

      const { yaw, pitch } = camRef.current
      const pos = posRef.current
      const keys = keysRef.current
      const moveForward = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0)
      const moveRight   = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0)
      const moveUp      = (keys['e'] ? 1 : 0) - (keys['q'] ? 1 : 0)
      const [fx, fy, fz] = forwardVector(yaw, pitch)
      if (moveForward || moveRight || moveUp) {
        // forward follows the view direction (including pitch), right is horizontal, up is world Y
        const rx = -Math.cos(yaw), rz = Math.sin(yaw)
        const dx = fx * moveForward + rx * moveRight
        const dy = fy * moveForward + moveUp
        const dz = fz * moveForward + rz * moveRight
        const len = Math.hypot(dx, dy, dz)
        const step = MOVE_SPEED * dt / (len > 1 ? len : 1)
        pos.x += dx * step
        pos.y += dy * step
        pos.z += dz * step
        clampPosition(pos, centerRef.current)
      }

      const eye = [pos.x, pos.y, pos.z]
      const aspect = canvas.width / canvas.height
      const mvp = mat4mul(
        perspective(Math.PI / 3, aspect, 0.1, 2000),
        lookAt(eye, [pos.x + fx, pos.y + fy, pos.z + fz], [0, 1, 0])
      )
      mvpRef.current = mvp

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0.05, 0.05, 0.08, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)

      gl.useProgram(programRef.current.program)
      gl.uniformMatrix4fv(programRef.current.uMVP, false, mvp)
      gl.uniform1i(programRef.current.uSelectedIndex, selectedIndexRef.current)
      gl.bindVertexArray(vaoRef.current)
      gl.drawArrays(gl.POINTS, 0, countRef.current)
      gl.bindVertexArray(null)

      if (showGuideRef.current) drawGuide(guideCtx, yaw, pitch, pos)
    }
    render()

    // basic orbit controls — drag to rotate, wheel to zoom
    function onMouseDown(e) {
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false }
    }
    function onMouseMove(e) {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.lastX
      const dy = e.clientY - dragRef.current.lastY
      if (Math.hypot(dx, dy) > 3) dragRef.current.moved = true
      dragRef.current.lastX = e.clientX
      dragRef.current.lastY = e.clientY
      // first-person look: drag right to look right, drag up to look up
      camRef.current.yaw -= dx * LOOK_SPEED
      camRef.current.pitch = Math.max(-1.5, Math.min(1.5, camRef.current.pitch - dy * LOOK_SPEED))
    }
    function onMouseUp() { dragRef.current.active = false }
    function onWheel(e) {
      e.preventDefault()
      // wheel moves the camera along its view direction
      const { yaw, pitch } = camRef.current
      const [fx, fy, fz] = forwardVector(yaw, pitch)
      const pos = posRef.current
      pos.x -= fx * e.deltaY * 0.5
      pos.y -= fy * e.deltaY * 0.5
      pos.z -= fz * e.deltaY * 0.5
      clampPosition(pos, centerRef.current)
    }

    // WASD / arrow-key panning — bound to the canvas itself so it only fires while
    // the canvas is focused (i.e. not while the user is typing elsewhere)
    const MOVE_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']
    function onKeyDown(e) {
      const key = e.key.toLowerCase()
      if (!MOVE_KEYS.includes(key)) return
      e.preventDefault()
      keysRef.current[key] = true
    }
    function onKeyUp(e) {
      const key = e.key.toLowerCase()
      if (!MOVE_KEYS.includes(key)) return
      keysRef.current[key] = false
    }
    function onBlur() { keysRef.current = {} }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('blur', onBlur)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      cancelAnimationFrame(rafId)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('blur', onBlur)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      gl.deleteBuffer(vbo)
      gl.deleteBuffer(colorVbo)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
      glRef.current = null
    }
  }, [])

  // upload point positions whenever the data changes
  useEffect(() => {
    const gl = glRef.current
    if (!gl || !vboRef.current || !points) return

    const positions = new Float32Array(points.length * 3)
    const colors    = new Float32Array(points.length * 3)
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    points.forEach((p, i) => {
      min[0] = Math.min(min[0], p.x); max[0] = Math.max(max[0], p.x)
      min[1] = Math.min(min[1], p.y); max[1] = Math.max(max[1], p.y)
      min[2] = Math.min(min[2], p.z); max[2] = Math.max(max[2], p.z)
      positions[i * 3]     = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      const [r, g, b] = hexToRgb(p.color)
      colors[i * 3]     = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    })

    gl.bindBuffer(gl.ARRAY_BUFFER, vboRef.current)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVboRef.current)
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW)
    countRef.current = points.length

    if (points.length > 0) {
      const center = { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, z: (min[2] + max[2]) / 2 }
      centerRef.current = center
      placeCamera(camRef.current, posRef.current, center)
    }
  }, [points])

  // lets the parent put the camera back at its starting position
  useImperativeHandle(ref, () => ({
    resetCamera() {
      placeCamera(camRef.current, posRef.current, centerRef.current)
    },
  }), [])

  useEffect(() => {
    showGuideRef.current = showGuide
  }, [showGuide])

  // keep the highlighted index in a ref so the render loop can read it without re-subscribing
  useEffect(() => {
    selectedIndexRef.current = selectedIndex ?? -1
  }, [selectedIndex])

  // CPU-side hit test: project every point to screen space, pick the nearest one within a pixel threshold
  function handleClick(e) {
    if (dragRef.current.moved) return
    if (!points || !mvpRef.current) return

    const rect   = canvasRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    let closestIndex = -1
    let closestDist   = 15 // px threshold

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const screen = projectToScreen(mvpRef.current, p.x, p.y, p.z, canvasRef.current.width, canvasRef.current.height)
      if (!screen) continue
      const dist = Math.hypot(screen[0] - clickX, screen[1] - clickY)
      if (dist < closestDist) {
        closestDist   = dist
        closestIndex  = i
      }
    }

    if (closestIndex !== -1) {
      onPointClick?.(points[closestIndex], closestIndex)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onClick={handleClick}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      />
      <canvas
        ref={guideRef}
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          width: GUIDE_W,
          height: GUIDE_H,
          pointerEvents: 'none',
          display: showGuide ? 'block' : 'none',
        }}
      />
    </div>
  )
}
