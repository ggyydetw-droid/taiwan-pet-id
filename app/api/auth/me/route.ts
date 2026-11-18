import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth";

export async function GET(request: Request) {
  const { database, user } = await getAuthenticatedUser(request);

  if (!database) {
    return NextResponse.json({ message: "D1 database binding DB is not configured." }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
}
