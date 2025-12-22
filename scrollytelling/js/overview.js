/**
 * ACTO I: LA MAREA ALTA (Con silueta resaltada y Anotación de Agosto)
 */
export function drawOverview(containerId, data) {
    const d3 = window.d3;
    const container = d3.select(containerId);
    
    container.html(""); 
    const width = 800;
    const height = 450;
    const margin = {top: 120, right: 30, bottom: 50, left: 60};

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Preparación de datos cronológica
    const monthOrder = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    const nestedData = monthOrder.map(month => {
        const obs = { month: month };
        data.filter(d => d.arrival_date_month === month).forEach(d => {
            obs[d.hotel] = Number(d.total);
        });
        return obs;
    });

    // 2. Escalas
    const x = d3.scalePoint()
        .domain(monthOrder)
        .range([0, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(nestedData, d => (d["City Hotel"] || 0) + (d["Resort Hotel"] || 0))])
        .nice()
        .range([height - margin.top - margin.bottom, 0]);

    // 3. Stack y Generadores (Area y Línea fluida)
    const stack = d3.stack().keys(["Resort Hotel", "City Hotel"]);
    const series = stack(nestedData);

    const areaGen = d3.area()
        .x(d => x(d.data.month))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis);

    const lineGen = d3.line()
        .x(d => x(d.data.month))
        .y(d => y(d[1])) // Sigue el borde superior
        .curve(d3.curveBasis);

    // 4. ClipPath para la animación de entrada
    svg.append("defs")
        .append("clipPath")
        .attr("id", "rect-clip")
        .append("rect")
        .attr("width", 0)
        .attr("height", height)
        .transition()
        .duration(2200)
        .ease(d3.easeCubicInOut)
        .attr("width", width);

    const mainGroup = svg.append("g").attr("clip-path", "url(#rect-clip)");

    // 5. Dibujar Relleno de Áreas
    mainGroup.selectAll(".area")
        .data(series)
        .join("path")
        .attr("fill", d => d.key === "City Hotel" ? "#3e84a8" : "#ffcc33")
        .attr("opacity", 0.6)
        .attr("d", areaGen);

    // 6. Dibujar Líneas de Contorno (Resaltado)
    mainGroup.selectAll(".line")
        .data(series)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", d => d.key === "City Hotel" ? "#2C5F78" : "#E1AD01")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("d", lineGen);

    // 7. EL PICO DE AGOSTO (Anotación recuperada)
    const augustData = nestedData.find(d => d.month === "August");
    const peakY = y(augustData["City Hotel"] + augustData["Resort Hotel"]);

    const annotation = svg.append("g")
        .attr("transform", `translate(${x("August")}, ${peakY - 15})`)
        .style("opacity", 0);

    annotation.append("text")
        .attr("text-anchor", "middle")
        .text("Pico de Agosto")
        .style("font-family", "'Inter', sans-serif")
        .style("font-size", "13px")
        .style("font-weight", "700")
        .style("fill", "#1a202c");

    // Aparece suavemente después de que la marea termine de revelarse
    annotation.transition()
        .delay(1800)
        .duration(800)
        .style("opacity", 0.7);

    // 8. Ejes y Leyenda
    const xAxis = d3.axisBottom(x).tickFormat(d => d.substring(0, 3));
    
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())
        .selectAll("text")
        .style("font-family", "'Inter', sans-serif")
        .style("font-weight", "500")
        .style("fill", "#666");

    const legend = svg.append("g").attr("transform", `translate(20, -20)`);
    const labels = [
        { name: "Lisboa (Urbano)", color: "#3e84a8" },
        { name: "Algarve (Resort)", color: "#ffcc33" }
    ];

    labels.forEach((l, i) => {
        const g = legend.append("g").attr("transform", `translate(${i * 180}, 0)`);
        g.append("rect").attr("width", 14).attr("height", 14).attr("rx", 4).attr("fill", l.color);
        g.append("text").attr("x", 22).attr("y", 12).text(l.name)
            .style("font-family", "'Inter', sans-serif").style("font-size", "14px").style("font-weight", "600");
    });
}
