import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGHS(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

export function generateRequestRef() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LML-${timestamp}-${random}`;
}

export function buildWhatsAppLink(options: {
  phone: string;
  planName: string;
  price: number;
  duration: string;
  email: string;
  requestRef: string;
}) {
  const message = `Hello LAMLA Guide AI Admin. I would like to subscribe to the ${options.planName.toUpperCase()} plan.

My registered email: ${options.email}
Selected plan: ${options.planName}
Price: GHS ${options.price}
Duration: ${options.duration}
Subscription request reference: ${options.requestRef}

Please provide the payment instructions.`;

  const cleanPhone = options.phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export interface SlideSegment {
  slideNumber: number;
  title: string;
  content: string;
  fullReference: string;
}

export function parseDocumentSlides(text: string): SlideSegment[] {
  if (!text) return [];
  const slideRegex = /---\s*(?:Slide|Page)\s*(\d+)(?:\s*[:\-—]\s*([^\r\n]*?))?\s*---\r?\n?/gi;
  const matches = [...text.matchAll(slideRegex)];

  if (matches.length > 0) {
    const segments: SlideSegment[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const slideNum = parseInt(match[1], 10) || (i + 1);
      const title = match[2]?.trim() || `Slide ${slideNum}`;
      const startIndex = (match.index ?? 0) + match[0].length;
      const endIndex = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      const content = text.slice(startIndex, endIndex).trim();
      segments.push({
        slideNumber: slideNum,
        title,
        content: content || title,
        fullReference: `Slide ${slideNum}`
      });
    }
    return segments;
  }

  // Fallback for non-slide documents (split into logical examinable sections)
  const chunks = text.split(/\n{3,}/).filter((c) => c.trim().length > 40);
  if (chunks.length > 1) {
    return chunks.map((chunk, i) => {
      const firstLine = chunk.split("\n")[0].slice(0, 60).replace(/[#*_-]/g, "").trim();
      return {
        slideNumber: i + 1,
        title: firstLine || `Section ${i + 1}`,
        content: chunk.trim(),
        fullReference: `Section ${i + 1}`
      };
    });
  }

  return [{
    slideNumber: 1,
    title: "Document Content",
    content: text.trim(),
    fullReference: "Slide 1"
  }];
}
