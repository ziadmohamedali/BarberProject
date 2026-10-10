/* eslint-disable react/prop-types -- This project uses JavaScript props without PropTypes. */
import { useRef, useState } from "react";
import { calculateBookingTotals } from "../../features/auth/bookings/bookingCalculations";
import { getAppointmentErrorMessage } from "../../features/auth/bookings/bookingService";
import { useLanguage } from "../../lib/i18n";
import "./CustomerForm.css";

const PENDING_APPOINTMENT_KEY = "hadad-pending-appointment";

function makeRequestCredentials(signature) {
  const storedRequest = window.sessionStorage.getItem(PENDING_APPOINTMENT_KEY);
  let previous = null;
  if (storedRequest) {
    try {
      previous = JSON.parse(storedRequest);
    } catch {
      window.sessionStorage.removeItem(PENDING_APPOINTMENT_KEY);
    }
  }
  if (
    previous?.signature === signature
    && typeof previous.idempotencyKey === "string"
    && /^[0-9a-f]{64}$/.test(previous.confirmationToken)
  ) return previous;

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const request = {
    signature,
    idempotencyKey: window.crypto.randomUUID(),
    confirmationToken: [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
  window.sessionStorage.setItem(PENDING_APPOINTMENT_KEY, JSON.stringify(request));
  return request;
}

function CustomerForm({ selectedProducts, onSuccess, onBack }) {
  const { language, t } = useLanguage();
  const [form, setForm] = useState({ name: "", whatsapp: "", email: "", notes: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const { total, deposit, remaining } = calculateBookingTotals(selectedProducts);
  const duration = selectedProducts.reduce((sum, product) => sum + (Number(product.duration) || 0), 0);
  const hasCompleteDuration = selectedProducts.length > 0 && selectedProducts.every((product) => Number(product.duration) > 0);
  const formatPrice = (amount) => new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG").format(amount);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    const trimmedName = form.name.trim();
    const phoneDigits = form.whatsapp.replace(/\D/g, "");

    if (!trimmedName) newErrors.name = t("Name is required.");
    else if (trimmedName.length > 80) newErrors.name = t("Please use 80 characters or fewer.");

    if (!form.whatsapp.trim()) newErrors.whatsapp = t("WhatsApp number is required.");
    else if (phoneDigits.length < 8 || phoneDigits.length > 15) newErrors.whatsapp = t("Enter a valid WhatsApp number.");

    if (!form.email.trim()) newErrors.email = t("Email is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = t("Enter a valid email.");

    if (selectedProducts.length === 0) newErrors.products = t("Select at least one service.");
    if (total < deposit) newErrors.products = t("Add services worth at least {deposit} EGP to continue.", { deposit });
    if (form.notes.length > 1000) newErrors.notes = t("Notes must be 1000 characters or fewer.");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setSubmitError("");
    if (!validate()) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const signature = JSON.stringify({
        name: form.name.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
        productIds: selectedProducts.map((product) => product.id),
      });
      const credentials = makeRequestCredentials(signature);
      await onSuccess({
        customer: { ...form, name: form.name.trim(), whatsapp: form.whatsapp.trim(), email: form.email.trim() },
        products: selectedProducts,
        notes: form.notes.trim(),
        idempotencyKey: credentials.idempotencyKey,
        confirmationToken: credentials.confirmationToken,
      });
    } catch (error) {
      const message = getAppointmentErrorMessage(error, "We could not submit your request. Please try again.");
      const safeMessages = [
        "Network request failed. Check your internet connection and try again.",
        "The selected services are invalid. Refresh and select them again.",
        "Selected services are invalid.",
        "One or more selected services are unavailable.",
        "Selected services total is below the deposit minimum.",
        "The booking request could not be verified.",
      ];
      setSubmitError(t(safeMessages.includes(message) ? message : "We could not submit your request. Please try again."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="customer-form-section" aria-labelledby="checkout-title">
      <div className="checkout-heading-row">
        <div className="section-heading">
          <span>{t("Almost There")}</span>
          <h2 id="checkout-title">{t("Complete your request")}</h2>
          <p>{t("Share your details and we will contact you to confirm availability.")}</p>
        </div>
        <button className="checkout-back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">{language === "ar" ? "→" : "←"}</span>
          {t("Back to services")}
        </button>
      </div>

      <ol className="checkout-progress" aria-label={t("Booking steps")}>
        <li className="complete"><span>1</span>{t("Choose services")}</li>
        <li className="current" aria-current="step"><span>2</span>{t("Your details")}</li>
        <li><span>3</span>{t("Request received")}</li>
      </ol>

      <div className="checkout-layout">
        <form className="checkout-form-card" noValidate onSubmit={handleSubmit}>
          <div className="checkout-card-heading">
            <span className="checkout-step-number">02</span>
            <div>
              <h3>{t("Customer details")}</h3>
              <p>{t("We will use these details to follow up about your appointment.")}</p>
            </div>
          </div>

          <div className="checkout-fields">
            <div className={`form-group${errors.name ? " has-error" : ""}`}>
              <label htmlFor="name">{t("Name")} <span aria-hidden="true">*</span></label>
              <input id="name" name="name" maxLength={80} required autoComplete="name" value={form.name} onChange={handleChange} placeholder={t("Your full name")} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} />
              {errors.name && <small id="name-error" role="alert">{errors.name}</small>}
            </div>

            <div className={`form-group${errors.whatsapp ? " has-error" : ""}`}>
              <label htmlFor="whatsapp">{t("WhatsApp Number")} <span aria-hidden="true">*</span></label>
              <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" required value={form.whatsapp} onChange={handleChange} placeholder="01xxxxxxxxx" aria-invalid={Boolean(errors.whatsapp)} aria-describedby={errors.whatsapp ? "whatsapp-error" : "whatsapp-hint"} />
              {errors.whatsapp ? <small id="whatsapp-error" role="alert">{errors.whatsapp}</small> : <small className="field-hint" id="whatsapp-hint">{t("Use a number where we can reach you on WhatsApp.")}</small>}
            </div>

            <div className={`form-group${errors.email ? " has-error" : ""}`}>
              <label htmlFor="email">{t("Email")} <span aria-hidden="true">*</span></label>
              <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={handleChange} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
              {errors.email && <small id="email-error" role="alert">{errors.email}</small>}
            </div>

            <div className={`form-group checkout-notes${errors.notes ? " has-error" : ""}`}>
              <label htmlFor="appointment-notes">{t("Notes (optional)")}</label>
              <textarea id="appointment-notes" name="notes" maxLength={1000} rows={4} value={form.notes} onChange={handleChange} placeholder={t("Anything we should know before your appointment?")} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? "notes-error" : undefined} />
              {errors.notes && <small id="notes-error" role="alert">{errors.notes}</small>}
            </div>
          </div>
          {errors.products && <p className="form-submit-error" role="alert">{errors.products}</p>}
          {submitError && <p className="form-submit-error" role="alert">{submitError}</p>}
          <div className="checkout-submit-row">
            <p>{t("No payment is taken with this request.")}</p>
            <button className="submit-button" type="submit" disabled={submitting || selectedProducts.length === 0 || total < deposit}>
              {submitting ? <><span className="checkout-spinner" aria-hidden="true" />{t("Submitting…")}</> : t("Send booking request")}
            </button>
          </div>
        </form>

        <aside className="checkout-summary-card" aria-label={t("Booking summary")}>
          <div className="checkout-summary-heading">
            <div>
              <span>{t("Your Selection")}</span>
              <h3>{t("Booking summary")}</h3>
            </div>
            <span className="checkout-count">{selectedProducts.length}</span>
          </div>
          <ul className="checkout-products" aria-label={t("Selected services")}>
            {selectedProducts.map((product) => (
              <li key={product.id}>
                {product.picture ? <img src={product.picture} alt="" /> : <span className="checkout-image-placeholder" aria-hidden="true">H</span>}
                <span className="checkout-product-copy">
                  <strong>{product.title}</strong>
                  {Number(product.duration) > 0 && <small>{t("{duration} min", { duration: product.duration })}</small>}
                </span>
                <strong className="checkout-product-price">{formatPrice(Number(product.price) || 0)} <small>{t("EGP")}</small></strong>
              </li>
            ))}
          </ul>

          {hasCompleteDuration && <div className="checkout-duration"><span>{t("Estimated service time")}</span><strong>{t("{duration} min", { duration })}</strong></div>}
          <div className="checkout-price-breakdown">
            <div><span>{t("Services subtotal")}</span><strong>{formatPrice(total)} {t("EGP")}</strong></div>
            <div><span>{t("Required deposit")}</span><strong>{formatPrice(deposit)} {t("EGP")}</strong></div>
            <div className="checkout-balance"><span>{t("Remaining after deposit")}</span><strong>{formatPrice(Math.max(0, remaining))} {t("EGP")}</strong></div>
          </div>
          <div className="checkout-deposit-note">
            <span className="checkout-info-mark" aria-hidden="true">i</span>
            <p>{t("The deposit is arranged after we confirm availability. Our team will send payment instructions through WhatsApp; payment is verified by HADAD.")}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default CustomerForm;
