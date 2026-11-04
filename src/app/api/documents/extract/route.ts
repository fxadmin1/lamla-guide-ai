import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTextFromImageWithAI } from "@/lib/gemini";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const getPythonApiUrl = () => process.env.PYTHON_AI_URL || `http://127.0.0.1:${process.env.PORT || "7860"}`;

export const maxDuration = 180;

// Lightweight text extraction for group activities (e.g. live quizzes).
// Unlike /api/documents/process, this does NOT create a study session or use the student's session quota.
export async function POST(req: NextRequest) {
  try {
    const PYTHON_API_URL = getPythonApiUrl();
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication token." }, { status: 401 });
    }
    const authClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user },
      error: authErr,
    } = await authClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized: Invalid or expired session." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Please choose a slide or document to upload." }, { status: 400 });
    }
    if (file.size > 1536 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds the 1.5 GB maximum limit." }, { status: 400 });
    }

    const name = file.name;
    const lower = name.toLowerCase();
    let text = "";
    let pages = 1;

    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      text = await file.text();
      fetch(`${PYTHON_API_URL}/api/enrich-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name, content: text.slice(0, 80000) }),
      }).catch(() => {});
    } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/.test(lower)) {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      text = await extractTextFromImageWithAI(base64, file.type || "image/jpeg");
    } else {
      try {
        const pyForm = new FormData();
        pyForm.append("file", file, name);
        const pyRes = await fetch(`${PYTHON_API_URL}/api/upload-and-parse`, {
          method: "POST",
          body: pyForm,
          signal: AbortSignal.timeout(240000),
        });
        if (pyRes.ok) {
          const json = await pyRes.json();
          if (json.success && json.data) {
            text = json.data.full_text || "";
            pages = json.data.total_slides || json.data.total_pages || json.data.total_sections || 1;
          }
        }
      } catch (e) {
        console.warn("Python parser unreachable for /api/documents/extract:", e);
      }
      if (!text.trim()) {
        return NextResponse.json(
          { error: `Could not read ${name} right now. Try again in a moment, or upload a .txt file or a photo of the slide.` },
          { status: 503 }
        );
      }
    }

    if (!text.trim()) {
      return NextResponse.json({ error: `No readable text found in "${name}".` }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      title: name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      pages,
      text,
    });
  } catch (err: any) {
    console.error("extract route error:", err);
    return NextResponse.json({ error: err?.message || "Extraction failed." }, { status: 500 });
  }
}
