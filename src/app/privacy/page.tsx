import React from "react";
import { APP_CONFIG } from "@/lib/constants";

export default function PrivacyPolicyPage() {
  return (
    <div className="w-full bg-white py-14 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <header className="space-y-2 border-b border-slate-200 pb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500">
            Last updated: October 2026 &bull; Compliant with Ghanaian Data Protection Principles
          </p>
        </header>

        <div className="space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              1. Commitment to student privacy
            </h2>
            <p>
              At <strong>{APP_CONFIG.name}</strong>, students entrust us with their lecture slides, personal notes, and study records. This policy explains what information we collect, how it is stored, and how your account remains private.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              2. Information we collect
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                <strong className="text-slate-800">Account details:</strong> Name, email address, encrypted password hash, educational level, school or institution, and course of study.
              </li>
              <li>
                <strong className="text-slate-800">Uploaded study materials:</strong> Lecture slides (PDF, PPTX), handouts, documents, and images of notes uploaded to your workspace.
              </li>
              <li>
                <strong className="text-slate-800">Study activity:</strong> Generated summaries, saved notes, flashcards, quiz attempts, scores, and exam countdown schedules.
              </li>
              <li>
                <strong className="text-slate-800">Subscription records:</strong> Mobile Money verification references for plan upgrades. We do not collect or store credit card or bank credentials.
              </li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              3. Private document isolation
            </h2>
            <p>
              Uploaded materials are stored in private buckets protected by Row Level Security (RLS). Other students cannot view or access your private documents, summaries, notes, or individual quiz history. Study group quiz slides are shared only within the live quiz room created by the group host.
            </p>
            <p>
              Your uploaded documents are used solely to generate your requested study materials and are never sold or shared with third-party advertisers.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              4. Younger students and SHS candidates
            </h2>
            <p>
              Because our platform serves Senior High School (SHS) students as well as university candidates, we minimize personal data collection:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>We collect only the details needed to organize your study workspace.</li>
              <li>Leaderboards display student names rather than email addresses or contact information.</li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              5. Data retention and deletion
            </h2>
            <p>
              You retain ownership of your uploaded files and notes. If a paid plan expires, your account reverts to the Free plan and your saved study materials remain intact. You may delete individual study sessions at any time or contact us to request full account removal.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              6. Contact
            </h2>
            <p>
              For privacy questions or account data requests, email{" "}
              <a
                href={`mailto:${APP_CONFIG.supportEmail}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {APP_CONFIG.supportEmail}
              </a>{" "}
              or message WhatsApp support at +{APP_CONFIG.adminWhatsApp}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
