export function drawArcDiagram(containerSelector) {
  const width = 800;
  const height = 400;

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

  const svg = d3
    .select(containerSelector)
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .style("font", "10px sans-serif");

  const x = d3
    .scalePoint()
    .domain(nodes.map((d) => d.id))
    .range([50, width - 50]);

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
      const arcPath = `M${start},${height / 2} A${radius},${radius} 0 0,1 ${end},${height / 2}`;
      return arcPath;
    });

  // Draw nodes
  svg
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", (d) => x(d.id))
    .attr("cy", height / 2)
    .attr("r", 6)
    .attr("fill", "#1f77b4")
    .on("mouseover", function () {
      d3.select(this).attr("fill", "orange");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#1f77b4");
    });

  svg
    .append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", (d) => x(d.id))
    .attr("y", height / 2 + 20)
    .attr("text-anchor", "middle")
    .text((d) => d.id);
}

