import { NextResponse } from "next/server";
import { clearSessionCookie, deleteCurrentSession } from "../../../lib/auth";

export async function POST(request: Request) {
  await deleteCurrentSession(request);
  const response = NextResponse.json({ loggedOut: true });
  clearSessionCookie(response);
  return response;
}
