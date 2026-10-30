import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lsisntjpiscwnwdqbebo.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzaXNudGpwaXNjd253ZHFiZWJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTU1MDIzOSwiZXhwIjoyMTA3MTI2MjM5fQ.oeilo2kV-NwUaJA8_uQw3GTqqSFIHHfSBCSzttZvso4";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function purgeDemoData() {
  console.log("Purging all demo workspace documents, sessions, and quizzes...");

  // 1. Delete quiz_attempts
  await supabaseAdmin.from("quiz_attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 2. Delete quiz_questions
  await supabaseAdmin.from("quiz_questions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 3. Delete quizzes
  await supabaseAdmin.from("quizzes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 4. Delete flashcards
  await supabaseAdmin.from("flashcards").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 5. Delete flashcard_decks
  await supabaseAdmin.from("flashcard_decks").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 6. Delete summaries
  await supabaseAdmin.from("summaries").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 7. Delete study_notes
  await supabaseAdmin.from("study_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 8. Delete documents
  await supabaseAdmin.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 9. Reset profile streak to 0, learning hours to 0, points to 0
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id");
  if (profiles) {
    for (const p of profiles) {
      await supabaseAdmin.from("profiles").update({
        streak_days: 0,
        total_study_minutes: 0,
        points: 0,
        updated_at: new Date().toISOString()
      }).eq("id", p.id);
    }
  }

  // 10. Clear storage bucket
  const { data: userFolders } = await supabaseAdmin.storage.from("study-materials").list();
  if (userFolders && userFolders.length > 0) {
    for (const folder of userFolders) {
      const { data: subFiles } = await supabaseAdmin.storage.from("study-materials").list(folder.name);
      if (subFiles && subFiles.length > 0) {
        const fullPaths = subFiles.map(sf => `${folder.name}/${sf.name}`);
        await supabaseAdmin.storage.from("study-materials").remove(fullPaths);
      }
    }
  }

  console.log("SUCCESS: All demo workspace data purged, and streak reset to 0!");
}

purgeDemoData().catch(console.error);
