export function drawHyperbolicTree(containerSelector) {
  const width = 800;
  const radius = width / 2;

  const tree = d3
    .tree()
    .size([2 * Math.PI, radius - 100])
    .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

  d3.json("./data/graph.json").then((data) => {
    const root = tree(d3.hierarchy(data));

    const svg = d3
      .select(containerSelector)
      .append("svg")
      .attr("viewBox", [-width / 2, -width / 2, width, width])
      .style("font", "10px sans-serif");

    const link = svg
      .append("g")
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr(
        "d",
        d3
          .linkRadial()
          .angle((d) => d.x)
          .radius((d) => d.y)
      );

    const node = svg
      .append("g")
      .selectAll("circle")
      .data(root.descendants())
      .join("circle")
      .attr(
        "transform",
        (d) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`
      )
      .attr("r", 4)
      .attr("fill", (d) => (d.children ? "#555" : "#999"))
      .on("mouseover", function () {
        d3.select(this).attr("fill", "orange");
      })
      .on("mouseout", function (d) {
        d3.select(this).attr("fill", (d) => (d.children ? "#555" : "#999"));
      });

    svg
      .append("g")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 0.5)
      .selectAll("text")
      .data(root.descendants())
      .join("text")
      .attr(
        "transform",
        (d) =>
          `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0) rotate(${
            d.x >= Math.PI ? 180 : 0
          })`
      )
      .attr("dy", "0.31em")
      .attr("x", (d) => (d.x < Math.PI ? 6 : -6))
      .attr("text-anchor", (d) => (d.x < Math.PI ? "start" : "end"))
      .text((d) => d.data.name);
  });
}

