import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const tokens = await getSession();
  return NextResponse.json({ authenticated: !!tokens });
}