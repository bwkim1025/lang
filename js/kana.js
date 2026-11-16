const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const HIRAGANA_SHIFT = 0x60;

const PUNCTUATION = /[\s\u3000.,!?;:'"“”‘’。、！？・「」『』（）()[\]…—~～〜･\-–—/]/g;

export function kataToHira(text) {
  return String(text ?? "").replace(/[\u30a1-\u30f6]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code < KATAKANA_START || code > KATAKANA_END) return char;
    return String.fromCharCode(code - HIRAGANA_SHIFT);
  });
}

export function stripJapanesePunctuation(text) {
  return String(text ?? "").replace(PUNCTUATION, "");
}

export function normalizeKana(text) {
  return stripJapanesePunctuation(kataToHira(String(text ?? "").normalize("NFKC")));
}
