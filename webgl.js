// WebGL Sphere Visualization
// This code creates an interactive 3D sphere using WebGL, with controls for camera position,
// subdivision level, lighting, and rendering mode (solid/wireframe).

// ---- Initial Setup ----
// Get the WebGL rendering context from our canvas element
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

// Make sure WebGL is available and working
if (!gl) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    throw new Error("WebGL context initialization failed");
}

// Set the background color to light gray and initialize the viewport
gl.clearColor(0.9, 0.9, 0.9, 1.0);
gl.viewport(0, 0, canvas.width, canvas.height);

// ---- Shader Definitions ----
// Vertex shader: Handles vertex positions and lighting calculations
// - aPosition: The 3D position of each vertex
// - aNormal: The normal vector for lighting calculations
// - Various matrices for 3D transformation
const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
   
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;
   
    varying vec3 vNormal;
    varying vec3 vPosition;
   
    void main() {
        // Transform vertex position into view space for lighting calculations
        vec4 viewPosition = uModelViewMatrix * vec4(aPosition, 1.0);
        vPosition = viewPosition.xyz;
        
        // Transform the normal vector for lighting calculations
        vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
        
        // Final position of the vertex in clip space
        gl_Position = uProjectionMatrix * viewPosition;
    }
`;

// Fragment shader: Calculates the final color of each pixel
// Implements basic lighting with ambient and diffuse components
const fragmentShaderSource = `
    precision mediump float;
   
    varying vec3 vNormal;
    varying vec3 vPosition;
   
    uniform vec3 uLightPosition;
    uniform float uLightIntensity;
   
    void main() {
        // Light position in view space
        vec3 lightPos = vec3(2.0, 2.0, 2.0);
        
        // Calculate direction from fragment to light
        vec3 lightDir = normalize(lightPos - vPosition);
        
        // Ambient lighting (constant low-level light)
        float ambient = 0.2;
        
        // Diffuse lighting (directional light based on surface angle)
        float diff = max(dot(normalize(vNormal), lightDir), 0.0);
        
        // Combine lighting components and apply intensity
        float lighting = (ambient + diff * 0.8) * uLightIntensity;
        
        gl_FragColor = vec4(vec3(lighting), 1.0);
    }
`;

// ---- Shader Compilation Functions ----
// Compiles individual shader from source code
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
   
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Creates complete shader program from vertex and fragment shaders
function initShaderProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
   
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        return null;
    }
   
    return program;
}

// Initialize our shader program
const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
if (!shaderProgram) {
    throw new Error("Failed to initialize shader program");
}

// ---- Scene Setup ----
// Initialize transformation matrices and camera parameters
const modelViewMatrix = mat4.create();  // Transform from model to view space
const projectionMatrix = mat4.create(); // Transform from view to clip space
const normalMatrix = mat4.create();     // For transforming normal vectors

// Camera and scene control variables
let radius = 5.0;    // Distance of camera from center
let theta = 0.0;     // Horizontal camera angle
let phi = Math.PI/2; // Vertical camera angle
let isAnimating = true;
let isWireframe = false;  // Toggle between solid and wireframe rendering
let autoRotate = true;    // Auto-rotation of sphere
let rotationAngle = 0;    // Current rotation angle
const lightPosition = [2.0, 2.0, 2.0];  // Position of light source
let rotationMatrix = mat4.create();

// Set up perspective projection
mat4.perspective(projectionMatrix,
    45 * Math.PI / 180, // 45-degree field of view
    canvas.width / canvas.height, // Aspect ratio
    0.1, // Near clipping plane
    100.0 // Far clipping plane
);

// ---- Geometry Generation ----
// Arrays to store vertex positions and normal vectors
let vertices = [];
let normals = [];

// Normalizes a 3D vector
function normalize(v) {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / length, v[1] / length, v[2] / length];
}

// Creates initial icosahedron vertices (20-sided regular polyhedron)
function generateIcosahedron() {
    // Golden ratio components for vertex positioning
    const X = 0.525731112119133606;
    const Z = 0.850650808352039932;
    const N = 0.0;

    const vertices = [
        -X, N, Z,  X, N, Z,  -X, N, -Z,  X, N, -Z,
        N, Z, X,  N, Z, -X,  N, -Z, X,  N, -Z, -X,
        Z, X, N,  -Z, X, N,  Z, -X, N,  -Z, -X, N
    ];

    // Indices defining the triangles of the icosahedron
    const indices = [
        1,4,0,  4,9,0,  4,5,9,  8,5,4,  1,8,4,
        1,10,8, 10,3,8, 8,3,5,  3,2,5,  3,7,2,
        3,10,7, 10,6,7, 6,11,7, 6,0,11, 6,1,0,
        10,1,6, 11,0,9, 2,11,9, 5,2,9,  11,2,7
    ];

    return { vertices, indices };
}

// Recursively subdivides triangles to create a smoother sphere
function subdivideTriangle(v1, v2, v3, depth) {
    if (depth === 0) {
        // Add the triangle vertices to our arrays
        vertices.push(...v1, ...v2, ...v3);
        
        // Calculate and store the normal vector for lighting
        const normal = normalize([
            (v2[1] - v1[1]) * (v3[2] - v1[2]) - (v2[2] - v1[2]) * (v3[1] - v1[1]),
            (v2[2] - v1[2]) * (v3[0] - v1[0]) - (v2[0] - v1[0]) * (v3[2] - v1[2]),
            (v2[0] - v1[0]) * (v3[1] - v1[1]) - (v2[1] - v1[1]) * (v3[0] - v1[0])
        ]);
        normals.push(...normal, ...normal, ...normal);
        return;
    }

    // Calculate midpoints of triangle sides
    const v12 = normalize([(v1[0] + v2[0])/2, (v1[1] + v2[1])/2, (v1[2] + v2[2])/2]);
    const v23 = normalize([(v2[0] + v3[0])/2, (v2[1] + v3[1])/2, (v2[2] + v3[2])/2]);
    const v31 = normalize([(v3[0] + v1[0])/2, (v3[1] + v1[1])/2, (v3[2] + v1[2])/2]);

    // Recursively subdivide the four new triangles
    subdivideTriangle(v1, v12, v31, depth - 1);
    subdivideTriangle(v2, v23, v12, depth - 1);
    subdivideTriangle(v3, v31, v23, depth - 1);
    subdivideTriangle(v12, v23, v31, depth - 1);
}

// Generates sphere geometry by subdividing an icosahedron
function generateSphere(subdivisionLevel) {
    vertices = [];
    normals = [];
    
    const icosa = generateIcosahedron();
    
    // Process each triangle of the icosahedron
    for (let i = 0; i < icosa.indices.length; i += 3) {
        const v1 = [
            icosa.vertices[icosa.indices[i] * 3],
            icosa.vertices[icosa.indices[i] * 3 + 1],
            icosa.vertices[icosa.indices[i] * 3 + 2]
        ];
        const v2 = [
            icosa.vertices[icosa.indices[i + 1] * 3],
            icosa.vertices[icosa.indices[i + 1] * 3 + 1],
            icosa.vertices[icosa.indices[i + 1] * 3 + 2]
        ];
        const v3 = [
            icosa.vertices[icosa.indices[i + 2] * 3],
            icosa.vertices[icosa.indices[i + 2] * 3 + 1],
            icosa.vertices[icosa.indices[i + 2] * 3 + 2]
        ];
        
        subdivideTriangle(v1, v2, v3, subdivisionLevel);
    }
    
    return { vertices: new Float32Array(vertices), normals: new Float32Array(normals) };
}

// Create initial sphere geometry
const sphereData = generateSphere(3);

// ---- Buffer Setup ----
// Create and populate vertex position buffer
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, sphereData.vertices, gl.STATIC_DRAW);

// Create and populate vertex normal buffer
const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, sphereData.normals, gl.STATIC_DRAW);

// Get shader attribute and uniform locations for later use
const positionAttribLocation = gl.getAttribLocation(shaderProgram, 'aPosition');
const normalAttribLocation = gl.getAttribLocation(shaderProgram, 'aNormal');
const modelViewMatrixLocation = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
const projectionMatrixLocation = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
const normalMatrixLocation = gl.getUniformLocation(shaderProgram, 'uNormalMatrix');
const lightIntensityLocation = gl.getUniformLocation(shaderProgram, 'uLightIntensity');

// Set default light intensity
let lightIntensity = 0.8;

// ---- Camera Functions ----
// Updates camera position based on spherical coordinates
function updateCameraPosition() {
    const eye = [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
    ];
   
    mat4.lookAt(
        modelViewMatrix,
        eye,        // Camera position
        [0, 0, 0],  // Look at center
        [0, 1, 0]   // Up vector
    );

    // Update normal matrix for lighting calculations
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
}

// ---- Event Listeners ----
// Camera distance control
document.getElementById("radiusSlider").addEventListener("input", (e) => {
    radius = parseFloat(e.target.value);
});

// Horizontal camera angle control
document.getElementById("thetaSlider").addEventListener("input", (e) => {
    theta = parseFloat(e.target.value);
});

// Vertical camera angle control
document.getElementById("phiSlider").addEventListener("input", (e) => {
    phi = parseFloat(e.target.value);
});

// Sphere detail level control
document.getElementById("subdivisionSlider").addEventListener("input", (e) => {
    currentSubdivisionLevel = parseInt(e.target.value);
    const sphereData = generateSphere(currentSubdivisionLevel);
    
    // Update geometry buffers with new sphere data
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereData.vertices, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereData.normals, gl.STATIC_DRAW);
});

// Light intensity control
document.getElementById("lightIntensitySlider").addEventListener("input", (e) => {
    lightIntensity = parseFloat(e.target.value);
});

// Toggle between solid and wireframe rendering
document.getElementById("toggleWireframeBtn").addEventListener("click", () => {
    isWireframe = !isWireframe;
});

// Toggle auto-rotation
document.getElementById("toggleRotationBtn").addEventListener("click", () => {
    autoRotate = !autoRotate;
});
// ---- Render Function ----
function render() {
    if (!isAnimating) return;
   
    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateCameraPosition();
   
    // Activate our shader program
    gl.useProgram(shaderProgram);

    // Set up vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.vertexAttribPointer(positionAttribLocation, 3, gl.FLOAT, false, 0, 0);
   
    // Set up vertex normals
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.enableVertexAttribArray(normalAttribLocation);
    gl.vertexAttribPointer(normalAttribLocation, 3, gl.FLOAT, false, 0, 0);
   
    // Handle auto-rotation if enabled
    let finalModelViewMatrix = mat4.create();
    if (autoRotate) {
        rotationAngle += 0.01;  // Increment rotation angle
        mat4.rotateY(rotationMatrix, mat4.create(), rotationAngle);
        mat4.multiply(finalModelViewMatrix, modelViewMatrix, rotationMatrix);
    } else {
        mat4.copy(finalModelViewMatrix, modelViewMatrix);
    }
   
    // Update normal matrix to account for rotation
    mat4.invert(normalMatrix, finalModelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
   
    // Send matrices and lighting data to shader
    gl.uniformMatrix4fv(modelViewMatrixLocation, false, finalModelViewMatrix);
    gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
    gl.uniform1f(lightIntensityLocation, lightIntensity);
    gl.uniform3fv(gl.getUniformLocation(shaderProgram, 'uLightPosition'), lightPosition);
   
    // Draw the sphere
    if (isWireframe) {
        // Draw in wireframe mode - each triangle as a line loop
        for (let i = 0; i < vertices.length / 9; i++) {
            gl.drawArrays(gl.LINE_LOOP, i * 3, 3);
        }
    } else {
        // Draw in solid mode - all triangles filled
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
    }
   
    // Schedule next frame
    requestAnimationFrame(render);
}

// ---- Final Setup ----
// Enable depth testing to handle 3D rendering correctly
gl.enable(gl.DEPTH_TEST);

// Start the render loop
render();