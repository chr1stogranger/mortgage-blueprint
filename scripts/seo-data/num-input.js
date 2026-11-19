// Thousands separators that appear while you type in a dollar field, shared by
// tax-calc.client.js and ll-calc.client.js. Served as /seo/num-input.js under
// the same name, so their "./num-input.js" import works in Node and the browser.

/**
 * Regroup a field's digits with commas, keeping the caret after the same digit.
 * @returns {{ text: string, caret: number }}
 */
export function groupDigits(value, caret) {
  const before = value.slice(0, caret).replace(/\D/g, "").length;
  const raw = value.replace(/\D/g, "");
  const digits = raw.replace(/^0+(?=\d)/, "");
  const dropped = raw.length - digits.length; // leading zeros removed ahead of the caret
  const text = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const want = Math.max(0, before - dropped);
  let pos = 0;
  for (let seen = 0; pos < text.length && seen < want; pos++) if (text[pos] !== ",") seen++;
  return { text, caret: pos };
}

/** Make an input keep its commas live, so 12345 reads 12,345 before you finish typing. */
export function liveCommas(input) {
  // Backspace or Delete next to a comma removes the digit beyond it, not just the comma (which would come right back).
  input.addEventListener("keydown", (e) => {
    const at = input.selectionStart;
    if (at == null || at !== input.selectionEnd) return;
    if (e.key === "Backspace" && input.value[at - 1] === ",") input.setSelectionRange(at - 1, at - 1);
    else if (e.key === "Delete" && input.value[at] === ",") input.setSelectionRange(at + 1, at + 1);
  });
  input.addEventListener("input", () => {
    const { text, caret } = groupDigits(input.value, input.selectionStart ?? input.value.length);
    if (text === input.value) return;
    input.value = text;
    if (document.activeElement === input) input.setSelectionRange(caret, caret);
  });
}
