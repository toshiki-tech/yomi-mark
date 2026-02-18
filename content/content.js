/**
 * YomiMark Content Script
 * Detects text selection, tokenizes Japanese text with kuromoji,
 * and injects furigana ruby annotations into the page DOM.
 */
(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────
  let tokenizer = null;
  let tokenizerLoading = false;
  let enabled = true;
  let floatingBtn = null;
  let currentSelection = null;

  // ── Kanji Detection ────────────────────────────────────────────────
  // CJK Unified Ideographs + Extension A
  const KANJI_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF]/;

  function containsKanji(str) {
    return KANJI_REGEX.test(str);
  }

  // ── Katakana → Hiragana conversion ─────────────────────────────────
  function katakanaToHiragana(str) {
    return str.replace(/[\u30A1-\u30F6]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0x60);
    });
  }

  // ── Initialize kuromoji tokenizer ──────────────────────────────────
  function initTokenizer() {
    if (tokenizer || tokenizerLoading) return Promise.resolve(tokenizer);
    tokenizerLoading = true;

    const dictPath = chrome.runtime.getURL("dict/");

    return new Promise(function (resolve, reject) {
      kuromoji.builder({ dicPath: dictPath }).build(function (err, built) {
        tokenizerLoading = false;
        if (err) {
          console.error("[YomiMark] Failed to load tokenizer:", err);
          reject(err);
          return;
        }
        tokenizer = built;
        console.log("[YomiMark] Tokenizer ready");
        resolve(tokenizer);
      });
    });
  }

  // ── Build ruby HTML from tokens ────────────────────────────────────
  function buildRubyHTML(tokens) {
    let html = "";
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const surface = token.surface_form;
      const reading = token.reading;

      // If token contains kanji and has a reading, add ruby annotation
      if (containsKanji(surface) && reading) {
        const hiragana = katakanaToHiragana(reading);
        // Only add ruby if reading differs from surface (avoid annotating pure kana)
        if (hiragana !== surface) {
          html +=
            '<ruby class="yomimark-ruby">' +
            escapeHTML(surface) +
            "<rp>(</rp><rt>" +
            escapeHTML(hiragana) +
            "</rt><rp>)</rp></ruby>";
        } else {
          html += escapeHTML(surface);
        }
      } else {
        html += escapeHTML(surface);
      }
    }
    return html;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Replace selection with annotated HTML ──────────────────────────
  function annotateSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Show loading state
    if (floatingBtn) {
      floatingBtn.classList.add("yomimark-loading");
      floatingBtn.textContent = "⏳";
    }

    initTokenizer()
      .then(function (tk) {
        const tokens = tk.tokenize(selectedText);
        const rubyHTML = buildRubyHTML(tokens);

        // Create a document fragment with the annotated content
        const template = document.createElement("template");
        template.innerHTML = rubyHTML;
        const fragment = template.content;

        // Wrap in a span so we can identify YomiMark annotations
        const wrapper = document.createElement("span");
        wrapper.className = "yomimark-annotated";
        wrapper.appendChild(fragment);

        // Replace selection with annotated content
        range.deleteContents();
        range.insertNode(wrapper);

        // Clear selection
        selection.removeAllRanges();
        removeFloatingBtn();
      })
      .catch(function (err) {
        console.error("[YomiMark] Annotation failed:", err);
        removeFloatingBtn();
      });
  }

  // ── Floating Button ────────────────────────────────────────────────
  function createFloatingBtn(x, y) {
    removeFloatingBtn();

    floatingBtn = document.createElement("button");
    floatingBtn.className = "yomimark-float-btn";
    floatingBtn.textContent = "読";
    floatingBtn.title = "Add furigana (YomiMark)";

    // Position near the selection
    floatingBtn.style.left = x + "px";
    floatingBtn.style.top = y + "px";

    floatingBtn.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      annotateSelection();
    });

    document.body.appendChild(floatingBtn);

    // Animate in
    requestAnimationFrame(function () {
      floatingBtn && floatingBtn.classList.add("yomimark-float-btn--visible");
    });
  }

  function removeFloatingBtn() {
    if (floatingBtn && floatingBtn.parentNode) {
      floatingBtn.parentNode.removeChild(floatingBtn);
    }
    floatingBtn = null;
  }

  // ── Selection Handler ──────────────────────────────────────────────
  function handleMouseUp(e) {
    if (!enabled) return;

    // Ignore clicks on our own button
    if (e.target && e.target.classList && e.target.classList.contains("yomimark-float-btn")) {
      return;
    }

    // Small delay to let browser finalize selection
    setTimeout(function () {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : "";

      if (selectedText.length > 0 && containsKanji(selectedText)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position floating button above the selection, centered
        const x = rect.left + rect.width / 2 - 18 + window.scrollX;
        const y = rect.top - 45 + window.scrollY;

        createFloatingBtn(x, y);
      } else {
        removeFloatingBtn();
      }
    }, 10);
  }

  function handleMouseDown(e) {
    // Remove floating button when clicking elsewhere
    if (e.target && e.target.classList && !e.target.classList.contains("yomimark-float-btn")) {
      removeFloatingBtn();
    }
  }

  // ── Extension State Management ─────────────────────────────────────
  function setEnabled(state) {
    enabled = state;
    if (!enabled) {
      removeFloatingBtn();
    }
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === "SET_ENABLED") {
      setEnabled(message.enabled);
      sendResponse({ success: true });
    } else if (message.type === "GET_STATUS") {
      sendResponse({ enabled: enabled, tokenizerReady: !!tokenizer });
    }
  });

  // Load initial state from storage
  chrome.storage.local.get(["yomimarkEnabled"], function (result) {
    if (result.yomimarkEnabled === false) {
      enabled = false;
    }
  });

  // ── Event Listeners ────────────────────────────────────────────────
  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("mousedown", handleMouseDown, true);

  // Preload tokenizer in background after a delay
  setTimeout(function () {
    if (enabled) {
      initTokenizer().catch(function () {
        // Silent fail on preload — will retry when user selects text
      });
    }
  }, 2000);

  console.log("[YomiMark] Content script loaded");
})();
