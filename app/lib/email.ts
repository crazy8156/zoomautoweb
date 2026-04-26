export function normalizeEmail(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

export function hasEmail(value: string | null | undefined) {
  return normalizeEmail(value).length > 0;
}

export function parseInviteeEmails(value: string | null | undefined) {
  const raw = String(value ?? '');
  const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return Array.from(new Set(matches.map((item) => normalizeEmail(item)).filter(Boolean)));
}
