import Anthropic from "@anthropic-ai/sdk";

let client = null;
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquant côté serveur.");
  }
  if (!client) client = new Anthropic();
  return client;
}

// Appel avec sortie JSON contrainte par un schéma (structured outputs).
export async function askJSON({ system, content, schema, model = "claude-opus-5-5", effort = "medium", maxTokens = 16000 }) {
  const msg = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }],
  });
  if (msg.stop_reason === "refusal") throw new Error("Analyse refusée par le modèle.");
  if (msg.stop_reason === "max_tokens") throw new Error("Réponse tronquée, réessaie.");
  const block = msg.content.find(b => b.type === "text");
  return JSON.parse(block ? block.text : "{}");
}
