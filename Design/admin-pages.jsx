// Admin pages for Plan marketplace

// 16. ADMIN DASHBOARD
const AdminDashboard = ({ go }) => (
  <div className="page">
    <div className="page-header">
      <div>
        <div className="kicker">Admin · operațional</div>
        <h1 className="page-title">Operațional Plan</h1>
        <p className="page-sub">14 firme noi în review, 3 cereri anulare de aprobat, 2 alerte penalizare.</p>
      </div>
    </div>

    <div className="grid-4" style={{ marginBottom: 28 }}>
      {[
        { l: "Cereri active", v: "238", s: "82 azi · 156 în negociere" },
        { l: "Firme active", v: "342", s: "+14 în review" },
        { l: "Tranzacții 30 zile", v: "184k", s: "RON · +12% MoM" },
        { l: "Acțiuni urgente", v: "5", s: "review withdraws + flags" }
      ].map(m => (
        <div key={m.l} className="card-flat">
          <div className="kicker">{m.l}</div>
          <div className="metric-big" style={{ marginTop: 8 }}>{m.v}</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{m.s}</div>
        </div>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      <div className="card">
        <h3 className="serif" style={{ fontSize: 22, margin: "0 0 14px" }}>Volum săptămânal</h3>
        <div style={{ height: 240, display: "flex", alignItems: "flex-end", gap: 8, padding: "20px 0" }}>
          {[42, 58, 51, 67, 62, 78, 71, 83, 76, 88, 92, 84, 96, 102].map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: `${v * 1.8}px`, background: i > 7 ? "var(--walnut)" : "var(--surface-2)", borderRadius: 4, border: "1px solid var(--border)" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--muted)" }}>
          <div><span className="status-dot muted" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} /> Săptămâna trecută</div>
          <div><span className="status-dot" style={{ background: "var(--walnut)" }} /> Săptămâna asta</div>
        </div>
      </div>

      <div className="card">
        <h3 className="serif" style={{ fontSize: 22, margin: "0 0 14px" }}>Coadă acțiuni</h3>
        <div className="stack">
          {[
            { l: "Cereri anulare claim", n: 3, tone: "amber", go: "a-withdrawals" },
            { l: "Firme noi în review", n: 14, tone: "info", go: null },
            { l: "Flags conduită clienți", n: 2, tone: "crimson", go: null },
            { l: "Disputes activ", n: 1, tone: "crimson", go: null }
          ].map(a => (
            <div key={a.l} className="card-flat" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Badge tone={a.tone}>{a.n}</Badge>
              <div style={{ flex: 1, fontSize: 13.5 }}>{a.l}</div>
              <button className="btn btn-sm btn-ghost" onClick={() => a.go && go(a.go)}><Icon name="arrow" size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="grid-2" style={{ marginTop: 24 }}>
      <div className="card">
        <h3 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>Configurări sistem</h3>
        <div className="stack">
          {[
            { l: "Project sizing — puncte & praguri", go: "a-sizing" },
            { l: "Planuri abonament & gating delay", go: "a-plans" },
            { l: "Pachete credite top-up", go: null },
            { l: "Praguri penalizări", go: null },
            { l: "Auto-approve reasons pentru anulare claim", go: null },
            { l: "Audit log retention", go: null }
          ].map(c => (
            <button key={c.l} className="card-flat" style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "100%" }} onClick={() => c.go && go(c.go)}>
              <Icon name="settings" size={14} />
              <span style={{ flex: 1, fontSize: 13.5 }}>{c.l}</span>
              <Icon name="arrow" size={12} />
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>Activitate recentă</h3>
        <div className="timeline">
          {[
            { t: "acum 8 min", title: "Cerere R-2845 publicată · score 142 LARGE" },
            { t: "acum 22 min", title: "Lemnăria Crișan a făcut claim pe R-2841" },
            { t: "acum 1h", title: "Acceptat refund pentru C-1012 (cerere modificată)" },
            { t: "acum 2h", title: "Firma 'Atelier Vest' a făcut upgrade la Platinum" },
            { t: "acum 4h", title: "Cerere R-2843 expirată fără claim · client notificat" }
          ].map((e, i) => (
            <div key={i} className="timeline-item">
              <div className="time">{e.t}</div>
              <div className="dot-col"><div className="dot" /><div className="line" /></div>
              <div className="content"><h4 style={{ fontSize: 13 }}>{e.title}</h4></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// 17. PROJECT SIZING CONFIG
const SizingConfigPage = ({ go }) => {
  const [tab, setTab] = React.useState("Categorii & puncte");
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("a-dashboard")}>
          <Icon name="arrowLeft" size={12} /> Admin
        </button>
      </div>

      <div className="page-header">
        <div>
          <div className="kicker">Settings · project_sizing_config</div>
          <h1 className="page-title">Scoring proiecte</h1>
          <p className="page-sub">Configurează punctele acordate la fiecare opțiune și pragurile de mărime. Modificările se aplică doar pentru cereri viitoare.</p>
        </div>
        <div className="page-actions">
          <button className="btn">Vezi audit log</button>
          <button className="btn btn-primary">Publică modificări</button>
        </div>
      </div>

      <Tabs tabs={["Categorii & puncte", "Praguri mărime", "Cost claim per mărime"]} current={tab} onChange={setTab} />

      {tab === "Categorii & puncte" && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 22 }}>Categorie</th>
                <th>Cheie</th>
                <th>Label (RO)</th>
                <th>Puncte</th>
                <th>Activ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[
                { cat: "camera", key: "bucatarie_s", label: "Bucătărie < 8m²", pts: 15, active: true },
                { cat: "camera", key: "bucatarie_m", label: "Bucătărie 8–15m²", pts: 25, active: true },
                { cat: "camera", key: "bucatarie_l", label: "Bucătărie > 15m²", pts: 40, active: true },
                { cat: "camera", key: "dressing_s", label: "Dressing < 8m²", pts: 15, active: true },
                { cat: "camera", key: "dressing_m", label: "Dressing 8–15m²", pts: 25, active: true },
                { cat: "camera", key: "dressing_l", label: "Dressing > 15m²", pts: 40, active: true },
                { cat: "material", key: "pal", label: "PAL melaminat", pts: 5, active: true },
                { cat: "material", key: "pal_furnir", label: "PAL furnir", pts: 15, active: true },
                { cat: "material", key: "mdf_vopsit", label: "MDF vopsit", pts: 25, active: true },
                { cat: "material", key: "lemn_masiv", label: "Lemn masiv", pts: 45, active: true },
                { cat: "system", key: "soft_close", label: "Soft-close", pts: 8, active: true },
                { cat: "system", key: "push", label: "Push-to-open", pts: 8, active: true },
                { cat: "system", key: "glisante", label: "Uși glisante", pts: 8, active: true },
                { cat: "system", key: "led", label: "Iluminat LED", pts: 8, active: true },
                { cat: "system", key: "blat_cuart", label: "Blat cuarț", pts: 12, active: true },
                { cat: "system", key: "sertare_int", label: "Organizatoare interne", pts: 6, active: false }
              ].map((row, i) => (
                <tr key={i}>
                  <td style={{ paddingLeft: 22 }}><Badge tone={row.cat === "camera" ? "walnut" : row.cat === "material" ? "info" : "sage"}>{row.cat}</Badge></td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{row.key}</td>
                  <td>{row.label}</td>
                  <td><input className="input" style={{ width: 80, padding: "6px 8px" }} defaultValue={row.pts} /></td>
                  <td><Toggle on={row.active} /></td>
                  <td><button className="btn btn-ghost btn-sm">⋯</button></td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} style={{ paddingLeft: 22 }}>
                  <button className="btn btn-sm"><Icon name="plus" size={12} /> Adaugă opțiune</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "Praguri mărime" && (
        <div className="stack">
          <div className="grid-3">
            {[
              { size: "SMALL", min: 0, max: 60, color: "var(--muted)" },
              { size: "MEDIUM", min: 60, max: 120, color: "var(--walnut)" },
              { size: "LARGE", min: 120, max: 999, color: "var(--ink)" }
            ].map(s => (
              <div key={s.size} className="card">
                <div className="kicker" style={{ color: s.color }}>{s.size}</div>
                <div className="grid-2" style={{ marginTop: 14 }}>
                  <div className="field"><label>Min puncte</label><input className="input" defaultValue={s.min} /></div>
                  <div className="field"><label>Max puncte</label><input className="input" defaultValue={s.max} /></div>
                </div>
              </div>
            ))}
          </div>

          <Alert tone="info" icon="i">
            Pragurile NU se pot suprapune. Modificările se aplică doar pentru cereri publicate după salvare. Cererile existente păstrează valoarea înghețată la momentul claim-ului.
          </Alert>

          <div className="card">
            <div className="kicker">Distribuție cereri active (după mărime)</div>
            <div style={{ display: "flex", gap: 0, marginTop: 14, height: 36, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: "32%", background: "var(--muted-2)", display: "grid", placeItems: "center", color: "white", fontSize: 12, fontFamily: "var(--font-mono)" }}>SMALL 32%</div>
              <div style={{ width: "48%", background: "var(--walnut)", display: "grid", placeItems: "center", color: "white", fontSize: 12, fontFamily: "var(--font-mono)" }}>MEDIUM 48%</div>
              <div style={{ width: "20%", background: "var(--ink)", display: "grid", placeItems: "center", color: "white", fontSize: 12, fontFamily: "var(--font-mono)" }}>LARGE 20%</div>
            </div>
          </div>
        </div>
      )}

      {tab === "Cost claim per mărime" && (
        <div className="card">
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Numărul de credite consumate când un atelier rezervă o cerere. Înghețat pe claim_slot la momentul rezervării.
          </p>
          <div className="grid-3" style={{ marginTop: 16 }}>
            {[
              { size: "SMALL", credits: 1 },
              { size: "MEDIUM", credits: 2 },
              { size: "LARGE", credits: 4 }
            ].map(s => (
              <div key={s.size} className="card-flat">
                <div className="kicker">{s.size}</div>
                <div className="row" style={{ marginTop: 12, gap: 10 }}>
                  <input className="input" defaultValue={s.credits} style={{ width: 80 }} />
                  <span style={{ color: "var(--muted)" }}>credite</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 18. PLANS & GATING CONFIG
const PlansConfigPage = ({ go }) => {
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("a-dashboard")}>
          <Icon name="arrowLeft" size={12} /> Admin
        </button>
      </div>

      <div className="page-header">
        <div>
          <div className="kicker">Settings · subscription_plans</div>
          <h1 className="page-title">Planuri abonament & gating</h1>
          <p className="page-sub">Preț, credite incluse și delay-ul de acces la cereri noi.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 24 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 22 }}>Tier</th>
              <th>Preț RON/lună</th>
              <th>Credite incluse</th>
              <th>Delay acces cereri</th>
              <th>Featured în marketplace</th>
              <th>Suport</th>
              <th>Activ</th>
            </tr>
          </thead>
          <tbody>
            {[
              { tier: "SILVER", price: 149, credits: 15, delay: 60, featured: false, support: "Email", active: true },
              { tier: "GOLD", price: 399, credits: 50, delay: 30, featured: false, support: "Prioritar", active: true },
              { tier: "PLATINUM", price: 899, credits: 120, delay: 0, featured: true, support: "Dedicat", active: true }
            ].map(p => (
              <tr key={p.tier}>
                <td style={{ paddingLeft: 22 }}><TierBadge tier={p.tier} /></td>
                <td><input className="input" defaultValue={p.price} style={{ width: 100 }} /></td>
                <td><input className="input" defaultValue={p.credits} style={{ width: 100 }} /></td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input" defaultValue={p.delay} style={{ width: 80 }} />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>min</span>
                  </div>
                </td>
                <td><Toggle on={p.featured} /></td>
                <td>{p.support}</td>
                <td><Toggle on={p.active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>Pachete top-up</h3>
          <table className="table">
            <thead><tr><th style={{paddingLeft:0}}>Credite</th><th>Preț RON</th><th>RON/credit</th><th>Activ</th></tr></thead>
            <tbody>
              {[
                { c: 10, p: 100 },
                { c: 50, p: 400 },
                { c: 100, p: 700 }
              ].map((pk, i) => (
                <tr key={i}>
                  <td style={{paddingLeft:0}}><input className="input" defaultValue={pk.c} style={{ width: 80 }} /></td>
                  <td><input className="input" defaultValue={pk.p} style={{ width: 100 }} /></td>
                  <td className="mono" style={{ color: "var(--muted)" }}>{(pk.p / pk.c).toFixed(1)}</td>
                  <td><Toggle on={true} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>Trial firme noi</h3>
          <div className="stack" style={{ gap: 14 }}>
            <div className="row between">
              <span>Trial activ</span>
              <Toggle on={true} />
            </div>
            <div className="field"><label>Plan trial</label>
              <select className="select" defaultValue="GOLD">
                <option>SILVER</option><option>GOLD</option><option>PLATINUM</option>
              </select>
            </div>
            <div className="field"><label>Durată (zile)</label><input className="input" defaultValue="30" /></div>
            <div className="field"><label>Credite bonus inițiale</label><input className="input" defaultValue="10" /></div>
            <Alert tone="info" icon="i">
              Trial activabil doar după aprobare admin. Firma primește 1 lună Gold gratuit + 10 credite la primul login.
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
};

// 19. CLAIM WITHDRAWALS QUEUE
const WithdrawalsQueuePage = ({ go }) => (
  <div className="page">
    <div style={{ marginBottom: 18 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => go("a-dashboard")}>
        <Icon name="arrowLeft" size={12} /> Admin
      </button>
    </div>

    <div className="page-header">
      <div>
        <div className="kicker">Coadă review</div>
        <h1 className="page-title">Anulări claim · review manual</h1>
        <p className="page-sub">SLA 48h per cerere. Auto-aprobările pentru motive predefinite se procesează instant.</p>
      </div>
    </div>

    <div className="grid-4" style={{ marginBottom: 24 }}>
      <div className="card-flat">
        <div className="kicker">În coadă</div>
        <div className="metric-big" style={{ marginTop: 8 }}>3</div>
      </div>
      <div className="card-flat">
        <div className="kicker">SLA depășit</div>
        <div className="metric-big" style={{ marginTop: 8, color: "var(--crimson)" }}>0</div>
      </div>
      <div className="card-flat">
        <div className="kicker">Auto-aprobate săpt</div>
        <div className="metric-big" style={{ marginTop: 8 }}>22</div>
      </div>
      <div className="card-flat">
        <div className="kicker">Rate respingeri</div>
        <div className="metric-big" style={{ marginTop: 8 }}>18%</div>
      </div>
    </div>

    <div className="stack">
      {[
        { id: "WD-204", company: "Studio Mobilier Vest", req: "R-2789", reason: "CUSTOM", desc: "Clientul a oferit detalii contradictorii în chat — nu mai vrea blat cuarț, apoi 'nu se înțelege ce să fie'.", evidence: ["screenshot-1.png", "screenshot-2.png"], age: "12 ore", credits: 4, slaLeft: "36h" },
        { id: "WD-203", company: "Lemnăria Crișan", req: "R-2776", reason: "CUSTOM", desc: "Cerere realistă neviabilă pentru profilul atelierului — am realizat după claim că este o casă în construcție, fără gata pentru montaj.", evidence: [], age: "1 zi", credits: 4, slaLeft: "24h", warn: true },
        { id: "WD-202", company: "Atelier Stejar", req: "R-2745", reason: "CUSTOM", desc: "Tehnic neviabil — adresa este la etajul 8 fără lift de marfă; corpurile noastre nu intră pe scara îngustă.", evidence: ["foto-scara.jpg"], age: "1.5 zile", credits: 8, slaLeft: "12h" }
      ].map(w => (
        <div key={w.id} className="card">
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{w.id}</span>
                <Badge tone="amber" dot>PENDING REVIEW</Badge>
                {w.warn && <Badge tone="crimson">SLA &lt; 24h</Badge>}
              </div>
              <h3 className="serif" style={{ fontSize: 22, margin: "0 0 6px" }}>{w.company}</h3>
              <div className="row" style={{ gap: 10, color: "var(--muted)", fontSize: 12.5 }}>
                <span>Cerere {w.req}</span> <span>·</span>
                <span>{w.credits} credite în joc</span> <span>·</span>
                <span>SLA rămas {w.slaLeft}</span>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn">Vezi chat complet</button>
              <button className="btn">Mesaj la firmă</button>
            </div>
          </div>

          <hr className="divider" />

          <div className="grid-2">
            <div>
              <div className="kicker">Motiv invocat</div>
              <p style={{ marginTop: 8, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55 }}>"{w.desc}"</p>
            </div>
            <div>
              <div className="kicker">Dovezi atașate</div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {w.evidence.length > 0 ? w.evidence.map((e, i) => (
                  <div key={i} className="badge outline"><Icon name="file" size={12} /> {e}</div>
                )) : <span style={{ color: "var(--muted)", fontSize: 13 }}>Fără dovezi atașate</span>}
              </div>
            </div>
          </div>

          <hr className="divider" />

          <div className="row between">
            <button className="btn btn-ghost btn-sm">Cere informații suplimentare</button>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-danger">Respinge (slot rămâne)</button>
              <button className="btn btn-walnut">Aprobă · refund {w.credits} cr</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// 20. AUDIT LOG
const AuditLogPage = ({ go }) => (
  <div className="page">
    <div style={{ marginBottom: 18 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => go("a-dashboard")}>
        <Icon name="arrowLeft" size={12} /> Admin
      </button>
    </div>

    <div className="page-header">
      <div>
        <div className="kicker">audit_logs · imutabil · DB-level append-only</div>
        <h1 className="page-title">Audit log</h1>
        <p className="page-sub">Toate acțiunile critice. Imposibil de șters, imposibil de modificat — protejat la nivel PostgreSQL.</p>
      </div>
      <div className="page-actions">
        <button className="btn"><Icon name="search" size={14} /> Filtrează</button>
        <button className="btn">Export CSV</button>
      </div>
    </div>

    <div className="row" style={{ gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
      <div className="badge outline">Tip: toate</div>
      <div className="badge outline">Severitate: toate</div>
      <div className="badge outline">Interval: ultimele 24h</div>
      <button className="btn btn-ghost btn-sm">+ Filtru</button>
    </div>

    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ paddingLeft: 22 }}>Timestamp</th>
            <th>Actor</th>
            <th>Acțiune</th>
            <th>Entitate</th>
            <th>Detalii</th>
            <th>Severitate</th>
          </tr>
        </thead>
        <tbody>
          {[
            { ts: "12 mar 14:22:08", actor: "ion@crisan.ro", a: "claim.created", e: "R-2841", det: "Credits –2, snapshot {score:87,size:MEDIUM}", sev: "info" },
            { ts: "12 mar 13:18:42", actor: "system", a: "request.published", e: "R-2841", det: "Score: 87, Size: MEDIUM, Visibility: GOLD+30,SILVER+60", sev: "info" },
            { ts: "12 mar 12:05:11", actor: "diana@crisan.ro", a: "quote.version.created", e: "Q-1124 v2", det: "Price: 33.200→32.400 RON", sev: "info" },
            { ts: "12 mar 11:48:30", actor: "admin@plan.ro", a: "withdrawal.approved", e: "WD-202", det: "Refund 4 credits to Atelier Stejar", sev: "warn" },
            { ts: "12 mar 11:32:01", actor: "system", a: "penalty.applied", e: "company:42", det: "+2 pct · CLIENT_RESPONSE_LATE · expires 2026-09-08", sev: "warn" },
            { ts: "12 mar 10:14:55", actor: "andreea@gmail.com", a: "request.created", e: "R-2845", det: "Score: 142, Size: LARGE", sev: "info" },
            { ts: "12 mar 09:58:12", actor: "system", a: "claim.auto_cancelled", e: "C-1018", det: "Unassigned >1h · Refund 2 credits", sev: "warn" },
            { ts: "12 mar 09:42:00", actor: "admin@plan.ro", a: "config.updated", e: "project_sizing_config", det: "lemn_masiv: 40 → 45 pts", sev: "critical" }
          ].map((row, i) => (
            <tr key={i}>
              <td style={{ paddingLeft: 22 }} className="mono">{row.ts}</td>
              <td className="mono" style={{ fontSize: 12 }}>{row.actor}</td>
              <td><Badge tone={row.sev === "critical" ? "crimson" : row.sev === "warn" ? "amber" : "info"}>{row.a}</Badge></td>
              <td className="mono" style={{ fontSize: 12 }}>{row.e}</td>
              <td style={{ fontSize: 12.5, color: "var(--muted)" }} className="mono">{row.det}</td>
              <td>
                {row.sev === "critical" && <Badge tone="crimson" dot>CRITICAL</Badge>}
                {row.sev === "warn" && <Badge tone="amber" dot>WARN</Badge>}
                {row.sev === "info" && <Badge tone="muted" dot>INFO</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

Object.assign(window, {
  AdminDashboard, SizingConfigPage, PlansConfigPage, WithdrawalsQueuePage, AuditLogPage
});
