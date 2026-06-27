// Client-side pages for Plan marketplace

// 1. LANDING PAGE
const LandingPage = ({ go }) => {
  const t = useT();
  return (
  <div className="page" style={{ maxWidth: 1200 }}>
    {/* HERO */}
    <div className="hero-grid" style={{ padding: "30px 0 56px" }}>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow rise" style={{ animationDelay: "40ms" }}>{t("Marketplace mobilier la comandă · România", "Custom furniture marketplace · Romania")}</div>
        <h1 className="serif" style={{ fontSize: "clamp(44px, 4.4vw, 66px)", lineHeight: 1.12, letterSpacing: "-0.03em", margin: "18px 0 0" }}>
          {t("Mobila ta, de la ", "Your furniture, from the ")}<em style={{ color: "var(--accent)" }}>{t("atelierul", "right")}</em>{t(" potrivit.", " workshop.")}
        </h1>
        <p style={{ fontSize: 17, color: "var(--muted)", maxWidth: 460, marginTop: 34, lineHeight: 1.6 }}>
          {t("Descrii proiectul o singură dată. Trei ateliere verificate concurează cu oferte personalizate. Compari preț, termen și execuție — alegi cu încredere.",
             "Describe your project once. Three vetted workshops compete with tailored offers. Compare price, lead time and craft — choose with confidence.")}
        </p>
        <div className="rise" style={{ display: "flex", gap: 10, marginTop: 28, animationDelay: "320ms" }}>
          <button className="btn btn-primary btn-lg" onClick={() => go("c-new-request")}>
            {t("Depune o cerere", "Post a request")} <Icon name="arrow" size={14} />
          </button>
          <button className="btn btn-lg" onClick={() => go("co-onboarding")}>{t("Sunt atelier", "I'm a workshop")}</button>
        </div>
        <div className="rise" style={{ display: "flex", gap: 36, marginTop: 46, flexWrap: "wrap", animationDelay: "420ms" }}>
          {[
            ["340+", t("ateliere verificate", "vetted workshops")],
            ["2.8k", t("proiecte finalizate", "projects completed")],
            ["94%", t("rata de satisfacție", "satisfaction rate")]
          ].map(([n, l]) => (
            <div key={l}>
              <div className="metric-big">{n}</div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rise hero-media" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, gridAutoRows: "minmax(132px, auto)", animationDelay: "240ms" }}>
        <ImagePlaceholder label={t("bucătărie · furnir stejar", "kitchen · oak veneer")} height={250} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ImagePlaceholder label="dressing" height={119} />
          <ImagePlaceholder label={t("birou custom", "custom desk")} height={119} />
        </div>
        <ImagePlaceholder label={t("bibliotecă", "library")} height={146} />
        <ImagePlaceholder label="dormitor" height={146} />
      </div>
    </div>

    {/* TRUST STRIP */}
    <div style={{ display: "flex", alignItems: "center", gap: 28, padding: "20px 24px", borderRadius: "var(--radius-lg)", background: "var(--surface-2)", border: "1px solid var(--border)", flexWrap: "wrap", marginBottom: 64 }}>
      <span className="kicker" style={{ whiteSpace: "nowrap" }}>{t("Ateliere de încredere", "Trusted workshops")}</span>
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", flex: 1, opacity: 0.75 }}>
        {["Lemnăria Crișan", "Studio Mobilier Vest", "Atelier Stejar", "B DesignWood", "CasaMea"].map(n => (
          <span key={n} className="serif" style={{ fontSize: 18, whiteSpace: "nowrap" }}>{n}</span>
        ))}
      </div>
    </div>

    {/* HOW IT WORKS */}
    <div style={{ marginBottom: 64 }}>
      <div className="eyebrow">{t("Cum funcționează", "How it works")}</div>
      <h2 className="serif" style={{ fontSize: 40, margin: "14px 0 32px", letterSpacing: "-0.025em" }}>{t("Trei pași, fără stres.", "Three steps, zero stress.")}</h2>
      <div className="grid-3">
        {[
          { n: "01", ti: t("Descrii proiectul", "Describe the project"), d: t("Un formular ghidat pe camere și piese. Sistemul calculează automat anvergura — small, medium sau large.", "A guided form by room and piece. The system auto-scores the scope — small, medium or large.") },
          { n: "02", ti: t("Atelierele te aleg", "Workshops claim it"), d: t("Doar 3 ateliere își pot rezerva proiectul. Primești atenție reală, nu spam de oferte.", "Only 3 workshops can claim your project. You get real attention, not a flood of bids.") },
          { n: "03", ti: t("Negociezi în chat", "Negotiate in chat"), d: t("Maxim 3 variante per atelier. Compari preț, termen și execuție și accepți cea mai bună.", "Up to 3 versions per workshop. Compare price, lead time and craft, then accept the best.") }
        ].map(s => (
          <div key={s.n} className="card" style={{ padding: 26 }}>
            <div className="serif" style={{ fontSize: 40, color: "var(--accent)", letterSpacing: "-0.02em" }}>{s.n}</div>
            <div className="serif" style={{ fontSize: 23, margin: "12px 0 8px" }}>{s.ti}</div>
            <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6 }}>{s.d}</div>
          </div>
        ))}
      </div>
    </div>

    {/* SIZING MODEL — ties to corrected §4.5 economics */}
    <div style={{ marginBottom: 64 }}>
      <div className="eyebrow">{t("Anvergura proiectului", "Project scope")}</div>
      <div className="row between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12, margin: "14px 0 28px" }}>
        <h2 className="serif" style={{ fontSize: 40, margin: 0, letterSpacing: "-0.025em", maxWidth: "20ch" }}>{t("Cât de mare e proiectul, atâta atenție primește.", "The bigger the project, the more attention it earns.")}</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
          {t("Configuratorul calculează un scor din camere, piese, material și accesorii. Scorul decide anvergura — și câte credite cheltuie un atelier ca să-ți rezerve cererea.",
             "The configurator scores rooms, pieces, material and accessories. The score sets the scope — and how many credits a workshop spends to claim you.")}
        </p>
      </div>
      <div className="grid-3">
        {[
          { sz: "SMALL", pts: t("sub 60 pct", "under 60 pts"), cr: 1, ex: t("o bibliotecă, un birou custom", "a bookcase, a custom desk") },
          { sz: "MEDIUM", pts: "60–120 pct", cr: 2, ex: t("o bucătărie sau un dressing complet", "a kitchen or a full dressing") },
          { sz: "LARGE", pts: t("peste 120 pct", "over 120 pts"), cr: 4, ex: t("reamenajare completă de apartament", "a full apartment refit") }
        ].map(s => (
          <div key={s.sz} className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="row between" style={{ alignItems: "center" }}>
              <StatusBadge status={s.sz} />
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{s.pts}</span>
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
              <div className="serif" style={{ fontSize: 38, color: "var(--accent)", lineHeight: 1 }}>{s.cr}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t(s.cr === 1 ? "credit / claim" : "credite / claim", s.cr === 1 ? "credit / claim" : "credits / claim")}</div>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>{s.ex}</div>
          </div>
        ))}
      </div>
    </div>

    {/* VALUE PROPS */}
    <div className="grid-3" style={{ marginBottom: 64 }}>
      {[
        { ic: "shield", ti: t("Ateliere verificate", "Vetted workshops"), d: t("CUI validat, portofoliu și risk-flags evaluate de admin înainte de acces.", "Validated CUI, portfolio and risk-flags reviewed by admin before access.") },
        { ic: "layers", ti: t("Compari corect", "Compare fairly"), d: t("Oferte structurate, una lângă alta: preț, termen, garanție, ce e inclus.", "Structured offers side by side: price, lead time, warranty, what's included.") },
        { ic: "star", ti: t("Reputație reală", "Real reputation"), d: t("Review după livrare confirmată. Sub 3 stele → dispută mediată de platformă.", "Reviews after confirmed delivery. Under 3 stars → platform-mediated dispute.") }
      ].map(v => (
        <div key={v.ti} style={{ padding: "4px 4px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", marginBottom: 14 }}><Icon name={v.ic} size={20} /></div>
          <div className="serif" style={{ fontSize: 21, marginBottom: 6 }}>{v.ti}</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6 }}>{v.d}</div>
        </div>
      ))}
    </div>

    {/* ATELIER CTA BAND */}
    <div style={{ padding: 44, background: "linear-gradient(150deg, var(--ink), var(--ink-2))", color: "var(--bg)", borderRadius: "var(--radius-xl)", position: "relative", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 300px at 90% -20%, color-mix(in oklab, var(--accent) 40%, transparent), transparent 60%)", opacity: 0.5 }} />
      <div style={{ position: "relative" }}>
        <div className="eyebrow" style={{ color: "rgba(244,239,230,0.7)" }}>{t("Pentru ateliere", "For workshops")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 40, alignItems: "center", marginTop: 16 }}>
          <h2 className="serif" style={{ fontSize: 46, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.02 }}>
            {t("Cereri pre-calificate.", "Pre-qualified requests.")}<br/>{t("Fără licitație la rece.", "No cold bidding.")}
          </h2>
          <div>
            <p style={{ color: "rgba(244,239,230,0.72)", marginBottom: 20, lineHeight: 1.6 }}>
              {t("Plătești credite doar când rezervi un proiect care îți place. Maxim 3 ateliere per cerere — fără șansă de 1%, doar întâlniri reale.",
                 "You spend credits only when you claim a project you like. Max 3 workshops per request — no 1% odds, just real conversations.")}
            </p>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-lg" onClick={() => go("co-onboarding")} style={{ background: "var(--bg)", color: "var(--ink)", borderColor: "var(--bg)" }}>
                {t("Înscrie atelierul", "Register workshop")} <Icon name="arrow" size={14} />
              </button>
              <button className="btn btn-lg" onClick={() => go("co-marketplace")} style={{ background: "transparent", color: "var(--bg)", borderColor: "rgba(244,239,230,0.3)" }}>
                {t("Vezi marketplace", "View marketplace")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

// 2. NEW REQUEST FORM (with sizing score)
const NewRequestPage = ({ go }) => {
  const t = useT();
  const [step, setStep] = React.useState(0);
  const steps = [t("Camere","Rooms"), t("Material","Material"), t("Sisteme","Systems"), t("Detalii","Details"), t("Sumar","Summary")];

  const [rooms, setRooms] = React.useState({
    bucatarie: { active: true, size: "M" },
    dressing: { active: true, size: "L" },
    living: { active: false, size: "M" },
    dormitor: { active: false, size: "M" },
    baie: { active: false, size: "S" },
  });
  const [material, setMaterial] = React.useState("pal-furnir");
  const [systems, setSystems] = React.useState(["soft-close", "push"]);

  const roomPoints = (r) => r.active ? { S: 15, M: 25, L: 40 }[r.size] : 0;
  const materialPoints = { "pal": 5, "pal-furnir": 15, "mdf-vopsit": 25, "lemn-masiv": 45 }[material];
  const systemPoints = systems.length * 8;
  const score = Object.values(rooms).reduce((s, r) => s + roomPoints(r), 0) + materialPoints + systemPoints;
  const size = score < 60 ? "SMALL" : score < 120 ? "MEDIUM" : "LARGE";

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("c-dashboard")}>
          <Icon name="arrowLeft" size={12} /> {t("Cererile mele","My requests")}
        </button>
      </div>
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div>
          <div className="eyebrow">{t("Cerere nouă", "New request")}</div>
          <h1 className="page-title" style={{ marginTop: 12 }}>{t("Spune-ne despre proiect", "Tell us about the project")}</h1>
          <p className="page-sub">{t("Cu cât descrii mai precis, cu atât atelierele îți vor trimite oferte mai bune. Sistemul calculează automat anvergura.", "The more precise you are, the better the offers. The system scores the scope automatically.")}</p>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}><Stepper steps={steps} current={step} /></div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 28 }}>
          {step === 0 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>Ce camere include proiectul?</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Bifează camerele și alege dimensiunea aproximativă.</p>
              <div style={{ height: 8 }} />
              {Object.entries({
                bucatarie: "Bucătărie",
                dressing: "Dressing / dulap haine",
                living: "Living (bibliotecă, comodă TV)",
                dormitor: "Dormitor (pat, noptiere)",
                baie: "Baie (mobilier pentru chiuvetă)"
              }).map(([key, label]) => (
                <div key={key} className={`choice ${rooms[key].active ? "selected" : ""}`} onClick={() => setRooms({ ...rooms, [key]: { ...rooms[key], active: !rooms[key].active } })}>
                  <div className="check" />
                  <div className="body">
                    <div className="title-row">
                      <div>
                        <div className="title">{label}</div>
                        <div className="sub">Punctaj: {roomPoints(rooms[key])} puncte</div>
                      </div>
                      {rooms[key].active && (
                        <div className="row" onClick={(e) => e.stopPropagation()}>
                          {["S", "M", "L"].map(sz => (
                            <button key={sz} className={`btn btn-sm ${rooms[key].size === sz ? "btn-primary" : ""}`} onClick={() => setRooms({ ...rooms, [key]: { ...rooms[key], size: sz } })}>
                              {sz === "S" ? "< 8m²" : sz === "M" ? "8-15m²" : "> 15m²"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>Ce material preferi?</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Poți schimba ulterior în negocieri cu atelierul.</p>
              <div style={{ height: 8 }} />
              {[
                { key: "pal", title: "PAL melaminat", sub: "Economic, durabil pentru uz casnic", points: 5 },
                { key: "pal-furnir", title: "PAL furnir natur", sub: "Aspect lemnos, cost mediu", points: 15 },
                { key: "mdf-vopsit", title: "MDF vopsit", sub: "Frontale uniforme, premium look", points: 25 },
                { key: "lemn-masiv", title: "Lemn masiv", sub: "Stejar, fag, frasin — top tier", points: 45 }
              ].map(opt => (
                <div key={opt.key} className={`choice ${material === opt.key ? "selected" : ""}`} onClick={() => setMaterial(opt.key)}>
                  <div className="check" />
                  <div className="body">
                    <div className="title-row">
                      <div>
                        <div className="title">{opt.title}</div>
                        <div className="sub">{opt.sub}</div>
                      </div>
                      <div className="points">+{opt.points} pct</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>Sisteme și accesorii</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Bifează tot ce te interesează — fiecare adaugă complexitate la execuție.</p>
              <div style={{ height: 8 }} />
              {[
                { key: "soft-close", title: "Amortizare soft-close", sub: "Balamale și sertare cu închidere lină" },
                { key: "push", title: "Push-to-open", sub: "Fronturi fără mâner, cu presiune" },
                { key: "glisante", title: "Uși glisante", sub: "Mecanism rulant pe șine" },
                { key: "iluminat", title: "Iluminat LED integrat", sub: "Sub poliță, în sertare sau perimetral" },
                { key: "blat-cuart", title: "Blat cuarț / piatră", sub: "Pentru bucătărie sau baie" },
                { key: "sertare-int", title: "Organizatoare interne", sub: "Tăvi, divizoare, suporturi" }
              ].map(opt => (
                <div key={opt.key} className={`choice ${systems.includes(opt.key) ? "selected" : ""}`} onClick={() => setSystems(systems.includes(opt.key) ? systems.filter(s => s !== opt.key) : [...systems, opt.key])}>
                  <div className="check" />
                  <div className="body">
                    <div className="title-row">
                      <div>
                        <div className="title">{opt.title}</div>
                        <div className="sub">{opt.sub}</div>
                      </div>
                      <div className="points">+8 pct</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>Detalii proiect</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Adresă, deadline, buget orientativ și descriere liberă.</p>
              <div style={{ height: 8 }} />
              <div className="grid-2">
                <div className="field">
                  <label>Județ / oraș</label>
                  <select className="select" defaultValue="cluj">
                    <option value="cluj">Cluj-Napoca</option>
                    <option value="buc">București</option>
                    <option value="ts">Timișoara</option>
                    <option value="ia">Iași</option>
                  </select>
                </div>
                <div className="field">
                  <label>Buget orientativ</label>
                  <select className="select" defaultValue="20-35">
                    <option>sub 10.000 RON</option>
                    <option>10–20.000 RON</option>
                    <option value="20-35">20–35.000 RON</option>
                    <option>35–60.000 RON</option>
                    <option>peste 60.000 RON</option>
                  </select>
                </div>
                <div className="field">
                  <label>Termen dorit instalare</label>
                  <input className="input" defaultValue="Aprilie 2026" />
                </div>
                <div className="field">
                  <label>Telefon contact</label>
                  <input className="input" defaultValue="07XX XXX XXX" />
                </div>
              </div>
              <div className="field">
                <label>Descriere liberă</label>
                <textarea className="textarea" placeholder="Ex: Apartament nou la mansardă, vreau combinație furnir stejar cu fronturi MDF alb mat. Important: blat cuarț în L, plus dressing colțar pentru dormitor."
                  defaultValue="Apartament 3 camere, vreau bucătărie în formă de L, fronturi MDF alb mat, blat cuarț. Dressing colțar în dormitorul mare cu uși glisante. Există colț tâmplărie să-l ocolim." />
              </div>
              <div className="field">
                <label>Fotografii / planuri (opțional)</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <ImagePlaceholder label="plan.pdf" height={100} />
                  <ImagePlaceholder label="foto bucătărie" height={100} />
                  <ImagePlaceholder label="referință 1" height={100} />
                  <div className="img-ph" style={{ height: 100, cursor: "pointer", border: "1px dashed var(--border-2)" }}>
                    <Icon name="plus" size={20} />
                  </div>
                </div>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>Verifică și publică</h3>
              <Alert tone="info" icon="i">
                <strong>Cererea ta va fi vizibilă pentru ateliere în maxim 5 minute.</strong> Vei primi notificări pentru fiecare claim, ofertă și răspuns în chat.
              </Alert>
              <div className="card-flat">
                <div className="kicker">Sumar configurare</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5 }}>
                  <div className="row between"><span style={{ color: "var(--muted)" }}>Camere</span><span>{Object.entries(rooms).filter(([k,r]) => r.active).map(([k,r]) => `${k} (${r.size})`).join(", ")}</span></div>
                  <div className="row between"><span style={{ color: "var(--muted)" }}>Material</span><span>{material}</span></div>
                  <div className="row between"><span style={{ color: "var(--muted)" }}>Sisteme</span><span>{systems.length} selectate</span></div>
                  <div className="row between"><span style={{ color: "var(--muted)" }}>Locație</span><span>Cluj-Napoca</span></div>
                  <div className="row between"><span style={{ color: "var(--muted)" }}>Buget</span><span>20–35.000 RON</span></div>
                </div>
              </div>
              <Alert tone="amber" icon="!">
                Verifică telefonul de contact. Dacă atelierul nu te poate suna, contul poate fi flagged pentru date invalide.
              </Alert>
            </div>
          )}

          <hr className="divider" />
          <div className="row between">
            <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <Icon name="arrowLeft" size={12} /> {t("Înapoi","Back")}
            </button>
            {step < steps.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
                {t("Continuă","Continue")} <Icon name="arrow" size={12} />
              </button>
            ) : (
              <button className="btn btn-walnut btn-lg" onClick={() => go("c-request-detail")}>
                {t("Publică cererea","Publish request")} <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 96, alignSelf: "start" }}>
          <ScoreGauge score={score} size={size} />
          <div className="card">
            <div className="kicker">Cum se calculează</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, marginBottom: 12 }}>
              Punctele se adună pe baza alegerilor tale. Pragul determină categoria — small, medium, large.
            </div>
            <div className="stack" style={{ gap: 6, fontSize: 13 }}>
              <div className="row between"><span>Camere ({Object.values(rooms).filter(r => r.active).length})</span><span className="mono">{Object.values(rooms).reduce((s, r) => s + roomPoints(r), 0)} pct</span></div>
              <div className="row between"><span>Material</span><span className="mono">{materialPoints} pct</span></div>
              <div className="row between"><span>Sisteme ({systems.length})</span><span className="mono">{systemPoints} pct</span></div>
              <hr className="divider" style={{ margin: "8px 0" }} />
              <div className="row between" style={{ fontWeight: 500 }}><span>Total</span><span className="mono">{score} pct</span></div>
            </div>
          </div>
          <div className="card-flat" style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
            Cu cât e mai mare scorul, cu atât costă mai multe credite pentru atelier să-ți rezerve proiectul.
            Astfel, primești atenție reală pentru proiecte serioase.
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. CLIENT DASHBOARD
const ClientDashboard = ({ go }) => {
  const requests = [
    { id: "R-2841", title: "Bucătărie + dressing apartament Borhanci", size: "MEDIUM", status: "NEGOTIATION", claims: 3, offers: 5, age: "acum 4 zile", city: "Cluj-Napoca" },
    { id: "R-2756", title: "Bibliotecă living + comodă TV", size: "SMALL", status: "OFFER_SENT", claims: 2, offers: 2, age: "acum 2 săpt", city: "Cluj-Napoca" },
    { id: "R-2580", title: "Reamenajare completă apartament Mărăști", size: "LARGE", status: "ACCEPTED", claims: 3, offers: 7, age: "acum 6 săpt", city: "Cluj-Napoca" },
    { id: "R-2390", title: "Birou custom acasă", size: "SMALL", status: "EXPIRED", claims: 1, offers: 0, age: "acum 4 luni", city: "Cluj-Napoca" }
  ];
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="kicker">Cererile mele</div>
          <h1 className="page-title">Bună, Andreea.</h1>
          <p className="page-sub">Ai 1 cerere activă în negociere și 1 ofertă nouă de revizuit.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => go("c-new-request")}>
            <Icon name="plus" size={14} /> Cerere nouă
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { l: "Cereri active", v: "2", s: "din care 1 în negociere" },
          { l: "Oferte primite", v: "5", s: "2 noi de citit" },
          { l: "Proiecte finalizate", v: "1", s: "în execuție acum" },
          { l: "Economisit prin compare", v: "3.2k", s: "RON față de oferta cea mai mare" }
        ].map(m => (
          <div key={m.l} className="card card-tight">
            <div className="kicker">{m.l}</div>
            <div className="metric-row" style={{ margin: "8px 0 4px" }}>
              <div className="metric-big">{m.v}</div>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>{m.s}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Toate cererile</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm">Toate</button>
            <button className="btn btn-sm btn-ghost">Active</button>
            <button className="btn btn-sm btn-ghost">Arhivate</button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 22 }}>ID</th>
              <th>Cerere</th>
              <th>Mărime</th>
              <th>Status</th>
              <th>Ateliere</th>
              <th>Oferte</th>
              <th>Publicat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} className="clickable" onClick={() => go(r.status === "ACCEPTED" ? "c-delivery" : "c-request-detail")}>
                <td style={{ paddingLeft: 22 }} className="mono" >{r.id}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{r.city}</div>
                </td>
                <td><StatusBadge status={r.size} /></td>
                <td><StatusBadge status={r.status} /></td>
                <td><span className="mono">{r.claims}/3</span></td>
                <td><span className="mono">{r.offers}</span></td>
                <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{r.age}</td>
                <td><Icon name="arrow" size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 4. REQUEST DETAIL
const RequestDetailPage = ({ go }) => {
  const [tab, setTab] = React.useState("Oferte");
  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("c-dashboard")}>
          <Icon name="arrowLeft" size={12} /> Toate cererile
        </button>
      </div>

      <div className="page-header">
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>R-2841</span>
            <StatusBadge status="NEGOTIATION" />
            <StatusBadge status="MEDIUM" />
          </div>
          <h1 className="page-title" style={{ fontSize: 38 }}>Bucătărie + dressing apartament Borhanci</h1>
          <p className="page-sub">Publicat acum 4 zile · Cluj-Napoca · Termen dorit instalare: aprilie 2026</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => go("c-new-request")}><Icon name="settings" size={14} /> Editează</button>
          <button className="btn btn-ghost">Anulează cererea</button>
        </div>
      </div>

      <Alert tone="amber" icon="!" title="2 oferte noi de citit">
        Atelierul Lemnaria Crișan a trimis varianta 2 (preț revizuit) și atelierul Studio Mobilier o ofertă nouă.
      </Alert>

      <div style={{ marginTop: 24 }}>
        <Tabs tabs={["Oferte", "Ateliere care au dat claim", "Detalii cerere", "Activitate"]} current={tab} onChange={setTab} />

        {tab === "Oferte" && (
          <div className="stack">
            <div className="row between">
              <div className="kicker">3 ateliere · 5 oferte totale</div>
              <button className="btn btn-sm" onClick={() => go("c-compare")}>
                <Icon name="layers" size={12} /> Compară oferte
              </button>
            </div>
            {[
              { co: "Lemnăria Crișan", tier: "PLATINUM", ver: 2, max: 3, price: "32.400 RON", eur: "≈ €6.519", term: "Predare 15 apr", warranty: "5 ani", status: "VERSIUNE NOUĂ", new: true },
              { co: "Studio Mobilier Vest", tier: "GOLD", ver: 1, max: 3, price: "€6.016", eur: "≈ 29.900 RON · ofertă EUR", term: "Predare 22 apr", warranty: "3 ani", status: "OFERTĂ NOUĂ", new: true },
              { co: "Atelier Stejar", tier: "GOLD", ver: 2, max: 3, price: "31.200 RON", eur: "≈ €6.278", term: "Predare 8 apr", warranty: "5 ani", status: "AȘTEAPTĂ RĂSPUNS" }
            ].map(o => (
              <div key={o.co} className="card" style={{ borderColor: o.new ? "var(--ink)" : "var(--border)" }}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div className="row" style={{ gap: 14 }}>
                    <ImagePlaceholder label="logo" height={48} width={48} />
                    <div>
                      <div className="row" style={{ gap: 10 }}>
                        <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>{o.co}</h3>
                        <TierBadge tier={o.tier} />
                      </div>
                      <div className="row" style={{ gap: 12, marginTop: 6, color: "var(--muted)", fontSize: 12.5 }}>
                        <span>★ 4.8 · 142 proiecte</span>
                        <span>·</span>
                        <span>Cluj-Napoca · 8 km</span>
                        <span>·</span>
                        <span className="mono">VARIANTA {o.ver}/{o.max}</span>
                      </div>
                    </div>
                  </div>
                  {o.new && <Badge tone="ink" dot>{o.status}</Badge>}
                </div>

                <div className="grid-4" style={{ marginTop: 18 }}>
                  <div><div className="label">Preț total</div><div className="serif" style={{ fontSize: 24, marginTop: 4 }}>{o.price}</div><div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{o.eur}</div></div>
                  <div><div className="label">Termen</div><div style={{ fontSize: 15, marginTop: 6 }}>{o.term}</div></div>
                  <div><div className="label">Garanție</div><div style={{ fontSize: 15, marginTop: 6 }}>{o.warranty}</div></div>
                  <div><div className="label">Valabilitate ofertă</div><div style={{ fontSize: 15, marginTop: 6 }}>până 12 mar</div></div>
                </div>

                <hr className="divider" />
                <div className="row between">
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-sm" onClick={() => go("c-chat")}><Icon name="chat" size={12} /> Chat ({o.ver === 2 ? 14 : 6})</button>
                    <button className="btn btn-sm" onClick={() => go("c-compare")}>Vezi detalii ofertă</button>
                  </div>
                  <button className="btn btn-walnut btn-sm" onClick={() => go("c-delivery")}>Acceptă această ofertă</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Detalii cerere" && (
          <div className="grid-2">
            <div className="card">
              <div className="kicker">Configurare</div>
              <div className="stack" style={{ marginTop: 14 }}>
                <div className="row between"><span>Bucătărie</span><span>Medium (8–15m²)</span></div>
                <div className="row between"><span>Dressing</span><span>Large (peste 15m²)</span></div>
                <div className="row between"><span>Material principal</span><span>MDF vopsit</span></div>
                <div className="row between"><span>Sisteme</span><span>Soft-close, push, blat cuarț</span></div>
                <div className="row between"><span>Locație</span><span>Cluj-Napoca, Borhanci</span></div>
                <div className="row between"><span>Buget</span><span>20–35.000 RON</span></div>
                <div className="row between"><span>Termen</span><span>Aprilie 2026</span></div>
              </div>
            </div>
            <div className="card">
              <div className="kicker">Scoring sistem</div>
              <div style={{ marginTop: 14 }}>
                <ScoreGauge score={87} size="MEDIUM" />
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>
                Acest scor înghețat la momentul fiecărui claim. Atelierele care au dat claim
                văd valoarea originală, indiferent de modificările ulterioare.
              </p>
            </div>
          </div>
        )}

        {tab === "Activitate" && (
          <div className="card">
            <div className="timeline">
              {[
                { t: "acum 2 ore", title: "Lemnăria Crișan a trimis varianta 2", desc: "Preț revizuit: 32.400 RON (–800 RON)" },
                { t: "acum 6 ore", title: "Studio Mobilier Vest a trimis varianta 1", desc: "Ofertă inițială: 29.900 RON" },
                { t: "ieri", title: "Atelier Stejar a trimis varianta 2", desc: "Termen ajustat după discuție: 8 apr" },
                { t: "acum 2 zile", title: "Atelier Stejar a dat claim", desc: "3 din 3 sloturi ocupate" },
                { t: "acum 3 zile", title: "Studio Mobilier Vest a dat claim", desc: "" },
                { t: "acum 3 zile", title: "Lemnăria Crișan a dat claim", desc: "Plan Platinum — acces instant" },
                { t: "acum 4 zile", title: "Cerere publicată în marketplace", desc: "Score: 87 · Size: MEDIUM" }
              ].map((e, i) => (
                <div key={i} className="timeline-item">
                  <div className="time">{e.t}</div>
                  <div className="dot-col"><div className="dot" /><div className="line" /></div>
                  <div className="content">
                    <h4>{e.title}</h4>
                    {e.desc && <p>{e.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Ateliere care au dat claim" && (
          <div className="grid-3">
            {[
              { co: "Lemnăria Crișan", tier: "PLATINUM", date: "acum 3 zile, 14:22", oferte: "v2 trimisă" },
              { co: "Studio Mobilier Vest", tier: "GOLD", date: "acum 3 zile, 16:58", oferte: "v1 trimisă" },
              { co: "Atelier Stejar", tier: "GOLD", date: "acum 2 zile, 09:14", oferte: "v2 trimisă" }
            ].map(c => (
              <div key={c.co} className="card">
                <div className="row" style={{ gap: 12 }}>
                  <ImagePlaceholder label="" height={40} width={40} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.co}</div>
                    <TierBadge tier={c.tier} />
                  </div>
                </div>
                <hr className="divider" />
                <div className="stack" style={{ fontSize: 13, gap: 6 }}>
                  <div className="row between"><span style={{ color: "var(--muted)" }}>Claim</span><span>{c.date}</span></div>
                  <div className="row between"><span style={{ color: "var(--muted)" }}>Status</span><span>{c.oferte}</span></div>
                </div>
                <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => go("c-chat")}>Vezi profil atelier</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 5. CHAT WITH COMPANY
const ClientChatPage = ({ go }) => {
  const [msg, setMsg] = React.useState("");
  return (
    <div className="page" style={{ maxWidth: "none", padding: "24px 32px" }}>
      <div style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("c-request-detail")}>
          <Icon name="arrowLeft" size={12} /> Înapoi la cerere
        </button>
      </div>

      <div className="chat-wrap">
        <div className="chat-list">
          <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
            <div className="kicker" style={{ marginBottom: 4 }}>R-2841 · 3 ateliere</div>
            <div className="serif" style={{ fontSize: 18 }}>Bucătărie + dressing</div>
          </div>
          {[
            { name: "Lemnăria Crișan", tier: "PLATINUM", last: "Am revizuit prețul pentru blatul cuarț...", time: "2h", unread: 2, active: true },
            { name: "Studio Mobilier Vest", tier: "GOLD", last: "Vă mulțumesc pentru detalii! Pot să vă...", time: "6h", unread: 1 },
            { name: "Atelier Stejar", tier: "GOLD", last: "Putem să discutăm și telefonic dacă...", time: "1z", unread: 0 }
          ].map(c => (
            <div key={c.name} className={`chat-list-item ${c.active ? "active" : ""}`}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>{c.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 11 }} className="mono">{c.time}</div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.last}
              </div>
              <div className="row between" style={{ marginTop: 8 }}>
                <TierBadge tier={c.tier} />
                {c.unread > 0 && <span className="badge ink">{c.unread} noi</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="chat-thread">
          <div className="chat-thread-header">
            <Avatar name="Lemnăria Crișan" tone="walnut" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Lemnăria Crișan</div>
              <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--muted)" }}>
                <span className="status-dot sage" /> Online · răspunde în ~25 min
              </div>
            </div>
            <Badge tone="walnut">V2 din 3</Badge>
            <button className="btn btn-sm" onClick={() => go("c-compare")}>Vezi ofertă</button>
          </div>

          <div className="chat-messages">
            <div className="msg system"><div className="bubble">Conversația a început · 3 zile · Atelierul a dat claim pe cerere</div></div>

            <div className="msg">
              <Avatar name="Lemnăria Crișan" tone="walnut" />
              <div>
                <div className="bubble">
                  Bună ziua, Andreea! Mulțumim pentru cerere. Am studiat detaliile și planul atașat — putem face proiectul cu MDF vopsit alb mat, blat cuarț Caesarstone, sisteme Blum push-to-open. Vă pregătesc oferta v1.
                </div>
                <div className="meta">acum 3 zile · 15:08</div>
              </div>
            </div>

            <div className="msg system"><div className="bubble">📄 Ofertă V1 trimisă — 33.200 RON · termen 15 apr</div></div>

            <div className="msg me">
              <Avatar name="Andreea Pop" tone="ink" />
              <div>
                <div className="bubble">
                  Mulțumesc! Prețul e ok, dar termenul ar fi de preferat mai devreme — putem ajunge la 1 aprilie? Și aș vrea iluminat LED sub poliță, poți să cuprinzi?
                </div>
                <div className="meta">ieri · 09:32</div>
              </div>
            </div>

            <div className="msg">
              <Avatar name="Lemnăria Crișan" tone="walnut" />
              <div>
                <div className="bubble">
                  1 aprilie e prea ambițios — colegii sunt deja încărcați pe martie. Pot oferi 10 aprilie ferm, asta înseamnă comandă material săptămâna viitoare. Iluminat LED sub poliță îl adaug — +800 RON pentru profil aluminiu și driver.
                </div>
                <div className="meta">ieri · 14:11</div>
              </div>
            </div>

            <div className="msg">
              <Avatar name="Lemnăria Crișan" tone="walnut" />
              <div>
                <div className="bubble">
                  Pregătesc v2 cu termenul ajustat și iluminatul inclus. Vă trimit în câteva ore.
                </div>
                <div className="meta">ieri · 14:13</div>
              </div>
            </div>

            <div className="msg system"><div className="bubble">📄 Ofertă V2 trimisă — 32.400 RON · termen 15 apr · iluminat LED inclus</div></div>

            <div className="msg">
              <Avatar name="Lemnăria Crișan" tone="walnut" />
              <div>
                <div className="bubble">
                  Am revizuit prețul pentru blatul cuarț — am găsit o nuanță similară la un cost mai bun, deci pot scădea total cu 800 RON. Vă rog confirmați să comand materialul.
                </div>
                <div className="meta">acum 2h</div>
              </div>
            </div>
          </div>

          <div className="chat-compose">
            <textarea
              className="textarea"
              style={{ minHeight: 48, flex: 1 }}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Scrie un mesaj..."
            />
            <button className="btn btn-primary">Trimite</button>
          </div>
        </div>

        <div className="chat-side">
          <div style={{ padding: 18, borderBottom: "1px solid var(--border)" }}>
            <div className="kicker">Despre atelier</div>
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <ImagePlaceholder label="" height={48} width={48} />
              <div>
                <div style={{ fontWeight: 500 }}>Lemnăria Crișan</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>★ 4.8 · 142 proiecte</div>
              </div>
            </div>
            <div className="stack" style={{ marginTop: 14, fontSize: 13, gap: 6 }}>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Locație</span><span>Cluj-Napoca</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Plan</span><TierBadge tier="PLATINUM" /></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>Răspuns mediu</span><span>25 min</span></div>
            </div>
          </div>

          <div style={{ padding: 18, borderBottom: "1px solid var(--border)" }}>
            <div className="kicker">Versiuni ofertă</div>
            <div className="stack" style={{ marginTop: 10, gap: 8 }}>
              {[
                { v: "V1", price: "33.200 RON", date: "3 zile" },
                { v: "V2", price: "32.400 RON", date: "ieri", current: true }
              ].map(v => (
                <div key={v.v} className="card-flat" style={{ padding: 10, border: v.current ? "1px solid var(--ink)" : "1px solid var(--border)" }}>
                  <div className="row between">
                    <div className="mono" style={{ fontSize: 12 }}>{v.v}</div>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{v.date}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{v.price}</div>
                </div>
              ))}
              <div className="card-flat" style={{ padding: 10, border: "1px dashed var(--border-2)", color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
                V3 disponibil · maxim 3 versiuni
              </div>
            </div>
          </div>

          <div style={{ padding: 18 }}>
            <button className="btn btn-walnut" style={{ width: "100%" }} onClick={() => go("c-delivery")}>
              Acceptă varianta V2
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8, color: "var(--muted)" }} onClick={() => go("c-consult")}>
              Cere consultanță la sediu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 6. COMPARE OFFERS
const CompareOffersPage = ({ go }) => {
  // D-v6-12: oferte afișate în RON ȘI EUR. Cursul e înghețat pe ofertă la trimitere (frozen_fx_rate).
  const RON_PER_EUR = 4.97;
  const dualPrice = (o) => {
    const ron = o.cur === "EUR" ? Math.round(o.price * RON_PER_EUR) : o.price;
    const eur = o.cur === "EUR" ? o.price : Math.round(o.price / RON_PER_EUR);
    const native = o.cur === "EUR" ? `€${eur.toLocaleString("ro-RO")}` : `${ron.toLocaleString("ro-RO")} RON`;
    const conv = o.cur === "EUR" ? `${ron.toLocaleString("ro-RO")} RON` : `€${eur.toLocaleString("ro-RO")}`;
    return { ron, native, conv };
  };
  const offers = [
    { co: "Lemnăria Crișan", tier: "PLATINUM", v: "V2", price: 32400, cur: "RON", term: "15 apr", warranty: "5 ani", material: "MDF vopsit + furnir", sisteme: "Soft-close, push, LED", blat: "Cuarț Caesarstone", garantie: "5 ani", livrare: "Inclusă", montaj: "Inclus", review: 4.8 },
    { co: "Studio Mobilier Vest", tier: "GOLD", v: "V1", price: 6016, cur: "EUR", term: "22 apr", warranty: "3 ani", material: "MDF vopsit", sisteme: "Soft-close, push", blat: "Cuarț local", garantie: "3 ani", livrare: "Inclusă", montaj: "300 RON extra", review: 4.6 },
    { co: "Atelier Stejar", tier: "GOLD", v: "V2", price: 31200, cur: "RON", term: "8 apr", warranty: "5 ani", material: "MDF vopsit", sisteme: "Soft-close, LED", blat: "Cuarț Caesarstone", garantie: "5 ani", livrare: "Inclusă", montaj: "Inclus", review: 4.7 }
  ];
  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("c-request-detail")}>
          <Icon name="arrowLeft" size={12} /> Înapoi
        </button>
      </div>
      <div className="page-header">
        <div>
          <div className="kicker">R-2841 · Comparare oferte</div>
          <h1 className="page-title" style={{ fontSize: 38 }}>3 oferte una lângă alta</h1>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px repeat(3, 1fr)", gap: 0, background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div></div>
        {offers.map(o => (
          <div key={o.co} style={{ padding: 24, borderLeft: "1px solid var(--border)" }}>
            <ImagePlaceholder label="logo" height={48} width={48} />
            <h3 className="serif" style={{ fontSize: 22, margin: "10px 0 4px" }}>{o.co}</h3>
            <div className="row" style={{ gap: 8 }}><TierBadge tier={o.tier} /><Badge tone="walnut">{o.v}</Badge></div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>★ {o.review}</div>
          </div>
        ))}

        {[
          ["Preț total", o => {
            const dp = dualPrice(o);
            return (
              <div>
                <div className="serif" style={{ fontSize: 28, color: o.best ? "var(--sage)" : "var(--ink)", lineHeight: 1 }}>{dp.native}</div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>≈ {dp.conv}{o.cur === "EUR" ? " · ofertă EUR" : ""}</div>
              </div>
            );
          }, true],
          ["Termen instalare", o => o.term],
          ["Material principal", o => o.material],
          ["Sisteme incluse", o => o.sisteme],
          ["Blat", o => o.blat],
          ["Garanție", o => o.garantie],
          ["Livrare", o => o.livrare],
          ["Montaj", o => o.montaj],
          ["Rating atelier", o => <>★ {o.review}</>]
        ].map((row, i) => (
          <React.Fragment key={i}>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", alignSelf: "center" }}>{row[0]}</div>
            {offers.map((o, j) => {
              const isMin = row[0] === "Preț total" && o.price === Math.min(...offers.map(x => x.price));
              return (
                <div key={j} style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)", fontSize: 14 }}>
                  {row[1]({ ...o, best: row[0] === "Preț total" && dualPrice(o).ron === Math.min(...offers.map(x => dualPrice(x).ron)) })}
                </div>
              );
            })}
          </React.Fragment>
        ))}

        <div style={{ padding: "20px", borderTop: "1px solid var(--border)" }}></div>
        {offers.map((o, i) => (
          <div key={i} style={{ padding: "20px", borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
            <button className="btn btn-walnut" style={{ width: "100%" }} onClick={() => go("c-delivery")}>Acceptă {o.v}</button>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 6 }} onClick={() => go("c-chat")}>Mesaj în chat</button>
          </div>
        ))}
      </div>

      <Alert tone="info" icon="i" title="Pont:" >
        Cea mai mică ofertă nu e neapărat cea mai bună. Verifică gratuit termenul, garanția și ce e inclus la montaj.
      </Alert>
    </div>
  );
};

// 7. CONSULTATION INVITE
const ConsultationInvitePage = ({ go }) => (
  <div className="page" style={{ maxWidth: 720 }}>
    <div style={{ marginBottom: 18 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => go("c-chat")}>
        <Icon name="arrowLeft" size={12} /> Înapoi la chat
      </button>
    </div>

    <div className="page-header">
      <div>
        <div className="kicker">Invitație la sediu</div>
        <h1 className="page-title" style={{ fontSize: 38 }}>Lemnăria Crișan te invită pentru consultanță fizică</h1>
        <p className="page-sub">Ați ajuns la limita de 3 variante online. Atelierul recomandă o întâlnire la atelier pentru măsurători exacte și ajustări detaliate.</p>
      </div>
    </div>

    <div className="card">
      <div className="row" style={{ gap: 16, marginBottom: 18 }}>
        <ImagePlaceholder label="" height={64} width={64} />
        <div>
          <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Atelier Lemnăria Crișan</h3>
          <div className="row" style={{ gap: 10, marginTop: 4, color: "var(--muted)", fontSize: 13 }}>
            <TierBadge tier="PLATINUM" /> <span>★ 4.8 · 142 proiecte</span>
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div className="grid-2">
        <div>
          <div className="kicker">Locație atelier</div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 500 }}>Strada Sobarilor 14</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Cluj-Napoca, jud. Cluj · 8 km de tine</div>
          </div>
          <ImagePlaceholder label="hartă locație" height={120} />
        </div>
        <div>
          <div className="kicker">Data propusă</div>
          <div className="stack" style={{ marginTop: 10 }}>
            {["Joi 14 mar · 11:00", "Vineri 15 mar · 16:00", "Sâmbătă 16 mar · 10:30"].map((d, i) => (
              <div key={i} className={`choice ${i === 0 ? "selected" : ""}`}>
                <div className="check" />
                <div className="body"><div className="title">{d}</div><div className="sub">Durată estimată 45–60 min</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div className="kicker">Ce vei face acolo</div>
      <ul style={{ marginTop: 10, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.7, paddingLeft: 18 }}>
        <li>Atingi materialul: probe MDF vopsit, eșantioane blat cuarț, ferestre fronturi.</li>
        <li>Discuți face-to-face cu meșterul care va executa proiectul tău.</li>
        <li>Faceți măsurători adiționale, dacă e cazul (chiar și la apartament).</li>
        <li>Semnezi contract preliminar dacă te decizi pe loc.</li>
      </ul>

      <Alert tone="info" icon="i" title="Important:" >
        Consultanța este gratuită și fără obligația de a accepta oferta. Poți totuși accepta oricare din cele 3 variante deja primite, chiar și după consultanță.
      </Alert>

      <hr className="divider" />

      <div className="row between">
        <button className="btn" onClick={() => go("c-chat")}>Refuză invitația</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => go("c-chat")}>Propun altă dată</button>
          <button className="btn btn-walnut" onClick={() => go("c-delivery")}>Confirmă · 14 mar, 11:00</button>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  LandingPage, NewRequestPage, ClientDashboard, RequestDetailPage,
  ClientChatPage, CompareOffersPage, ConsultationInvitePage
});
