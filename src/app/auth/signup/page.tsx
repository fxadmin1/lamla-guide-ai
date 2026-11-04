"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Bell, CheckCircle2, Eye, EyeOff, Users } from "lucide-react";
import { EDUCATIONAL_LEVELS } from "@/lib/constants";
import { isSupabaseConfigured, supabase, friendlyAuthError } from "@/lib/supabase";
import {
  requestBrowserNotificationPermission,
  triggerStudyNotification,
} from "@/lib/studyScheduler";

interface InvitePreview {
  name: string;
  course_code: string;
  member_count: number;
  invite_code: string;
}

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    educationalLevel: "shs",
    institution: "",
    programme: "",
    country: "Ghana",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [postSignupTargetUrl, setPostSignupTargetUrl] = useState<string | null>(null);
  const [requestingNotif, setRequestingNotif] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
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

  const proceedAfterNotificationPrompt = (targetUrl: string) => {
    window.location.href = targetUrl;
  };

  const handleEnableNotificationsNow = async () => {
    if (!postSignupTargetUrl) return;
    setRequestingNotif(true);
    try {
      const granted = await requestBrowserNotificationPermission();
      try {
        localStorage.removeItem("lamla_prompt_notifications");
      } catch {}
      if (granted) {
        triggerStudyNotification(
          "Welcome to LAMLA Guide AI",
          "Browser notifications are enabled for scheduled live quizzes and study reminders."
        );
      }
    } catch {
      // Proceed gracefully even if browser blocks notifications
    } finally {
      setRequestingNotif(false);
      proceedAfterNotificationPrompt(postSignupTargetUrl);
    }
  };

  const handleSkipNotificationsNow = () => {
    if (!postSignupTargetUrl) return;
    try {
      localStorage.removeItem("lamla_prompt_notifications");
    } catch {}
    proceedAfterNotificationPrompt(postSignupTargetUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              educational_level: formData.educationalLevel,
              institution: formData.institution,
              programme: formData.programme,
              country: formData.country,
              role: "student",
            },
          },
        });

        if (error) {
          setMessage({ type: "error", text: friendlyAuthError(error, "Unable to create account.") });
        } else {
          const nextUrl = data?.session
            ? joinCode
              ? `/dashboard?join=${encodeURIComponent(joinCode)}`
              : "/dashboard"
            : `/auth/login?registered=true&email=${encodeURIComponent(formData.email)}${
                joinCode ? `&join=${encodeURIComponent(joinCode)}` : ""
              }`;

          try {
            localStorage.setItem("lamla_prompt_notifications", "1");
          } catch {}

          // Ask the user right after account creation if they want to enable browser notifications
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
            setPostSignupTargetUrl(nextUrl);
          } else {
            setMessage({
              type: "success",
              text: "Account created. Opening your workspace...",
            });
            setTimeout(() => {
              window.location.href = nextUrl;
            }, 700);
          }
        }
      } catch (err: any) {
        setMessage({ type: "error", text: friendlyAuthError(err, "An unexpected error occurred.") });
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
      setMessage({
        type: "error",
        text: "Registration service is currently unavailable. Please check your connection or contact support.",
      });
    }
  };

  const loginHref = joinCode
    ? `/auth/login?join=${encodeURIComponent(joinCode)}`
    : "/auth/login";

  if (postSignupTargetUrl) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 bg-slate-50/50">
        <div className="max-w-md w-full bg-white p-7 sm:p-9 rounded-2xl border border-slate-200 space-y-6 text-center">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <Bell className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Account created — enable notifications?
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Get browser alerts when a scheduled class quiz starts and when your daily study reminder is due.
            </p>
          </div>
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={requestingNotif}
              onClick={handleEnableNotificationsNow}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {requestingNotif ? "Requesting permission..." : "Enable browser notifications"}
            </button>
            <button
              type="button"
              disabled={requestingNotif}
              onClick={handleSkipNotificationsNow}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
            >
              Not now, continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 bg-slate-50/50">
      <div className="max-w-lg w-full bg-white p-7 sm:p-9 rounded-2xl border border-slate-200 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-slate-600">
            {joinCode
              ? "Create your free account to join this class study group and participate in live quizzes."
              : "Start with the Free plan to upload lecture slides, generate summaries, and take timed quizzes."}
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
                You will automatically join this study group right after creating your account.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="signup-name"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Full name
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Your full name"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="signup-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@university.edu.gh"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="At least 6 characters"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="signup-level"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Educational level
              </label>
              <select
                id="signup-level"
                name="educational_level"
                value={formData.educationalLevel}
                onChange={(e) => setFormData({ ...formData, educationalLevel: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              >
                {EDUCATIONAL_LEVELS.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="signup-institution"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                School or institution
              </label>
              <input
                id="signup-institution"
                name="organization"
                type="text"
                autoComplete="organization"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="e.g. University of Ghana, KNUST"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="signup-programme"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Programme or course <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="signup-programme"
              name="programme"
              type="text"
              value={formData.programme}
              onChange={(e) => setFormData({ ...formData, programme: e.target.value })}
              placeholder="e.g. General Science, Economics, Nursing"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Creating account..." : joinCode ? "Create account & join class" : "Create free account"}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
