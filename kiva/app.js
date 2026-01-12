import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { renderMacroView, renderMicroView, renderCloudView} from "./charts.js"; 

// CONFIGURACIÓN
const PARQUET_FILE = 'kiva_data.parquet';
const CONFIG = {
    // Definimos rutas relativas para los workers (Ajustar según tu carpeta local)
    bundles: {
            mvp: { mainModule: "duckdb-mvp.wasm", mainWorker: "../duckdb/duckdb-browser-mvp.worker.js" },
            eh: { mainModule: "duckdb-eh.wasm", mainWorker: "../duckdb/duckdb-browser-eh.worker.js" },
    }
};

const state = {
    conn: null,
    db: null,
    currentView: 'macro',
    viewsLoaded: { macro: false, micro: false },
    filters: {
        country: 'All',
        sector: 'All'
    }
};

async function init() {
    try {
        const bundle = await duckdb.selectBundle(CONFIG.bundles);
        const worker = new Worker(bundle.mainWorker);
        const logger = new duckdb.ConsoleLogger();
        state.db = new duckdb.AsyncDuckDB(logger, worker);
        await state.db.instantiate(bundle.mainModule);
        state.conn = await state.db.connect();

        updateLoader("Cargando dataset...");
        const response = await fetch(PARQUET_FILE);
        const buffer = await response.arrayBuffer();
        await state.db.registerFileBuffer(PARQUET_FILE, new Uint8Array(buffer));

        updateLoader("Analizando datos...");
        await state.conn.query(`CREATE TABLE kiva AS SELECT * FROM read_parquet('${PARQUET_FILE}')`);
        await initFilters();

        document.getElementById('loader').style.opacity = 0;
        setTimeout(() => document.getElementById('loader').remove(), 500);
        
        switchView('intro');

    } catch (err) {
        console.error(err);
        document.getElementById('loading-text').innerText = "Error: " + err.message;
    }
}
function updateLoader(msg) { document.getElementById('loading-text').innerText = msg; }

async function switchView(viewName) {
    state.currentView = viewName;

    // 1. UI Nav Updates (Manejo de clases active)
    document.querySelectorAll('.nav-step').forEach(el => el.classList.remove('active'));
    
    // Lógica para encontrar el botón correcto
    const activeBtn = [...document.querySelectorAll('.nav-step')].find(el => {
        const onclick = el.getAttribute('onclick');
        return onclick && onclick.includes(`'${viewName}'`);
    });
    if(activeBtn) activeBtn.classList.add('active');

    // 2. Mostrar Contenedor
    document.querySelectorAll('.dashboard-view').forEach(el => {
        el.classList.add('hidden-view');
        el.classList.remove('active-view');
    });
    
    const target = document.getElementById(`view-${viewName}`);
    if(target) {
        target.classList.remove('hidden-view');
        target.classList.add('active-view');
    }

    if (viewName !== 'intro' && !state.viewsLoaded[viewName]) {
        if (viewName === 'macro') await loadMacroDashboard();
        if (viewName === 'micro') await loadMicroDashboard();
	if (viewName === 'cloud') await loadCloudDashboard();
        state.viewsLoaded[viewName] = true;
    }
}

async function initFilters() {
    console.log("Cargando opciones de filtro...");
    
    // 1. Obtener Países únicos
    const countries = await state.conn.query(`SELECT DISTINCT country FROM kiva ORDER BY country`);
    const countrySelect = document.getElementById('filter-country');
    countries.toArray().forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.country;
        opt.innerText = r.country;
        countrySelect.appendChild(opt);
    });

    // 2. Obtener Sectores únicos
    const sectors = await state.conn.query(`SELECT DISTINCT sector FROM kiva ORDER BY sector`);
    const sectorSelect = document.getElementById('filter-sector');
    sectors.toArray().forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.sector;
        opt.innerText = r.sector;
        sectorSelect.appendChild(opt);
    });
}

// Función llamada por el onchange del HTML
async function updateFilters() {
    // 1. Actualizar Estado
    state.filters.country = document.getElementById('filter-country').value;
    state.filters.sector = document.getElementById('filter-sector').value;

    console.log("Filtros aplicados:", state.filters);

    // 2. Invalidar caché de vistas (para forzar recarga)
    state.viewsLoaded = { macro: false, micro: false, cloud: false };

    // 3. Recargar vista actual
    if (state.currentView === 'macro') await loadMacroDashboard();
    else if (state.currentView === 'micro') await loadMicroDashboard();
    else if (state.currentView === 'cloud') await loadCloudDashboard();
}

async function resetFilters() {
    document.getElementById('filter-country').value = 'All';
    document.getElementById('filter-sector').value = 'All';
    await updateFilters();
}

function toggleFilters() {
    const filterBar = document.querySelector('.filter-bar');
    const btnIcon = document.querySelector('.nav-toggle-btn i');
    
    // Alternar clase CSS
    filterBar.classList.toggle('collapsed');
    
    // Opcional: Cambiar icono visualmente para indicar estado
    if (filterBar.classList.contains('collapsed')) {
        // Estado Cerrado: Icono relleno o diferente
        btnIcon.classList.remove('bx-filter-alt');
        btnIcon.classList.add('bx-filter'); // Icono alternativo
        btnIcon.style.opacity = "0.5";
    } else {
        // Estado Abierto
        btnIcon.classList.remove('bx-filter');
        btnIcon.classList.add('bx-filter-alt');
        btnIcon.style.opacity = "1";
    }
}

// ACTUALIZAR EL EXPORT AL FINAL
window.app = { 
    switchView, 
    updateFilters, 
    resetFilters,
    toggleFilters // <--- Añadir aquí
};

// EXPONER FUNCIONES AL HTML
window.app = { switchView, updateFilters, resetFilters, toggleFilters };


// ----------------------------------------------------
// MODIFICAR LAS LLAMADAS A CHARTS
// ----------------------------------------------------

async function loadMacroDashboard() {
    // Pasamos los filtros a la función de charts.js
    await renderMacroView(state.conn, state.filters); 
}

async function loadMicroDashboard() {
    await renderMicroView(state.conn, state.filters);
}

async function loadCloudDashboard() {
    await renderCloudView(state.conn, state.filters);
}

// ... Listener para el click del mapa (Sync Mapa -> Dropdown) ...
window.addEventListener('kiva:countryFilter', (e) => {
    const country = e.detail.country;
    const select = document.getElementById('filter-country');
    
    // Si el país existe en el filtro, seleccionarlo
    if(country) {
        select.value = country;
    } else {
        select.value = 'All';
    }
    updateFilters();
});

init();
