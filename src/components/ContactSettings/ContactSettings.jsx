/* eslint-disable react/prop-types -- This project uses JavaScript props without PropTypes. */
import { useEffect, useMemo, useState } from "react";
import { validateContactSettings } from "../../features/auth/contactSettings/contactSettingsService";
import { useLanguage } from "../../lib/i18n";
import "./ContactSettings.css";

function validationField(message) {
  if (message.startsWith("WhatsApp phone")) return "whatsappPhone";
  if (message.startsWith("Contact phone")) return "contactPhone";
  if (message.startsWith("Instagram URL")) return "instagramUrl";
  if (message.startsWith("Facebook URL")) return "facebookUrl";
  if (message.startsWith("InstaPay mobile")) return "instapayMobile";
  if (message.startsWith("InstaPay address")) return "instapayAddress";
  return "";
}

function ContactSettings({ contactSettings, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ ...contactSettings });
  const [savedForm, setSavedForm] = useState({ ...contactSettings });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);

  useEffect(() => {
    if (dirty) return;
    setForm({ ...contactSettings });
    setSavedForm({ ...contactSettings });
    setFieldErrors({});
    setError("");
  }, [contactSettings, dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setError("");
    setSaved(false);
  };

  const handleCancel = () => {
    if (dirty && !window.confirm(t("Discard unsaved contact settings?"))) return;
    setForm({ ...savedForm });
    setFieldErrors({});
    setError("");
    setSaved(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setSaved(false);
    let validated;
    try {
      validated = validateContactSettings(form);
    } catch (validationError) {
      const field = validationField(validationError.message);
      if (field) setFieldErrors({ [field]: t(validationError.message) });
      setError(t(validationError.message));
      return;
    }

    setSaving(true);
    try {
      const updated = await onSave(validated);
      setForm(updated);
      setSavedForm(updated);
      setSaved(true);
    } catch {
      setError(t("Contact settings could not be saved. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const publicItems = [
    form.whatsappPhone && { label: t("WhatsApp"), value: form.whatsappPhone },
    form.contactPhone && { label: t("Call us"), value: form.contactPhone },
    form.instagramUrl && { label: t("Instagram"), value: form.instagramUrl },
    form.facebookUrl && { label: t("Facebook"), value: form.facebookUrl },
  ].filter(Boolean);

  const renderField = ({ id, label, type = "text", value, placeholder, hint, maxLength, autoComplete, required = false, dir }) => (
    <label className={`contact-field${fieldErrors[id] ? " has-error" : ""}`} htmlFor={`contact-${id}`} key={id}>
      <span className="contact-field-label">
        {t(label)}
        {required ? <em>{t("Required")}</em> : <em className="optional">{t("Optional")}</em>}
      </span>
      <input
        id={`contact-${id}`}
        name={id}
        type={type}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        value={value || ""}
        onChange={(event) => updateField(id, event.target.value)}
        placeholder={placeholder ? t(placeholder) : undefined}
        dir={dir}
        aria-invalid={Boolean(fieldErrors[id])}
        aria-describedby={fieldErrors[id] ? `contact-${id}-error` : hint ? `contact-${id}-hint` : undefined}
      />
      {fieldErrors[id] ? <small className="contact-field-error" id={`contact-${id}-error`}>{fieldErrors[id]}</small> : hint ? <small className="contact-field-hint" id={`contact-${id}-hint`}>{t(hint)}</small> : null}
    </label>
  );

  return (
    <section className="contact-settings-panel" aria-labelledby="contact-settings-title">
      <div className="contact-settings-heading">
        <div>
          <span className="eyebrow">{t("PUBLIC CONTACT DETAILS")}</span>
          <h2 id="contact-settings-title">{t("Contact Settings")}</h2>
          <p>{t("Manage the contact and payment information used by your customers.")}</p>
        </div>
        {dirty && <span className="contact-unsaved-indicator" role="status">{t("Unsaved changes")}</span>}
      </div>

      <div className="contact-settings-layout">
        <form className="contact-settings-form" noValidate onSubmit={handleSubmit}>
          <section className="contact-settings-group" aria-labelledby="contact-group-title">
            <div className="contact-group-heading">
              <h3 id="contact-group-title">{t("Contact Information")}</h3>
              <p>{t("Ways customers can reach the shop directly.")}</p>
            </div>
            <div className="contact-field-grid">
              {renderField({ id: "whatsappPhone", label: "WhatsApp phone number", type: "tel", value: form.whatsappPhone, placeholder: "+20 100 000 0000", autoComplete: "tel", required: true, hint: "Required for customer booking follow-up." })}
              {renderField({ id: "contactPhone", label: "Contact phone number", type: "tel", value: form.contactPhone, placeholder: "+20 100 000 0000", autoComplete: "tel" })}
            </div>
          </section>

          <section className="contact-settings-group" aria-labelledby="social-group-title">
            <div className="contact-group-heading">
              <h3 id="social-group-title">{t("Social Links")}</h3>
              <p>{t("Share the shop’s official social profiles.")}</p>
            </div>
            <div className="contact-field-grid">
              {renderField({ id: "instagramUrl", label: "Instagram profile URL", type: "url", value: form.instagramUrl, placeholder: "https://instagram.com/your-profile", dir: "ltr" })}
              {renderField({ id: "facebookUrl", label: "Facebook profile URL", type: "url", value: form.facebookUrl, placeholder: "https://facebook.com/your-page", dir: "ltr" })}
            </div>
          </section>

          <section className="contact-settings-group" aria-labelledby="payment-group-title">
            <div className="contact-group-heading">
              <h3 id="payment-group-title">{t("Payment Details")}</h3>
              <p>{t("Optional InstaPay details used when arranging a deposit.")}</p>
            </div>
            <div className="contact-field-grid">
              {renderField({ id: "instapayAddress", label: "InstaPay address / IPA", value: form.instapayAddress, placeholder: "Your InstaPay address", maxLength: 120, dir: "ltr", hint: "Maximum 120 characters." })}
              {renderField({ id: "instapayMobile", label: "InstaPay mobile number", type: "tel", value: form.instapayMobile, placeholder: "+20 100 000 0000", autoComplete: "tel", dir: "ltr" })}
            </div>
          </section>

          {error && <p className="editor-error contact-settings-message" role="alert">{error}</p>}
          {saved && <p className="password-saved contact-settings-message" role="status">{t("Contact settings saved.")}</p>}
          <div className="contact-settings-actions">
            <button className="primary-button" type="submit" disabled={saving || !dirty}>
              {saving ? t("Saving…") : t("Save Changes")}
            </button>
            <button className="contact-cancel-button" type="button" onClick={handleCancel} disabled={saving || !dirty}>{t("Cancel")}</button>
          </div>
        </form>

        <aside className="contact-live-preview" aria-label={t("Public website preview")}>
          <div className="contact-preview-heading">
            <span>{t("LIVE PREVIEW")}</span>
            <h3>{t("Public contact details")}</h3>
            <p>{t("A preview of the contact links customers see on the website.")}</p>
          </div>
          {publicItems.length ? (
            <ul>
              {publicItems.map((item) => <li key={item.label}><span>{item.label}</span><strong dir="auto">{item.value}</strong></li>)}
            </ul>
          ) : <p className="contact-preview-empty">{t("No public contact details have been added yet.")}</p>}
        </aside>
      </div>
    </section>
  );
}

export default ContactSettings;
