import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const DEMO_PETS: Record<string, string> = {
  "TPID-MILO-001": "Milo",
  "TPID-LUNA-002": "Luna",
};

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

  // Keep the clinic endpoint compatible with the current pet profile schema.
  for (const column of [
    "owner_id TEXT",
    "show_name INTEGER NOT NULL DEFAULT 1",
    "updated_at TEXT",
  ]) {
    try {
      await database.prepare("ALTER TABLE pets ADD COLUMN " + column).run();
    } catch {
      // Column already exists.
    }
  }
}

export async function POST(request: Request) {
  try {
    const database = await db();

    if (!database) {
      return NextResponse.json(
        { message: "D1 database binding DB is not configured." },
        { status: 500 }
      );
    }

    await ensureSchema(database);

    const body = await request.json().catch(() => ({}));
    const petId = String(body.petId ?? "").trim();
    const recordType = String(body.recordType ?? "").trim();
    const summary = String(body.summary ?? "").trim();
    const occurredAt = String(body.occurredAt ?? "").trim();

    const petName = DEMO_PETS[petId];

    if (!petName) {
      return NextResponse.json(
        { message: "Verified Pet ID not found." },
        { status: 404 }
      );
    }

    if (!recordType || !summary || !occurredAt) {
      return NextResponse.json(
        { message: "Record type, summary, and date are required." },
        { status: 400 }
      );
    }

    // The clinic is allowed to create the health record for a verified
    // government Pet ID even if the owner has not opened the dashboard yet.
    const existingPet = await database
      .prepare("SELECT pet_id FROM pets WHERE pet_id = ?")
      .bind(petId)
      .first();

    if (!existingPet) {
      await database
        .prepare(
          `INSERT INTO pets
            (pet_id, owner_id, name, show_name, updated_at)
           VALUES (?, NULL, ?, 1, ?)`
        )
        .bind(petId, petName, new Date().toISOString())
        .run();
    }

    await database
      .prepare(
        `INSERT INTO pet_health_records
          (id, pet_id, record_type, summary, occurred_at, show_public, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      )
      .bind(
        crypto.randomUUID(),
        petId,
        recordType,
        summary,
        occurredAt,
        new Date().toISOString()
      )
      .run();

    return NextResponse.json({ saved: true, petId });
  } catch (error) {
    console.error("Clinic visit record error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: `Could not save the visit record. ${detail}` },
      { status: 500 }
    );
  }
}
