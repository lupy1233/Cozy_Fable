// i18n layer for Plan marketplace — RO (default) + EN
// Usage in any component:  const t = useT();  t("Preț total", "Total price")
// Single-arg form falls back to DICT lookup:  t("Status")

const LangContext = React.createContext({ lang: "ro", setLang: () => {} });

// Dictionary of frequently-repeated chrome terms (RO -> EN).
// Lets single-argument t("...") calls translate automatically.
const DICT = {
  // nav groups + roles
  "Client (cumpărător)": "Client (buyer)",
  "Atelier (vânzător)": "Workshop (seller)",
  "Admin platformă": "Platform admin",
  "Client": "Client",
  "Manager": "Manager",
  "Admin": "Admin",
  "cont verificat": "verified account",
  "operațional": "operations",

  // nav items
  "Landing public": "Public landing",
  "Cererile mele": "My requests",
  "Cerere nouă": "New request",
  "Detaliu cerere": "Request detail",
  "Chat cu atelier": "Chat with workshop",
  "Compară oferte": "Compare offers",
  "Invitație consultanță": "Consultation invite",
  "Livrare & review": "Delivery & review",
  "Marketplace cereri": "Requests marketplace",
  "Detaliu & rezervare": "Detail & claim",
  "Claims active": "Active claims",
  "Trimite ofertă": "Send offer",
  "Echipă & roluri": "Team & roles",
  "Abonament & credite": "Plan & credits",
  "Facturare": "Billing",
  "Penalizări": "Penalties",
  "Anulare claim": "Withdraw claim",
  "Onboarding firmă": "Workshop onboarding",
  "Dashboard": "Dashboard",
  "Scoring proiecte": "Project scoring",
  "Planuri & gating": "Plans & gating",
  "Coadă anulări": "Withdrawals queue",
  "Audit log": "Audit log",
  "Verificare firme": "Company review",
  "Dispute": "Disputes",

  // common UI
  "Înapoi": "Back",
  "Continuă": "Continue",
  "Publică cererea": "Publish request",
  "Status": "Status",
  "Mărime": "Size",
  "Oferte": "Offers",
  "Ateliere": "Workshops",
  "Publicat": "Published",
  "Preț total": "Total price",
  "Preț": "Price",
  "Termen": "Lead time",
  "Garanție": "Warranty",
  "Material": "Material",
  "Sisteme": "Systems",
  "Locație": "Location",
  "Buget": "Budget",
  "Descriere": "Description",
  "Detalii": "Details",
  "Data": "Date",
  "Acțiuni": "Actions",
  "Total": "Total",
  "Credite": "Credits",
  "credite": "credits",
  "Anulează": "Cancel",
  "Renunță": "Discard",
  "Salvează draft": "Save draft",
  "Vezi detalii": "View details",
  "Vezi detalii ofertă": "View offer details",
  "Acceptă această ofertă": "Accept this offer",
  "Trimite": "Send",
  "Configurare": "Configuration",
  "Activitate": "Activity",
  "Rol": "Role",
  "Angajat": "Employee",
  "Eveniment": "Event",
  "Puncte": "Points",
  "Expiră": "Expires",
  "Filtre": "Filters",
  "Filtrează": "Filter",
  "Export CSV": "Export CSV",
  "Versiuni": "Versions",
  "Toate cererile": "All requests",
  "Toate": "All",
  "Active": "Active",
  "Arhivate": "Archived",
  "Cerere": "Request",
  "Ofertă": "Offer",
  "Acceptă": "Accept",
  "Vezi profil atelier": "View workshop profile",
  "Vezi ofertă": "View offer",
  "Mesaj în chat": "Message in chat",
  "Scrie un mesaj...": "Write a message...",
  "Cumpără": "Buy",
  "Sunt atelier": "I'm a workshop",
  "Vezi marketplace": "View marketplace",
  "Depune o cerere": "Post a request",

  // statuses
  "Draft": "Draft",
  "Claim activ": "Active claim",
  "Negociere": "Negotiation",
  "Ofertă trimisă": "Offer sent",
  "Acceptată": "Accepted",
  "Respins": "Rejected",
  "Expirat": "Expired",
  "În execuție": "In progress",
  "Finalizat": "Completed",
  "Livrat": "Delivered",
  "Disputat": "Disputed",
};

function useLangState() {
  const [lang, setLangRaw] = React.useState(() => localStorage.getItem("plan_lang") || "ro");
  const setLang = React.useCallback((l) => {
    setLangRaw(l);
    localStorage.setItem("plan_lang", l);
    document.documentElement.lang = l;
  }, []);
  React.useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return { lang, setLang };
}

function useT() {
  const { lang } = React.useContext(LangContext);
  return React.useCallback((ro, en) => {
    if (lang === "ro") return ro;
    if (en !== undefined) return en;
    return DICT[ro] !== undefined ? DICT[ro] : ro;
  }, [lang]);
}

const LangSwitch = () => {
  const { lang, setLang } = React.useContext(LangContext);
  return (
    <div className="seg" role="group" aria-label="Language">
      {["ro", "en"].map(l => (
        <button key={l} className={lang === l ? "on" : ""} onClick={() => setLang(l)}>{l}</button>
      ))}
    </div>
  );
};

Object.assign(window, { LangContext, useLangState, useT, LangSwitch });
