import { authApi } from "./supabase";

export const DASHBOARD_ROUTE = "/hadad-control-a8f3c91e7b2d";
export const OWNER_LOGIN_ROUTE = "/owner-login";

// The owner can sign in with the shop username instead of typing the Supabase Auth email.
const OWNER_USERNAME_EMAILS = { mohamedhadad: "mohamedhadad@hadad.invalid" };

function ownerLoginEmail(username = "") {
  const normalized = username.trim().toLowerCase();
  if (normalized.includes("@")) return normalized;
  const email = OWNER_USERNAME_EMAILS[normalized];
  if (!email) throw new Error("Username or password is incorrect.");
  return email;
}

export async function signInOwner(username, password) {
  let session;
  try {
    session = await authApi.signInWithPassword(ownerLoginEmail(username), password);
  } catch (error) {
    if (error.status === 400) throw new Error("Username or password is incorrect.");
    throw error;
  }
  if (!(await authApi.verifyOwner(session))) {
    await authApi.signOut();
    throw new Error("This account is not authorized to manage the shop.");
  }
}

export async function restoreOwnerSession() {
  const session = await authApi.getSession();
  if (!session) return false;
  if (await authApi.verifyOwner(session)) return true;
  await authApi.signOut();
  return false;
}

export const signOutOwner = () => authApi.signOut();
