/**
 * ACTO IV: EL DESENLACE - RIESGO VS RECOMPENSA
 * Muestra cómo el hotel debe equilibrar el valor para sobrevivir a las cancelaciones.
 */
export function drawImpact(containerId, data) {
    const d3 = window.d3;
    const container = d3.select(containerId);
    container.html(""); 

    const width = 800, height = 450;
    const margin = {top: 120, right: 60, bottom: 60, left: 160};

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Datos
    const formattedData = data.map(d => ({
        cat: d.categoria,
        precio: Number(d.precio_medio),
        riesgo: Number(d.tasa_riesgo)
    })).sort((a, b) => b.precio - a.precio);

    // 2. Escalas
    const y = d3.scaleBand()
        .domain(formattedData.map(d => d.cat))
        .range([0, height - margin.top - margin.bottom])
        .padding(0.4);

    const xPrecio = d3.scaleLinear()
        .domain([0, d3.max(formattedData, d => d.precio)])
        .range([0, width/2 - 40]);

    const xRiesgo = d3.scaleLinear()
        .domain([0, 100])
        .range([0, width/2 - 40]);

    // 3. Dibujar Barras de PRECIO (Hacia la derecha - AZUL)
    svg.selectAll(".bar-price")
        .data(formattedData)
        .join("rect")
        .attr("x", 0)
        .attr("y", d => y(d.cat))
        .attr("height", y.bandwidth())
        .attr("fill", "#3e84a8")
        .attr("rx", 5)
        .transition().duration(1000)
        .attr("width", d => xPrecio(d.precio));

    // 4. Dibujar Barras de RIESGO (Hacia la derecha pero desplazadas - ROJO)
    const riesgoOffset = width / 2;
    svg.selectAll(".bar-risk")
        .data(formattedData)
        .join("rect")
        .attr("x", riesgoOffset)
        .attr("y", d => y(d.cat))
        .attr("height", y.bandwidth())
        .attr("fill", "#e74c3c")
        .attr("fill-opacity", 0.4)
        .attr("rx", 5)
        .transition().duration(1000).delay(500)
        .attr("width", d => xRiesgo(d.riesgo));

    // 5. Etiquetas de texto
    svg.append("text").attr("x", 0).attr("y", -20).text("VALOR (€)").style("font-weight", "bold").style("fill", "#3e84a8");
    svg.append("text").attr("x", riesgoOffset).attr("y", -20).text("RIESGO DE CANCELACIÓN (%)").style("font-weight", "bold").style("fill", "#e74c3c");

    // Precios y Riesgos
    svg.selectAll(".txt-p")
        .data(formattedData).join("text")
        .attr("x", d => xPrecio(d.precio) - 5)
        .attr("y", d => y(d.cat) + y.bandwidth()/2 + 5)
        .attr("text-anchor", "end")
        .text(d => d.precio.toFixed(0) + "€")
        .style("fill", "white").style("font-size", "12px");

    svg.selectAll(".txt-r")
        .data(formattedData).join("text")
        .attr("x", d => riesgoOffset + xRiesgo(d.riesgo) + 5)
        .attr("y", d => y(d.cat) + y.bandwidth()/2 + 5)
        .text(d => d.riesgo.toFixed(1) + "%")
        .style("fill", "#c0392b").style("font-weight", "bold");

    // Eje Y (Categorías)
    svg.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .call(g => g.select(".domain").remove())
        .selectAll("text").style("font-size", "14px").style("font-weight", "600");

    // 6. CONCLUSIÓN FINAL (Anotación)
    const climax = svg.append("g")
        .attr("transform", `translate(${width/2 - 120}, ${height - 120})`)
        .style("opacity", 0);

    climax.append("text")
        .attr("text-anchor", "middle")
        .text("ESTRATEGIA DE SUPERVIVENCIA:")
        .style("font-weight", "bold").style("fill", "#1a202c");

    climax.append("text")
        .attr("y", 20).attr("text-anchor", "middle")
        .text("Blindar los 'Paquetes Vacacionales' para")
        .style("fill", "#666");

    climax.append("text")
        .attr("y", 35).attr("text-anchor", "middle")
        .text("compensar la volatilidad del cliente urbano.")
        .style("fill", "#666");

    climax.transition().delay(2000).duration(1000).style("opacity", 1);
}
