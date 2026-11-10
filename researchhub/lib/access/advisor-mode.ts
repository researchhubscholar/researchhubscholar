import type { SupabaseClient } from "@supabase/supabase-js";

// Presentation preference only. Project access is still enforced by RLS.
export async function isAdvisorOnly(db: SupabaseClient, userId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const [profile, links, projects, license, membership, admin] = await Promise.all([
    db.from("profiles").select("user_type").eq("id", userId).maybeSingle(),
    db.from("scholar_project_collaborators").select("project_id").eq("user_id", userId).eq("role", "advisor").limit(1),
    db.from("research_projects").select("id").eq("owner_id", userId).limit(1),
    db.from("scholar_licenses").select("id").eq("owner_id", userId).in("status", ["active", "trial"]).lte("starts_at", now).gt("ends_at", now).limit(1),
    db.from("scholar_memberships").select("organization_id").eq("user_id", userId).eq("active", true).limit(1),
    db.from("scholar_platform_admins").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  if ([projects, license, membership, admin].some(result => result.error)) return false;
  return !projects.data?.length && !license.data?.length && !membership.data?.length && !admin.data
    && (profile.data?.user_type === "advisor" || Boolean(links.data?.length));
}
