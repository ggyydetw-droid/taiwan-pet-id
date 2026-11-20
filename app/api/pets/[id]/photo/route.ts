import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuthenticatedUser } from "../../../../lib/auth";

async function getBucket() {
  const { env } = getCloudflareContext();
  return (env as any).PET_PHOTOS;
}

async function jsonError(message: string, status = 500) {
  return NextResponse.json({ message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, database } = await getAuthenticatedUser(request);

    if (!database) {
    return NextResponse.json(
      { message: "D1 database binding DB is not configured." },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { message: "Sign in to upload a pet photo." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const pet = await database
    .prepare("SELECT owner_id, photo_url FROM pets WHERE pet_id = ?")
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

  const bucket = await getBucket();
  if (!bucket) {
    return NextResponse.json(
      { message: "Pet photo storage is not configured. Add an R2 binding named PET_PHOTOS in Cloudflare." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Choose a photo to upload." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "Only image files are allowed." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "Photo must be 5 MB or smaller." }, { status: 400 });
  }

  const extension = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const key = `pets/${id}/profile-${Date.now()}.${extension}`;

  await bucket.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const photoUrl = `/api/pets/${encodeURIComponent(id)}/photo`;

  if (pet.photo_url && String(pet.photo_url).startsWith("/api/pets/")) {
    const oldKey = String(pet.photo_url).includes("profile-")
      ? String(pet.photo_url).split("profile-")[1]
      : null;
    if (oldKey) {
      try {
        await bucket.delete(`pets/${id}/profile-${oldKey}`);
      } catch {
        // Keep the new photo even if cleanup of an older object fails.
      }
    }
  }

  await database
    .prepare("UPDATE pets SET photo_url = ?, updated_at = ? WHERE pet_id = ?")
    .bind(photoUrl, new Date().toISOString(), id)
    .run();

    return NextResponse.json({ uploaded: true, photoUrl });
  } catch (error) {
    console.error("Pet photo upload failed:", error);
    const message =
      error instanceof Error ? error.message : "Unable to upload pet photo.";
    return jsonError(message, 500);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { database } = await getAuthenticatedUser(request);

  if (!database) {
    return new NextResponse("D1 database binding DB is not configured.", { status: 500 });
  }

  const pet = await database
    .prepare("SELECT photo_url, show_photo FROM pets WHERE pet_id = ?")
    .bind(id)
    .first();

  if (!pet || !pet.photo_url || !pet.show_photo) {
    return new NextResponse("Photo not available.", { status: 404 });
  }

  const bucket = await getBucket();
  if (!bucket) {
    return new NextResponse("Pet photo storage is not configured.", { status: 500 });
  }

  const objects = await bucket.list({ prefix: `pets/${id}/profile-` });
  const object = objects.objects.sort((a: any, b: any) => String(b.uploaded).localeCompare(String(a.uploaded)))[0];

  if (!object) {
    return new NextResponse("Photo not found.", { status: 404 });
  }

  const stored = await bucket.get(object.key);
  if (!stored) {
    return new NextResponse("Photo not found.", { status: 404 });
  }

  const headers = new Headers();
  stored.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", stored.httpEtag);

  return new NextResponse(stored.body, { headers });
}
