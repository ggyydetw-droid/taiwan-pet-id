import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

async function db() {
  const { env } = getCloudflareContext();
  return (env as any).DB;
}

async function ensureSchema(database: any) {
  await database.prepare(
    `CREATE TABLE IF NOT EXISTS pets (
      pet_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      contact TEXT,
      show_name INTEGER NOT NULL DEFAULT 1,
      show_city INTEGER NOT NULL DEFAULT 0,
      show_contact INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`
  ).run();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const database = await db();
  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  await ensureSchema(database);

  const row = await database
    .prepare(
      `SELECT pet_id, name, city, contact, show_name, show_city, show_contact
       FROM pets WHERE pet_id = ?`
    )
    .bind(id)
    .first();

  if (!row) {
    return NextResponse.json({ message: "Pet ID not found." }, { status: 404 });
  }

  return NextResponse.json({
    petId: row.pet_id,
    ...(row.show_name ? { name: row.name } : {}),
    ...(row.show_city && row.city ? { city: row.city } : {}),
    ...(row.show_contact && row.contact ? { contact: row.contact } : {}),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!id || !name) {
    return NextResponse.json({ message: "Pet ID and pet name are required." }, { status: 400 });
  }

  const database = await db();
  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  await ensureSchema(database);

  const city = String(body.city ?? "").trim();
  const contact = String(body.contact ?? "").trim();
  const showName = body.showName ? 1 : 0;
  const showCity = body.showCity ? 1 : 0;
  const showContact = body.showContact ? 1 : 0;

  await database
    .prepare(
      `INSERT INTO pets
        (pet_id, name, city, contact, show_name, show_city, show_contact, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(pet_id) DO UPDATE SET
        name = excluded.name,
        city = excluded.city,
        contact = excluded.contact,
        show_name = excluded.show_name,
        show_city = excluded.show_city,
        show_contact = excluded.show_contact,
        updated_at = excluded.updated_at`
    )
    .bind(
      id,
      name,
      city || null,
      contact || null,
      showName,
      showCity,
      showContact,
      new Date().toISOString()
    )
    .run();

  return NextResponse.json({ saved: true, petId: id });
}
