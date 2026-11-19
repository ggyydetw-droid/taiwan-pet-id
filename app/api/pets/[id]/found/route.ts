import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../../../lib/auth";

async function db() {
  const { env } = getCloudflareContext();
  return (env as any).DB;
}

async function ensureSchema(database: any) {
  await database.prepare(
    `CREATE TABLE IF NOT EXISTS pet_found_reports (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      finder_name TEXT,
      finder_contact TEXT,
      message TEXT,
      created_at TEXT NOT NULL
    )`
  ).run();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const database = await db();

  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  await ensureSchema(database);

  const pet = await database
    .prepare("SELECT pet_id, lost FROM pets WHERE pet_id = ?")
    .bind(id)
    .first();

  if (!pet) {
    return NextResponse.json({ message: "Pet ID not found." }, { status: 404 });
  }

  if (!pet.lost) {
    return NextResponse.json({ message: "This pet is not currently marked as lost." }, { status: 400 });
  }

  const body = await request.json();
  const finderName = String(body.finderName ?? "").trim();
  const finderContact = String(body.finderContact ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!finderContact && !message) {
    return NextResponse.json(
      { message: "Please provide a contact method or message so the owner can respond." },
      { status: 400 }
    );
  }

  await database
    .prepare(
      `INSERT INTO pet_found_reports
        (id, pet_id, finder_name, finder_contact, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      id,
      finderName || null,
      finderContact || null,
      message || null,
      new Date().toISOString()
    )
    .run();

  return NextResponse.json({ saved: true });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, database } = await getAuthenticatedUser(request);

  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: "Sign in to view found-pet reports." }, { status: 401 });
  }

  const { id } = await params;
  await ensureSchema(database);

  const pet = await database
    .prepare("SELECT owner_id FROM pets WHERE pet_id = ?")
    .bind(id)
    .first();

  if (!pet) {
    return NextResponse.json({ message: "Pet ID not found." }, { status: 404 });
  }

  if (pet.owner_id && pet.owner_id !== user.id) {
    return NextResponse.json({ message: "This Pet ID belongs to another owner account." }, { status: 403 });
  }

  const result = await database
    .prepare(
      `SELECT id, finder_name, finder_contact, message, created_at
       FROM pet_found_reports
       WHERE pet_id = ?
       ORDER BY created_at DESC`
    )
    .bind(id)
    .all();

  return NextResponse.json({ reports: result.results ?? [] });
}
