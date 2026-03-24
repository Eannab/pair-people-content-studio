"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import type { AuthorizedUser } from "@/lib/authorized-users";

const NAVY = "#323B6A";
const GREEN = "#BDCF7C";
const PALE = "#E7EDF3";
const BLUE = "#6F92BF";
const LIGHT_BLUE = "#A7B8D1";

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAdmin = session?.role === "admin";

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) { setLoading(false); return; }
    fetch("/api/settings/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  }, [status, isAdmin]);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json();
      setUsers(data.users);
      setNewEmail("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (email: string) => {
    if (!confirm(`Remove ${email}?`)) return;
    try {
      const res = await fetch("/api/settings/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setUsers(data.users);
    } catch {
      alert("Failed to remove user");
    }
  };

  const changeRole = async (email: string, role: "admin" | "viewer") => {
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setUsers(data.users);
    } catch {
      alert("Failed to update role");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: PALE }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: NAVY, borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: PALE }}>
        <p style={{ color: BLUE }}>Not signed in.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: PALE }}>
        <div className="text-center max-w-sm px-6">
          <p className="text-base font-semibold mb-2" style={{ color: NAVY, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
            Access Denied
          </p>
          <p className="text-sm mb-4" style={{ color: BLUE }}>Admin access required.</p>
          <button onClick={() => window.history.back()} className="text-sm" style={{ color: LIGHT_BLUE }}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALE }}>
      {/* Top bar */}
      <div
        className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-6 border-b z-50"
        style={{ backgroundColor: "#FFFFFF", borderColor: PALE }}
      >
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 text-sm"
            style={{ color: LIGHT_BLUE, textDecoration: "none" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to app
          </a>
          <span style={{ color: PALE }}>|</span>
          <span
            className="text-sm font-semibold"
            style={{ color: NAVY, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            User Management
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
          className="text-xs"
          style={{ color: LIGHT_BLUE }}
        >
          Sign out
        </button>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8 pt-20">
        <div className="mb-8">
          <h1
            className="text-2xl mb-1"
            style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 700, color: NAVY }}
          >
            Users
          </h1>
          <p className="text-sm" style={{ color: BLUE }}>
            Manage who can access Content Studio and their role.
          </p>
        </div>

        {/* Add user form */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${PALE}` }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: NAVY, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
          >
            Add user
          </h2>
          <form onSubmit={addUser} className="flex gap-3 flex-wrap">
            <input
              type="email"
              placeholder="email@pairpeople.com.au"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="flex-1 min-w-0 text-sm px-3 py-2.5 rounded-xl outline-none"
              style={{
                border: `1.5px solid ${PALE}`,
                backgroundColor: "#FAFBFC",
                color: NAVY,
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = GREEN; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = PALE; }}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
              className="text-sm px-3 py-2.5 rounded-xl outline-none font-semibold"
              style={{
                border: `1.5px solid ${PALE}`,
                backgroundColor: "#FAFBFC",
                color: NAVY,
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                cursor: "pointer",
              }}
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: saving ? PALE : NAVY,
                color: saving ? LIGHT_BLUE : "#FFFFFF",
                fontFamily: "var(--font-poppins), Poppins, sans-serif",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </form>
          {saveError && (
            <p className="text-xs mt-2" style={{ color: "#CC4444" }}>{saveError}</p>
          )}
          <p className="text-xs mt-3" style={{ color: LIGHT_BLUE }}>
            Note: role changes take effect at the user&apos;s next sign-in.
          </p>
        </div>

        {/* Users list */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${PALE}` }}
        >
          {error ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: "#CC4444" }}>{error}</p>
          ) : users.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: LIGHT_BLUE }}>No users yet.</p>
          ) : (
            <ul>
              {users.map((user, i) => (
                <li
                  key={user.email}
                  className="flex items-center gap-4 px-6 py-4"
                  style={{
                    borderBottom: i < users.length - 1 ? `1px solid ${PALE}` : "none",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: NAVY, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
                    >
                      {user.email}
                    </p>
                  </div>
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user.email, e.target.value as "admin" | "viewer")}
                    className="text-xs px-2 py-1.5 rounded-lg outline-none font-semibold"
                    style={{
                      backgroundColor: user.role === "admin" ? "#323B6A" : PALE,
                      color: user.role === "admin" ? "#FFFFFF" : BLUE,
                      border: "none",
                      fontFamily: "var(--font-poppins), Poppins, sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => removeUser(user.email)}
                    disabled={user.email === session.user?.email}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
                    style={{
                      color: user.email === session.user?.email ? PALE : LIGHT_BLUE,
                      cursor: user.email === session.user?.email ? "not-allowed" : "pointer",
                    }}
                    title={user.email === session.user?.email ? "Cannot remove yourself" : "Remove user"}
                    onMouseEnter={(e) => {
                      if (user.email !== session.user?.email) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFF0F0";
                        (e.currentTarget as HTMLButtonElement).style.color = "#CC4444";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color = user.email === session.user?.email ? PALE : LIGHT_BLUE;
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
