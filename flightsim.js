// Authors: Beau Taylor-Ladd, Nam Tran, Alvin Zheng, Cade Curry 
// 2019

var gl;
var colors = [];
var vertices = [];
var indices = [];

// A variable to make sure we don't re-load chunks we've already loaded
var currentChunks;

// Maps that store the vertices, colors and relative indices of chunks we have
// generated so far
var chunkVerts = [];
var chunkColors = [];
var chunkIndices = [];

// Verts, colors and indices for our moving skybox
var skyVerts = [];
var skyColors = [];
var skyIndices = [];

// The size of a chunk
const CHUNKSIZE = 24;

// pitch, yaw, roll
var theta = [0, -0, 0];

// x, z, y
var cameraPos = [0, 2.0, 0];
var speed = 0.00;

// Bounds for flight
const MAX_HEIGHT = 20.0;
const MIN_HEIGHT = 2.0;

// The cutoff values for our terrain coloring.  It goes:
// Color 1 from [0] to [1], a mix from [1] to [2], Color 2 from [2] to [3],
// a mix from [3] to [4], and Color 4 above [5].
const terrainVals = [0.2, 0.3, 0.4, 0.7, 1.0];
// Color 1, 2 and 3
const terrainColors = [vec3(17/255.0, 124/255.0, 19/255.0), vec3(87/255.0, 59/255.0, 12/255.0), vec3(240/255.0, 240/255.0, 240/255.0)];

// The level at which we choose to render water
const waterLevel = 0.2;
const waterColor = vec3(0, 119/255.0, 190/255.0);

const skyColor = vec3(135/255.0, 206/255.0, 250/255.0);
const fogColor = vec4(0.8, 0.9, 1, 1);

var fogDensity = 0.07;

var theta_loc;
var shift_loc;
var fogColor_loc;
var fogDensity_loc;

var color_buffer;
var vertex_buffer;
var index_buffer;

// What keys we have pressed for smooth, multi-key inputs
var keys = [];

// flags
var wireframe = false;
var flatShading = false;

const seed = Math.random();
var fudgeLocation;
var fudgeFactor = 1;
var skyBoxSize = 24;

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }
    gl.getExtension("OES_element_index_uint");

    // Setup perlin noise
    noise.seed(seed);
    document.getElementById("seed").innerHTML = ("Seed: " + seed).substring(0, 16);

    //  Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);

    // Generate our terrain data at the spawn location (0,0)
    updateTerrain(0, 0);
  
    //varried terain menu support
    var terrainMenu = document.getElementById("Selection Menu");
    terrainMenu.onclick = function(event) {
        switch (event.target.index) {
        case 0:
            //smooth shading
            wireframe = false;
            flatShading = false;
            break;
        case 1:
            //flat shading
            wireframe = false;
            flatShading = true;
            break;
        case 2:
            //wireframe
            flatShading = false;
            wireframe = true;
            break;
        }
    };
    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Load the data into the GPU
    vertex_buffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vertex_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW );

    // Associate out shader variables with our data buffer
    var aPosition = gl.getAttribLocation( program, "aPosition" );
    gl.vertexAttribPointer( aPosition, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( aPosition );

    // Load the colors into the GPU
    color_buffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, color_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
    // Associate out shader variables with our data buffer
    var aColor = gl.getAttribLocation( program, "aColor" );
    gl.vertexAttribPointer( aColor, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( aColor );

    fudgeLocation = gl.getUniformLocation(program, "u_fudgeFactor");

    // Load the indices into the GPU
    index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer );
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices),
        gl.STATIC_DRAW);

    // Connect our uniform variables to our program
    theta_loc = gl.getUniformLocation(program, "theta");
    shift_loc = gl.getUniformLocation(program, "shift");

    fogColor_loc = gl.getUniformLocation(program, "fogColor");
    fogDensity_loc = gl.getUniformLocation(program, "fogDensity");

    document.getElementById("viewDistance").oninput = function() {
        skyBoxSize = (this.value) / 100.0 * 24.0;
    }

    document.getElementById("fudgeFactor").oninput = function() {
        fudgeFactor = (this.value) / 100.0 * 2;
    }

    document.getElementById("fogDensity").oninput = function() {
        fogDensity = this.value
    }

    render();
};

function getUserInput() {
    document.addEventListener('keydown', function(e){
        keys[e.keyCode] = true;
    });

    document.addEventListener('keyup', function(e) {
        delete keys[e.keyCode];
    });

    // Handles all keypress controls

    if (keys[87]) { // W key
        speed += 0.005;
    }
    if (keys[83]) { // S key
        speed -= 0.005;
        speed = (speed < 0) ? 0 : speed;
    }
    if (keys[65]) { // A key
        theta[1] += 1;
        if (theta[1] > 360) theta[1] = 0;
        if (theta[1] < 0) theta[1] = 360;
    }
    if (keys[68]) { // D key
        theta[1] -= 1;
        if (theta[1] > 360) theta[1] = 0;
        if (theta[1] < 0) theta[1] = 360;
    }
    if (keys[37]) { // LeftArrow key
        theta[2] -= 1;
        theta[2] %= 360;
    }
    if (keys[39]) { // RightArrow key
        theta[2] += 1;
        theta[2] %= 360;
    }
    if (keys[38]) { // UpArrow key
        theta[0] += 1;
        theta[0] %= 360;
    }
    if (keys[40]) { // DownArrow key
        theta[0] -= 1;
        theta[0] %= 360;
    }
}

// A helper function that just re-binds buffers with our updated array values
function bindBuffers() {
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, index_buffer );
    const inputIndices = skyIndices.concat(indices);
    gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(inputIndices),
        gl.STATIC_DRAW );

    gl.bindBuffer( gl.ARRAY_BUFFER, color_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors.concat(skyColors)), 
        gl.STATIC_DRAW );

    gl.bindBuffer( gl.ARRAY_BUFFER, vertex_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices.concat(skyVerts)), 
        gl.STATIC_DRAW );
}

function updatePosition() {
    // Get the vector we are looking at so we have an accurate representation
    // of the x,y, and z values we should be changing
    var x = Math.cos(-theta[1] * Math.PI / 180) *
                Math.cos( theta[0] * Math.PI / 180); // Adjusts x and y 
    var y = Math.sin(-theta[1] * Math.PI / 180) *    // to be slower for non-
                Math.cos( theta[0] * Math.PI / 180); // horizontal directions
    var z = Math.sin( theta[0] * Math.PI / 180);

    cameraPos[2] += speed*x;
    cameraPos[1] += speed*z;
    cameraPos[0] += speed*y;

    // Checks whether plane is within z-bounds of flight when going up/down
    cameraPos[1] = (cameraPos[1] >= MAX_HEIGHT) ? MAX_HEIGHT : cameraPos[1];
    cameraPos[1] = (cameraPos[1] <= MIN_HEIGHT) ? MIN_HEIGHT : cameraPos[1];

    // Generate new terrain if needed and update our skybox position
    updateTerrain(cameraPos[0], cameraPos[2]);
    skyBox(cameraPos[0], cameraPos[2]);
    bindBuffers();

    // This handles the debug information in the top left of the screen
    document.getElementById("speed").innerHTML = ("Speed: " + speed*100).substring(0, 10);
    document.getElementById("x").innerHTML = ("X: " + cameraPos[2]*10).substring(0, 7);
    document.getElementById("z").innerHTML = ("Z: " + cameraPos[1]*10).substring(0, 7);
    document.getElementById("y").innerHTML = ("Y: " + cameraPos[0]*10).substring(0, 7);
    document.getElementById("pitch").innerHTML = ("Pitch: " + theta[0]).substring(0, 13);
    document.getElementById("yaw").innerHTML = ("Yaw: " + theta[1]).substring(0, 9);
    document.getElementById("roll").innerHTML = ("Roll: " + theta[2]).substring(0, 10);
}

function heightMap(x, y) {
    // We use a simple perlin noise function for heightmaps
    var height = 1.3*noise.perlin2(x/2, y/2);
    return height+0.4;
}

function updateTerrain(x, y) {
    // Get what chunk we are currently in
    const cX = Math.floor(x/CHUNKSIZE);
    const cY = Math.floor(y/CHUNKSIZE);

    // If we haven't moved chunks since last time, we don't want to recompute
    // any data
    if (currentChunks == (cX+","+cY))
        return;

    currentChunks = (cX+","+cY);

    generateChunk(cX, cY);
    generateChunk(cX-1, cY);
    generateChunk(cX, cY-1);
    generateChunk(cX-1, cY-1);
    generateChunk(cX+1, cY);
    generateChunk(cX, cY+1);
    generateChunk(cX+1, cY+1);

    // Update vertices, colors and indices with our new chunk data
    vertices = [...chunkVerts[cX+","+cY],...chunkVerts[(cX-1)+","+cY],
        ...chunkVerts[cX+","+(cY-1)],...chunkVerts[(cX-1)+","+(cY-1)],
        ...chunkVerts[(cX+1)+","+cY],...chunkVerts[cX+","+(cY+1)],
        ...chunkVerts[(cX+1)+","+(cY+1)]];
    colors = [...chunkColors[cX+","+cY],...chunkColors[(cX-1)+","+cY],
        ...chunkColors[cX+","+(cY-1)],...chunkColors[(cX-1)+","+(cY-1)],
        ...chunkColors[(cX+1)+","+cY],...chunkColors[cX+","+(cY+1)],
        ...chunkColors[(cX+1)+","+(cY+1)]];

    indices = [...chunkIndices[cX+","+cY]];
    var size = chunkVerts[cX+","+cY].length;
    indices.push(...chunkIndices[(cX-1)+","+cY].map(x => size+x));
    indices.push(...chunkIndices[cX+","+(cY-1)].map(x => 2*size+x));
    indices.push(...chunkIndices[(cX-1)+","+(cY-1)].map(x => 3*size+x));
    indices.push(...chunkIndices[(cX+1)+","+cY].map(x => 4*size+x));
    indices.push(...chunkIndices[cX+","+(cY+1)].map(x => 5*size+x));
    indices.push(...chunkIndices[(cX+1)+","+(cY+1)].map(x => 6*size+x));
}

function generateChunk(cX, cY) {
    // If we've already generated a chunk, we don't want to re-generate it
    if (chunkVerts[cX+","+cY]) return;

    var currChunkVerts = [];
    var currChunkColors = [];
    var currChunkIndices = [];
    var count = 0;

    // Generate all of our vertices
    for(var i = CHUNKSIZE*cX; i <= CHUNKSIZE*(cX+1); i+=0.25) {
        for (var j = CHUNKSIZE*cY; j <= CHUNKSIZE*(cY+1); j+=0.25) {
            var height = heightMap(i, j);
            // Determining the color of our vertices based on the height (grass, mountain or snow)
            if (height >= terrainVals[0] && height < terrainVals[1])
                currChunkColors.push(terrainColors[0]);
            else if (height >= terrainVals[1] && height < terrainVals[2])
                currChunkColors.push(map_point(vec2(terrainVals[1], 0), vec2(terrainVals[2], 0), vec2(height, 0), terrainColors[0], terrainColors[1]));
            else if (height >= terrainVals[2] && height < terrainVals[3])
                currChunkColors.push(terrainColors[1]);
            else if (height >= terrainVals[3])
                currChunkColors.push(map_point(vec2(terrainVals[3], 0), vec2(terrainVals[4], 0), vec2(height, 0), terrainColors[1], terrainColors[2]));
            else
                currChunkColors.push(terrainColors[0]);
            currChunkVerts.push(vec3(i, height, j));
        }
        count++;
    }

    var rowLength = count;
    var numRows = count;
    // Assign those vertices to the correct triangles
    for (var i = 0; i < numRows-1; i++) {
        for (var j = 0; j < rowLength-1; j++) {
            // One triangle
            currChunkIndices.push(j+(i*rowLength), j+1+(i*rowLength), j+((i+1)*rowLength));
            currChunkIndices.push(j+1+(i*rowLength), j+1+((i+1)*rowLength), j+((i+1)*rowLength));
        }
    }

    // Create our water
    var waterStart = currChunkVerts.length;
    currChunkVerts.push(vec3(cX*CHUNKSIZE, waterLevel, cY*CHUNKSIZE),
        vec3(cX*CHUNKSIZE, waterLevel, (cY+1)*CHUNKSIZE),
        vec3((cX+1)*CHUNKSIZE, waterLevel, cY*CHUNKSIZE),
        vec3((cX+1)*CHUNKSIZE, waterLevel, (cY+1)*CHUNKSIZE));
    currChunkColors.push(waterColor, waterColor, waterColor, waterColor);
    currChunkIndices.push(waterStart, waterStart+1, waterStart+2);
    currChunkIndices.push(waterStart+2, waterStart+1, waterStart+3);

    // Add our chunk data to our chunk lists
    chunkVerts[cX+","+cY] = currChunkVerts;
    chunkColors[cX+","+cY] = currChunkColors;
    chunkIndices[cX+","+cY] = currChunkIndices;
}

function skyBox(x, y) {
    // Make a 10x10x10 blue cube (without the bottom face for efficiency) so it
    // seems like our world has a sky
    var skyStart = vertices.length;
    skyVerts = [];
    skyColors = [];
    skyIndices = [];
    const currPos = vec3(x, 0, y);
    var size = skyBoxSize;

    skyVerts.push(add(currPos,vec3(-size, -size, -size)),add(currPos,vec3(size, -size, -size)),
        add(currPos,vec3(size, size, -size)),add(currPos,vec3(-size, size, -size)));
    skyColors.push(skyColor,skyColor,skyColor,skyColor);
    skyIndices.push(skyStart, skyStart+1, skyStart+2);
    skyIndices.push(skyStart+3, skyStart, skyStart+2);

    skyStart = vertices.length + skyVerts.length;
    skyVerts.push(add(currPos,vec3(-size, -size, size)),add(currPos,vec3(size, -size, size)),
        add(currPos,vec3(size, size, size)),add(currPos,vec3(-size, size, size)));
    skyColors.push(skyColor,skyColor,skyColor,skyColor);
    skyIndices.push(skyStart+2, skyStart+1, skyStart);
    skyIndices.push(skyStart+2, skyStart, skyStart+3);

    skyStart = vertices.length + skyVerts.length;
    skyVerts.push(add(currPos,vec3(-size, size, -size)),add(currPos,vec3(-size, size, size)),
        add(currPos,vec3(-size, -size, -size)),add(currPos,vec3(-size, -size, size)));
    skyColors.push(skyColor,skyColor,skyColor,skyColor);
    skyIndices.push(skyStart, skyStart+1, skyStart+2);
    skyIndices.push(skyStart, skyStart+1, skyStart+3);

    skyStart = vertices.length + skyVerts.length;
    skyVerts.push(add(currPos,vec3(size, size, -size)),add(currPos,vec3(size, size, size)),
        add(currPos,vec3(size, -size, -size)),add(currPos,vec3(size, -size, size)));
    skyColors.push(skyColor,skyColor,skyColor,skyColor);
    skyIndices.push(skyStart+2, skyStart+1, skyStart);
    skyIndices.push(skyStart+3, skyStart+1, skyStart);

    skyStart = vertices.length + skyVerts.length;
    skyVerts.push(add(currPos,vec3(size, size, -size)),add(currPos,vec3(size, size, size)),
        add(currPos,vec3(-size, size, -size)),add(currPos,vec3(-size, size, size)));
    skyColors.push(skyColor,skyColor,skyColor,skyColor);
    skyIndices.push(skyStart, skyStart+1, skyStart+2);
    skyIndices.push(skyStart+2, skyStart+1, skyStart+3);
}

function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // Bind our theta variable
    gl.uniform3fv(theta_loc, flatten(theta));
    gl.uniform3fv(shift_loc, flatten(cameraPos));
    gl.uniform4fv(fogColor_loc, fogColor);
    gl.uniform1f(fogDensity_loc, fogDensity);
    // Set the fudgeFactor
    gl.uniform1f(fudgeLocation, fudgeFactor);

    if (wireframe) {
        //draws wireframe terrain
        gl.drawElements( gl.LINES, indices.length, gl.UNSIGNED_INT, 0 );
    }
    else if (flatShading) {
        gl.drawElements( gl.POINTS, indices.length, gl.UNSIGNED_INT, 0 );
    }
    else {
        gl.drawElements( gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0 );
    }
  
    getUserInput();
    updatePosition();

    requestAnimFrame(render);
}
