export interface HighwayRoute {
  ref: string;
  name: string;
  from: string;
  to: string;
  start: [number, number];
  end: [number, number];
  km: number;
  segments: [number, number][][];
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function hav(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function wayLength(geom: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < geom.length; i++) len += hav(geom[i - 1], geom[i]);
  return len;
}

async function overpassQuery(query: string): Promise<unknown> {
  const trimmedQuery = query.trim();
  try {
    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(trimmedQuery),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!resp.ok) {
      throw new Error(`Overpass API error: ${resp.status} ${resp.statusText}`);
    }
    return await resp.json();
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  members?: Array<{ type: string; ref: number; role?: string }>;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length <= 2) return pts;
  let maxD = 0, maxI = 0;
  const s = pts[0], e = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const dx = e[0] - s[0], dy = e[1] - s[1];
    const mag = Math.sqrt(dx * dx + dy * dy);
    let d: number;
    if (mag === 0) d = Math.hypot(pts[i][0] - s[0], pts[i][1] - s[1]);
    else {
      const t = ((pts[i][0] - s[0]) * dx + (pts[i][1] - s[1]) * dy) / (mag * mag);
      d = Math.hypot(pts[i][0] - (s[0] + t * dx), pts[i][1] - (s[1] + t * dy));
    }
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tol) {
    const left = simplify(pts.slice(0, maxI + 1), tol);
    const right = simplify(pts.slice(maxI), tol);
    return left.slice(0, -1).concat(right);
  }
  return [s, e];
}

export async function queryHighway(ref: string): Promise<HighwayRoute> {
  const cleanRef = ref.toUpperCase().replace(/^G/, '');
  const fullRef = 'G' + cleanRef;

  const superrouteQuery = `
    [out:json][timeout:60];
    relation["type"="superroute"]["ref"~"${fullRef}|${cleanRef}"]["network"~"CN:national|CN"];
    out tags;
  `;

  const superResult = await overpassQuery(superrouteQuery) as OverpassResponse;
  const superroutes = superResult.elements.filter(e => e.type === 'relation');

  if (superroutes.length === 0) {
    throw new Error(`未找到国道 ${fullRef} 的路线数据`);
  }

  const superrouteId = superroutes[0].id;
  const superrouteName = superroutes[0].tags?.name || fullRef;

  const subRelQuery = `
    [out:json][timeout:60];
    relation(${superrouteId});
    out body;
  `;

  const subResult = await overpassQuery(subRelQuery) as OverpassResponse;
  const subRelations: number[] = [];

  for (const el of subResult.elements) {
    if (el.type === 'relation' && el.members) {
      for (const m of el.members) {
        if (m.type === 'relation') {
          subRelations.push(m.ref);
        }
      }
    }
  }

  if (subRelations.length === 0) {
    throw new Error(`国道 ${fullRef} 没有子路线数据`);
  }

  interface WayData {
    id: number;
    geom: [number, number][];
    len: number;
    dir: [number, number];
    mid: [number, number];
    kept: boolean;
  }

  const allWays: WayData[] = [];
  const BATCH_SIZE = 3;

  for (let i = 0; i < subRelations.length; i += BATCH_SIZE) {
    const batch = subRelations.slice(i, i + BATCH_SIZE);
    const relUnion = batch.map(id => `relation(${id})`).join(';');

    const waysQuery = `
      [out:json][timeout:120];
      (${relUnion});
      way(r)["highway"~"trunk|primary"];
      out geom;
    `;

    const waysResult = await overpassQuery(waysQuery) as OverpassResponse;

    for (const el of waysResult.elements) {
      if (el.type === 'way' && el.geometry && el.geometry.length > 1) {
        const geom: [number, number][] = el.geometry.map(pt => [pt.lon, pt.lat] as [number, number]);
        const len = wayLength(geom);
        const dx = geom[geom.length - 1][0] - geom[0][0];
        const dy = geom[geom.length - 1][1] - geom[0][1];
        const m = Math.hypot(dx, dy);
        const dir: [number, number] = m > 0 ? [dx / m, dy / m] : [0, 0];
        const mid = geom[Math.floor(geom.length / 2)];

        allWays.push({ id: el.id, geom, len, dir, mid, kept: true });
      }
    }

    if (i + BATCH_SIZE < subRelations.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (allWays.length === 0) {
    throw new Error(`国道 ${fullRef} 没有道路几何数据`);
  }

  const GRID = 0.02;
  const grid = new Map<string, number[]>();

  for (let i = 0; i < allWays.length; i++) {
    const w = allWays[i];
    const k = Math.floor(w.mid[0] / GRID) + ',' + Math.floor(w.mid[1] / GRID);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(i);
  }

  for (let i = 0; i < allWays.length; i++) {
    if (!allWays[i].kept) continue;
    const w = allWays[i];
    const gc = Math.floor(w.mid[0] / GRID);
    const gr = Math.floor(w.mid[1] / GRID);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const k = (gc + dc) + ',' + (gr + dr);
        const cell = grid.get(k);
        if (!cell) continue;
        for (const j of cell) {
          if (j <= i || !allWays[j].kept) continue;
          const other = allWays[j];
          const midDist = hav(w.mid, other.mid);
          if (midDist > 200) continue;
          const dot = w.dir[0] * other.dir[0] + w.dir[1] * other.dir[1];
          if (dot > -0.8) continue;
          if (w.len < other.len) {
            allWays[i].kept = false;
          } else {
            allWays[j].kept = false;
          }
        }
      }
    }
  }

  const keptWays = allWays.filter(w => w.kept && w.len >= 50);
  const totalLen = keptWays.reduce((s, w) => s + w.len, 0);

  const segments: [number, number][][] = keptWays.map(w => {
    const simplified = simplify(w.geom, 0.0005);
    return simplified.map(p => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6] as [number, number]);
  });

  let eastPt: [number, number] = keptWays[0].geom[0];
  let westPt: [number, number] = keptWays[0].geom[0];
  for (const w of keptWays) {
    for (const pt of w.geom) {
      if (pt[0] > eastPt[0]) eastPt = pt;
      if (pt[0] < westPt[0]) westPt = pt;
    }
  }

  const nameMatch = superrouteName.match(/(.+)[—\-–](.+)/);
  const from = nameMatch ? nameMatch[1].trim() : '起点';
  const to = nameMatch ? nameMatch[2].trim() : '终点';

  return {
    ref: fullRef,
    name: superrouteName,
    from,
    to,
    start: [Math.round(eastPt[0] * 1e6) / 1e6, Math.round(eastPt[1] * 1e6) / 1e6],
    end: [Math.round(westPt[0] * 1e6) / 1e6, Math.round(westPt[1] * 1e6) / 1e6],
    km: Math.round(totalLen / 1000),
    segments,
  };
}
