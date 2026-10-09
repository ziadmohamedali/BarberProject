import { useState } from "react";
import { calculateBookingTotals } from "../../features/auth/bookings/bookingCalculations";
import "./CustomerForm.css";

function CustomerForm({ selectedProducts, contactSettings, onSuccess }) {
  const [form, setForm] = useState({ name: "", whatsapp: "", email: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { total, deposit, remaining } = calculateBookingTotals(selectedProducts);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const validate = () => {
    const newErrors = {};
    const trimmedName = form.name.trim();
    const phoneDigits = form.whatsapp.replace(/\D/g, "");

    if (!trimmedName) {
      newErrors.name = "Name is required.";
    } else if (trimmedName.length > 80) {
      newErrors.name = "Please use 80 characters or fewer.";
    }

    if (!form.whatsapp.trim()) {
      newErrors.whatsapp = "WhatsApp number is required.";
    } else if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      newErrors.whatsapp = "Enter a valid WhatsApp number.";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Enter a valid email.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSuccess({
        customer: { ...form, name: form.name.trim(), whatsapp: form.whatsapp.trim(), email: form.email.trim() },
        products: selectedProducts,
        total,
        deposit,
        remaining,
        paymentStatus: "pending",
        bookingStatus: "pending",
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      setSubmitError(error.message || "We could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="customer-form-section">
      <div className="section-heading">
        <span>Almost There</span>
        <h2>Your Information</h2>
      </div>

      <ul className="checkout-products" aria-label="Selected services">
        {selectedProducts.map((product) => (
          <li key={product.id}>
            <span>{product.title}</span>
            <strong>{product.price} EGP</strong>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            maxLength={80}
            required
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Your full name"
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && <small id="name-error">{errors.name}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp">WhatsApp Number</label>
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
          {errors.whatsapp && <small id="whatsapp-error">{errors.whatsapp}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
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
          {errors.email && <small id="email-error">{errors.email}</small>}
        </div>

        <div className="payment-box">
          <div><span>Services Total</span><strong>{total} EGP</strong></div>
          <div><span>Deposit · paid once</span><strong>{deposit} EGP</strong></div>
          <div><span>Remaining after deposit</span><strong>{remaining} EGP</strong></div>
        </div>

        <p className="payment-note">
          A {deposit} EGP deposit is required per request and is deducted from your total. Pay manually via InstaPay after we contact you on WhatsApp.
        </p>
        {(contactSettings?.instapayAddress || contactSettings?.instapayMobile) && (
          <div className="payment-box payment-instructions">
            <strong>InstaPay payment details</strong>
            {contactSettings.instapayAddress && <div><span>Address / IPA</span><strong>{contactSettings.instapayAddress}</strong></div>}
            {contactSettings.instapayMobile && <div><span>Mobile number</span><strong>{contactSettings.instapayMobile}</strong></div>}
          </div>
        )}

        {submitError && <p className="form-submit-error" role="alert">{submitError}</p>}
        <button className="submit-button" type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Confirm Request"}</button>
      </form>
    </section>
  );
}

export default CustomerForm;
