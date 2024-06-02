const svg = document.getElementById('drawingCanvas');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');
const penButton = document.getElementById('penButton');
const panButton = document.getElementById('panButton');
const lassoButton = document.getElementById('lassoButton');
const deleteButton = document.getElementById('deleteButton');
const importButton = document.getElementById('importButton');
const exportButton = document.getElementById('exportButton');
const fileInput = document.getElementById('fileInput');

let isDrawing = false;
let isPanning = false;
let isLassoing = false;
let path;
let lassoPath;
let undoStack = [];
let redoStack = [];
let currentTool = 'pen';
let viewBox = { x: 0, y: 0, width: 500, height: 500 };
let panStart = { x: 0, y: 0 };
let lassoPoints = [];
let selectedPaths = [];

function setTool(tool) {
    currentTool = tool;
    penButton.classList.toggle('active', tool === 'pen');
    panButton.classList.toggle('active', tool === 'pan');
    lassoButton.classList.toggle('active', tool === 'lasso');
}

function getMousePosition(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgPoint.x, y: svgPoint.y };
}

function startDrawing(event) {
    if (currentTool !== 'pen') return;
    isDrawing = true;
    const { x, y } = getMousePosition(event);
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x} ${y}`);
    path.setAttribute('stroke', 'black');
    path.setAttribute('stroke-width', 2);
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
}

function draw(event) {
    if (!isDrawing) return;
    const { x, y } = getMousePosition(event);
    const d = path.getAttribute('d');
    path.setAttribute('d', `${d} L${x} ${y}`);
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    undoStack.push(path);
    redoStack = [];
}

function startPan(event) {
    if (currentTool !== 'pan') return;
    isPanning = true;
    panStart = { x: event.clientX, y: event.clientY };
}

function pan(event) {
    if (!isPanning) return;
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    viewBox.x -= dx * (viewBox.width / svg.clientWidth);
    viewBox.y -= dy * (viewBox.height / svg.clientHeight);
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    panStart = { x: event.clientX, y: event.clientY };
}

function stopPan() {
    isPanning = false;
}

function startLasso(event) {
    if (currentTool !== 'lasso') return;
    isLassoing = true;
    lassoPoints = [];
    const { x, y } = getMousePosition(event);
    lassoPoints.push({ x, y });
    lassoPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    lassoPath.setAttribute('fill', 'rgba(0, 0, 255, 0.3)');
    lassoPath.setAttribute('stroke', 'blue');
    svg.appendChild(lassoPath);
}

function lasso(event) {
    if (!isLassoing) return;
    const { x, y } = getMousePosition(event);
    lassoPoints.push({ x, y });
    const points = lassoPoints.map(p => `${p.x},${p.y}`).join(' ');
    lassoPath.setAttribute('points', points);
}

function stopLasso() {
    if (!isLassoing) return;
    isLassoing = false;
    selectPathsWithinLasso();
    svg.removeChild(lassoPath);
}

function isPointInPolygon(polygon, point) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) != (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function selectPathsWithinLasso() {
    selectedPaths = [];
    const paths = svg.querySelectorAll('path');
    paths.forEach(p => {
        const pathPoints = p.getAttribute('d').match(/M\s*([\d.]+)[,\s]+([\d.]+)|L\s*([\d.]+)[,\s]+([\d.]+)/g);
        if (pathPoints) {
            for (let point of pathPoints) {
                const coords = point.match(/([\d.]+)/g).map(Number);
                const x = coords[0];
                const y = coords[1];
                if (isPointInPolygon(lassoPoints, { x, y })) {
                    selectedPaths.push(p);
                    break;
                }
            }
        }
    });
    selectedPaths.forEach(p => p.setAttribute('stroke', 'blue'));
    deleteButton.disabled = selectedPaths.length === 0;
}

function deleteSelectedPaths() {
    selectedPaths.forEach(p => svg.removeChild(p));
    selectedPaths = [];
    deleteButton.disabled = true;
}

function undo() {
    if (undoStack.length === 0) return;
    const lastPath = undoStack.pop();
    redoStack.push(lastPath);
    svg.removeChild(lastPath);
}

function redo() {
    if (redoStack.length === 0) return;
    const lastPath = redoStack.pop();
    undoStack.push(lastPath);
    svg.appendChild(lastPath);
}

function importSVG(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const svgData = event.target.result;
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
        const importedPaths = svgDoc.querySelectorAll('path');
        importedPaths.forEach(path => svg.appendChild(path));
    };
    reader.readAsText(file);
}

function exportSVG() {
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // Prompt user to save the file
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawing.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke the object URL
    URL.revokeObjectURL(url);
}

svg.addEventListener('mousedown', (event) => {
    if (currentTool === 'pen') startDrawing(event);
    if (currentTool === 'pan') startPan(event);
    if (currentTool === 'lasso') startLasso(event);
});

svg.addEventListener('mousemove', (event) => {
    if (currentTool === 'pen') draw(event);
    if (currentTool === 'pan') pan(event);
    if (currentTool === 'lasso') lasso(event);
});

svg.addEventListener('mouseup', () => {
    if (currentTool === 'pen') stopDrawing();
    if (currentTool === 'pan') stopPan();
    if (currentTool === 'lasso') stopLasso();
});

svg.addEventListener('mouseleave', () => {
    if (currentTool === 'pen') stopDrawing();
    if (currentTool === 'pan') stopPan();
    if (currentTool === 'lasso') stopLasso();
});

undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);
penButton.addEventListener('click', () => setTool('pen'));
panButton.addEventListener('click', () => setTool('pan'));
lassoButton.addEventListener('click', () => setTool('lasso'));
deleteButton.addEventListener('click', deleteSelectedPaths);
importButton.addEventListener('click', () => fileInput.click());
exportButton.addEventListener('click', exportSVG);
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    importSVG(file);
});
