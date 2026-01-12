import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { renderMacroView, renderMicroView } from "./charts.js"; 

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
    viewsLoaded: { macro: false, micro: false }
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

    // 3. Lazy Load (Solo cargamos datos si NO es la intro)
    if (viewName !== 'intro' && !state.viewsLoaded[viewName]) {
        if (viewName === 'macro') await loadMacroDashboard();
        if (viewName === 'micro') await loadMicroDashboard();
        state.viewsLoaded[viewName] = true;
    }
}
window.app = { switchView };

async function loadMacroDashboard() {
    console.log("Renderizando Macro...");
    // Llamamos a la función importada pasando la conexión activa
    await renderMacroView(state.conn);
}

async function loadMicroDashboard() {
    console.log("Renderizando Micro...");
    await renderMicroView(state.conn);
}

init();
