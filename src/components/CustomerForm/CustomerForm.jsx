/* eslint-disable react/prop-types -- This project uses JavaScript props without PropTypes. */
import { useEffect, useRef, useState } from "react";
import { calculateBookingTotals } from "../../features/auth/bookings/bookingCalculations";
import { DEFAULT_WORKING_HOURS, getAvailableTimeSlots, toLocalDateTimeValue } from "../../features/auth/bookings/workingHours";
import { buildWhatsAppBookingMessage, buildWhatsAppBookingUrl } from "../../features/auth/bookings/whatsappBooking";
import { getArabicTranslation } from "../../i18n";
import { useLanguage } from "../../lib/i18n";
import "./CustomerForm.css";

const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDateKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

function CustomerForm({ selectedProducts, whatsappNumber, onBack, workingHours = DEFAULT_WORKING_HOURS, onRefreshWorkingHours }) {
  const { language, t } = useLanguage();
  const [form, setForm] = useState({ name: "", whatsapp: "", notes: "", preferredDateTime: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [clock, setClock] = useState(() => new Date());
  const [refreshedWorkingHours, setRefreshedWorkingHours] = useState(null);

  const { total } = calculateBookingTotals(selectedProducts);
  const duration = selectedProducts.reduce((sum, product) => sum + (Number(product.duration) || 0), 0);
  const hasCompleteDuration = selectedProducts.length > 0 && selectedProducts.every((product) => Number(product.duration) > 0);
  const formatPrice = (amount) => new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG").format(amount);
  const now = clock;
  const maximumAppointment = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const selectedDate = selectedDateKey ? parseDateKey(selectedDateKey) : null;
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const activeWorkingHours = refreshedWorkingHours || workingHours;
  const availableTimeSlots = selectedDateKey
    ? getAvailableTimeSlots(selectedDateKey, activeWorkingHours.openingTime, activeWorkingHours.closingTime, now, maximumAppointment)
    : [];
  const selectedAppointmentDate = form.preferredDateTime.length === 16
    ? new Date(form.preferredDateTime)
    : null;
  const locale = language === "ar" ? "ar-EG" : "en-EG";
  const firstWeekday = language === "ar" ? 6 : 0;
  const calendarStartOffset = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() - firstWeekday + 7) % 7;
  const calendarDays = Array.from({ length: new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate() }, (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1));
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const dayIndex = (firstWeekday + index) % 7;
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 7 + dayIndex));
  });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(visibleMonth);
  const dateFormatter = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setRefreshedWorkingHours(null);
  }, [workingHours.openingTime, workingHours.closingTime]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  const chooseAppointmentDate = (date) => {
    const dateKey = localDateKey(date);
    setSelectedDateKey(dateKey);
    setForm((current) => ({ ...current, preferredDateTime: `${dateKey}T` }));
    setErrors((current) => ({ ...current, preferredDateTime: "" }));
  };

  const chooseAppointmentTime = (slot) => {
    if (slot < new Date()) {
      setClock(new Date());
      return;
    }
    setForm((current) => ({ ...current, preferredDateTime: toLocalDateTimeValue(slot) }));
    setErrors((current) => ({ ...current, preferredDateTime: "" }));
  };

  const changeVisibleMonth = (offset) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };
  const earliestMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const latestMonth = new Date(maximumAppointment.getFullYear(), maximumAppointment.getMonth(), 1);
  const canGoPrevious = visibleMonth > earliestMonth;
  const canGoNext = visibleMonth < latestMonth;

  const validate = (hours = activeWorkingHours) => {
    const newErrors = {};
    const trimmedName = form.name.trim();
    const phoneDigits = form.whatsapp.replace(/\D/g, "");
    const validationNow = new Date();
    const validationMaximum = new Date(validationNow.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (!trimmedName) newErrors.name = t("Name is required.");
    else if (trimmedName.length > 80) newErrors.name = t("Please use 80 characters or fewer.");

    if (!form.whatsapp.trim()) newErrors.whatsapp = t("WhatsApp number is required.");
    else if (phoneDigits.length < 8 || phoneDigits.length > 15) newErrors.whatsapp = t("Enter a valid WhatsApp number.");

    if (selectedProducts.length === 0) newErrors.products = t("Select at least one service.");
    if (form.notes.length > 1000) newErrors.notes = t("Notes must be 1000 characters or fewer.");
    const validTimeSlots = selectedDateKey
      ? getAvailableTimeSlots(selectedDateKey, hours.openingTime, hours.closingTime, validationNow, validationMaximum)
      : [];
    if (!form.preferredDateTime || !validTimeSlots.some((slot) => toLocalDateTimeValue(slot) === form.preferredDateTime)) {
      newErrors.preferredDateTime = t("Choose a valid 30-minute time within shop hours. If no times remain, select another date.");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setSubmitError("");
    if (!validate()) return;
    if (!whatsappNumber) {
      setSubmitError(t("WhatsApp number is not configured."));
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    let whatsappWindow;
    let openedWhatsApp = false;
    let refreshingHours = false;
    try {
      whatsappWindow = window.open("about:blank", "_blank");
      if (!whatsappWindow) {
        setSubmitError(t("Allow pop-ups to continue to WhatsApp."));
        return;
      }
      whatsappWindow.opener = null;

      let currentWorkingHours = activeWorkingHours;
      if (onRefreshWorkingHours) {
        refreshingHours = true;
        currentWorkingHours = await onRefreshWorkingHours();
        refreshingHours = false;
        setRefreshedWorkingHours(currentWorkingHours);
      }
      const latestSlots = selectedDateKey
        ? getAvailableTimeSlots(
          selectedDateKey,
          currentWorkingHours.openingTime,
          currentWorkingHours.closingTime,
          new Date(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        )
        : [];
      if (form.preferredDateTime && !latestSlots.some((slot) => toLocalDateTimeValue(slot) === form.preferredDateTime)) {
        setForm((current) => ({ ...current, preferredDateTime: "" }));
      }
      if (!validate(currentWorkingHours)) return;

      const message = buildWhatsAppBookingMessage({
        name: form.name,
        phone: form.whatsapp,
        preferredDateTime: form.preferredDateTime,
        services: selectedProducts.map((product) => ({
          title: getArabicTranslation(product.title),
          price: product.price,
        })),
        total,
        notes: form.notes,
      });
      whatsappWindow.location.href = buildWhatsAppBookingUrl(whatsappNumber, message);
      openedWhatsApp = true;
    } catch {
      if (refreshingHours) {
        setSubmitError(t("Could not verify the shop's current working hours. Please try again."));
        return;
      }
      setSubmitError(t("Could not open WhatsApp. Please try again."));
    } finally {
      if (whatsappWindow && !openedWhatsApp) whatsappWindow.close();
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
          <p>{t("Your details will be prepared in a WhatsApp message for you to review and send.")}</p>
        </div>
        <button className="checkout-back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">{language === "ar" ? "→" : "←"}</span>
          {t("Back to services")}
        </button>
      </div>

      <ol className="checkout-progress" aria-label={t("Booking steps")}>
        <li className="complete"><span>1</span>{t("Choose services")}</li>
        <li className="current" aria-current="step"><span>2</span>{t("Your details")}</li>
      </ol>

      <div className="checkout-layout">
        <form className="checkout-form-card" noValidate onSubmit={handleSubmit}>
          <div className="checkout-card-heading">
            <span className="checkout-step-number">02</span>
            <div>
              <h3>{t("Customer details")}</h3>
              <p>{t("These details will be included in your WhatsApp message.")}</p>
            </div>
          </div>

          <div className="checkout-fields">
            <div className={`form-group checkout-date-field${errors.preferredDateTime ? " has-error" : ""}`}>
              <label htmlFor="preferred-appointment-date">{t("Preferred appointment date and time")} <span aria-hidden="true">*</span></label>
              <div className={`appointment-picker${errors.preferredDateTime ? " is-invalid" : ""}`} aria-describedby={errors.preferredDateTime ? "preferred-date-error" : "preferred-date-hint"}>
                <div className="appointment-picker-calendar">
                  <div className="appointment-calendar-heading">
                    <strong>{monthLabel}</strong>
                    <div className="appointment-calendar-navigation">
                      <button type="button" onClick={() => changeVisibleMonth(-1)} disabled={!canGoPrevious} aria-label={t("Previous month")}>{language === "ar" ? "›" : "‹"}</button>
                      <button type="button" onClick={() => changeVisibleMonth(1)} disabled={!canGoNext} aria-label={t("Next month")}>{language === "ar" ? "‹" : "›"}</button>
                    </div>
                  </div>
                  <div className="appointment-calendar-grid" role="group" aria-label={t("Choose a preferred date")}>
                    {weekdayLabels.map((weekday, index) => <span className="appointment-weekday" key={`${weekday}-${index}`}>{weekday}</span>)}
                    {Array.from({ length: calendarStartOffset }, (_, index) => <span className="appointment-calendar-blank" key={`blank-${index}`} aria-hidden="true" />)}
                    {calendarDays.map((date) => {
                      const dateKey = localDateKey(date);
                      const disabled = dateKey < localDateKey(now) || dateKey > localDateKey(maximumAppointment);
                      const selected = dateKey === selectedDateKey;
                      return <button key={dateKey} type="button" className={`appointment-day${selected ? " is-selected" : ""}`} disabled={disabled} aria-pressed={selected} aria-label={dateFormatter.format(date)} onClick={() => chooseAppointmentDate(date)}>{new Intl.NumberFormat(locale, { useGrouping: false }).format(date.getDate())}</button>;
                    })}
                  </div>
                  <p className="appointment-picker-hint">{t("Choose a preferred time. The owner will confirm availability.")}</p>
                </div>
                <div className="appointment-picker-times">
                  <div className="appointment-time-heading">
                    <strong>{selectedDate ? dateFormatter.format(selectedDate) : t("Choose a date first")}</strong>
                    <span>{t("Choose a time within shop hours.")}</span>
                  </div>
                  {!selectedDateKey ? <p className="appointment-time-empty">{t("Select a date to view time choices.")}</p> : availableTimeSlots.length === 0 ? (
                    <p className="appointment-time-empty">{t("No valid times remain for this date. Please select another date.")}</p>
                  ) : (
                    <div className="appointment-time-controls">
                      <span className="appointment-options-label">{t("Available times · 30-minute intervals")}</span>
                      <div className="appointment-minute-grid" role="group" aria-label={t("Available appointment times")}>
                        {availableTimeSlots.map((slot) => {
                          const slotValue = toLocalDateTimeValue(slot);
                          const selected = form.preferredDateTime === slotValue;
                          return <button key={slotValue} type="button" className={`appointment-time-slot${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={() => chooseAppointmentTime(slot)}>{timeFormatter.format(slot)}</button>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {selectedAppointmentDate && <div className="appointment-selection" aria-live="polite"><span aria-hidden="true">✓</span><span>{t("Your preferred time")}</span><strong>{dateFormatter.format(selectedAppointmentDate)} · {timeFormatter.format(selectedAppointmentDate)}</strong></div>}
              </div>
              {errors.preferredDateTime ? <small id="preferred-date-error" role="alert">{errors.preferredDateTime}</small> : <small id="preferred-date-hint" className="field-hint">{t("This is your preferred time, not a confirmed appointment. Choose a time in 30-minute steps during shop hours.")}</small>}
            </div>
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

            <div className={`form-group checkout-notes${errors.notes ? " has-error" : ""}`}>
              <label htmlFor="appointment-notes">{t("Notes (optional)")}</label>
              <textarea id="appointment-notes" name="notes" maxLength={1000} rows={4} value={form.notes} onChange={handleChange} placeholder={t("Anything we should know before your appointment?")} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? "notes-error" : undefined} />
              {errors.notes && <small id="notes-error" role="alert">{errors.notes}</small>}
            </div>
          </div>
          {errors.products && <p className="form-submit-error" role="alert">{errors.products}</p>}
          {submitError && <p className="form-submit-error" role="alert">{submitError}</p>}
          <div className="checkout-submit-row">
            <p>{t("WhatsApp opens with your message ready to review. You must tap Send.")}</p>
            <button className="submit-button" type="submit" disabled={submitting || selectedProducts.length === 0}>
              {submitting ? <><span className="checkout-spinner" aria-hidden="true" />{t("Opening WhatsApp…")}</> : t("Continue to WhatsApp")}
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
            <div><span>{t("Total")}</span><strong>{formatPrice(total)} {t("EGP")}</strong></div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default CustomerForm;
