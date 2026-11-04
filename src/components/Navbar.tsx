"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, Menu, X, LogOut, QrCode, Download, Copy, Check } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const LIVE_PLATFORM_URL = "https://lamla-guide-ai.onrender.com";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleCopyLiveLink = async () => {
    try {
      await navigator.clipboard.writeText(LIVE_PLATFORM_URL);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      setUser(null);
      setMobileMenuOpen(false);
      router.push("/auth/login");
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2.5 rounded-lg py-1"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-semibold text-base tracking-tight text-slate-900">
              LAMLA Guide
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!user && (
            <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm transition-colors ${
                      isActive
                        ? "text-blue-600 font-semibold"
                        : "text-slate-600 hover:text-slate-900 font-medium"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              title="Scan QR Code to Join"
            >
              <QrCode className="w-4 h-4" />
              <span>QR Code</span>
            </button>
            {user ? (
              <>
                <span className="text-sm text-slate-500 max-w-[180px] truncate">
                  {user.email}
                </span>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Workspace
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-lg transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
              aria-label="Show QR Code"
              title="Scan QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <Link
              href={user ? "/dashboard" : "/auth/signup"}
              className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              {user ? "Workspace" : "Get started"}
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
          {user ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 truncate px-2">{user.email}</p>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full py-2.5 px-3 text-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Open Workspace
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full py-2.5 px-3 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          ) : (
            <>
              <nav aria-label="Mobile" className="flex flex-col space-y-1">
                {NAV_LINKS.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-3 py-2 text-sm rounded-lg ${
                        isActive
                          ? "text-blue-600 bg-blue-50 font-semibold"
                          : "text-slate-700 hover:bg-slate-50 font-medium"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 px-3 text-center text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 px-3 text-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Get started
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {/* QR Code Share Modal */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setQrModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close QR Modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <QrCode className="w-3.5 h-3.5" />
              <span>SCAN TO JOIN LAMLA GUIDE AI</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Share with Classmates</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Point any phone camera at this QR code to open the live study platform immediately.
            </p>
            <div className="mx-auto w-56 h-56 rounded-xl border-2 border-blue-600 p-2 bg-white shadow-sm">
              <img
                src="/lamla_guide_ai_qr_code.png"
                alt="LAMLA Guide AI Live QR Code"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="mt-3 text-xs font-mono text-slate-600 bg-slate-100 rounded-lg py-1.5 px-2.5 truncate">
              {LIVE_PLATFORM_URL}
            </p>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <button
                type="button"
                onClick={handleCopyLiveLink}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
              </button>
              <a
                href="/lamla_guide_ai_qr_poster.png"
                download="LAMLA_Guide_AI_QR_Poster.png"
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Poster</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
