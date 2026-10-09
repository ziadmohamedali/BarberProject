import { useEffect, useState } from "react";
import "./OwnerLoginModal.css";

function OwnerLoginModal({ isOpen, onClose, onLogin }) {
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
      setError("Could not verify owner access. Check your username, password, and owner authorization.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="owner-login-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="owner-login-modal" role="dialog" aria-modal="true" aria-labelledby="owner-login-title">
        <button className="owner-login-close" type="button" onClick={onClose} aria-label="Close login">×</button>
        <span className="eyebrow">HADAD OWNER ACCESS</span>
        <h2 id="owner-login-title">Owner Login</h2>
        <form onSubmit={handleSubmit}>
          <label>Username<input type="text" autoComplete="username" placeholder="MohamedHadad" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="owner-login-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Login"}</button>
        </form>
      </section>
    </div>
  );
}

export default OwnerLoginModal;
