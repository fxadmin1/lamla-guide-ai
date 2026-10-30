"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  Clock,
  Search,
  Copy,
  Check,
  Calendar,
  Save,
  ArrowLeft,
} from "lucide-react";
import { formatGHS } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [copiedSql, setCopiedSql] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [editStates, setEditStates] = useState<Record<string, { planId: string; months: number }>>({});

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        window.location.href = "/auth/login?redirect=/admin";
        return;
      }

      const { data: currentProfile, error: profCheckErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profCheckErr || !currentProfile || currentProfile.role !== "admin") {
        alert("Access Denied: Administrator permissions are required.");
        window.location.href = "/dashboard";
        return;
      }

      const { data: reqData } = await supabase
        .from("subscription_requests")
        .select("*, profiles(*)")
        .order("created_at", { ascending: false });
      if (reqData) setRequests(reqData);

      const { data: profData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (profData) {
        setProfiles(profData);
        const initialEdits: Record<string, { planId: string; months: number }> = {};
        profData.forEach((p) => {
          initialEdits[p.id] = {
            planId: p.plan_id || "free",
            months: 1,
          };
        });
        setEditStates(initialEdits);
      }
    } catch (err) {
      console.error("Admin data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscription = async (userId: string, email: string) => {
    const edit = editStates[userId];
    if (!edit) return;

    setUpdatingUserId(userId);
    setConfirmationMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          userId: userId,
          email: email,
          planId: edit.planId,
          months: edit.months,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfirmationMessage(data.message);
        setProfiles((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, ...data.profile } : p))
        );
      } else {
        alert("Failed to update user: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleApproveRequest = async (req: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          userId: req.user_id,
          planId: req.plan_id,
          months: 1,
        }),
      });
      const data = await res.json();

      if (data.success) {
        await supabase
          .from("subscription_requests")
          .update({ status: "approved", reviewed_at: new Date().toISOString() })
          .eq("id", req.id);

        setRequests((prev) =>
          prev.map((r) => (r.id === req.id ? { ...r, status: "approved" } : r))
        );
        setConfirmationMessage(
          `Approved ${req.profiles?.full_name || "Student"} on ${req.plan_id.toUpperCase()} for 1 month.`
        );
        loadAdminData();
      }
    } catch (err: any) {
      alert("Failed to approve subscription: " + err?.message);
    }
  };

  const sqlAdminSnippets = `-- 1. Grant Administrator and Lifetime Premium:
SELECT public.make_user_admin('admin-email@domain.com');

-- 2. Upgrade student to Premium for 3 months:
SELECT public.set_user_subscription('student-email@domain.com', 'premium', 3);

-- 3. Upgrade student to Standard for 1 month:
SELECT public.set_user_subscription('student-email@domain.com', 'standard', 1);

-- 4. Revert student to Free tier:
SELECT public.set_user_subscription('student-email@domain.com', 'free', 0);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlAdminSnippets);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="flex-1 bg-white pb-20">
      {/* Clean White Admin Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Administration
              </h1>
              <p className="text-sm text-slate-600">
                Manage student accounts, plan durations, and Mobile Money upgrade requests.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors self-start sm:self-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Workspace</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1">
            <div className="text-xs font-medium text-slate-500">Registered students</div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "—" : profiles.length}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1">
            <div className="text-xs font-medium text-slate-500">Pending MoMo requests</div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "—" : requests.filter((r) => r.status === "pending").length}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1">
            <div className="text-xs font-medium text-slate-500">Standard subscribers</div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "—" : profiles.filter((p) => p.plan_id === "standard").length}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1">
            <div className="text-xs font-medium text-slate-500">Premium subscribers</div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "—" : profiles.filter((p) => p.plan_id === "premium").length}
            </div>
          </div>
        </div>

        {confirmationMessage && (
          <div
            role="status"
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{confirmationMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmationMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-1"
              aria-label="Dismiss notification"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Student Accounts & Subscription Control */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="admin-accounts-heading" className="text-base font-semibold text-slate-900">
                Student accounts
              </h2>
              <p className="text-sm text-slate-500">
                Assign Free, Standard, or Premium tiers and validity periods.
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="search"
                aria-label="Search students by name or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name or email..."
                className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          {profiles.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
              <Users className="w-6 h-6 mx-auto text-slate-400" />
              <p className="text-sm font-medium text-slate-700">
                {loading ? "Loading accounts..." : "No registered students found"}
              </p>
            </div>
          ) : (
            <div
              className="table-wrapper overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-labelledby="admin-accounts-heading"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-medium text-xs">
                    <th scope="col" className="py-3 px-3">Student</th>
                    <th scope="col" className="py-3 px-3">Role</th>
                    <th scope="col" className="py-3 px-3">Plan</th>
                    <th scope="col" className="py-3 px-3">Expires</th>
                    <th scope="col" className="py-3 px-3">New tier</th>
                    <th scope="col" className="py-3 px-3">Duration</th>
                    <th scope="col" className="py-3 px-3 text-right">Save</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles
                    .filter(
                      (p) =>
                        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((prof) => {
                      const edit = editStates[prof.id] || {
                        planId: prof.plan_id || "free",
                        months: 1,
                      };
                      const isExpired =
                        prof.plan_expires_at && new Date(prof.plan_expires_at) < new Date();

                      return (
                        <tr key={prof.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-3">
                            <p className="font-medium text-slate-900">
                              {prof.full_name || "Student"}
                            </p>
                            <p className="text-slate-500 text-xs">{prof.email}</p>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                prof.role === "admin"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {prof.role || "student"}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded text-xs font-medium capitalize ${
                                prof.plan_id === "premium" || prof.plan_id === "standard"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {prof.plan_id || "free"}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-xs">
                            {prof.plan_expires_at ? (
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  isExpired ? "text-red-600 font-medium" : "text-slate-600"
                                }`}
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(prof.plan_expires_at).toLocaleDateString()}
                                {isExpired && " (Expired)"}
                              </span>
                            ) : (
                              <span className="text-slate-400">No expiry</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <select
                              aria-label={`Select tier for ${prof.full_name || prof.email}`}
                              value={edit.planId}
                              onChange={(e) =>
                                setEditStates((prev) => ({
                                  ...prev,
                                  [prof.id]: { ...edit, planId: e.target.value },
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                            >
                              <option value="free">Free</option>
                              <option value="standard">Standard (GHS 49)</option>
                              <option value="premium">Premium (GHS 99)</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-3">
                            <select
                              aria-label={`Select duration for ${prof.full_name || prof.email}`}
                              value={edit.months}
                              disabled={edit.planId === "free"}
                              onChange={(e) =>
                                setEditStates((prev) => ({
                                  ...prev,
                                  [prof.id]: { ...edit, months: parseInt(e.target.value, 10) },
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 disabled:opacity-40 focus:outline-none focus:border-blue-600"
                            >
                              <option value={1}>1 month</option>
                              <option value={2}>2 months</option>
                              <option value={3}>3 months</option>
                              <option value={6}>6 months</option>
                              <option value={12}>12 months</option>
                              <option value={0}>No expiry</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              disabled={updatingUserId === prof.id}
                              onClick={() => handleUpdateSubscription(prof.id, prof.email)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs disabled:opacity-50 transition-colors"
                            >
                              {updatingUserId === prof.id ? (
                                <span>Saving...</span>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Update</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Mobile Money Requests */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 id="admin-requests-heading" className="text-base font-semibold text-slate-900">
              Mobile Money payment requests
            </h2>
            <p className="text-sm text-slate-500">
              Upgrade requests submitted via WhatsApp Mobile Money.
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
              <Clock className="w-6 h-6 mx-auto text-slate-400" />
              <p className="text-sm font-medium text-slate-700">No pending payment requests</p>
            </div>
          ) : (
            <div
              className="table-wrapper overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-labelledby="admin-requests-heading"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-medium text-xs">
                    <th scope="col" className="py-3 px-3">Student</th>
                    <th scope="col" className="py-3 px-3">Plan</th>
                    <th scope="col" className="py-3 px-3">Amount</th>
                    <th scope="col" className="py-3 px-3">WhatsApp</th>
                    <th scope="col" className="py-3 px-3">Status</th>
                    <th scope="col" className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-900">
                          {req.profiles?.full_name || "Student"}
                        </p>
                        <p className="text-slate-500 text-xs">{req.profiles?.email}</p>
                      </td>
                      <td className="py-3 px-3 font-medium capitalize">{req.plan_id}</td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {formatGHS(req.amount_ghs)}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs">{req.student_whatsapp}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            req.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : req.status === "rejected"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {req.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(req)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors"
                          >
                            Approve (1 month)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Collapsible SQL Reference */}
        <details className="bg-white rounded-xl border border-slate-200 p-5 group">
          <summary className="text-sm font-semibold text-slate-800 cursor-pointer list-none flex items-center justify-between">
            <span>Supabase SQL helper commands</span>
            <span className="text-xs font-normal text-slate-500 group-open:hidden">Show</span>
            <span className="text-xs font-normal text-slate-500 hidden group-open:inline">Hide</span>
          </summary>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-slate-600">
                Optional SQL commands for direct execution in the Supabase SQL Editor:
              </p>
              <button
                type="button"
                onClick={copySqlToClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shrink-0 transition-colors"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? "Copied" : "Copy SQL"}</span>
              </button>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs overflow-x-auto leading-relaxed">
              <pre>{sqlAdminSnippets}</pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
