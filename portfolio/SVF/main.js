const CONFIG = {
    dataUrl: 'svf-points.v2.json',
    // extent of the data (from svf-points.min.json); the map opens here directly,
    // so tiles are fetched once instead of for a default view and then again
    bounds: [[37.708258, -122.511657], [37.829986, -122.350207]],
    pointRadius: 2,
    hoverRadius: 10,
    hoverCellSize: 24,
    bins: 24,
    // bars in the sidebar histogram (which doubles as the colour legend)
    histBuckets: 36,
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
// per metric: the value range the colours span, the colour bin of every point
// (-1 = no value), each bin's colour / radius, and the order bins are painted in
let domains = {};
let pointBins = {};
let palettes = {};
let drawOrders = {};
let histograms = {};
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
        renderLegend();
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
        buildDomains();
        buildPalettes();
        renderLegend();
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
        renderLegend();
        requestDraw();
    });
}

/* ---- colours --------------------------------------------------------------
   Points are grouped into CONFIG.bins colour bins per metric, so drawing is one
   path + one fill per bin instead of a fillStyle change per point. Colours come
   from the --svf-* tokens in style.css (light and dark); the same bins colour
   the sidebar histogram, so map and legend cannot drift apart. */

function readColor(name) {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

// The range each metric's colours span. SVF itself runs 0..1. The difference is
// taken from the data (1st..99th percentile, rounded outwards to 0.01): in the
// San Francisco set every value is positive and 98% fall within 0.04..0.28, so
// a fixed -1..1 scale would paint the whole city in one pale tone.
function buildDomains() {
    const values = dataPoints.map((p) => p.difference).filter(Number.isFinite).sort((a, b) => a - b);
    const at = (q) => values[Math.floor(q * (values.length - 1))];
    const lo = Math.floor(at(0.01) * 100) / 100;
    const hi = Math.ceil(at(0.99) * 100) / 100;

    if (lo < 0 && hi > 0) {
        const m = Math.max(-lo, hi);
        domains.difference = { min: -m, max: m, diverging: true };
    } else {
        domains.difference = { min: lo, max: hi, diverging: false };
    }
    ['lidar_svf', 'gsv_svf', 'KR_PC_SVF'].forEach((m) => { domains[m] = { min: 0, max: 1, diverging: false }; });

    METRICS.forEach((m) => {
        const bins = new Int8Array(dataPoints.length);
        const counts = new Array(CONFIG.histBuckets).fill(0);
        const { min, max } = domains[m];
        let sum = 0;
        let n = 0;
        dataPoints.forEach((p, i) => {
            const value = p[m];
            bins[i] = binFor(m, value);
            if (!Number.isFinite(value)) return;
            const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
            counts[Math.min(CONFIG.histBuckets - 1, Math.floor(t * CONFIG.histBuckets))] += 1;
            sum += value;
            n += 1;
        });
        pointBins[m] = bins;
        histograms[m] = { counts, mean: n ? sum / n : NaN, n };
    });
}

function buildPalettes() {
    const zero = readColor('--svf-zero');
    const pos = readColor('--svf-pos');
    const deep = readColor('--svf-pos-deep');
    const neg = readColor('--svf-neg');
    const low = readColor('--svf-low');
    const high = readColor('--svf-high');
    const entry = (c, alpha, emphasis) => ({
        color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`,
        solid: `rgb(${c[0]}, ${c[1]}, ${c[2]})`,
        radius: CONFIG.pointRadius + emphasis * 1.5,
        emphasis
    });

    // difference. One-sided data: paper tone -> red -> deep red along the range.
    // Data on both sides of zero: cobalt <- paper -> red, symmetric about zero.
    const diverging = domains.difference && domains.difference.diverging;
    palettes.difference = [];
    for (let b = 0; b < CONFIG.bins; b += 1) {
        const t = (b + 0.5) / CONFIG.bins;
        if (diverging) {
            const magnitude = Math.abs(2 * t - 1);
            palettes.difference.push(entry(mix(zero, t < 0.5 ? neg : pos, magnitude), 0.65 + 0.3 * magnitude, magnitude));
        } else {
            const c = t < 0.6 ? mix(zero, pos, t / 0.6) : mix(pos, deep, (t - 0.6) / 0.4);
            palettes.difference.push(entry(c, 0.7 + 0.25 * t, t));
        }
    }

    // single sources: low -> high SVF along one ramp
    const ramp = [];
    for (let b = 0; b < CONFIG.bins; b += 1) {
        const t = (b + 0.5) / CONFIG.bins;
        ramp.push(entry(mix(low, high, t), 0.45 + 0.4 * t, t));
    }
    ['lidar_svf', 'gsv_svf', 'KR_PC_SVF'].forEach((m) => { palettes[m] = ramp; });

    // paint the quiet bins first, so the strongest values end up on top where points overlap
    METRICS.forEach((m) => {
        drawOrders[m] = palettes[m].map((_, b) => b).sort((a, b) => palettes[m][a].emphasis - palettes[m][b].emphasis);
    });
}

function binFor(metric, value) {
    if (!Number.isFinite(value)) return -1;
    const { min, max } = domains[metric];
    const t = (value - min) / (max - min);
    return Math.min(CONFIG.bins - 1, Math.max(0, Math.floor(t * CONFIG.bins)));
}

/* ---- legend ---------------------------------------------------------------
   A histogram of every location's value for the selected source, each bar in
   the colour its points have on the map, over a strip of the full colour ramp:
   the legend and the distribution in one. Hovering a point marks its value. */

const LEGEND = { width: 300, top: 14, barsHeight: 50, stripHeight: 6, gap: 3 };
const LEGEND_TITLES = {
    difference: 'Difference in SVF: roadway − sidewalk',
    lidar_svf: 'Airborne LiDAR SVF (0 = no sky, 1 = open sky)',
    gsv_svf: 'Google Street View SVF (0 = no sky, 1 = open sky)',
    KR_PC_SVF: 'Generated point cloud SVF (0 = no sky, 1 = open sky)'
};

function legendX(metric, value) {
    const { min, max } = domains[metric];
    return Math.min(1, Math.max(0, (value - min) / (max - min))) * LEGEND.width;
}

function renderLegend() {
    const svg = document.getElementById('legend-chart');
    const hist = histograms[currentMetric];
    const palette = palettes[currentMetric];
    if (!svg || !hist || !palette) return;

    const { min, max } = domains[currentMetric];
    const { width, top, barsHeight, stripHeight, gap } = LEGEND;
    const base = top + barsHeight;
    const peak = Math.max(...hist.counts);
    const bucketWidth = width / CONFIG.histBuckets;
    const parts = [];

    hist.counts.forEach((count, i) => {
        if (!count) return;
        const h = Math.max(1, (count / peak) * barsHeight);
        const bin = Math.min(CONFIG.bins - 1, Math.floor(((i + 0.5) / CONFIG.histBuckets) * CONFIG.bins));
        parts.push(`<rect x="${(i * bucketWidth + 0.5).toFixed(2)}" y="${(base - h).toFixed(2)}" width="${(bucketWidth - 1).toFixed(2)}" height="${h.toFixed(2)}" fill="${palette[bin].solid}"/>`);
    });

    const binWidth = width / CONFIG.bins;
    palette.forEach((p, b) => {
        parts.push(`<rect x="${(b * binWidth).toFixed(2)}" y="${base + gap}" width="${(binWidth + 0.5).toFixed(2)}" height="${stripHeight}" fill="${p.solid}"/>`);
    });

    // ticks at round values inside the range
    const step = (max - min) <= 0.5 ? 0.05 : 0.25;
    const tickY = base + gap + stripHeight;
    for (let k = Math.ceil((min - 1e-9) / step); k * step <= max + 1e-9; k += 1) {
        const value = k * step;
        const x = legendX(currentMetric, value);
        const anchor = x < 8 ? 'start' : x > width - 8 ? 'end' : 'middle';
        parts.push(`<path class="legend-tick" d="M${x.toFixed(2)} ${tickY} v4"/>`);
        parts.push(`<text class="legend-label" x="${x.toFixed(2)}" y="${tickY + 14}" text-anchor="${anchor}">${value.toFixed(2)}</text>`);
    }

    if (Number.isFinite(hist.mean)) {
        const x = legendX(currentMetric, hist.mean);
        const anchor = x < 40 ? 'start' : x > width - 40 ? 'end' : 'middle';
        parts.push(`<path class="legend-mean" d="M${x.toFixed(2)} ${top - 2} V${base}"/>`);
        parts.push(`<text class="legend-label legend-label--mean" x="${x.toFixed(2)}" y="${top - 5}" text-anchor="${anchor}">mean ${hist.mean.toFixed(2)}</text>`);
    }

    parts.push(`<path id="legend-marker" class="legend-marker" d="M0 ${base + gap - 1} l-4 -7 h8 z" visibility="hidden"/>`);
    svg.innerHTML = parts.join('');

    document.getElementById('legend-title').textContent = LEGEND_TITLES[currentMetric];
    const clipped = currentMetric === 'difference'
        ? ` Values outside ${min.toFixed(2)}–${max.toFixed(2)} take the end colours.` : '';
    document.getElementById('legend-note').textContent =
        `Bars: how many of the ${hist.n.toLocaleString()} locations have each value, in the colour they have on the map.${clipped}`;
}

function markLegend(value) {
    const marker = document.getElementById('legend-marker');
    if (!marker) return;
    if (!Number.isFinite(value)) {
        marker.setAttribute('visibility', 'hidden');
        return;
    }
    marker.setAttribute('transform', `translate(${legendX(currentMetric, value).toFixed(2)} 0)`);
    marker.setAttribute('visibility', 'visible');
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
    // dots shrink when zoomed out (so the street pattern shows instead of one
    // merged blob) and grow a little when zoomed in
    const zoomScale = Math.min(2, Math.max(0.5, Math.pow(2, (map.getZoom() - 14) / 2)));
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

        const r = palette[bin].radius * zoomScale;
        paths[bin].moveTo(screenPoint.x + r, screenPoint.y);
        paths[bin].arc(screenPoint.x, screenPoint.y, r, 0, Math.PI * 2);

        const indexedPoint = { point, x: screenPoint.x, y: screenPoint.y };
        addToHoverGrid(indexedPoint);
        visibleCount += 1;

        if (point === hoveredPoint) {
            hoveredScreenPoint = indexedPoint;
        }
    }

    drawOrders[currentMetric].forEach((bin) => {
        ctx.fillStyle = palette[bin].color;
        ctx.fill(paths[bin]);
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
    markLegend(NaN);

    if (hadHover && redraw) {
        requestDraw();
    }
}

function updateTooltip(x, y) {
    const tooltip = document.getElementById('tooltip');
    const content = document.getElementById('tooltip-content');

    markLegend(hoveredPoint ? hoveredPoint[currentMetric] : NaN);

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
