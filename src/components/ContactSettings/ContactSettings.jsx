import { useState } from "react";
import { validateContactSettings } from "../../features/auth/contactSettings/contactSettingsService";
import { useLanguage } from "../../lib/i18n";
import "./ContactSettings.css";

function ContactSettings({ contactSettings, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ ...contactSettings });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSaved(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    let validated;
    try {
      validated = validateContactSettings(form);
    } catch (validationError) {
      setError(t(validationError.message));
      return;
    }

    setSaving(true);
    try {
      const updated = await onSave(validated);
      setForm(updated);
      setSaved(true);
    } catch (saveError) {
      setError(t(saveError.message || "Contact settings could not be saved. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="contact-settings-panel">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">{t("PUBLIC CONTACT DETAILS")}</span>
          <h2>{t("Contact Settings")}</h2>
        </div>
      </div>
      <form className="contact-settings-form" onSubmit={handleSubmit}>
        <label>
          {t("WhatsApp phone number")}
          <input
            type="tel"
            autoComplete="tel"
            required
            value={form.whatsappPhone}
            onChange={(event) => updateField("whatsappPhone", event.target.value)}
            placeholder="+20 100 000 0000"
          />
        </label>
        <label>
          {t("Contact phone number (optional)")}
          <input
            type="tel"
            autoComplete="tel"
            value={form.contactPhone}
            onChange={(event) => updateField("contactPhone", event.target.value)}
            placeholder="+20 100 000 0000"
          />
        </label>
        <label>
          {t("Instagram profile URL (optional)")}
          <input
            type="url"
            value={form.instagramUrl}
            onChange={(event) => updateField("instagramUrl", event.target.value)}
            placeholder="https://instagram.com/your-profile"
          />
        </label>
        <label>
          {t("Facebook profile URL (optional)")}
          <input
            type="url"
            value={form.facebookUrl}
            onChange={(event) => updateField("facebookUrl", event.target.value)}
            placeholder="https://facebook.com/your-page"
          />
        </label>
        <label>
          {t("InstaPay address / IPA (optional)")}
          <input
            type="text"
            maxLength={120}
            value={form.instapayAddress}
            onChange={(event) => updateField("instapayAddress", event.target.value)}
            placeholder={t("Your InstaPay address")}
          />
        </label>
        <label>
          {t("InstaPay mobile number (optional)")}
          <input
            type="tel"
            autoComplete="tel"
            value={form.instapayMobile}
            onChange={(event) => updateField("instapayMobile", event.target.value)}
            placeholder="+20 100 000 0000"
          />
        </label>
        {error && <p className="editor-error contact-settings-message" role="alert">{t(error)}</p>}
        {saved && <p className="password-saved contact-settings-message" role="status">{t("Contact settings saved.")}</p>}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? t("Saving…") : t("Save Changes")}
        </button>
      </form>
    </section>
  );
}

export default ContactSettings;
