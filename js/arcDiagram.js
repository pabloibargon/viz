/**
 * Ensure trade_data table exists in DuckDB.
 */
async function ensureTradeTable(conn, db) {
  const tables = await conn.query("PRAGMA show_tables");
  const names = tables.toArray().map(r => r.name);

  if (!names.includes("trade_data")) {
    const resp = await fetch("data/trade_data.parquet");
    if (!resp.ok) throw new Error("Failed to fetch trade_data.parquet");
    const buffer = await resp.arrayBuffer();

    await db.registerFileBuffer("trade_data.parquet", new Uint8Array(buffer));
    await conn.query(`
      CREATE TABLE trade_data AS SELECT * FROM read_parquet('trade_data.parquet')
    `);
  }
}

/**
 * Get trade data for a given year.
 */
export async function getTradeData(year) {
  const query = `
    SELECT partner, geo, SUM(total) AS total
    FROM trade_data
    WHERE TIME_PERIOD = ${year}
      AND partner != 'EU27_2020'
      AND geo != 'EU27_2020'
    GROUP BY partner, geo
    HAVING SUM(total) > 0
  `;
  const result = await window.duckdb_conn.query(query);
  return result.toArray();
}

/**
 * Mapping from country code → full name
 */
const countryMap = {
  AL: "Albania", AT: "Austria", BA: "Bosnia and Herzegovina", BE: "Belgium",
  BG: "Bulgaria", CY: "Cyprus", CZ: "Czech Republic", DE: "Germany",
  DK: "Denmark", EE: "Estonia", EL: "Greece", ES: "Spain",
  FI: "Finland", FR: "France", HR: "Croatia", HU: "Hungary",
  IE: "Ireland", IT: "Italy", LT: "Lithuania", LU: "Luxembourg",
  LV: "Latvia", ME: "Montenegro", MK: "North Macedonia", MT: "Malta",
  NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania",
  RS: "Serbia", SE: "Sweden", SI: "Slovenia", SK: "Slovakia",
  TR: "Turkey", UK: "United Kingdom", XK: "Kosovo"
};

/**
 * Render the arc diagram given prepared data.
 */
export async function renderArcDiagram(containerSelector, data, year, selectedCountries) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  const width = 800;
  const height = 500;
  const margin = { top: 20, right: 30, bottom: 200, left: 30 };
  const baseline = height - margin.bottom;
  const nodeRadius = 6;

  // Filter by selected countries if provided
  let filtered = data;
  if (selectedCountries && selectedCountries.length > 0) {
    filtered = data.filter(d =>
      selectedCountries.includes(d.partner) || selectedCountries.includes(d.geo)
    );
  }

  // Get unique nodes and links
  const nodes = Array.from(
    new Set([...filtered.map(d => d.partner), ...filtered.map(d => d.geo)]),
    id => ({ id })
  );
  const links = filtered.map(d => ({
    source: d.partner,
    target: d.geo,
    value: d.total,
  }));

  // Scales
  const x = d3.scalePoint()
    .domain(nodes.map(d => d.id))
    .range([margin.left, width - margin.right]);

  const strokeScale = d3.scaleSqrt()
    .domain(d3.extent(links, d => d.value))
    .range([0.5, 4]);

  // Create SVG
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  // State for selection
  let selectedNode = null;

  // Draw arcs
  const arcGroup = svg.append("g")
    .attr("fill", "none")
    .attr("stroke", "#555")
    .attr("opacity", 0.7);

  const arcs = arcGroup.selectAll("path")
    .data(links)
    .join("path")
    .attr("stroke-width", d => strokeScale(d.value))
    .attr("d", d => {
      const start = x(d.source);
      const end = x(d.target);
      const radius = Math.abs(end - start) / 2;
      return `M${start},${baseline} Q${(start + end) / 2},${baseline - radius} ${end},${baseline}`;
    })
    .attr("data-source", d => d.source)
    .attr("data-target", d => d.target);

  // Draw nodes
  const nodeGroup = svg.append("g");

  nodeGroup.selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", d => x(d.id))
    .attr("cy", baseline)
    .attr("r", nodeRadius)
    .attr("fill", "#1f77b4")
    .style("cursor", "pointer")
    .on("mouseover", function () {
      d3.select(this).attr("r", nodeRadius * 1.4);
    })
    .on("mouseout", function () {
      d3.select(this).attr("r", nodeRadius);
    })
    .on("click", function (event, d) {
      if (selectedNode === d.id) {
        // Deselect if clicked again
        selectedNode = null;
        arcs.attr("stroke", "#555").attr("opacity", 0.7);
        d3.selectAll("circle").attr("fill", "#1f77b4");
      } else {
        // Select node and highlight connected arcs
        selectedNode = d.id;
        arcs
          .attr("stroke", a =>
            a.source === d.id || a.target === d.id ? "orange" : "#ccc"
          )
          .attr("opacity", a =>
            a.source === d.id || a.target === d.id ? 1 : 0.3
          );
        d3.selectAll("circle")
          .attr("fill", c =>
            c.id === d.id ? "orange" : "#1f77b4"
          );
      }
    });

  // Node labels
  nodeGroup.selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", d => x(d.id))
    .attr("y", baseline + 18)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .text(d => d.id);
}

/**
 * Main function that manages controls and re-renders the arc diagram.
 */
export async function drawArcDiagram(
  containerSelector = "#viz",
  conn = window.duckdb_conn,
  selectedYear = null,
  selectedCountries = ['ES', 'FR', 'DE', 'AT', 'BE', 'BG']
) {
  await ensureTradeTable(conn, window.duckdb_db);

  // Get available years
  const yearsResult = await conn.query("SELECT DISTINCT TIME_PERIOD FROM trade_data ORDER BY TIME_PERIOD");
  const years = yearsResult.toArray().map(r => r.TIME_PERIOD);
  const year = selectedYear ?? years[years.length - 1];

  const data = await getTradeData(year);

  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  let controls = d3.select("#arc-controls");
  if (controls.empty()) {
    controls = d3.select(container.node().parentNode)
      .insert("div", containerSelector)
      .attr("id", "arc-controls")
      .style("margin-bottom", "1em");

    controls.append("label").text("Year: ");
    const yearSelect = controls.append("select").attr("id", "year-select");

    yearSelect
      .selectAll("option")
      .data(years)
      .join("option")
      .attr("value", d => d)
      .text(d => d)
      .property("selected", d => d === year);

    controls.append("label").text(" Countries: ");
    const countrySelect = controls.append("select")
      .attr("id", "country-select")
      .attr("multiple", true)
      .attr("size", 7);

    countrySelect
      .selectAll("option")
      .data(Object.entries(countryMap))
      .join("option")
      .attr("value", d => d[0])
      .property("selected", d => selectedCountries.includes(d[0]))
      .text(d => `${d[0]} — ${d[1]}`);
  }

  d3.select("#year-select").on("change", function () {
    const newYear = +this.value;
    drawArcDiagram(containerSelector, conn, newYear, selectedCountries);
  });

  d3.select("#country-select").on("change", function () {
    const selected = Array.from(this.selectedOptions).map(opt => opt.value).slice(0, 7);
    drawArcDiagram(containerSelector, conn, year, selected);
  });
  let filteredData = data;
  if (selectedCountries.length > 0) {
    filteredData = data.filter(d =>
      selectedCountries.includes(d.geo) && selectedCountries.includes(d.partner)
    );
  }
  // Render the actual diagram
  renderArcDiagram(containerSelector, filteredData, year, selectedCountries);
}
