import { askJSON } from "./claude.js";
import { PROFILE, METHOD } from "./profile.js";
import { describeSession, describeProgram, describeReprise, describeSeenLoads } from "./format.js";

const SYSTEM = `Tu es le coach de musculation intégré dans "Carnet" (programme Push/Pull/Legs). On te donne la séance qui vient d'être faite, les séances précédentes du même type et le programme prévu. Chaque série a sa charge, ses reps et une note de forme technique donnée par l'utilisateur : 1 = exécution au standard, 0,5 = moyenne, 0 = pas top, « non notée » = inconnue.

Ta mission : un bilan court et direct de la séance, puis pour CHAQUE exercice fait, un commentaire d'une phrase et l'objectif exact, série par série, pour la prochaine séance du même type. Applique strictement la méthode ci-dessous. Écris en français, tutoie l'utilisateur. Tu n'es pas un professionnel de santé.

${PROFILE}

${METHOD}`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Bilan de la séance en 2 à 4 phrases, chiffré : séries au standard, ce qui a progressé, ce qui manque." },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Identifiant de l'exercice, tel que fourni." },
          comment: { type: "string", description: "Une phrase de consigne sur cet exercice." },
          target: { type: "string", description: "Objectif exact série par série pour la prochaine séance, ex. « 22×10 · 22×10 · 24×8 »." },
        },
        required: ["id", "comment", "target"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "exercises"],
  additionalProperties: false,
};

export async function reviewSession({ session, history = [], program, reprise, daysSinceLast, seenLoads }) {
  const names = Object.fromEntries((program.ex || []).map(e => [e.id, e.n]));
  const content = [
    `Séance ${program.label}. ${describeReprise(reprise, daysSinceLast)}`,
    `\nProgramme prévu :\n${describeProgram(program)}`,
    `\nCharges déjà utilisées par exercice (paliers autorisés) :\n${describeSeenLoads(seenLoads, names)}`,
    history.length
      ? `\nSéances ${program.label} précédentes (plus ancienne en premier) :\n${history.map(s => describeSession(s, names)).join("\n")}`
      : `\nAucune séance ${program.label} précédente.`,
    `\nSéance à analyser :\n${describeSession(session, names)}`,
  ].join("\n");

  const parsed = await askJSON({ system: SYSTEM, content, schema: SCHEMA });
  const exercises = {};
  (parsed.exercises || []).forEach(e => { if (e.id) exercises[e.id] = { comment: e.comment, target: e.target }; });
  return { summary: parsed.summary || "", exercises };
}
