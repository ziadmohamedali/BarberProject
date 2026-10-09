import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import "./NavigationSidebar.css";

function NavigationIcon({ name }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
    services: <><path d="M4 7h16M4 12h16M4 17h10" /><circle cx="19" cy="17" r="2" /></>,
    about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    contact: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    book: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /></>,
    requests: <><path d="M7 3h10l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M17 3v5h4M9 12h6M9 16h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1) scale(1.08)" /></>,
    add: <><path d="M12 5v14M5 12h14" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    collapse: <><path d="m14 6-6 6 6 6" /></>,
    expand: <><path d="m10 6 6 6-6 6" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    back: <><path d="m14 6-6 6 6 6M8 12h13" /></>,
  };

  return <svg {...common}>{paths[name] || paths.home}</svg>;
}

function NavigationSidebar({
  variant = "public",
  items,
  activeItem,
  onNavigate,
  onAddProduct,
  onBrandClick,
  theme,
  onToggleTheme,
  onBackToShop,
  onLogout,
}) {
  const { language, setLanguage, t } = useLanguage();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(`hadad-${variant}-sidebar-collapsed`) === "true";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const menuButtonRef = useRef(null);
  const firstNavRef = useRef(null);
  const drawerWasOpenRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const updateViewport = () => {
      setMobile(media.matches);
      if (!media.matches) setDrawerOpen(false);
    };
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(`hadad-${variant}-sidebar-collapsed`, String(collapsed));
    } catch {
      // The sidebar remains usable for this page view if storage is unavailable.
    }
  }, [collapsed, variant]);

  useEffect(() => {
    if (!drawerOpen) {
      if (drawerWasOpenRef.current) {
        drawerWasOpenRef.current = false;
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
      return undefined;
    }
    drawerWasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstNavRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      } else if (event.key === "Tab") {
        const focusable = [...document.querySelectorAll(
          ".navigation-sidebar a[href], .navigation-sidebar button:not(:disabled)"
        )];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);
  const toggleLanguage = () => setLanguage((current) => current === "ar" ? "en" : "ar");
  const handleNavigate = (item) => {
    item.onClick?.();
    onNavigate?.(item.id);
    closeDrawer();
  };
  const renderNavigation = (className) => {
    const headerLinks = className === "public-header-nav";
    return (
      <nav className={className} aria-label={t(variant === "dashboard" ? "Dashboard navigation" : "Main navigation")}>
      {items.map((item, index) => {
        const common = {
          className: headerLinks
            ? `public-header-link${activeItem === item.id ? " active" : ""}${item.primary ? " public-header-booking" : ""}`
            : `sidebar-link${activeItem === item.id ? " active" : ""}${item.primary ? " sidebar-link-primary" : ""}`,
          title: !headerLinks && collapsed && !mobile ? t(item.label) : undefined,
          "aria-label": t(item.label),
          "aria-current": activeItem === item.id ? "page" : undefined,
          onClick: () => handleNavigate(item),
          ref: index === 0 ? firstNavRef : undefined,
        };
        const inside = headerLinks
          ? t(item.label)
          : <><NavigationIcon name={item.icon} /><span className="sidebar-link-label">{t(item.label)}</span></>;
        return item.href
          ? <a {...common} href={item.href} key={item.id}>{inside}</a>
          : <button {...common} type="button" key={item.id}>{inside}</button>;
      })}
      </nav>
    );
  };
  const content = (
    <>
      <div className="sidebar-brand-row">
        <a className="sidebar-brand" href={variant === "dashboard" ? "/dashboard" : "#top"} onClick={() => { closeDrawer(); onBrandClick?.(); }} aria-label={t("HADAD home")}>
          <span className="sidebar-brand-full">HADAD<span>.</span></span>
          <span className="sidebar-brand-compact" aria-hidden="true">H<span>.</span></span>
        </a>
        {mobile ? (
          <button className="sidebar-icon-button sidebar-close" type="button" onClick={closeDrawer} aria-label={t("Close navigation")}>
            <NavigationIcon name="close" />
          </button>
        ) : (
          <button className="sidebar-icon-button sidebar-collapse" type="button" onClick={() => setCollapsed((current) => !current)} aria-label={t(collapsed ? "Expand sidebar" : "Collapse sidebar")} title={t(collapsed ? "Expand sidebar" : "Collapse sidebar")}>
            <NavigationIcon name={collapsed ? "expand" : "collapse"} />
          </button>
        )}
      </div>

      {renderNavigation("sidebar-nav")}

      {variant === "dashboard" && (
        <div className="sidebar-footer sidebar-owner-actions">
          <button className="sidebar-link sidebar-link-primary" type="button" onClick={() => { onAddProduct?.(); closeDrawer(); }} title={collapsed && !mobile ? t("＋ Add product") : undefined} aria-label={t("＋ Add product")}>
            <NavigationIcon name="add" /><span className="sidebar-link-label">{t("＋ Add product")}</span>
          </button>
          <button className="sidebar-link" type="button" onClick={onBackToShop} title={collapsed && !mobile ? t("← Back to shop") : undefined} aria-label={t("← Back to shop")}>
            <NavigationIcon name="back" /><span className="sidebar-link-label">{t("← Back to shop")}</span>
          </button>
          <button className="sidebar-link" type="button" onClick={onLogout} title={collapsed && !mobile ? t("Log out") : undefined} aria-label={t("Log out")}>
            <NavigationIcon name="logout" /><span className="sidebar-link-label">{t("Log out")}</span>
          </button>
        </div>
      )}

      <div className="sidebar-footer sidebar-preferences">
        <button className="sidebar-link" type="button" onClick={toggleLanguage} title={collapsed && !mobile ? t("Switch language") : undefined} aria-label={t(language === "ar" ? "Switch to English" : "Switch to Arabic")}>
          <NavigationIcon name="language" /><span className="sidebar-link-label">{language === "ar" ? "English" : "العربية"}</span>
        </button>
        <button className="sidebar-link" type="button" onClick={onToggleTheme} title={collapsed && !mobile ? t("Toggle theme") : undefined} aria-label={t(theme === "dark" ? "Switch to White theme" : "Switch to dark theme")}>
          <NavigationIcon name={theme === "dark" ? "sun" : "moon"} /><span className="sidebar-link-label">{t(theme === "dark" ? "White" : "Dark")}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className={`navigation-system ${variant}-navigation-system${collapsed ? " is-collapsed" : ""}${drawerOpen ? " drawer-open" : ""}`}>
      {variant === "public" && (
        <header className="public-horizontal-header">
          <a className="public-header-brand" href="#top" onClick={onBrandClick} aria-label={t("HADAD home")}>
            HADAD<span>.</span>
          </a>
          {renderNavigation("public-header-nav")}
          <div className="public-header-controls">
            <button type="button" onClick={toggleLanguage} aria-label={t(language === "ar" ? "Switch to English" : "Switch to Arabic")}>
              {language === "ar" ? "English" : "العربية"}
            </button>
            <button type="button" onClick={onToggleTheme} aria-label={t(theme === "dark" ? "Switch to White theme" : "Switch to dark theme")}>
              <NavigationIcon name={theme === "dark" ? "sun" : "moon"} />
              <span>{t(theme === "dark" ? "White" : "Dark")}</span>
            </button>
          </div>
        </header>
      )}
      {mobile && (
        <div className="mobile-navigation-bar">
          <a className="sidebar-brand" href={variant === "dashboard" ? "/dashboard" : "#top"} onClick={onBrandClick} aria-label={t("HADAD home")}>HADAD<span>.</span></a>
          <button ref={menuButtonRef} className="mobile-menu-button" type="button" aria-label={t("Open navigation")} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
            <NavigationIcon name="menu" />
          </button>
        </div>
      )}
      <aside className="navigation-sidebar" aria-label={t(variant === "dashboard" ? "Dashboard navigation" : "Main navigation")} role={mobile && drawerOpen ? "dialog" : undefined} aria-modal={mobile && drawerOpen ? "true" : undefined}>
        {content}
      </aside>
      {drawerOpen && <button className="navigation-backdrop" type="button" aria-label={t("Close navigation")} onClick={closeDrawer} />}
    </div>
  );
}

export default NavigationSidebar;
