import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CategoryFilter from "../../components/CategoryFilter/CategoryFilter";
import ProductGrid from "../../components/ProductGrid/ProductGrid";
import ProductModal from "../../components/ProductModal/ProductModal";
import SelectionSummary from "../../components/SelectionSummary/SelectionSummary";
import CustomerForm from "../../components/CustomerForm/CustomerForm";
import NavigationSidebar from "../../components/NavigationSidebar/NavigationSidebar";
import { getAppointmentConfirmation, getAppointmentErrorMessage } from "../../features/auth/bookings/bookingService";
import { useLanguage } from "../../lib/i18n";

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

function Home({ theme, onToggleTheme, products, contactSettings, onBookingCreated, onOpenOwnerLogin }) {
  const { language, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState("haircut");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [openedProduct, setOpenedProduct] = useState(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [activeNavigation, setActiveNavigation] = useState("home");
  const ownerClickRef = useRef({ count: 0, lastClick: 0, timer: null });

  useEffect(() => () => clearTimeout(ownerClickRef.current.timer), []);

  const restoreConfirmation = useCallback(async () => {
    const reference = new URLSearchParams(window.location.search).get("booking");
    if (!reference) return;
    setConfirmationLoading(true);
    setConfirmationError("");
    try {
      const token = window.localStorage.getItem(`hadad-confirmation-${reference}`);
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
    setTimeout(() => {
      document.getElementById("customer-form")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const handleBookingSuccess = async (booking) => {
    const request = {
      ...booking,
      products: selectedProducts.map(({ id, title, price }) => ({ productId: id, title, price })),
    };
    const savedAppointment = await onBookingCreated(request);
    try {
      window.localStorage.setItem(`hadad-confirmation-${savedAppointment.reference}`, booking.confirmationToken);
      window.localStorage.removeItem("hadad-pending-appointment");
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
    ...submittedBooking.services.map((service) => `${service.title} — ${service.price} ${t("EGP")}`),
    `${t("Deposit:")} ${submittedBooking.deposit} ${t("EGP")}`,
  ].join("\n");
  const whatsappDigits = String(contactSettings?.whatsappPhone || "").replace(/\D/g, "");
  const whatsappNumber = whatsappDigits.startsWith("00")
    ? whatsappDigits.slice(2)
    : whatsappDigits.startsWith("0")
      ? `20${whatsappDigits.slice(1)}`
      : whatsappDigits;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage || "")}`
    : "";

  if (confirmationLoading) {
    return <main className="success-screen"><div className="success-content"><span>HADAD</span><p>{t("Verifying your appointment…")}</p></div></main>;
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
        />
        <div className="public-main">
        <main className="success-screen">
        <div className="success-content">
          <div className="success-icon">✓</div>
          <span>HADAD</span>
          <h1>{t("Request Received")}</h1>
          <p className="success-greeting">{t("Thank you{suffix}!", { suffix: submittedBooking.customerName ? `${language === "ar" ? "، " : ", "}${submittedBooking.customerName}` : "" })}</p>
          <div className="appointment-confirmation-details">
            <p><strong>{t("Booking reference:")}</strong> {submittedBooking.reference}</p>
            <p><strong>{t("Service:")}</strong> {submittedBooking.services.map((service) => service.title).join(", ")}</p>
            <p><strong>{t("Total:")}</strong> {submittedBooking.total} {t("EGP")}</p>
            <p><strong>{t("Deposit:")}</strong> {submittedBooking.deposit} {t("EGP")} · {t(depositStatusLabel(submittedBooking.depositStatus))}</p>
          </div>
          <p><strong>{t("Booking status")}:</strong> {t(bookingStatusLabel(submittedBooking.bookingStatus))}</p>
          <p>{t("Your request has been received. We will contact you through WhatsApp to confirm availability and provide deposit payment instructions. No payment is required now.")}</p>
          {whatsappHref && <a className="success-whatsapp-link" href={whatsappHref} target="_blank" rel="noreferrer">{t("Continue on WhatsApp")}</a>}
          <button onClick={() => window.location.assign("/")}>{t("Back to Hadad")}</button>
        </div>
        </main>
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
      />
      <div className="public-main">
      <main>
      <section className="hero" id="top">
        <div className="hero-content" id="about">
          <span className="eyebrow">{t("INDEPENDENT BARBER · OWNED AND RUN BY HADAD")}</span>
          <h1>{t("Sharp cuts.")}<br />{t("Clean style.")}</h1>
          <p>{t("Premium barbering for gentlemen who want a sharp finish, a relaxed experience, and a look that lasts beyond the chair.")}</p>
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
            <img src="https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80" alt={t("Barber finishing a haircut")} />
            <div className="floating-badge top">{t("Modern Grooming")}</div>
            <div className="floating-badge bottom">{t("From 200 EGP")}</div>
          </div>
        </div>
      </section>

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

      {showCustomerForm && selectedProducts.length > 0 ? (
        <div id="customer-form">
          <CustomerForm selectedProducts={selectedProducts} onSuccess={handleBookingSuccess} />
        </div>
      ) : (
        <SelectionSummary
          selectedProducts={selectedProducts}
          onRemove={handleRemoveProduct}
          onContinue={handleContinue}
        />
      )}

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
        <span>{t("© 2026 HADAD · Independently owned and operated by Ziad")}</span>
      </footer>
      </main>
      </div>
    </>
  );
}

export default Home;
