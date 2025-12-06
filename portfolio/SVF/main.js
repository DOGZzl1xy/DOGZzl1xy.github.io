// Configuration
const CONFIG = {
    csvUrl: 'DATA_2022_2024_final.csv',
    startLat: 37.7749,
    startLon: -122.4194,
    zoomLevel: 13,
    pointRadius: 2,
    hoverRadius: 10
};

// State
let map;
let canvasLayer;
let dataPoints = [];
let currentMetric = 'difference';
let canvas;
let ctx;
let animationId;
let hoveredPoint = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    setupControls();
});

function initMap() {
    // Initialize Leaflet Map
    map = L.map('map', {
        center: [CONFIG.startLat, CONFIG.startLon],
        zoom: CONFIG.zoomLevel,
        zoomControl: false,
        preferCanvas: true
    });

    // Add Zoom Control to top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Dark Matter Tiles (CartoDB)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Create Canvas Overlay
    L.CanvasLayer = L.Layer.extend({
        onAdd: function (map) {
            canvas = L.DomUtil.create('canvas', 'leaflet-canvas-layer');
            this._canvas = canvas;

            // Add canvas to the overlay pane
            var pane = map.getPane('overlayPane');
            pane.appendChild(canvas);

            // Calculate initial size
            this._resize();

            // Add listeners
            map.on('moveend', this._reset, this);
            map.on('resize', this._resize, this);

            // Interaction listeners
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseleave', () => {
                hoveredPoint = null;
                document.getElementById('tooltip').classList.add('hidden');
            });

            if (dataPoints.length > 0) {
                this._reset();
            }
        },

        onRemove: function (map) {
            map.getPane('overlayPane').removeChild(this._canvas);
            map.off('moveend', this._reset, this);
            map.off('resize', this._resize, this);
        },

        _resize: function () {
            var size = map.getSize();
            this._canvas.width = size.x;
            this._canvas.height = size.y;
            this._canvas.style.width = size.x + 'px';
            this._canvas.style.height = size.y + 'px';

            // Handle high DPI screens
            var dpr = window.devicePixelRatio || 1;
            this._canvas.width = size.x * dpr;
            this._canvas.height = size.y * dpr;
            ctx = this._canvas.getContext('2d');
            ctx.scale(dpr, dpr);
        },

        _reset: function () {
            var topLeft = map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);
            drawLayer();
        }
    });

    canvasLayer = new L.CanvasLayer();
    canvasLayer.addTo(map);
}

function loadData() {
    Papa.parse(CONFIG.csvUrl, {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: function (results) {
            processData(results.data);
        },
        error: function (err) {
            console.warn("Auto-load failed (likely CORS). Waiting for manual file selection.", err);
            // Don't alert immediately, let the user see the input option
        }
    });
}

function processData(rawData) {
    // Filter valid data
    dataPoints = rawData.filter(row =>
        row.lat_ && row.lon_ &&
        !isNaN(row.lat_) && !isNaN(row.lon_)
    ).map(row => ({
        lat: row.lat_,
        lon: row.lon_,
        lidar_svf: row.lidar_svf,
        gsv_svf: row.gsv_svf,
        KR_PC_SVF: row.KR_PC_SVF,
        SVF_Left: row.SVF_Left,
        SVF_Right: row.SVF_Right,
        difference: (row.KR_PC_SVF !== undefined && row.SVF_Left !== undefined && row.SVF_Right !== undefined)
            ? row.KR_PC_SVF - ((row.SVF_Left + row.SVF_Right) / 2)
            : null,
        // Pre-calculate random phase for animation
        phase: Math.random() * Math.PI * 2
    }));

    console.log(`Loaded ${dataPoints.length} valid points.`);

    // Start animation loop
    startAnimation();

    // Zoom to bounds if we have points
    if (dataPoints.length > 0) {
        const group = new L.featureGroup(dataPoints.map(p => L.marker([p.lat, p.lon])));
        map.fitBounds(group.getBounds());
    }
}

function setupControls() {
    const selector = document.getElementById('svf-source');
    selector.addEventListener('change', (e) => {
        currentMetric = e.target.value;
        // Trigger immediate redraw
        drawLayer();
    });

    // File Input Listener
    // File Input Listener
    const fileInput = document.getElementById('csv-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                Papa.parse(file, {
                    header: true,
                    dynamicTyping: true,
                    complete: function (results) {
                        processData(results.data);
                    },
                    error: function (err) {
                        console.error("Manual parse error:", err);
                        alert("Failed to parse selected file.");
                    }
                });
            }
        });
    }
}

function getPointColor(value) {
    if (currentMetric === 'difference') {
        // Range [-1, 1]
        // Positive -> Red
        // Negative -> Blue
        // 0 -> White (50% opacity)

        const absVal = Math.min(1, Math.abs(value));
        const alpha = 0.5 + (0.5 * absVal);

        let r, g, b;

        if (value >= 0) {
            // White (255,255,255) -> Red (255,0,0)
            r = 255;
            g = Math.round(255 * (1 - absVal));
            b = Math.round(255 * (1 - absVal));
        } else {
            // White (255,255,255) -> Blue (0,0,255)
            r = Math.round(255 * (1 - absVal));
            g = Math.round(255 * (1 - absVal));
            b = 255;
        }

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Map 0-1 to a color gradient
    // Low SVF (0) -> Dark Blue/Purple
    // High SVF (1) -> Bright Cyan/White

    if (value === null || value === undefined) return 'rgba(50, 50, 50, 0.5)';

    // Simple gradient interpolation
    // We'll use HSL for easier brightness control
    // Hue: 240 (Blue) -> 180 (Cyan)
    // Lightness: 20% -> 90%

    const hue = 240 - (value * 60);
    const lightness = 20 + (value * 70);
    const alpha = 0.6 + (value * 0.4);

    return `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
}

function drawLayer() {
    if (!ctx || !map) return;

    const size = map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);

    const time = Date.now() / 1000; // Current time in seconds

    dataPoints.forEach(point => {
        const val = point[currentMetric];
        if (val === null || val === undefined) return;

        // Project lat/lon to pixel coordinates
        const pointPos = map.latLngToContainerPoint([point.lat, point.lon]);

        // Skip if out of bounds (optimization)
        if (pointPos.x < -10 || pointPos.x > size.x + 10 ||
            pointPos.y < -10 || pointPos.y > size.y + 10) {
            return;
        }

        // Animation calculation
        // Pulse size and opacity based on value and time
        const pulse = Math.sin(time * 2 + point.phase); // -1 to 1
        const radius = CONFIG.pointRadius + (val * 1.5) + (pulse * 0.5);

        ctx.beginPath();
        ctx.arc(pointPos.x, pointPos.y, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fillStyle = getPointColor(val);
        ctx.fill();
    });

    // Draw hover effect
    if (hoveredPoint) {
        const pointPos = map.latLngToContainerPoint([hoveredPoint.lat, hoveredPoint.lon]);
        ctx.beginPath();
        ctx.arc(pointPos.x, pointPos.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function startAnimation() {
    if (animationId) cancelAnimationFrame(animationId);

    function animate() {
        drawLayer();
        animationId = requestAnimationFrame(animate);
    }
    animate();
}

function handleMouseMove(e) {
    if (!dataPoints.length) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find nearest point
    // Optimization: Only search visible points or use QuadTree (omitted for simplicity unless needed)
    // For < 10k points, linear search is usually "okay" but we can optimize by map bounds

    let minDist = CONFIG.hoverRadius;
    let nearest = null;

    // Get map bounds to filter search
    const bounds = map.getBounds();

    // We iterate all points - for 100k+ points this will be slow. 
    // If performance is an issue, we need a spatial index.
    // Let's try simple linear search first, assuming < 10k points visible.

    // Optimization: Convert mouse to LatLng once
    const mouseLatLng = map.containerPointToLatLng([mouseX, mouseY]);

    // Simple distance check in LatLng space first (faster than projecting all points)
    // 0.001 degrees is roughly 100 meters
    const searchThreshold = 0.0005;

    for (const point of dataPoints) {
        if (Math.abs(point.lat - mouseLatLng.lat) < searchThreshold &&
            Math.abs(point.lon - mouseLatLng.lng) < searchThreshold) {

            const pointPos = map.latLngToContainerPoint([point.lat, point.lon]);
            const dx = pointPos.x - mouseX;
            const dy = pointPos.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearest = point;
            }
        }
    }

    hoveredPoint = nearest;
    updateTooltip(e.clientX, e.clientY);
}

function updateTooltip(x, y) {
    const tooltip = document.getElementById('tooltip');
    const content = document.getElementById('tooltip-content');

    if (hoveredPoint) {
        tooltip.classList.remove('hidden');
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';

        const val = hoveredPoint[currentMetric];
        const formattedVal = val !== null ? val.toFixed(3) : 'N/A';

        content.innerHTML = `
            <div><strong>Lat:</strong> ${hoveredPoint.lat.toFixed(5)}</div>
            <div><strong>Lon:</strong> ${hoveredPoint.lon.toFixed(5)}</div>
            <hr style="margin: 5px 0; border-color: #444;">
            <div><strong>${currentMetric === 'difference' ? 'Difference' : currentMetric}:</strong> <span style="color: #00ffff">${formattedVal}</span></div>
            <div style="font-size: 0.75rem; color: #aaa;">
                ${currentMetric === 'difference' ? `
                PC: ${hoveredPoint.KR_PC_SVF?.toFixed(3) ?? '-'} <br>
                Left: ${hoveredPoint.SVF_Left?.toFixed(3) ?? '-'} <br>
                Right: ${hoveredPoint.SVF_Right?.toFixed(3) ?? '-'}
                ` : `
                LiDAR: ${hoveredPoint.lidar_svf?.toFixed(2) ?? '-'} <br>
                GSV: ${hoveredPoint.gsv_svf?.toFixed(2) ?? '-'} <br>
                PC: ${hoveredPoint.KR_PC_SVF?.toFixed(2) ?? '-'}
                `}
            </div>
        `;
    } else {
        tooltip.classList.add('hidden');
    }
}
