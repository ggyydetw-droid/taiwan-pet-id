import { NextResponse } from "next/server";
import {
  createSession,
  ensureAuthSchema,
  getDb,
  setSessionCookie,
  verifyPassword,
} from "@/app/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const database = await getDb();
    if (!database) {
      return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
    }

    await ensureAuthSchema(database);

    const user = await database
      .prepare("SELECT id, email, password_hash, password_salt FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const { rawToken, expiresAt } = await createSession(database, user.id);
    const response = NextResponse.json({ authenticated: true, email: user.email });
    setSessionCookie(response, rawToken, expiresAt);
    return response;
  } catch {
    return NextResponse.json({ message: "Unable to sign in." }, { status: 500 });
  }
}
