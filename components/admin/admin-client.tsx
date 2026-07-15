"use client";

import { useCallback, useEffect, useState } from "react";
import { USER_ROLES, type UserRole } from "@/lib/constants";
import type { Profile } from "@/lib/types";

type AdminUser = Pick<Profile, "id" | "email" | "full_name" | "role" | "active" | "created_at">;

// Readable starting password (mirrors the server generator; no ambiguous chars).
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length])
    .join("")
    .replace(/(.{4})(?=.)/g, "$1-");
}

export function AdminClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [password, setPassword] = useState(generatePassword());
  const [creating, setCreating] = useState(false);

  // one-time password reveal after create/reset
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/users");
    const body = await res.json();
    if (!res.ok) setError(body.error ?? "Failed to load users");
    else setUsers(body.users);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, role, password }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create user");
      return;
    }
    setReveal({ email, password });
    setEmail("");
    setFullName("");
    setRole("viewer");
    setPassword(generatePassword());
    load();
  }

  async function changeRole(id: string, newRole: UserRole) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) setError((await res.json()).error);
    else load();
  }

  async function toggleActive(u: AdminUser) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!res.ok) setError((await res.json()).error);
    else load();
  }

  async function resetPassword(u: AdminUser) {
    const res = await fetch(`/api/admin/users/${u.id}/password`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) setError(body.error);
    else setReveal({ email: u.email, password: body.password });
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`Delete ${u.email}? This removes their account entirely.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json()).error);
    else load();
  }

  const labelCls = "block font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mb-1.5";
  const inputCls =
    "w-full px-2.5 py-2 border border-rule bg-[#FBFAF6] text-ink text-[13px] focus:border-ink focus:outline-none";

  return (
    <div className="max-w-3xl">
      <h2 className="font-serif text-[22px] font-medium mb-1">Users</h2>
      <p className="text-[12px] text-ink-60 mb-6 leading-relaxed">
        Create accounts, set roles, reset passwords, deactivate or delete.
        Deactivating bans the login <em>and</em> revokes read access. Deleting removes
        the account entirely. Editors (Haley, Savannah, Kady) can edit; viewers
        (Matt, Homestead, Eric) read only.
      </p>

      {error && (
        <div className="border-l-[3px] border-gate bg-[rgba(159,18,57,0.05)] px-3 py-2 text-[12px] text-gate mb-4">
          {error}
        </div>
      )}

      {reveal && (
        <div className="border border-ink bg-paper-2 p-4 mb-6">
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-60 mb-2">
            Starting password for {reveal.email} — shown once, copy it now
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="font-mono text-[15px] font-bold tracking-wide">{reveal.password}</code>
            <button
              onClick={() => navigator.clipboard?.writeText(reveal.password)}
              className="border border-ink px-3 py-1 text-[12px] hover:bg-ink hover:text-paper"
            >
              Copy
            </button>
            <button
              onClick={() => setReveal(null)}
              className="border border-rule px-3 py-1 text-[12px] text-ink-60 hover:border-ink hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* create */}
      <form onSubmit={createUser} className="border border-rule p-4 mb-8 bg-[#FBFAF6]">
        <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mb-3">
          Create user
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Starting password</label>
            <div className="flex gap-2">
              <input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="border border-ink px-2 text-[11px] whitespace-nowrap hover:bg-ink hover:text-paper"
              >
                New
              </button>
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="mt-4 bg-ink text-paper px-4 py-2 text-[13px] font-medium hover:bg-black disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create user"}
        </button>
      </form>

      {/* list */}
      {loading ? (
        <div className="text-[13px] text-ink-60 py-8">Loading users…</div>
      ) : (
        <div className="border border-ink overflow-x-auto bg-[#FBFAF6]">
          <table className="w-full border-collapse text-[13px] min-w-[640px]">
            <thead>
              <tr>
                {["User", "Role", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="bg-ink text-paper font-mono text-[9.5px] font-medium tracking-[0.11em] uppercase text-left px-2.5 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-rule">
                  <td className="px-2.5 py-2">
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="font-mono text-[11px] text-ink-60">{u.email}</div>
                  </td>
                  <td className="px-2.5 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                      disabled={u.id === currentUserId}
                      className="font-mono text-[10px] uppercase border border-transparent hover:border-rule bg-transparent py-1 disabled:opacity-60"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2.5 py-2">
                    <span
                      className={`font-mono text-[10px] tracking-[0.06em] uppercase ${
                        u.active ? "text-ink-60" : "text-gate"
                      }`}
                    >
                      {u.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      <button
                        onClick={() => resetPassword(u)}
                        className="border border-rule px-2 py-1 text-[11px] text-ink-60 hover:border-ink hover:text-ink"
                      >
                        Reset pw
                      </button>
                      {u.id !== currentUserId && (
                        <>
                          <button
                            onClick={() => toggleActive(u)}
                            className="border border-rule px-2 py-1 text-[11px] text-ink-60 hover:border-ink hover:text-ink"
                          >
                            {u.active ? "Deactivate" : "Reactivate"}
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            className="border border-gate px-2 py-1 text-[11px] text-gate hover:bg-gate hover:text-paper"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
