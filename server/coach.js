import { getClient } from "./claude.js";
import { PROFILE, METHOD, NUTRITION_TARGETS } from "./profile.js";
import { describeSession, describeMealTotals, fmtDate } from "./format.js";

const SYSTEM_BASE = `Tu es le coach intégré dans "Carnet", une appli personnelle de suivi de musculation (programme Push/Pull/Legs). Réponds en français, de façon directe et concise (2 à 5 phrases sauf si on te demande plus de détail). Appuie-toi sur le contexte d'entraînement ci-dessous pour donner des conseils concrets et personnalisés : charges, progression, récupération, organisation des séances, nutrition. Tu n'es pas un professionnel de santé — pour toute douleur, blessure ou question médicale, renvoie vers un médecin ou kinésithérapeute plutôt que de diagnostiquer toi-même.

${PROFILE}

${METHOD}`;

// names : { id: nom } pour tous les exercices ; meals : { today, yesterday } totaux ou null
export function buildContext(state, { names = {}, meals = {} } = {}) {
  const sessions = state.sessions || [];
  const weights = state.weights || [];
  const measures = state.measures || [];
  const lines = [];

  const cut14 = Date.now() - 14 * 864e5, cut7 = Date.now() - 7 * 864e5;
  const recentW = weights.filter(w => new Date(w.date) >= cut14);
  if (recentW.length) {
    lines.push(`Poids des 14 derniers jours : ${recentW.map(w => `${fmtDate(w.date)} ${w.kg} kg`).join(", ")}.`);
    const w7 = weights.filter(w => new Date(w.date) >= cut7);
    if (w7.length) lines.push(`Moyenne 7 jours : ${(w7.reduce((a, w) => a + w.kg, 0) / w7.length).toFixed(1)} kg.`);
  } else {
    lines.push("Aucune pesée sur les 14 derniers jours.");
  }

  if (measures.length) {
    const m = measures[measures.length - 1];
    const parts = Object.entries(m).filter(([k]) => k !== "date").map(([k, v]) => `${k} ${v} cm`).join(", ");
    lines.push(`Dernières mesures (${fmtDate(m.date)}) : ${parts}${m.epaules && m.taille ? ` — ratio épaules/taille ${(m.epaules / m.taille).toFixed(3)}` : ""}.`);
  }

  const recent = sessions.slice(-5).reverse();
  if (recent.length) {
    lines.push("Dernières séances (plus récente en premier) :");
    recent.forEach(s => lines.push(describeSession(s, names)));
  } else {
    lines.push("Aucune séance enregistrée pour l'instant.");
  }

  lines.push(describeMealTotals("Repas aujourd'hui", meals.today, NUTRITION_TARGETS));
  lines.push(describeMealTotals("Repas hier", meals.yesterday, NUTRITION_TARGETS));
  return lines.join("\n");
}

export async function askCoach(history, context) {
  const system = `${SYSTEM_BASE}\n\nContexte d'entraînement actuel :\n${context}`;
  const msg = await getClient().messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1000,
    output_config: { effort: "low" },
    system,
    messages: history,
  });
  const block = msg.content.find(b => b.type === "text");
  return block ? block.text : "";
}
