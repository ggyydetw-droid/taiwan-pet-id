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
      found_location TEXT,
      created_at TEXT NOT NULL,
      read_at TEXT
    )`
  ).run();

  // Existing D1 databases may have been created before found_location was added.
  // Upgrade those databases in place so the INSERT/SELECT below works.
  try {
    await database.prepare(
      "ALTER TABLE pet_found_reports ADD COLUMN found_location TEXT"
    ).run();
  } catch {
    // Column already exists.
  }

  try {
    await database.prepare(
      "ALTER TABLE pet_found_reports ADD COLUMN read_at TEXT"
    ).run();
  } catch {
    // Column already exists.
  }
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
  const foundLocation = String(body.foundLocation ?? "").trim();

  if (!finderContact && !message) {
    return NextResponse.json(
      { message: "Please provide a contact method or message so the owner can respond." },
      { status: 400 }
    );
  }

  await database
    .prepare(
      `INSERT INTO pet_found_reports
        (id, pet_id, finder_name, finder_contact, message, found_location, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      id,
      finderName || null,
      finderContact || null,
      message || null,
      foundLocation || null,
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
      `SELECT id, finder_name, finder_contact, message, found_location, created_at
       FROM pet_found_reports
       WHERE pet_id = ?
       ORDER BY created_at DESC`
    )
    .bind(id)
    .all();

  return NextResponse.json({ reports: result.results ?? [] });
}


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, database } = await getAuthenticatedUser(request);

  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: "Sign in to manage found-pet reports." }, { status: 401 });
  }

  const { id } = await params;
  await ensureSchema(database);

  try {
    await database.prepare("ALTER TABLE pet_found_reports ADD COLUMN read_at TEXT").run();
  } catch {
    // Column already exists.
  }

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

  await database
    .prepare("UPDATE pet_found_reports SET read_at = ? WHERE pet_id = ? AND read_at IS NULL")
    .bind(new Date().toISOString(), id)
    .run();

  return NextResponse.json({ markedRead: true });
}
