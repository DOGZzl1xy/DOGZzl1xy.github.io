const CONFIG = {
    dataUrl: 'svf-points.min.json',
    startLat: 37.7749,
    startLon: -122.4194,
    zoomLevel: 13,
    pointRadius: 2,
    hoverRadius: 10,
    hoverCellSize: 24
};

let map;
let canvasLayer;
let dataPoints = [];
let currentMetric = 'difference';
let canvas;
let ctx;
let drawRequestId = null;
let hoveredPoint = null;
let hoveredScreenPoint = null;
let hoverGrid = new Map();

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupControls();
    loadData();
});

function initMap() {
    map = L.map('map', {
        center: [CONFIG.startLat, CONFIG.startLon],
        zoom: CONFIG.zoomLevel,
        zoomControl: false,
        preferCanvas: true
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    L.CanvasLayer = L.Layer.extend({
        onAdd: function () {
            canvas = L.DomUtil.create('canvas', 'leaflet-canvas-layer');
            this._canvas = canvas;
            map.getPane('overlayPane').appendChild(canvas);

            this._resize();

            map.on('moveend', this._reset, this);
            map.on('zoomend', this._reset, this);
            map.on('resize', this._resize, this);
            map.on('movestart', clearHover);
            map.on('zoomstart', clearHover);

            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseleave', clearHover);
        },

        onRemove: function () {
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', clearHover);
            map.off('moveend', this._reset, this);
            map.off('zoomend', this._reset, this);
            map.off('resize', this._resize, this);
            map.off('movestart', clearHover);
            map.off('zoomstart', clearHover);
            map.getPane('overlayPane').removeChild(this._canvas);
        },

        _resize: function () {
            const size = map.getSize();
            const dpr = window.devicePixelRatio || 1;

            this._canvas.style.width = `${size.x}px`;
            this._canvas.style.height = `${size.y}px`;
            this._canvas.width = Math.round(size.x * dpr);
            this._canvas.height = Math.round(size.y * dpr);

            ctx = this._canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            requestDraw();
        },

        _reset: function () {
            const topLeft = map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);
            requestDraw();
        }
    });

    canvasLayer = new L.CanvasLayer();
    canvasLayer.addTo(map);
}

async function loadData() {
    setDataStatus('Loading map data…');

    try {
        const response = await fetch(CONFIG.dataUrl, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error(`Data request failed with status ${response.status}`);
        }

        const rows = await response.json();
        processData(rows);
    } catch (error) {
        console.error('Unable to load SVF data.', error);
        setDataStatus('Map data could not be loaded. Please refresh the page.', true);
    }
}

function processData(rows) {
    const parsedPoints = [];
    const bounds = L.latLngBounds();

    for (const row of rows) {
        if (!Array.isArray(row) || !Number.isFinite(row[0]) || !Number.isFinite(row[1])) {
            continue;
        }

        const point = {
            lat: row[0],
            lon: row[1],
            latLng: L.latLng(row[0], row[1]),
            lidar_svf: finiteOrNull(row[2]),
            gsv_svf: finiteOrNull(row[3]),
            KR_PC_SVF: finiteOrNull(row[4]),
            SVF_Left: finiteOrNull(row[5]),
            SVF_Right: finiteOrNull(row[6])
        };

        point.difference = [point.KR_PC_SVF, point.SVF_Left, point.SVF_Right].every(Number.isFinite)
            ? point.KR_PC_SVF - ((point.SVF_Left + point.SVF_Right) / 2)
            : null;

        parsedPoints.push(point);
        bounds.extend(point.latLng);
    }

    dataPoints = parsedPoints;
    setDataStatus(`${dataPoints.length.toLocaleString()} locations loaded.`);

    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
    }

    requestDraw();
}

function finiteOrNull(value) {
    return Number.isFinite(value) ? value : null;
}

function setupControls() {
    const selector = document.getElementById('svf-source');
    selector.addEventListener('change', (event) => {
        currentMetric = event.target.value;
        clearHover();
        requestDraw();
    });
}

function requestDraw() {
    if (drawRequestId !== null) return;

    drawRequestId = requestAnimationFrame(() => {
        drawRequestId = null;
        drawLayer();
    });
}

function drawLayer() {
    if (!ctx || !map || !canvas) return;

    const size = map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);
    hoverGrid = new Map();
    hoveredScreenPoint = null;

    if (!dataPoints.length) return;

    const bounds = map.getBounds().pad(0.05);
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    let visibleCount = 0;

    for (const point of dataPoints) {
        const value = point[currentMetric];
        if (!Number.isFinite(value)) continue;
        if (point.lat < south || point.lat > north || point.lon < west || point.lon > east) continue;

        const screenPoint = map.latLngToContainerPoint(point.latLng);
        if (screenPoint.x < -10 || screenPoint.x > size.x + 10 ||
            screenPoint.y < -10 || screenPoint.y > size.y + 10) {
            continue;
        }

        const magnitude = Math.min(1, Math.abs(value));
        const radius = CONFIG.pointRadius + (magnitude * 1.5);

        ctx.beginPath();
        ctx.arc(screenPoint.x, screenPoint.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getPointColor(value);
        ctx.fill();

        const indexedPoint = { point, x: screenPoint.x, y: screenPoint.y };
        addToHoverGrid(indexedPoint);
        visibleCount += 1;

        if (point === hoveredPoint) {
            hoveredScreenPoint = indexedPoint;
        }
    }

    if (hoveredScreenPoint) {
        ctx.beginPath();
        ctx.arc(hoveredScreenPoint.x, hoveredScreenPoint.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#2c2c2c';
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (hoveredPoint) {
        clearHover(false);
    }

    setDataStatus(`${dataPoints.length.toLocaleString()} locations loaded · ${visibleCount.toLocaleString()} visible`);
}

function addToHoverGrid(indexedPoint) {
    const column = Math.floor(indexedPoint.x / CONFIG.hoverCellSize);
    const row = Math.floor(indexedPoint.y / CONFIG.hoverCellSize);
    const key = `${column}:${row}`;
    const bucket = hoverGrid.get(key);

    if (bucket) {
        bucket.push(indexedPoint);
    } else {
        hoverGrid.set(key, [indexedPoint]);
    }
}

function getPointColor(value) {
    if (currentMetric === 'difference') {
        // emphasis curve keeps small differences visible on the light basemap
        const magnitude = Math.pow(Math.min(1, Math.abs(value)), 0.55);
        const alpha = 0.65 + (0.3 * magnitude);
        // fade between the paper tone (249,247,241) and full red/blue
        const target = value >= 0 ? [192, 57, 43] : [46, 109, 164];
        const r = Math.round(249 + (target[0] - 249) * magnitude);
        const g = Math.round(247 + (target[1] - 247) * magnitude);
        const b = Math.round(241 + (target[2] - 241) * magnitude);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // single sources: one ink-blue hue, light (low SVF) to dark (high SVF)
    const normalizedValue = Math.max(0, Math.min(1, value));
    const lightness = 78 - (normalizedValue * 50);
    const alpha = 0.4 + (normalizedValue * 0.35);
    return `hsla(211, 55%, ${lightness}%, ${alpha})`;
}

function handleMouseMove(event) {
    if (!hoverGrid.size) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const baseColumn = Math.floor(mouseX / CONFIG.hoverCellSize);
    const baseRow = Math.floor(mouseY / CONFIG.hoverCellSize);
    const maxDistanceSquared = CONFIG.hoverRadius * CONFIG.hoverRadius;
    let nearestPoint = null;
    let nearestDistanceSquared = maxDistanceSquared;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            const bucket = hoverGrid.get(`${baseColumn + columnOffset}:${baseRow + rowOffset}`);
            if (!bucket) continue;

            for (const indexedPoint of bucket) {
                const dx = indexedPoint.x - mouseX;
                const dy = indexedPoint.y - mouseY;
                const distanceSquared = (dx * dx) + (dy * dy);

                if (distanceSquared < nearestDistanceSquared) {
                    nearestDistanceSquared = distanceSquared;
                    nearestPoint = indexedPoint.point;
                }
            }
        }
    }

    const hoverChanged = nearestPoint !== hoveredPoint;
    hoveredPoint = nearestPoint;
    updateTooltip(event.clientX, event.clientY);

    if (hoverChanged) {
        requestDraw();
    }
}

function clearHover(redraw = true) {
    const hadHover = Boolean(hoveredPoint);
    hoveredPoint = null;
    hoveredScreenPoint = null;
    document.getElementById('tooltip').classList.add('hidden');

    if (hadHover && redraw) {
        requestDraw();
    }
}

function updateTooltip(x, y) {
    const tooltip = document.getElementById('tooltip');
    const content = document.getElementById('tooltip-content');

    if (!hoveredPoint) {
        tooltip.classList.add('hidden');
        return;
    }

    tooltip.classList.remove('hidden');
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;

    const value = hoveredPoint[currentMetric];
    const formattedValue = Number.isFinite(value) ? value.toFixed(3) : 'N/A';

    content.innerHTML = `
        <div><strong>Lat:</strong> ${hoveredPoint.lat.toFixed(5)}</div>
        <div><strong>Lon:</strong> ${hoveredPoint.lon.toFixed(5)}</div>
        <hr style="margin: 5px 0; border: 0; border-top: 1px dashed #d9d3c3;">
        <div><strong>${currentMetric === 'difference' ? 'Difference' : currentMetric}:</strong> <span style="color: #e74c3c">${formattedValue}</span></div>
        <div style="font-size: 0.75rem; color: #5d584e;">
            ${currentMetric === 'difference' ? `
            PC: ${formatMetric(hoveredPoint.KR_PC_SVF, 3)} <br>
            Left: ${formatMetric(hoveredPoint.SVF_Left, 3)} <br>
            Right: ${formatMetric(hoveredPoint.SVF_Right, 3)}
            ` : `
            LiDAR: ${formatMetric(hoveredPoint.lidar_svf, 2)} <br>
            GSV: ${formatMetric(hoveredPoint.gsv_svf, 2)} <br>
            PC: ${formatMetric(hoveredPoint.KR_PC_SVF, 2)}
            `}
        </div>
    `;
}

function formatMetric(value, digits) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function setDataStatus(message, isError = false) {
    const status = document.getElementById('data-status');
    status.textContent = message;
    status.classList.toggle('is-error', isError);
}
