# VizModule — Full Reference

`src/vizmodule.jsx` is a pure **WebGL2 renderer** — it displays points and edges in 3D space and handles camera input. It has no knowledge of the domain data (papers, citations, etc.). All scene data is supplied via props and produced by `src/data/dataAdapter.js`.

No Three.js, no canvas 2D — only `getContext('webgl2')` and GLSL 3.0 ES shaders.

---

## Component API

```jsx
import VizModule from './vizmodule';

<VizModule style={{ width: '800px', height: '600px' }} />
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `style` | `React.CSSProperties` | `undefined` | Extra styles merged onto the outer wrapper `<div>`. Use this to size the component. |

The component fills `100%` width and height of its parent container. Always give the parent (or pass `style`) an explicit size.

---

## Controls

| Input | Action |
|---|---|
| Left-click drag | Orbit (rotate) around the scene centre |
| Scroll wheel | Zoom in / out |
| Single-finger drag (touch) | Orbit |
| Two-finger pinch (touch) | Zoom |

---

## Internal Architecture

The entire WebGL2 lifecycle runs inside a single `useEffect`. On mount it:

1. Acquires a WebGL2 context from the `<canvas>`.
2. Generates the scene (points + edges).
3. Compiles and links two GLSL shader programs.
4. Uploads geometry to the GPU (VBO + EBO).
5. Creates two VAOs that share the same VBO.
6. Registers input event listeners.
7. Starts a `requestAnimationFrame` render loop.

On unmount the cleanup function cancels the loop, removes listeners, and frees all GPU resources.

---

## Functions

### `makePRNG(seed) → () => number`

Creates a seeded pseudo-random number generator using the **Mulberry32** algorithm.

- `seed` — 32-bit integer seed.
- Returns a zero-argument function that produces a new `[0, 1)` float on each call.

Used so the scene is **deterministic** — the same 100 points and edges are generated on every render.

---

### `generateScene() → { points, edges }`

Builds the scene data on the CPU.

**Points** — 100 objects, each `{ x, y, z, r, g, b }`:
- 8 random cluster centres are placed in a `[-3, 3]³` volume.
- Each point is assigned a random cluster centre and offset by up to `±1.5` in each axis, creating a loosely clustered distribution.
- `r`, `g`, `b` are random colours (biased towards blues/cyans).

**Edges** — undirected pairs `[i, j]`:
- For each point the 3 nearest neighbours (by Euclidean distance) are found.
- Duplicate pairs are eliminated via a `Set`.
- Result: ~200 unique edges.

---

### `mat4Perspective(fovY, aspect, near, far) → Float32Array(16)`

Returns a column-major 4×4 perspective projection matrix.

| Parameter | Description |
|---|---|
| `fovY` | Vertical field of view in radians (component uses `π/4` = 45°) |
| `aspect` | `canvas.width / canvas.height` |
| `near` | Near clip plane (`0.1`) |
| `far` | Far clip plane (`200`) |

---

### `mat4LookAt(ex,ey,ez, cx,cy,cz, ux,uy,uz) → Float32Array(16)`

Returns a column-major 4×4 view matrix (camera transform).

| Parameters | Description |
|---|---|
| `ex,ey,ez` | Eye (camera) position |
| `cx,cy,cz` | Look-at target (scene origin `[0,0,0]`) |
| `ux,uy,uz` | World up vector (`[0,1,0]`) |

Builds orthonormal basis vectors (right, up-corrected, forward) and encodes translation in column 3.

---

### `mat4Multiply(a, b) → Float32Array(16)`

Standard column-major 4×4 matrix multiplication. Used once per frame to compute `MVP = Projection × View`.

---

### `compileShader(gl, type, src) → WebGLShader`

Compiles a GLSL shader. Throws a descriptive `Error` (including the failing source) if compilation fails.

| Parameter | Description |
|---|---|
| `gl` | WebGL2 rendering context |
| `type` | `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER` |
| `src` | GLSL source string |

---

### `createProgram(gl, vsSrc, fsSrc) → WebGLProgram`

Compiles and links a full shader program from vertex + fragment source strings. Throws on link failure.

---

## Shaders

### Vertex shader (`VS`) — shared by both programs

```glsl
#version 300 es
uniform mat4 uMVP;        // Combined model-view-projection matrix
uniform float uPointSize; // gl_PointSize (only meaningful for POINTS draw calls)
in vec3 aPos;             // Vertex position (world space)
in vec3 aCol;             // Vertex colour (RGB)
out vec3 vCol;            // Passed to fragment shader
```

Transforms each vertex by `uMVP` and forwards the colour to the fragment stage.

---

### Point fragment shader (`FS_POINT`)

Renders each point as a **soft glowing circle** using `gl_PointCoord`:

1. Computes squared radius `r = dot(coord - 0.5, coord - 0.5)`.
2. Discards fragments outside the unit circle (`r > 0.25`).
3. Computes a bright `core` highlight (centre) and a wider `glow` falloff.
4. Blends white into the point colour at the centre for a highlight effect.

---

### Line fragment shader (`FS_LINE`)

Outputs the interpolated vertex colour at 45% opacity (`alpha = 0.45`), slightly darkened — so edges are visible but do not overpower the points.

---

## GPU Buffer Layout

### Vertex Buffer Object (VBO)

One buffer shared by both draw calls. Stride = **24 bytes** (6 × `float32`).

| Offset | Size | Attribute |
|---|---|---|
| 0 | 12 bytes | `aPos` — `vec3` position |
| 12 | 12 bytes | `aCol` — `vec3` colour |

### Element Buffer Object (EBO)

Flat array of `Uint16` index pairs — one pair per edge: `[i₀, j₀, i₁, j₁, …]`.
Used by `gl.drawElements(gl.LINES, …)`.

### Vertex Array Objects (VAOs)

Two VAOs (`pointVAO`, `lineVAO`) both bind the same VBO with identical attribute pointers. `lineVAO` additionally binds the EBO so the indexed draw call works correctly.

---

## Camera Model

Orbit camera using **spherical coordinates** centred on the origin.

| Variable | Meaning | Default |
|---|---|---|
| `theta` | Azimuth angle (radians, horizontal orbit) | `0.6` |
| `phi` | Elevation angle (radians, vertical orbit) | `0.25` |
| `radius` | Distance from target | `14` |

Eye position is computed each frame:
```
eye.x = radius × cos(phi) × sin(theta)
eye.y = radius × sin(phi)
eye.z = radius × cos(phi) × cos(theta)
```

`phi` is clamped to `(-1.48, 1.48)` — just short of ±π/2 — to prevent gimbal lock at the poles.

---

## Render Loop

Called every frame via `requestAnimationFrame`:

1. Clear colour (`#0a0a1a`) and depth buffers.
2. Enable depth testing and alpha blending (`SRC_ALPHA / ONE_MINUS_SRC_ALPHA`).
3. Recompute `eye` from spherical coords → build `view` and `proj` matrices → multiply into `mvp`.
4. **Lines first** (with `lineVAO` + `gl.drawElements`) so points render on top.
5. **Points second** (with `pointVAO` + `gl.drawArrays`).

---

## Resource Cleanup

The `useEffect` return function frees everything when the component unmounts:

- `cancelAnimationFrame` — stops the render loop.
- `ResizeObserver.disconnect()` — stops canvas resize tracking.
- All DOM event listeners removed from `canvas` and `window`.
- `gl.deleteBuffer`, `gl.deleteVertexArray`, `gl.deleteProgram` — releases GPU memory.
