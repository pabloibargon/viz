export function drawOverview(containerId, data) {
    const d3 = window.d3;
    const container = d3.select(containerId);
    
    // 1. Limpieza y Configuración de dimensiones
    container.html(""); 
    const margin = {top: 80, right: 30, bottom: 40, left: 60};
    const width = 800 - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${800} ${450}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Definición de Gradientes (Estética "Atlántico & Sol")
    const defs = svg.append("defs");

    // Gradiente para City Hotel (Azules)
    const gradCity = defs.append("linearGradient").attr("id", "gradCity").attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
    gradCity.append("stop").attr("offset", "0%").attr("stop-color", "#3e84a8");
    gradCity.append("stop").attr("offset", "100%").attr("stop-color", "#2C5F78");

    // Gradiente para Resort Hotel (Dorados)
    const gradResort = defs.append("linearGradient").attr("id", "gradResort").attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
    gradResort.append("stop").attr("offset", "0%").attr("stop-color", "#ffcc33");
    gradResort.append("stop").attr("offset", "100%").attr("stop-color", "#E1AD01");

    // 3. Preparación de Datos
    const monthOrder = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    const formattedData = data.map(d => ({
        month: d.arrival_date_month,
        hotel: d.hotel,
        total: Number(d.total) // Conversión de BigInt de DuckDB
    })).sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));

    // 4. Escalas
    const x0 = d3.scaleBand().domain(monthOrder).rangeRound([0, width]).paddingInner(0.2);
    const x1 = d3.scaleBand().domain(["Resort Hotel", "City Hotel"]).rangeRound([0, x0.bandwidth()]).padding(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(formattedData, d => d.total)]).nice().rangeRound([height, 0]);

    // 5. Ejes y Cuadrícula (Gridlines suaves)
    svg.append("g")
        .attr("class", "grid")
        .attr("color", "#e0e0e0")
        .attr("stroke-width", 0.5)
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));

    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0));

    xAxis.selectAll("text")
        .attr("transform", "rotate(-35)")
        .style("text-anchor", "end")
        .style("font-family", "Inter, sans-serif")
        .style("color", "#666");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .style("font-family", "Inter, sans-serif");

    // 6. Dibujo de Barras con Animación "Grow"
    const groups = svg.append("g")
        .selectAll("g")
        .data(d3.group(formattedData, d => d.month))
        .join("g")
        .attr("transform", ([month]) => `translate(${x0(month)},0)`);

    groups.selectAll("rect")
        .data(([, d]) => d)
        .join("rect")
        .attr("x", d => x1(d.hotel))
        .attr("width", x1.bandwidth())
        .attr("rx", 5) // Esquinas redondeadas
        .attr("fill", d => d.hotel === "City Hotel" ? "url(#gradCity)" : "url(#gradResort)")
        // --- Estado Inicial de la Animación ---
        .attr("y", height)
        .attr("height", 0)
        // --- Transición Grow ---
        .transition()
        .duration(1000)
        .ease(d3.easeCubicOut)
        .delay((d, i) => i * 50) 
        .attr("y", d => y(d.total))
        .attr("height", d => height - y(d.total));

    // 7. Leyenda Elegante
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 150}, ${-30})`);

    const legendItems = [
        { label: "Hotel Ciudad", color: "url(#gradCity)" },
        { label: "Resort Algarve", color: "url(#gradResort)" }
    ];

    legendItems.forEach((item, i) => {
        const li = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        li.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", item.color);
        li.append("text").attr("x", 20).attr("y", 10).text(item.label)
          .style("font-size", "12px").style("fill", "#444");
    });
}
