import { useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import "./OwnerLoginModal.css";

function OwnerLoginModal({ isOpen, onClose, onLogin }) {
  const { language, setLanguage, t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(username.trim(), password);
      setPassword("");
      onClose();
    } catch {
      setError(t("Could not verify owner access. Check your username, password, and owner authorization."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="owner-login-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="owner-login-modal" role="dialog" aria-modal="true" aria-labelledby="owner-login-title">
        <button className="owner-login-language" type="button" onClick={() => setLanguage((current) => current === "ar" ? "en" : "ar")} aria-label={t(language === "ar" ? "Switch to English" : "Switch to Arabic")}>
          {language === "ar" ? "English" : "العربية"}
        </button>
        <button className="owner-login-close" type="button" onClick={onClose} aria-label={t("Close login")}>×</button>
        <span className="eyebrow">{t("HADAD OWNER ACCESS")}</span>
        <h2 id="owner-login-title">{t("Owner Login")}</h2>
        <form onSubmit={handleSubmit}>
          <label>{t("Username")}<input type="text" autoComplete="username" placeholder="MohamedHadad" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>{t("Password")}<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="owner-login-error" role="alert">{t(error)}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t("Signing in…") : t("Login")}</button>
        </form>
      </section>
    </div>
  );
}

export default OwnerLoginModal;
