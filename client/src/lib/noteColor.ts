/**
 * Utilitaire de couleur dégradée pour les notes
 * 0/20  → rouge vif   (#DC2626)
 * 10/20 → orange/jaune (#F59E0B)
 * 20/20 → vert foncé  (#15803D)
 * Interpolation HSL continue pour un dégradé fluide
 */

/**
 * Calcule la couleur de fond et de texte pour une note donnée sur 20.
 * @param note  Valeur entre 0 et 20
 * @returns { bg: string, text: string, border: string }
 */
export function noteGradientColor(note: number | null): {
  bg: string;
  text: string;
  border: string;
} {
  if (note === null || note === undefined) {
    return { bg: "#F5F5F4", text: "#A8A29E", border: "#E7E5E4" };
  }

  // Clamp entre 0 et 20
  const n = Math.max(0, Math.min(20, note));
  const ratio = n / 20; // 0 → 1

  // Interpolation HSL :
  //   0   → H=0   (rouge)
  //   0.5 → H=38  (orange-ambre)
  //   1   → H=142 (vert foncé)
  const hue = Math.round(ratio * 142);

  // Saturation : forte partout (85-90%)
  const saturation = 85;

  // Luminosité fond : plus clair (88% → 82%) pour rester lisible
  const lightnessBg = Math.round(92 - ratio * 10); // 92% à 0, 82% à 20

  // Luminosité texte : foncé pour contraste
  const lightnessText = Math.round(28 + ratio * 8); // 28% à 0, 36% à 20

  // Luminosité bordure : légèrement plus sombre que le fond
  const lightnessBorder = Math.round(lightnessBg - 12);

  const bg = `hsl(${hue}, ${saturation}%, ${lightnessBg}%)`;
  const text = `hsl(${hue}, ${saturation}%, ${lightnessText}%)`;
  const border = `hsl(${hue}, ${saturation}%, ${lightnessBorder}%)`;

  return { bg, text, border };
}

/**
 * Couleur de texte seule (pour les labels, badges, etc.)
 */
export function noteTextColor(note: number | null): string {
  return noteGradientColor(note).text;
}

/**
 * Couleur de fond seule
 */
export function noteBgColor(note: number | null): string {
  return noteGradientColor(note).bg;
}
