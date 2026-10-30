"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Moon,
  Sun,
  Shield,
  Sliders,
  CreditCard,
  Download,
  Trash2,
  Check,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { APP_CONFIG } from "@/lib/constants";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profile: any;
  onProfileUpdated: (updated: any) => void;
}

type SettingsTab = "profile" | "appearance" | "security" | "preferences" | "subscription" | "data";

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  profile,
  onProfileUpdated,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [educationalLevel, setEducationalLevel] = useState("shs");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Appearance state
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Preferences & Study Goals state
  const [defaultQuizCount, setDefaultQuizCount] = useState(5);
  const [defaultQuizDifficulty, setDefaultQuizDifficulty] = useState("intermediate");
  const [defaultFlashcardCount, setDefaultFlashcardCount] = useState(20);
  const [dailyGoalCount, setDailyGoalCount] = useState(10);
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Data management state
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEducationalLevel(profile.educational_level || "shs");
    }
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("lamla_theme") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
      } else if (document.documentElement.classList.contains("dark")) {
        setTheme("dark");
      }

      const savedQuizCount = localStorage.getItem("lamla_pref_quiz_count");
      if (savedQuizCount) setDefaultQuizCount(Number(savedQuizCount));

      const savedDiff = localStorage.getItem("lamla_pref_quiz_diff");
      if (savedDiff) setDefaultQuizDifficulty(savedDiff);

      const savedCardCount = localStorage.getItem("lamla_pref_card_count");
      if (savedCardCount) setDefaultFlashcardCount(Number(savedCardCount));

      const savedDailyGoal = localStorage.getItem("lamla_pref_daily_goal");
      if (savedDailyGoal) setDailyGoalCount(Number(savedDailyGoal));

      const savedLbVis = localStorage.getItem("lamla_pref_leaderboard_visible");
      if (savedLbVis !== null) setLeaderboardVisible(savedLbVis !== "false");
    }
  }, [profile, isOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    setProfileSuccess(false);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          educational_level: educationalLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onProfileUpdated(data);
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 2500);
      }
    } catch (err: any) {
      alert("Failed to update profile: " + (err.message || err));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("lamla_theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage({ text: "Password must be at least 6 characters.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "Passwords do not match.", type: "error" });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMessage({ text: "Password updated.", type: "success" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage({ text: err.message || "Failed to update password.", type: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      alert(`Password reset link sent to ${user.email}`);
    } catch (err: any) {
      alert("Error sending reset email: " + (err.message || err));
    }
  };

  const handleSavePreferences = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lamla_pref_quiz_count", String(defaultQuizCount));
      localStorage.setItem("lamla_pref_quiz_diff", defaultQuizDifficulty);
      localStorage.setItem("lamla_pref_card_count", String(defaultFlashcardCount));
      localStorage.setItem("lamla_pref_daily_goal", String(dailyGoalCount));
      localStorage.setItem("lamla_pref_leaderboard_visible", String(leaderboardVisible));
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [summariesRes, notesRes, decksRes] = await Promise.all([
        supabase.from("summaries").select("*").eq("user_id", user.id),
        supabase.from("study_notes").select("*").eq("user_id", user.id),
        supabase.from("flashcard_decks").select("*").eq("user_id", user.id),
      ]);

      const exportBundle = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        user_name: profile?.full_name || user.email,
        summaries: summariesRes.data || [],
        study_notes: notesRes.data || [],
        flashcard_decks: decksRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lamla_guide_study_archive_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export library data: " + (err.message || err));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!user) return;
    try {
      const { data: userDecks } = await supabase.from("flashcard_decks").select("id").eq("user_id", user.id);
      if (userDecks && userDecks.length > 0) {
        const deckIds = userDecks.map((d: any) => d.id);
        await supabase.from("flashcards").delete().in("deck_id", deckIds);
      }
      await supabase.from("flashcard_decks").delete().eq("user_id", user.id);

      const { data: userQuizzes } = await supabase.from("quizzes").select("id").eq("user_id", user.id);
      if (userQuizzes && userQuizzes.length > 0) {
        const quizIds = userQuizzes.map((q: any) => q.id);
        await supabase.from("quiz_questions").delete().in("quiz_id", quizIds);
        await supabase.from("quiz_attempts").delete().in("quiz_id", quizIds);
      }
      await supabase.from("quiz_attempts").delete().eq("user_id", user.id);
      await supabase.from("quizzes").delete().eq("user_id", user.id);

      await supabase.from("summaries").delete().eq("user_id", user.id);
      await supabase.from("study_notes").delete().eq("user_id", user.id);
      await supabase.from("documents").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);

      await supabase.auth.signOut();
      window.location.href = "/auth/login";
    } catch (err: any) {
      alert("Error deleting account data: " + (err.message || err));
    }
  };

  if (!isOpen) return null;

  const navItems: { id: SettingsTab; label: string; icon: any }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Sun },
    { id: "security", label: "Security", icon: Shield },
    { id: "preferences", label: "Study defaults", icon: Sliders },
    { id: "subscription", label: "Plan & billing", icon: CreditCard },
    { id: "data", label: "Data & privacy", icon: Download },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-lg flex flex-col md:flex-row max-h-[88vh] overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-56 bg-slate-50 dark:bg-slate-950/60 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <h3 id="settings-modal-title" className="text-sm font-semibold text-slate-900 dark:text-white px-2 mb-4">
              Settings
            </h3>

            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible no-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left shrink-0 ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:block pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 px-2">
            {APP_CONFIG.shortName}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB 1: PROFILE */}
            {activeTab === "profile" && (
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                <div>
                  <label htmlFor="settings-fullname" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full name
                  </label>
                  <input
                    id="settings-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="settings-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="settings-level" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Academic level
                  </label>
                  <select
                    id="settings-level"
                    value={educationalLevel}
                    onChange={(e) => setEducationalLevel(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="shs">Senior High School (SHS / WASSCE)</option>
                    <option value="undergraduate">University / Undergraduate</option>
                    <option value="postgraduate">Postgraduate (Masters / PhD)</option>
                    <option value="professional">Professional Licensure (Nursing, Law, Accounting)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50 transition-colors"
                  >
                    {profileSaving ? "Saving..." : "Save changes"}
                  </button>
                  {profileSuccess && (
                    <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Saved
                    </span>
                  )}
                </div>
              </form>
            )}

            {/* TAB 2: APPEARANCE */}
            {activeTab === "appearance" && (
              <div className="space-y-3 max-w-md">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose how your study workspace looks.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleThemeChange("light")}
                    className={`p-4 rounded-xl border text-left transition-colors space-y-2 ${
                      theme === "light"
                        ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-600"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <Sun className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <div>
                      <div className="font-medium text-sm text-slate-900 dark:text-white">Light</div>
                      <div className="text-xs text-slate-500">Clean white workspace</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange("dark")}
                    className={`p-4 rounded-xl border text-left transition-colors space-y-2 ${
                      theme === "dark"
                        ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-600"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <div>
                      <div className="font-medium text-sm text-slate-900 dark:text-white">Dark</div>
                      <div className="text-xs text-slate-500">Low-glare night mode</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: SECURITY */}
            {activeTab === "security" && (
              <div className="space-y-6 max-w-md">
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label htmlFor="sec-new-pass" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      New password
                    </label>
                    <input
                      id="sec-new-pass"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      placeholder="At least 6 characters"
                    />
                  </div>

                  <div>
                    <label htmlFor="sec-confirm-pass" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm new password
                    </label>
                    <input
                      id="sec-confirm-pass"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      placeholder="Re-enter password"
                    />
                  </div>

                  {passwordMessage && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        passwordMessage.type === "success"
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          : "bg-red-50 text-red-900 border border-red-200"
                      }`}
                    >
                      {passwordMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50 transition-colors"
                  >
                    {passwordLoading ? "Updating..." : "Update password"}
                  </button>
                </form>

                <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white">Email recovery link</h4>
                  <p className="text-xs text-slate-500">
                    Send a password reset link directly to your registered email address.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendResetEmail}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors"
                  >
                    Send reset link
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: STUDY DEFAULTS */}
            {activeTab === "preferences" && (
              <div className="space-y-6 max-w-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pref-daily-goal" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Daily practice target
                    </label>
                    <select
                      id="pref-daily-goal"
                      value={dailyGoalCount}
                      onChange={(e) => setDailyGoalCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    >
                      <option value={5}>5 questions / day</option>
                      <option value={10}>10 questions / day</option>
                      <option value={20}>20 questions / day</option>
                      <option value={30}>30 questions / day</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="pref-leaderboard" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Leaderboard visibility
                    </label>
                    <select
                      id="pref-leaderboard"
                      value={leaderboardVisible ? "visible" : "anonymous"}
                      onChange={(e) => setLeaderboardVisible(e.target.value === "visible")}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="visible">Show my display name</option>
                      <option value="anonymous">Show as Anonymous Student</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white">Generation defaults</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="pref-quiz-count" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Quiz questions
                      </label>
                      <select
                        id="pref-quiz-count"
                        value={defaultQuizCount}
                        onChange={(e) => setDefaultQuizCount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                      >
                        <option value={5}>5 questions</option>
                        <option value={10}>10 questions</option>
                        <option value={20}>20 questions</option>
                        <option value={50}>50 questions</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="pref-quiz-diff" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Difficulty
                      </label>
                      <select
                        id="pref-quiz-diff"
                        value={defaultQuizDifficulty}
                        onChange={(e) => setDefaultQuizDifficulty(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                      >
                        <option value="easy">Foundational</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="difficult">Difficult</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="pref-cards" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Flashcard deck size
                      </label>
                      <select
                        id="pref-cards"
                        value={defaultFlashcardCount}
                        onChange={(e) => setDefaultFlashcardCount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                      >
                        <option value={10}>10 cards</option>
                        <option value={20}>20 cards</option>
                        <option value={30}>30 cards</option>
                        <option value={50}>50 cards</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSavePreferences}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                    >
                      Save defaults
                    </button>
                    {prefsSaved && (
                      <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Saved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SUBSCRIPTION */}
            {activeTab === "subscription" && (
              <div className="space-y-5 max-w-lg">
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs font-medium text-slate-500">Current plan</div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                    {profile?.plan_id || "Free"} Plan
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Includes slide parsing, study summaries, flashcards, and timed quizzes.
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                    Need higher limits?
                  </h4>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Larger file uploads and more active study sessions</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Expanded flashcard decks and full-length mock quizzes</span>
                    </li>
                  </ul>

                  <a
                    href={`https://wa.me/${APP_CONFIG.adminWhatsApp}?text=${encodeURIComponent(
                      "Hello LAMLA Guide Admin, I would like to upgrade my account plan."
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                  >
                    <span>Upgrade via WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* TAB 6: DATA & PRIVACY */}
            {activeTab === "data" && (
              <div className="space-y-5 max-w-lg">
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Export study archive</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Download a JSON backup of your summaries, saved notes, and flashcard decks.
                  </p>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportData}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-medium text-sm inline-flex items-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exporting ? "Exporting..." : "Download archive"}</span>
                  </button>
                </div>

                <div className="p-5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 space-y-3">
                  <h4 className="font-semibold text-sm text-red-900 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Delete account</span>
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Permanently erase your profile, uploaded files, and study history. This cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm inline-flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{confirmDelete ? "Click again to confirm deletion" : "Delete my account"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
