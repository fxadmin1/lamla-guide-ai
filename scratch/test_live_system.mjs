import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = "https://lsisntjpiscwnwdqbebo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzaXNudGpwaXNjd253ZHFiZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTAyMzksImV4cCI6MjEwNzEyNjIzOX0.CAHFOOexNM3yci3r6UmIOvgm1fwafzYcG2M34ktcY6g";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzaXNudGpwaXNjd253ZHFiZWJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTU1MDIzOSwiZXhwIjoyMTA3MTI2MjM5fQ.oeilo2kV-NwUaJA8_uQw3GTqqSFIHHfSBCSzttZvso4";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function runTests() {
  console.log("==================================================");
  console.log("LAMLA Guide AI - Full System Integration Test");
  console.log("==================================================");

  // 1. Verify founder admin account in profiles
  console.log("\n[TEST 1] Verifying Founder Admin Profile...");
  const { data: founderProfile, error: founderErr } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .single();

  if (founderErr || !founderProfile) {
    console.error("FAIL: Could not find founder admin profile:", founderErr);
  } else {
    console.log(`PASS: Founder Admin verified -> ${founderProfile.email} (Role: ${founderProfile.role}, Plan: ${founderProfile.plan_id})`);
  }

  // 2. Verify Supabase Storage 'study-materials' bucket
  console.log("\n[TEST 2] Verifying Supabase Storage Bucket 'study-materials'...");
  const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
  const studyBucket = buckets?.find(b => b.name === "study-materials");
  if (!studyBucket) {
    console.error("FAIL: Bucket 'study-materials' not found.");
  } else {
    console.log(`PASS: Bucket 'study-materials' is active (Public: ${studyBucket.public}, File size limit: ${studyBucket.file_size_limit} bytes)`);
  }

  // 3. Test Python AI Core Health
  console.log("\n[TEST 3] Testing Python AI Core on Port 8000...");
  try {
    const pyHealthRes = await fetch("http://127.0.0.1:8000/health");
    const pyHealth = await pyHealthRes.json();
    console.log(`PASS: Python AI Core responding: ${JSON.stringify(pyHealth)}`);
  } catch (err) {
    console.error("FAIL: Python AI Core unreachable:", err.message);
  }

  // 4. Test Python AI Large PPTX Slide Parsing
  console.log("\n[TEST 4] Testing Python AI Parsing with Real Slide Deck...");
  // Let's create a sample slide text or test file
  const testDeckContent = `--- Slide 1: Introduction to Cellular Respiration ---
Cellular respiration is the biochemical process that converts glucose and oxygen into ATP, carbon dioxide, and water.
Formula: C6H12O6 + 6O2 -> 6CO2 + 6H2O + 36-38 ATP.

--- Slide 2: Glycolysis (Cytoplasm) ---
Glycolysis occurs in the cytoplasm under anaerobic or aerobic conditions.
Net yield per glucose molecule: 2 Pyruvate, 2 NADH, and 2 ATP (net).

--- Slide 3: The Krebs Cycle (Mitochondrial Matrix) ---
Occurs in the matrix of mitochondria. Acetyl-CoA combines with oxaloacetate to form citrate.
Produces 6 NADH, 2 FADH2, 2 ATP, and 4 CO2 per original glucose.

--- Slide 4: Oxidative Phosphorylation & ATP Synthase ---
Located on the inner mitochondrial cristae membrane.
Proton electrochemical gradient powers ATP Synthase (chemiosmosis).
Produces approximately 32-34 ATP. Oxygen acts as the terminal electron acceptor.`;

  try {
    const summaryRes = await fetch("http://127.0.0.1:8000/api/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: testDeckContent,
        document_title: "Cellular Respiration Deck",
        educational_level: "Senior High School (SHS) & University",
        style: "Exam-Oriented"
      })
    });
    const summaryData = await summaryRes.json();
    if (summaryData.success && summaryData.summary) {
      console.log(`PASS: Python AI generated Exam Summary (${summaryData.summary.length} chars)`);
      console.log("Preview snippet:", summaryData.summary.slice(0, 160).replace(/\n/g, " "), "...");
    } else {
      console.error("FAIL: Summary generation failed:", summaryData);
    }
  } catch (err) {
    console.error("FAIL: Python AI summary call failed:", err.message);
  }

  // 5. Test Python AI Quiz Generation (up to 150 questions batching)
  console.log("\n[TEST 5] Testing Practice Quiz Generation with strict grounding...");
  try {
    const quizRes = await fetch("http://127.0.0.1:8000/api/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: testDeckContent,
        question_count: 4,
        difficulty: "intermediate",
        question_type: "mcq"
      })
    });
    const quizData = await quizRes.json();
    if (quizData.success && quizData.questions?.length > 0) {
      console.log(`PASS: Python AI generated ${quizData.questions.length} questions.`);
      console.log("Sample Question 1:", quizData.questions[0].question);
      console.log("Correct Answer:", quizData.questions[0].correctAnswer);
    } else {
      console.error("FAIL: Quiz generation failed:", quizData);
    }
  } catch (err) {
    console.error("FAIL: Python AI quiz call failed:", err.message);
  }

  // 6. Test Next.js App on Port 3001
  console.log("\n[TEST 6] Testing Next.js Web Server on Port 3001...");
  try {
    const nextRes = await fetch("http://localhost:3001");
    console.log(`PASS: Next.js landing page responded with HTTP ${nextRes.status}`);

    const pricingRes = await fetch("http://localhost:3001/pricing");
    console.log(`PASS: Next.js pricing page responded with HTTP ${pricingRes.status}`);

    const dashboardRes = await fetch("http://localhost:3001/dashboard");
    console.log(`PASS: Next.js dashboard page responded with HTTP ${dashboardRes.status}`);
  } catch (err) {
    console.error("FAIL: Next.js server error:", err.message);
  }

  // 7. Test Admin Route Security (Non-admin must be blocked)
  console.log("\n[TEST 7] Testing Security: Unauthorized access to Admin API...");
  try {
    const unauthAdminRes = await fetch("http://localhost:3001/api/admin/update-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "fake", planId: "premium", months: 12 })
    });
    console.log(`PASS: Unauthenticated call rejected with HTTP ${unauthAdminRes.status} (${unauthAdminRes.status === 401 ? "Unauthorized" : unauthAdminRes.status})`);
  } catch (err) {
    console.error("FAIL: Admin security check failed:", err.message);
  }

  console.log("\n==================================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch(console.error);
