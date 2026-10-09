import { useRef, useState } from "react";
import { calculateBookingTotals } from "../../features/auth/bookings/bookingCalculations";
import { getAppointmentErrorMessage } from "../../features/auth/bookings/bookingService";
import { useLanguage } from "../../lib/i18n";
import "./CustomerForm.css";

const PENDING_APPOINTMENT_KEY = "hadad-pending-appointment";

function makeRequestCredentials(signature) {
  const storedRequest = window.localStorage.getItem(PENDING_APPOINTMENT_KEY);
  let previous = null;
  if (storedRequest) {
    try {
      previous = JSON.parse(storedRequest);
    } catch {
      window.localStorage.removeItem(PENDING_APPOINTMENT_KEY);
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
  window.localStorage.setItem(PENDING_APPOINTMENT_KEY, JSON.stringify(request));
  return request;
}

function CustomerForm({ selectedProducts, onSuccess }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", whatsapp: "", email: "", notes: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const { total } = calculateBookingTotals(selectedProducts);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const validate = () => {
    const newErrors = {};
    const trimmedName = form.name.trim();
    const phoneDigits = form.whatsapp.replace(/\D/g, "");

    if (!trimmedName) {
      newErrors.name = t("Name is required.");
    } else if (trimmedName.length > 80) {
      newErrors.name = t("Please use 80 characters or fewer.");
    }

    if (!form.whatsapp.trim()) {
      newErrors.whatsapp = t("WhatsApp number is required.");
    } else if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      newErrors.whatsapp = t("Enter a valid WhatsApp number.");
    }

    if (!form.email.trim()) {
      newErrors.email = t("Email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = t("Enter a valid email.");
    }

    if (selectedProducts.length === 0) {
      newErrors.products = t("Select at least one service.");
    }
    if (form.notes.length > 1000) {
      newErrors.notes = t("Notes must be 1000 characters or fewer.");
    }

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
      setSubmitError(t(getAppointmentErrorMessage(error, "We could not submit your request. Please try again.")));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="customer-form-section">
      <div className="section-heading">
        <span>{t("Almost There")}</span>
        <h2>{t("Your Information")}</h2>
      </div>

      <ul className="checkout-products" aria-label={t("Selected services")}>
        {selectedProducts.map((product) => (
          <li key={product.id}>
            <span>{product.title}</span>
            <strong>{product.price} {t("EGP")}</strong>
          </li>
        ))}
      </ul>
      {errors.products && <p className="form-submit-error" role="alert">{t(errors.products)}</p>}

      <form noValidate onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">{t("Name")}</label>
          <input
            id="name"
            name="name"
            maxLength={80}
            required
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            placeholder={t("Your full name")}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && <small id="name-error">{t(errors.name)}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp">{t("WhatsApp Number")}</label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            required
            value={form.whatsapp}
            onChange={handleChange}
            placeholder="01xxxxxxxxx"
            aria-describedby={errors.whatsapp ? "whatsapp-error" : undefined}
          />
          {errors.whatsapp && <small id="whatsapp-error">{t(errors.whatsapp)}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="email">{t("Email")}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && <small id="email-error">{t(errors.email)}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="appointment-notes">{t("Notes (optional)")}</label>
          <textarea
            id="appointment-notes"
            name="notes"
            maxLength={1000}
            rows={3}
            value={form.notes}
            onChange={handleChange}
            placeholder={t("Anything we should know before your appointment?")}
          />
          {errors.notes && <small>{t(errors.notes)}</small>}
        </div>

        <div className="payment-box">
          <div><span>{t("Services Total")}</span><strong>{total} {t("EGP")}</strong></div>
        </div>

        <p className="payment-note">{t("Your request has been received. We will contact you through WhatsApp to confirm availability and provide deposit payment instructions. No payment is required now.")}</p>

        {submitError && <p className="form-submit-error" role="alert">{t(submitError)}</p>}
        <button className="submit-button" type="submit" disabled={submitting}>{submitting ? t("Submitting…") : t("Confirm Request")}</button>
      </form>
    </section>
  );
}

export default CustomerForm;
