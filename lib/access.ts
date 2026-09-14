// Mirrors public.is_umn_email in supabase/migrations/003_umn_access.sql.
// Change both together, or the sign-in message and the database will disagree.
const umnEmail = /^[^@]+@umn\.edu$/;

export function isUmnEmail(address: string) {
  return umnEmail.test(address.trim().toLowerCase());
}

export const umnAccessMessage =
  'Wunderbar is open to University of Minnesota students. Please sign in with your @umn.edu address.';
