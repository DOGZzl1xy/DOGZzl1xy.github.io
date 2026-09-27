const CONFIG = {
    dataUrl: 'svf-points.v2.json',
    // extent of the data (from svf-points.min.json); the map opens here directly,
    // so tiles are fetched once instead of for a default view and then again
    bounds: [[37.708258, -122.511657], [37.829986, -122.350207]],
    pointRadius: 2,
    hoverRadius: 10,
    hoverCellSize: 24,
    bins: 24,
    // OpenStreetMap tiles; style.css tones them to the site palette (and inverts them in dark mode)
    tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
};

const METRICS = ['difference', 'lidar_svf', 'gsv_svf', 'KR_PC_SVF'];
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

let map;
let tileLayer;
let canvas;
let ctx;
let drawRequestId = null;
let currentMetric = 'difference';
let dataPoints = [];
// per metric: the colour bin of every point (-1 = no value), and each bin's colour / radius
let pointBins = {};
let palettes = {};
let hoveredPoint = null;
let hoveredScreenPoint = null;
let hoverGrid = new Map();

document.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.metric = currentMetric;
    initMap();
    setupControls();
    loadData();
    darkQuery.addEventListener('change', () => {
        buildPalettes();
        requestDraw();
    });
});

function initMap() {
    map = L.map('map', { zoomControl: false, preferCanvas: true })
        .fitBounds(CONFIG.bounds, { padding: [20, 20], maxZoom: 15 });

    L.control.zoom({ position: 'topright' }).addTo(map);

    tileLayer = L.tileLayer(CONFIG.tiles, {
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

            canvas.addEventListener('mousemove', handlePointer);
            canvas.addEventListener('mouseleave', clearHover);
            // touch screens have no hover: a tap shows the nearest point's details
            canvas.addEventListener('click', handlePointer);
        },

        onRemove: function () {
            canvas.removeEventListener('mousemove', handlePointer);
            canvas.removeEventListener('mouseleave', clearHover);
            canvas.removeEventListener('click', handlePointer);
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

    new L.CanvasLayer().addTo(map);
}

async function loadData() {
    setDataStatus('Loading map data…');

    try {
        const response = await fetch(CONFIG.dataUrl);
        if (!response.ok) {
            throw new Error(`Data request failed with status ${response.status}`);
        }
        dataPoints = decodePoints(await response.json());
        buildPalettes();
        setDataStatus(`${dataPoints.length.toLocaleString()} locations loaded.`);
        requestDraw();
    } catch (error) {
        console.error('Unable to load SVF data.', error);
        setDataStatus('Map data could not be loaded. Please refresh the page.', true);
    }
}

// svf-points/2 (scripts/pack_svf_points.py): lat/lon as running sums of 1e-6 degree
// deltas, pc in 1e-4, the other SVF values relative to pc. Lossless.
function decodePoints(packed) {
    const points = new Array(packed.count);
    let lat = 0;
    let lon = 0;

    for (let i = 0; i < packed.count; i += 1) {
        lat += packed.lat[i];
        lon += packed.lon[i];
        const pc = packed.pc[i];
        const point = {
            lat: lat / 1e6,
            lon: lon / 1e6,
            lidar_svf: (packed.lidar[i] + pc) / 1e4,
            gsv_svf: (packed.gsv[i] + pc) / 1e4,
            KR_PC_SVF: pc / 1e4,
            SVF_Left: (packed.left[i] + pc) / 1e4,
            SVF_Right: (packed.right[i] + pc) / 1e4
        };
        point.latLng = L.latLng(point.lat, point.lon);
        point.difference = point.KR_PC_SVF - ((point.SVF_Left + point.SVF_Right) / 2);
        points[i] = point;
    }
    return points;
}

function setupControls() {
    const selector = document.getElementById('svf-source');
    selector.addEventListener('change', (event) => {
        currentMetric = event.target.value;
        document.body.dataset.metric = currentMetric;
        clearHover();
        requestDraw();
    });
}

/* ---- colours --------------------------------------------------------------
   Points are grouped into CONFIG.bins colour bins per metric, so drawing is one
   path + one fill per bin instead of a fillStyle change per point. Colours come
   from the --svf-* tokens in style.css (light and dark). */

function readColor(name) {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function buildPalettes() {
    const zero = readColor('--svf-zero');
    const pos = readColor('--svf-pos');
    const neg = readColor('--svf-neg');
    const low = readColor('--svf-low');
    const high = readColor('--svf-high');
    const half = CONFIG.bins / 2;

    // difference: emphasis curve keeps small differences visible; bins 0..half-1 negative, half.. positive
    palettes.difference = [];
    for (let b = 0; b < CONFIG.bins; b += 1) {
        const magnitude = ((b % half) + 0.5) / half;
        const c = mix(zero, b < half ? neg : pos, magnitude);
        palettes.difference.push({
            color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.65 + 0.3 * magnitude})`,
            radius: CONFIG.pointRadius + Math.pow(magnitude, 1 / 0.55) * 1.5
        });
    }

    // single sources: low -> high SVF along one ramp
    const ramp = [];
    for (let b = 0; b < CONFIG.bins; b += 1) {
        const t = (b + 0.5) / CONFIG.bins;
        const c = mix(low, high, t);
        ramp.push({ color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.45 + 0.4 * t})`, radius: CONFIG.pointRadius + t * 1.5 });
    }
    ['lidar_svf', 'gsv_svf', 'KR_PC_SVF'].forEach((m) => { palettes[m] = ramp; });

    // bin assignment only depends on the data, so compute it once
    if (!pointBins.difference && dataPoints.length) {
        METRICS.forEach((m) => {
            const bins = new Int8Array(dataPoints.length);
            dataPoints.forEach((p, i) => { bins[i] = binFor(m, p[m]); });
            pointBins[m] = bins;
        });
    }
}

function binFor(metric, value) {
    if (!Number.isFinite(value)) return -1;
    const last = CONFIG.bins - 1;
    if (metric === 'difference') {
        const half = CONFIG.bins / 2;
        const magnitude = Math.pow(Math.min(1, Math.abs(value)), 0.55);
        const step = Math.min(half - 1, Math.floor(magnitude * half));
        return value < 0 ? step : half + step;
    }
    return Math.min(last, Math.max(0, Math.floor(value * CONFIG.bins)));
}

/* ---- drawing ------------------------------------------------------------- */

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

    const bins = pointBins[currentMetric];
    const palette = palettes[currentMetric];
    if (!dataPoints.length || !bins || !palette) return;

    const bounds = map.getBounds().pad(0.05);
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const paths = palette.map(() => new Path2D());
    let visibleCount = 0;

    for (let i = 0; i < dataPoints.length; i += 1) {
        const bin = bins[i];
        if (bin < 0) continue;
        const point = dataPoints[i];
        if (point.lat < south || point.lat > north || point.lon < west || point.lon > east) continue;

        const screenPoint = map.latLngToContainerPoint(point.latLng);
        if (screenPoint.x < -10 || screenPoint.x > size.x + 10 ||
            screenPoint.y < -10 || screenPoint.y > size.y + 10) {
            continue;
        }

        const r = palette[bin].radius;
        paths[bin].moveTo(screenPoint.x + r, screenPoint.y);
        paths[bin].arc(screenPoint.x, screenPoint.y, r, 0, Math.PI * 2);

        const indexedPoint = { point, x: screenPoint.x, y: screenPoint.y };
        addToHoverGrid(indexedPoint);
        visibleCount += 1;

        if (point === hoveredPoint) {
            hoveredScreenPoint = indexedPoint;
        }
    }

    paths.forEach((path, bin) => {
        ctx.fillStyle = palette[bin].color;
        ctx.fill(path);
    });

    if (hoveredScreenPoint) {
        const halo = readColor('--svf-halo');
        ctx.beginPath();
        ctx.arc(hoveredScreenPoint.x, hoveredScreenPoint.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgb(${halo[0]}, ${halo[1]}, ${halo[2]})`;
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

/* ---- hover / tap --------------------------------------------------------- */

function handlePointer(event) {
    if (!hoverGrid.size) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const baseColumn = Math.floor(mouseX / CONFIG.hoverCellSize);
    const baseRow = Math.floor(mouseY / CONFIG.hoverCellSize);
    // fingers are less precise than a cursor
    const radius = event.type === 'click' ? CONFIG.hoverRadius * 2 : CONFIG.hoverRadius;
    let nearestPoint = null;
    let nearestDistanceSquared = radius * radius;

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
    // keep the box on screen near the right / bottom edges
    const flipX = x + 15 + tooltip.offsetWidth > window.innerWidth;
    const flipY = y + 15 + tooltip.offsetHeight > window.innerHeight;
    tooltip.style.left = `${flipX ? x - tooltip.offsetWidth - 30 : x}px`;
    tooltip.style.top = `${flipY ? y - tooltip.offsetHeight - 30 : y}px`;

    const value = hoveredPoint[currentMetric];
    const formattedValue = Number.isFinite(value) ? value.toFixed(3) : 'N/A';

    content.innerHTML = `
        <div class="tt-coords">Lat ${hoveredPoint.lat.toFixed(5)} · Lon ${hoveredPoint.lon.toFixed(5)}</div>
        <div class="tt-value">${currentMetric === 'difference' ? 'Difference' : currentMetric}: <strong>${formattedValue}</strong></div>
        <div class="tt-parts">
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
