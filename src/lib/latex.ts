// Modeller "LaTeX kullanma" talimatına rağmen zaman zaman LaTeX yazıyor (özellikle NVIDIA Nemotron).
// JSON içinde bu iki türlü sorun çıkarıyor:
//  1) "\setminus", "\{" gibi geçersiz kaçışlar → JSON.parse çöküyor (ölçüldü: denemeler boşa gitti)
//  2) "\neg", "\frac", "\times", "\rightarrow" geçerli kaçış gibi okunuyor ("\n", "\f", "\t", "\r")
//     → metin sessizce bozuluyor ("\neg p" yerine satır sonu + "eg p")
// Çözüm: ayrıştırmadan ÖNCE bilinen komutları Unicode'a çevir, kalan geçersiz kaçışları onar.

/** Komut adı → Unicode karşılığı. Yalnızca arkasından harf gelmeyen tam komutlar eşleşir. */
const COMMANDS: Record<string, string> = {
  // mantık
  neg: "¬", lnot: "¬", wedge: "∧", land: "∧", vee: "∨", lor: "∨", oplus: "⊕",
  rightarrow: "→", Rightarrow: "⇒", to: "→", implies: "⇒", leftarrow: "←",
  leftrightarrow: "↔", Leftrightarrow: "⇔", iff: "⇔", equiv: "≡",
  forall: "∀", exists: "∃", top: "⊤", bot: "⊥",
  // kümeler
  in: "∈", notin: "∉", subseteq: "⊆", subset: "⊂", supseteq: "⊇", supset: "⊃",
  cup: "∪", cap: "∩", bigcup: "⋃", bigcap: "⋂", setminus: "∖", emptyset: "∅", varnothing: "∅",
  times: "×", textbackslash: "∖",
  // karşılaştırma ve işlemler
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", approx: "≈", cdot: "·", div: "÷", pm: "±",
  infty: "∞", sum: "Σ", prod: "Π", sqrt: "√", circ: "∘",
  ldots: "…", dots: "…", cdots: "⋯",
  lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
  // Yunan harfleri
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", theta: "θ",
  lambda: "λ", mu: "μ", pi: "π", sigma: "σ", Sigma: "Σ", phi: "φ", omega: "ω", Omega: "Ω",
  log: "log", ln: "ln", mod: "mod", quad: " ", qquad: "  ",
};

const BLACKBOARD: Record<string, string> = { R: "ℝ", Z: "ℤ", N: "ℕ", Q: "ℚ", C: "ℂ" };

/**
 * Ham JSON metnindeki LaTeX'i Unicode'a çevirir. Hem tek ters ayraçlı ("\neg", geçersiz/yanıltıcı
 * JSON) hem doğru kaçışlı ("\\neg") yazımları yakalar; çıktıda ters ayraç kalmadığı için JSON geçerli olur.
 */
export function latexToUnicodeInJson(raw: string): string {
  return (
    raw
      // \mathbb{R} → ℝ
      .replace(/\\{1,2}mathbb\{([RZNQC])\}/g, (_, l: string) => BLACKBOARD[l])
      // \text{abc}, \mathrm{abc}, \textbf{abc} → abc
      .replace(/\\{1,2}(?:text|mathrm|textbf|mathit|operatorname)\{([^{}"]*)\}/g, "$1")
      // \frac{a}{b} → (a)/(b)
      .replace(/\\{1,2}frac\{([^{}"]*)\}\{([^{}"]*)\}/g, "($1)/($2)")
      // \{ \} → { }
      .replace(/\\{1,2}([{}])/g, "$1")
      // bilinen komutlar (arkasından harf gelmeyenler: "\neq" eşleşir, "\nequal" eşleşmez)
      .replace(/\\{1,2}([A-Za-z]+)(?![A-Za-z])/g, (whole, name: string) => (name in COMMANDS ? COMMANDS[name] : whole))
      // satır içi matematik ayraçları: \( \) \[ \]
      .replace(/\\{1,2}[()[\]]/g, "")
  );
}

/**
 * JSON'daki geçersiz kaçışları onarır. Kaçış çiftlerini soldan sağa TOPLU okur; böylece doğru
 * yazılmış "\\" çiftinin ikinci ters ayracı yeniden işlenip bozulmaz.
 */
export function repairJsonEscapes(raw: string): string {
  return raw.replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})|\\/g, (whole, valid?: string) => (valid ? whole : "\\\\"));
}

/** Modelin JSON metnini ayrıştırmaya hazırlar: önce LaTeX → Unicode, sonra kaçış onarımı. */
export function prepareModelJson(raw: string): string {
  return repairJsonEscapes(latexToUnicodeInJson(raw));
}
