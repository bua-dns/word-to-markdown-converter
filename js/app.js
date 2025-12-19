(function() {
  const quill = new Quill("#editor", {
    modules: {
      toolbar: '#toolbar-container',
    },
    theme: "snow",
  });
  const infoToggle = document.getElementById("info-toggle");
  const infoPanel = document.getElementById("info-panel");
  if (infoToggle && infoPanel) {
    infoToggle.addEventListener("click", () => {
      const isHidden = infoPanel.hasAttribute("hidden");
      if (isHidden) {
        infoPanel.removeAttribute("hidden");
        infoToggle.setAttribute("aria-expanded", "true");
      } else {
        infoPanel.setAttribute("hidden", "");
        infoToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
  function html2markdown(html) {
    const root = document.createElement("div");
    root.innerHTML = html;
    const state = {
      footnotes: [],
      seenFootnotes: new Set(),
      skipFootnoteSection: false,
    };
    const body = serializeChildren(root, { state, inline: false, depth: 0 }).trim();
    const footnotes = state.footnotes.length ? "\n" + state.footnotes.join("\n") : "";
    const cleaned = collapseBlankLines(removeTrailingSpaces(body));
    const combined = cleaned + footnotes;
    const normalizedDefs = ensureFootnoteDefinitionSyntax(combined);
    return normalizedDefs.replace(/\s+$/, "") + "\n";
  }

  function serializeChildren(parent, ctx) {
    const parts = [];
    parent.childNodes.forEach((child) => {
      const fragment = serializeNode(child, ctx);
      if (fragment) {
        parts.push(fragment);
      }
    });
    return parts.join("");
  }

  function serializeNode(node, ctx) {
    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeText(node.nodeValue, ctx.inline);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();

    if (!ctx.skipFootnoteSection && captureFootnoteDefinition(node, ctx.state)) {
      return "";
    }

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Number(tag.charAt(1));
        const text = serializeChildren(node, { ...ctx, inline: true }).trim();
        if (!text) return "";
        return `${"#".repeat(level)} ${text}\n\n`;
      }
      case "p": {
        const text = serializeChildren(node, { ...ctx, inline: true }).trim();
        return text ? `${text}\n\n` : "";
      }
      case "br":
        return ctx.inline ? "  \n" : "\n";
      case "strong":
      case "b": {
        const text = serializeChildren(node, { ...ctx, inline: true });
        return text ? `**${text}**` : "";
      }
      case "em":
      case "i": {
        const text = serializeChildren(node, { ...ctx, inline: true });
        return text ? `*${text}*` : "";
      }
      case "del":
      case "s": {
        const text = serializeChildren(node, { ...ctx, inline: true });
        return text ? `~~${text}~~` : "";
      }
      case "code": {
        const text = node.textContent || "";
        return renderInlineCode(text);
      }
      case "pre": {
        const codeEl =
          node.firstElementChild && node.firstElementChild.tagName.toLowerCase() === "code"
            ? node.firstElementChild
            : null;
        const raw = (codeEl ? codeEl.textContent : node.textContent) || "";
        const hint = extractLanguageHint(codeEl || node);
        const lines = raw.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
        const fence = "```";
        const header = hint ? `${fence}${hint}\n` : `${fence}\n`;
        return `${header}${lines}\n${fence}\n\n`;
      }
      case "blockquote": {
        const inner = serializeChildren(node, { ...ctx, inline: false }).trim();
        if (!inner) return "";
        const quoted = inner
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n");
        return `${quoted}\n\n`;
      }
      case "ul":
        return renderList(node, ctx, false);
      case "ol":
        return renderList(node, ctx, true);
      case "li":
        return serializeChildren(node, { ...ctx, inline: true });
      case "a": {
        const footnoteRef = extractFootnoteRef(node);
        if (footnoteRef) {
          const normalizedRef = normalizeFootnoteLabel(footnoteRef);
          return normalizedRef ? `[^${normalizedRef}]` : "";
        }
        const href = (node.getAttribute("href") || "").trim();
        const title = (node.getAttribute("title") || "").trim();
        const text = serializeChildren(node, { ...ctx, inline: true }).trim() || href;
        if (!href) return text;
        const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
        return `[${escapeLinkText(text)}](${href}${titlePart})`;
      }
      case "img": {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        const title = node.getAttribute("title");
        const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
        return src ? `![${alt}](${src}${titlePart})` : "";
      }
      case "hr":
        return `---\n\n`;
      case "sup": {
        const footnoteRef = extractFootnoteRef(node);
        if (footnoteRef) {
          const normalizedRef = normalizeFootnoteLabel(footnoteRef);
          return normalizedRef ? `[^${normalizedRef}]` : "";
        }
        const text = serializeChildren(node, { ...ctx, inline: true }).trim();
        return text ? `^${text}` : "";
      }
      case "table":
        return renderTable(node, ctx) + "\n";
      case "thead":
      case "tbody":
      case "tfoot":
      case "tr":
      case "th":
      case "td":
        // Table children are handled inside renderTable.
        return "";
      case "section":
      case "div":
      case "aside": {
        if (!ctx.skipFootnoteSection && node.classList && node.classList.contains("footnotes")) {
          collectFootnotes(node, ctx.state);
          return "";
        }
        const inner = serializeChildren(node, { ...ctx, inline: false });
        return inner ? `${inner}\n` : "";
      }
      default: {
        const isBlock = BLOCK_ELEMENTS.has(tag);
        const inner = serializeChildren(node, { ...ctx, inline: !isBlock });
        if (!inner) return "";
        return isBlock ? `${inner}\n` : inner;
      }
    }
  }

  const BLOCK_ELEMENTS = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "canvas",
    "dd",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "header",
    "hr",
    "li",
    "main",
    "nav",
    "noscript",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "tfoot",
    "ul",
  ]);

  const FOOTNOTE_NODE_TAGS = new Set(["p", "li", "dd", "dt"]);

  function renderList(list, ctx, ordered) {
    const depth = ctx.depth || 0;
    const items = [];
    let index = 1;
    list.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "li") {
        const listType = detectListType(list, child, ordered);
        items.push(renderListItem(child, { ...ctx, depth: depth + 1 }, listType, index));
        if (listType === "ordered") {
          index += 1;
        }
      }
    });
    const joined = items.join("");
    return joined ? `${joined}\n` : "";
  }

  function renderListItem(item, ctx, listType, index) {
    const depth = ctx.depth || 1;
    const indent = "  ".repeat(depth - 1);
    const isTask = listType === "checked" || listType === "unchecked";
    const marker = listType === "ordered" ? `${index}.` : "-";
    let content = serializeChildren(item, { ...ctx, inline: true }).trim();
    if (isTask) {
      const checkbox = listType === "checked" ? "[x]" : "[ ]";
      content = content ? `${checkbox} ${content}` : checkbox;
    }
    if (!content) return "";
    const lines = content.split("\n");
    const firstLine = lines.shift();
    let result = `${indent}${marker} ${firstLine}`;
    const subsequentIndent = indent + " ".repeat(marker.length + 1);
    lines.forEach((line) => {
      result += line ? `\n${subsequentIndent}${line}` : `\n${subsequentIndent}`;
    });
    return `${result}\n`;
  }

  function detectListType(listEl, item, defaultOrdered) {
    const dataList = (item.getAttribute("data-list") || "").toLowerCase();
    if (dataList === "bullet") return "bullet";
    if (dataList === "ordered") return "ordered";
    if (dataList === "checked" || dataList === "unchecked") return dataList;
    const tag = listEl.tagName ? listEl.tagName.toLowerCase() : "";
    if (tag === "ul") return "bullet";
    return defaultOrdered ? "ordered" : "bullet";
  }

  function renderTable(tableEl, ctx) {
    const rows = Array.from(tableEl.querySelectorAll("tr"));
    if (!rows.length) return "";
    const matrix = rows.map((row) => {
      const cells = Array.from(row.children).filter((cell) => {
        const tag = cell.tagName.toLowerCase();
        return tag === "td" || tag === "th";
      });
      return cells.map((cell) =>
        serializeChildren(cell, {
          state: ctx.state,
          inline: true,
          depth: (ctx.depth || 0) + 1,
          skipFootnoteSection: true,
        }).trim()
      );
    });

    let header = null;
    const body = [];
    rows.forEach((row, idx) => {
      const isHeader = row.querySelector("th");
      if (isHeader && !header) {
        header = matrix[idx];
      } else {
        body.push(matrix[idx]);
      }
    });

    if (!header && body.length) {
      header = body.shift();
    }

    const columnCount = Math.max(header ? header.length : 0, ...body.map((r) => r.length));
    if (!header) {
      header = Array(columnCount).fill("");
    }

    const padRow = (row) => {
      const clone = row.slice();
      while (clone.length < columnCount) clone.push("");
      return clone;
    };

    header = padRow(header);
    const normalizedBody = body.map(padRow);
    const widths = Array(columnCount).fill(0);

    [header, ...normalizedBody].forEach((row) => {
      row.forEach((cell, i) => {
        const len = cell ? cell.length : 0;
        if (len > widths[i]) {
          widths[i] = len;
        }
      });
    });

    const safeWidths = widths.map((w) => Math.max(3, w));
    const pad = (value, width) => {
      const text = value || "";
      const diff = width - text.length;
      return diff > 0 ? `${text}${" ".repeat(diff)}` : text;
    };

    const makeLine = (row) => `| ${row.map((cell, idx) => pad(cell, safeWidths[idx])).join(" | ")} |`;
    const headerLine = makeLine(header);
    const dividerLine = `| ${safeWidths.map((w) => "-".repeat(w)).join(" | ")} |`;
    const bodyLines = normalizedBody.map(makeLine);

    return [headerLine, dividerLine, ...bodyLines].join("\n");
  }

  function renderInlineCode(text) {
    const content = (text || "").replace(/\r\n?/g, "\n");
    if (!content.includes("`")) {
      return "`" + content + "`";
    }
    const longest = content.match(/`+/g)?.reduce((acc, ticks) => Math.max(acc, ticks.length), 0) || 0;
    const fence = "`".repeat(longest + 1);
    return `${fence}${content}${fence}`;
  }

  function extractLanguageHint(node) {
    if (!node || !node.getAttribute) return "";
    const data = node.getAttribute("data-language") || node.getAttribute("lang");
    if (data) return data;
    const className = node.getAttribute("class") || "";
    const match = className.match(/language-([\w-]+)/);
    return match ? match[1] : "";
  }

  function normalizeText(text, inline) {
    if (!text) return "";
    const cleaned = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
    return inline ? cleaned : cleaned;
  }

  function collapseBlankLines(text) {
    return text.replace(/\n{3,}/g, "\n\n");
  }

  function removeTrailingSpaces(text) {
    return text
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""))
      .join("\n");
  }

  function escapeLinkText(text) {
    return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  }

  function stripFootnoteBrackets(text) {
    if (!text) return "";
    return text.replace(/^[\[\(\s]+/, "").replace(/[\]\)\s\.]+$/, "");
  }

  function ensureFootnoteDefinitionSyntax(markdown) {
    return markdown.replace(/^(\[\^[^\]]+\])([ \t]+)(?!:)(?=\S)/gm, (_match, label) => `${label}: `);
  }

  function normalizeFootnoteLabel(label) {
    const trimmed = (label || "").trim();
    if (!trimmed) return "";
    const romanValue = parseRomanNumeral(trimmed);
    if (romanValue !== null) {
      return String(romanValue);
    }
    return trimmed;
  }

  function parseRomanNumeral(input) {
    const value = (input || "").trim().toUpperCase();
    if (!value) return null;
    const romanPattern = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
    if (!romanPattern.test(value)) {
      return null;
    }
    const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    let previous = 0;
    for (let i = value.length - 1; i >= 0; i -= 1) {
      const current = romanMap[value[i]];
      if (!current) {
        return null;
      }
      if (current < previous) {
        total -= current;
      } else {
        total += current;
        previous = current;
      }
    }
    return total;
  }

  function isInsideFootnoteDefinition(node) {
    if (!node || !node.closest) return false;
    const container = node.closest("[id]");
    if (!container) return false;
    const id = (container.getAttribute("id") || "").toLowerCase();
    return /^_(?:edn|ftn)\d+/.test(id);
  }

  function extractFootnoteRefFromAnchor(anchor, allowDefinition) {
    if (!anchor) return null;
    if (!allowDefinition && isInsideFootnoteDefinition(anchor)) {
      return null;
    }
    const data = anchor.getAttribute("data-footnote-ref") || anchor.getAttribute("data-footnote-id");
    if (data) {
      return stripFootnoteBrackets(data);
    }
    const href = (anchor.getAttribute("href") || "").trim().toLowerCase();
    const nameAttr = (anchor.getAttribute("name") || "").trim().toLowerCase();
    const text = stripFootnoteBrackets((anchor.textContent || "").trim());
    const hrefMatch = href.match(/^#_(?:edn|ftn)([\w-]+)/);
    const fnMatch = href.match(/^#fn:?([\w-]+)/);
    const backrefMatch = nameAttr.match(/^_(?:edn|ftn)ref([\w-]+)/);
    if (text) {
      return text;
    }
    if (hrefMatch && hrefMatch[1]) {
      return hrefMatch[1];
    }
    if (fnMatch && fnMatch[1]) {
      return fnMatch[1];
    }
    if (backrefMatch && backrefMatch[1]) {
      return backrefMatch[1];
    }
    return null;
  }

  function registerFootnote(state, label, content) {
    if (!label || !content) return;
    const normalizedLabel = normalizeFootnoteLabel(label);
    if (!normalizedLabel) return;
    if (!state.seenFootnotes) {
      state.seenFootnotes = new Set();
    }
    if (state.seenFootnotes.has(normalizedLabel)) {
      return;
    }
    state.seenFootnotes.add(normalizedLabel);
    const formatted = content.replace(/\n/g, "\n    ");
    state.footnotes.push(`[^${normalizedLabel}]: ${formatted}`);
  }

  function captureFootnoteDefinition(node, state) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.tagName && node.tagName.toLowerCase() === "a") return false;

    const tagName = node.tagName ? node.tagName.toLowerCase() : "";
    const idAttr = (node.getAttribute("id") || "").toLowerCase();
    const anchorForLabel =
      node.querySelector && node.querySelector('a[name^="_edn"], a[name^="_ftn"], a[id^="_edn"], a[id^="_ftn"]');
    if (!idAttr && (!FOOTNOTE_NODE_TAGS.has(tagName) || !anchorForLabel)) return false;
    if (anchorForLabel) {
      const owner = anchorForLabel.closest("p,li,dd,dt") || anchorForLabel.parentElement;
      if (owner && owner !== node && !idAttr) {
        return false;
      }
    }
    if (idAttr && !/^_(?:edn|ftn)\d+/.test(idAttr)) {
      return false;
    }

    const label = deriveFootnoteLabelFromNode(node, anchorForLabel);
    if (!label) {
      return false;
    }

    const clone = node.cloneNode(true);
    clone.removeAttribute && clone.removeAttribute("id");

    // START KORRIGIERTE LOGIK ZUR ENTFERNUNG VON BACKREFERENCE-LINKS
    clone.querySelectorAll &&
      clone.querySelectorAll("a").forEach((anchor) => {
        const href = (anchor.getAttribute("href") || "").toLowerCase();
        const text = (anchor.textContent || "").trim();

        // Entferne Rücksprung-Links (Backreferences)
        const isBackreference =
          // 1. Link mit Klasse, die auf Rücksprung hindeutet (z.B. Word-HTML-Export)
          /backlink|backref|footnote-return/i.test(anchor.getAttribute("class") || "") ||
          // 2. Link, der zurück zum Referenzpunkt im Text springt (typisches Muster)
          href.startsWith("#_ftnref") ||
          href.startsWith("#fnref") ||
          // 3. Link, der nur ein Rücksprungzeichen enthält
          text === "↩︎" ||
          text === "return" ||
          text === "↑";

        // Entferne auch Anker-Tags, die nur die Fußnotennummer selbst umschließen,
        // wenn sie keinen anderen Inhalt haben und auf sich selbst verweisen.
        const isSelfReference = (href.startsWith("#_ftn") || href.startsWith("#fn")) && text === label;

        if (isBackreference || isSelfReference) {
          anchor.remove();
        }
      });
    // ENDE KORRIGIERTE LOGIK ZUR ENTFERNUNG VON BACKREFERENCE-LINKS

    const content = serializeChildren(clone, {
      state,
      inline: false,
      depth: 0,
      skipFootnoteSection: true,
    }).trim();
    if (!content) return true;

    registerFootnote(state, label, content);
    return true;
  }

  function deriveFootnoteLabelFromNode(node, preferredAnchor) {
    if (!node) return null;
    const anchor =
      preferredAnchor ||
      (node.querySelector &&
        node.querySelector(
          'a[href^="#_edn"], a[href^="#_ftn"], a[href^="#fn"], a[name^="_edn"], a[name^="_ftn"], a[class*="Footnote"], a[class*="Endnote"]'
        ));
    if (anchor) {
      const label = extractFootnoteRefFromAnchor(anchor, true);
      if (label) return label;
    }
    const idAttr = node.getAttribute && node.getAttribute("id");
    if (idAttr) {
      const match = idAttr.match(/_(?:edn|ftn)([\w-]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function extractFootnoteRef(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toLowerCase();
    if (tag === "a") {
      return extractFootnoteRefFromAnchor(node, false);
    }
    if (tag === "sup") {
      const child = node.firstElementChild;
      if (child && child.tagName.toLowerCase() === "a") {
        const anchorLabel = extractFootnoteRefFromAnchor(child, false);
        if (anchorLabel) return anchorLabel;
      }
      const data = node.getAttribute("data-footnote-ref");
      if (data) return data;
      const text = (node.textContent || "").trim();
      if (text) {
        const label = stripFootnoteBrackets(text);
        if (label) return label;
      }
    }
    return null;
  }

  function collectFootnotes(container, state) {
    const lists = Array.from(container.querySelectorAll("ol, ul"));
    lists.forEach((list) => {
      Array.from(list.children).forEach((item) => {
        if (item.tagName.toLowerCase() !== "li") return;
        const rawLabel = extractFootnoteLabel(item);
        const label = normalizeFootnoteLabel(rawLabel);
        if (!label) return;
        const clone = item.cloneNode(true);
        clone.querySelectorAll("a").forEach((anchor) => {
          const href = anchor.getAttribute("href") || "";
          if (href.startsWith("#fnref")) {
            anchor.remove();
          }
        });
        const content = serializeChildren(clone, {
          state,
          inline: false,
          depth: 0,
          skipFootnoteSection: true,
        }).trim();
        if (!content) return;
        registerFootnote(state, label, content);
      });
    });
  }

  function extractFootnoteLabel(item) {
    const id = item.getAttribute("id");
    if (id) {
      const match = id.match(/fn:?([\w-]+)/i);
      if (match) {
        return match[1];
      }
    }
    const dataLabel = item.getAttribute("data-footnote-label");
    if (dataLabel) return dataLabel;
    const anchor = item.querySelector("a");
    if (anchor) {
      const text = anchor.getAttribute("data-footnote-ref") || anchor.textContent;
      const label = stripFootnoteBrackets(text ? text.trim() : "");
      if (label) {
        return label;
      }
    }
    return null;
  }
  const copyBtn = document.getElementById("copy-markdown");
  const copyIconBtn = document.getElementById("copy-icon");
  const markdownDiv = document.getElementById("markdown");
  const previewDiv = document.getElementById("preview");
  let lastMarkdown = "";

  // Initialize markdown-it
  let md;
  try {
    md = window.markdownit({
      html: true,
      linkify: true,
      typographer: true,
    });
    if (window.markdownitFootnote) {
      md.use(window.markdownitFootnote);
    }
  } catch (e) {
    console.warn("Markdown-it init failed", e);
  }

  function updateOutput() {
    const markdown = html2markdown(quill.root.innerHTML);
    const isEmpty = !markdown.trim();

    // Toggle visibility
    if (isEmpty) {
      copyBtn.style.display = "none";
      if (copyIconBtn) copyIconBtn.style.display = "none";
    } else {
      copyBtn.style.display = "";
      if (copyIconBtn) copyIconBtn.style.display = "";
    }

    // Update Source
    const pre = document.createElement("pre");
    pre.textContent = markdown;
    markdownDiv.innerHTML = "";
    markdownDiv.appendChild(pre);
    lastMarkdown = markdown;

    // Update Preview
    if (md) {
      try {
        previewDiv.innerHTML = md.render(markdown);
      } catch (e) {
        console.error("Preview render error", e);
        previewDiv.innerHTML = "<p style='color:red'>Error rendering preview</p>";
      }
    }
  }

  // Live update
  let debounceTimer;
  quill.on("text-change", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateOutput, 250);
  });

  // Initial render
  updateOutput();

  async function copyTextToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      // fall through to fallback
    }
    // Fallback: temporary textarea
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      // Prevent scrolling to bottom on iOS
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  async function performCopy(btnElement) {
    const text = lastMarkdown || html2markdown(quill.root.innerHTML);
    if (!text) return;

    const originalContent = btnElement.innerHTML;
    btnElement.disabled = true;

    const success = await copyTextToClipboard(text);

    if (btnElement.classList.contains("copy-icon-btn")) {
      btnElement.style.color = success ? "#2ea043" : "#da3633";
      setTimeout(() => {
        btnElement.innerHTML = originalContent;
        btnElement.style.color = "";
        btnElement.disabled = false;
      }, 1200);
    } else {
      btnElement.textContent = success ? "Copied!" : "Copy failed";
      setTimeout(() => {
        btnElement.innerHTML = originalContent;
        btnElement.disabled = false;
      }, 1200);
    }
  }

  copyBtn.addEventListener("click", () => performCopy(copyBtn));
  if (copyIconBtn) copyIconBtn.addEventListener("click", () => performCopy(copyIconBtn));
})();
