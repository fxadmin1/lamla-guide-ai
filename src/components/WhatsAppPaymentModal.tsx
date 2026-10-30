"use client";

import React, { useState, useEffect } from "react";
import { X, MessageSquare, Copy, Check } from "lucide-react";
import { formatGHS, buildWhatsAppLink, generateRequestRef } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/constants";

interface PlanModalProps {
  plan: {
    id: string;
    name: string;
    price: number;
    duration: string;
  };
  onClose: () => void;
  userEmail?: string;
}

export default function WhatsAppPaymentModal({ plan, onClose, userEmail }: PlanModalProps) {
  const [email, setEmail] = useState(userEmail || "");
  const [requestRef] = useState(generateRequestRef());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userEmail) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  const adminPhone = APP_CONFIG.adminWhatsApp;
  const whatsappUrl = buildWhatsAppLink({
    phone: adminPhone,
    planName: plan.name,
    price: plan.price,
    duration: plan.duration,
    email: email || "Not provided",
    requestRef: requestRef,
  });

  const messageText = `Hello LAMLA Guide Admin, I would like to subscribe to the ${plan.name} plan.

Registered email: ${email || "(enter your account email)"}
Plan: ${plan.name} (${plan.duration})
Amount: GHS ${plan.price}
Reference: ${requestRef}

Please share the Mobile Money payment instructions.`;

  const copyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <h3 id="whatsapp-modal-title" className="font-semibold text-base text-slate-900">
              Subscribe via Mobile Money
            </h3>
            <p className="text-xs text-slate-500">
              Confirm your details and send your request on WhatsApp
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Plan Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">
                {plan.name} Plan
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {plan.duration} &bull; Ref: <span className="font-mono text-slate-700">{requestRef}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-slate-900">
                {formatGHS(plan.price)}
              </div>
              <div className="text-xs text-slate-500">
                per {plan.duration.toLowerCase()}
              </div>
            </div>
          </div>

          {/* Account Email */}
          <div>
            <label
              htmlFor="payment-account-email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Account email address
            </label>
            <input
              id="payment-account-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered account email"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Use the same email as your LAMLA Guide account so your plan is activated immediately after verification.
            </p>
          </div>

          {/* Prefilled WhatsApp Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">
                Message preview (+{adminPhone})
              </span>
              <button
                type="button"
                onClick={copyMessage}
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy text"}</span>
              </button>
            </div>
            <pre className="text-xs bg-slate-50 text-slate-700 p-3.5 rounded-xl whitespace-pre-wrap font-mono leading-relaxed border border-slate-200">
              {messageText}
            </pre>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Your plan is activated once Mobile Money payment is confirmed on WhatsApp.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full sm:w-auto px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Continue on WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
