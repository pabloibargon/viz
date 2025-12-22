export function drawNationality(containerId, data) {
    const d3 = window.d3;
    const container = d3.select(containerId);
    container.html(""); // Limpiar el panel de cristal

    const margin = {top: 40, right: 60, bottom: 60, left: 100};
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 800 500`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Definición de Gradiente "Teal Internacional"
    const defs = svg.append("defs");
    const gradCountry = defs.append("linearGradient")
        .attr("id", "gradCountry")
        .attr("x1","0%").attr("y1","0%").attr("x2","100%").attr("y2","0%"); // Gradiente horizontal
    
    gradCountry.append("stop").attr("offset", "0%").attr("stop-color", "#69b3a2");
    gradCountry.append("stop").attr("offset", "100%").attr("stop-color", "#408070");

    // 2. Preparación de datos (Top 10)
    const formattedData = data.map(d => ({
        country: d.country === "NULL" ? "Desconocido" : d.country,
        count: Number(d.count)
    })).sort((a, b) => b.count - a.count);

    // 3. Escalas
    const y = d3.scaleBand()
        .domain(formattedData.map(d => d.country))
        .range([0, height])
        .padding(0.2);

    const x = d3.scaleLinear()
        .domain([0, d3.max(formattedData, d => d.count)])
        .nice()
        .range([0, width]);

    // 4. Cuadrícula Vertical suave
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .attr("stroke-opacity", 0.1)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(""));

    // 5. Dibujo de Barras Horizontales con Animación "Grow"
    svg.selectAll("rect")
        .data(formattedData)
        .join("rect")
        .attr("y", d => y(d.country))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("rx", 6) // Redondeado en las puntas
        .attr("fill", "url(#gradCountry)")
        // --- Animación inicial (Crecimiento de izquierda a derecha) ---
        .attr("width", 0)
        .transition()
        .duration(1000)
        .ease(d3.easeCubicOut)
        .delay((d, i) => i * 80)
        .attr("width", d => x(d.count));

    // 6. Ejes Estilizados
    const yAxis = svg.append("g")
        .call(d3.axisLeft(y))
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "14px");
    
    yAxis.select(".domain").remove(); // Limpieza estética
    yAxis.selectAll(".tick line").remove();

    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5))
        .style("font-family", "Inter, sans-serif");
    
    xAxis.select(".domain").remove();

    // 7. Etiquetas de valor al final de la barra (opcional para claridad)
    svg.selectAll(".label")
        .data(formattedData)
        .join("text")
        .attr("class", "label")
        .attr("y", d => y(d.country) + y.bandwidth() / 2 + 5)
        .attr("x", d => x(d.count) + 8)
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "12px")
        .style("fill", "#666")
        .style("opacity", 0)
        .text(d => d3.format(",")(d.count))
        .transition()
        .duration(1000)
        .delay((d, i) => i * 80 + 500)
        .style("opacity", 1);

    // 8. Título del gráfico
    svg.append("text")
        .attr("x", 0)
        .attr("y", -15)
        .style("font-family", "Inter, sans-serif")
        .style("font-weight", "700")
        .style("fill", "#2c3e50")
        .text("Mercados Emisores: Top 10 Países");
}
