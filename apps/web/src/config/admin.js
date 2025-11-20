export const ADMIN_EMAIL = "simonmathiashansen@gmail.com";

export function isAdminUser(user) {
  return !!user && user.email === ADMIN_EMAIL;
}

