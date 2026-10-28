// Mise en texte des données d'entraînement pour les prompts (bilan, plan, coach).

export const CORE = new Set(["deadbug", "birddog", "pallof"]);
const BODYWEIGHT = new Set(["trac"]);

export const fmtDate = iso => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

const qText = q => q === 1 ? "forme 1" : q === 0.5 ? "forme 0,5" : q === 0 ? "forme 0" : "non notée";

export function describeSet(id, x) {
  const load = CORE.has(id) ? "" : BODYWEIGHT.has(id) ? `${x.kg} kg (poids du corps) × ` : `${x.kg}×`;
  return `${load}${x.reps}${CORE.has(id) ? " reps" : ""} (${qText(x.q)})`;
}

export function describeSession(s, names = {}) {
  const back = s.back === 2 ? "douleur dos signalée (back = 2)" : s.back === 1 ? "gêne légère au dos (back = 1)" : "dos RAS (back = 0)";
  const lines = [`${fmtDate(s.date)} · ${s.type} · ${back}${s.note ? ` · note : "${s.note}"` : ""}`];
  Object.entries(s.ex || {}).forEach(([id, all]) => {
    const sets = all.filter(x => x.reps > 0); // une série sans reps est une saisie vide, pas un échec
    if (!sets.length) return;
    lines.push(`  - ${names[id] || id} [${id}] : ${sets.map(x => describeSet(id, x)).join(", ")}`);
  });
  if (s.review && s.review.exercises) {
    const t = Object.entries(s.review.exercises).map(([id, r]) => `${names[id] || id} → ${r.target}`).join(" ; ");
    if (t) lines.push(`  Objectifs donnés après cette séance : ${t}`);
  }
  return lines.join("\n");
}

export function describeProgram(program) {
  return (program.ex || [])
    .map(e => `- ${e.n} [${e.id}] : ${e.s} séries × ${e.r} reps${e.prio ? " (PRIORITAIRE)" : ""}${CORE.has(e.id) ? " (gainage, sans charge)" : ""}${e.note ? ` — ${e.note}` : ""}${e.std ? ` Standard : ${e.std}` : ""}`)
    .join("\n");
}

// reprise = { gapDays, n } : n = rang de la séance depuis la dernière coupure ≥ 10 jours (null si pas de coupure récente)
export function describeReprise(reprise, daysSinceLast) {
  const parts = [];
  if (Number.isFinite(daysSinceLast)) parts.push(`Jours depuis la dernière séance (tous types) : ${daysSinceLast}.`);
  if (reprise && reprise.n) parts.push(`Reprise : séance ${reprise.n} après une coupure de ${reprise.gapDays} jours.`);
  else parts.push("Pas de coupure récente de 10 jours ou plus : niveau habituel.");
  return parts.join(" ");
}

export function describeSeenLoads(seen = {}, names = {}) {
  const lines = Object.entries(seen).filter(([id]) => !CORE.has(id))
    .map(([id, kgs]) => `- ${names[id] || id} [${id}] : ${kgs.join(", ")} kg`);
  return lines.length ? lines.join("\n") : "aucune";
}

export function describeMealTotals(label, t, targets) {
  if (!t) return `${label} : aucun repas enregistré.`;
  return `${label} : ${t.kcal} kcal / ${targets.kcal}, protéines ${t.protein_g} g / ${targets.protein_g}, glucides ${t.carbs_g} g / ${targets.carbs_g}, lipides ${t.fat_g} g (${t.count} repas).`;
}
