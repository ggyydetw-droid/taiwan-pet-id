import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth";

const DEMO: Record<string, { name: string; petId: string }> = {
  "900123456789012": { name: "Milo", petId: "TPID-MILO-001" },
  "900123456789013": { name: "Luna", petId: "TPID-LUNA-002" },
};

export async function POST(req: Request) {
  const { database, user } = await getAuthenticatedUser(req);

  if (!database) {
    return NextResponse.json({ verified: false, message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ verified: false, message: "Sign in to verify and manage a pet." }, { status: 401 });
  }

  const { chip, name } = await req.json();

  if (!chip || String(chip).length < 8) {
    return NextResponse.json(
      { verified: false, message: "Enter a valid government/microchip reference." },
      { status: 400 }
    );
  }

  const pet = DEMO[String(chip)];

  if (!pet) {
    return NextResponse.json(
      { verified: false, message: "Not found in sandbox. Production will use the authorized government connector." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    verified: true,
    name: name || pet.name,
    petId: pet.petId,
    source: "government-sandbox",
  });
}
