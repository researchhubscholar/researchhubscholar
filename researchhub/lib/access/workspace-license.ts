/**
 * Workspace entitlement is independent of the legacy beta_access flag.
 * Only an explicitly provisioned, current personal or institutional license
 * authorizes entry. Trials are valid ONLY when a real license row exists.
 */
export type WorkspaceLicense = {
  owner_id: string | null;
  organization_id: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
};
export type WorkspaceMembership = { organization_id: string; active: boolean };

export function hasWorkspaceLicense(
  userId: string,
  licenses: WorkspaceLicense[],
  memberships: WorkspaceMembership[],
  now = Date.now(),
): boolean {
  if (!userId || !Array.isArray(licenses) || !Array.isArray(memberships)) return false;
  const memberOrgs = new Set(memberships.filter(m =>
    m && m.active === true && typeof m.organization_id === "string"
  ).map(m => m.organization_id));
  return licenses.some(license => {
    if (!license || !["active", "trial"].includes(license.status)) return false;
    const start = Date.parse(license.starts_at), end = Date.parse(license.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > now || end < now) return false;
    return (license.owner_id === userId && license.organization_id === null) ||
      (license.owner_id === null && typeof license.organization_id === "string" &&
        memberOrgs.has(license.organization_id));
  });
}
