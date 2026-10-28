import { askJSON } from "./claude.js";

const SYSTEM = `Tu es un assistant nutrition. L'utilisateur décrit ce qu'il a mangé, en grammes pesés, parfois avec une photo.

Règles :
- Les quantités écrites par l'utilisateur sont la vérité : utilise-les telles quelles (grams_source = "pesé"). La photo ne sert qu'à identifier les aliments, jamais à corriger une quantité écrite.
- « cru » : calcule sur les valeurs nutritionnelles de l'aliment cru (ex. riz 100 g cru ≈ 350 kcal). « cuit » ou rien de précisé pour un féculent pesé : valeurs cuites et dis-le dans "note".
- Un aliment sans poids (ou visible sur la photo sans description) : estime une portion réaliste, grams_source = "estimé", et ajoute une question dans "missing" (ex. « Banane : combien de grammes ? »).
- Unités ménagères (c. à soupe, c. à café) : convertis en grammes (sauce chili 1 c. à soupe ≈ 15 g), grams_source = "estimé", sans question si la conversion est standard.
- Une ligne par aliment. kcal et macros sont pour la quantité de la ligne. Arrondis à l'entier.
- Écris en français.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          grams_source: { type: "string", enum: ["pesé", "estimé"] },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
        required: ["name", "grams", "grams_source", "kcal", "protein_g", "carbs_g", "fat_g"],
        additionalProperties: false,
      },
    },
    missing: { type: "array", items: { type: "string" } },
    note: { type: "string", description: "Commentaire court (hypothèses faites), vide si rien à dire." },
  },
  required: ["items", "missing", "note"],
  additionalProperties: false,
};

const round = n => Math.round(Number(n) || 0);

// Ligne stockée : valeurs de la portion + valeurs pour 100 g (pour recalculer si on corrige les grammes).
export function toRow(it) {
  const g = Number(it.grams) || 0;
  const per = v => (g > 0 ? (Number(v) || 0) * 100 / g : 0);
  return {
    name: it.name, grams: round(g), grams_source: it.grams_source === "pesé" ? "pesé" : "estimé",
    kcal: round(it.kcal), protein_g: round(it.protein_g), carbs_g: round(it.carbs_g), fat_g: round(it.fat_g),
    per100: { kcal: per(it.kcal), protein_g: per(it.protein_g), carbs_g: per(it.carbs_g), fat_g: per(it.fat_g) },
  };
}

export const totalsOf = rows => ({
  kcal: round(rows.reduce((a, r) => a + r.kcal, 0)),
  protein_g: round(rows.reduce((a, r) => a + r.protein_g, 0)),
  carbs_g: round(rows.reduce((a, r) => a + r.carbs_g, 0)),
  fat_g: round(rows.reduce((a, r) => a + r.fat_g, 0)),
});

export async function analyzeMeal({ text, image }) {
  const content = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } });
  content.push({ type: "text", text: text ? `Ce que j'ai mangé : ${text}` : "Pas de description : identifie les aliments sur la photo, toutes les quantités sont donc estimées." });

  const p = await askJSON({ system: SYSTEM, content, schema: SCHEMA, model: "claude-haiku-5-5", effort: "low", maxTokens: 4000 });
  const rows = (p.items || []).map(toRow);
  return { rows, totals: totalsOf(rows), missing: p.missing || [], note: p.note || "" };
}
