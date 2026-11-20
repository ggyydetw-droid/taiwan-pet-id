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
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS pet_health_records (
        id TEXT PRIMARY KEY,
        pet_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        show_public INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`
    )
    .run();
}

export async function POST(request: Request) {
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

  if (!DEMO_PETS[petId]) {
    return NextResponse.json({ message: "Verified Pet ID not found." }, { status: 404 });
  }

  if (!recordType || !summary || !occurredAt) {
    return NextResponse.json(
      { message: "Record type, summary, and date are required." },
      { status: 400 }
    );
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
}
