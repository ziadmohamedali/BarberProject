/* eslint-disable react/prop-types -- Existing app components use JavaScript props without PropTypes. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CategoryFilter from "../../components/CategoryFilter/CategoryFilter";
import ProductGrid from "../../components/ProductGrid/ProductGrid";
import ProductModal from "../../components/ProductModal/ProductModal";
import SelectionSummary from "../../components/SelectionSummary/SelectionSummary";
import CustomerForm from "../../components/CustomerForm/CustomerForm";
import NavigationSidebar from "../../components/NavigationSidebar/NavigationSidebar";
import OwnerLoginModal from "../../components/OwnerLoginModal/OwnerLoginModal";
import { getAppointmentConfirmation, getAppointmentErrorMessage } from "../../features/auth/bookings/bookingService";
import { useLanguage } from "../../lib/i18n";
import barberImage from "../../assets/barberimg.png";

import "./Home.css";

const bookingStatusLabel = (status) => ({
  pending_review: "Pending Review",
  awaiting_payment: "Awaiting Payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
}[status] || status);

const depositStatusLabel = (status) => ({
  not_requested: "Not Requested",
  awaiting_payment: "Awaiting Payment",
  payment_verified: "Payment Verified",
  refunded: "Refunded",
}[status] || status);

function Home({ theme, onToggleTheme, products, contactSettings, homeSettings, onBookingCreated, onOpenOwnerLogin, onCloseOwnerLogin, loginOpen, onOwnerLogin }) {
  const { language, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState("haircut");
  const [selectedProducts, setSelectedProducts] = useState(() => {
    try { return JSON.parse(window.sessionStorage.getItem("hadad-selected-products") || "[]"); } catch { return []; }
  });
  const [openedProduct, setOpenedProduct] = useState(null);
  const [showCustomerForm, setShowCustomerForm] = useState(() => window.sessionStorage.getItem("hadad-checkout-open") === "true");
  const [bookingComplete, setBookingComplete] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [activeNavigation, setActiveNavigation] = useState("home");
  const ownerClickRef = useRef({ count: 0, lastClick: 0, timer: null });

  useEffect(() => () => clearTimeout(ownerClickRef.current.timer), []);
  useEffect(() => {
    try { window.sessionStorage.setItem("hadad-selected-products", JSON.stringify(selectedProducts)); }
    catch { /* Checkout selection still works for this page view. */ }
  }, [selectedProducts]);

  const restoreConfirmation = useCallback(async () => {
    const reference = new URLSearchParams(window.location.search).get("booking");
    if (!reference) return;
    setConfirmationLoading(true);
    setConfirmationError("");
    try {
      const token = window.sessionStorage.getItem(`hadad-confirmation-${reference}`);
      if (!token) {
        throw new Error("This confirmation could not be verified in this browser. Return to the shop or contact HADAD with your booking reference.");
      }
      const appointment = await getAppointmentConfirmation(reference, token);
      if (!appointment) {
        throw new Error("This confirmation could not be verified. Please contact HADAD with your booking reference.");
      }
      setSubmittedBooking(appointment);
      setBookingComplete(true);
    } catch (error) {
      setConfirmationError(getAppointmentErrorMessage(error, "The appointment confirmation could not be loaded."));
    } finally {
      setConfirmationLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreConfirmation();
  }, [restoreConfirmation]);

  useEffect(() => {
    const sections = ["top", "about", "products", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const active = visible.target.id === "about" ? "about" : visible.target.id;
      setActiveNavigation(active === "top" ? "home" : active === "products" ? "services" : active);
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, .2, .5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navigationItems = [
    { id: "home", label: "Home", icon: "home", href: "#top" },
    { id: "services", label: "Services", icon: "services", href: "#products" },
    { id: "about", label: "About", icon: "about", href: "#about" },
    { id: "contact", label: "Contact", icon: "contact", href: "#contact" },
    { id: "book", label: "Book Appointment", icon: "book", href: "#products", primary: true },
  ];

  const handleBrandClick = () => {
    const clicks = ownerClickRef.current;
    const now = Date.now();
    if (now - clicks.lastClick > 1600) clicks.count = 0;
    clicks.count += 1;
    clicks.lastClick = now;
    clearTimeout(clicks.timer);

    if (clicks.count >= 4) {
      clicks.count = 0;
      onOpenOwnerLogin();
    } else {
      clicks.timer = setTimeout(() => {
        clicks.count = 0;
        clicks.timer = null;
      }, 1600);
    }
  };

  const filteredProducts = useMemo(
    () => products.filter((product) => product.category === activeCategory && product.active),
    [products, activeCategory]
  );

  const handleSelectProduct = (product) => {
    setSelectedProducts((current) => {
      if (current.some((item) => item.id === product.id)) return current;
      return [...current, product];
    });
    setOpenedProduct(null);
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts((current) => current.filter((product) => product.id !== productId));
  };

  const handleContinue = () => {
    setShowCustomerForm(true);
    try { window.sessionStorage.setItem("hadad-checkout-open", "true"); }
    catch { /* Continue to sign-in; the selection remains in component state. */ }
    setTimeout(() => {
      document.getElementById("customer-form")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const handleBackToServices = () => {
    setShowCustomerForm(false);
    try { window.sessionStorage.setItem("hadad-checkout-open", "false"); }
    catch { /* Keep the current view state if browser storage is unavailable. */ }
    setTimeout(() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const handleBookingSuccess = async (booking) => {
    const request = {
      ...booking,
      products: selectedProducts.map(({ id, title, price }) => ({ productId: id, title, price })),
    };
    const savedAppointment = await onBookingCreated(request);
    try {
      window.sessionStorage.setItem(`hadad-confirmation-${savedAppointment.reference}`, booking.confirmationToken);
      window.sessionStorage.removeItem("hadad-pending-appointment");
      window.sessionStorage.removeItem("hadad-checkout-open");
    } catch {
      // The server-confirmed result can still be shown for this page view.
    }
    window.history.replaceState({}, "", `/?booking=${encodeURIComponent(savedAppointment.reference)}`);
    setSubmittedBooking(savedAppointment);
    setBookingComplete(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const whatsappMessage = submittedBooking && [
    t("Hello Hadad,"),
    "",
    `${t("Booking reference:")} ${submittedBooking.reference}`,
    `${t("Name:")} ${submittedBooking.customerName}`,
    ...submittedBooking.services.map((service) => `${service.title} â€” ${service.price} ${t("EGP")}`),
    ...(submittedBooking.preferredAppointmentAt ? [`${t("Requested appointment time:")} ${new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submittedBooking.preferredAppointmentAt))}`, t("This time is a preference, not a confirmation.")] : []),
    `${t("Deposit:")} ${submittedBooking.deposit} ${t("EGP")}`,
  ].join("\n");
  const whatsappDigits = String(contactSettings?.whatsappPhone || "").replace(/\D/g, "");
  const whatsappNumber = whatsappDigits.startsWith("00")
    ? whatsappDigits.slice(2)
    : whatsappDigits.startsWith("0")
      ? `20${whatsappDigits.slice(1)}`
      : whatsappDigits;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage || t("Hello Hadad, I’d like to ask about your services."))}`
    : "";

  if (confirmationLoading) {
    return <main className="success-screen"><div className="success-content"><span>HADAD</span><p>{t("Verifying your appointmentâ€¦")}</p></div></main>;
  }

  if (confirmationError) {
    return (
      <main className="success-screen">
        <div className="success-content">
          <span>HADAD</span>
          <h1>{t("Confirmation unavailable")}</h1>
          <p role="alert">{t(confirmationError)}</p>
          <button onClick={restoreConfirmation}>{t("Retry verification")}</button>
          <a className="success-whatsapp-link" href="/">{t("Back to Hadad")}</a>
        </div>
      </main>
    );
  }

  if (bookingComplete) {
    return (
      <>
        <NavigationSidebar
          items={navigationItems}
          activeItem={activeNavigation}
          onNavigate={setActiveNavigation}
          onBrandClick={handleBrandClick}
          theme={theme}
          onToggleTheme={onToggleTheme}
          showThemeToggle={!loginOpen}
        />
        <OwnerLoginModal isOpen={loginOpen} onClose={onCloseOwnerLogin} onLogin={onOwnerLogin} />
        <div className="public-main">
        <main className="success-screen">
        <div className="success-content">
          <div className="success-icon">âœ“</div>
          <span>HADAD</span>
          <h1>{t("Request Received")}</h1>
          <p className="success-greeting">{t("Thank you{suffix}!", { suffix: submittedBooking.customerName ? `${language === "ar" ? "، " : ", "}${submittedBooking.customerName}` : "" })}</p>
          <div className="appointment-confirmation-details">
            <p><strong>{t("Booking reference:")}</strong> {submittedBooking.reference}</p>
            <p><strong>{t("Service:")}</strong> {submittedBooking.services.map((service) => service.title).join(", ")}</p>
            {submittedBooking.preferredAppointmentAt && <p><strong>{t("Requested appointment time:")}</strong> {new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submittedBooking.preferredAppointmentAt))} · {t("preference, not confirmation")}</p>}
            <p><strong>{t("Total:")}</strong> {submittedBooking.total} {t("EGP")}</p>
            <p><strong>{t("Deposit:")}</strong> {submittedBooking.deposit} {t("EGP")} Â· {t(depositStatusLabel(submittedBooking.depositStatus))}</p>
          </div>
          <p><strong>{t("Booking status")}:</strong> {t(bookingStatusLabel(submittedBooking.bookingStatus))}</p>
          <p>{t("Your request has been received. We will contact you through WhatsApp to confirm availability and provide deposit payment instructions. No payment is required now.")}</p>
          {whatsappHref && <a className="success-whatsapp-link" href={whatsappHref} target="_blank" rel="noreferrer">{t("Continue on WhatsApp")}</a>}
          <button onClick={() => window.location.assign("/")}>{t("Back to Hadad")}</button>
        </div>
        </main>
        {whatsappHref && <FloatingWhatsApp href={whatsappHref} label={t("Chat with us on WhatsApp")} />}
        </div>
      </>
    );
  }

  return (
    <>
      <NavigationSidebar
        items={navigationItems}
        activeItem={activeNavigation}
        onNavigate={setActiveNavigation}
        onBrandClick={handleBrandClick}
        theme={theme}
        onToggleTheme={onToggleTheme}
        showThemeToggle={!loginOpen}
      />
      <OwnerLoginModal isOpen={loginOpen} onClose={onCloseOwnerLogin} onLogin={onOwnerLogin} />
      <div className="public-main">
      <main>
      <section className="hero" id="top">
        <div className="hero-content" id="about">
          <span className="eyebrow">{t("INDEPENDENT BARBER · OWNED AND RUN BY HADAD")}</span>
          <h1>{(language === "ar" ? (homeSettings?.headingAr || "قصة مميزة.\nأناقة تدوم.") : (homeSettings?.headingEn || "Sharp cuts.\nClean style.")).split("\n").map((line, index, lines) => <span key={`${index}-${line}`}>{line}{index < lines.length - 1 && <br />}</span>)}</h1>
          <p>{language === "ar" ? homeSettings?.descriptionAr : homeSettings?.descriptionEn || t("Premium barbering for gentlemen who want a sharp finish, a relaxed experience, and a look that lasts beyond the chair.")}</p>
          <div className="hero-actions">
            <a href="#products">{t("Book a service")}</a>
            <a href="#contact" className="secondary-link">{t("Contact")}</a>
          </div>
          <ul className="hero-list" aria-label={t("Barber shop highlights")}>
            <li>{t("Precision Haircuts")}</li>
            <li>{t("Beard & Grooming")}</li>
            <li>{t("Premium Packages")}</li>
          </ul>
        </div>

        <div className="hero-visual" aria-label={t("Portrait and service details")}>
          <div className="hero-photo-card">
            <img src={homeSettings?.imageUrl || barberImage} alt={t("Barber finishing a haircut")} />
            <div className="floating-badge top">{t("Modern Grooming")}</div>
            <div className="floating-badge bottom">{t("From 150 EGP")}</div>
          </div>
        </div>
      </section>

      {(language === "ar" ? homeSettings?.rulesAr : homeSettings?.rulesEn) && <aside className="booking-rules-note"><span aria-hidden="true">i</span><p>{language === "ar" ? homeSettings.rulesAr : homeSettings.rulesEn}</p></aside>}

      <section className="products-section" id="products">
        <div className="section-heading center">
          <span>{t("Our Services")}</span>
          <h2>{t("Choose Your Style")}</h2>
        </div>
        <CategoryFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        {filteredProducts.length > 0 ? (
          <ProductGrid
            products={filteredProducts}
            selectedProducts={selectedProducts}
            onOpenProduct={setOpenedProduct}
          />
        ) : (
          <p className="empty-services">{t(activeCategory === "haircut" ? "No haircuts are available right now." : "No packages are available right now.")}</p>
        )}
      </section>

      {openedProduct && (
        <ProductModal
          product={openedProduct}
          isSelected={selectedProducts.some((product) => product.id === openedProduct.id)}
          onClose={() => setOpenedProduct(null)}
          onSelect={handleSelectProduct}
          onRemove={(product) => handleRemoveProduct(product.id)}
        />
      )}

      <div id="customer-form" className="checkout-view" hidden={!showCustomerForm}>
        <CustomerForm selectedProducts={selectedProducts} onSuccess={handleBookingSuccess} onBack={handleBackToServices} />
      </div>
      <div className="checkout-view" hidden={showCustomerForm}>
        <SelectionSummary
          selectedProducts={selectedProducts}
          onRemove={handleRemoveProduct}
          onContinue={handleContinue}
        />
      </div>

      <section className="contact-section" id="contact" aria-labelledby="contact-title">
        <div className="section-heading center">
          <span>{t("Get in touch")}</span>
          <h2 id="contact-title">{t("Contact Hadad")}</h2>
        </div>
        <div className="contact-links">
          {[
            { label: "WhatsApp", value: contactSettings?.whatsappPhone, href: whatsappNumber ? `https://wa.me/${whatsappNumber}` : "", external: true },
            { label: "Call us", value: contactSettings?.contactPhone, href: contactSettings?.contactPhone ? `tel:${contactSettings.contactPhone}` : "" },
            { label: "Facebook", value: contactSettings?.facebookUrl, href: contactSettings?.facebookUrl, external: true },
            { label: "Instagram", value: contactSettings?.instagramUrl, href: contactSettings?.instagramUrl, external: true },
          ].filter(({ value }) => value).map(({ label, value, href, external }) => (
            <div className="contact-card" key={label}>
              <span>{t(label)}</span>
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                {external ? t("Visit our page ↗") : value}
              </a>
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand-mark" href="#top">HADAD<span>.</span></a>
        <span dir="ltr">&copy; 2026 HADAD &middot; Independently owned and operated by Ziad</span>
      </footer>
      </main>
      {whatsappHref && <FloatingWhatsApp href={whatsappHref} label={t("Chat with us on WhatsApp")} />}
      </div>
    </>
  );
}

function FloatingWhatsApp({ href, label }) {
  return <a className="floating-whatsapp" href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>
    <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3.2A12.7 12.7 0 0 0 5.1 22.35L3.4 28.6l6.4-1.68A12.7 12.7 0 1 0 16.04 3.2Zm0 23.2c-2 0-3.96-.54-5.66-1.57l-.4-.24-3.8 1 1.02-3.7-.26-.42A10.5 10.5 0 1 1 16.04 26.4Zm5.77-7.86c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.5-.16-.72.16-.22.33-.83 1.05-1.02 1.27-.18.22-.37.24-.7.08-.32-.16-1.37-.5-2.61-1.6-.97-.86-1.62-1.93-1.81-2.26-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.56.16-.18.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.52-.54-.72-.55h-.62c-.22 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.1 1.32 3.31c.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.24 1.47.2 2.02.12.62-.1 1.9-.78 2.17-1.53.27-.76.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37Z"/></svg>
  </a>;
}

export default Home;
