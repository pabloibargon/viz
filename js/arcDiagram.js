export function drawArcDiagram(containerSelector) {
  const container = d3.select(containerSelector);
  const width = container.node().clientWidth || 800;
  const baseHeight = 200; // minimum height for nodes
  const nodeSpacing = 50; // horizontal spacing padding
  const nodeRadius = 6;

  const nodes = [
    { id: "A" },
    { id: "B" },
    { id: "C" },
    { id: "D" },
    { id: "E" },
    { id: "F" }
  ];

  const links = [
    { source: "A", target: "C" },
    { source: "A", target: "E" },
    { source: "B", target: "D" },
    { source: "C", target: "F" },
    { source: "E", target: "F" }
  ];

  // Clear previous content
  container.selectAll("*").remove();

  const x = d3
    .scalePoint()
    .domain(nodes.map((d) => d.id))
    .range([nodeSpacing, width - nodeSpacing])
    .padding(0.5);

  // Compute max arc radius to dynamically adjust baseline
  const maxRadius = d3.max(links, (d) => Math.abs(x(d.target) - x(d.source)) / 2);

  const baseline = baseHeight + maxRadius + nodeRadius; // dynamic baseline
  const totalHeight = baseline + nodeRadius + 40; // extra bottom space

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", totalHeight)
    .style("font", "10px sans-serif");

  // Draw arcs
  svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke", "#555")
    .attr("stroke-width", 1.5)
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("d", (d) => {
      const start = x(d.source);
      const end = x(d.target);
      const radius = Math.abs(end - start) / 2;
      return `M${start},${baseline} A${radius},${radius} 0 0,1 ${end},${baseline}`;
    });

  // Draw nodes
  svg
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", (d) => x(d.id))
    .attr("cy", baseline)
    .attr("r", nodeRadius)
    .attr("fill", "#1f77b4")
    .on("mouseover", function () {
      d3.select(this).attr("fill", "orange");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#1f77b4");
    });

  // Draw labels
  svg
    .append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", (d) => x(d.id))
    .attr("y", baseline + 20)
    .attr("text-anchor", "middle")
    .text((d) => d.id);
}
