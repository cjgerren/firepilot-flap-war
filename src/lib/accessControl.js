function parseCsvEnv(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

const OWNER_EMAILS = new Set(
  Array.from(parseCsvEnv(import.meta.env.VITE_OWNER_EMAILS)).map((value) =>
    value.toLowerCase()
  )
);
const OWNER_USER_IDS = parseCsvEnv(import.meta.env.VITE_OWNER_USER_IDS);

export function isOwnerUser(user) {
  if (!user || user.isLocalDeveloper) return false;

  const email = String(user.email || '').trim().toLowerCase();
  const id = String(user.id || '').trim();

  return OWNER_EMAILS.has(email) || OWNER_USER_IDS.has(id);
}

export function hasOwnerAccessConfig() {
  return OWNER_EMAILS.size > 0 || OWNER_USER_IDS.size > 0;
}
