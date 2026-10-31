import { useCallback, useEffect, useState } from "react";
import Home from "./pages/Home/Home";
import Dashboard from "./pages/Dashboard/Dashboard";
import { isSupabaseConfigured } from "./lib/supabase";
import { createAppointment, getAppointmentErrorMessage, getAppointments, getBookings, updateAppointment, updateBooking } from "./features/auth/bookings/bookingService";
import { emptyContactSettings, getContactSettings, saveContactSettings } from "./features/auth/contactSettings/contactSettingsService";
import { defaultHomeSettings, getHomeSettings, getWorkingHours, saveHomeSettings } from "./features/auth/homeSettings/homeSettingsService";
import { createProduct, deleteProduct, deleteUnusedProductImages, getProducts, updateProduct, uploadProductImage } from "./features/auth/products/productService";
import sampleProducts from "./features/auth/products/productData";
import { LanguageContext, useLanguage } from "./lib/i18n";
import { useLanguageState } from "./i18n";
import { uploadStorageImage } from "./lib/supabase";
import {
  DASHBOARD_ROUTE,
  OWNER_LOGIN_ROUTE,
  restoreOwnerSession,
  signInOwner,
  signOutOwner,
} from "./lib/dashboardAuth";

function AppContent() {
  const { t } = useLanguage();
  const [dashboardAuthenticated, setDashboardAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem("hadad-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [path, setPath] = useState(window.location.pathname);
  const [loginOpen, setLoginOpen] = useState(false);
  const [products, setProducts] = useState(() => isSupabaseConfigured ? [] : sampleProducts);
  const [contactSettings, setContactSettings] = useState(emptyContactSettings);
  const [homeSettings, setHomeSettings] = useState(defaultHomeSettings);
  const [bookings, setBookings] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("hadad-theme", theme);
    } catch {
      // The selected theme still applies for this page view if storage is unavailable.
    }
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");

  const navigate = useCallback((nextPath) => {
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    restoreOwnerSession()
      .then(setDashboardAuthenticated)
      .catch(() => setDashboardAuthenticated(false))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (path === "/dashboard") {
      navigate(DASHBOARD_ROUTE);
    } else if (path === DASHBOARD_ROUTE && !dashboardAuthenticated) {
      setLoginOpen(true);
      navigate(OWNER_LOGIN_ROUTE);
    } else if (path === OWNER_LOGIN_ROUTE && dashboardAuthenticated) {
      setLoginOpen(false);
      navigate(DASHBOARD_ROUTE);
    } else if (path === OWNER_LOGIN_ROUTE) {
      setLoginOpen(true);
    } else {
      setLoginOpen(false);
    }
  }, [path, authLoading, dashboardAuthenticated, navigate]);

  const loadPublicProducts = useCallback(async () => {
    setDataLoading(true);
    setPageError("");
    try {
      const [nextProducts, nextContactSettings, nextHomeSettings] = await Promise.all([getProducts(), getContactSettings(), getHomeSettings()]);
      setProducts(nextProducts);
      setContactSettings(nextContactSettings);
      setHomeSettings(nextHomeSettings);
    } catch (error) {
      setPageError(t(error.message || "Could not load services."));
    } finally {
      setDataLoading(false);
    }
  }, [t]);

  const loadDashboard = useCallback(async () => {
    setDataLoading(true);
    setPageError("");
    try {
      const results = await Promise.allSettled([
        getProducts({ owner: true }),
        getBookings(),
        getAppointments(),
        getContactSettings(),
        getHomeSettings(),
      ]);
      const setters = [setProducts, setBookings, setAppointments, setContactSettings, setHomeSettings];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") setters[index](result.value);
      });

      const failures = results
        .filter((result) => result.status === "rejected")
        .map((result) => getAppointmentErrorMessage(result.reason, "Could not load dashboard data."));
      if (failures.length) setPageError(failures.join(" "));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setProducts(sampleProducts);
      return;
    }
    if (path === DASHBOARD_ROUTE && dashboardAuthenticated) loadDashboard();
    else if (path !== DASHBOARD_ROUTE) loadPublicProducts();
  }, [path, dashboardAuthenticated, loadDashboard, loadPublicProducts]);

  const handleCreateBooking = async (appointment) => createAppointment(appointment);

  const handleUpdateAppointment = async (id, changes) => {
    const updated = await updateAppointment(id, changes);
    setAppointments((current) => current.map((appointment) => appointment.id === updated.id ? updated : appointment));
    return updated;
  };

  const handleCreateProduct = async (product) => {
    const created = await createProduct(product);
    setProducts((current) => [...current, created]);
  };

  const handleUpdateProduct = async (product) => {
    const updated = await updateProduct(product);
    setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const handleDeleteProduct = async (productId) => {
    await deleteProduct(productId);
    setProducts((current) => current.filter((item) => item.id !== productId));
  };

  const handleReorderProducts = async (orderedCategoryProducts) => {
    await Promise.all(orderedCategoryProducts.map((product, index) => updateProduct({ ...product, sortOrder: index })));
    const ids = new Map(orderedCategoryProducts.map((product, index) => [product.id, index]));
    setProducts((current) => current.map((item) => ids.has(item.id) ? { ...item, sortOrder: ids.get(item.id) } : item)
      .sort((a, b) => a.sortOrder - b.sortOrder));
  };

  const handleUpdateBooking = async (id, field, value) => {
    await updateBooking(id, field, value);
    setBookings((current) => current.map((booking) => booking.id === id
      ? { ...booking, [field]: value }
      : booking));
  };

  const handleSaveContactSettings = async (settings) => {
    const updated = await saveContactSettings(settings);
    setContactSettings(updated);
    return updated;
  };

  const handleSaveHomeSettings = async (settings) => {
    const updated = await saveHomeSettings(settings);
    setHomeSettings(updated);
    return updated;
  };

  const handleLogout = async () => {
    try {
      await signOutOwner();
    } finally {
      setDashboardAuthenticated(false);
      setBookings([]);
      setAppointments([]);
      navigate("/");
    }
  };

  const handleOwnerLogin = async (username, password) => {
    if (!isSupabaseConfigured) throw new Error("Configure Supabase before signing in to the dashboard.");
    await signInOwner(username, password);
    setDashboardAuthenticated(true);
    setLoginOpen(false);
    navigate(DASHBOARD_ROUTE);
  };

  if ((path === DASHBOARD_ROUTE || path === "/dashboard") && authLoading) {
    return <main className="success-screen"><div className="success-content"><span>MOHAMED HADAD</span><p>{t("Checking owner access…")}</p></div></main>;
  }

  if (path === DASHBOARD_ROUTE && dashboardAuthenticated && dataLoading) {
    return <main className="success-screen"><div className="success-content"><span>MOHAMED HADAD</span><p>{t("Loading…")}</p></div></main>;
  }

  if (path === DASHBOARD_ROUTE && dashboardAuthenticated) {
    return <>
      {pageError && <div className="app-error" role="alert">{t(pageError)}</div>}
      <Dashboard
        theme={theme}
        onToggleTheme={toggleTheme}
        products={products}
        bookings={bookings}
        appointments={appointments}
        contactSettings={contactSettings}
        homeSettings={homeSettings}
        onCreateProduct={handleCreateProduct}
        onUploadProductImage={uploadProductImage}
        onDeleteUnusedProductImages={deleteUnusedProductImages}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onReorderProducts={handleReorderProducts}
        onUpdateBooking={handleUpdateBooking}
        onUpdateAppointment={handleUpdateAppointment}
        onSaveContactSettings={handleSaveContactSettings}
        onSaveHomeSettings={handleSaveHomeSettings}
        onUploadHomeImage={uploadStorageImage}
        onBackToShop={() => navigate("/")}
        onLogout={handleLogout}
        onReload={loadDashboard}
      />
    </>;
  }

  return <>
    {!isSupabaseConfigured && <div className="app-error" role="status">{t("Preview mode: Supabase is not configured. You can browse sample services, but customer bookings and dashboard data changes require Supabase.")}</div>}
    {pageError && <div className="app-error" role="alert">{t(pageError)}</div>}
    {dataLoading ? <main className="success-screen"><div className="success-content"><span>HADAD</span><p>{t("Loading services…")}</p></div></main> : (
      <Home
        theme={theme}
        onToggleTheme={toggleTheme}
        products={products}
        contactSettings={contactSettings}
        homeSettings={homeSettings}
        onRefreshWorkingHours={getWorkingHours}
        onBookingCreated={handleCreateBooking}
        onOpenOwnerLogin={() => {
          setLoginOpen(true);
          navigate(OWNER_LOGIN_ROUTE);
        }}
        onCloseOwnerLogin={() => {
          setLoginOpen(false);
          if (path === OWNER_LOGIN_ROUTE) navigate("/");
        }}
        loginOpen={loginOpen}
        onOwnerLogin={handleOwnerLogin}
      />
    )}
  </>;
}

function App() {
  const language = useLanguageState();
  return (
    <LanguageContext.Provider value={language}>
      <AppContent />
    </LanguageContext.Provider>
  );
}

export default App;
