import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { 
  generateSummaryWithAI, 
  generateQuestionsWithAI, 
  generateStudyNotesWithAI,
  generateFlashcardsWithAI,
  generateDetailedExplanationWithAI,
  extractTextFromImageWithAI,
  getCandidatePythonUrls,
} from "@/lib/gemini";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const getPythonApiUrl = () => getCandidatePythonUrls()[0] || "http://127.0.0.1:10000";

const hasValidServiceRole = Boolean(serviceRoleKey && serviceRoleKey !== "placeholder-service-key" && serviceRoleKey.length > 20);
const supabaseServiceAdmin = hasValidServiceRole
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// Up to 5 minutes execution duration for large document processing
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user from Bearer token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication token." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized: Invalid or expired session." }, { status: 401 });
    }

    const supabaseAdmin = supabaseServiceAdmin || authClient;

    // 2. Parse multipart form data (unlimited free access for all students)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionTitle = (formData.get("title") as string)?.trim() || "";
    const selectedMode = (formData.get("mode") as string) || "summarize";
    const educationalLevel = (formData.get("educationalLevel") as string) || "Senior High School (SHS) & University";
    const requestedQuizCount = parseInt(formData.get("quizCount") as string, 10) || 5;
    const quizCount = Math.min(Math.max(requestedQuizCount, 1), 200);

    const flashcardCount = Math.min(Math.max(parseInt(formData.get("flashcardCount") as string, 10) || 20, 5), 200);
    const quizTimeLimit = parseInt(formData.get("quizTimeLimit") as string, 10) || 15;
    const quizType = (formData.get("quizType") as string) || "mcq";
    const quizDifficulty = (formData.get("quizDifficulty") as string) || "intermediate";

    const PYTHON_API_URL = getPythonApiUrl();
    const pastedText = (formData.get("text") as string)?.trim() || "";
    const clientFileName = (formData.get("fileName") as string)?.trim() || "";
    const clientFileSize = Number(formData.get("fileSize") || 0);
    const clientPageCount = Number(formData.get("pageCount") || 0);

    if (!file && !pastedText) {
      return NextResponse.json({ 
        error: "Please upload a study material file (PDF, PowerPoint, Word, Image up to 1.5 GB) or paste your lecture notes." 
      }, { status: 400 });
    }

    // Safe file upload limit (up to 1.5 GB for large lecture slide decks & PDFs)
    if (file) {
      const maxBytes = 1536 * 1024 * 1024; // 1.5 GB
      if (file.size > maxBytes) {
        return NextResponse.json({
          error: "File size exceeds the 1.5 GB maximum limit. Please upload files under 1.5 GB.",
          code: "FILE_TOO_LARGE",
        }, { status: 400 });
      }
    }

    const filename = file ? file.name : (clientFileName || "Study Notes");
    const fileSize = file ? file.size : (clientFileSize || Buffer.byteLength(pastedText, "utf-8"));
    const finalTitle = sessionTitle || ((file || clientFileName) ? filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") : "Lecture Study Session");

    let extractedText = pastedText;
    let pageCount = clientPageCount > 0 ? clientPageCount : 1;
    let structuredData: any = {};
    let parsedViaPython = Boolean(pastedText && !file);

    // 3. If file provided and not already extracted on client, forward file to Python AI streaming service
    if (file && !extractedText) {
      for (const candidateBase of getCandidatePythonUrls()) {
        try {
          const pythonFormData = new FormData();
          pythonFormData.append("file", file, filename);

          const pythonRes = await fetch(`${candidateBase}/api/upload-and-parse`, {
            method: "POST",
            body: pythonFormData,
            signal: AbortSignal.timeout(180000),
          });

          if (pythonRes.ok) {
            const pythonJson = await pythonRes.json();
            if (pythonJson.success && pythonJson.data) {
              extractedText = pythonJson.data.full_text || "";
              pageCount = pythonJson.data.total_slides || pythonJson.data.total_pages || 1;
              structuredData = pythonJson.data;
              parsedViaPython = true;
              break;
            }
          }
        } catch {
          // Try next candidate port
        }
      }
    }

    // 4. Fallback parser if Python was unreachable
    if ((!parsedViaPython || !extractedText.trim()) && file) {
      const lowerName = filename.toLowerCase();

      if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
        extractedText = await file.text();
      } else if (file.type.startsWith("image/") || lowerName.match(/\.(png|jpg|jpeg|webp)$/)) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mime = file.type || "image/jpeg";
        extractedText = await extractTextFromImageWithAI(base64, mime);
      } else {
        // If binary PDF/PPTX and Python unreachable, notify student clearly
        return NextResponse.json({
          error: `The document processing core is starting up. Please try uploading ${filename} again in a few moments.`,
        }, { status: 503 });
      }
    }

    if (!extractedText.trim()) {
      return NextResponse.json({
        error: `Could not extract text from "${filename}". Please make sure the file contains readable slides, text, or clear photos.`,
      }, { status: 422 });
    }

    if (!parsedViaPython) {
      // Trigger background internet enrichment for pasted notes or image transcriptions
      fetch(`${PYTHON_API_URL}/api/enrich-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: finalTitle, content: extractedText.slice(0, 80000) }),
      }).catch(() => {});
    }

    // Store compact metadata in structured_data (avoid duplicating full_text & pages 3x in Postgres for million-user scale)
    const compactMetadata = {
      document_type: structuredData?.document_type || filename.split(".").pop()?.toLowerCase() || "text",
      title: finalTitle,
      total_slides: pageCount,
      key_concepts: structuredData?.key_concepts || [],
    };

    // 5. Save Document record to Supabase (cap stored text size so 1 GB+ uploads never exceed DB row limits)
    const safeDbText = extractedText.length > 450000 ? extractedText.slice(0, 450000) : extractedText;
    const { data: newDoc, error: docErr } = await supabaseAdmin
      .from("documents")
      .insert({
        user_id: user.id,
        title: finalTitle,
        file_type: filename.split(".").pop()?.toLowerCase() || "unknown",
        file_size_bytes: fileSize,
        slide_or_page_count: pageCount,
        extracted_text: safeDbText,
        structured_data: compactMetadata,
        file_url: "ephemeral-extracted",
        processing_status: "completed",
      })
      .select()
      .single();

    if (docErr || !newDoc) {
      return NextResponse.json({ error: docErr?.message || "Failed to save session document." }, { status: 500 });
    }

    // 6. Synthesize requested initial study resource via fast parallel Python AI core (with Node fallback)
    let generatedSummary: any = null;
    let generatedExplanation: any = null;
    let generatedNotes: any = null;
    let generatedCards: any[] = [];
    let generatedQuiz: any = null;

    if (selectedMode === "summarize") {
      let summaryText = "";
      try {
        const pySum = await fetch(`${PYTHON_API_URL}/api/generate-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: extractedText,
            document_title: finalTitle,
            style: "Exam-Oriented",
            educational_level: educationalLevel,
          }),
          signal: AbortSignal.timeout(90000),
        });
        if (pySum.ok) {
          const pj = await pySum.json();
          summaryText = pj.summary || "";
        }
      } catch {}
      if (!summaryText) {
        summaryText = await generateSummaryWithAI(extractedText, "Exam-Oriented", educationalLevel);
      }
      const { data: s } = await supabaseAdmin
        .from("summaries")
        .insert({
          document_id: newDoc.id,
          user_id: user.id,
          title: `${finalTitle} - Summary`,
          content: summaryText,
          style: "Exam-Oriented",
        })
        .select()
        .single();
      generatedSummary = s || {
        id: `local-sum-${Date.now()}`,
        document_id: newDoc.id,
        user_id: user.id,
        title: `${finalTitle} - Summary`,
        content: summaryText,
        style: "Exam-Oriented",
      };
    } else if (selectedMode === "explain") {
      let explanationText = "";
      try {
        const pyExp = await fetch(`${PYTHON_API_URL}/api/generate-explanation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: extractedText, educational_level: educationalLevel }),
          signal: AbortSignal.timeout(90000),
        });
        if (pyExp.ok) {
          const pj = await pyExp.json();
          explanationText = pj.explanation || "";
        }
      } catch {}
      if (!explanationText) {
        explanationText = await generateDetailedExplanationWithAI(extractedText, educationalLevel);
      }
      const { data: n } = await supabaseAdmin
        .from("study_notes")
        .insert({
          document_id: newDoc.id,
          user_id: user.id,
          title: `${finalTitle} - Detailed Explanation`,
          subject: "explanation",
          content: explanationText,
        })
        .select()
        .single();
      generatedExplanation = n || {
        id: `local-exp-${Date.now()}`,
        document_id: newDoc.id,
        user_id: user.id,
        title: `${finalTitle} - Detailed Explanation`,
        subject: "explanation",
        content: explanationText,
      };
    } else if (selectedMode === "notes") {
      let notesText = "";
      try {
        const pyNotes = await fetch(`${PYTHON_API_URL}/api/generate-notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: extractedText, subject: finalTitle, educational_level: educationalLevel }),
          signal: AbortSignal.timeout(120000),
        });
        if (pyNotes.ok) {
          const pj = await pyNotes.json();
          notesText = pj.notes || "";
        }
      } catch {}
      if (!notesText) {
        notesText = await generateStudyNotesWithAI(extractedText, finalTitle, educationalLevel);
      }
      const { data: n } = await supabaseAdmin
        .from("study_notes")
        .insert({
          document_id: newDoc.id,
          user_id: user.id,
          title: `${finalTitle} - Study Notes`,
          subject: "exam_notes",
          content: notesText,
        })
        .select()
        .single();
      generatedNotes = n || {
        id: `local-note-${Date.now()}`,
        document_id: newDoc.id,
        user_id: user.id,
        title: `${finalTitle} - Study Notes`,
        subject: "exam_notes",
        content: notesText,
      };
    } else if (selectedMode === "flashcards") {
      let cards: any[] = [];
      try {
        const pyCards = await fetch(`${PYTHON_API_URL}/api/generate-flashcards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: extractedText, count: flashcardCount }),
          signal: AbortSignal.timeout(90000),
        });
        if (pyCards.ok) {
          const pj = await pyCards.json();
          cards = pj.flashcards || [];
        }
      } catch {}
      if (!cards.length) {
        cards = await generateFlashcardsWithAI(extractedText, flashcardCount);
      }
      if (cards && cards.length > 0) {
        const { data: deck } = await supabaseAdmin
          .from("flashcard_decks")
          .insert({
            document_id: newDoc.id,
            user_id: user.id,
            title: `${finalTitle} - Flashcards`,
            card_count: cards.length,
          })
          .select()
          .single();

        const deckId = deck?.id || `local-deck-${Date.now()}`;
        const formatted = cards.map((c: any) => ({
          deck_id: deckId,
          front: c.front || c.question || "Concept",
          back: c.back || c.answer || "Answer",
          slide_reference: "",
          mastery_level: 0,
          next_review_at: new Date().toISOString(),
        }));
        if (deck?.id) {
          const { data: insertedCards, error: cErr } = await supabaseAdmin
            .from("flashcards")
            .insert(formatted)
            .select();
          if (!cErr && insertedCards && insertedCards.length > 0) {
            generatedCards = insertedCards;
          } else {
            const minFormatted = formatted.map((c: any) => ({
              deck_id: deck.id,
              front: c.front,
              back: c.back,
            }));
            const { data: insertedMin } = await supabaseAdmin
              .from("flashcards")
              .insert(minFormatted)
              .select();
            generatedCards = insertedMin || formatted;
          }
        } else {
          generatedCards = formatted;
        }
      }
    } else if (selectedMode === "quiz") {
      let questions: any[] = [];
      try {
        const pyQz = await fetch(`${PYTHON_API_URL}/api/generate-quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: extractedText,
            question_count: quizCount,
            question_type: quizType,
            difficulty: quizDifficulty,
          }),
          signal: AbortSignal.timeout(90000),
        });
        if (pyQz.ok) {
          const pj = await pyQz.json();
          questions = pj.questions || [];
        }
      } catch {}
      if (!questions.length) {
        questions = await generateQuestionsWithAI(extractedText, quizCount, quizType, quizDifficulty, educationalLevel);
      }
      if (questions && questions.length > 0) {
        const { data: qz } = await supabaseAdmin
          .from("quizzes")
          .insert({
            document_id: newDoc.id,
            user_id: user.id,
            title: `${finalTitle} - Practice Quiz (${questions.length} Qs)`,
            total_questions: questions.length,
            difficulty: quizDifficulty,
            time_limit_minutes: quizTimeLimit,
          })
          .select()
          .single();

        if (qz) {
          const formatted = questions.map((q: any, i: number) => {
            const parts: string[] = [];
            if (q.explanation) parts.push(String(q.explanation).trim());
            if (q.markingGuide) parts.push(`Marking Guide: ${String(q.markingGuide).trim()}`);
            if (q.misconception) parts.push(`Common Pitfall: ${String(q.misconception).trim()}`);
            return {
              quiz_id: qz.id,
              question_text: q.question,
              question_type: q.type || quizType,
              options: q.options || [],
              correct_answer: q.correctAnswer || "",
              explanation: parts.join("\n\n").trim(),
              order_index: i,
            };
          });

          const { data: insertedQ } = await supabaseAdmin
            .from("quiz_questions")
            .insert(formatted)
            .select();

          qz.quiz_questions = insertedQ || formatted;
          generatedQuiz = qz;
        }
      }
    }

    return NextResponse.json({
      success: true,
      document: newDoc,
      summary: generatedSummary,
      explanation: generatedExplanation,
      notes: generatedNotes,
      cards: generatedCards,
      quiz: generatedQuiz,
      meta: {
        totalSlides: pageCount,
        fileSize,
        parsedViaPython,
      },
    });
  } catch (error: any) {
    console.error("Document Process Route Error:", error);
    return NextResponse.json({
      error: error?.message || "Failed to process study materials.",
    }, { status: 500 });
  }
}
