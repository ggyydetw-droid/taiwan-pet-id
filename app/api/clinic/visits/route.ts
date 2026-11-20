import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function db() {
  const { env } = getCloudflareContext();
  return (env as any).DB;
}

async function ensureSchema(database: any) {
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

    const body = await request.json();
    const petId = String(body.petId ?? "").trim();
    const occurredAt = String(body.occurredAt ?? "").trim();
    const summary = String(body.summary ?? "").trim();
    const showPublic = body.showPublic ? 1 : 0;

    if (!petId || !occurredAt || !summary) {
      return NextResponse.json(
        { message: "Pet ID, visit date, and summary are required." },
        { status: 400 }
      );
    }

    await ensureSchema(database);

    const pet = await database
      .prepare("SELECT pet_id FROM pets WHERE pet_id = ?")
      .bind(petId)
      .first();

    if (!pet) {
      return NextResponse.json(
        { message: "Pet ID was verified but is not registered in this database yet." },
        { status: 404 }
      );
    }

    await database
      .prepare(
        `INSERT INTO pet_health_records
          (id, pet_id, record_type, summary, occurred_at, show_public, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        petId,
        "Vet visit",
        summary,
        occurredAt,
        showPublic,
        new Date().toISOString()
      )
      .run();

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Clinic visit save failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to save clinic visit.",
      },
      { status: 500 }
    );
  }
}
