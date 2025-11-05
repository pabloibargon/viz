import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { geoPath, geoMercator } from "https://cdn.jsdelivr.net/npm/d3-geo@3/+esm";

async function fetchGzipJSON(url) {
  const response = await fetch(url);
  const ds = new DecompressionStream("gzip");
  const decompressedStream = response.body.pipeThrough(ds);
  const text = await new Response(decompressedStream).text();
  return JSON.parse(text);
}

async function fetchGzipTSV(url) {
  const response = await fetch(url);
  const ds = new DecompressionStream("gzip");
  const decompressedStream = response.body.pipeThrough(ds);
  const text = await new Response(decompressedStream).text();
  return d3.tsvParse(text, d3.autoType);
}

export async function drawDotDensityMap(geojsonUrl, tsvUrl, containerSelector = "#viz") {
  // Clear old content
  const container = document.querySelector(containerSelector);
  container.innerHTML = "";

  // Load data
  const [geojson, dataTSV] = await Promise.all([
    fetchGzipJSON(geojsonUrl),
    fetchGzipTSV(tsvUrl)
  ]);

  // Build lookup for population by region
  const popByName = new Map(dataTSV.map(d => [d.NOMBRE, d.POB22]));

  // Define projection and path
  const width = 900, height = 800;
  const projection = geoMercator().fitSize([width, height], geojson);
  const path = geoPath(projection);

  const svg = d3.select(containerSelector)
    .html("")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#f9f9f9");

  // Dot parameters
  const dotsPer = 1000; // 1 dot = 1000 people

  // --- Helpers ---

  // Get projected outer ring of a feature
  function getProjectedOuterRing(feature) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      return geom.coordinates[0].map(c => projection(c));
    } else if (geom.type === "MultiPolygon") {
      // choose the largest ring
      let best = null, bestArea = -Infinity;
      for (const poly of geom.coordinates) {
        const ring = poly[0].map(c => projection(c));
        const xs = ring.map(p => p[0]);
        const ys = ring.map(p => p[1]);
        const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
        if (area > bestArea) {
          bestArea = area;
          best = ring;
        }
      }
      return best;
    }
    return null;
  }

  // Generate a random point within the projected polygon ring
  function randomPointInProjectedPolygon(ring, maxAttempts = 3000) {
    const xs = ring.map(p => p[0]);
    const ys = ring.map(p => p[1]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);

    for (let i = 0; i < maxAttempts; i++) {
      const x = xMin + Math.random() * (xMax - xMin);
      const y = yMin + Math.random() * (yMax - yMin);
      if (d3.polygonContains(ring, [x, y])) return [x, y];
    }
    // fallback if polygon too small or complex
    return projection(d3.geoCentroid({ type: "Feature", geometry: { type: "Polygon", coordinates: [ring.map(p => projection.invert(p))] } }));
  }

  // --- Generate dots ---
  const dots = [];
  for (const f of geojson.features) {
    const name = f.properties.NAMEUNIT;
    const pop = popByName.get(name);
    if (!pop) continue;

    const nDots = Math.floor(pop / dotsPer);
    if (nDots <= 0) continue;

    const ring = getProjectedOuterRing(f);
    if (!ring) continue;

    for (let i = 0; i < nDots; i++) {
      const pt = randomPointInProjectedPolygon(ring);
      if (pt) dots.push(pt);
    }
  }

  // --- Draw ---
  svg.append("g")
    .attr("fill", "steelblue")
    .attr("fill-opacity", 0.5)
    .selectAll("circle")
    .data(dots)
    .join("circle")
    .attr("r", 1.2)
    .attr("cx", d => d[0])
    .attr("cy", d => d[1]);

  console.log(`Rendered ${dots.length} dots (~${dots.length * dotsPer} population)`);
}
