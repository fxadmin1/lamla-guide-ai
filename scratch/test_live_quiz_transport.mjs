// Transport check for the Live Quiz: do Supabase Realtime broadcast + presence deliver between separate clients?
// This tests the channel the component relies on (not the React UI itself).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const topic = `lamla-live-quiz-selftest-${Date.now()}`;

function client(id) {
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const ch = sb.channel(topic, { config: { broadcast: { self: false }, presence: { key: id } } });
  const got = [];
  ["quiz_lobby", "quiz_start", "progress", "quiz_end"].forEach((ev) =>
    ch.on("broadcast", { event: ev }, ({ payload }) => got.push({ ev, payload, at: Date.now() })));
  const ready = new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("subscribe timeout for " + id)), 15000);
    ch.subscribe(async (s) => { if (s === "SUBSCRIBED") { await ch.track({ name: id }); clearTimeout(t); res(); } });
  });
  return { sb, ch, got, ready, id };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const host = client("host"), a = client("alice"), b = client("bob");
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  PASS: " : "  FAIL: ") + msg); if (!ok) failed++; };

try {
  await Promise.all([host.ready, a.ready, b.ready]);
  await sleep(1500);
  const presence = Object.keys(host.ch.presenceState());
  check(presence.length === 3, `presence sees all 3 clients (${presence.join(", ")})`);

  const sentAt = Date.now();
  await host.ch.send({ type: "broadcast", event: "quiz_start", payload: { id: "r1", startAt: sentAt + 5000, adminNow: sentAt } });
  await sleep(1500);
  check(a.got.some((m) => m.ev === "quiz_start") && b.got.some((m) => m.ev === "quiz_start"), "quiz_start reaches both participants");
  const lat = [a, b].map((c) => c.got.find((m) => m.ev === "quiz_start")?.at - sentAt);
  console.log(`  latency to participants: ${lat.join(" ms, ")} ms`);

  await a.ch.send({ type: "broadcast", event: "progress", payload: { userId: "alice", answers: { 0: 1 }, submitted: true } });
  await sleep(1000);
  check(host.got.some((m) => m.ev === "progress" && m.payload.userId === "alice"), "host receives a participant's answers");
  check(!b.got.some((m) => m.ev === "quiz_start" && m.payload.id !== "r1"), "no cross-talk of unrelated messages");
} catch (e) {
  console.error("  ERROR:", e.message);
  failed++;
} finally {
  for (const c of [host, a, b]) await c.sb.removeChannel(c.ch);
  console.log(failed ? `\n${failed} check(s) failed` : "\nTransport OK");
  process.exit(failed ? 1 : 0);
}
