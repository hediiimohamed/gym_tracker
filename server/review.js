import Anthropic from "@anthropic-ai/sdk";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquant côté serveur.");
  }
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM = `Tu es le coach de musculation intégré dans "Carnet" (programme Push/Pull/Legs). On te donne la séance qui vient d'être faite, les séances précédentes du même type et le programme prévu. Pour chaque série tu as la charge, les répétitions et parfois une note de forme technique notée par l'utilisateur : 1 = exécution très propre, 0.5 = moyenne, 0 = pas top (absente = non notée).

Ta mission : un bilan court et direct de la séance, puis pour CHAQUE exercice fait, un commentaire et un objectif concret pour la prochaine séance du même type.

Règles de progression :
- Double progression dans la fourchette de reps prévue : d'abord monter les reps jusqu'au haut de la fourchette sur toutes les séries, puis augmenter la charge (petit incrément) et redescendre en bas de fourchette.
- La forme technique passe avant la charge : si une série est notée 0 ou plusieurs séries à 0.5, ne demande pas d'augmenter la charge — garde ou baisse légèrement et donne un point technique précis.
- Pendant la phase de reprise (indiquée dans le contexte), reste prudent : RIR 3-4, pas d'échec, progression lente.
- Si une gêne ou douleur au dos est signalée, sois conservateur et rappelle de consulter si ça persiste ou irradie. Tu n'es pas un professionnel de santé.

Écris en français, tutoie l'utilisateur. L'objectif ("target") doit être court et chiffré, par exemple "4 × 10 à 22 kg" ou "3 × 12 à 40 kg, garde la charge".`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Bilan de la séance en 2 à 4 phrases." },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Identifiant de l'exercice, tel que fourni." },
          comment: { type: "string", description: "Une à deux phrases sur cet exercice." },
          target: { type: "string", description: "Objectif chiffré pour la prochaine séance." },
        },
        required: ["id", "comment", "target"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "exercises"],
  additionalProperties: false,
};

const fmtDate = iso => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const QLABEL = { 1: "forme 1", 0.5: "forme 0.5", 0: "forme 0" };

function describeSession(s, names) {
  const back = s.back === 2 ? " · douleur dos signalée" : s.back === 1 ? " · gêne légère au dos" : "";
  const lines = [`${fmtDate(s.date)}${back}${s.note ? ` · note : "${s.note}"` : ""}`];
  Object.entries(s.ex || {}).forEach(([id, sets]) => {
    const txt = sets.map(x => `${x.kg} kg × ${x.reps}${x.q != null ? ` (${QLABEL[x.q] ?? "forme " + x.q})` : ""}`).join(", ");
    lines.push(`  - ${names[id] || id} [${id}] : ${txt}`);
  });
  return lines.join("\n");
}

export async function reviewSession({ session, history = [], program, week, rampWeeks }) {
  const names = Object.fromEntries((program.ex || []).map(e => [e.id, e.n]));
  const plan = (program.ex || [])
    .map(e => `- ${e.n} [${e.id}] : ${e.s} séries × ${e.r} reps${e.prio ? " (prioritaire)" : ""}${e.note ? ` — ${e.note}` : ""}`)
    .join("\n");

  const prompt = [
    `Séance ${program.label}, semaine ${week} du cycle${week <= rampWeeks ? ` (phase de reprise, semaines 1 à ${rampWeeks})` : ""}.`,
    `\nProgramme prévu :\n${plan}`,
    history.length
      ? `\nSéances ${program.label} précédentes (plus ancienne en premier) :\n${history.map(s => describeSession(s, names)).join("\n")}`
      : `\nAucune séance ${program.label} précédente.`,
    `\nSéance à analyser :\n${describeSession(session, names)}`,
  ].join("\n");

  const msg = await getClient().messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (msg.stop_reason === "refusal") throw new Error("Analyse refusée par le modèle.");
  if (msg.stop_reason === "max_tokens") throw new Error("Réponse tronquée, réessaie.");

  const block = msg.content.find(b => b.type === "text");
  const parsed = JSON.parse(block ? block.text : "{}");
  const exercises = {};
  (parsed.exercises || []).forEach(e => { if (e.id) exercises[e.id] = { comment: e.comment, target: e.target }; });
  return { summary: parsed.summary || "", exercises };
}
