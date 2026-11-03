import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./locale";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}
