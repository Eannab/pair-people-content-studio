import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAuthorizedUsers,
  setAuthorizedUsers,
  type UserRole,
} from "@/lib/authorized-users";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await getAuthorizedUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { email, role } = await req.json();
  if (!email || !["admin", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid email or role" }, { status: 400 });
  }
  const users = await getAuthorizedUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx >= 0) {
    users[idx].role = role as UserRole;
  } else {
    users.push({ email: email.toLowerCase().trim(), role: role as UserRole });
  }
  await setAuthorizedUsers(users);
  return NextResponse.json({ users });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  const users = await getAuthorizedUsers();
  const filtered = users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
  await setAuthorizedUsers(filtered);
  return NextResponse.json({ users: filtered });
}
