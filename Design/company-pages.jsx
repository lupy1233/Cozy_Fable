// Company-side pages for Plan marketplace

// 8. COMPANY MARKETPLACE
const CompanyMarketplace = ({ go }) => {
  const requests = [
  { id: "R-2841", title: "Bucătărie + dressing apartament Borhanci", city: "Cluj-Napoca", score: 87, size: "MEDIUM", credits: 2, claims: 2, max: 3, age: "acum 12 min", locked: false, tier: "PLATINUM" },
  { id: "R-2844", title: "Reamenajare apartament 3 camere", city: "Cluj-Napoca", score: 156, size: "LARGE", credits: 4, claims: 0, max: 3, age: "acum 28 min", locked: false, tier: "PLATINUM" },
  { id: "R-2840", title: "Bibliotecă living + birou custom", city: "Florești", score: 42, size: "SMALL", credits: 1, claims: 1, max: 3, age: "acum 1h", locked: false, tier: "GOLD" },
  { id: "R-2839", title: "Dressing colțar dormitor matrimonial", city: "Cluj-Napoca", score: 58, size: "SMALL", credits: 1, claims: 0, max: 3, age: "acum 1h 25min", locked: false, tier: "GOLD" },
  { id: "R-2837", title: "Bucătărie completă, casă nouă", city: "Apahida", score: 102, size: "MEDIUM", credits: 2, claims: 3, max: 3, age: "acum 2h", locked: true, full: true },
  { id: "R-2836", title: "Mobilier baie + dressing baie", city: "Cluj-Napoca", score: 38, size: "SMALL", credits: 1, claims: 1, max: 3, age: "acum 3h", locked: false, tier: "SILVER" }];


  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="kicker">Marketplace cereri · Live</div>
          <h1 className="page-title">Cereri disponibile</h1>
          <p className="page-sub">Maxim 3 ateliere pot să-și rezerve fiecare cerere. Acționează rapid.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="search" size={14} /> Filtre</button>
          <div className="role-pill">
            <Icon name="credit" size={12} />
            <span>32 credite · Gold</span>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card-flat">
          <div className="kicker">Cereri publicate azi</div>
          <div className="metric-big" style={{ marginTop: 8 }}>14</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>+4 față de ieri</div>
        </div>
        <div className="card-flat">
          <div className="kicker">Disponibile pentru tine</div>
          <div className="metric-big" style={{ marginTop: 8 }}>9</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>5 cereri full deja</div>
        </div>
        <div className="card-flat">
          <div className="kicker">Plan tău</div>
          <div className="row" style={{ marginTop: 12 }}><TierBadge tier="GOLD" /></div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>Acces +30 min după publicare</div>
        </div>
        <div className="card-flat">
          <div className="kicker">Claims active</div>
          <div className="row" style={{ marginTop: 8, gap: 14 }}>
            <div className="metric-big">2</div>
            <SlotTrack filled={2} total={5} />
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>din 5 sloturi angajați</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          <h3 className="serif" style={{ fontSize: 22, margin: 0, flex: 1 }}>Cereri active</h3>
          <button className="btn btn-sm">Cluj-Napoca + 50km</button>
          <button className="btn btn-sm">Toate dimensiunile</button>
          <button className="btn btn-sm">Cele mai noi</button>
        </div>

        <div className="stack" style={{ padding: 16, gap: 12 }}>
          {requests.map((r) =>
          <div key={r.id} className={`market-card ${r.locked ? "locked" : ""}`}>
              <div>
                <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                  <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>{r.id}</span>
                  <StatusBadge status={r.size} />
                  {r.full && <Badge tone="crimson" dot>FULL</Badge>}
                  {!r.full && r.tier === "PLATINUM" && <Badge tone="ink">Acces instant</Badge>}
                  {!r.full && r.tier === "GOLD" && <Badge tone="amber">+30 min</Badge>}
                  {!r.full && r.tier === "SILVER" && <Badge tone="muted">+60 min</Badge>}
                </div>
                <h3>{r.title}</h3>
                <div className="meta">
                  <span style={{ color: "var(--muted)", fontSize: 12.5 }}>📍 {r.city}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12.5 }}>· score {r.score}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12.5 }}>· {r.age}</span>
                </div>
                <div className="desc">
                  {r.id === "R-2841" && "Apartament 3 camere, MDF vopsit alb mat, blat cuarț, sisteme push-to-open. Dressing colțar cu uși glisante în dormitor."}
                  {r.id === "R-2844" && "Apartament 3 camere — bucătărie + dressing dormitor + bibliotecă living + comodă TV + birou custom. Material premium."}
                  {r.id === "R-2840" && "Bibliotecă pe perete în living (3.5m) + birou custom pentru work-from-home. Stejar furnir natur preferat."}
                  {r.id === "R-2839" && "Dressing în formă de L pentru dormitor matrimonial, uși glisante cu spațiu pentru oglindă plus iluminat LED."}
                  {r.id === "R-2837" && "Casă nouă, parter — bucătărie deschisă spre living, formă în U, blat cuarț, insulă centrală cu chiuvetă."}
                  {r.id === "R-2836" && "Renovare baie principală — mobilier sub chiuvetă, oglindă cu iluminat, dressing baie deasupra mașinii de spălat."}
                </div>
              </div>

              <div className="right">
                <div style={{ textAlign: "right" }}>
                  <div className="label">Cost claim</div>
                  <div className="serif" style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}>{r.credits}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>credite</div>
                </div>
                <SlotTrack filled={r.claims} total={r.max} warn={r.claims === r.max - 1} />
                <button className="btn btn-walnut btn-sm" disabled={r.locked} onClick={() => !r.locked && go("co-claim")}>
                  {r.locked ? "Toate sloturile ocupate" : "Vezi & rezervă"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Alert tone="info" icon="i" title="Vezi cereri Platinum cu acces instant?">
        Upgrade-ul la Platinum elimină delay-ul de 30 minute pentru cererile noi.
        <span style={{ marginLeft: 12 }}><a style={{ color: "var(--ink)", textDecoration: "underline" }} onClick={(e) => {e.preventDefault();go("co-subscription");}} href="#">Vezi planuri →</a></span>
      </Alert>
    </div>);

};

// 9. CLAIM REQUEST PAGE
const ClaimRequestPage = ({ go }) => {
  const [assignee, setAssignee] = React.useState("self");
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("co-marketplace")}>
          <Icon name="arrowLeft" size={12} /> Înapoi la marketplace
        </button>
      </div>

      <div className="page-header">
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>R-2841</span>
            <StatusBadge status="MEDIUM" />
            <Badge tone="amber">2/3 sloturi ocupate</Badge>
          </div>
          <h1 className="page-title" style={{ fontSize: 38 }}>Bucătărie + dressing apartament Borhanci</h1>
          <p className="page-sub">Cluj-Napoca · publicat acum 12 min · termen instalare aprilie 2026</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        <div className="stack">
          <div className="card">
            <div className="kicker">Detalii cerere</div>
            <div className="stack" style={{ marginTop: 14, gap: 8, fontSize: 14 }}>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Camere</span><span>Bucătărie (M) · Dressing (L)</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Material</span><span>MDF vopsit</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Sisteme</span><span>Soft-close, push, blat cuarț</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Buget client</span><span>20–35.000 RON</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Termen</span><span>Aprilie 2026</span></div>
            </div>
          </div>

          <div className="card">
            <div className="kicker">Descriere proiect</div>
            <p style={{ marginTop: 10, color: "var(--ink-2)", lineHeight: 1.6, fontSize: 14 }}>
              "Apartament 3 camere, vreau bucătărie în formă de L, fronturi MDF alb mat, blat cuarț.
              Dressing colțar în dormitorul mare cu uși glisante. Există colț tâmplărie să-l ocolim."
            </p>
            <div className="grid-4" style={{ marginTop: 14 }}>
              <ImagePlaceholder label="plan.pdf" height={88} />
              <ImagePlaceholder label="foto" height={88} />
              <ImagePlaceholder label="referință 1" height={88} />
              <ImagePlaceholder label="referință 2" height={88} />
            </div>
          </div>

          <div className="card">
            <div className="kicker">Despre client</div>
            <div className="row" style={{ gap: 12, marginTop: 12 }}>
              <Avatar name="Andreea Pop" tone="ink" size={40} />
              <div>
                <div style={{ fontWeight: 500 }}>Andreea P.</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Cont verificat · 1 proiect anterior finalizat ★ 5.0</div>
              </div>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
              Datele de contact (telefon, email) devin vizibile după claim, în chat.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 96, alignSelf: "start" }}>
          <div className="card" style={{ background: "var(--ink)", color: "var(--bg)" }}>
            <div className="kicker" style={{ color: "rgba(244,239,230,0.6)" }}>Cost rezervare</div>
            <div className="row" style={{ alignItems: "baseline", gap: 8, marginTop: 8 }}>
              <div className="metric-big">2</div>
              <div style={{ color: "rgb(155, 145, 127)" }}>credite</div>
            </div>
            <hr className="divider" style={{ borderColor: "rgba(244,239,230,0.15)" }} />
            <div className="stack" style={{ fontSize: 13, gap: 6 }}>
              <div className="row between"><span style={{ color: "rgb(155, 145, 127)" }}>Credite disponibile</span><span className="mono">32</span></div>
              <div className="row between"><span style={{ color: "rgba(0, 0, 0, 0.6)" }}>După claim</span><span className="mono">30</span></div>
            </div>
          </div>

          <div className="card">
            <div className="kicker">Atribuire claim</div>
            <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 12.5 }}>
              După claim, ai 1 oră să atribui claim-ul unui angajat. Dacă nu, se anulează automat și primești înapoi creditele.
            </p>
            <div className="stack" style={{ marginTop: 12 }}>
              {[
              { key: "self", title: "Self-assign (eu, Manager)", sub: "Slot manager", avail: true },
              { key: "ion", title: "Ion Vasile · Trusted", sub: "Liber · ultimul claim acum 6 zile", avail: true },
              { key: "maria", title: "Maria Băieș · Trusted", sub: "Are claim activ (R-2839)", avail: false },
              { key: "later", title: "Decid mai târziu (max 1h)", sub: "Atribui din panou Claims" }].
              map((opt) =>
              <div key={opt.key}
              className={`choice ${assignee === opt.key ? "selected" : ""} ${opt.avail === false ? "" : ""}`}
              style={{ opacity: opt.avail === false ? 0.5 : 1 }}
              onClick={() => opt.avail !== false && setAssignee(opt.key)}>
                  <div className="check" />
                  <div className="body">
                    <div className="title">{opt.title}</div>
                    <div className="sub">{opt.sub}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-walnut btn-lg" onClick={() => go("co-my-claims")} style={{ justifyContent: "center" }}>
            Confirmă · 2 credite <Icon name="arrow" size={14} />
          </button>
          <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            Acțiunea poate fi anulată în primele 30 min cu refund integral.
          </div>
        </div>
      </div>
    </div>);

};

// 10. MY CLAIMS (company)
const MyClaimsPage = ({ go }) => {
  const claims = [
  { id: "C-1024", req: "R-2841", title: "Bucătărie + dressing Borhanci", assigned: "Ion Vasile", status: "NEGOTIATION", ver: 2, max: 3, lastMsg: "Cere ajustare preț (–800 RON)", time: "2h" },
  { id: "C-1023", req: "R-2839", title: "Dressing colțar dormitor", assigned: "Maria Băieș", status: "OFFER_SENT", ver: 1, max: 3, lastMsg: "Așteaptă răspuns client", time: "ieri" },
  { id: "C-1019", req: "R-2756", title: "Bibliotecă living + comodă TV", assigned: "Self (Manager)", status: "ACCEPTED", ver: 2, max: 3, lastMsg: "Client a acceptat V2!", time: "3 zile" },
  { id: "C-1018", req: "R-2755", title: "Birou home-office custom", assigned: null, status: "UNASSIGNED", warn: true, lastMsg: "Auto-cancel în 27 min", time: "33 min" },
  { id: "C-1010", req: "R-2700", title: "Bucătărie casă Apahida", assigned: "Ion Vasile", status: "REJECTED", ver: 3, max: 3, lastMsg: "Clientul a ales alt atelier", time: "1 săpt" }];


  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="kicker">Cereri rezervate de noi</div>
          <h1 className="page-title">Claims active</h1>
          <p className="page-sub">2 active, 1 acceptată, 1 fără atribuire (atenție).</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => go("co-marketplace")}>
            <Icon name="plus" size={14} /> Rezervă altă cerere
          </button>
        </div>
      </div>

      <Alert tone="amber" icon="!" title="C-1018 nu are angajat atribuit · auto-anulare în 27 min">
        Atribuie un angajat pentru a păstra claim-ul. Dacă nu, primești 2 credite înapoi automat.
        <button className="btn btn-sm" style={{ marginLeft: 12 }}>Atribuie acum</button>
      </Alert>

      <div className="card" style={{ marginTop: 20, padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 22 }}>Claim</th>
              <th>Cerere</th>
              <th>Atribuit</th>
              <th>Status</th>
              <th>Versiuni</th>
              <th>Ultimul update</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) =>
            <tr key={c.id} className="clickable" onClick={() => go("co-send-offer")}>
                <td style={{ paddingLeft: 22 }}>
                  <div className="mono" style={{ fontSize: 12 }}>{c.id}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{c.req}</div>
                </td>
                <td><div style={{ fontWeight: 500 }}>{c.title}</div></td>
                <td>
                  {c.assigned ?
                <div className="row" style={{ gap: 8 }}>
                      <Avatar name={c.assigned} size={24} tone={c.assigned === "Self (Manager)" ? "ink" : "walnut"} />
                      <span style={{ fontSize: 13 }}>{c.assigned}</span>
                    </div> :

                <span style={{ color: "var(--crimson)", fontWeight: 500, fontSize: 13 }}>Neatribuit</span>
                }
                </td>
                <td><StatusBadge status={c.status === "UNASSIGNED" ? "EXPIRED" : c.status} />
                  {c.warn && <Badge tone="crimson">!</Badge>}
                </td>
                <td>{c.ver ? <span className="mono">V{c.ver}/{c.max}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td>
                  <div style={{ fontSize: 13 }}>{c.lastMsg}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{c.time}</div>
                </td>
                <td><Icon name="arrow" size={14} /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid-3" style={{ marginTop: 20 }}>
        <div className="card-flat">
          <div className="kicker">Sloturi angajați</div>
          <div className="row" style={{ marginTop: 12, gap: 16 }}>
            <div className="metric-big">3</div>
            <div>
              <SlotTrack filled={3} total={5} />
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>din 5 sloturi în uz</div>
            </div>
          </div>
        </div>
        <div className="card-flat">
          <div className="kicker">Rate acceptare</div>
          <div className="metric-big" style={{ marginTop: 8 }}>68%</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>oferte acceptate ultimele 30 zile</div>
        </div>
        <div className="card-flat">
          <div className="kicker">Credite consumate luna asta</div>
          <div className="metric-big" style={{ marginTop: 8 }}>14</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>din 50 incluse · 36 rămase</div>
        </div>
      </div>
    </div>);

};

// 11. SEND OFFER PAGE
const SendOfferPage = ({ go }) => {
  const [vers, setVers] = React.useState(2); // we're editing v2
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("co-my-claims")}>
          <Icon name="arrowLeft" size={12} /> Înapoi la Claims
        </button>
      </div>

      <div className="page-header">
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>C-1024 · R-2841</span>
            <Badge tone="walnut">V{vers} din 3</Badge>
            <StatusBadge status="NEGOTIATION" />
          </div>
          <h1 className="page-title" style={{ fontSize: 36 }}>Trimite ofertă · Versiunea 2</h1>
          <p className="page-sub">Bucătărie + dressing apartament Borhanci · client Andreea P.</p>
        </div>
        <div className="page-actions">
          <button className="btn">Salvează draft</button>
          <button className="btn btn-walnut" onClick={() => go("co-my-claims")}>Trimite V2 la client</button>
        </div>
      </div>

      <Alert tone="info" icon="i" title="Versiune 2/3">
        Ai mai trimis 1 variantă anterior (V1 — 33.200 RON, termen 15 apr). După V3, ai opțiunea de invitație la sediu pentru consultanță fizică.
      </Alert>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24, marginTop: 24 }}>
        <div className="stack">
          <div className="card">
            <div className="kicker">Detalii ofertă</div>
            <div className="stack" style={{ marginTop: 14 }}>
              <div className="grid-2">
                <div className="field">
                  <label>Preț total (RON, TVA inclus)</label>
                  <input className="input" defaultValue="32.400" />
                </div>
                <div className="field">
                  <label>Termen instalare</label>
                  <input className="input" defaultValue="15 aprilie 2026" />
                </div>
                <div className="field">
                  <label>Valabilitate ofertă</label>
                  <input className="input" defaultValue="14 zile" />
                </div>
                <div className="field">
                  <label>Garanție</label>
                  <input className="input" defaultValue="5 ani" />
                </div>
              </div>

              <div className="field">
                <label>Descriere lucrare</label>
                <textarea className="textarea" defaultValue="Bucătărie în L (4.2m + 2.8m) cu fronturi MDF vopsit alb mat, blat cuarț Caesarstone 4030, sisteme Blum push-to-open & soft-close. Dressing colțar cu uși glisante (3 panouri), iluminat LED integrat sub poliță. Montaj inclus." style={{ minHeight: 140 }} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="kicker">Defalcare cost</div>
            <table className="table" style={{ marginTop: 10 }}>
              <thead>
                <tr><th style={{ paddingLeft: 0 }}>Componentă</th><th>Material</th><th style={{ textAlign: "right" }}>Preț</th><th></th></tr>
              </thead>
              <tbody>
                {[
                ["Corp bucătărie inferior", "PAL melaminat + fronturi MDF", "12.800"],
                ["Corp bucătărie superior", "PAL melaminat + fronturi MDF", "6.400"],
                ["Blat cuarț Caesarstone", "Cuarț 30mm", "4.200"],
                ["Dressing colțar dormitor", "PAL + uși glisante MDF", "7.600"],
                ["Sisteme & accesorii Blum", "Soft-close, push-to-open, LED", "1.400"]].
                map((row, i) =>
                <tr key={i}>
                    <td style={{ paddingLeft: 0 }}>{row[0]}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{row[1]}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{row[2]} RON</td>
                    <td><button className="btn btn-ghost btn-sm">✎</button></td>
                  </tr>
                )}
                <tr><td colSpan={4}><button className="btn btn-ghost btn-sm">+ Adaugă linie</button></td></tr>
              </tbody>
            </table>
            <hr className="divider" />
            <div className="row between" style={{ alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Monedă ofertă</span>
              <div className="seg" style={{ display: "inline-flex" }}>
                <button className="active">RON</button>
                <button>EUR</button>
              </div>
            </div>
            <div className="row between" style={{ fontWeight: 500 }}>
              <span>Total cu TVA 21%</span>
              <div style={{ textAlign: "right" }}>
                <span className="mono" style={{ fontSize: 16 }}>32.400 RON</span>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>≈ €6.519 · curs înghețat 4,97</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="kicker">Atașamente</div>
            <div className="grid-4" style={{ marginTop: 14 }}>
              <ImagePlaceholder label="render 3D 1" height={100} />
              <ImagePlaceholder label="render 3D 2" height={100} />
              <ImagePlaceholder label="plan dimensiuni" height={100} />
              <div className="img-ph" style={{ height: 100, cursor: "pointer", border: "1px dashed var(--border-2)" }}>
                <Icon name="plus" size={20} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: "sticky", top: 96, alignSelf: "start", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="kicker">Permisiuni câmpuri</div>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>Atribuit lui Ion Vasile (Trusted).</p>
            <div className="stack" style={{ marginTop: 12, gap: 8, fontSize: 13 }}>
              <div className="row between"><span>Preț</span><Badge tone="amber">Requires Manager</Badge></div>
              <div className="row between"><span>Termen livrare</span><Badge tone="sage">Editabil</Badge></div>
              <div className="row between"><span>Garanție</span><Badge tone="sage">Editabil</Badge></div>
              <div className="row between"><span>Descriere</span><Badge tone="sage">Editabil</Badge></div>
              <div className="row between"><span>Defalcare cost</span><Badge tone="amber">Requires Manager</Badge></div>
            </div>
          </div>

          <div className="card">
            <div className="kicker">Diferențe față de V1</div>
            <div className="stack" style={{ marginTop: 12, gap: 8, fontSize: 13 }}>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Preț</span><span style={{ color: "var(--sage)" }}>32.400 (–800)</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Termen</span><span>15 apr (același)</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Garanție</span><span>5 ani (același)</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Iluminat LED</span><span style={{ color: "var(--sage)" }}>Adăugat</span></div>
            </div>
          </div>

          <div className="card">
            <div className="kicker">Limita versiuni</div>
            <div className="row" style={{ gap: 6, marginTop: 12 }}>
              {[1, 2, 3].map((v) =>
              <div key={v} style={{
                flex: 1, padding: 10, textAlign: "center",
                background: v < vers ? "var(--ink)" : v === vers ? "var(--walnut)" : "var(--surface-2)",
                color: v <= vers ? "#FBF6EC" : "var(--muted)",
                borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 12
              }}>V{v}</div>
              )}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
              După V3 vei avea opțiuni: a 4-a voluntară, invitație consultanță sediu, sau încheiere negociere online.
            </p>
          </div>
        </div>
      </div>
    </div>);

};

// 12. TEAM MANAGEMENT
const TeamPage = ({ go }) => {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="kicker">Echipă · Lemnăria Crișan</div>
          <h1 className="page-title">Angajați și roluri</h1>
          <p className="page-sub">Owner, Manager, Trusted, Managed — fiecare cu permisiuni distincte la oferte și claims.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="settings" size={14} /> Configurare permisiuni</button>
          <button className="btn btn-primary"><Icon name="plus" size={14} /> Invită angajat</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card-flat">
          <div className="kicker">Total angajați</div>
          <div className="metric-big" style={{ marginTop: 8 }}>5</div>
        </div>
        <div className="card-flat">
          <div className="kicker">Claims active</div>
          <div className="metric-big" style={{ marginTop: 8 }}>3</div>
        </div>
        <div className="card-flat">
          <div className="kicker">Sloturi libere</div>
          <div className="metric-big" style={{ marginTop: 8 }}>2</div>
        </div>
        <div className="card-flat">
          <div className="kicker">Penalizări active</div>
          <div className="metric-big" style={{ marginTop: 8 }}>1</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 22 }}>Angajat</th>
              <th>Rol</th>
              <th>Status</th>
              <th>Claim activ</th>
              <th>Ultima ofertă</th>
              <th>Penalizări</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[
            { name: "Andrei Crișan", role: "OWNER", email: "andrei@crisan.ro", status: "active", claim: "—", offer: "—", pen: 0, info: "Acces total" },
            { name: "Diana Crișan", role: "MANAGER", email: "diana@crisan.ro", status: "active", claim: "R-2756", offer: "ieri · acceptată", pen: 0, info: "Poate face self-assign" },
            { name: "Ion Vasile", role: "TRUSTED", email: "ion@crisan.ro", status: "active", claim: "R-2841", offer: "azi 09:32", pen: 0, info: "Editare termen + garanție" },
            { name: "Maria Băieș", role: "TRUSTED", email: "maria@crisan.ro", status: "active", claim: "R-2839", offer: "ieri", pen: 0, info: "Editare termen + garanție" },
            { name: "Costin Pîrvu", role: "MANAGED", email: "costin@crisan.ro", status: "warn", claim: "—", offer: "acum 1 lună", pen: 2, info: "Read-only oferte · 2 puncte (–48 zile)" }].
            map((u, i) =>
            <tr key={i}>
                <td style={{ paddingLeft: 22 }}>
                  <div className="row" style={{ gap: 12 }}>
                    <Avatar name={u.name} tone={u.role === "OWNER" ? "ink" : u.role === "MANAGER" ? "sage" : "walnut"} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge tone={u.role === "OWNER" ? "ink" : u.role === "MANAGER" ? "sage" : u.role === "TRUSTED" ? "walnut" : "muted"}>{u.role}</Badge>
                  <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{u.info}</div>
                </td>
                <td>
                  {u.status === "active" ? <span className="row" style={{ gap: 6 }}><span className="status-dot sage" /> Activ</span> : <span className="row" style={{ gap: 6 }}><span className="status-dot amber" /> Atenție</span>}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{u.claim}</td>
                <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{u.offer}</td>
                <td>{u.pen > 0 ? <Badge tone="crimson">{u.pen} pct</Badge> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td><button className="btn btn-ghost btn-sm">⋯</button></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <h3 className="serif" style={{ fontSize: 22, margin: "0 0 14px" }}>Permisiuni pe câmpuri ofertă</h3>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Configurat la nivel firmă · MVP simplu</p>
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Câmp</th><th>Owner</th><th>Manager</th><th>Trusted</th><th>Managed</th></tr></thead>
            <tbody>
              {[
              ["Preț", true, true, false, false],
              ["Termen livrare", true, true, true, false],
              ["Garanție", true, true, true, false],
              ["Descriere", true, true, true, false],
              ["Aprobare trimitere", true, true, false, false]].
              map((row, i) =>
              <tr key={i}>
                  <td>{row[0]}</td>
                  {row.slice(1).map((v, j) =>
                <td key={j}>{v ? <span style={{ color: "var(--sage)" }}>✓</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                )}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="serif" style={{ fontSize: 22, margin: "0 0 14px" }}>Regula 1 claim / angajat</h3>
          <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
            Fiecare angajat poate avea <strong>maxim un claim activ fără ofertă trimisă</strong>.
            Managerul poate face claim doar dacă numărul de angajați liberi e suficient.
          </p>
          <hr className="divider" />
          <div className="stack" style={{ fontSize: 13, gap: 8 }}>
            <div className="row between"><span>Diana (Manager)</span><Badge tone="sage">Liberă</Badge></div>
            <div className="row between"><span>Ion (Trusted)</span><Badge tone="walnut">Claim activ · R-2841</Badge></div>
            <div className="row between"><span>Maria (Trusted)</span><Badge tone="walnut">Claim activ · R-2839</Badge></div>
            <div className="row between"><span>Costin (Managed)</span><Badge tone="sage">Liberă</Badge></div>
          </div>
        </div>
      </div>
    </div>);

};

// 13. SUBSCRIPTION & CREDITS
const SubscriptionPage = ({ go }) => {
  const [plan, setPlan] = React.useState("GOLD");
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="kicker">Plan & credite</div>
          <h1 className="page-title">Abonament și credite</h1>
          <p className="page-sub">Plătești doar când rezervi cereri. Planurile decid viteza de acces.</p>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 32 }}>
        {[
        { tier: "SILVER", price: "149", credits: 15, delay: "+60 min", features: ["15 credite/lună incluse", "Acces cereri după 60 min", "Suport email", "Profil public standard"] },
        { tier: "GOLD", price: "399", credits: 50, delay: "+30 min", features: ["50 credite/lună incluse", "Acces cereri după 30 min", "Suport prioritar", "Profil cu portofoliu extins", "Insight-uri marketplace"], current: true },
        { tier: "PLATINUM", price: "899", credits: 120, delay: "instant", features: ["120 credite/lună incluse", "Acces instant la cereri", "Suport telefonic dedicat", "Profil featured în marketplace", "Insight-uri avansate", "Logo verificat", "Manager cont dedicat"] }].
        map((p) =>
        <div key={p.tier} className={`plan-card ${plan === p.tier ? "selected" : ""}`}>
            {p.current && <Badge tone="ink" style={{ position: "absolute", top: -10, right: 16 }}>Planul tău</Badge>}
            <TierBadge tier={p.tier} />
            <div>
              <div className="price">{p.price}<span style={{ fontSize: 18, color: "var(--muted)" }}> RON</span></div>
              <div className="price-sub">pe lună · fără TVA</div>
            </div>
            <div className="kicker">Delay acces cereri: {p.delay}</div>
            <ul>
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <button className={p.current ? "btn" : "btn btn-walnut"} onClick={() => setPlan(p.tier)} disabled={p.current}>
              {p.current ? "Planul activ" : `Upgrade la ${p.tier}`}
            </button>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        <div className="card">
          <div className="row between">
            <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Credite</h3>
            <Badge tone="walnut">Gold · 50/lună</Badge>
          </div>
          <div className="row" style={{ gap: 24, marginTop: 16, alignItems: "flex-end" }}>
            <div>
              <div className="kicker">Disponibile</div>
              <div className="metric-big" style={{ marginTop: 4 }}>32</div>
            </div>
            <div style={{ paddingBottom: 6 }}>
              <SlotTrack filled={32} total={35} />
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>din 35 incluse · resetare 1 apr</div>
            </div>
          </div>
          <hr className="divider" />
          <div className="kicker" style={{ marginBottom: 10 }}>Top-up adițional</div>
          <div className="stack" style={{ gap: 8 }}>
            {[
            { credits: 10, price: 100, pp: 10 },
            { credits: 50, price: 400, pp: 8, save: "20%" },
            { credits: 100, price: 700, pp: 7, save: "30%" }].
            map((p) =>
            <div key={p.credits} className="card-flat" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{p.credits} credite</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{p.pp} RON / credit{p.save && ` · economisești ${p.save}`}</div>
                </div>
                <div className="serif" style={{ fontSize: 22 }}>{p.price} RON</div>
                <button className="btn" onClick={() => go("co-billing")}>Cumpără</button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="serif" style={{ fontSize: 22, margin: "0 0 14px" }}>Istoric tranzacții</h3>
          <table className="table">
            <thead><tr><th style={{ paddingLeft: 0 }}>Data</th><th>Operațiune</th><th>Credite</th><th>Sumă</th></tr></thead>
            <tbody>
              {[
              { d: "12 mar", o: "Claim R-2841", c: "–2", s: "—" },
              { d: "10 mar", o: "Top-up 50 credite", c: "+50", s: "400 RON" },
              { d: "01 mar", o: "Abonament lunar Gold", c: "+50", s: "399 RON" },
              { d: "28 feb", o: "Refund · claim cancelled", c: "+2", s: "—" },
              { d: "21 feb", o: "Claim R-2756", c: "–2", s: "—" }].
              map((t, i) =>
              <tr key={i}>
                  <td style={{ paddingLeft: 0, color: "var(--muted)", fontSize: 12.5 }}>{t.d}</td>
                  <td>{t.o}</td>
                  <td className="mono" style={{ color: t.c.startsWith("+") ? "var(--sage)" : "var(--ink)" }}>{t.c}</td>
                  <td className="mono">{t.s}</td>
                </tr>
              )}
            </tbody>
          </table>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => go("co-billing")}>Vezi toate · descarcă facturi PDF</button>
        </div>
      </div>
    </div>);

};

// 14. PENALTIES
const PenaltiesPage = ({ go }) =>
<div className="page">
    <div className="page-header">
      <div>
        <div className="kicker">Reputație & penalizări</div>
        <h1 className="page-title">Penalizări și conduită</h1>
        <p className="page-sub">Punctele de penalizare expiră individual după 180 de zile. Prag firmă: 12 puncte → suspendare 6 luni. Prag angajat: 9 puncte → blocare 3 luni.</p>
      </div>
    </div>

    <div className="grid-3" style={{ marginBottom: 24 }}>
      <div className="card">
        <div className="kicker">Puncte active</div>
        <div className="row" style={{ marginTop: 8, alignItems: "baseline", gap: 8 }}>
          <div className="metric-big" style={{ color: "var(--amber)" }}>2</div>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>din 12 prag suspendare firmă</span>
        </div>
        <div style={{ marginTop: 12, height: 8, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: "17%", height: "100%", background: "var(--amber)" }} />
        </div>
      </div>
      <div className="card">
        <div className="kicker">Rating clienți</div>
        <div className="row" style={{ marginTop: 8, alignItems: "baseline", gap: 8 }}>
          <div className="metric-big">4.7</div>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>din 5 · 84 review-uri</span>
        </div>
      </div>
      <div className="card">
        <div className="kicker">Rate oferte trimise în SLA</div>
        <div className="row" style={{ marginTop: 8, alignItems: "baseline", gap: 8 }}>
          <div className="metric-big">94%</div>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>ultimele 90 zile</span>
        </div>
      </div>
    </div>

    <div className="card" style={{ padding: 0, marginBottom: 24 }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
        <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Istoric evenimente</h3>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ paddingLeft: 22 }}>Data</th>
            <th>Eveniment</th>
            <th>Angajat</th>
            <th>Puncte</th>
            <th>Expiră</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {[
        { d: "18 ian", e: "Ofertă nelivrată în SLA (R-2700)", emp: "Costin Pîrvu", p: 3, exp: "în 113 zile", status: "ACTIV" },
        { d: "05 dec", e: "Claim retras voluntar fără motiv valid (R-2640)", emp: "Maria Băieș", p: 2, exp: "în 49 zile", status: "ACTIV" },
        { d: "12 oct", e: "Ofertă nelivrată în SLA (R-2580)", emp: "Ion Vasile", p: 3, exp: "expirat", status: "EXPIRAT" },
        { d: "03 sep", e: "Ofertă acceptată — rating client 5★", emp: "Diana Crișan", p: 0, exp: "—", status: "FĂRĂ PENALIZARE" }].
        map((row, i) =>
        <tr key={i}>
              <td style={{ paddingLeft: 22, color: "var(--muted)", fontSize: 12.5 }}>{row.d}</td>
              <td>{row.e}</td>
              <td style={{ fontSize: 13 }}>{row.emp}</td>
              <td>{row.p > 0 ? <Badge tone="crimson">{row.p} pct</Badge> : <Badge tone="sage">+</Badge>}</td>
              <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{row.exp}</td>
              <td><Badge tone={row.status === "ACTIV" ? "amber" : row.status === "EXPIRAT" ? "muted" : "sage"}>{row.status}</Badge></td>
            </tr>
        )}
        </tbody>
      </table>
    </div>

    <div className="grid-2">
      <div className="card">
        <h3 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>Praguri de penalizare</h3>
        <div className="stack" style={{ fontSize: 13.5, gap: 8 }}>
          <div className="row between"><span>1–5 puncte</span><Badge tone="sage">Status normal</Badge></div>
          <div className="row between"><span>6–8 puncte</span><Badge tone="amber">Avertizare</Badge></div>
          <div className="row between"><span>9 puncte angajat</span><Badge tone="crimson">Blocare 3 luni</Badge></div>
          <div className="row between"><span>12 puncte firmă</span><Badge tone="crimson">Suspendare 6 luni</Badge></div>
        </div>
      </div>
      <div className="card">
        <h3 className="serif" style={{ fontSize: 20, margin: "0 0 12px" }}>Cum eviți penalizările</h3>
        <ul style={{ paddingLeft: 18, color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.65, margin: 0 }}>
          <li>Atribuie claim-ul în 1h după rezervare</li>
          <li>Trimite prima ofertă în 48h după claim</li>
          <li>Răspunde la mesaje client în 24h în program</li>
          <li>Dacă te răzgândești, anulează cu motiv valid</li>
        </ul>
      </div>
    </div>
  </div>;


// 15. CLAIM WITHDRAWAL FLOW
const ClaimWithdrawalPage = ({ go }) => {
  const [reason, setReason] = React.useState("CLIENT_UNRESPONSIVE_48H");
  const reasons = {
    CLIENT_UNRESPONSIVE_48H: { label: "Clientul nu răspunde (48h+)", auto: true, desc: "Validat automat: ultimul mesaj client a fost acum >48h." },
    REQUEST_MODIFIED_POST_CLAIM: { label: "Cererea a fost editată după claim", auto: true, desc: "Validat automat: cererea modificată după ce am rezervat-o." },
    CLIENT_CONTACT_INVALID: { label: "Date contact client invalide", auto: true, desc: "Necesită dovadă: log bounce email, sau screenshot apel telefonic." },
    CLIENT_REQUESTED_CANCELLATION: { label: "Clientul a cerut anularea", auto: true, desc: "Confirmare necesară de la client cu quick-reply." },
    VOLUNTARY_NO_REASON: { label: "Mă retrag fără motiv", auto: false, desc: "Sub 30 min de la claim: refund integral, fără penalizare. Peste 30 min: refund credite + 2 puncte penalizare angajat." },
    CUSTOM: { label: "Alt motiv (review manual admin)", auto: false, desc: "SLA admin 48h. Slotul rămâne ocupat până la decizie." }
  };
  const cur = reasons[reason];
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("co-my-claims")}>
          <Icon name="arrowLeft" size={12} /> Înapoi
        </button>
      </div>

      <div className="page-header">
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>C-1023 · R-2839</span>
            <StatusBadge status="NEGOTIATION" />
          </div>
          <h1 className="page-title" style={{ fontSize: 36 }}>Anulează claim-ul</h1>
          <p className="page-sub">Dressing colțar dormitor matrimonial · client Diana M.</p>
        </div>
      </div>

      <div className="card">
        <div className="kicker">Motiv anulare</div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          Pentru motivele predefinite cu validare automată, creditele se returnează instant.
          Pentru motive custom, adminul aprobă manual în 48h.
        </p>

        <div className="stack" style={{ marginTop: 16 }}>
          {Object.entries(reasons).map(([key, r]) =>
          <div key={key} className={`choice ${reason === key ? "selected" : ""}`} onClick={() => setReason(key)}>
              <div className="check" />
              <div className="body">
                <div className="title-row">
                  <div>
                    <div className="title">{r.label}</div>
                    <div className="sub">{r.desc}</div>
                  </div>
                  {r.auto ? <Badge tone="sage">Auto-aprobare</Badge> : <Badge tone="amber">Review admin</Badge>}
                </div>
              </div>
            </div>
          )}
        </div>

        <hr className="divider" />

        <div className="field">
          <label>Detalii adiționale {!cur.auto && "(obligatoriu)"}</label>
          <textarea className="textarea" placeholder="Descrie pe scurt..." />
        </div>

        {reason === "CLIENT_CONTACT_INVALID" &&
        <div className="field" style={{ marginTop: 12 }}>
            <label>Dovadă (screenshot)</label>
            <div className="img-ph" style={{ height: 120, cursor: "pointer", border: "1px dashed var(--border-2)" }}>
              <Icon name="plus" size={20} /> &nbsp; Atașează screenshot
            </div>
          </div>
        }

        <hr className="divider" />

        <Alert tone={cur.auto ? "sage" : "amber"} icon={cur.auto ? "✓" : "?"}>
          {cur.auto ?
          <><strong>Refund instant:</strong> primești înapoi 2 credite, slotul se eliberează pentru un alt atelier.</> :
          <><strong>Slot rămâne ocupat 48h:</strong> adminul revizuiește și decide. Dacă aprobat → refund + eliberare. Dacă respins → slot rămâne, fără refund.</>
          }
        </Alert>

        <div className="row between" style={{ marginTop: 18 }}>
          <button className="btn" onClick={() => go("co-my-claims")}>Renunță</button>
          <button className="btn btn-danger" onClick={() => go("co-my-claims")}>Trimite cerere anulare</button>
        </div>
      </div>
    </div>);

};

Object.assign(window, {
  CompanyMarketplace, ClaimRequestPage, MyClaimsPage, SendOfferPage,
  TeamPage, SubscriptionPage, PenaltiesPage, ClaimWithdrawalPage
});