import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../../../../lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const { user, database } = await getAuthenticatedUser(request);

  if (!database) {
    return NextResponse.json(
      { message: "D1 database binding DB is not configured." },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { message: "Sign in to manage found-pet reports." },
      { status: 401 }
    );
  }

  const { id, reportId } = await params;

  const pet = await database
    .prepare("SELECT owner_id FROM pets WHERE pet_id = ?")
    .bind(id)
    .first();

  if (!pet) {
    return NextResponse.json({ message: "Pet ID not found." }, { status: 404 });
  }

  if (pet.owner_id && pet.owner_id !== user.id) {
    return NextResponse.json(
      { message: "This Pet ID belongs to another owner account." },
      { status: 403 }
    );
  }

  const result = await database
    .prepare("DELETE FROM pet_found_reports WHERE id = ? AND pet_id = ?")
    .bind(reportId, id)
    .run();

  if (!result.success) {
    return NextResponse.json(
      { message: "Unable to remove report." },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
