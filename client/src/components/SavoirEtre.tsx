/**
 * Composant SavoirEtre — Évaluation comportementale
 * 5 critères notés de 1 à 10 avec curseur visuel
 */
import { CRITERES_SAVOIR_ETRE, couleurSavoirEtre, calculerMoyenneSavoirEtre, type NotesSavoirEtre } from "@/lib/savoirEtre";

interface Props {
  notes: NotesSavoirEtre;
  onChange: (id: string, val: number | null) => void;
}

export default function SavoirEtre({ notes, onChange }: Props) {
  const moyenne = calculerMoyenneSavoirEtre(notes);
  const { bg: moyBg, text: moyText, border: moyBorder } = couleurSavoirEtre(moyenne);

  const handleInput = (id: string, raw: string) => {
    if (raw === "" || raw === null) { onChange(id, null); return; }
    let n = parseFloat(raw);
    if (isNaN(n)) { onChange(id, null); return; }
    n = Math.max(1, Math.min(10, Math.round(n * 2) / 2)); // pas de 0.5
    onChange(id, n);
  };

  return (
    <div
      className="rounded-2xl shadow-sm overflow-hidden"
      style={{ background: "white", border: "1px solid #E7E5E4" }}
    >
      {/* En-tête */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ background: "#FAFAF9", borderColor: "#E7E5E4" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🌟</span>
          <div>
            <h3 className="text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
              Savoir-être
            </h3>
            <p className="text-xs text-stone-400">5 critères notés de 1 à 10</p>
          </div>
        </div>
        {/* Moyenne */}
        {moyenne !== null && (
          <div
            className="flex flex-col items-center px-4 py-1.5 rounded-xl"
            style={{ background: moyBg, border: `1.5px solid ${moyBorder}` }}
          >
            <span className="text-xl font-black tabular-nums" style={{ fontFamily: "'Outfit', sans-serif", color: moyText }}>
              {moyenne.toFixed(1)}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: moyText, opacity: 0.75 }}>/10 moy.</span>
          </div>
        )}
      </div>

      {/* Critères */}
      <div className="px-5 py-4 space-y-3">
        {CRITERES_SAVOIR_ETRE.map((critere) => {
          const note = notes[critere.id] ?? null;
          const { bg, text, border } = couleurSavoirEtre(note);
          const pct = note !== null ? ((note - 1) / 9) * 100 : 0;

          return (
            <div key={critere.id} className="flex items-center gap-3">
              {/* Emoji + libellé */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base flex-shrink-0">{critere.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{critere.libelle}</p>
                  <p className="text-xs text-stone-400 truncate hidden sm:block">{critere.description}</p>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="flex-1 hidden sm:block max-w-[120px]">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F5F5F4" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      background: note !== null ? critere.couleur : "transparent",
                    }}
                  />
                </div>
              </div>

              {/* Input note */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Boutons - / + */}
                <button
                  onClick={() => {
                    const cur = notes[critere.id] ?? null;
                    if (cur === null) onChange(critere.id, 5);
                    else if (cur > 1) onChange(critere.id, Math.round((cur - 0.5) * 2) / 2);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition-all"
                  style={{ background: "#F5F5F4", color: "#57534E" }}
                >
                  −
                </button>

                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={note !== null ? note : ""}
                  onChange={(e) => handleInput(critere.id, e.target.value)}
                  placeholder="—"
                  className="w-14 text-center rounded-lg px-1 py-1.5 text-sm font-bold outline-none transition-all"
                  style={{
                    background: note !== null ? bg : "#F5F5F4",
                    border: `1.5px solid ${note !== null ? border : "#E7E5E4"}`,
                    color: note !== null ? text : "#A8A29E",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = critere.couleur)}
                  onBlur={(e) => (e.target.style.borderColor = note !== null ? border : "#E7E5E4")}
                />

                <button
                  onClick={() => {
                    const cur = notes[critere.id] ?? null;
                    if (cur === null) onChange(critere.id, 5);
                    else if (cur < 10) onChange(critere.id, Math.round((cur + 0.5) * 2) / 2);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition-all"
                  style={{ background: "#F5F5F4", color: "#57534E" }}
                >
                  +
                </button>

                <span className="text-xs text-stone-400 w-6 text-center">/10</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
