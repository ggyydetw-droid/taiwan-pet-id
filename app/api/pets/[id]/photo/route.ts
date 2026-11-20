import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

async function db() {
  const { env } = getCloudflareContext();
  return (env as any).DB;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const database = await db();

  if (!database) {
    return new NextResponse("Database not configured.", { status: 500 });
  }

  const row = await database
    .prepare("SELECT photo_url, show_photo FROM pets WHERE pet_id = ?")
    .bind(id)
    .first();

  if (!row || !row.show_photo || !row.photo_url) {
    return new NextResponse("Photo not found.", { status: 404 });
  }

  let photoUrl: URL;
  try {
    photoUrl = new URL(String(row.photo_url));
  } catch {
    return new NextResponse("Invalid photo URL.", { status: 400 });
  }

  if (photoUrl.protocol !== "https:" && photoUrl.protocol !== "http:") {
    return new NextResponse("Unsupported photo URL.", { status: 400 });
  }

  try {
    const response = await fetch(photoUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return new NextResponse("Unable to load pet photo.", { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse("Photo URL does not point to an image.", { status: 415 });
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=300, s-maxage=300");

    return new NextResponse(response.body, { status: 200, headers });
  } catch {
    return new NextResponse("Unable to load pet photo.", { status: 502 });
  }
}
