// Global text normalization utilities used across legacy modules
(function () {
  function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text.trim().toLowerCase().replace(/[\s]+/g, ' ').replace(/[''`]/g, "'");
  }
  function flexibleTextMatch(a, b) {
    return normalizeText(a) === normalizeText(b);
  }
  function flexibleTextIncludes(a, b) {
    return normalizeText(a).includes(normalizeText(b));
  }
  window.normalizeText = window.normalizeText || normalizeText;
  window.flexibleTextMatch = window.flexibleTextMatch || flexibleTextMatch;
  window.flexibleTextIncludes = window.flexibleTextIncludes || flexibleTextIncludes;
})();

