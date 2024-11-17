// Get the WebGL context
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

// Basic error checking - essential first step in WebGL
if (!gl) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    throw new Error("WebGL context initialization failed");
}

// Initial clear color (light gray background to see if it's working)
gl.clearColor(0.9, 0.9, 0.9, 1.0);

// Basic viewport setup matching canvas size
gl.viewport(0, 0, canvas.width, canvas.height);

// Console log to verify initialization
console.log("WebGL initialized successfully");

// Vertex shader for handling positions and normals
const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
   
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;
   
    varying vec3 vNormal;
   
    void main() {
        vNormal = (uNormalMatrix * vec4(aNormal, 0.0)).xyz;
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    }
`;

// Fragment shader with basic color output for now
const fragmentShaderSource = `
    precision mediump float;
    varying vec3 vNormal;
   
    void main() {
        vec3 normal = normalize(vNormal);
        vec3 light = vec3(0.0, 0.0, 1.0);
        float intensity = max(dot(normal, light), 0.0);
        gl_FragColor = vec4(vec3(intensity), 1.0);
    }
`;

// Shader compilation utility
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

// Program creation utility
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

// Initialize shader program
const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

// Add after shader program initialization
if (!shaderProgram) {
    throw new Error("Failed to initialize shader program");
}

// Basic matrices for 3D visualization
const modelViewMatrix = mat4.create();
const projectionMatrix = mat4.create();
const normalMatrix = mat4.create();

// Add these camera control variables
let radius = 5.0;    // Distance from camera to origin
let theta = 0.0;     // Horizontal rotation angle
let phi = Math.PI/2; // Vertical rotation angle
let isAnimating = true;

// Set up projection matrix
mat4.perspective(projectionMatrix,
    45 * Math.PI / 180, // 45 degree field of view
    canvas.width / canvas.height,
    0.1,
    100.0
);

// Initialize arrays for vertices and normals
let vertices = [];
let normals = [];

// Function to normalize a vec3
function normalize(v) {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / length, v[1] / length, v[2] / length];
}

// Function to generate initial icosahedron vertices
function generateIcosahedron() {
    const X = 0.525731112119133606;
    const Z = 0.850650808352039932;
    const N = 0.0;

    const vertices = [
        -X, N, Z,  X, N, Z,  -X, N, -Z,  X, N, -Z,
        N, Z, X,  N, Z, -X,  N, -Z, X,  N, -Z, -X,
        Z, X, N,  -Z, X, N,  Z, -X, N,  -Z, -X, N
    ];

    const indices = [
        1,4,0,  4,9,0,  4,5,9,  8,5,4,  1,8,4,
        1,10,8, 10,3,8, 8,3,5,  3,2,5,  3,7,2,
        3,10,7, 10,6,7, 6,11,7, 6,0,11, 6,1,0,
        10,1,6, 11,0,9, 2,11,9, 5,2,9,  11,2,7
    ];

    return { vertices, indices };
}

// Function to subdivide triangles
function subdivideTriangle(v1, v2, v3, depth) {
    if (depth === 0) {
        // Add triangle vertices and calculate normal
        vertices.push(...v1, ...v2, ...v3);
        const normal = normalize([
            (v2[1] - v1[1]) * (v3[2] - v1[2]) - (v2[2] - v1[2]) * (v3[1] - v1[1]),
            (v2[2] - v1[2]) * (v3[0] - v1[0]) - (v2[0] - v1[0]) * (v3[2] - v1[2]),
            (v2[0] - v1[0]) * (v3[1] - v1[1]) - (v2[1] - v1[1]) * (v3[0] - v1[0])
        ]);
        normals.push(...normal, ...normal, ...normal);
        return;
    }

    // Calculate midpoints
    const v12 = normalize([(v1[0] + v2[0])/2, (v1[1] + v2[1])/2, (v1[2] + v2[2])/2]);
    const v23 = normalize([(v2[0] + v3[0])/2, (v2[1] + v3[1])/2, (v2[2] + v3[2])/2]);
    const v31 = normalize([(v3[0] + v1[0])/2, (v3[1] + v1[1])/2, (v3[2] + v1[2])/2]);

    // Recursively subdivide
    subdivideTriangle(v1, v12, v31, depth - 1);
    subdivideTriangle(v2, v23, v12, depth - 1);
    subdivideTriangle(v3, v31, v23, depth - 1);
    subdivideTriangle(v12, v23, v31, depth - 1);
}

// Generate sphere geometry
function generateSphere(subdivisionLevel) {
    vertices = [];
    normals = [];
    
    const icosa = generateIcosahedron();
    
    // Process each triangle in the icosahedron
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

// Create sphere geometry with subdivision level 3
const sphereData = generateSphere(3);

// Create and bind vertex buffer
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, sphereData.vertices, gl.STATIC_DRAW);

// Create and bind normal buffer
const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, sphereData.normals, gl.STATIC_DRAW);

// Get attribute locations
const positionAttribLocation = gl.getAttribLocation(shaderProgram, 'aPosition');
const normalAttribLocation = gl.getAttribLocation(shaderProgram, 'aNormal');

// Get uniform locations
const modelViewMatrixLocation = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
const projectionMatrixLocation = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
const normalMatrixLocation = gl.getUniformLocation(shaderProgram, 'uNormalMatrix');

console.log("Shader program and matrices initialized");

// Add camera update function
function updateCameraPosition() {
    const eye = [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
    ];
   
    mat4.lookAt(
        modelViewMatrix,
        eye,              // Camera position
        [0, 0, 0],       // Look at point (origin)
        [0, 1, 0]        // Up vector
    );
    
    // Update normal matrix
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
}

// Event listeners
document.getElementById("radiusSlider").addEventListener("input", (e) => {
    radius = parseFloat(e.target.value);
});

document.getElementById("thetaSlider").addEventListener("input", (e) => {
    theta = parseFloat(e.target.value);
});

document.getElementById("phiSlider").addEventListener("input", (e) => {
    phi = parseFloat(e.target.value);
});

document.getElementById("subdivisionSlider").addEventListener("input", (e) => {
    currentSubdivisionLevel = parseInt(e.target.value);
    const sphereData = generateSphere(currentSubdivisionLevel);
    
    // Update vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereData.vertices, gl.STATIC_DRAW);
    
    // Update normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereData.normals, gl.STATIC_DRAW);
});

// Add render function
function render() {
    if (!isAnimating) return;
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateCameraPosition();
    
    // Use our shader program
    gl.useProgram(shaderProgram);

    // Set up position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.vertexAttribPointer(positionAttribLocation, 3, gl.FLOAT, false, 0, 0);
    
    // Set up normal attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.enableVertexAttribArray(normalAttribLocation);
    gl.vertexAttribPointer(normalAttribLocation, 3, gl.FLOAT, false, 0, 0);
    
    // Update uniforms
    gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);
    gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
    
    // Draw the sphere
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
    
    requestAnimationFrame(render);
}

// Enable depth testing
gl.enable(gl.DEPTH_TEST);

// Start render loop
render();