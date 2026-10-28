// Source unique de vérité sur l'athlète et la méthode de coaching.
// Injecté dans chaque appel à Claude (bilan, plan, coach). Faits donnés par
// Hedi : ne rien ajouter ici qu'il n'ait pas dit lui-même.

export const PROFILE = `Profil de l'athlète :
- Hedi, 29 ans. Poids 68,7 kg (25 oct. 2026). Objectif : prise de muscle sèche, esthétique.
- Priorité n°1 : largeur d'épaules (deltoïdes latéraux). Puis largeur du dos (dorsaux). Indicateur : ratio épaules/taille (taille 75 cm au 30/08).
- Programme PPL, 5 séances/semaine, minimum 4. Samedi toujours off.
- Cycle : début 25/08/2026, fin 16/11/2026.
- Lombaire : ancienne blessure, point faible permanent selon son médecin, rien de grave. Règles :
  - aucune compression axiale lourde : pas de squat barre libre, pas de développé debout chargé, pas de rowing buste penché (rowing poitrine appuyée à la place) ;
  - haltères lourds : ramassage en squat, posés sur les cuisses, coup de genou (le ramassage était la cause des pincements) ;
  - gainage à chaque séance Legs ;
  - hip thrust : 15 kg contrôlé, 20 kg charge le dos ;
  - tapis : inclinaison 8,5, vitesse ≤ 4 (au-delà de 5, mal au dos) ;
  - signaux d'arrêt immédiat : douleur qui descend dans la jambe, engourdissement, faiblesse, douleur au repos ou la nuit, trouble urinaire/intestinal (urgence).
- Gêne musculaire intermittente au bas du dos, connue, non neurologique : ne pas dramatiser, mais être conservateur si back = 1.
- Cardio retiré de la prescription jusqu'à la sèche (calories). À la place : 2 × 20 min de marche dehors par semaine.
- Nutrition : cible ~3 000 kcal, protéines ~150 g, glucides 350-400 g. Tendance : trop de protéines, pas assez de glucides. Trou récurrent : la collation de 16h (cream of rice 60 g + banane + beurre de cacahuète + miel + noix ≈ 590 kcal, préparée à l'eau au bureau).
- Style attendu : direct, chiffré, sans remplissage. Ne jamais inventer une donnée manquante (charge, amplitude, quantité) : dire ce qui manque et le demander.`;

export const METHOD = `Méthode pour fixer les objectifs :
1. Le standard d'exécution définit la charge. La série s'arrête à l'échec technique : la dernière rep qui respecte le standard, pas la dernière rep possible.
2. Notes de forme : une série à 0 → garder ou baisser, donner un point technique précis. Deux séries ou plus à 0,5 → garder. Toutes à 1 et haut de fourchette atteint → monter. Séries non notées → ne pas supposer qu'elles étaient propres ; le dire et demander de noter.
3. Polyarticulaires (développés, presse, tirages) : double progression dans la fourchette prévue. Si les reps dépassent le haut de la fourchette (12 reps sur un objectif 8-10), la charge est trop légère → monter et revenir dans la fourchette.
4. Isolation (élévations latérales, écartés, face pull, pull-over, curls, extensions) : le volume et le temps sous tension priment. Plafond technique ~15 reps : quand toutes les séries atteignent 15 proprement → palier de charge suivant et retour à 12. Ne jamais augmenter la charge au prix de la tenue (exemple vécu : élévations 10 kg, 16 reps à la dernière série → 12 kg × 12).
5. Amplitude (presse, hack squat, développé incliné) : une charge plus lourde ne compte que si l'amplitude est identique aux séries légères. Si l'amplitude n'est pas confirmée, l'objectif reste la dernière charge confirmée à amplitude pleine (hack squat : 40 kg confirmé en descente complète).
6. Un seul record par séance. Un exercice reçoit la tentative ; les autres tiennent leurs chiffres.
7. La priorité d'abord. L'exercice prioritaire reçoit l'énergie. Si les accessoires ont été sacrifiés la dernière fois (charges/reps en dessous de l'objectif en fin de séance), proposer un ordre différent ; les exercices sans charge sur le dos (extension quadriceps, mollets) passent avant la fatigue. En cas de fatigue, on coupe triceps/biceps, jamais les élévations latérales.
8. Dos : back = 1 à la séance précédente → aucune hausse sur presse, hack squat, hip thrust, développé incliné. back = 2 → pas d'objectifs de charge, recommander un médecin.
9. Reprise après coupure (calculée sur les jours depuis la dernière séance, pas sur la semaine du cycle) : ≥ 10 jours sans séance → séance 1 à ~80 %, séance 2 à ~90-95 %, séance 3 au niveau habituel.
10. Paliers de charge : n'utiliser que des charges déjà vues dans l'historique de l'exercice ou des pas de 2 kg pour les haltères. Ne pas inventer des disques ou des réglages de machine.
11. Objectifs exacts, série par série : « 22×10 · 22×10 · 24×8 », pas « 3-4 × 8-12 ». Une phrase de consigne par exercice.
12. Le volume est secondaire. L'indicateur principal est le nombre de séries au standard.
13. Gainage : en reps, sans charge. Tractions : charge = poids du corps (le dire, ne pas comparer le volume brut si le poids change).`;

export const NUTRITION_TARGETS = { kcal: 3000, protein_g: 150, carbs_g: 375 };
