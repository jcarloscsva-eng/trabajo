import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// One-time personal setup helper: shows the Google refresh token for the logged-in
// user so it can be copied into GOOGLE_REFRESH_TOKEN for the cron job. Only ever
// returns the token belonging to the requester's own authenticated session.
export async function GET(request: Request) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!token.refreshToken) {
    return NextResponse.json(
      { error: "No hay refresh token en esta sesión. Cierra sesión y vuelve a entrar." },
      { status: 400 },
    );
  }

  return NextResponse.json({ refreshToken: token.refreshToken, email: token.email });
}
