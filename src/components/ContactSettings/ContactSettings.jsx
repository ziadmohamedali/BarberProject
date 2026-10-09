import { useState } from "react";
import { validateContactSettings } from "../../features/auth/contactSettings/contactSettingsService";
import "./ContactSettings.css";

function ContactSettings({ contactSettings, onSave }) {
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
      setError(validationError.message);
      return;
    }

    setSaving(true);
    try {
      const updated = await onSave(validated);
      setForm(updated);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || "Contact settings could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="contact-settings-panel">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">PUBLIC CONTACT DETAILS</span>
          <h2>Contact Settings</h2>
        </div>
      </div>
      <form className="contact-settings-form" onSubmit={handleSubmit}>
        <label>
          WhatsApp phone number
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
          Contact phone number (optional)
          <input
            type="tel"
            autoComplete="tel"
            value={form.contactPhone}
            onChange={(event) => updateField("contactPhone", event.target.value)}
            placeholder="+20 100 000 0000"
          />
        </label>
        <label>
          Instagram profile URL (optional)
          <input
            type="url"
            value={form.instagramUrl}
            onChange={(event) => updateField("instagramUrl", event.target.value)}
            placeholder="https://instagram.com/your-profile"
          />
        </label>
        <label>
          Facebook profile URL (optional)
          <input
            type="url"
            value={form.facebookUrl}
            onChange={(event) => updateField("facebookUrl", event.target.value)}
            placeholder="https://facebook.com/your-page"
          />
        </label>
        <label>
          InstaPay address / IPA (optional)
          <input
            type="text"
            maxLength={120}
            value={form.instapayAddress}
            onChange={(event) => updateField("instapayAddress", event.target.value)}
            placeholder="Your InstaPay address"
          />
        </label>
        <label>
          InstaPay mobile number (optional)
          <input
            type="tel"
            autoComplete="tel"
            value={form.instapayMobile}
            onChange={(event) => updateField("instapayMobile", event.target.value)}
            placeholder="+20 100 000 0000"
          />
        </label>
        {error && <p className="editor-error contact-settings-message" role="alert">{error}</p>}
        {saved && <p className="password-saved contact-settings-message" role="status">Contact settings saved.</p>}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </section>
  );
}

export default ContactSettings;
