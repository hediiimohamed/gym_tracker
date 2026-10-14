import Anthropic from "@anthropic-ai/sdk";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquant côté serveur.");
  }
  if (!client) client = new Anthropic();
  return client;
}

const fmtDate = iso => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const SYSTEM_BASE = `Tu es le coach intégré dans "Carnet", une appli personnelle de suivi de musculation (programme Push/Pull/Legs). Réponds en français, de façon directe et concise (2 à 5 phrases sauf si on te demande plus de détail). Appuie-toi sur le contexte d'entraînement ci-dessous pour donner des conseils concrets et personnalisés : charges, progression, récupération, organisation des séances, nutrition générale. Tu n'es pas un professionnel de santé — pour toute douleur, blessure ou question médicale, renvoie vers un médecin ou kinésithérapeute plutôt que de diagnostiquer toi-même.`;

export function buildContext(state) {
  const sessions = state.sessions || [];
  const weights = state.weights || [];
  const measures = state.measures || [];
  const lines = [];

  if (weights.length) {
    const last = weights[weights.length - 1];
    lines.push(`Dernier poids noté : ${last.kg} kg (${fmtDate(last.date)}).`);
  }

  const recent = [...sessions].slice(-5).reverse();
  if (recent.length) {
    lines.push("Dernières séances (plus récente en premier) :");
    recent.forEach(s => {
      const vol = Object.values(s.ex).flat().reduce((a, x) => a + x.kg * x.reps, 0);
      const backNote = s.back === 2 ? " [douleur dos signalée]" : s.back === 1 ? " [gêne légère au dos]" : "";
      const noteTxt = s.note ? ` — note perso : "${s.note}"` : "";
      lines.push(`- ${fmtDate(s.date)} · ${s.type} · volume ${Math.round(vol)} kg${backNote}${noteTxt}`);
    });
  } else {
    lines.push("Aucune séance enregistrée pour l'instant.");
  }

  if (measures.length) {
    const m = measures[measures.length - 1];
    if (m.epaules && m.taille) lines.push(`Ratio épaules/taille actuel : ${(m.epaules / m.taille).toFixed(3)}.`);
  }

  return lines.join("\n");
}

export async function askCoach(history, context) {
  const system = `${SYSTEM_BASE}\n\nContexte d'entraînement actuel :\n${context}`;
  const msg = await getClient().messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 600,
    system,
    messages: history,
  });
  const block = msg.content.find(b => b.type === "text");
  return block ? block.text : "";
}
