/** Small, local WebGL2 renderer for the supplied single-mesh GLB.
 * No remote scripts or runtime assets are used. Preserves glTF UV orientation.
 */
interface Accessor { bufferView: number; byteOffset?: number; count: number; componentType: number; type: string }
interface BufferView { byteOffset?: number; byteLength: number; byteStride?: number }
interface Gltf {
  accessors: Accessor[];
  bufferViews: BufferView[];
  images: { bufferView: number; mimeType: string }[];
  meshes: { primitives: { attributes: { POSITION: number; NORMAL: number; TEXCOORD_0: number }; indices: number }[] }[];
}
type Matrix = Float32Array;
function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  }
  return out;
}
function rotation(x: number, y: number): Matrix {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
  const rx = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
  const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
  return multiply(rx, ry);
}
function perspective(aspect: number): Matrix {
  const f = 1 / Math.tan(Math.PI / 8), near = .1, far = 50;
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}
function view(distance: number): Matrix {
  // Camera at (0, 0, distance); model tilts to reveal the printed top surfaces.
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, .04, -distance, 1]);
}
function accessorData(gltf: Gltf, binary: ArrayBuffer, index: number): Float32Array {
  const acc = gltf.accessors[index], bv = gltf.bufferViews[acc.bufferView];
  if (acc.componentType !== 5126) throw new Error('Unsupported vertex data');
  const count = { VEC2: 2, VEC3: 3 }[acc.type];
  if (!count) throw new Error('Unsupported vertex shape');
  const data = new DataView(binary), out = new Float32Array(acc.count * count);
  for (let v = 0; v < acc.count; v++) for (let c = 0; c < count; c++) {
    out[v * count + c] = data.getFloat32((bv.byteOffset ?? 0) + (acc.byteOffset ?? 0) + v * (bv.byteStride ?? count * 4) + c * 4, true);
  }
  return out;
}
const vertexSource = `#version 300 es
  in vec3 aPosition;
  in vec3 aNormal;
  in vec2 aUv;
  uniform mat4 uMvp;
  uniform mat4 uModel;
  out vec2 vUv;
  out vec3 vNormal;
  void main() {
    vUv = aUv;
    vNormal = mat3(uModel) * aNormal;
    gl_Position = uMvp * vec4(aPosition, 1.0);
  }`;
const fragmentSource = `#version 300 es
  precision highp float;
  in vec2 vUv;
  in vec3 vNormal;
  uniform sampler2D uTexture;
  out vec4 fragColor;
  void main() {
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float key = max(dot(n, normalize(vec3(-0.4, 0.7, 0.8))), 0.0);
    float fill = max(dot(n, normalize(vec3(0.8, 0.3, 0.4))), 0.0);
    vec3 color = texture(uTexture, vUv).rgb;
    // Decode sRGB before lighting, then encode it for canvas presentation.
    vec3 linearColor = pow(color, vec3(2.2));
    vec3 lit = linearColor * (0.62 + 0.56 * key + 0.16 * fill);
    fragColor = vec4(pow(lit, vec3(1.0 / 2.2)), 1.0);
  }`;

function shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const result = gl.createShader(type);
  if (!result) throw new Error('Shader unavailable');
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result) ?? 'Shader error');
  return result;
}

export async function mountBook(container: HTMLElement, resetButton: HTMLButtonElement) {
  const status = container.querySelector<HTMLElement>('#model-status')!;
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '3D kitap. Döndürmek için sürükleyin veya ok tuşlarını kullanın. Yakınlaştırmak için artı ve eksi tuşlarını kullanın.');
  let observer: ResizeObserver | undefined;
  const resources: { gl?: WebGL2RenderingContext; vao?: WebGLVertexArrayObject; buffers: WebGLBuffer[]; texture?: WebGLTexture; program?: WebGLProgram } = { buffers: [] };
  const cleanup = () => {
    observer?.disconnect();
    const gl = resources.gl;
    if (!gl) return;
    resources.buffers.forEach(buffer => gl.deleteBuffer(buffer));
    if (resources.vao) gl.deleteVertexArray(resources.vao);
    if (resources.texture) gl.deleteTexture(resources.texture);
    if (resources.program) gl.deleteProgram(resources.program);
  };
  const fallback = () => {
    cleanup();
    canvas.remove();
    resetButton.disabled = true;
    if (!container.querySelector('.model-fallback')) {
      const image = document.createElement('img');
      image.src = '/models/book-pages-tr.webp';
      image.alt = 'Kitabın Türkçe sayfaları. Sayfaları oku düğmesiyle büyütebilirsiniz.';
      image.className = 'model-fallback';
      container.append(image);
    }
    status.hidden = false;
    status.style.top = '76%';
    status.textContent = '3D görünüm açılamadı. Türkçe sayfaları okuyabilirsiniz.';
    container.dataset.state = 'fallback';
  };
  try {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    resources.gl = gl;
    const response = await fetch('/models/book-tr.glb', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
    const bytes = await response.arrayBuffer(), header = new DataView(bytes);
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) throw new Error('Invalid GLB');
    const jsonLength = header.getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength))) as Gltf;
    const binary = bytes.slice(28 + jsonLength);
    const primitive = gltf.meshes[0].primitives[0];
    const positions = accessorData(gltf, binary, primitive.attributes.POSITION);
    const normals = accessorData(gltf, binary, primitive.attributes.NORMAL);
    const uv = accessorData(gltf, binary, primitive.attributes.TEXCOORD_0);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], positions[i]); max[axis] = Math.max(max[axis], positions[i]); }
    const scale = 3.45 / Math.max(...max.map((value, i) => value - min[i]));
    for (let i = 0; i < positions.length; i++) positions[i] = (positions[i] - (max[i % 3] + min[i % 3]) / 2) * scale;
    const acc = gltf.accessors[primitive.indices], indexView = gltf.bufferViews[acc.bufferView];
    if (acc.componentType !== 5125) throw new Error('Unsupported indices');
    const indices = new Uint32Array(binary, (indexView.byteOffset ?? 0) + (acc.byteOffset ?? 0), acc.count);
    const imageView = gltf.bufferViews[gltf.images[0].bufferView], imageStart = imageView.byteOffset ?? 0;
    const bitmap = await createImageBitmap(new Blob([binary.slice(imageStart, imageStart + imageView.byteLength)], { type: 'image/png' }), { colorSpaceConversion: 'none', imageOrientation: 'none' });
    const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource), fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL program unavailable');
    resources.program = program;
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
    gl.useProgram(program);
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Vertex array unavailable');
    resources.vao = vao;
    gl.bindVertexArray(vao);
    for (const [name, data, components] of [['aPosition', positions, 3], ['aNormal', normals, 3], ['aUv', uv, 2]] as const) {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error('Buffer unavailable');
      resources.buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
    }
    const indexBuffer = gl.createBuffer();
    if (!indexBuffer) throw new Error('Index buffer unavailable');
    resources.buffers.push(indexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    const texture = gl.createTexture();
    if (!texture) throw new Error('Texture unavailable');
    resources.texture = texture;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    bitmap.close();
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropic) gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture'), 0);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const mvpLocation = gl.getUniformLocation(program, 'uMvp'), modelLocation = gl.getUniformLocation(program, 'uModel');
    const initial = { x: .98, y: Math.PI - .24, distance: 4.15 };
    let angleX = initial.x, angleY = initial.y, distance = initial.distance;
    let interacted = false;
    const draw = () => {
      if (container.dataset.state !== 'ready') return;
      const bounds = container.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * dpr)), height = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program); gl.bindVertexArray(vao);
      const model = rotation(angleX, angleY);
      const narrowDistance = bounds.width / bounds.height < 1.1 ? distance * 1.18 : distance;
      gl.uniformMatrix4fv(modelLocation, false, model);
      gl.uniformMatrix4fv(mvpLocation, false, multiply(multiply(perspective(width / height), view(narrowDistance)), model));
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    };
    const zoom = (factor: number) => { distance = Math.max(3.4, Math.min(9.5, distance * factor)); draw(); };
    const pointers = new Map<number, { x: number; y: number }>();
    canvas.addEventListener('pointerdown', event => {
      interacted = true;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      const old = pointers.get(event.pointerId);
      if (!old) return;
      if (pointers.size === 2) {
        const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1];
        const before = Math.hypot(old.x - other.x, old.y - other.y), after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before > 0 && after > 0) zoom(before / after);
      } else {
        angleY += (event.clientX - old.x) * .009;
        angleX = Math.max(-1.2, Math.min(2.2, angleX + (event.clientY - old.y) * .009));
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      draw();
    });
    const release = (event: PointerEvent) => pointers.delete(event.pointerId);
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('wheel', event => { interacted = true; event.preventDefault(); zoom(Math.exp(event.deltaY * .001)); }, { passive: false });
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(event.key)) return;
      interacted = true;
      event.preventDefault();
      if (event.key === 'ArrowLeft') angleY -= .1;
      if (event.key === 'ArrowRight') angleY += .1;
      if (event.key === 'ArrowUp') angleX = Math.max(-1.2, angleX - .1);
      if (event.key === 'ArrowDown') angleX = Math.min(2.2, angleX + .1);
      if (['+', '='].includes(event.key)) zoom(.9);
      if (event.key === '-') zoom(1.1);
      if (event.key === '0') resetButton.click();
      draw();
    });
    resetButton.addEventListener('click', () => { interacted = true; angleX = initial.x; angleY = initial.y; distance = initial.distance; draw(); });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
    container.append(canvas);
    container.dataset.state = 'ready';
    status.hidden = true;
    resetButton.disabled = false;
    observer = new ResizeObserver(draw);
    observer.observe(container);
    draw();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const start = performance.now();
      const intro = (now: number) => {
        if (interacted || container.dataset.state !== 'ready') return;
        const progress = Math.min(1, (now - start) / 850);
        angleY = initial.y - .18 * (1 - progress) ** 3;
        draw();
        if (progress < 1) requestAnimationFrame(intro);
      };
      requestAnimationFrame(intro);
    }
    window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); });
  } catch (error) {
    console.error('Book viewer:', error);
    fallback();
  }
}
