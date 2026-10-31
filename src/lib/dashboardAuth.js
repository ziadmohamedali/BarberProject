import { authApi } from "./supabase";

export const DASHBOARD_ROUTE = "/hadad-control-a8f3c91e7b2d";
export const OWNER_LOGIN_ROUTE = "/owner-login";

const MIN_PASSWORD_LENGTH = 8;

async function requireOwner(session) {
  if (await authApi.verifyOwner(session)) return;
  await authApi.signOut();
  throw new Error("This account is not authorized to manage the shop.");
}

export async function signInOwner(email, password) {
  let session;
  try {
    session = await authApi.signInWithPassword(email.trim().toLowerCase(), password);
  } catch (error) {
    if (/email not confirmed/i.test(error.message)) {
      throw new Error("Confirm the owner email address before signing in.");
    }
    if (error.status === 400) throw new Error("Email or password is incorrect.");
    throw error;
  }
  await requireOwner(session);
}

export async function restoreOwnerSession() {
  const session = await authApi.getSession();
  if (!session) return false;
  if (await authApi.verifyOwner(session)) return true;
  await authApi.signOut();
  return false;
}

export async function requestOwnerPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter the owner email address.");
  await authApi.requestPasswordReset(normalizedEmail, `${window.location.origin}${OWNER_LOGIN_ROUTE}`);
}

export const consumePasswordRecovery = () => authApi.consumeRecoveryRedirect();

export async function setOwnerPassword(password, confirmation) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("Use at least 8 characters for the new password.");
  }
  if (password !== confirmation) throw new Error("The two passwords do not match.");
  await authApi.updatePassword(password);
  await requireOwner(await authApi.getSession());
}

export const signOutOwner = () => authApi.signOut();
