export const DASHBOARD_ROUTE = "/hadad-control-a8f3c91e7b2d";
export const OWNER_LOGIN_ROUTE = "/owner-login";
export const OWNER_USERNAME = "MohamedHadad";
export const OWNER_PASSWORD = "Mohamed@123";

const dashboardSessionKey = "hadad-dashboard-session";

export function hasDashboardSession() {
  try {
    return window.sessionStorage.getItem(dashboardSessionKey) === "authenticated";
  } catch {
    return false;
  }
}

export function startDashboardSession() {
  window.sessionStorage.setItem(dashboardSessionKey, "authenticated");
}

export function endDashboardSession() {
  window.sessionStorage.removeItem(dashboardSessionKey);
}
