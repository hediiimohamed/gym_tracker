import Anthropic from "@anthropic-ai/sdk";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquant côté serveur.");
  }
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM = `Tu es un assistant nutrition. On te donne une photo de repas, parfois avec un commentaire de l'utilisateur. Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, exactement dans ce format :
{"items":["aliment 1","aliment 2"],"calories":NOMBRE,"protein_g":NOMBRE,"carbs_g":NOMBRE,"fat_g":NOMBRE,"confidence":"faible|moyenne|haute","note":"commentaire court en français"}
Donne ta meilleure estimation même si la photo est ambiguë plutôt que de refuser. Les nombres sont des entiers, estimés pour la portion visible dans son ensemble (pas par aliment).`;

export async function analyzeMeal(base64Jpeg, userNote) {
  const content = [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
    { type: "text", text: userNote ? `Contexte donné par l'utilisateur : ${userNote}` : "Analyse ce repas." },
  ];

  const msg = await getClient().messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  const block = msg.content.find(b => b.type === "text");
  const text = block ? block.text.trim() : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      calories: Number.isFinite(parsed.calories) ? parsed.calories : null,
      protein_g: Number.isFinite(parsed.protein_g) ? parsed.protein_g : null,
      carbs_g: Number.isFinite(parsed.carbs_g) ? parsed.carbs_g : null,
      fat_g: Number.isFinite(parsed.fat_g) ? parsed.fat_g : null,
      confidence: parsed.confidence || "faible",
      note: parsed.note || "",
    };
  } catch (e) {
    return { items: [], calories: null, protein_g: null, carbs_g: null, fat_g: null, confidence: "faible", note: "Analyse impossible, réessaie avec une photo plus nette." };
  }
}
