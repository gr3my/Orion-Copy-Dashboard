import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionStrict } from "@/lib/auth";
import { authStartupGuard } from "@/lib/security";

export async function GET(req: NextRequest) {
  const guard = authStartupGuard();
  const warning = guard.blocked ? guard.error ?? null : (guard.devWarning ?? null);
  const claims = await readSessionStrict(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ loggedIn: false, label: null, master: false, permissions: [], warning });
  }
  return NextResponse.json({
    loggedIn: true,
    label: claims.label,
    master: claims.master,
    permissions: claims.permissions,
    warning,
  });
}
