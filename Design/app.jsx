// Main app shell — Plan marketplace

const PAGES = {
  // CLIENT
  "c-landing": { title: "Landing", group: "client", comp: "LandingPage", crumbs: ["Plan", "Acasă"] },
  "c-new-request": { title: "Cerere nouă", group: "client", comp: "NewRequestPage", crumbs: ["Plan", "Cerere nouă"] },
  "c-dashboard": { title: "Cererile mele", group: "client", comp: "ClientDashboard", crumbs: ["Plan", "Cererile mele"] },
  "c-request-detail": { title: "Cerere detaliu", group: "client", comp: "RequestDetailPage", crumbs: ["Plan", "Cererile mele", "R-2841"] },
  "c-chat": { title: "Chat ofertant", group: "client", comp: "ClientChatPage", crumbs: ["Plan", "R-2841", "Chat"] },
  "c-compare": { title: "Compară oferte", group: "client", comp: "CompareOffersPage", crumbs: ["Plan", "R-2841", "Compară"] },
  "c-consult": { title: "Invitație consultanță", group: "client", comp: "ConsultationInvitePage", crumbs: ["Plan", "Chat", "Consultanță"] },
  "c-delivery": { title: "Livrare & review", group: "client", comp: "DeliveryReviewPage", crumbs: ["Plan", "R-2580", "Livrare"] },

  // COMPANY
  "co-onboarding": { title: "Onboarding firmă", group: "company", comp: "CompanyOnboardingPage", crumbs: ["Atelier", "Onboarding"] },
  "co-marketplace": { title: "Marketplace cereri", group: "company", comp: "CompanyMarketplace", crumbs: ["Atelier", "Marketplace"] },
  "co-claim": { title: "Detaliu & claim", group: "company", comp: "ClaimRequestPage", crumbs: ["Atelier", "Marketplace", "R-2841"] },
  "co-my-claims": { title: "Claims active", group: "company", comp: "MyClaimsPage", crumbs: ["Atelier", "Claims"] },
  "co-send-offer": { title: "Trimite ofertă", group: "company", comp: "SendOfferPage", crumbs: ["Atelier", "Claims", "Ofertă V2"] },
  "co-team": { title: "Echipă & roluri", group: "company", comp: "TeamPage", crumbs: ["Atelier", "Echipă"] },
  "co-subscription": { title: "Abonament & credite", group: "company", comp: "SubscriptionPage", crumbs: ["Atelier", "Abonament"] },
  "co-billing": { title: "Facturare", group: "company", comp: "BillingPage", crumbs: ["Atelier", "Facturare"] },
  "co-penalties": { title: "Penalizări", group: "company", comp: "PenaltiesPage", crumbs: ["Atelier", "Penalizări"] },
  "co-withdraw": { title: "Anulare claim", group: "company", comp: "ClaimWithdrawalPage", crumbs: ["Atelier", "Claims", "Anulare"] },

  // ADMIN
  "a-dashboard": { title: "Operațional", group: "admin", comp: "AdminDashboard", crumbs: ["Admin", "Dashboard"] },
  "a-sizing": { title: "Scoring proiecte", group: "admin", comp: "SizingConfigPage", crumbs: ["Admin", "Settings", "Sizing"] },
  "a-plans": { title: "Planuri & gating", group: "admin", comp: "PlansConfigPage", crumbs: ["Admin", "Settings", "Planuri"] },
  "a-withdrawals": { title: "Coadă anulări", group: "admin", comp: "WithdrawalsQueuePage", crumbs: ["Admin", "Anulări"] },
  "a-audit": { title: "Audit log", group: "admin", comp: "AuditLogPage", crumbs: ["Admin", "Audit"] }
};

const NAV = {
  client: {
    title: "Client (cumpărător)",
    sub: "Andreea P. · cont verificat",
    role: "Client",
    items: [
      { id: "c-landing", label: "Landing public" },
      { id: "c-dashboard", label: "Cererile mele", count: 4 },
      { id: "c-new-request", label: "Cerere nouă" },
      { id: "c-request-detail", label: "Detaliu cerere" },
      { id: "c-chat", label: "Chat cu atelier", count: 3 },
      { id: "c-compare", label: "Compară oferte" },
      { id: "c-consult", label: "Invitație consultanță" },
      { id: "c-delivery", label: "Livrare & review" }
    ]
  },
  company: {
    title: "Atelier (vânzător)",
    sub: "Lemnăria Crișan · Plan Gold",
    role: "Manager",
    items: [
      { id: "co-onboarding", label: "Onboarding firmă" },
      { id: "co-marketplace", label: "Marketplace cereri", count: 9 },
      { id: "co-claim", label: "Detaliu & rezervare" },
      { id: "co-my-claims", label: "Claims active", count: 5 },
      { id: "co-send-offer", label: "Trimite ofertă" },
      { id: "co-team", label: "Echipă & roluri" },
      { id: "co-subscription", label: "Abonament & credite" },
      { id: "co-billing", label: "Facturare" },
      { id: "co-penalties", label: "Penalizări" },
      { id: "co-withdraw", label: "Anulare claim" }
    ]
  },
  admin: {
    title: "Admin platformă",
    sub: "Plan · operațional",
    role: "Admin",
    items: [
      { id: "a-dashboard", label: "Dashboard" },
      { id: "a-sizing", label: "Scoring proiecte" },
      { id: "a-plans", label: "Planuri & gating" },
      { id: "a-withdrawals", label: "Coadă anulări", count: 3 },
      { id: "a-audit", label: "Audit log" }
    ]
  }
};

// ---- Tweaks defaults ----
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "artizanal",
  "accent": "walnut",
  "density": "comfortable",
  "radius": "soft",
  "specs": true
}/*EDITMODE-END*/;

const Shell = () => {
  const { lang, setLang } = useLangState();
  const t = (ro, en) => (lang === "ro" ? ro : (en !== undefined ? en : ro));
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks to <html>
  React.useEffect(() => {
    const el = document.documentElement;
    const themeAttr = tw.theme === "galerie" ? "dark" : tw.theme === "modern" ? "modern" : "light";
    el.setAttribute("data-theme", themeAttr);
    el.setAttribute("data-accent", tw.accent || "walnut");
    el.setAttribute("data-density", tw.density === "compact" ? "compact" : "comfortable");
    el.setAttribute("data-radius", tw.radius === "sharp" ? "sharp" : "soft");
    el.setAttribute("data-spec", tw.specs === false ? "off" : "on");
  }, [tw.theme, tw.accent, tw.density, tw.radius, tw.specs]);

  const [pageId, setPageId] = React.useState(() => {
    const hash = window.location.hash.replace("#", "");
    return PAGES[hash] ? hash : "c-landing";
  });
  React.useEffect(() => { window.location.hash = pageId; }, [pageId]);
  React.useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace("#", "");
      if (PAGES[hash] && hash !== pageId) setPageId(hash);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [pageId]);

  const go = React.useCallback((id) => {
    if (PAGES[id]) { setPageId(id); window.scrollTo({ top: 0 }); }
  }, []);

  const page = PAGES[pageId];
  const Component = window[page.comp];
  const group = page.group;
  const nav = NAV[group];

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand" onClick={() => go("c-landing")} style={{ cursor: "pointer" }}>
            <div className="brand-mark">P</div>
            <div>
              <div className="brand-name">Plan</div>
              <div className="brand-sub">{t("marketplace mobilier", "furniture marketplace")}</div>
            </div>
          </div>

          {Object.entries(NAV).map(([key, g]) => (
            <div key={key} className="nav-section">
              <div className="nav-section-title">{t(g.title)}</div>
              {g.items.map(item => (
                <button
                  key={item.id}
                  className={`nav-item ${pageId === item.id ? "active" : ""}`}
                  onClick={() => go(item.id)}
                >
                  <span className="dot" />
                  <span>{t(item.label)}</span>
                  {item.count != null && <span className="count">{item.count}</span>}
                </button>
              ))}
            </div>
          ))}

          <div className="sidebar-footer">
            <div className="kicker" style={{ marginBottom: 6 }}>{t("Prototip · 23 pagini", "Prototype · 23 pages")}</div>
            {t("Marketplace mobilier la comandă · flux end-to-end", "Custom furniture marketplace · end-to-end flow")}
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div className="crumbs">
              {page.crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="sep">/</span>}
                  <span>{t(c)}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="topbar-actions">
              <div className="role-pill">
                <span className="dot" style={{ background: group === "client" ? "var(--info)" : group === "company" ? "var(--accent)" : "var(--ink)" }} />
                {t(nav.role)} · {nav.sub}
              </div>
              <LangSwitch />
              <button className="icon-btn" aria-label="Notifications"><Icon name="bell" size={14} /></button>
              <button className="icon-btn" aria-label="Settings"><Icon name="settings" size={14} /></button>
            </div>
          </div>

          <Component go={go} />
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label={t("Direcție design", "Design direction")} />
        <TweakSelect label={t("Stil", "Style")} value={tw.theme}
          options={[
            { value: "artizanal", label: t("Artizanal (cald)", "Artisanal (warm)") },
            { value: "modern", label: t("Modern (curat)", "Modern (clean)") },
            { value: "galerie", label: t("Galerie (întunecat)", "Gallery (dark)") },
          ]}
          onChange={(v) => setTweak("theme", v)} />
        <TweakSection label={t("Accent", "Accent")} />
        <TweakColor label={t("Culoare accent", "Accent color")}
          value={{ walnut: "#855232", sage: "#5C7A57", bronze: "#9A7B3F", indigo: "#4B5A86" }[tw.accent]}
          options={["#855232", "#5C7A57", "#9A7B3F", "#4B5A86"]}
          onChange={(hex) => setTweak("accent", { "#855232": "walnut", "#5C7A57": "sage", "#9A7B3F": "bronze", "#4B5A86": "indigo" }[hex])} />
        <TweakSection label={t("Layout", "Layout")} />
        <TweakRadio label={t("Densitate", "Density")} value={tw.density}
          options={["comfortable", "compact"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakRadio label={t("Colțuri", "Corners")} value={tw.radius}
          options={["soft", "sharp"]}
          onChange={(v) => setTweak("radius", v)} />
        <TweakSection label={t("Handoff", "Handoff")} />
        <TweakToggle label={t("Adnotări spec (§)", "Spec annotations (§)")} value={tw.specs !== false}
          onChange={(v) => setTweak("specs", v)} />
      </TweaksPanel>
    </LangContext.Provider>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Shell />);
