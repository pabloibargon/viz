/**
 * ACTO II: EL HUÉSPED FANTASMA
 * Representa la parte de la reserva que se "disuelve" debido a las cancelaciones.
 */
export function drawCancellations(containerId, data) {
    const d3 = window.d3;
    const container = d3.select(containerId);
    
    container.html(""); 
	console.log(data);
    const width = 800;
    const height = 450;
    const margin = {top: 180, right: 150, bottom: 50, left: 120};

    const svg = container.append("svg")
	.attr("viewBox", `0 0 ${width} ${height}`)
	.append("g")
	.attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Filtro de "Desenfoque Fantasma"
    const defs = svg.append("defs");
    const filter = defs.append("filter")
	.attr("id", "ghost-blur")
	.append("feGaussianBlur")
	.attr("in", "SourceGraphic")
	.attr("stdDeviation", "4"); // Nivel de "neblina"

    // 2. Preparación de datos
    const formattedData = data.map(d => ({
	hotel: d.hotel === "City Hotel" ? "Lisboa (Urbano)" : "Algarve (Resort)",
	total: Number(d.total),
	canceled: Number(d.canceled),
	confirmed: Number(d.total) - Number(d.canceled),
	rate: (Number(d.canceled) / Number(d.total)) * 100
    }));

    // 3. Escalas
    const y = d3.scaleBand()
	.domain(formattedData.map(d => d.hotel))
	.range([0, height - margin.top - margin.bottom])
	.padding(0.4);

    const x = d3.scaleLinear()
	.domain([0, d3.max(formattedData, d => d.total)])
	.range([0, width - margin.left - margin.right]);

    // 4. Dibujar Barras de Reservas CONFIRMADAS (Sólidas)
    svg.selectAll(".bar-confirmed")
	.data(formattedData)
	.join("rect")
	.attr("class", "bar-confirmed")
	.attr("y", d => y(d.hotel))
	.attr("x", 0)
	.attr("height", y.bandwidth())
	.attr("fill", d => d.hotel.includes("Lisboa") ? "#3e84a8" : "#ffcc33")
	.attr("rx", 4)
	.attr("width", 0) // Inicio animación
	.transition()
	.duration(1000)
	.attr("width", d => x(d.confirmed));

    // 5. Dibujar Barras de Reservas CANCELADAS (Fantasmas)
    svg.selectAll(".bar-ghost")
	.data(formattedData)
	.join("rect")
	.attr("class", "bar-ghost")
	.attr("y", d => y(d.hotel))
	.attr("x", d => x(d.confirmed))
	.attr("height", y.bandwidth())
	.attr("fill", d => d.hotel.includes("Lisboa") ? "#3e84a8" : "#ffcc33")
	.attr("opacity", 0.3)
	.attr("filter", "url(#ghost-blur)") // Aplicamos el efecto de neblina
	.attr("width", 0)
	.transition()
	.delay(1000)
	.duration(1500)
	.attr("width", d => x(d.canceled));

    // 6. Etiquetas de Porcentaje (El impacto)
    svg.selectAll(".rate-label")
	.data(formattedData)
	.join("text")
	.attr("x", d => x(d.total) + 10)
	.attr("y", d => y(d.hotel) + y.bandwidth() / 2 + 6)
	.text(d => `${d.rate.toFixed(1)}% Fantasma`)
	.style("font-family", "'Inter', sans-serif")
	.style("font-size", "14px")
	.style("font-weight", "800")
	.style("fill", d => d.hotel.includes("Lisboa") ? "#2C5F78" : "#E1AD01")
	.style("opacity", 0)
	.transition()
	.delay(1800)
	.style("opacity", 1);

    // 7. Eje Y personalizado
    svg.append("g")
	.call(d3.axisLeft(y).tickSize(0))
	.call(g => g.select(".domain").remove())
	.selectAll("text")
	.style("font-family", "'Inter', sans-serif")
	.style("font-size", "15px")
	.style("font-weight", "600")
	.style("fill", "#444");

    // 8. Título interno del gráfico
    svg.append("text")
	.attr("x", 0)
	.attr("y", -30)
	.text("Volumen Real vs Reservas Disueltas")
	.style("font-family", "'Inter', sans-serif")
	.style("font-size", "18px")
	.style("font-weight", "700")
	.style("fill", "#1a202c");
}
