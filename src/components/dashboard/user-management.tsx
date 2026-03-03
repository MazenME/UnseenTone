"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getUsers,
  banUser,
  unbanUser,
  deleteUser,
  listNovels,
  getNovelAssignments,
  setAdminRole,
} from "@/app/dashboard/moderation/actions";
import { useAuth } from "@/components/providers/auth-provider";

interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_banned: boolean;
  ban_reason: string | null;
  last_ip_address: string | null;
  created_at: string;
}

type NovelRef = { id: string; title: string };

type FilterType = "all" | "banned" | "admin";

export default function UserManagement() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin" || profile?.role === "admin";

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal]  = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banModal, setBanModal] = useState<{ userId: string; name: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [novels, setNovels] = useState<NovelRef[]>([]);
  const [adminModal, setAdminModal] = useState<{
    userId: string;
    name: string;
    role: "super_admin" | "novel_admin" | "reader" | "admin";
    selected: Set<string>;
    loading: boolean;
    error?: string;
  } | null>(null);

  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await getUsers({ page, pageSize, filter, search });
    setUsers(result.users as User[]);
    setTotal(result.total);
    setLoading(false);
  }, [page, pageSize, filter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleBan = async () => {
    if (!banModal) return;
    setActionLoading(banModal.userId);
    await banUser(banModal.userId, banReason || undefined);
    setBanModal(null);
    setBanReason("");
    await fetchUsers();
    setActionLoading(null);
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(userId);
    await unbanUser(userId);
    await fetchUsers();
    setActionLoading(null);
  };

  const handleDeleteUser = async (userId: string) => {
    setActionLoading(userId);
    await deleteUser(userId);
    setConfirmDeleteUser(null);
    await fetchUsers();
    setActionLoading(null);
  };

  const openAdminModal = async (user: User) => {
    if (!isSuperAdmin) return;
    const normalizedRole = (user.role === "admin" ? "super_admin" : user.role) as
      | "super_admin"
      | "novel_admin"
      | "reader";
    setAdminModal({
      userId: user.id,
      name: user.display_name || user.email,
      role: normalizedRole,
      selected: new Set<string>(),
      loading: true,
    });

    const [novelRes, assignmentRes] = await Promise.all([listNovels(), getNovelAssignments(user.id)]);
    setNovels(novelRes.novels || []);
    setAdminModal((prev) =>
      prev
        ? {
            ...prev,
            selected: new Set<string>((assignmentRes.novelIds || []) as string[]),
            loading: false,
            error: assignmentRes.error || novelRes.error,
          }
        : null
    );
  };

  const toggleNovelSelection = (id: string) => {
    if (!adminModal) return;
    const next = new Set(adminModal.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setAdminModal({ ...adminModal, selected: next });
  };

  const saveAdminModal = async () => {
    if (!adminModal) return;
    setActionLoading(adminModal.userId);
    const role = adminModal.role === "admin" ? "super_admin" : adminModal.role;
    const novelIds = role === "novel_admin" ? Array.from(adminModal.selected) : [];
    const res = await setAdminRole({ userId: adminModal.userId, role, novelIds });
    setActionLoading(null);
    if (res?.error) {
      setAdminModal({ ...adminModal, error: res.error });
      return;
    }
    setAdminModal(null);
    await fetchUsers();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email or name..."
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex gap-1 bg-bg border border-border rounded-lg p-1">
          {(["all", "banned", "admin"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="text-xs text-fg-muted">
        {total} user{total !== 1 ? "s" : ""} found
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
          <div className="animate-pulse text-fg-muted">Loading users...</div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
          <p className="text-fg-muted">No users found.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-muted uppercase tracking-wider">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3 hidden md:table-cell">Role</th>
                  <th className="px-4 py-3 hidden sm:table-cell">IP Address</th>
                  <th className="px-4 py-3 hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-b border-border/50 last:border-0 ${
                        user.is_banned ? "bg-red-500/5" : ""
                      }`}
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-bold text-accent">
                                {(user.display_name || user.email)[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-fg truncate max-w-[120px] sm:max-w-[200px]">
                              {user.display_name || "—"}
                            </div>
                            <div className="text-xs text-fg-muted truncate max-w-[120px] sm:max-w-[200px]">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {(() => {
                          const normalizedRole = user.role === "admin" ? "super_admin" : user.role;
                          const styles =
                            normalizedRole === "super_admin"
                              ? "bg-purple-500/20 text-purple-300"
                              : normalizedRole === "novel_admin"
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-bg text-fg-muted";
                          const label =
                            normalizedRole === "super_admin"
                              ? "Super Admin"
                              : normalizedRole === "novel_admin"
                              ? "Novel Admin"
                              : "Reader";
                          return (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${styles}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs font-mono text-fg-muted">
                          {user.last_ip_address || "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {user.is_banned ? (
                          <div>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                              Banned
                            </span>
                            {user.ban_reason && (
                              <div className="text-[11px] text-fg-muted mt-1 max-w-[150px] truncate" title={user.ban_reason}>
                                {user.ban_reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-fg-muted">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {isSuperAdmin && (
                            <button
                              onClick={() => openAdminModal(user)}
                              className="px-3 py-1 text-xs rounded-md bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 transition-colors"
                            >
                              Manage Access
                            </button>
                          )}

                          {(() => {
                            const normalizedRole = user.role === "admin" ? "super_admin" : user.role;
                            const isTargetAdmin = normalizedRole === "super_admin" || normalizedRole === "novel_admin";

                            if (isTargetAdmin) return null;

                            return user.is_banned ? (
                              <button
                                onClick={() => handleUnban(user.id)}
                                disabled={actionLoading === user.id}
                                className="px-3 py-1 text-xs rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "..." : "Unban"}
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  setBanModal({
                                    userId: user.id,
                                    name: user.display_name || user.email,
                                  })
                                }
                                className="px-3 py-1 text-xs rounded-md bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-colors"
                              >
                                Ban
                              </button>
                            );
                          })()}

                          {(() => {
                            const normalizedRole = user.role === "admin" ? "super_admin" : user.role;
                            const isTargetAdmin = normalizedRole === "super_admin" || normalizedRole === "novel_admin";
                            if (isTargetAdmin) return null;

                            return confirmDeleteUser === user.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={actionLoading === user.id}
                                  className="px-3 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                  {actionLoading === user.id ? "..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteUser(null)}
                                  className="px-3 py-1 text-xs rounded-md bg-bg text-fg-muted hover:text-fg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteUser(user.id)}
                                className="px-3 py-1 text-xs rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                              >
                                Delete
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-md bg-surface border border-border text-fg-muted hover:text-fg disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-fg-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-md bg-surface border border-border text-fg-muted hover:text-fg disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Admin Role Modal */}
      <AnimatePresence>
        {adminModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setAdminModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl p-6 w-full max-w-lg"
            >
              <h3 className="text-lg font-bold text-fg mb-1">Manage Access</h3>
              <p className="text-sm text-fg-muted mb-4">{adminModal.name}</p>

              <div className="space-y-3">
                {["super_admin", "novel_admin", "reader"].map((r) => (
                  <label key={r} className="flex items-center gap-3 text-sm text-fg cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={adminModal.role === r}
                      onChange={() => setAdminModal({ ...adminModal, role: r as any })}
                      className="accent-accent"
                    />
                    <span className="font-medium">
                      {r === "super_admin" ? "Super Admin" : r === "novel_admin" ? "Novel Admin" : "Reader"}
                    </span>
                    <span className="text-fg-muted text-xs">
                      {r === "super_admin"
                        ? "Full access to everything"
                        : r === "novel_admin"
                        ? "Limited to selected novels"
                        : "No admin privileges"}
                    </span>
                  </label>
                ))}
              </div>

              {adminModal.role === "novel_admin" && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-fg">Allowed novels</div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {novels.length === 0 ? (
                      <div className="text-sm text-fg-muted">No novels found.</div>
                    ) : (
                      novels.map((n) => (
                        <label key={n.id} className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={adminModal.selected.has(n.id)}
                            onChange={() => toggleNovelSelection(n.id)}
                            className="accent-accent"
                          />
                          <span>{n.title}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {adminModal.error && (
                <div className="mt-3 text-sm text-red-400">{adminModal.error}</div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setAdminModal(null)}
                  className="px-4 py-2 text-sm rounded-lg bg-bg border border-border text-fg-muted hover:text-fg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAdminModal}
                  disabled={actionLoading === adminModal.userId || (adminModal.role === "novel_admin" && adminModal.selected.size === 0)}
                  className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {actionLoading === adminModal.userId ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ban Modal */}
      <AnimatePresence>
        {banModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setBanModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-bold text-fg mb-1">Ban User</h3>
              <p className="text-sm text-fg-muted mb-4">
                Are you sure you want to ban{" "}
                <strong className="text-fg">{banModal.name}</strong>? They will be
                signed out on their next request and unable to comment or interact.
              </p>

              <label className="block text-sm font-medium text-fg mb-1">
                Reason (optional)
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Spam, harassment, inappropriate content..."
                rows={3}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none mb-4"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setBanModal(null);
                    setBanReason("");
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-bg border border-border text-fg-muted hover:text-fg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBan}
                  disabled={actionLoading === banModal.userId}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === banModal.userId ? "Banning..." : "Ban User"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
