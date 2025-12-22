export function drawCancellations(containerId, data) {
    const d3 = window.d3;
    const container = d3.select(containerId);
    container.html(""); // Limpieza absoluta

    const margin = {top: 60, right: 160, bottom: 50, left: 80};
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 800 500`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Definición de Gradientes Estilizados
    const defs = svg.append("defs");

    // Gradiente Check-in (Verde Salvia / Éxito)
    const gradCheckin = defs.append("linearGradient").attr("id", "gradCheckin").attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
    gradCheckin.append("stop").attr("offset", "0%").attr("stop-color", "#82b366");
    gradCheckin.append("stop").attr("offset", "100%").attr("stop-color", "#5a8a42");

    // Gradiente Cancelado (Terracota / Alerta)
    const gradCanceled = defs.append("linearGradient").attr("id", "gradCanceled").attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
    gradCanceled.append("stop").attr("offset", "0%").attr("stop-color", "#e07a5f");
    gradCanceled.append("stop").attr("offset", "100%").attr("stop-color", "#c0504d");

    // 2. Procesamiento de Datos (Normalización al 100%)
    const hotels = ["Resort Hotel", "City Hotel"];
    const stackData = hotels.map(h => {
        const row = data.filter(d => d.hotel === h);
        const total = d3.sum(row, d => Number(d.count));
        return {
            hotel: h,
            checkin: (Number(row.find(d => Number(d.is_canceled) === 0)?.count || 0) / total) * 100,
            canceled: (Number(row.find(d => Number(d.is_canceled) === 1)?.count || 0) / total) * 100
        };
    });

    // 3. Configuración de Stack y Escalas
    const series = d3.stack().keys(["checkin", "canceled"])(stackData);
    const x = d3.scaleBand().domain(hotels).range([0, width]).padding(0.4);
    const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
    const color = d3.scaleOrdinal().domain(["checkin", "canceled"]).range(["url(#gradCheckin)", "url(#gradCanceled)"]);

    // 4. Cuadrícula de Fondo
    svg.append("g")
        .attr("class", "grid")
        .attr("stroke-opacity", 0.1)
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));

    // 5. Dibujo de Barras Apiladas con Animación Grow
    const layer = svg.selectAll("g.layer")
        .data(series)
        .join("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key));

    layer.selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", d => x(d.data.hotel))
        .attr("width", x.bandwidth())
        .attr("rx", 4) // Redondeado sutil
        // --- Animación inicial ---
        .attr("y", height)
        .attr("height", 0)
        .transition()
        .duration(1200)
        .ease(d3.easeExpOut)
        .delay((d, i) => i * 100)
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]));

    // 6. Ejes Estilizados
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "14px")
        .call(g => g.select(".domain").remove()); // Quitar línea del eje para look moderno

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => d + "%"))
        .style("font-family", "Inter, sans-serif")
        .call(g => g.select(".domain").remove());

    // 7. Leyenda Lateral
    const legend = svg.append("g")
        .attr("transform", `translate(${width + 20}, ${height/2 - 30})`);

    const labels = [
        {key: "checkin", label: "Check-in Exitoso", grad: "url(#gradCheckin)"},
        {key: "canceled", label: "Cancelaciones", grad: "url(#gradCanceled)"}
    ];

    labels.forEach((l, i) => {
        const item = legend.append("g").attr("transform", `translate(0, ${i * 30})`);
        item.append("rect").attr("width", 18).attr("height", 18).attr("rx", 4).attr("fill", l.grad);
        item.append("text").attr("x", 25).attr("y", 14).text(l.label)
            .style("font-size", "13px").style("fill", "#555");
    });

    // 8. Título dentro del SVG (Opcional, ya que tienes texto en el step)
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -25)
        .attr("text-anchor", "middle")
        .style("font-family", "Inter, sans-serif")
        .style("font-weight", "600")
        .style("fill", "#2c3e50")
        .text("Distribución de Reservas por Estado");
}
