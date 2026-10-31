/* eslint-disable react/prop-types -- Existing app components use JavaScript props without PropTypes. */
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import "./LiveHome.css";

const fields = [
  ["descriptionEn", "English hero description", "textarea", 400], ["descriptionAr", "Arabic hero description", "textarea", 400],
  ["rulesEn", "English booking warning", "textarea", 400], ["rulesAr", "Arabic booking warning", "textarea", 400],
  ["hoursTextAr", "Working hours (Arabic)", "text", 160], ["hoursTextEn", "Working hours (English)", "text", 160],
  ["openingTime", "Opening time", "time"], ["closingTime", "Closing time", "time"],
];

export default function LiveHome({ settings, onSave, onUploadImage, onDeleteImages }) {
  const { language, t } = useLanguage();
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const uploadedImages = useRef([]);

  useEffect(() => setDraft(settings), [settings]);

  const update = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const handleImage = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError("");
    try {
      const imageUrl = await onUploadImage(file, setUploadProgress);
      uploadedImages.current.push(imageUrl);
      update("imageUrl", imageUrl);
    } catch (uploadError) {
      setError(t(uploadError.message || "The image could not be uploaded."));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSave(draft);
      const replacedImages = [settings.imageUrl].filter((url) => url && url !== draft.imageUrl);
      const unusedUploads = uploadedImages.current.filter((url) => url !== draft.imageUrl);
      if (replacedImages.length || unusedUploads.length) await onDeleteImages([...replacedImages, ...unusedUploads]);
      uploadedImages.current = [];
      setMessage(t("Live Home saved successfully."));
    } catch (saveError) {
      setError(t(saveError.message || "The change could not be saved. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="live-home-editor" onSubmit={submit}>
      <header className="live-home-heading"><div><span className="eyebrow">{t("PUBLIC WEBSITE")}</span><h2>{t("Live Home")}</h2><p>{t("Shape the first impression customers see on your homepage.")}</p></div><span className="live-home-status">{t("Bilingual content")}</span></header>
      <div className="live-home-layout">
        <section className="live-home-card"><div className="live-home-card-title"><span>01</span><div><h3>{t("Hero content")}</h3><p>{t("Keep the message short, clear, and welcoming.")}</p></div></div>
          <div className="live-home-fields">{fields.slice(0, 2).map(([key, label, , max]) => <label className="live-home-field" key={key}><span>{t(label)}</span><textarea dir={key.endsWith("Ar") ? "rtl" : "ltr"} maxLength={max} rows={3} value={draft[key]} onChange={(event) => update(key, event.target.value)} required /></label>)}</div>
        </section>
        <section className="live-home-card live-home-image-card"><div className="live-home-card-title"><span>02</span><div><h3>{t("Hero image")}</h3><p>{t("A strong image gives the homepage its character.")}</p></div></div>
          <div className="live-home-image-preview">{draft.imageUrl ? <img src={draft.imageUrl} alt={t("Homepage hero preview")} /> : <div className="live-home-image-empty">{t("No custom image selected")}</div>}</div>
          <div className="live-home-image-actions"><label className="live-home-upload">{uploading ? t("Uploading image\u2026") : t(draft.imageUrl ? "Replace image" : "Choose image")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} disabled={uploading} /></label>{draft.imageUrl && <button type="button" className="live-home-remove" onClick={() => update("imageUrl", "")}>{t("Remove image")}</button>}</div>
          {uploading && <div className="live-home-progress" role="status"><span>{t("Uploading image\u2026")} {uploadProgress}%</span><progress max="100" value={uploadProgress}>{uploadProgress}%</progress></div>}
          <small>{t("JPEG, PNG, or WebP \u00b7 maximum 5 MB")}</small>
        </section>
        <section className="live-home-card live-home-rules-card"><div className="live-home-card-title"><span>03</span><div><h3>{t("Booking warning")}</h3><p>{t("This message appears on the public homepage with the shop hours.")}</p></div></div>
          <div className="live-home-fields">{fields.slice(2, 4).map(([key, label, , max]) => <label className="live-home-field" key={key}><span>{t(label)}</span><textarea dir={key.endsWith("Ar") ? "rtl" : "ltr"} maxLength={max} rows={3} value={draft[key]} onChange={(event) => update(key, event.target.value)} required /></label>)}</div>
        </section>
        <section className="live-home-card live-home-hours-card"><div className="live-home-card-title"><span>04</span><div><h3>{t("Shop working hours")}</h3><p>{t("Write the hours the way customers should read them. The homepage shows this text exactly as written.")}</p></div></div>
          <div className="live-home-fields">{fields.slice(4, 6).map(([key, label, , max]) => <label className="live-home-field" key={key}><span>{t(label)}</span><input type="text" dir={key.endsWith("Ar") ? "rtl" : "ltr"} maxLength={max} placeholder={key.endsWith("Ar") ? "يوميًا من ١٢ ظهرًا حتى ١ بالليل" : "Daily from 12 PM to 1 AM"} value={draft[key]} onChange={(event) => update(key, event.target.value)} /></label>)}</div>
          <p className="live-home-hours-note">{t("Booking slots: customers can pick 30-minute preferences between these times.")}</p>
          <div className="live-home-fields">{fields.slice(6).map(([key, label]) => <label className="live-home-field" key={key}><span>{t(label)}</span><input type="time" required value={draft[key]} onChange={(event) => update(key, event.target.value)} /></label>)}</div>
        </section>
      </div>
      {error && <p className="live-home-feedback is-error" role="alert">{error}</p>}{message && <p className="live-home-feedback" role="status">{message}</p>}
      <footer className="live-home-footer"><button type="button" className="live-home-cancel" disabled={busy || uploading} onClick={async () => { try { await onDeleteImages(uploadedImages.current); } catch { /* Reset even if storage cleanup is temporarily unavailable. */ } uploadedImages.current = []; setDraft(settings); setError(""); setMessage(""); }}>{t("Reset changes")}</button><button type="submit" className="primary-button" disabled={busy || uploading}>{busy ? t("Saving\u2026") : t("Save Live Home")}</button></footer>
      <span className="live-home-language" aria-hidden="true">{language.toUpperCase()}</span>
    </form>
  );
}
