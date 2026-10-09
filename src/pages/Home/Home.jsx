import { useEffect, useMemo, useRef, useState } from "react";

import CategoryFilter from "../../components/CategoryFilter/CategoryFilter";
import ProductGrid from "../../components/ProductGrid/ProductGrid";
import ProductModal from "../../components/ProductModal/ProductModal";
import SelectionSummary from "../../components/SelectionSummary/SelectionSummary";
import CustomerForm from "../../components/CustomerForm/CustomerForm";

import "./Home.css";

function Home({ theme, onToggleTheme, products, contactSettings, onBookingCreated, onOpenOwnerLogin }) {
  const [activeCategory, setActiveCategory] = useState("haircut");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [openedProduct, setOpenedProduct] = useState(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [submittedBooking, setSubmittedBooking] = useState(null);
  const ownerClickRef = useRef({ count: 0, lastClick: 0, timer: null });

  useEffect(() => () => clearTimeout(ownerClickRef.current.timer), []);

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
    await onBookingCreated(request);
    setCustomerName(booking.customer.name);
    setSubmittedBooking(request);
    setBookingComplete(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const whatsappMessage = submittedBooking && [
    "Hello Hadad,",
    "",
    `Name: ${submittedBooking.customer.name}`,
    `WhatsApp: ${submittedBooking.customer.whatsapp}`,
    `Email: ${submittedBooking.customer.email}`,
    "",
    "Selected Products:",
    ...submittedBooking.products.map((product) => `- ${product.title} — ${product.price} EGP`),
    "",
    `Total: ${submittedBooking.total} EGP`,
    `Deposit: ${submittedBooking.deposit} EGP`,
    `Remaining: ${submittedBooking.remaining} EGP`,
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

  if (bookingComplete) {
    return (
      <main className="success-screen">
        <button className="theme-toggle success-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "White" : "dark"} theme`}>
          {theme === "dark" ? "White" : "Dark"}
        </button>
        <div className="success-content">
          <div className="success-icon">✓</div>
          <span>HADAD</span>
          <h1>Request Received</h1>
          <p className="success-greeting">Thank you{customerName ? `, ${customerName}` : ""}!</p>
          <p>Your request has been received. We will contact you through WhatsApp to confirm your request and manual {submittedBooking.deposit} EGP deposit payment via InstaPay or Vodafone Cash.</p>
          {whatsappHref && <a className="success-whatsapp-link" href={whatsappHref} target="_blank" rel="noreferrer">Continue on WhatsApp</a>}
          <button onClick={() => window.location.assign("/")}>Back to Hadad</button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand-mark" href="#top" aria-label="Hadad home" onClick={handleBrandClick}>HADAD<span>.</span></a>
        <div className="header-actions">
          <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "White" : "dark"} theme`}>
            {theme === "dark" ? "White" : "Dark"}
          </button>
          <nav aria-label="Main navigation">
            <a href="#products">Services</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <span className="eyebrow">INDEPENDENT BARBER · OWNED AND RUN BY HADAD</span>
          <h1>Sharp cuts.<br />Clean style.</h1>
          <p>Premium barbering for gentlemen who want a sharp finish, a relaxed experience, and a look that lasts beyond the chair.</p>
          <div className="hero-actions">
            <a href="#products">Book a service</a>
            <a href="#contact" className="secondary-link">Contact</a>
          </div>
          <ul className="hero-list" aria-label="Barber shop highlights">
            <li>Precision Haircuts</li>
            <li>Beard & Grooming</li>
            <li>Premium Packages</li>
          </ul>
        </div>

        <div className="hero-visual" aria-label="Portrait and service details">
          <div className="hero-photo-card">
            <img src="https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80" alt="Barber finishing a haircut" />
            <div className="floating-badge top">Modern Grooming</div>
            <div className="floating-badge bottom">From 200 EGP</div>
          </div>
        </div>
      </section>

      <section className="products-section" id="products">
        <div className="section-heading center">
          <span>Our Services</span>
          <h2>Choose Your Style</h2>
        </div>
        <CategoryFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        {filteredProducts.length > 0 ? (
          <ProductGrid
            products={filteredProducts}
            selectedProducts={selectedProducts}
            onOpenProduct={setOpenedProduct}
          />
        ) : (
          <p className="empty-services">No {activeCategory === "haircut" ? "haircuts" : "packages"} are available right now.</p>
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
          <CustomerForm selectedProducts={selectedProducts} contactSettings={contactSettings} onSuccess={handleBookingSuccess} />
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
          <span>Get in touch</span>
          <h2 id="contact-title">Contact Hadad</h2>
        </div>
        <div className="contact-links">
          {[
            { label: "WhatsApp", value: contactSettings?.whatsappPhone, href: whatsappNumber ? `https://wa.me/${whatsappNumber}` : "", external: true },
            { label: "Call us", value: contactSettings?.contactPhone, href: contactSettings?.contactPhone ? `tel:${contactSettings.contactPhone}` : "" },
            { label: "Facebook", value: contactSettings?.facebookUrl, href: contactSettings?.facebookUrl, external: true },
            { label: "Instagram", value: contactSettings?.instagramUrl, href: contactSettings?.instagramUrl, external: true },
          ].filter(({ value }) => value).map(({ label, value, href, external }) => (
            <div className="contact-card" key={label}>
              <span>{label}</span>
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                {external ? "Visit our page ↗" : value}
              </a>
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand-mark" href="#top">HADAD<span>.</span></a>
        <span>© 2026 HADAD · Independently owned and operated by Ziad</span>
      </footer>
    </main>
  );
}

export default Home;
