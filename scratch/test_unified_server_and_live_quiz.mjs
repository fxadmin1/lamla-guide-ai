// End-to-end verification of the Unified Single-Server (Python + Website on ONE port)
// and Multi-Participant Real-Time Synchronized Live Timed Quiz.

const BASE = process.env.UNIFIED_URL || "http://localhost:3001";
const WS_BASE = BASE.replace(/^http/, "ws");

let passed = 0;
let failed = 0;

function check(cond, label) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function connectWs(circleId, userId, name) {
  return new Promise((resolve, reject) => {
    const states = [];
    const ws = new WebSocket(
      `${WS_BASE}/ws/live-quiz/${encodeURIComponent(circleId)}?user_id=${encodeURIComponent(userId)}&name=${encodeURIComponent(name)}`
    );
    const timer = setTimeout(() => reject(new Error(`WebSocket timeout for ${name}`)), 8000);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "room_state") {
        states.push(msg.state);
      }
    };
    ws.onopen = () => {
      clearTimeout(timer);
      resolve({
        ws,
        states,
        latest: () => states[states.length - 1],
        waitForPhase: (phase, timeoutMs = 6000) =>
          new Promise((res, rej) => {
            const existing = states.find((s) => s.phase === phase);
            if (existing) return res(existing);
            const start = Date.now();
            const iv = setInterval(() => {
              const found = states.find((s) => s.phase === phase);
              if (found) {
                clearInterval(iv);
                res(found);
              } else if (Date.now() - start > timeoutMs) {
                clearInterval(iv);
                rej(new Error(`${name} did not reach phase '${phase}' (latest: ${states[states.length - 1]?.phase})`));
              }
            }, 40);
          }),
      });
    };
    ws.onerror = (e) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket error for ${name}: ${e.message || e.type}`));
    };
  });
}

async function main() {
  console.log("======================================================================");
  console.log("LAMLA GUIDE AI — UNIFIED SINGLE-SERVER & LIVE SYNCED QUIZ VERIFICATION");
  console.log("======================================================================");

  // 1. Unified Health & Website Pages on the SAME port
  console.log("\n[1] Unified Server Health & Website Routing (Single Port)");
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  check(health.status === "healthy" && health.unified === true, "Python AI /health active on unified port");

  for (const path of ["/", "/dashboard", "/pricing", "/contact", "/privacy"]) {
    const r = await fetch(`${BASE}${path}`);
    check(r.status === 200, `Website route '${path}' served through Python unified server (HTTP 200)`);
  }

  const contactHtml = await fetch(`${BASE}/contact`).then((r) => r.text());
  check(contactHtml.includes("bismarkanadjei@gmail.com"), "Contact page displays bismarkanadjei@gmail.com");

  // 2. Slide Parsing via Unified Port
  console.log("\n[2] Slide Upload Extraction on Unified Port");
  const fd = new FormData();
  const sampleSlide = new Blob(
    [
      "Slide 1: Opportunity Cost and Scarcity.\nScarcity means human wants exceed limited resources. Opportunity cost is the value of the next best alternative foregone when a choice is made.",
    ],
    { type: "text/plain" }
  );
  fd.append("file", sampleSlide, "econ_slide_1.txt");
  const parseRes = await fetch(`${BASE}/api/upload-and-parse`, { method: "POST", body: fd }).then((r) => r.json());
  check(parseRes.success && parseRes.data?.full_text?.includes("Opportunity Cost"), "Admin slide upload parsed cleanly by Python engine");

  const fd2 = new FormData();
  fd2.append("file", sampleSlide, "econ_slide_1.txt");
  const extractUnauth = await fetch(`${BASE}/api/documents/extract`, { method: "POST", body: fd2 });
  check(extractUnauth.status === 401, "Next.js /api/documents/extract enforces Supabase auth guard via unified proxy (HTTP 401)");

  const aiQuizRes = await fetch(`${BASE}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "quiz",
      content: parseRes.data.full_text,
      options: { count: 2, type: "mcq", difficulty: "medium" },
    }),
  }).then((r) => r.json());
  check(
    aiQuizRes.success === true && Array.isArray(aiQuizRes.questions) && aiQuizRes.questions.length >= 1,
    `AI Quiz Generator (/api/ai) generated ${aiQuizRes.questions?.length || 0} live MCQ questions from uploaded slide`
  );

  // 3. Multi-User Group Creation, Invite Code Join & Real-Time Synced Timed Quiz
  console.log("\n[3] Multi-Client Real-Time Synchronized Live Timed Quiz");
  const createRes = await fetch(`${BASE}/api/study-groups/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "ECON 201 Live Quiz Circle",
      course_code: "ECON 201",
      institution: "KNUST",
      description: "Weekly synchronized slide quiz",
      user_id: "u_admin",
      display_name: "Bismark (Admin)",
      user_email: "bismarkanadjei@gmail.com",
    }),
  }).then((r) => r.json());

  check(createRes.success && createRes.group?.invite_code, `Admin created study group (Code: ${createRes.group?.invite_code})`);
  const circleId = createRes.group.id;
  const inviteCode = createRes.group.invite_code;

  for (const [uid, name] of [
    ["u_alice", "Alice Mensah"],
    ["u_bob", "Bob Owusu"],
  ]) {
    const j = await fetch(`${BASE}/api/study-groups/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode, user_id: uid, display_name: name }),
    }).then((r) => r.json());
    check(j.success && j.members?.length >= 2, `${name} joined group via invite code`);
  }

  // Connect 3 live WebSockets simultaneously
  const hostWs = await connectWs(circleId, "u_admin", "Bismark (Admin)");
  const aliceWs = await connectWs(circleId, "u_alice", "Alice Mensah");
  const bobWs = await connectWs(circleId, "u_bob", "Bob Owusu");

  await new Promise((r) => setTimeout(r, 250));
  check((hostWs.latest()?.online?.length || 0) === 3, "Real-time WebSocket presence sees all 3 group members online");

  // Admin opens lobby with 3 questions and a 5-minute timer
  await fetch(`${BASE}/api/live-quiz/${circleId}/lobby`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "u_admin",
      host_name: "Bismark (Admin)",
      title: "Opportunity Cost Slide Quiz",
      duration_sec: 300,
      questions: [
        {
          question: "What is opportunity cost?",
          options: ["Total money spent", "Next best alternative foregone", "Fixed production cost", "Tax rate"],
          correct: 1,
          explanation: "Opportunity cost is the value of the next best alternative foregone.",
        },
        {
          question: "Why does scarcity exist?",
          options: ["Unlimited resources", "Limited wants", "Unlimited wants with limited resources", "Zero inflation"],
          correct: 2,
          explanation: "Scarcity arises because human wants exceed limited available resources.",
        },
        {
          question: "Who sets the timer in a live group quiz?",
          options: ["External guests", "Group admin or assistant admin", "Nobody", "Random timer"],
          correct: 1,
          explanation: "The group admin or appointed assistant admin configures the timer.",
        },
      ],
    }),
  });

  const aliceLobby = await aliceWs.waitForPhase("lobby");
  const bobLobby = await bobWs.waitForPhase("lobby");
  check(aliceLobby.lobby?.durationSec === 300 && bobLobby.lobby?.count === 3, "Both participants instantly synced into Quiz Lobby (5-min timer, 3 Qs)");
  check(aliceLobby.answerKey === null && bobLobby.answerKey === null, "Answer key kept strictly secret on server during lobby");

  // Admin starts the quiz for everyone
  const t0 = Date.now();
  await fetch(`${BASE}/api/live-quiz/${circleId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "u_admin" }),
  });

  const aliceRun = await aliceWs.waitForPhase("running");
  const bobRun = await bobWs.waitForPhase("running");
  const syncLatencyMs = Date.now() - t0;
  check(
    aliceRun.round?.startAt === bobRun.round?.startAt && aliceRun.round?.endsAt === bobRun.round?.endsAt,
    `All participants received identical startAt & endsAt timestamps in ${syncLatencyMs}ms`
  );
  check(aliceRun.answerKey === null, "Answer key remains hidden while quiz is running");

  // Alice answers 3/3 and submits; Bob answers 2/3 and submits
  await fetch(`${BASE}/api/live-quiz/${circleId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "u_alice", name: "Alice Mensah", answers: { 0: 1, 1: 2, 2: 1 }, submitted: true }),
  });
  await fetch(`${BASE}/api/live-quiz/${circleId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "u_bob", name: "Bob Owusu", answers: { 0: 1, 1: 0, 2: 1 }, submitted: true }),
  });

  // Because all online non-host participants submitted, server auto-grades & broadcasts results!
  const aliceFin = await aliceWs.waitForPhase("finished");
  const bobFin = await bobWs.waitForPhase("finished");
  check(
    aliceFin.results?.[0]?.userId === "u_alice" &&
      aliceFin.results?.[0]?.score === 3 &&
      bobFin.results?.[1]?.userId === "u_bob" &&
      bobFin.results?.[1]?.score === 2,
    "Server auto-graded & pushed synchronized Leaderboard (Alice 3/3 #1, Bob 2/3 #2)"
  );
  check(Array.isArray(aliceFin.answerKey) && aliceFin.answerKey.length === 3, "Answer key & explanations revealed after quiz completion");

  hostWs.ws.close();
  aliceWs.ws.close();
  bobWs.ws.close();

  // Clean up test group so zero synthetic/test data remains in study_groups.json
  const delRes = await fetch(`${BASE}/api/study-groups/${encodeURIComponent(circleId)}?user_id=u_admin`, {
    method: "DELETE",
  }).then((r) => r.json());
  check(delRes.success === true, "Test study group cleaned up so zero demo/test data remains");

  console.log("\n======================================================================");
  console.log(`FINAL SCORE: ${passed} PASSED, ${failed} FAILED`);
  console.log("======================================================================");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
