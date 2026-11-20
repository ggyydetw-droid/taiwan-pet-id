import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuthenticatedUser } from "../../../../lib/auth";

async function db() {
  const { env } = getCloudflareContext();
  return (env as any).DB;
}

async function ensureSchema(database: any) {
  await database.prepare(
    `CREATE TABLE IF NOT EXISTS pets (
      pet_id TEXT PRIMARY KEY,
      owner_id TEXT,
      name TEXT NOT NULL,
      city TEXT,
      contact TEXT,
      show_name INTEGER NOT NULL DEFAULT 1,
      show_city INTEGER NOT NULL DEFAULT 0,
      show_contact INTEGER NOT NULL DEFAULT 0,
      lost INTEGER NOT NULL DEFAULT 0,
      species TEXT,
      breed TEXT,
      birth_date TEXT,
      show_species INTEGER NOT NULL DEFAULT 0,
      show_breed INTEGER NOT NULL DEFAULT 0,
      show_birth_date INTEGER NOT NULL DEFAULT 0,
      photo_url TEXT,
      show_photo INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`
  ).run();

  try {
    await database.prepare("ALTER TABLE pets ADD COLUMN owner_id TEXT").run();
  } catch {}

  await database.prepare(
    `CREATE TABLE IF NOT EXISTS pet_health_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      show_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`
  ).run();
  
  // Existing installations may have the older health-record table without
  // the public-visibility column. Add it without replacing existing data.
  try {
    await database.prepare("ALTER TABLE pet_health_records ADD COLUMN show_public INTEGER NOT NULL DEFAULT 0").run();
  } catch {
    // Column already exists.
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const database = await db();

  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  await ensureSchema(database);

  const { user } = await getAuthenticatedUser(request);
  const pet = await database.prepare("SELECT owner_id FROM pets WHERE pet_id = ?").bind(id).first();

  if (!pet) {
    return NextResponse.json({ message: "Pet ID not found." }, { status: 404 });
  }

  const isOwner = Boolean(user && pet.owner_id && pet.owner_id === user.id);

  const result = await database
    .prepare(
      isOwner
        ? `SELECT id, record_type, summary, occurred_at, show_public, created_at
           FROM pet_health_records WHERE pet_id = ? ORDER BY occurred_at DESC, created_at DESC`
        : `SELECT id, record_type, summary, occurred_at
           FROM pet_health_records WHERE pet_id = ? AND show_public = 1
           ORDER BY occurred_at DESC, created_at DESC`
    )
    .bind(id)
    .all();

  return NextResponse.json(
    { records: result.results ?? [] },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, database } = await getAuthenticatedUser(request);

  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: "Sign in to manage health records." }, { status: 401 });
  }

  const { id } = await params;
  await ensureSchema(database);

  const body = await request.json().catch(() => ({}));
  const recordType = String(body.recordType ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const occurredAt = String(body.occurredAt ?? "").trim();
  const showPublic = body.showPublic ? 1 : 0;
  const name = String(body.name ?? "").trim();

  if (!recordType || !summary || !occurredAt) {
    return NextResponse.json(
      { message: "Record type, summary, and date are required." },
      { status: 400 }
    );
  }

  let pet = await database.prepare("SELECT owner_id, name FROM pets WHERE pet_id = ?").bind(id).first();

  // A verified Pet ID may not have a profile row yet. Claim it for the
  // signed-in owner when the first health record is added.
  if (!pet) {
    if (!name) {
      return NextResponse.json(
        { message: "Pet profile not found. Verify and save the pet profile first." },
        { status: 404 }
      );
    }

    await database
      .prepare(
        `INSERT INTO pets (pet_id, owner_id, name, show_name, updated_at)
         VALUES (?, ?, ?, 1, ?)`
      )
      .bind(id, user.id, name, new Date().toISOString())
      .run();

    pet = { owner_id: user.id, name };
  }

  if (pet.owner_id && pet.owner_id !== user.id) {
    return NextResponse.json({ message: "This Pet ID belongs to another owner account." }, { status: 403 });
  }

  if (!pet.owner_id) {
    await database
      .prepare("UPDATE pets SET owner_id = ?, updated_at = ? WHERE pet_id = ? AND (owner_id IS NULL OR owner_id = ?)")
      .bind(user.id, new Date().toISOString(), id, user.id)
      .run();
  }

  await database
    .prepare(
      `INSERT INTO pet_health_records
        (id, pet_id, record_type, summary, occurred_at, show_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      id,
      recordType,
      summary,
      occurredAt,
      showPublic,
      new Date().toISOString()
    )
    .run();

  return NextResponse.json({ saved: true });
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
    return NextResponse.json({ message: "Sign in to manage health records." }, { status: 401 });
  }

  const { id } = await params;
  await ensureSchema(database);

  const pet = await database.prepare("SELECT owner_id FROM pets WHERE pet_id = ?").bind(id).first();
  if (!pet) {
    return NextResponse.json({ message: "Pet ID not found." }, { status: 404 });
  }

  if (pet.owner_id && pet.owner_id !== user.id) {
    return NextResponse.json({ message: "This Pet ID belongs to another owner account." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const recordId = String(body.recordId ?? "").trim();
  if (!recordId) {
    return NextResponse.json({ message: "Record ID is required." }, { status: 400 });
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (typeof body.showPublic === "boolean") {
    updates.push("show_public = ?");
    values.push(body.showPublic ? 1 : 0);
  }
  if (typeof body.summary === "string" && body.summary.trim()) {
    updates.push("summary = ?");
    values.push(body.summary.trim());
  }

  if (!updates.length) {
    return NextResponse.json({ message: "Nothing to update." }, { status: 400 });
  }

  values.push(recordId, id);
  await database
    .prepare(`UPDATE pet_health_records SET ${updates.join(", ")} WHERE id = ? AND pet_id = ?`)
    .bind(...values)
    .run();

  return NextResponse.json({ saved: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, database } = await getAuthenticatedUser(request);

  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: "Sign in to manage health records." }, { status: 401 });
  }

  const { id } = await params;
  await ensureSchema(database);

  const pet = await database.prepare("SELECT owner_id FROM pets WHERE pet_id = ?").bind(id).first();
  if (!pet) {
    return NextResponse.json({ message: "Pet ID not found." }, { status: 404 });
  }

  if (pet.owner_id && pet.owner_id !== user.id) {
    return NextResponse.json({ message: "This Pet ID belongs to another owner account." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const recordId = String(body.recordId ?? "").trim();

  if (!recordId) {
    return NextResponse.json({ message: "Record ID is required." }, { status: 400 });
  }

  await database
    .prepare("DELETE FROM pet_health_records WHERE id = ? AND pet_id = ?")
    .bind(recordId, id)
    .run();

  return NextResponse.json({ deleted: true });
}
