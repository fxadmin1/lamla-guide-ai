"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Users } from "lucide-react";
import { isSupabaseConfigured, supabase, withAuthRetry, friendlyAuthError } from "@/lib/supabase";

interface InvitePreview {
  name: string;
  course_code: string;
  member_count: number;
  invite_code: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("registered") === "true") {
        try {
          localStorage.setItem("lamla_prompt_notifications", "1");
        } catch {}
        setMessage({
          type: "success",
          text: "Account created. Sign in below with your email and password.",
        });
      }
      const prefillEmail = params.get("email");
      if (prefillEmail) {
        setEmail(prefillEmail);
      }

      const codeFromUrl = (params.get("join") || "").trim().toUpperCase();
      let effectiveCode = codeFromUrl;
      if (!effectiveCode) {
        try {
          effectiveCode = (localStorage.getItem("lamla_pending_join_code") || "").trim().toUpperCase();
        } catch {}
      } else {
        try {
          localStorage.setItem("lamla_pending_join_code", effectiveCode);
        } catch {}
      }

      if (effectiveCode) {
        setJoinCode(effectiveCode);
        fetch(`/api/study-groups/invite/${encodeURIComponent(effectiveCode)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.group) {
              setInvitePreview(data.group);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSupabaseConfigured()) {
      try {
        const { error } = await withAuthRetry(() =>
          supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        );

        if (error) {
          setMessage({ type: "error", text: friendlyAuthError(error, "Unable to sign in.") });
        } else {
          setMessage({
            type: "success",
            text: joinCode
              ? "Signed in. Joining your class study group..."
              : "Signed in. Opening your workspace...",
          });
          setTimeout(() => {
            window.location.href = joinCode
              ? `/dashboard?join=${encodeURIComponent(joinCode)}`
              : "/dashboard";
          }, 500);
        }
      } catch (err: any) {
        setMessage({ type: "error", text: friendlyAuthError(err, "Unable to sign in.") });
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
      setMessage({
        type: "error",
        text: "Authentication service is currently unavailable. Please check your connection or contact support.",
      });
    }
  };

  const signupHref = joinCode
    ? `/auth/signup?join=${encodeURIComponent(joinCode)}`
    : "/auth/signup";

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 bg-slate-50/50">
      <div className="max-w-md w-full bg-white p-7 sm:p-9 rounded-2xl border border-slate-200 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sign in
          </h1>
          <p className="text-sm text-slate-600">
            {joinCode
              ? "Sign in to join your class study group and live quiz room."
              : "Open your study sessions, notes, and quiz workspace."}
          </p>
        </div>

        {joinCode && (
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-sm text-slate-800 flex items-start gap-2.5">
            <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-900">
                {invitePreview
                  ? `${invitePreview.name} (${invitePreview.course_code})`
                  : `Class Invite Code: ${joinCode}`}
              </p>
              <p className="text-xs text-slate-600">
                You will join this class automatically right after signing in.
              </p>
            </div>
          </div>
        )}

        {message && (
          <div
            role="status"
            className={`p-3.5 rounded-xl text-sm flex gap-2.5 items-start ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : message.type === "error"
                ? "bg-red-50 text-red-900 border border-red-200"
                : "bg-blue-50 text-blue-900 border border-blue-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  message.type === "error" ? "text-red-600" : "text-blue-600"
                }`}
              />
            )}
            <p className="leading-relaxed">{message.text}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Email address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu.gh"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in..." : joinCode ? "Sign in & join class" : "Sign in"}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href={signupHref} className="font-medium text-blue-600 hover:underline">
            Create free account
          </Link>
        </div>
      </div>
    </div>
  );
}
