import { authApi } from "../../lib/supabase";

export function ownerUsernameToEmail(username = "") {
  const normalizedUsername = username.trim().toLowerCase();
  if (normalizedUsername === "mohamedhadad") return "mohamedhadad@hadad.invalid";
  throw new Error("Enter the owner username.");
}

export const signInOwner = (email, password) => authApi.signInWithPassword(email, password);
export const signOutOwner = () => authApi.signOut();
export const getOwnerUser = (session) => authApi.getUser(session);
export const verifyOwner = (session) => authApi.verifyOwner(session);
export const getOwnerSession = () => authApi.getSession();

export async function changeOwnerPassword(currentPassword, newPassword) {
  const session = await getOwnerSession();
  const email = session?.user?.email;
  if (!email) throw new Error("Your owner session has expired. Please log in again.");

  const verifiedSession = await authApi.signInWithPassword(email, currentPassword);
  if (!(await verifyOwner(verifiedSession))) {
    await signOutOwner();
    throw new Error("This account is not authorized to manage the shop.");
  }

  await authApi.updatePassword(newPassword);
}
