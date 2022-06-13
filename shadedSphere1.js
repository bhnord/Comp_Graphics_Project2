const DIVISIONS = 40;
const Z_DISTANCE = 40.0;

let canvas;
let gl;

let numTimesToSubdivide = 2;



let pointsArray = [];
let normalsArray = [];


let near = -10;
let far = 10;

let left = -12.0;
let right = 12.0;
let ytop = 12.0;
let bottom = -12.0;

let va = vec4(0.0, 0.0, -1.0, 1);
let vb = vec4(0.0, 0.942809, 0.333333, 1);
let vc = vec4(-0.816497, -0.471405, 0.333333, 1);
let vd = vec4(0.816497, -0.471405, 0.333333, 1);

//Z distance = how far away the camera is along the Z axis from the models and 7 is so that the light looks nice
let lightPosition = vec4(0.0, 0.0, -Z_DISTANCE+7, 0.0);
let lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
let lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
let lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

let materialAmbient = vec4(1.0, 0.0, 1.0, 1.0);
let materialDiffuse = vec4(1.0, 0.8, 0.0, 1.0);
let materialSpecular = vec4(1.0, 1.0, 1.0, 1.0);
let materialShininess = 20.0;



let at = vec3(0.0, 0.0, 1.0);
let up = vec3(0.0, 1.0, 0.0);

let modelViewMatrixLoc, projectionMatrixLoc;

let transMatrixLoc;
let eye = vec3(0, 0, Z_DISTANCE);

//sets camera to look at scene
let modelViewMatrix = lookAt(eye, at, up);
//sets up projection view
let fovy = 30;
let projectionMatrix = perspective(fovy, 1,.1, 100);


let draw_type;
let vBuffer;
let vNormal;

let program;
let is_mesh = true;

let chaikins_subdivide = 0;

let lightingType = 0;

//add trianngle to point array
function triangle(a, b, c) {
    pointsArray.push(a);
    pointsArray.push(b);
    pointsArray.push(c);

    // normals are vectors
    normalsArray.push(a[0], a[1], a[2], 0.0);
    normalsArray.push(b[0], b[1], b[2], 0.0);
    normalsArray.push(c[0], c[1], c[2], 0.0);
}

//subdivide on triangles
function divideTriangle(a, b, c, count) {
    if (count > 0) {

        let ab = mix(a, b, 0.5);
        let ac = mix(a, c, 0.5);
        let bc = mix(b, c, 0.5);

        ab = normalize(ab, true);
        ac = normalize(ac, true);
        bc = normalize(bc, true);

        divideTriangle(a, ab, ac, count - 1);
        divideTriangle(ab, b, bc, count - 1);
        divideTriangle(bc, c, ac, count - 1);
        divideTriangle(ab, bc, ac, count - 1);
    }
    else {
        triangle(a, b, c);
    }
}

//create tetrahedron by subdividing on triangles
function tetrahedron(a, b, c, d, n) {
    divideTriangle(a, b, c, n);
    divideTriangle(d, c, b, n);
    divideTriangle(a, d, b, n);
    divideTriangle(a, c, d, n);
}

window.onload = function init() {

    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.CULL_FACE);
    // gl.cullFace(gl.FRONT_AND_BACK);




    //  Load shaders and initialize attribute buffers

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    let diffuseProduct = mult(lightDiffuse, materialDiffuse);
    let specularProduct = mult(lightSpecular, materialSpecular);
    let ambientProduct = mult(lightAmbient, materialAmbient);



    //buffer creations and vertex array initialization
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);


    vNormal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vNormal);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);

    let vNormalPosition = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormalPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormalPosition);


    //setup progarm matrix locations
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    transMatrixLoc = gl.getUniformLocation(program, "transMatrix");


    //set uniform material properties 
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"), flatten(diffuseProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"), flatten(specularProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"), flatten(ambientProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), flatten(lightPosition));
    gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);

    //setup initial vals
    gl.uniform1i(gl.getUniformLocation(program, "drawWhite"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "isLineDraw"), 1);

    draw_type = gl.LINE_LOOP;
    point_change = (Math.pow(2, chaikins_subdivide + 1) - 1) / DIVISIONS;

    //set up key presses
    keys_setup(program);

    //first render
    render();
}


let point_num = 0; //num point sphere is at
let point_change = 0; //change in point (float) per render
let last_chaikins = 0; //amt of chaikins subdv on last render
let curr_location = 0; //total location in float where sphere is at (point + fraction to next point)
let is_animated = false; //animation toggle

let [deltax, deltay] = [0, 0]; //change in xy of sphere from a point along the curve
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);



    //set up model and projection matrix
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));


    //do not translate (not a circle drawing -- draw in white with no shading
    gl.uniform1i(gl.getUniformLocation(program, "isCircle"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "drawWhite"), 1);
    draw_line();

    gl.drawArrays(gl.LINE_LOOP, 0, pointsArray.length);

    if (!is_mesh) { //if not in wireframe mode, draw shading
        gl.uniform1i(gl.getUniformLocation(program, "drawWhite"), 0);
    }

    if (is_animated || chaikins_subdivide != last_chaikins) {
        if (chaikins_subdivide != last_chaikins) {
            // num points (float) to have 1/(7*DIVISIONS) piece of line (DIVISIONS, refers to speed of sphere along curve)
            point_change = (Math.pow(2, chaikins_subdivide + 1) - 1) / DIVISIONS;

            //reset values because of vector array change -- sphere will jump to nearest point. 

            point_num = point_num / Math.pow(2, last_chaikins - chaikins_subdivide);
            curr_location = point_num;
        }
        last_chaikins = chaikins_subdivide;

        curr_location = (curr_location + point_change) % pointsArray.length;

        //takes integer of curr_location for point reference on curve
        point_num = (Math.floor(curr_location)) % pointsArray.length;

        //takes fractional of curr_location for amount (deltaxy) inbetweeen points to translate
        deltax = (pointsArray[(point_num + 1) % pointsArray.length][0] - pointsArray[point_num][0]) * (curr_location % 1);
        deltay = (pointsArray[(point_num + 1) % pointsArray.length][1] - pointsArray[point_num][1]) * (curr_location % 1);
    }

    //translation matrix of sphere so sphere travels along curve
    let transMatrix = translate(pointsArray[point_num][0] + deltax, pointsArray[point_num][1] + deltay, 0);

    gl.uniformMatrix4fv(transMatrixLoc, false, flatten(transMatrix));

    //turn isCircle back to 1 to draw circle (no translation matrix)
    gl.uniform1i(gl.getUniformLocation(program, "isCircle"), 1);

    //setup circle buffers before arrays draw call
    draw_circle();
    for (let i = 0; i < pointsArray.length; i += 3)
        gl.drawArrays(draw_type, i, 3);

    //console.log("ss");
    //calls reqAnimationFrame to update screen every n ms 
    if (is_animated)
        setTimeout(requestAnimationFrame, 30, render);

}

//set up vertex + fragment for circle draw
function draw_circle() {
    pointsArray = [];
    normalsArray = [];

    //setup pointsArray with sphere vectors
    tetrahedron(va, vb, vc, vd, numTimesToSubdivide);


    //send to graphics buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);


    gl.bindBuffer(gl.ARRAY_BUFFER, vNormal);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);
}

//set up vetext + fragment for line draw
function draw_line() {
    pointsArray = [];
    normalsArray = [];
    //base line loop as defined in project
    pointsArray.push(vec4(-8, 8, 0, 1));
    pointsArray.push(vec4(2, 4, 0, 1));
    pointsArray.push(vec4(6, 6, 0, 1));
    pointsArray.push(vec4(10, -8, 0, 1));
    pointsArray.push(vec4(2, -2, 0, 1));
    pointsArray.push(vec4(-6, -2, 0, 1));


    //subdivide line loop by n subdivisions
    pointsArray = chaikins(pointsArray, chaikins_subdivide);


    //send info to graphics buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vNormal);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);
}


//recursive apply chaikins algorithm to smoothen line loop by n subdv
function chaikins(points, numSubdivisions) {
    if (numSubdivisions <= 0) {
        return points;
    }

    new_points = [];
    for (let i = 0; i < points.length - 1; i++) {
        let qdeltx = (points[i + 1][0] - points[i][0]) / 4; //get delt x /4
        let qdelty = (points[i + 1][1] - points[i][1]) / 4; //get delt y /4

        //point 1/4 between the n and n+1th point
        new_points.push(vec4(points[i][0] + qdeltx, points[i][1] + qdelty, 0, 1));

        //point 3/4 between the n and n+1th point
        new_points.push(vec4(points[i][0] + (3 * qdeltx), points[i][1] + (3 * qdelty), 0, 1));
    }
    let qdeltx = (points[0][0] - points[points.length - 1][0]) / 4; //get delt x /4 for last and first point
    let qdelty = (points[0][1] - points[points.length - 1][1]) / 4; //get delt y /4 for last and first point

    //point 1/4 between the n and n+1th point
    new_points.push(vec4(points[points.length - 1][0] + qdeltx, points[points.length - 1][1] + qdelty, 0, 1));

    //point 3/4 between the n and n+1th point
    new_points.push(vec4(points[points.length - 1][0] + (3 * qdeltx), points[points.length - 1][1] + (3 * qdelty), 0, 1));


    return chaikins(new_points, numSubdivisions - 1);


}


//setup key presses for user interface
function keys_setup(program) {
    window.onkeypress = function (event) {
        let key = event.key;
        switch (key.toLowerCase()) {
            case 'm': //switch btw shaded sphere and meshh
                is_mesh = !is_mesh;
                if (is_mesh)
                    draw_type = gl.LINE_STRIP;
                else
                    draw_type = gl.TRIANGLES;

                break;
            case 'q': //decrease sphere subdivisions
                if (numTimesToSubdivide > 0)
                    numTimesToSubdivide -= 1;

                break;
            case 'e': //increase sphere subdivisions
                if (numTimesToSubdivide < 8)
                    numTimesToSubdivide += 1;

                break;
            case 'i': //increase line subdivisions
                if (chaikins_subdivide < 8)
                    chaikins_subdivide++;
                break;
            case 'j': //decrease line subdivisions
                if (chaikins_subdivide > 0)
                    chaikins_subdivide--;

                break;
            case 'a': //toggle animation
                is_animated = !is_animated;
                if (is_animated) {
                    render();
                }
                break;
            case 'l': //switch lighting type
                lightingType = (lightingType +1)% 2;
                gl.uniform1i(gl.getUniformLocation(program, "lightingType"), lightingType);
                break;

        }
        
        //if not animated, render once so any changes go through
        if (!is_animated)
            render();
    }
}