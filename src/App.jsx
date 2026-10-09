import { useCallback, useEffect, useState } from "react";
import Home from "./pages/Home/Home";
import Dashboard from "./pages/Dashboard/Dashboard";
import OwnerLoginModal from "./components/OwnerLoginModal/OwnerLoginModal";
import { isSupabaseConfigured } from "./lib/supabase";
import { createBooking, getBookings, updateBooking } from "./features/auth/bookings/bookingService";
import { emptyContactSettings, getContactSettings, saveContactSettings } from "./features/auth/contactSettings/contactSettingsService";
import { createProduct, deleteProduct, deleteUnusedProductImages, getProducts, updateProduct, uploadProductImage } from "./features/auth/products/productService";
import sampleProducts from "./features/auth/products/productData";
import useAuth from "./features/auth/useAuth";

function App() {
  const { user: owner, loading: authLoading, login, logout, updatePassword } = useAuth();
  const ownerAuthenticated = Boolean(owner);
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
  const [bookings, setBookings] = useState([]);
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
    if (!authLoading && path === "/dashboard" && !ownerAuthenticated) navigate("/");
  }, [path, ownerAuthenticated, authLoading, navigate]);

  const loadPublicProducts = useCallback(async () => {
    setDataLoading(true);
    setPageError("");
    try {
      const [nextProducts, nextContactSettings] = await Promise.all([getProducts(), getContactSettings()]);
      setProducts(nextProducts);
      setContactSettings(nextContactSettings);
    } catch (error) {
      setPageError(error.message || "Could not load services.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setDataLoading(true);
    setPageError("");
    try {
      const [nextProducts, nextBookings, nextContactSettings] = await Promise.all([
        getProducts({ owner: true }),
        getBookings(),
        getContactSettings(),
      ]);
      setProducts(nextProducts);
      setBookings(nextBookings);
      setContactSettings(nextContactSettings);
    } catch (error) {
      setPageError(error.message || "Could not load dashboard data.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setProducts(sampleProducts);
      return;
    }
    if (path === "/dashboard" && ownerAuthenticated) loadDashboard();
    else if (path !== "/dashboard") loadPublicProducts();
  }, [path, ownerAuthenticated, loadDashboard, loadPublicProducts]);

  const handleCreateBooking = async (booking) => createBooking(booking);

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

  const handleLogout = async () => {
    await logout();
    setBookings([]);
    navigate("/");
  };

  const handleOwnerLogin = async (email, password) => {
    await login(email, password);
    setPageError("");
    navigate("/dashboard");
  };

  if (path === "/dashboard" && authLoading) {
    return <main className="success-screen"><div className="success-content"><span>HADAD</span><p>Checking owner access…</p></div></main>;
  }

  if (path === "/dashboard" && ownerAuthenticated && dataLoading) {
    return <main className="success-screen"><div className="success-content"><span>HADAD</span><p>Loading…</p></div></main>;
  }

  if (path === "/dashboard" && ownerAuthenticated) {
    return <>
      {pageError && <div className="app-error" role="alert">{pageError}</div>}
      <Dashboard
        theme={theme}
        onToggleTheme={toggleTheme}
        products={products}
        bookings={bookings}
        contactSettings={contactSettings}
        onCreateProduct={handleCreateProduct}
        onUploadProductImage={uploadProductImage}
        onDeleteUnusedProductImages={deleteUnusedProductImages}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onReorderProducts={handleReorderProducts}
        onUpdateBooking={handleUpdateBooking}
        onSaveContactSettings={handleSaveContactSettings}
        onChangeOwnerPassword={updatePassword}
        onBackToShop={() => navigate("/")}
        onLogout={handleLogout}
        onReload={loadDashboard}
      />
    </>;
  }

  return <>
    {!isSupabaseConfigured && <div className="app-error" role="status">Preview mode: Supabase is not configured. You can browse sample services, but customer bookings and dashboard data changes require Supabase.</div>}
    {pageError && <div className="app-error" role="alert">{pageError}</div>}
    {dataLoading ? <main className="success-screen"><div className="success-content"><span>HADAD</span><p>Loading services…</p></div></main> : (
      <Home
        theme={theme}
        onToggleTheme={toggleTheme}
        products={products}
        contactSettings={contactSettings}
        onBookingCreated={handleCreateBooking}
        onOpenOwnerLogin={() => setLoginOpen(true)}
      />
    )}
    <OwnerLoginModal
      isOpen={loginOpen}
      onClose={() => setLoginOpen(false)}
      onLogin={handleOwnerLogin}
    />
  </>;
}

export default App;
