// ============================================================
// REQUEST CONFIGURATOR — card-driven intake (showcase)
// Overrides NewRequestPage; loaded after client-pages.jsx.
// Bible refs: §4.1 (rooms/pieces), §4.2 (contact prefs),
// §4.5 (ProjectSizingService scoring), §3.4 (uploads).
// ============================================================

// ---- Scoring config (mirrors admin project_sizing_config seed) ----
const RF_SIZE_PTS = { S: 15, M: 25, L: 40 };
const RF_MATERIALS = [
  { key: "pal",        pts: 5,  ro: "PAL melaminat",   en: "Melamine chipboard", subRo: "Economic, durabil",        subEn: "Budget, durable" },
  { key: "pal_furnir", pts: 15, ro: "PAL furnir natur", en: "Natural veneer",     subRo: "Aspect lemnos, cost mediu", subEn: "Wood look, mid cost" },
  { key: "mdf",        pts: 25, ro: "MDF vopsit",        en: "Painted MDF",        subRo: "Frontale uniforme, premium", subEn: "Even fronts, premium" },
  { key: "lemn",       pts: 45, ro: "Lemn masiv",        en: "Solid wood",         subRo: "Stejar, fag, frasin",        subEn: "Oak, beech, ash" },
];
const RF_ACC = [
  { key: "soft",     pts: 8,  ro: "Soft-close",          en: "Soft-close",        ic: "layers" },
  { key: "push",     pts: 8,  ro: "Push-to-open",        en: "Push-to-open",      ic: "box" },
  { key: "glisante", pts: 8,  ro: "Uși glisante",        en: "Sliding doors",     ic: "grid" },
  { key: "led",      pts: 8,  ro: "Iluminat LED",        en: "LED lighting",      ic: "eye" },
  { key: "cuart",    pts: 12, ro: "Blat cuarț / piatră", en: "Quartz / stone top", ic: "shield" },
  { key: "organiz",  pts: 6,  ro: "Organizatoare interne", en: "Inner organisers", ic: "pkg" },
];
const RF_SIZES = [
  { key: "S", ro: "Mic",    en: "Small",  rangeRo: "< 8 m² / sub 1.5 m", rangeEn: "< 8 m² / under 1.5 m" },
  { key: "M", ro: "Mediu",  en: "Medium", rangeRo: "8–15 m² / 1.5–3 m",  rangeEn: "8–15 m² / 1.5–3 m" },
  { key: "L", ro: "Mare",   en: "Mare",   rangeRo: "> 15 m² / peste 3 m", rangeEn: "> 15 m² / over 3 m" },
];

// ---- Rooms and their piece palettes (§4.1 request_rooms / request_items) ----
const RF_ROOMS = [
  { key: "bucatarie", ic: "box",    ro: "Bucătărie", en: "Kitchen", pieces: [
    { key: "corp_inf", ro: "Corp inferior", en: "Base units", subRo: "blat + sertare" },
    { key: "corp_sup", ro: "Corp superior", en: "Wall units", subRo: "dulapuri sus" },
    { key: "insula",   ro: "Insulă",        en: "Island",     subRo: "central" },
    { key: "camara",   ro: "Coloană / cămară", en: "Tall pantry", subRo: "depozitare" },
  ]},
  { key: "dressing", ic: "grid",   ro: "Dressing", en: "Dressing", pieces: [
    { key: "dulap",    ro: "Dulap haine",    en: "Wardrobe",    subRo: "corp principal" },
    { key: "sertare",  ro: "Sistem sertare", en: "Drawer system", subRo: "interior" },
    { key: "pantofar", ro: "Pantofar",       en: "Shoe rack",   subRo: "jos" },
  ]},
  { key: "living", ic: "layers",  ro: "Living", en: "Living", pieces: [
    { key: "biblioteca", ro: "Bibliotecă",   en: "Bookcase",   subRo: "perete" },
    { key: "comoda_tv",  ro: "Comodă TV",     en: "TV unit",    subRo: "media" },
    { key: "vitrina",    ro: "Vitrină",       en: "Display cab.", subRo: "sticlă" },
  ]},
  { key: "birou", ic: "file",    ro: "Birou", en: "Office", pieces: [
    { key: "birou_c",  ro: "Birou custom",   en: "Custom desk", subRo: "blat lucru" },
    { key: "raft_b",   ro: "Bibliotecă birou", en: "Office shelves", subRo: "suspendat" },
  ]},
  { key: "dormitor", ic: "home",   ro: "Dormitor", en: "Bedroom", pieces: [
    { key: "pat",      ro: "Pat + tăblie",   en: "Bed + headboard", subRo: "tapițat" },
    { key: "noptiere", ro: "Noptiere",       en: "Nightstands", subRo: "pereche" },
    { key: "dulap_d",  ro: "Dulap dormitor", en: "Wardrobe",    subRo: "haine" },
  ]},
  { key: "baie", ic: "pkg",     ro: "Baie", en: "Bath", pieces: [
    { key: "lavoar",   ro: "Mobilier chiuvetă", en: "Vanity unit", subRo: "sub lavoar" },
    { key: "oglinda",  ro: "Oglindă iluminată", en: "Lit mirror",  subRo: "LED" },
  ]},
];
const RF_ROOM = Object.fromEntries(RF_ROOMS.map(r => [r.key, r]));
const RF_PIECE_LABEL = {};
RF_ROOMS.forEach(r => r.pieces.forEach(p => { RF_PIECE_LABEL[r.key + ":" + p.key] = p; }));

// ---- helpers ----
const rfUnitPts = (it) => RF_SIZE_PTS[it.size] + (RF_MATERIALS.find(m => m.key === it.material)?.pts || 0) + it.acc.reduce((s, a) => s + (RF_ACC.find(x => x.key === a)?.pts || 0), 0);
const rfItemPts = (it) => rfUnitPts(it) * it.qty;
const rfSizeOf = (score) => score < 60 ? "SMALL" : score < 120 ? "MEDIUM" : "LARGE";
const rfClaimCost = (size) => ({ SMALL: 1, MEDIUM: 2, LARGE: 4 }[size]);

const RFSpec = ({ children }) => <span className="rf-spec">{children}</span>;

const RFQty = ({ value, onChange, mini }) => (
  <div className={`qty ${mini ? "mini" : ""}`} onClick={(e) => e.stopPropagation()}>
    <button disabled={value <= 1} onClick={() => onChange(value - 1)}>–</button>
    <span className="n">{value}</span>
    <button onClick={() => onChange(value + 1)}>+</button>
  </div>
);

// ============================================================
const NewRequestPage = ({ go }) => {
  const t = useT();
  const [phase, setPhase] = React.useState(0);
  const phases = [
    t("Camere & piese", "Rooms & pieces"),
    t("Configurare", "Configure"),
    t("Schițe", "Sketches"),
    t("Detalii", "Details"),
    t("Publică", "Publish"),
  ];

  // cart of pieces; each belongs to a room. defaults so score is always computable.
  const [cart, setCart] = React.useState([
    { id: "i1", room: "bucatarie", piece: "corp_inf", qty: 1, size: "M", material: "mdf", acc: ["soft", "push"], note: "" },
    { id: "i2", room: "bucatarie", piece: "corp_sup", qty: 1, size: "M", material: "mdf", acc: ["soft"], note: "" },
    { id: "i3", room: "dressing",  piece: "dulap",    qty: 1, size: "L", material: "pal_furnir", acc: ["glisante", "led"], note: "" },
  ]);
  const [openRooms, setOpenRooms] = React.useState(["bucatarie", "dressing"]);
  const [cfgIdx, setCfgIdx] = React.useState(0);
  const [paidDesign, setPaidDesign] = React.useState(false);
  const [ownProject, setOwnProject] = React.useState(false);
  const [contactPref, setContactPref] = React.useState("chat_only");
  const [budget, setBudget] = React.useState("20-35");
  const idc = React.useRef(4);

  const score = cart.reduce((s, it) => s + rfItemPts(it), 0);
  const size = rfSizeOf(score);

  const piecesByRoom = (rk) => cart.filter(it => it.room === rk);
  const pieceCount = (rk, pk) => cart.filter(it => it.room === rk && it.piece === pk).reduce((s, it) => s + it.qty, 0);

  const toggleRoom = (rk) => {
    setOpenRooms(rs => rs.includes(rk) ? rs.filter(x => x !== rk) : [...rs, rk]);
  };
  const addPiece = (rk, pk) => {
    setOpenRooms(rs => rs.includes(rk) ? rs : [...rs, rk]);
    setCart(c => {
      const ex = c.find(it => it.room === rk && it.piece === pk);
      if (ex) return c.map(it => it === ex ? { ...it, qty: it.qty + 1 } : it);
      const id = "i" + (idc.current++);
      return [...c, { id, room: rk, piece: pk, qty: 1, size: "M", material: "pal_furnir", acc: [], note: "" }];
    });
  };
  const setPieceQty = (rk, pk, q) => setCart(c => {
    const ex = c.find(it => it.room === rk && it.piece === pk);
    if (!ex) return q > 0 ? [...c, { id: "i" + (idc.current++), room: rk, piece: pk, qty: q, size: "M", material: "pal_furnir", acc: [], note: "" }] : c;
    if (q <= 0) return c.filter(it => it !== ex);
    return c.map(it => it === ex ? { ...it, qty: q } : it);
  });
  const removeItem = (id) => setCart(c => c.filter(it => it.id !== id));
  const updItem = (id, patch) => setCart(c => c.map(it => it.id === id ? { ...it, ...patch } : it));

  const totalPieces = cart.reduce((s, it) => s + it.qty, 0);

  // ---- side: live score gauge (shared across phases) ----
  const ScoreSide = () => (
    <div className="rf-side">
      <ScoreGauge score={score} size={size} />
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="kicker">{t("Sumar proiect", "Project summary")}</div>
          <RFSpec>§4.5 · <b>project_score</b></RFSpec>
        </div>
        <div className="stack" style={{ gap: 7, fontSize: 13 }}>
          <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Camere", "Rooms")}</span><span className="mono">{new Set(cart.map(i => i.room)).size}</span></div>
          <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Piese", "Pieces")}</span><span className="mono">{totalPieces}</span></div>
          <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Scor total", "Total score")}</span><span className="mono">{score} pct</span></div>
          <hr className="divider" style={{ margin: "6px 0" }} />
          <div className="row between" style={{ fontWeight: 500 }}>
            <span>{t("Cost claim atelier", "Workshop claim cost")}</span>
            <span className="mono">{rfClaimCost(size)} {t("credite", "credits")}</span>
          </div>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          {t("Cu cât scorul e mai mare, cu atât rezervarea costă mai multe credite pentru atelier — atenție reală pentru proiecte serioase.",
             "The higher the score, the more credits a workshop spends to claim it — real attention for serious projects.")}
        </p>
      </div>
      <div className="card-flat" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
        <span className="row" style={{ gap: 8, marginBottom: 6 }}><Icon name="shield" size={13} /> <b style={{ color: "var(--ink-2)" }}>{t("Draft recuperabil", "Recoverable draft")}</b></span>
        {t("Poți începe fără cont — cererea se salvează ca draft anonim cu token și o publici când vrei.",
           "You can start without an account — the request is saved as an anonymous token draft you publish when ready.")}
      </div>
    </div>
  );

  return (
    <div className="page rf-wrap">
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("c-dashboard")}>
          <Icon name="arrowLeft" size={12} /> {t("Cererile mele", "My requests")}
        </button>
      </div>

      <div className="page-header" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">{t("Configurator cerere", "Request configurator")}</div>
          <h1 className="page-title" style={{ marginTop: 12, fontSize: 42 }}>{t("Construiește-ți proiectul", "Build your project")}</h1>
          <p className="page-sub">{t("Adaugi camere și piese ca într-un coș, apoi configurezi fiecare piesă. Sistemul calculează automat anvergura.",
            "Add rooms and pieces like a cart, then configure each piece. The system auto-scores the scope.")}</p>
        </div>
        <div style={{ marginLeft: "auto" }}><RFSpec>§4.1 · <b>request_rooms</b> / <b>request_items</b></RFSpec></div>
      </div>

      <div style={{ marginBottom: 24 }}><Stepper steps={phases} current={phase} /></div>

      {/* ============ PHASE 0 — BUILD CART ============ */}
      {phase === 0 && (
        <div className="rf-grid">
          <div className="rf-main">
            <div className="card" style={{ padding: 20 }}>
              <div className="row between" style={{ marginBottom: 4, alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <h3 className="serif" style={{ fontSize: 21, margin: 0, lineHeight: 1.15 }}>{t("1 · Ce camere?", "1 · Which rooms?")}</h3>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{t("Apasă pentru a adăuga", "Tap to add")}</span>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>{t("Selectează camerele incluse în proiect. Pentru fiecare adaugi piese mai jos.", "Pick the rooms in your project. Add pieces to each below.")}</p>
              <div className="room-grid">
                {RF_ROOMS.map(r => {
                  const cnt = piecesByRoom(r.key).reduce((s, it) => s + it.qty, 0);
                  const on = openRooms.includes(r.key) || cnt > 0;
                  return (
                    <button key={r.key} className={`room-card ${on ? "on" : ""}`} onClick={() => toggleRoom(r.key)}>
                      <div className="pick-ic"><Icon name={r.ic} size={20} /></div>
                      <div><div className="pick-t">{t(r.ro, r.en)}</div><div className="pick-s">{r.pieces.length} {t("tipuri piese", "piece types")}</div></div>
                      {cnt > 0 && <span className="room-count">{cnt}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {openRooms.filter(rk => RF_ROOM[rk]).map(rk => {
              const r = RF_ROOM[rk];
              return (
                <div key={rk} className="room-block">
                  <div className="room-block-head">
                    <div className="pick-ic"><Icon name={r.ic} size={17} /></div>
                    <h4 className="serif" style={{ fontSize: 18, margin: 0, flex: 1 }}>{t(r.ro, r.en)}</h4>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setOpenRooms(rs => rs.filter(x => x !== rk)); setCart(c => c.filter(it => it.room !== rk)); }}>
                      <Icon name="x" size={12} /> {t("Scoate camera", "Remove room")}
                    </button>
                  </div>
                  <div className="room-block-body">
                    <div className="piece-grid">
                      {r.pieces.map(p => {
                        const cnt = pieceCount(rk, p.key);
                        return (
                          <div key={p.key} className={`piece-card ${cnt > 0 ? "has" : ""}`}>
                            <div className="p-ic"><Icon name="box" size={15} /></div>
                            <div className="p-name">{t(p.ro, p.en)}<span className="p-sub"> · {t(p.subRo, p.subEn || p.subRo)}</span></div>
                            {cnt > 0
                              ? <RFQty mini value={cnt} onChange={(q) => setPieceQty(rk, p.key, q)} />
                              : <button className="add-btn" onClick={() => addPiece(rk, p.key)} aria-label="add"><Icon name="plus" size={13} /></button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            <Alert tone="info" icon="i">
              {t("Nu găsești piesa? Adaugă cea mai apropiată acum — la pasul următor poți descrie liber detaliile fiecărei piese.",
                 "Can't find a piece? Add the closest one — next step lets you describe each piece's details freely.")}
            </Alert>
          </div>

          {/* CART SIDE */}
          <div className="rf-side">
            <div className="cart">
              <div className="cart-head">
                <span className="t">{t("Proiectul tău", "Your project")}</span>
                <span className="kicker">{totalPieces} {t("piese", "pcs")}</span>
              </div>
              <div className="cart-body">
                {cart.length === 0 && <div className="cart-empty">{t("Adaugă piese din stânga", "Add pieces from the left")}</div>}
                {[...new Set(cart.map(i => i.room))].map(rk => (
                  <div key={rk} className="cart-room">
                    <div className="cart-room-name"><Icon name={RF_ROOM[rk].ic} size={12} /> {t(RF_ROOM[rk].ro, RF_ROOM[rk].en)}</div>
                    {piecesByRoom(rk).map(it => (
                      <div key={it.id} className="cart-line">
                        <span className="cl-name">{t(RF_PIECE_LABEL[rk + ":" + it.piece].ro, RF_PIECE_LABEL[rk + ":" + it.piece].en)}</span>
                        <RFQty mini value={it.qty} onChange={(q) => q > 0 && updItem(it.id, { qty: q })} />
                        <button className="cl-x" onClick={() => removeItem(it.id)}><Icon name="x" size={12} /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="cart-foot">
                <div className="row between" style={{ marginBottom: 10, fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>{t("Scor estimat", "Estimated score")}</span>
                  <span className="mono"><StatusBadge status={size} /> · {score} pct</span>
                </div>
                <button className="btn btn-walnut btn-lg" style={{ width: "100%", justifyContent: "center" }} disabled={totalPieces === 0} onClick={() => { setCfgIdx(0); setPhase(1); }}>
                  {t("Configurează piesele", "Configure pieces")} <Icon name="arrow" size={14} />
                </button>
              </div>
            </div>
            <div className="card-flat" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
              {t("Următorul pas îți ia fiecare piesă din coș și te întreabă dimensiuni, material și accesorii.",
                 "The next step walks through each piece in your cart for dimensions, material and accessories.")}
            </div>
          </div>
        </div>
      )}

      {/* ============ PHASE 1 — PER-ITEM CONFIG LOOP ============ */}
      {phase === 1 && cart.length > 0 && (() => {
        const it = cart[Math.min(cfgIdx, cart.length - 1)];
        const r = RF_ROOM[it.room];
        const p = RF_PIECE_LABEL[it.room + ":" + it.piece];
        const isLast = cfgIdx >= cart.length - 1;
        return (
          <div className="rf-grid">
            <div className="rf-main">
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "linear-gradient(160deg, var(--surface-2), var(--surface))" }}>
                  <div className="row between" style={{ marginBottom: 10 }}>
                    <div className="kicker">{t("Piesa", "Piece")} {cfgIdx + 1} / {cart.length}</div>
                    <RFSpec>§4.1 · <b>request_items</b></RFSpec>
                  </div>
                  <div className="cfg-progress"><span style={{ width: `${((cfgIdx + 1) / cart.length) * 100}%` }} /></div>
                  <div className="row" style={{ gap: 12, marginTop: 14, alignItems: "center" }}>
                    <div className="pick-ic" style={{ background: "var(--accent)", color: "#FBF6EC", borderColor: "var(--accent)" }}><Icon name={r.ic} size={18} /></div>
                    <div style={{ flex: 1 }}>
                      <h3 className="serif" style={{ fontSize: 23, margin: 0 }}>{t(p.ro, p.en)}</h3>
                      <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{t(r.ro, r.en)} · {it.qty} {t("buc", "pcs")}</div>
                    </div>
                    <RFQty value={it.qty} onChange={(q) => updItem(it.id, { qty: q })} />
                  </div>
                </div>

                <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 22 }}>
                  {/* dimensions */}
                  <div>
                    <div className="row between" style={{ marginBottom: 10 }}>
                      <div className="label">{t("Dimensiune", "Size")}</div>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{t("alege gabaritul", "pick the scale")}</span>
                    </div>
                    <div className="pick-grid cols-3">
                      {RF_SIZES.map(s => (
                        <button key={s.key} className={`pick ${it.size === s.key ? "on" : ""}`} onClick={() => updItem(it.id, { size: s.key })}>
                          <span className="pick-pts">+{RF_SIZE_PTS[s.key]}</span>
                          <div className="pick-t">{t(s.ro, s.en)}</div>
                          <div className="pick-s">{t(s.rangeRo, s.rangeEn)}</div>
                        </button>
                      ))}
                    </div>
                    <div className="dim-row" style={{ marginTop: 12 }}>
                      {[["w", t("Lățime", "Width")], ["h", t("Înălțime", "Height")], ["d", t("Adâncime", "Depth")]].map(([k, lab]) => (
                        <div key={k} className="dim-field">
                          <label>{lab}</label>
                          <div className="dim-input"><input placeholder="—" defaultValue={it["dim_" + k] || ""} onChange={(e) => updItem(it.id, { ["dim_" + k]: e.target.value })} /><span className="u">cm</span></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* material — single */}
                  <div>
                    <div className="row between" style={{ marginBottom: 10 }}>
                      <div className="label">{t("Material principal", "Main material")}</div>
                      <RFSpec>§4.5 · <b>material</b></RFSpec>
                    </div>
                    <div className="pick-grid cols-4">
                      {RF_MATERIALS.map(m => (
                        <button key={m.key} className={`pick ${it.material === m.key ? "on" : ""}`} onClick={() => updItem(it.id, { material: m.key })}>
                          <span className="pick-pts">+{m.pts}</span>
                          <div className="pick-t">{t(m.ro, m.en)}</div>
                          <div className="pick-s">{t(m.subRo, m.subEn)}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* accessories — multi */}
                  <div>
                    <div className="row between" style={{ marginBottom: 10 }}>
                      <div className="label">{t("Sisteme & accesorii", "Systems & accessories")}</div>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{t("selectează tot ce vrei", "select all you want")}</span>
                    </div>
                    <div className="pick-grid cols-3">
                      {RF_ACC.map(a => {
                        const on = it.acc.includes(a.key);
                        return (
                          <button key={a.key} className={`pick ${on ? "on" : ""}`} onClick={() => updItem(it.id, { acc: on ? it.acc.filter(x => x !== a.key) : [...it.acc, a.key] })}>
                            <div className="pick-check"><Icon name="check" size={12} /></div>
                            <div className="row" style={{ gap: 10 }}>
                              <div className="pick-ic" style={{ width: 32, height: 32 }}><Icon name={a.ic} size={15} /></div>
                              <div><div className="pick-t" style={{ fontSize: 13.5 }}>{t(a.ro, a.en)}</div><div className="pick-s" style={{ fontFamily: "var(--font-mono)" }}>+{a.pts} pct</div></div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* note */}
                  <div className="field">
                    <label>{t("Notă pentru atelier (opțional)", "Note to workshop (optional)")}</label>
                    <textarea className="textarea" style={{ minHeight: 70 }} placeholder={t("Ex: fronturi alb mat, mâner ascuns, colț de evitat...", "E.g. matte white fronts, hidden handle, corner to avoid...")} defaultValue={it.note} onChange={(e) => updItem(it.id, { note: e.target.value })} />
                  </div>
                </div>

                <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button className="btn" onClick={() => cfgIdx === 0 ? setPhase(0) : setCfgIdx(cfgIdx - 1)}>
                    <Icon name="arrowLeft" size={12} /> {cfgIdx === 0 ? t("Înapoi la coș", "Back to cart") : t("Piesa anterioară", "Previous piece")}
                  </button>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{rfUnitPts(it)} pct/{t("buc", "ea")} · {rfItemPts(it)} {t("total", "total")}</span>
                    <button className="btn btn-walnut" onClick={() => isLast ? setPhase(2) : setCfgIdx(cfgIdx + 1)}>
                      {isLast ? t("Mai departe", "Continue") : t("Piesa următoare", "Next piece")} <Icon name="arrow" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* config rail */}
            <div className="rf-side">
              <ScoreGauge score={score} size={size} />
              <div className="card">
                <div className="kicker" style={{ marginBottom: 10 }}>{t("Piese de configurat", "Pieces to configure")}</div>
                <div className="cfg-rail">
                  {cart.map((c, i) => {
                    const pl = RF_PIECE_LABEL[c.room + ":" + c.piece];
                    return (
                      <button key={c.id} className={`cfg-rail-item ${i === cfgIdx ? "on" : i < cfgIdx ? "done" : ""}`} onClick={() => setCfgIdx(i)}>
                        <span className="ri-num">{i < cfgIdx ? "✓" : i + 1}</span>
                        <span className="ri-name">{t(pl.ro, pl.en)} <span className="ri-room">×{c.qty}</span></span>
                        <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>{rfItemPts(c)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============ PHASE 2 — UPLOAD SKETCHES ============ */}
      {phase === 2 && (
        <div className="rf-grid">
          <div className="rf-main">
            <div className="card" style={{ padding: 24 }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>{t("Schițe și fotografii", "Sketches & photos")}</h3>
                <RFSpec>§3.4 · <b>attachments</b> · max 10</RFSpec>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "60ch" }}>
                {t("Ai desenat proiectul de mână? Încarcă schițele aici — ajută atelierele să înțeleagă exact ce vrei. Adaugă și poze din spațiu, planuri sau referințe.",
                   "Sketched your project by hand? Upload it here — it helps workshops understand exactly what you want. Add room photos, floor plans or references too.")}
              </p>

              <div className="dropzone" role="button">
                <div className="dz-ic"><Icon name="plus" size={24} /></div>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{t("Trage schițele aici sau apasă pentru a încărca", "Drop sketches here or tap to upload")}</div>
                <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 6 }}>{t("JPG, PNG, PDF · max 25MB/fișier · până la 10 fișiere", "JPG, PNG, PDF · max 25MB/file · up to 10 files")}</div>
              </div>

              <div className="upload-grid" style={{ marginTop: 18 }}>
                {[
                  [t("schiță de mână · bucătărie", "hand sketch · kitchen"), "SKETCH"],
                  [t("plan apartament.pdf", "floor plan.pdf"), "PLAN"],
                  [t("foto perete dressing", "dressing wall photo"), "PHOTO"],
                  [t("referință Pinterest", "Pinterest ref"), "REF"],
                ].map(([lab, tag], i) => (
                  <div key={i} className="upload-thumb">
                    <ImagePlaceholder label={lab} height={120} />
                    <span className="upload-tag">{tag}</span>
                    <button className="ut-x"><Icon name="x" size={11} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <button className="choice" style={{ width: "100%" }} onClick={() => setOwnProject(v => !v)}>
                <div className="check" style={ownProject ? { background: "var(--accent)", borderColor: "var(--accent)" } : {}}>{ownProject && <Icon name="check" size={11} />}</div>
                <div className="body">
                  <div className="title-row">
                    <div>
                      <div className="title">{t("Am deja un proiect complet", "I already have a full design")}</div>
                      <div className="sub">{t("Ai planuri 3D sau de la un designer? Atelierele ofertează direct pe ele.", "Got 3D plans or a designer's project? Workshops quote directly on them.")}</div>
                    </div>
                    {ownProject && <Badge tone="sage">{t("Activ", "On")}</Badge>}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="rf-side">
            <ScoreGauge score={score} size={size} />
            <div className="card-flat" style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
              <span className="row" style={{ gap: 8, marginBottom: 6 }}><Icon name="shield" size={13} /> <b style={{ color: "var(--ink-2)" }}>{t("Scanare anti-virus", "Virus scan")}</b></span>
              {t("Fișierele sunt scanate automat înainte să devină vizibile atelierelor (status SAFE).", "Files are scanned automatically before workshops can see them (SAFE status).")}
              <div style={{ marginTop: 8 }}><RFSpec>§3.4 · presign → scan → SAFE</RFSpec></div>
            </div>
            <div className="row between" style={{ gap: 8 }}>
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setCfgIdx(cart.length - 1); setPhase(1); }}><Icon name="arrowLeft" size={12} /> {t("Înapoi", "Back")}</button>
              <button className="btn btn-walnut" style={{ flex: 1, justifyContent: "center" }} onClick={() => setPhase(3)}>{t("Continuă", "Continue")} <Icon name="arrow" size={13} /></button>
            </div>
          </div>
        </div>
      )}

      {/* ============ PHASE 3 — DETAILS + CONTACT PREFS ============ */}
      {phase === 3 && (
        <div className="rf-grid">
          <div className="rf-main">
            <div className="card" style={{ padding: 24 }}>
              <h3 className="serif" style={{ fontSize: 22, margin: "0 0 16px" }}>{t("Buget, termen & locație", "Budget, timing & location")}</h3>
              <div className="label" style={{ marginBottom: 10 }}>{t("Buget orientativ", "Indicative budget")}</div>
              <div className="pick-grid cols-3">
                {[
                  ["sub10", t("sub 10.000", "under 10,000")], ["10-20", "10–20.000"], ["20-35", "20–35.000"],
                  ["35-60", "35–60.000"], ["60-100", "60–100.000"], ["100+", t("peste 100.000", "over 100,000")],
                ].map(([k, lab]) => (
                  <button key={k} className={`pick ${budget === k ? "on" : ""}`} onClick={() => setBudget(k)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <div className="pick-t" style={{ fontSize: 14 }}>{lab} <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>RON</span></div>
                  </button>
                ))}
              </div>

              <div className="grid-2" style={{ marginTop: 20 }}>
                <div className="field">
                  <label>{t("Termen dorit instalare", "Desired install date")}</label>
                  <input className="input" defaultValue={t("Aprilie 2026", "April 2026")} />
                </div>
                <div className="field">
                  <label>{t("Județ / oraș", "County / city")}</label>
                  <select className="select" defaultValue="cluj"><option value="cluj">Cluj-Napoca</option><option value="buc">București</option><option value="ts">Timișoara</option><option value="ia">Iași</option><option value="bv">Brașov</option></select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>{t("Adresă (pentru distanță & livrare)", "Address (for distance & delivery)")}</label>
                  <input className="input" placeholder={t("Stradă, număr, cartier", "Street, number, area")} defaultValue="Borhanci, Cluj-Napoca" />
                  <span className="rf-spec" style={{ marginTop: 6, alignSelf: "flex-start" }}><Icon name="search" size={11} />&nbsp; §3.8 · <b>geocoded</b> → lat/lng · Haversine</span>
                </div>
              </div>

              <hr className="divider" />
              <button className="choice" style={{ width: "100%" }} onClick={() => setPaidDesign(v => !v)}>
                <div className="check" style={paidDesign ? { background: "var(--accent)", borderColor: "var(--accent)" } : {}}>{paidDesign && <Icon name="check" size={11} />}</div>
                <div className="body"><div className="title-row"><div>
                  <div className="title">{t("Vreau și proiectare contra cost", "I also want paid design")}</div>
                  <div className="sub">{t("Atelierul include o linie separată de preț pentru proiectarea 3D, în ofertă.", "The workshop adds a separate design-fee line in its offer.")}</div>
                </div>{paidDesign ? <Badge tone="sage">{t("Inclus", "On")}</Badge> : <RFSpec>§4.1 · <b>includes_paid_design</b></RFSpec>}</div></div>
              </button>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>{t("Cum partajezi datele de contact?", "How do you share contact data?")}</h3>
                <RFSpec>§4.2 · <b>request_contact_preferences</b></RFSpec>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>{t("Tu controlezi când văd atelierele telefonul și emailul. Aplicat la nivel de API.", "You control when workshops see your phone and email. Enforced at the API level.")}</p>
              <div className="pick-grid cols-2">
                {[
                  { key: "chat_only", ro: "Doar chat în aplicație", en: "In-app chat only", subRo: "fără telefon/email", subEn: "no phone/email" },
                  { key: "name_chat", ro: "Nume + chat", en: "Name + chat", subRo: "fără telefon/email", subEn: "no phone/email" },
                  { key: "after_claim", ro: "Telefon + email după claim", en: "Phone + email after claim", subRo: "când firma rezervă", subEn: "when a workshop claims" },
                  { key: "after_accept", ro: "Date doar după acceptare", en: "Data only after accept", subRo: "după ce alegi o ofertă", subEn: "after you pick an offer" },
                  { key: "full", ro: "Partajare completă imediat", en: "Full sharing immediately", subRo: "la publicare", subEn: "on publish" },
                ].map(o => (
                  <button key={o.key} className={`pick ${contactPref === o.key ? "on" : ""}`} onClick={() => setContactPref(o.key)}>
                    <div className="pick-check"><Icon name="check" size={12} /></div>
                    <div className="pick-t" style={{ fontSize: 13.5 }}>{t(o.ro, o.en)}</div>
                    <div className="pick-s">{t(o.subRo, o.subEn)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="row between" style={{ gap: 8 }}>
              <button className="btn" onClick={() => setPhase(2)}><Icon name="arrowLeft" size={12} /> {t("Înapoi", "Back")}</button>
              <button className="btn btn-walnut" onClick={() => setPhase(4)}>{t("Verifică & publică", "Review & publish")} <Icon name="arrow" size={13} /></button>
            </div>
          </div>
          <ScoreSide />
        </div>
      )}

      {/* ============ PHASE 4 — PUBLISH ============ */}
      {phase === 4 && (
        <div className="rf-grid">
          <div className="rf-main">
            <div className="card" style={{ padding: 24 }}>
              <div className="row between" style={{ marginBottom: 14 }}>
                <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>{t("Verifică proiectul", "Review your project")}</h3>
                <StatusBadge status={size} />
              </div>
              {[...new Set(cart.map(i => i.room))].map(rk => (
                <div key={rk} style={{ marginBottom: 12 }}>
                  <div className="cart-room-name" style={{ marginBottom: 4 }}><Icon name={RF_ROOM[rk].ic} size={12} /> {t(RF_ROOM[rk].ro, RF_ROOM[rk].en)}</div>
                  {piecesByRoom(rk).map(it => {
                    const pl = RF_PIECE_LABEL[rk + ":" + it.piece];
                    const mat = RF_MATERIALS.find(m => m.key === it.material);
                    return (
                      <div key={it.id} className="recap-line">
                        <div className="rl-name">{t(pl.ro, pl.en)} {it.qty > 1 && <span className="mono" style={{ color: "var(--muted)" }}>×{it.qty}</span>}
                          <div className="rl-meta">{RF_SIZES.find(s => s.key === it.size) ? t(RF_SIZES.find(s => s.key === it.size).ro, RF_SIZES.find(s => s.key === it.size).en) : it.size} · {t(mat.ro, mat.en)}{it.acc.length ? " · " + it.acc.length + (t(" accesorii", " accessories")) : ""}</div>
                        </div>
                        <div className="rl-pts">{rfItemPts(it)} pct</div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <hr className="divider" />
              <div className="row between" style={{ fontWeight: 600, fontSize: 15 }}>
                <span>{t("Scor total", "Total score")}</span>
                <span className="mono">{score} pct · <StatusBadge status={size} /></span>
              </div>
            </div>

            <Alert tone="info" icon="i" title={t("Cererea va fi vizibilă atelierelor în câteva minute", "Your request goes live to workshops in minutes")}>
              {t("Maxim 3 ateliere îți pot rezerva proiectul. Vei primi notificări pentru fiecare claim, ofertă și mesaj.",
                 "Max 3 workshops can claim it. You'll get notified for every claim, offer and message.")}
            </Alert>
            {paidDesign && <Alert tone="sage" icon="✓">{t("Ai cerut proiectare contra cost — atelierele vor include o linie design_fee în ofertă.", "You requested paid design — workshops will add a design_fee line in their offer.")}</Alert>}

            <div className="row between" style={{ gap: 8 }}>
              <button className="btn" onClick={() => setPhase(3)}><Icon name="arrowLeft" size={12} /> {t("Înapoi", "Back")}</button>
              <button className="btn btn-walnut btn-lg" onClick={() => go("c-request-detail")}>{t("Publică cererea", "Publish request")} <Icon name="arrow" size={14} /></button>
            </div>
          </div>

          <div className="rf-side">
            <ScoreGauge score={score} size={size} />
            <div className="card">
              <div className="kicker" style={{ marginBottom: 12 }}>{t("Detalii cerere", "Request details")}</div>
              <div className="stack" style={{ gap: 8, fontSize: 13 }}>
                <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Cost claim", "Claim cost")}</span><span className="mono">{rfClaimCost(size)} {t("credite", "credits")}</span></div>
                <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Buget", "Budget")}</span><span>{budget.replace("-", "–")}k RON</span></div>
                <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Contact", "Contact")}</span><span style={{ fontSize: 12 }}>{contactPref.replace("_", " ")}</span></div>
                <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Proiectare plătită", "Paid design")}</span><span>{paidDesign ? t("Da", "Yes") : t("Nu", "No")}</span></div>
              </div>
              <div style={{ marginTop: 12 }}><RFSpec>§4.4 · expiră în <b>5 zile lucrătoare</b></RFSpec></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

window.NewRequestPage = NewRequestPage;
