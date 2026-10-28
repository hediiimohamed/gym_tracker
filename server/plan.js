import { askJSON } from "./claude.js";
import { PROFILE, METHOD, NUTRITION_TARGETS } from "./profile.js";
import { describeSession, describeProgram, describeReprise, describeSeenLoads, describeMealTotals } from "./format.js";

const SYSTEM = `Tu es le coach de musculation intégré dans "Carnet" (programme Push/Pull/Legs). L'utilisateur va s'entraîner maintenant et te demande les objectifs de la séance. On te donne ses dernières séances du même type (charges, reps, notes de forme, état du dos, notes, objectifs donnés), le programme du jour, les charges déjà utilisées et, s'il y en a, ce qu'il a mangé aujourd'hui.

Donne un plan exact, série par série, pour chaque exercice du programme, en appliquant strictement la méthode ci-dessous. Si une donnée manque pour décider (amplitude non confirmée, séries non notées, charge inconnue), ne l'invente pas : garde la dernière valeur confirmée et pose la question dans "missing". Écris en français, tutoie l'utilisateur. Tu n'es pas un professionnel de santé.

${PROFILE}

${METHOD}`;

const SCHEMA = {
  type: "object",
  properties: {
    focus: { type: "string", description: "Une phrase : la seule chose qui compte aujourd'hui." },
    order: {
      type: "array", items: { type: "string" },
      description: "Ordre des exercices (ids) uniquement s'il diffère du programme ; sinon tableau vide.",
    },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          sets: {
            type: "array",
            items: {
              type: "object",
              properties: { kg: { type: "number" }, reps: { type: "integer" } },
              required: ["kg", "reps"], additionalProperties: false,
            },
            description: "Une entrée par série. Gainage : kg = 0. Tractions : kg = poids du corps.",
          },
          cue: { type: "string", description: "Une phrase de consigne d'exécution." },
          reason: { type: "string", description: "Pourquoi ces chiffres, en une phrase courte." },
        },
        required: ["id", "sets", "cue", "reason"],
        additionalProperties: false,
      },
    },
    missing: { type: "array", items: { type: "string" }, description: "Questions sur les données manquantes, ex. « Amplitude à 200 kg confirmée ? »." },
    reminders: { type: "array", items: { type: "string" }, description: "Au plus 2 rappels courts (ex. collation 16h)." },
  },
  required: ["focus", "order", "exercises", "missing", "reminders"],
  additionalProperties: false,
};

export async function planSession({ program, history = [], daysSinceLast, reprise, seenLoads, mealsToday, bodyweight }) {
  const names = Object.fromEntries((program.ex || []).map(e => [e.id, e.n]));
  const ids = new Set((program.ex || []).map(e => e.id));
  const content = [
    `Séance ${program.label} aujourd'hui (${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}). ${describeReprise(reprise, daysSinceLast)}`,
    bodyweight ? `Dernier poids de corps connu : ${bodyweight} kg.` : "",
    `\nProgramme du jour (ordre prévu) :\n${describeProgram(program)}`,
    `\nCharges déjà utilisées par exercice (paliers autorisés) :\n${describeSeenLoads(seenLoads, names)}`,
    history.length
      ? `\nDernières séances ${program.label} (plus ancienne en premier) :\n${history.map(s => describeSession(s, names)).join("\n")}`
      : `\nAucune séance ${program.label} enregistrée : demande les charges de départ dans "missing" plutôt que de les inventer.`,
    `\n${describeMealTotals("Repas d'aujourd'hui", mealsToday, NUTRITION_TARGETS)}`,
  ].filter(Boolean).join("\n");

  const p = await askJSON({ system: SYSTEM, content, schema: SCHEMA });
  return {
    focus: p.focus || "",
    order: (p.order || []).filter(id => ids.has(id)),
    exercises: Object.fromEntries((p.exercises || []).filter(e => ids.has(e.id))
      .map(e => [e.id, { sets: e.sets || [], cue: e.cue || "", reason: e.reason || "" }])),
    missing: p.missing || [],
    reminders: (p.reminders || []).slice(0, 2),
    date: new Date().toISOString(),
  };
}
