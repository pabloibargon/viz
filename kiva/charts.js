import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";

// CONSTANTES DE DISEÑO (Coinciden con style.css)
const COLORS = {
    accent: "#38bdf8",   // Azul Cian
    green: "#2ecc71",    // Verde Kiva
    purple: "#9b59b6",   // Genero/Brecha
    bg: "#1e293b",       // Fondo gráfico
    text: "#94a3b8",     // Texto muted
    povertyLow: "#f1c40f", // MPI Bajo (Amarillo)
    povertyHigh: "#e74c3c" // MPI Alto (Rojo)
};

function buildWhereClause(filters) {
    let clauses = ["1=1"]; // Truco: siempre verdadero para poder añadir ANDs
    
    if (filters.country !== 'All') {
        clauses.push(`country = '${filters.country}'`);
    }
    if (filters.sector !== 'All') {
        clauses.push(`sector = '${filters.sector}'`);
    }
    
    return "WHERE " + clauses.join(" AND ");
}

// ============================================================================
// FUNCIONES DE DIBUJADO D3 (PRIVADAS DEL MÓDULO)
// ============================================================================

// Variable para guardar el estado del tooltip y no recrearlo mil veces
let tooltip = d3.select("body").select(".custom-tooltip");
if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
        .attr("class", "custom-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(15, 23, 42, 0.95)") // Fondo oscuro
        .style("border", "1px solid #38bdf8") // Borde azul accent
        .style("padding", "10px")
        .style("border-radius", "8px")
        .style("color", "#fff")
        .style("font-size", "0.85rem")
        .style("pointer-events", "none") // Para que no moleste al mouse
        .style("z-index", "1000")
        .style("box-shadow", "0 4px 15px rgba(0,0,0,0.5)");
}

async function drawMap(selector, data) {
    const container = d3.select(selector);
    container.html("");
    
    const { width, height } = getDimensions(container);

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("cursor", "move");

    const mapGroup = svg.append("g");

    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (event) => mapGroup.attr("transform", event.transform));
    
    svg.call(zoom);

    const world = await d3.json("https://unpkg.com/world-atlas@2.0.2/countries-110m.json");
    
    const countriesFeatures = topojson.feature(world, world.objects.countries).features
        .filter(d => d.properties.name !== "Antarctica");

    const projection = d3.geoMercator()
        .fitSize([width, height], { type: "FeatureCollection", features: countriesFeatures });
    const path = d3.geoPath().projection(projection);

    // --- ESCALAS ---
    const mpiExtent = d3.extent(data, d => d.avg_mpi);
    const colorScale = d3.scaleSequential(d3.interpolateMagma)
        .domain([0, mpiExtent[1] || 0.6]); 

    const heightScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total_loan)])
        .range([0, 150]); 

    const widthScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total_loan)])
        .range([3, 15]);

    const dataMap = new Map(data.map(d => [d.country, d]));
    let selectedCountry = null;

    // 1. DIBUJAR PAÍSES
    const countryPaths = mapGroup.append("g")
        .selectAll("path")
        .data(countriesFeatures)
        .join("path")
        .attr("d", path)
        .attr("fill", d => {
            const entry = dataMap.get(d.properties.name);
            return (entry && entry.avg_mpi != null) ? colorScale(entry.avg_mpi) : "#1e293b";
        })
        .attr("stroke", "rgba(255,255,255,0.05)")
        .attr("stroke-width", 0.5);

    // 2. DIBUJAR PICOS (SPIKES)
    const spikes = mapGroup.append("g")
        .selectAll("path")
        .data(countriesFeatures.filter(d => dataMap.has(d.properties.name)))
        .join("path")
        .attr("transform", d => {
            const centroid = path.centroid(d);
            return `translate(${centroid[0] || 0}, ${centroid[1] || 0})`;
        })
        .attr("d", d => {
            const val = dataMap.get(d.properties.name).total_loan;
            const h = heightScale(val);
            const w = widthScale(val);
            return `M ${-w/2}, 0 L 0, ${-h} L ${w/2}, 0 Z`;
        })
        .attr("fill", COLORS.accent)
        .attr("fill-opacity", 0.8)
        .attr("stroke", COLORS.bg)
        .attr("stroke-width", 1)
        .attr("transform", function(d) {
            const centroid = path.centroid(d);
            const x = centroid[0];
            const y = centroid[1];
            d3.select(this).attr("transform", `translate(${x},${y}) scale(1, 0)`);
            return `translate(${x},${y})`;
        });

    spikes.transition()
        .duration(1000)
        .delay((d, i) => i * 10)
        .attr("transform", d => {
             const centroid = path.centroid(d);
             return `translate(${centroid[0]}, ${centroid[1]}) scale(1, 1)`;
        });

    // 3. INTERACCIÓN (CON ZOOM RESTAURADO)
    countryPaths
        .on("click", function(event, d) {
            event.stopPropagation();
            const isSelected = (this === selectedCountry);
            
            // Reset visual estilos
            countryPaths.style("opacity", 1).attr("stroke", "rgba(255,255,255,0.05)");
            spikes.style("opacity", 0.8).attr("fill", COLORS.accent);

            if (isSelected) {
                // --- DESELECCIONAR (ZOOM OUT) ---
                selectedCountry = null;
                dispatchFilterEvent(null);

                // Volver a la vista global
                svg.transition().duration(750).call(
                    zoom.transform,
                    d3.zoomIdentity
                );

            } else {
                // --- SELECCIONAR (ZOOM IN) ---
                selectedCountry = this;
                
                // Estilos de foco
                countryPaths.filter(n => n !== this).style("opacity", 0.2);
                spikes.filter(s => s.properties.name !== d.properties.name).style("opacity", 0.1);

                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1.5).style("opacity", 1);
                
                spikes.filter(s => s.properties.name === d.properties.name)
                      .attr("fill", COLORS.green)
                      .style("opacity", 1);

                dispatchFilterEvent(d.properties.name);

                // CÁLCULO DEL ZOOM
                // Obtenemos los límites del país [[x0, y0], [x1, y1]]
                const [[x0, y0], [x1, y1]] = path.bounds(d);
                
                // Transición suave hacia el país
                svg.transition().duration(750).call(
                    zoom.transform,
                    d3.zoomIdentity
                        .translate(width / 2, height / 2) // Mover al centro de la pantalla
                        .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height))) // Calcular escala
                        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2) // Centrar el objeto
                );
            }
        })
        .on("mouseover", (event, d) => {
             const entry = dataMap.get(d.properties.name);
             if(!entry) return;
             
             // Tooltip igual que antes...
             tooltip.style("visibility", "visible")
                .html(`
                    <strong>${d.properties.name}</strong><br/>
                    <small>Pobreza (MPI):</small> <span style="color:${colorScale(entry.avg_mpi)}">●</span> ${entry.avg_mpi?.toFixed(3)}<br/>
                    <small>Préstamos:</small> <span style="color:${COLORS.accent}">▲</span> ${d3.format("$.2s")(entry.total_loan)}
                `);
        })
        .on("mousemove", e => tooltip.style("top", (e.pageY-10)+"px").style("left", (e.pageX+15)+"px"))
        .on("mouseout", () => tooltip.style("visibility", "hidden"));

    // Reset al hacer click en el fondo (mar)
    svg.on("click", () => {
        selectedCountry = null;
        
        // Reset estilos
        countryPaths.attr("stroke", "rgba(255,255,255,0.05)").attr("stroke-width", 0.5).style("opacity", 1);
        spikes.style("opacity", 0.8).attr("fill", COLORS.accent);
        dispatchFilterEvent(null);

        // Reset Zoom
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
        );
    });
}
// Helper para comunicar con app.js o charts.js
function dispatchFilterEvent(countryName) {
    const event = new CustomEvent('kiva:countryFilter', { detail: { country: countryName } });
    window.dispatchEvent(event);
}
function drawBarChart(selector, data) {
    const container = d3.select(selector);
    container.html("");
    const { width, height } = getDimensions(container);
    const margin = { left: 100, right: 20, top: 20, bottom: 20 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().range([0, h]).domain(data.map(d => d.sector)).padding(0.2);
    const x = d3.scaleLinear().range([0, w]).domain([0, d3.max(data, d => d.total)]);

    // Ejes
    svg.append("g").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
    svg.selectAll(".tick text").attr("fill", COLORS.text).style("font-size", "11px");

    // Barras
    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("y", d => y(d.sector))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", 0)
        .attr("fill", COLORS.accent)
        .transition().duration(1000)
        .attr("width", d => x(d.total));

    // Labels de valor
    svg.selectAll(".label")
        .data(data)
        .join("text")
        .attr("x", d => x(d.total) + 5)
        .attr("y", d => y(d.sector) + y.bandwidth() / 2 + 4)
        .text(d => d3.format(".2s")(d.total))
        .attr("fill", "#fff")
        .style("font-size", "10px");
}

function drawScatter(selector, data) {
    const container = d3.select(selector);
    container.html("");
    const { width, height } = getDimensions(container);
    const margin = { left: 50, right: 20, top: 20, bottom: 40 }; // Margen izquierdo un poco mayor para los $
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // --- ESCALAS ---
    // X: Uso de Internet (0 a 100%)
    const x = d3.scaleLinear()
        .domain([0, 100])
        .range([0, w]);

    // Y: Cantidad del Préstamo
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.avg_amount) || 1000]) // Fallback por si data viene vacía
        .range([h, 0]);

    // Color: Género
    const color = d3.scaleOrdinal()
        .domain(["female", "male"])
        .range([COLORS.purple, COLORS.green]);

    // --- EJES ---
    // Eje X
    svg.append("g")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(5))
        .attr("color", COLORS.text)
        .selectAll("text")
        .style("font-size", "11px");
    
    // Eje Y (Formato moneda)
    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("$.2s")))
        .attr("color", COLORS.text)
        .selectAll("text")
        .style("font-size", "11px");

    // Grid Lines sutiles (Horizontal)
    svg.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.05)
        .call(d3.axisLeft(y).tickSize(-w).tickFormat(""));

    // --- PUNTOS (CORRECCIÓN AQUÍ) ---
    
    // 1. Crear la selección y asignar atributos estáticos
    const circles = svg.append("g")
        .selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.internet_pct))
        .attr("cy", d => y(d.avg_amount))
        .attr("fill", d => color(d.gender_clean))
        .attr("opacity", 0.6)
        .attr("stroke", COLORS.bg) // Pequeño borde para separar si se solapan
        .attr("stroke-width", 1)
        .attr("r", 0); // ESTADO INICIAL: Radio 0 (invisible)

    // 2. Agregar el Tooltip (title) AHORA, antes de la transición
    circles.append("title")
        .text(d => `${d.country} (${d.gender_clean})\nInternet: ${Math.round(d.internet_pct)}%\nAvg Loan: $${Math.round(d.avg_amount)}`);

    // 3. Aplicar la animación (Transición)
    circles.transition()
        .delay((d, i) => i * 3) // Pequeño delay escalonado
        .duration(800)
        .ease(d3.easeBackOut) // Efecto "pop"
        .attr("r", d => Math.min(12, Math.max(3, d.count / 15))); // Tamaño final según cantidad de préstamos

    // Etiquetas de Ejes
    svg.append("text")
        .attr("x", w / 2)
        .attr("y", h + 35)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Población con acceso a Internet (%)");
}
function drawGenderLollipops(selector, data) {
    const container = d3.select(selector);
    container.html("");
    const { width, height } = getDimensions(container);
    const margin = { left: 60, right: 30, top: 30, bottom: 20 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scalePoint().range([0, h]).domain(["female", "male"]).padding(0.5);
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.avg_days) * 1.2]).range([0, w]);

    // Líneas
    svg.selectAll("myline")
        .data(data)
        .join("line")
        .attr("x1", 0)
        .attr("x2", d => x(d.avg_days))
        .attr("y1", d => y(d.gender_clean))
        .attr("y2", d => y(d.gender_clean))
        .attr("stroke", COLORS.text)
        .attr("stroke-width", 1);

    // Círculos
    svg.selectAll("mycircle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.avg_days))
        .attr("cy", d => y(d.gender_clean))
        .attr("r", 8)
        .attr("fill", d => d.gender_clean === 'female' ? COLORS.purple : COLORS.green);

    // Etiquetas Y
    svg.append("g").call(d3.axisLeft(y)).select(".domain").remove();
    svg.selectAll(".tick text").style("text-transform", "capitalize").attr("fill", "#fff");

    // Valor Numérico
    svg.selectAll("vals")
        .data(data)
        .join("text")
        .attr("x", d => x(d.avg_days) + 15)
        .attr("y", d => y(d.gender_clean) + 4)
        .text(d => Math.round(d.avg_days) + " días")
        .attr("fill", COLORS.accent)
        .style("font-size", "12px");
}

function drawTimeHistogram(selector, data) {
    const container = d3.select(selector);
    container.html("");
    
    const { width, height } = getDimensions(container);
    
    // Aumentamos márgenes para que quepan los textos de los ejes
    const margin = { left: 50, right: 20, top: 15, bottom: 40 }; 
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Escala X (Días)
    const x = d3.scaleLinear()
        .domain([0, 60]) // Limitamos visualmente a 60 días para ver el grueso
        .range([0, w]);
    
    // Generar bins (contenedores)
    const histogram = d3.bin()
        .domain(x.domain())
        .thresholds(x.ticks(20)); // 20 barras aprox
    
    const bins = histogram(data.map(d => d.days_to_fund));

    // Escala Y (Frecuencia)
    const y = d3.scaleLinear()
        .range([h, 0])
        .domain([0, d3.max(bins, d => d.length)]);

    // Dibujar Barras
    svg.append("g")
        .selectAll("rect")
        .data(bins)
        .join("rect")
        .attr("x", 1)
        .attr("transform", d => `translate(${x(d.x0)}, ${y(d.length)})`)
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("height", d => h - y(d.length))
        .attr("fill", COLORS.accent)
        .style("opacity", 0.6);

    // Eje X
    svg.append("g")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(5))
        .attr("color", COLORS.text);

    // Eje Y
    svg.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .attr("color", COLORS.text);

    // --- TÍTULOS DE LOS EJES (NUEVO) ---

    // Etiqueta Eje X (Abajo)
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", w / 2)
        .attr("y", h + 35) // Bajamos 35px desde el eje
        .text("Días para financiar")
        .attr("fill", COLORS.text)
        .style("font-size", "11px");

    // Etiqueta Eje Y (Izquierda rotada)
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -35) // Movemos a la izquierda del eje
        .attr("x", -h / 2)
        .text("Nº de Préstamos")
        .attr("fill", COLORS.text)
        .style("font-size", "11px");
}

// HELPERS

async function runQuery(conn, sql) {
    const res = await conn.query(sql);
    const rows = res.toArray().map(r => r.toJSON());

    // LIMPIEZA DE BIGINT:
    // DuckDB devuelve BigInt para Counts y DateDiffs. 
    // D3.js no sabe animar ni calcular escalas con BigInt.
    // Convertimos todo a Number nativo de JS aquí mismo.
    return rows.map(row => {
        const cleanRow = { ...row }; // Copia superficial
        for (const key in cleanRow) {
            if (typeof cleanRow[key] === 'bigint') {
                cleanRow[key] = Number(cleanRow[key]);
            }
        }
        return cleanRow;
    });
}

function getDimensions(container) {
    const node = container.node();
    // Fallback de seguridad por si el contenedor aún no tiene tamaño
    return { 
        width: node.clientWidth || 800, 
        height: node.clientHeight || 500 
    };
}


// --- FUNCIÓN DE DIBUJADO (Recibe d3Cloud como argumento) ---
function drawWordCloud(selector, data, d3CloudLayout) {
    const container = d3.select(selector);
    container.html("");
    const { width, height } = getDimensions(container);

    const sizeScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.count))
        .range([20, 90]); // Ajustado tamaño

    // Usamos d3.schemeTableau10 para colores profesionales
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    const layout = d3CloudLayout()
        .size([width, height])
        .words(data.map(d => ({ text: d.word, size: sizeScale(d.count) })))
        .padding(5)
        .rotate(() => (~~(Math.random() * 2) * 90))
        .font("Impact")
        .fontSize(d => d.size)
        .on("end", draw);

    layout.start();

    function draw(words) {
        const svg = container.append("svg")
            .attr("width", layout.size()[0])
            .attr("height", layout.size()[1])
            .append("g")
            .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")");

        const text = svg.selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", "0px")
            .style("font-family", "Impact, sans-serif")
            .style("fill", (d, i) => colorScale(i))
            .attr("text-anchor", "middle")
            .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
            .text(d => d.text);

        text.transition()
            .duration(600)
            .delay((d, i) => i * 10)
            .style("font-size", d => d.size + "px")
            .style("opacity", 1);
            
        text.append("title").text(d => `Frecuencia: ${Math.round(d.size)} (escala)`);
    }
}

export async function renderMacroView(conn, filters) {
    console.log("--- RENDER MACRO ---", filters);
    const whereSQL = buildWhereClause(filters);

    // 1. MAPA: Agrupado por país
    const mapQuery = `
        SELECT country, country_code, SUM(loan_amount) as total_loan, AVG(MPI) as avg_mpi 
        FROM kiva 
        ${whereSQL} 
        GROUP BY country, country_code
    `;
    const mapData = await runQuery(conn, mapQuery);
    
    // Si no hay datos, limpiamos el mapa, si hay, dibujamos
    if(mapData.length > 0) drawMap('#viz-map', mapData);
    else d3.select('#viz-map').html("<div class='no-data'>No hay datos para estos filtros</div>");

    // 2. SECTORES: Top 8
    const sectorQuery = `
        SELECT sector, SUM(loan_amount) as total 
        FROM kiva 
        ${whereSQL} 
        GROUP BY sector 
        ORDER BY total DESC LIMIT 8
    `;
    const sectorData = await runQuery(conn, sectorQuery);
    drawBarChart('#viz-sectors', sectorData);
    
    // 3. KPI UPDATES (HTML)
    // Hacemos una query ligera para los totales
    const kpiQuery = `
        SELECT sum(loan_amount) as total, count(DISTINCT country) as countries 
        FROM kiva ${whereSQL}
    `;
    const kpiRes = await runQuery(conn, kpiQuery);
    
    const totalVal = kpiRes[0]?.total || 0;
    const countriesVal = kpiRes[0]?.countries || 0;

    const kpiAmountEl = document.getElementById('kpi-total-amount');
    const kpiCountriesEl = document.getElementById('kpi-total-countries');
    
    if(kpiAmountEl) kpiAmountEl.innerText = d3.format("$,.2s")(totalVal);
    if(kpiCountriesEl) kpiCountriesEl.innerText = countriesVal;
}


// ============================================================================
// VISTA 2: MICRO (Scatter, Género y Tiempo)
// ============================================================================
export async function renderMicroView(conn, filters) {
    console.log("--- RENDER MICRO ---", filters);

    // Helper para combinar el filtro global con filtros específicos de esta vista
    const baseWhere = buildWhereClause(filters); 
    const combineWhere = (extra) => `${baseWhere} AND ${extra}`;

    // 1. SCATTER PLOT
    // Filtramos: Internet válido, Géneros binarios mapeados a 'female'/'male', y Outliers (>10k) fuera.
    const scatterQuery = `
        SELECT 
            country,
            CASE 
                WHEN gender_clean IN ('Mujer', 'Grupo de Mujeres') THEN 'female'
                ELSE 'male' 
            END as gender_unified,
            AVG(CAST(internet_usage_pct AS FLOAT)) as internet_pct, 
            AVG(loan_amount) as avg_amount,
            COUNT(*) as count
        FROM kiva 
        ${combineWhere("internet_usage_pct IS NOT NULL AND gender_clean IN ('Mujer', 'Grupo de Mujeres', 'Hombre', 'Grupo de Hombres') AND loan_amount <= 10000")}
        GROUP BY country, gender_unified
    `;
    
    const scatterData = await runQuery(conn, scatterQuery);
    
    if (scatterData.length > 0) {
        // Mapeamos para que drawScatter reciba 'gender_clean'
        const safeScatter = scatterData.map(d => ({...d, gender_clean: d.gender_unified}));
        drawScatter('#viz-scatter', safeScatter);
    } else {
        d3.select('#viz-scatter').html("<div class='no-data'>No hay suficientes datos para correlación</div>");
    }

    // 2. GÉNERO (Lollipops)
    const genderQuery = `
        SELECT 
            CASE 
                WHEN gender_clean IN ('Mujer', 'Grupo de Mujeres') THEN 'female'
                ELSE 'male' 
            END as gender_unified,
            AVG(date_diff('day', CAST(posted_time AS TIMESTAMP), CAST(funded_time AS TIMESTAMP))) as avg_days
        FROM kiva 
        ${combineWhere("funded_time IS NOT NULL AND gender_clean IN ('Mujer', 'Grupo de Mujeres', 'Hombre', 'Grupo de Hombres')")}
        GROUP BY gender_unified
    `;
    
    const genderData = await runQuery(conn, genderQuery);
    if (genderData.length > 0) {
        const safeGender = genderData.map(d => ({...d, gender_clean: d.gender_unified}));
        drawGenderLollipops('#viz-gender', safeGender);
    } else {
        d3.select('#viz-gender').html("");
    }

    // 3. HISTOGRAMA (Tiempo)
    const timeQuery = `
        SELECT 
            date_diff('day', CAST(posted_time AS TIMESTAMP), CAST(funded_time AS TIMESTAMP)) as days_to_fund
        FROM kiva 
        ${combineWhere("funded_time IS NOT NULL")}
        LIMIT 2000
    `;
    const timeData = await runQuery(conn, timeQuery);
    
    if (timeData.length > 0) {
        drawTimeHistogram('#viz-time', timeData);
    } else {
        d3.select('#viz-time').html("");
    }
}


// ============================================================================
// VISTA 3: CLOUD (Nube de Palabras)
// ============================================================================
export async function renderCloudView(conn, filters) {
    console.log("--- RENDER CLOUD ---", filters);

    // 1. CARGA DINÁMICA DE D3-CLOUD (Si no está cargada ya)
    // Hacemos que d3 sea global temporalmente para que la librería legacy funcione
    window.d3 = d3;
    
    // Importamos desde Skypack para asegurar compatibilidad
    let d3Cloud;
    try {
        const module = await import("https://cdn.skypack.dev/d3-cloud");
        d3Cloud = module.default;
    } catch (e) {
        console.error("Error cargando d3-cloud", e);
        d3.select('#viz-cloud').html("<p style='color:red'>Error cargando librería de texto</p>");
        return;
    }

    // 2. PREPARACIÓN NLP
    const stopWords = [
        'the', 'to', 'and', 'a', 'of', 'for', 'in', 'her', 'his', 'she', 'he', 
        'with', 'is', 'that', 'on', 'as', 'at', 'by', 'this', 'from', 'it', 
        'buy', 'purchase', 'sell', 'pay', 'loan', 'kiva', 'business', 'group',
        'will', 'be', 'are', 'has', 'have', 'more', 'their', 'an', 'also',
        'income', 'family', 'children', 'help', 'years', 'old', 'supplies', 's'
    ];
    const stopWordsSQL = stopWords.map(w => `'${w}'`).join(', ');

    // 3. QUERY
    // Aplicamos el filtro ANTES del sample para que si filtras "Construcción", 
    // las palabras sean de construcción.
    const whereSQL = buildWhereClause(filters);

    const sql = `
        WITH raw_words AS (
            SELECT unnest(string_split(lower(regexp_replace(use, '[^a-z ]', '', 'g')), ' ')) as word
            FROM kiva
            ${whereSQL} 
            USING SAMPLE 20% 
        )
        SELECT word, count(*) as count
        FROM raw_words
        WHERE length(word) > 3 
          AND word NOT IN (${stopWordsSQL})
        GROUP BY word
        ORDER BY count DESC
        LIMIT 100
    `;

    const cloudData = await runQuery(conn, sql);
    
    if (cloudData.length > 5) { // Necesitamos al menos unas pocas palabras
        drawWordCloud('#viz-cloud', cloudData, d3Cloud);
    } else {
        d3.select('#viz-cloud').html("<div class='no-data'>No hay suficientes datos de texto para generar la nube.</div>");
    }
}
