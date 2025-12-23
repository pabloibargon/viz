async function ensureTaxonomyTable(conn, db) {
  const tables = await conn.query("PRAGMA show_tables");
  console.log(tables);
  const names = tables.toArray().map(r => r.name);
  console.log(names);
  if (!names.includes("taxonomy")) {
    const resp = await fetch("data/taxonomy.parquet");
    if (!resp.ok) {
      throw new Error("Failed to fetch taxonomy.parquet: " + resp.status);
    }
    const buffer = await resp.arrayBuffer();
    await db.registerFileBuffer("taxonomy.parquet", new Uint8Array(buffer));
    await conn.query(
      `CREATE TABLE taxonomy AS SELECT * FROM read_parquet('taxonomy.parquet')`
    );
  }
}

/**
 * Build a D3-compatible hierarchy from flat rows,
 * preserving `num_children` for each node.
 */
function buildHierarchy(rows, rootUid) {
  const byId = new Map(
    rows.map(r => [
      r.uid,
      {
        ...r,
        children: []
      }
    ])
  );
  let root = null;
  for (const row of rows) {
    const node = byId.get(row.uid);
    if (row.uid === rootUid) {
      root = node;
    } else if (byId.has(row.parent_uid)) {
      byId.get(row.parent_uid).children.push(node);
    }
  }
  document.getElementById("header").textContent = `Tree of life: Root node «${root.name}»`;
  return root;
}

export function renderTree(containerSelector, drawFunc, data, depth = 100) {
  // Clear old content
  const container = document.querySelector(containerSelector);
  container.innerHTML = "";

  // Instantiate Hypertree using trivial dataloader
  const ht = new hyt.Hypertree(
    { parent: container, preserveAspectRatio: "xMidYMid meet" },
    {
      dataloader: ok => ok(data),
      langInitBFS: (ht, n) => { n.precalc.label = n.data.name },
      interaction: {
        onNodeSelect: n => drawFunc(containerSelector, n.data.uid, depth),
      }
    }
  );

  // Animate and draw
  ht.initPromise
    .then(() => new Promise((ok, err) => ht.animateUp(ok, err)))
    .then(() => ht.drawDetailFrame());
}
export async function drawHyperbolicTree(containerSelector, rootUid = 1, depth = 10) {
  await ensureTaxonomyTable(window.duckdb_conn, window.duckdb_db);
  const rows = await getSubtree(rootUid, depth);
  const data = buildHierarchy(rows, rootUid);
  renderTree(containerSelector, drawHyperbolicTree, data, depth);
}

export async function getSubtree(uid, depth = 10) {
  const query = `
    WITH RECURSIVE subtree(uid, parent_uid, name, depth) AS (
        SELECT uid, parent_uid, name, 0 FROM taxonomy WHERE uid = ${uid}
      UNION ALL
        SELECT t.uid, t.parent_uid, t.name, s.depth + 1
        FROM taxonomy t
        JOIN subtree s ON t.parent_uid = s.uid
        WHERE s.depth < ${depth}
    )
    SELECT
      s.*,
      (SELECT COUNT(*) FROM taxonomy t WHERE t.parent_uid = s.uid) AS num_children
    FROM subtree s
    WHERE (SELECT COUNT(*) FROM taxonomy t WHERE t.parent_uid = s.uid) > 0
  `;

  const result = await window.duckdb_conn.query(query);
  return result.toArray().map(r => ({
    uid: Number(r.uid),
    parent_uid: r.parent_uid === null ? -1 : Number(r.parent_uid),
    name: r.name,
    num_children: Number(r.num_children)
  }));
}
