import { auth } from "@/lib/auth";
import { getOrCreateSpreadsheetId } from "@/lib/sheets";

export async function requireSession() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.email) {
    throw new SessionError("No autenticado");
  }
  const spreadsheetId = await getOrCreateSpreadsheetId(session.accessToken);
  return {
    accessToken: session.accessToken,
    email: session.user.email,
    spreadsheetId,
  };
}

export class SessionError extends Error {}
