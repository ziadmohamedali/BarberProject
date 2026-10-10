import { useCallback, useEffect, useState } from "react";
import {
  changeOwnerPassword,
  getOwnerSession,
  getOwnerUser,
  ownerUsernameToEmail,
  signInOwner,
  signOutOwner,
  verifyOwner,
} from "./authService";

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await getOwnerSession();
      const authenticatedUser = session ? await getOwnerUser(session) : null;
      const isOwner = authenticatedUser ? await verifyOwner(session) : false;
      if (authenticatedUser && !isOwner) await signOutOwner();
      setUser(authenticatedUser && isOwner ? authenticatedUser : null);
    } catch {
      setUser(null);
      setError("Could not verify owner access. Check your connection and reload.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (username, password) => {
    setError("");
    const loginEmail = username.includes("@") ? username.trim().toLowerCase() : ownerUsernameToEmail(username);
    const session = await signInOwner(loginEmail, password);
    const nextUser = await getOwnerUser(session);
    if (!nextUser) throw new Error("Could not verify your account.");
    if (!(await verifyOwner(session))) {
      await signOutOwner();
      throw new Error("This account is not authorized to manage the shop.");
    }
    setUser(nextUser);
    return nextUser;
  };

  const updatePassword = (currentPassword, newPassword) =>
    changeOwnerPassword(currentPassword, newPassword);

  const logout = async () => {
    try {
      await signOutOwner();
    } finally {
      setUser(null);
    }
  };

  return { user, loading, error, login, logout, updatePassword };
}
