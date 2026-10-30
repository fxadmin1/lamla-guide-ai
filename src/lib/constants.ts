export const APP_CONFIG = {
  name: "LAMLA Guide AI",
  shortName: "LAMLA Guide",
  slogan: "It's Never Too Late To Study.",
  description:
    "Turn lecture slides, PDFs, and notes into clear summaries, structured study notes, and timed practice quizzes.",
  currency: "GHS",
  adminWhatsApp: process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER || "233539337142",
  adminWhatsAppDisplay: process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_DISPLAY || "0539337142",
  supportEmail: process.env.NEXT_PUBLIC_ADMIN_SUPPORT_EMAIL || "bismarkanadjei@gmail.com",
};

export const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export const EDUCATIONAL_LEVELS = [
  { id: "shs", label: "Senior High School (SHS)" },
  { id: "university", label: "University" },
  { id: "college", label: "College (Nursing / Teacher / Technical)" },
  { id: "professional", label: "Professional Exams (ICAG, Law, ACCA)" },
  { id: "other", label: "Other" },
];

export const SUBSCRIPTION_PLANS = [
  {
    id: "free",
    name: "Free",
    badge: "Starter",
    price: 0,
    duration: "forever",
    popular: false,
    description: "Core study tools to get started at no cost.",
    features: [
      "Up to 5 saved study sessions",
      "Upload PDF, PowerPoint, Word, or note photos (up to 1 GB)",
      "Summaries and structured study notes",
      "Up to 50 practice questions per quiz",
      "AI Study Tutor and slide drills",
      "Live timed group quizzes and exam countdowns",
    ],
    limitations: [
      "Flashcards not included",
      "Up to 5 saved sessions",
    ],
    ctaText: "Get started free",
    ctaHref: "/auth/signup",
  },
  {
    id: "standard",
    name: "Standard",
    badge: "Recommended",
    price: 49,
    duration: "month",
    popular: true,
    description: "For regular semester coursework and exam preparation.",
    features: [
      "Up to 25 saved study sessions",
      "Spaced-repetition flashcards",
      "Up to 100 practice questions per quiz",
      "Timed exam simulation and mistake retests",
      "Summaries, master study notes, and AI Tutor",
      "Direct WhatsApp & Mobile Money support",
    ],
    limitations: [
      "Up to 25 saved sessions",
    ],
    ctaText: "Choose Standard",
    ctaHref: "/pricing?plan=standard",
  },
  {
    id: "premium",
    name: "Premium",
    badge: "Unlimited",
    price: 99,
    duration: "month",
    popular: false,
    description: "Unlimited sessions and practice for intensive exam periods.",
    features: [
      "Unlimited study sessions and uploads",
      "Unlimited practice questions per quiz",
      "Unlimited spaced-repetition flashcards",
      "Full timed mock exams and mistake notebook",
      "Summaries, master study notes, and AI Tutor",
      "Priority WhatsApp support",
    ],
    limitations: [],
    ctaText: "Choose Premium",
    ctaHref: "/pricing?plan=premium",
  },
];
