import { NextResponse } from "next/server";

const DEMO: Record<string, { name: string; petId: string }> = {
  "900123456789012": { name: "Milo", petId: "TPID-MILO-001" },
  "900123456789013": { name: "Luna", petId: "TPID-LUNA-002" },
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const chip = String(body.chip ?? "").trim();

  if (!chip || chip.length < 8) {
    return NextResponse.json(
      { verified: false, message: "Enter a valid government/microchip reference." },
      { status: 400 }
    );
  }

  const pet = DEMO[chip];

  if (!pet) {
    return NextResponse.json(
      {
        verified: false,
        message: "Not found in sandbox. Production will use the authorized government connector.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    verified: true,
    name: pet.name,
    petId: pet.petId,
    source: "government-sandbox",
  });
}
