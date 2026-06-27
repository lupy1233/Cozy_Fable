// New pages completing the end-to-end flow:
// CompanyOnboardingPage · BillingPage (mock RO invoice) · DeliveryReviewPage

// ============================================================
// A. COMPANY ONBOARDING & VERIFICATION
// ============================================================
const CompanyOnboardingPage = ({ go }) => {
  const t = useT();
  const [step, setStep] = React.useState(0);
  const steps = [t("Date firmă", "Company"), t("Legal & CUI", "Legal & CUI"), t("Locație", "Location"), t("Portofoliu", "Portfolio"), t("Verificare", "Review")];
  const [submitted, setSubmitted] = React.useState(false);

  if (submitted) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--amber-soft)", color: "var(--amber)", display: "grid", placeItems: "center", margin: "0 auto 20px" }}>
            <Icon name="clock" size={30} />
          </div>
          <div className="eyebrow" style={{ justifyContent: "center", marginBottom: 14 }}>{t("Status: în verificare", "Status: under review")}</div>
          <h1 className="serif" style={{ fontSize: 40, margin: "0 0 12px", letterSpacing: "-0.02em" }}>{t("Cererea ta a fost trimisă", "Your application is submitted")}</h1>
          <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.6 }}>
            {t("Un administrator Plan verifică datele firmei și portofoliul. Vei primi acces la marketplace după aprobare — de obicei în 1–2 zile lucrătoare.",
               "A Plan admin is reviewing your company data and portfolio. You'll get marketplace access once approved — usually within 1–2 business days.")}
          </p>
          <div className="card-flat" style={{ textAlign: "left", maxWidth: 440, margin: "0 auto 24px" }}>
            <div className="kicker" style={{ marginBottom: 10 }}>{t("Ce urmează", "What's next")}</div>
            <div className="stack" style={{ gap: 10, fontSize: 13.5 }}>
              {[
                [t("Verificare date fiscale", "Tax data verification"), "PENDING"],
                [t("Evaluare portofoliu & risk flags", "Portfolio & risk-flag assessment"), "PENDING"],
                [t("Trial Gold + 10 credite la aprobare", "Gold trial + 10 credits on approval"), "BONUS"]
              ].map(([l, s]) => (
                <div key={l} className="row between">
                  <span className="row" style={{ gap: 8 }}><span className={`status-dot ${s === "BONUS" ? "sage" : "amber"}`} /> {l}</span>
                  <Badge tone={s === "BONUS" ? "sage" : "amber"}>{s}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 8, justifyContent: "center" }}>
            <button className="btn" onClick={() => setSubmitted(false)}>{t("Înapoi la formular", "Back to form")}</button>
            <button className="btn btn-walnut" onClick={() => go("co-marketplace")}>{t("Vezi marketplace (preview)", "Preview marketplace")} <Icon name="arrow" size={14} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">{t("Devino atelier partener", "Become a partner workshop")}</div>
          <h1 className="page-title" style={{ marginTop: 12 }}>{t("Înscrie-ți atelierul", "Register your workshop")}</h1>
          <p className="page-sub">{t("Completează profilul firmei. După verificarea adminului primești acces la cereri și o lună Gold gratuită.",
            "Complete your company profile. After admin verification you get request access and one free Gold month.")}</p>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}><Stepper steps={steps} current={step} /></div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 28 }}>
          {step === 0 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>{t("Date firmă", "Company details")}</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("Numele și prezentarea pe care le văd clienții.", "The name and pitch clients will see.")}</p>
              <div style={{ height: 6 }} />
              <div className="field"><label>{t("Denumire comercială", "Trade name")}</label><input className="input" defaultValue="Lemnăria Crișan" /></div>
              <div className="grid-2">
                <div className="field"><label>{t("Telefon", "Phone")}</label><input className="input" defaultValue="0264 555 120" /></div>
                <div className="field"><label>Email</label><input className="input" defaultValue="contact@crisan.ro" /></div>
              </div>
              <div className="field"><label>{t("Descriere atelier", "Workshop description")}</label>
                <textarea className="textarea" defaultValue={t("Atelier de mobilier la comandă din 2008. Specializați în bucătării și dressinguri cu furnir natural și MDF vopsit. Echipă de 6 tâmplari.","Custom furniture workshop since 2008. Specialised in kitchens and dressings with natural veneer and painted MDF. A team of 6 carpenters.")} />
              </div>
              <div className="field"><label>{t("Specializări", "Specialities")}</label>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {["Bucătării", "Dressing", "Living", "Birou", "Dormitor", "Baie"].map((s, i) => (
                    <span key={s} className={`badge ${i < 4 ? "walnut" : "outline"}`} style={{ cursor: "pointer" }}>{t(s, ["Kitchens","Dressing","Living","Office","Bedroom","Bath"][i])}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>{t("Date legale", "Legal data")}</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("Folosite pentru verificare și facturare. Nu sunt vizibile public.", "Used for verification and billing. Not shown publicly.")}</p>
              <div style={{ height: 6 }} />
              <div className="grid-2">
                <div className="field"><label>{t("Denumire juridică", "Legal name")}</label><input className="input" defaultValue="Lemnăria Crișan SRL" /></div>
                <div className="field"><label>CUI / CIF</label><input className="input" defaultValue="RO 18 442 905" /></div>
                <div className="field"><label>{t("Nr. Reg. Comerțului", "Trade Register no.")}</label><input className="input" defaultValue="J12/1840/2008" /></div>
                <div className="field"><label>IBAN</label><input className="input" defaultValue="RO49 BTRL 0120 1205 9912 34XX" /></div>
              </div>
              <div className="field"><label>{t("Sediu social", "Registered office")}</label><input className="input" defaultValue="Strada Sobarilor 14, Cluj-Napoca, jud. Cluj" /></div>
              <Alert tone="info" icon="i">{t("Verificăm automat CUI-ul în registrul public. Datele care nu corespund întârzie aprobarea.","We auto-check the CUI against the public register. Mismatched data delays approval.")}</Alert>
            </div>
          )}
          {step === 2 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>{t("Locație & rază de lucru", "Location & work radius")}</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("Decide ce cereri vezi în marketplace, după distanță.", "Decides which requests you see by distance.")}</p>
              <div style={{ height: 6 }} />
              <div className="grid-2">
                <div className="field"><label>{t("Oraș principal", "Main city")}</label><input className="input" defaultValue="Cluj-Napoca" /></div>
                <div className="field"><label>{t("Rază acoperire", "Coverage radius")}</label>
                  <select className="select" defaultValue="50"><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option>{t("Toată țara", "Whole country")}</option></select>
                </div>
              </div>
              <ImagePlaceholder label={t("hartă · rază 50km Cluj", "map · 50km radius Cluj")} height={200} />
            </div>
          )}
          {step === 3 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>{t("Portofoliu", "Portfolio")}</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("Minim 3 proiecte recomandate. Lipsa portofoliului e un risk flag la verificare.", "At least 3 projects recommended. A missing portfolio is a verification risk flag.")}</p>
              <div style={{ height: 6 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <ImagePlaceholder label={t("bucătărie furnir", "veneer kitchen")} height={120} />
                <ImagePlaceholder label={t("dressing glisant", "sliding dressing")} height={120} />
                <ImagePlaceholder label={t("bibliotecă living", "living library")} height={120} />
                <ImagePlaceholder label={t("birou stejar", "oak desk")} height={120} />
                <div className="img-ph" style={{ height: 120, cursor: "pointer", border: "1px dashed var(--border-2)" }}><Icon name="plus" size={20} /></div>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="stack">
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>{t("Verifică și trimite", "Review & submit")}</h3>
              <div className="card-flat">
                <div className="kicker">{t("Sumar profil", "Profile summary")}</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5 }}>
                  {[[t("Denumire","Name"),"Lemnăria Crișan SRL"],["CUI","RO 18442905"],[t("Locație","Location"),"Cluj-Napoca · 50km"],[t("Portofoliu","Portfolio"),"4 " + t("proiecte","projects")],[t("Specializări","Specialities"),"4"]].map(([k,v]) => (
                    <div key={k} className="row between"><span style={{ color: "var(--muted)" }}>{k}</span><span>{v}</span></div>
                  ))}
                </div>
              </div>
              <Alert tone="sage" icon="✓" title={t("Trial Gold pregătit","Gold trial ready")}>
                {t("La aprobare primești automat 1 lună plan Gold + 10 credite pentru primele rezervări.","On approval you automatically get 1 month of Gold + 10 credits for your first claims.")}
              </Alert>
              <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <div className="toggle on" /><span style={{ fontSize: 13.5 }}>{t("Accept termenii și politica de date Plan.","I accept Plan's terms and data policy.")}</span>
              </div>
            </div>
          )}

          <hr className="divider" />
          <div className="row between">
            <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}><Icon name="arrowLeft" size={12} /> {t("Înapoi", "Back")}</button>
            {step < steps.length - 1
              ? <button className="btn btn-primary" onClick={() => setStep(step + 1)}>{t("Continuă", "Continue")} <Icon name="arrow" size={12} /></button>
              : <button className="btn btn-walnut btn-lg" onClick={() => setSubmitted(true)}>{t("Trimite spre verificare", "Submit for review")} <Icon name="arrow" size={14} /></button>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 96, alignSelf: "start" }}>
          <div className="card">
            <div className="kicker">{t("Risk flags (preview)", "Risk flags (preview)")}</div>
            <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 8, marginBottom: 12 }}>
              {t("Adminul vede automat aceste semnale. Le poți reduce înainte de trimitere.", "The admin sees these signals automatically. You can reduce them before submitting.")}
            </p>
            <div className="stack" style={{ gap: 8, fontSize: 13 }}>
              <div className="row between"><span>{t("Rating sub 4.0", "Rating below 4.0")}</span><Badge tone="muted">{t("nou", "new")}</Badge></div>
              <div className="row between"><span>{t("Sub 10 reviews", "Under 10 reviews")}</span><Badge tone="amber">{t("se aplică", "applies")}</Badge></div>
              <div className="row between"><span>{t("Lipsă portofoliu", "Missing portfolio")}</span><Badge tone={step >= 3 ? "sage" : "amber"}>{step >= 3 ? t("rezolvat","cleared") : t("se aplică","applies")}</Badge></div>
            </div>
          </div>
          <div className="card-flat" style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {t("Firmele noi pornesc cu „sub 10 reviews” — normal. Adminul poate aproba manual oricum.", "New workshops start flagged „under 10 reviews” — that's normal. The admin can still approve manually.")}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// B. BILLING / INVOICING (mock RO-compliant invoice)
// ============================================================
const BillingPage = ({ go }) => {
  const t = useT();
  const [active, setActive] = React.useState("PLAN-2026-0312");
  const invoices = [
    { id: "PLAN-2026-0312", date: "12 mar 2026", desc: t("Top-up 50 credite", "50-credit top-up"), base: 330.58, total: 400, status: "PAID" },
    { id: "PLAN-2026-0287", date: "01 mar 2026", desc: t("Abonament Gold · martie", "Gold subscription · March"), base: 329.75, total: 399, status: "PAID" },
    { id: "PLAN-2026-0241", date: "01 feb 2026", desc: t("Abonament Gold · februarie", "Gold subscription · February"), base: 329.75, total: 399, status: "PAID" },
    { id: "PLAN-2026-0198", date: "12 ian 2026", desc: t("Top-up 100 credite", "100-credit top-up"), base: 578.51, total: 700, status: "PAID" }
  ];
  const inv = invoices.find(i => i.id === active);
  const vat = +(inv.total - inv.base).toFixed(2);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t("Facturare", "Billing")}</div>
          <h1 className="page-title" style={{ marginTop: 12 }}>{t("Facturi și documente", "Invoices & documents")}</h1>
          <p className="page-sub">{t("Facturi conforme Codului Fiscal RO pentru abonamente și credite. TVA standard 21%.", "RO Fiscal-Code compliant invoices for subscriptions and credits. Standard VAT 21%.")}</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="file" size={14} /> {t("Date facturare", "Billing details")}</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          [t("Total facturat 2026", "Billed 2026"), "1.898 RON"],
          [t("Următoarea factură", "Next invoice"), "01 apr · 399 RON"],
          [t("Metodă plată", "Payment method"), t("Card ·· 4417", "Card ·· 4417")],
          [t("TVA aplicat", "VAT applied"), "21%"]
        ].map(([l, v]) => (
          <div key={l} className="card-flat"><div className="kicker">{l}</div><div className="serif" style={{ fontSize: 24, marginTop: 8 }}>{v}</div></div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>
        {/* Invoice list */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
            <h3 className="serif" style={{ fontSize: 20, margin: 0 }}>{t("Istoric", "History")}</h3>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {invoices.map(i => (
              <button key={i.id} onClick={() => setActive(i.id)}
                style={{ textAlign: "left", padding: "14px 18px", borderBottom: "1px solid var(--border)",
                  background: active === i.id ? "var(--surface-2)" : "transparent",
                  borderLeft: active === i.id ? "3px solid var(--accent)" : "3px solid transparent", width: "100%" }}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{i.id}</span>
                  <Badge tone="sage">{t("Plătită", "Paid")}</Badge>
                </div>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>{i.desc}</div>
                <div className="row between" style={{ marginTop: 4 }}>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>{i.date}</span>
                  <span className="mono" style={{ fontSize: 13 }}>{i.total.toLocaleString("ro-RO")} RON</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Invoice document */}
        <div>
          <div className="invoice-doc">
            <div className="inv-head">
              <div>
                <div className="row" style={{ gap: 10, alignItems: "center" }}>
                  <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 18 }}>P</div>
                  <div className="serif" style={{ fontSize: 26 }}>Plan</div>
                </div>
                <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 500, color: "var(--ink)" }}>Plan Marketplace SRL</div>
                  CUI: RO 45 102 887 · J40/8821/2024<br />
                  Bd. Unirii 12, București, RO<br />
                  IBAN: RO12 BTRL 0120 4455 9988 77XX
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="eyebrow" style={{ justifyContent: "flex-end" }}>{t("Factură fiscală", "Tax invoice")}</div>
                <div className="serif" style={{ fontSize: 30, marginTop: 8, letterSpacing: "-0.02em" }}>{inv.id}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
                  {t("Data emiterii", "Issue date")}: {inv.date}<br />
                  {t("Scadență", "Due")}: {inv.date}
                </div>
                <div style={{ marginTop: 10 }}><span className="inv-watermark">Mock · {t("PDF generat local", "locally generated PDF")}</span></div>
              </div>
            </div>

            <div className="inv-body">
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div>
                  <div className="kicker" style={{ marginBottom: 8 }}>{t("Furnizor", "Seller")}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Plan Marketplace SRL<br /><span style={{ color: "var(--muted)" }}>CUI RO 45102887 · București</span></div>
                </div>
                <div>
                  <div className="kicker" style={{ marginBottom: 8 }}>{t("Client", "Buyer")}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>Lemnăria Crișan SRL<br /><span style={{ color: "var(--muted)" }}>CUI RO 18442905 · Cluj-Napoca</span></div>
                </div>
              </div>

              <table className="inv-table">
                <thead>
                  <tr>
                    <th>{t("Descriere serviciu", "Service description")}</th>
                    <th style={{ textAlign: "right" }}>{t("Cant.", "Qty")}</th>
                    <th style={{ textAlign: "right" }}>{t("Preț unitar", "Unit price")}</th>
                    <th style={{ textAlign: "right" }}>{t("Valoare", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 500 }}>{inv.desc}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{t("Serviciu platformă Plan · marketplace mobilier", "Plan platform service · furniture marketplace")}</div>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>1</td>
                    <td className="mono" style={{ textAlign: "right" }}>{inv.base.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{inv.base.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="inv-foot">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, alignSelf: "end" }}>
                  {t("Cursul de schimb folosit: 1 EUR = 5.2 RON (configurabil).", "Exchange rate used: 1 EUR = 5.2 RON (configurable).")}<br />
                  {t("Document mock generat pentru demo. Înlocuibil cu API de facturare real.", "Mock document generated for demo. Replaceable with a real billing API.")}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="row between" style={{ fontSize: 13 }}><span style={{ color: "var(--muted)" }}>{t("Bază impozabilă", "Taxable base")}</span><span className="mono">{inv.base.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON</span></div>
                  <div className="row between" style={{ fontSize: 13 }}><span style={{ color: "var(--muted)" }}>TVA 21%</span><span className="mono">{vat.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON</span></div>
                  <hr className="divider" style={{ margin: "4px 0" }} />
                  <div className="row between" style={{ fontWeight: 600 }}><span>{t("Total de plată", "Total due")}</span><span className="serif" style={{ fontSize: 22 }}>{inv.total.toLocaleString("ro-RO")} RON</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="row between" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => go("co-subscription")}><Icon name="arrowLeft" size={12} /> {t("Înapoi la abonament", "Back to plan")}</button>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn"><Icon name="file" size={14} /> {t("Trimite pe email", "Email it")}</button>
              <button className="btn btn-walnut"><Icon name="file" size={14} /> {t("Descarcă PDF", "Download PDF")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// C. DELIVERY & REVIEW (client) — end of the journey
// ============================================================
const DeliveryReviewPage = ({ go }) => {
  const t = useT();
  const [stage, setStage] = React.useState("delivered"); // delivered -> review -> done
  const [rating, setRating] = React.useState(5);
  const [done, setDone] = React.useState(false);
  const low = rating < 3;

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("c-dashboard")}><Icon name="arrowLeft" size={12} /> {t("Toate cererile", "All requests")}</button>
      </div>

      <div className="page-header">
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>R-2580</span>
            <StatusBadge status={done ? (low ? "REJECTED" : "COMPLETED") : "IN_PROGRESS"} />
          </div>
          <h1 className="page-title" style={{ fontSize: 38 }}>{t("Reamenajare apartament Mărăști", "Mărăști apartment refit")}</h1>
          <p className="page-sub">{t("Atelier câștigător: Lemnăria Crișan · ofertă acceptată V2 · 58.400 RON", "Winning workshop: Lemnăria Crișan · accepted offer V2 · 58,400 RON")}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="stack">
          {/* Execution timeline */}
          <div className="card">
            <div className="kicker" style={{ marginBottom: 12 }}>{t("Parcurs execuție", "Execution progress")}</div>
            <div className="timeline">
              {[
                { t: t("acum 6 săpt", "6 wks ago"), title: t("Ofertă V2 acceptată", "Offer V2 accepted"), desc: t("Contract semnat · avans 40% achitat", "Contract signed · 40% advance paid"), done: true },
                { t: t("acum 4 săpt", "4 wks ago"), title: t("Material comandat", "Materials ordered"), desc: t("MDF vopsit, blat cuarț, accesorii Blum", "Painted MDF, quartz top, Blum hardware"), done: true },
                { t: t("acum 1 săpt", "1 wk ago"), title: t("Producție finalizată", "Production complete"), desc: t("Corpuri și fronturi gata pentru montaj", "Carcasses and fronts ready for install"), done: true },
                { t: t("azi", "today"), title: t("Atelierul a marcat: Livrat", "Workshop marked: Delivered"), desc: t("Montaj efectuat. Așteaptă confirmarea ta.", "Installed. Awaiting your confirmation."), now: true }
              ].map((e, i) => (
                <div key={i} className="timeline-item">
                  <div className="time">{e.t}</div>
                  <div className="dot-col"><div className="dot" style={{ background: e.now ? "var(--amber)" : "var(--sage)" }} /><div className="line" /></div>
                  <div className="content"><h4>{e.title}</h4><p>{e.desc}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery confirmation OR review */}
          {!done && stage === "delivered" && (
            <div className="card" style={{ borderColor: "var(--amber)" }}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="kicker">{t("Confirmare livrare", "Delivery confirmation")}</div>
                  <h3 className="serif" style={{ fontSize: 24, margin: "8px 0 6px" }}>{t("Ai primit proiectul complet?", "Did you receive the full project?")}</h3>
                  <p style={{ color: "var(--muted)", fontSize: 13.5, maxWidth: "52ch", margin: 0 }}>
                    {t("Confirmă doar după ce verifici montajul și funcționarea. După confirmare proiectul devine Finalizat și poți lăsa un review.",
                       "Confirm only after checking the install and that everything works. After confirming, the project becomes Completed and you can leave a review.")}
                  </p>
                </div>
              </div>
              <div className="grid-4" style={{ marginTop: 16 }}>
                <ImagePlaceholder label={t("livrare bucătărie", "kitchen delivered")} height={92} />
                <ImagePlaceholder label={t("dressing montat", "dressing installed")} height={92} />
                <ImagePlaceholder label={t("living finalizat", "living finished")} height={92} />
                <ImagePlaceholder label={t("detaliu blat", "top detail")} height={92} />
              </div>
              <hr className="divider" />
              <div className="row between">
                <button className="btn">{t("Raportează o problemă", "Report an issue")}</button>
                <button className="btn btn-walnut" onClick={() => setStage("review")}><Icon name="check" size={14} /> {t("Confirmă livrarea", "Confirm delivery")}</button>
              </div>
            </div>
          )}

          {!done && stage === "review" && (
            <div className="card">
              <div className="kicker">{t("Lasă un review", "Leave a review")}</div>
              <h3 className="serif" style={{ fontSize: 24, margin: "8px 0 14px" }}>{t("Cum a fost colaborarea cu Lemnăria Crișan?", "How was working with Lemnăria Crișan?")}</h3>
              <div className="row" style={{ gap: 14, alignItems: "center" }}>
                <div className="stars" style={{ fontSize: 30 }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} className={`star-btn ${n <= rating ? "on" : ""}`} onClick={() => setRating(n)}>★</span>
                  ))}
                </div>
                <div className="serif" style={{ fontSize: 28 }}>{rating}.0</div>
              </div>
              {low && (
                <Alert tone="crimson" icon="!" title={t("Review sub 3 stele → dispută automată", "Review under 3 stars → automatic dispute")}>
                  {t("Un administrator va deschide o dispută pentru a media situația. Atelierul va putea răspunde.", "An admin will open a dispute to mediate. The workshop will be able to respond.")}
                </Alert>
              )}
              <div className="field" style={{ marginTop: 14 }}>
                <label>{t("Comentariu (opțional)", "Comment (optional)")}</label>
                <textarea className="textarea" placeholder={t("Calitate, comunicare, respectarea termenului...", "Quality, communication, deadline...")}
                  defaultValue={low ? t("Termenul a fost depășit cu 2 săptămâni și un sertar nu se închide corect.", "Deadline missed by 2 weeks and one drawer doesn't close properly.") : t("Execuție impecabilă, fronturi perfect aliniate, montaj curat. Recomand!", "Impeccable build, perfectly aligned fronts, clean install. Recommended!")} />
              </div>
              <div className="row between" style={{ marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => setStage("delivered")}><Icon name="arrowLeft" size={12} /> {t("Înapoi", "Back")}</button>
                <button className="btn btn-walnut" onClick={() => setDone(true)}>{t("Trimite review", "Submit review")} <Icon name="arrow" size={14} /></button>
              </div>
            </div>
          )}

          {done && (
            <div className="card" style={{ borderColor: low ? "var(--crimson)" : "var(--sage)" }}>
              <div style={{ display: "grid", placeItems: "center", textAlign: "center", padding: "12px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: low ? "var(--crimson-soft)" : "var(--sage-soft)", color: low ? "var(--crimson)" : "var(--sage)", display: "grid", placeItems: "center", marginBottom: 14 }}>
                  <Icon name={low ? "warn" : "check"} size={26} />
                </div>
                <h3 className="serif" style={{ fontSize: 26, margin: "0 0 8px" }}>
                  {low ? t("Dispută deschisă", "Dispute opened") : t("Mulțumim pentru review!", "Thanks for your review!")}
                </h3>
                <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 460, margin: "0 auto 18px" }}>
                  {low
                    ? t("Adminul a fost notificat și va media disputa în cel mai scurt timp. Vei primi update-uri în chat.", "The admin was notified and will mediate the dispute shortly. You'll get updates in chat.")
                    : t("Review-ul tău (★ " + rating + ".0) ajută alți clienți și reputația atelierului. Proiectul este acum finalizat.", "Your review (★ " + rating + ".0) helps other clients and the workshop's reputation. The project is now completed.")}
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={() => { setDone(false); setStage("delivered"); }}>{t("Vezi din nou", "View again")}</button>
                  <button className="btn btn-walnut" onClick={() => go("c-dashboard")}>{t("Înapoi la cereri", "Back to requests")} <Icon name="arrow" size={14} /></button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side: project + workshop */}
        <div className="stack" style={{ position: "sticky", top: 96 }}>
          <div className="card">
            <div className="kicker">{t("Atelier", "Workshop")}</div>
            <div className="row" style={{ gap: 12, marginTop: 12 }}>
              <Avatar name="Lemnăria Crișan" tone="walnut" size={44} />
              <div>
                <div style={{ fontWeight: 500 }}>Lemnăria Crișan</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>★ 4.8 · 142 {t("proiecte", "projects")}</div>
              </div>
            </div>
            <hr className="divider" />
            <div className="stack" style={{ fontSize: 13, gap: 6 }}>
              <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Ofertă acceptată", "Accepted offer")}</span><span>V2 · 58.400 RON</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Avans plătit", "Advance paid")}</span><span>23.360 RON (40%)</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Rest la finalizare", "Balance on completion")}</span><span>35.040 RON</span></div>
              <div className="row between"><span style={{ color: "var(--muted)" }}>{t("Garanție", "Warranty")}</span><span>5 {t("ani", "years")}</span></div>
            </div>
            <button className="btn btn-sm" style={{ marginTop: 14, width: "100%" }} onClick={() => go("c-chat")}><Icon name="chat" size={12} /> {t("Deschide chat execuție", "Open execution chat")}</button>
          </div>

          <div className="card-flat" style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {t("Review-ul devine activ doar după ce confirmi livrarea. Un review sub 3 stele deschide automat o dispută gestionată de admin.",
               "Reviews unlock only after you confirm delivery. A review under 3 stars automatically opens an admin-managed dispute.")}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { CompanyOnboardingPage, BillingPage, DeliveryReviewPage });
