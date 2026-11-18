import { NextResponse } from "next/server";
import { createSession, ensureAuthSchema, getDb, hashPassword, setSessionCookie } from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
    }

    const database = await getDb();
    if (!database) {
      return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
    }

    await ensureAuthSchema(database);

    const existing = await database.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return NextResponse.json({ message: "An account with that email already exists." }, { status: 409 });
    }

    const { hash, salt } = await hashPassword(password);
    const userId = crypto.randomUUID();

    await database
      .prepare(
        `INSERT INTO users (id, email, password_hash, password_salt, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(userId, email, hash, salt, new Date().toISOString())
      .run();

    const { rawToken, expiresAt } = await createSession(database, userId);
    const response = NextResponse.json({ authenticated: true, email });
    setSessionCookie(response, rawToken, expiresAt);
    return response;
  } catch {
    return NextResponse.json({ message: "Unable to create account." }, { status: 500 });
  }
}
