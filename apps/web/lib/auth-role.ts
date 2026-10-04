/** Resolve the exact, case-insensitive administrator email allowlist to the documented role enum. */
export function roleForEmail(
  email: string | null | undefined,
  allowlist = process.env.ADMIN_EMAILS,
): 'user' | 'admin' {
  const allowed = new Set(
    (allowlist ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  return email && allowed.has(email.trim().toLowerCase()) ? 'admin' : 'user';
}
