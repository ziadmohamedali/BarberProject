/* eslint-disable react/prop-types -- The app uses JavaScript components without PropTypes. */
import { useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import useScrollLock from "../../hooks/useScrollLock";
import "./OwnerLoginModal.css";

function OwnerLoginModal({ isOpen, onClose, onLogin, onRequestPasswordReset, onSetNewPassword, recoveryMode = false, loginError = "" }) {
  const { t } = useLanguage();
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setView(recoveryMode ? "set-password" : "login");
  }, [recoveryMode]);

  useEffect(() => {
    if (loginError) setError(loginError);
  }, [loginError]);

  if (!isOpen) return null;

  const switchView = (nextView) => {
    setView(nextView);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmation("");
  };

  const submit = (action, fallbackMessage) => async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await action();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : fallbackMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = submit(async () => {
    await onLogin(email, password);
    setPassword("");
  }, "Email or password is incorrect.");

  const handleResetRequest = submit(async () => {
    await onRequestPasswordReset(email);
    setNotice("If this email belongs to the owner account, a password reset link has been sent.");
  }, "Could not send the password reset email.");

  const handleSetPassword = submit(async () => {
    await onSetNewPassword(password, confirmation);
    setPassword("");
    setConfirmation("");
  }, "Could not save the new password.");

  const titles = { login: "Owner Login", forgot: "Reset Password", "set-password": "Set New Password" };

  return (
    <div className="owner-login-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="owner-login-modal" role="dialog" aria-modal="true" aria-labelledby="owner-login-title">
        <button className="owner-login-close" type="button" onClick={onClose} aria-label={t("Close login")}>×</button>
        <span className="eyebrow">{t("MOHAMED HADAD OWNER ACCESS")}</span>
        <h2 id="owner-login-title">{t(titles[view])}</h2>
        {view === "login" && (
          <form onSubmit={handleLogin}>
            <label>{t("Email")}<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>{t("Password")}<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p className="owner-login-error" role="alert">{t(error)}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t("Signing in…") : t("Login")}</button>
            <button className="owner-login-link" type="button" onClick={() => switchView("forgot")}>{t("Forgot password?")}</button>
          </form>
        )}
        {view === "forgot" && (
          <form onSubmit={handleResetRequest}>
            <p className="owner-login-hint">{t("Enter the owner email address and we will send a link to set a new password.")}</p>
            <label>{t("Email")}<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {error && <p className="owner-login-error" role="alert">{t(error)}</p>}
            {notice && <p className="owner-login-notice" role="status">{t(notice)}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t("Sending…") : t("Send reset link")}</button>
            <button className="owner-login-link" type="button" onClick={() => switchView("login")}>{t("Back to login")}</button>
          </form>
        )}
        {view === "set-password" && (
          <form onSubmit={handleSetPassword}>
            <label>{t("New password")}<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>{t("Confirm new password")}<input type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            {error && <p className="owner-login-error" role="alert">{t(error)}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t("Saving…") : t("Save password")}</button>
          </form>
        )}
      </section>
    </div>
  );
}

export default OwnerLoginModal;
