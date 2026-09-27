"""Pack portfolio/SVF/svf-points.min.json into the compact file the map loads.

Source rows are [lat, lon, lidar, gsv, pc, left, right] (lat/lon with 6 decimals,
SVF values with 4). The packed file is column-oriented and lossless:
  * points are sorted in a serpentine order through 0.004-degree latitude bands,
    so neighbouring rows are neighbours on the map;
  * lat/lon are integers in 1e-6 degrees, stored as deltas from the previous point
    (the first delta is from 0, i.e. the absolute value);
  * pc is an integer in 1e-4; lidar, gsv, left and right are stored relative to pc.
Decoding (portfolio/SVF/main.js, decodePoints) is a single pass of running sums.
Rerun after replacing svf-points.min.json; it verifies the round trip before writing.
"""
from pathlib import Path
import json
import math

SVF = Path(__file__).resolve().parents[1] / 'portfolio' / 'SVF'
rows = json.loads((SVF / 'svf-points.min.json').read_text(encoding='utf-8'))

CELL = 0.004
def order(r):
    band = math.floor(r[0] / CELL)
    return (band, r[1] if band % 2 == 0 else -r[1])
rows = sorted(rows, key=order)

cols = {k: [] for k in ('lat', 'lon', 'pc', 'lidar', 'gsv', 'left', 'right')}
prev_lat = prev_lon = 0
for lat, lon, lidar, gsv, pc, left, right in rows:
    a, o = round(lat * 1e6), round(lon * 1e6)
    cols['lat'].append(a - prev_lat)
    cols['lon'].append(o - prev_lon)
    prev_lat, prev_lon = a, o
    p = round(pc * 1e4)
    cols['pc'].append(p)
    for key, value in (('lidar', lidar), ('gsv', gsv), ('left', left), ('right', right)):
        cols[key].append(round(value * 1e4) - p)

# round trip: every source value must come back exactly
lat = lon = 0
for i, (s_lat, s_lon, *s_vals) in enumerate(rows):
    lat += cols['lat'][i]
    lon += cols['lon'][i]
    p = cols['pc'][i]
    decoded = [lat / 1e6, lon / 1e6, (cols['lidar'][i] + p) / 1e4, (cols['gsv'][i] + p) / 1e4,
               p / 1e4, (cols['left'][i] + p) / 1e4, (cols['right'][i] + p) / 1e4]
    assert decoded == [s_lat, s_lon, *s_vals], (i, decoded, [s_lat, s_lon, *s_vals])

packed = {'format': 'svf-points/2', 'count': len(rows), **cols}
out = SVF / 'svf-points.v2.json'
out.write_text(json.dumps(packed, separators=(',', ':')), encoding='utf-8')
print(f'{len(rows)} points, round trip exact, wrote {out.name} ({out.stat().st_size:,} bytes)')
