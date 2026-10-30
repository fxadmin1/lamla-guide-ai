"use client";

import React, { useState } from "react";
import { MessageSquare, Mail, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";
import { APP_CONFIG, EDUCATIONAL_LEVELS } from "@/lib/constants";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    level: "university",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const adminPhone = APP_CONFIG.adminWhatsApp;
  const directWhatsAppUrl = `https://wa.me/${adminPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    "Hello LAMLA Guide AI Administrator, I have an inquiry about the platform."
  )}`;

  return (
    <div className="flex flex-col w-full bg-white text-slate-900 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Contact Support
          </h1>
          <p className="text-base text-slate-600">
            Questions about your account, subscriptions, or study tools? Reach out directly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Direct Channels */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  WhatsApp Support
                </h2>
                <p className="text-sm text-slate-600">
                  Fastest response for subscription activation and account help.
                </p>
              </div>
              <a
                href={directWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-1" />
                <div>
                  <span className="font-medium text-slate-900 block">Email</span>
                  <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-blue-600 hover:underline">
                    {APP_CONFIG.supportEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-1" />
                <div>
                  <span className="font-medium text-slate-900 block">Hours</span>
                  <span>Monday – Sunday, 8:00 AM – 10:00 PM GMT</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-1" />
                <div>
                  <span className="font-medium text-slate-900 block">Location</span>
                  <span>Accra, Ghana</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
            {submitted ? (
              <div className="py-10 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-blue-600 mx-auto" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Message received
                </h2>
                <p className="text-sm text-slate-600 max-w-sm mx-auto">
                  Thank you for reaching out. We will respond to your email within 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-sm font-medium text-blue-600 hover:underline cursor-pointer"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Send a message
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Full name
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your name"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email address
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-level" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Educational level
                  </label>
                  <select
                    id="contact-level"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {EDUCATIONAL_LEVELS.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        {lvl.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="How can we help?"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send message</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
