/**
 * ACTO III: LA PARADOJA DE LA PROXIMIDAD
 * Un radar de dispersión que revela al "Huésped Fantasma" local.
 */
export function drawNationality(containerId, data) {
    const d3 = window.d3;
    const container = d3.select(containerId);
    
    container.html(""); 
    const width = 800;
    const height = 450;
    const margin = {top: 120, right: 80, bottom: 70, left: 80};

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Preparación y limpieza de datos
    const formattedData = data.map(d => ({
        country: d.country,
        volumen: Number(d.volumen),
        precio: Number(d.precio_medio),
        riesgo: Number(d.tasa_cancelacion)
    }));

    // 2. Escalas
    const x = d3.scaleLinear()
        .domain([d3.min(formattedData, d => d.precio) - 5, d3.max(formattedData, d => d.precio) + 5])
        .range([0, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(formattedData, d => d.riesgo) + 10])
        .range([height - margin.top - margin.bottom, 0]);

    const size = d3.scaleSqrt()
        .domain([0, d3.max(formattedData, d => d.volumen)])
        .range([8, 45]);

    // 3. Ejes Estilizados con etiquetas narrativas
    const xAxis = d3.axisBottom(x).ticks(6).tickSize(-height + margin.top + margin.bottom);
    const yAxis = d3.axisLeft(y).ticks(6).tickSize(-width + margin.left + margin.right);

    const gx = svg.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(xAxis)
        .call(g => g.selectAll(".tick line").attr("stroke-opacity", 0.1))
        .call(g => g.select(".domain").attr("stroke-opacity", 0.2));

    const gy = svg.append("g")
        .call(yAxis)
        .call(g => g.selectAll(".tick line").attr("stroke-opacity", 0.1))
        .call(g => g.select(".domain").attr("stroke-opacity", 0.2));

    // Etiquetas de los ejes
    svg.append("text")
        .attr("x", width - margin.left - margin.right)
        .attr("y", height - margin.top - margin.bottom + 40)
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("Precio Medio Diario (ADR) →");

    svg.append("text")
        .attr("x", -height + margin.top + margin.bottom)
        .attr("y", -50)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "start")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("↑ Tasa de Cancelación (%)");

    // 4. Dibujar las Burbujas (Países)
    const bubbles = svg.selectAll(".bubble")
        .data(formattedData)
        .join("g")
        .attr("transform", d => `translate(${x(d.precio)}, ${y(d.riesgo)})`);

    bubbles.append("circle")
        .attr("r", 0) // Empiezan desde cero
        .attr("fill", d => d.country === "PRT" ? "#e74c3c" : "#3e84a8")
        .attr("fill-opacity", 0.6)
        .attr("stroke", d => d.country === "PRT" ? "#c0392b" : "#2C5F78")
        .attr("stroke-width", 2)
        .transition()
        .duration(1200)
        .delay((d, i) => i * 80)
        .attr("r", d => size(d.volumen));

    // Etiquetas de código de país dentro de la burbuja
    bubbles.append("text")
        .attr("dy", "0.3em")
        .attr("text-anchor", "middle")
        .text(d => d.country)
        .style("font-family", "sans-serif")
        .style("font-size", d => size(d.volumen) > 15 ? "11px" : "0px")
        .style("font-weight", "bold")
        .style("fill", "#fff")
        .style("opacity", 0)
        .transition()
        .delay(1500)
        .style("opacity", 1);

    // 5. ANOTACIÓN DE LA PARADOJA (Portugal)
    const prt = formattedData.find(d => d.country === "PRT");
    if (prt) {
        const note = svg.append("g")
            .attr("transform", `translate(${x(prt.precio) + size(prt.volumen) + 10}, ${y(prt.riesgo)})`)
            .style("opacity", 0);

        note.append("text")
            .attr("y", -10)
            .text("EL OUTLIER: PORTUGAL")
            .style("font-weight", "800")
            .style("fill", "#e74c3c")
            .style("font-size", "14px");

        note.append("text")
            .attr("y", 8)
            .text("Paga menos, pero es el que más falla.")
            .style("fill", "#444")
            .style("font-size", "12px");

        note.transition()
            .delay(2200)
            .duration(1000)
            .style("opacity", 1);
    }
}
