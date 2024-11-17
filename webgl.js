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
gl.clear(gl.COLOR_BUFFER_BIT);

// Basic viewport setup matching canvas size
gl.viewport(0, 0, canvas.width, canvas.height);

// Console log to verify initialization
console.log("WebGL initialized successfully");

// Vertex shader for handling positions and normals
const vertexShaderSource = `
    attribute vec3 aPosition;
   
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
   
    void main() {
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    }
`;

// Fragment shader with basic color output for now
const fragmentShaderSource = `
    precision mediump float;
   
    void main() {
        gl_FragColor = vec4(0.7, 0.7, 0.7, 1.0);
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

// Add render function
function render() {
    if (!isAnimating) return;
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateCameraPosition();
    
    requestAnimationFrame(render);
}

// Enable depth testing
gl.enable(gl.DEPTH_TEST);

// Start render loop
render();