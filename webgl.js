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