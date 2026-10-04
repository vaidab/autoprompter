import type { Token } from "./protocol";
import { Marked } from "marked";
import DOMPurify from "dompurify";

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const markdown = new Marked({
  breaks: true,
  renderer: {
    html({ text }) {
      return escape(text);
    },
    link({ tokens }) {
      return this.parser.parseInline(tokens);
    },
    image({ text }) {
      return escape(text);
    },
    br() {
      return "<br>\n";
    },
  },
});
export function tokenize(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu)]
    .filter((m) => !m[0].includes("\u20e3"))
    .map((m, id) => {
      const normalized = m[0]
        .normalize("NFC")
        .toLocaleLowerCase("ro")
        .replaceAll("ş", "ș")
        .replaceAll("ţ", "ț");
      return {
        id,
        start: m.index!,
        end: m.index! + m[0].length,
        normalized,
        folded: normalized.normalize("NFD").replace(/\p{M}/gu, ""),
      };
    });
}
export function renderScript(container: HTMLElement, text: string): Token[] {
  container.innerHTML = DOMPurify.sanitize(
    markdown.parse(text, { async: false }),
    {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "pre",
        "code",
        "del",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
      ],
      ALLOWED_ATTR: ["start"],
    },
  );
  // Tokenize the displayed text, then wrap its ranges without losing formatting.
  // A word split by emphasis keeps one token ID across its DOM fragments.
  const tokens = tokenize(container.textContent ?? "");
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  let offset = 0,
    index = 0;
  for (const node of nodes) {
    const value = node.data,
      end = offset + value.length;
    const fragment = document.createDocumentFragment();
    let local = 0;
    while (index < tokens.length && tokens[index].start < end) {
      const token = tokens[index];
      const start = Math.max(0, token.start - offset);
      const stop = Math.min(value.length, token.end - offset);
      fragment.append(document.createTextNode(value.slice(local, start)));
      const span = document.createElement("span");
      span.dataset.token = String(token.id);
      span.textContent = value.slice(start, stop);
      fragment.append(span);
      local = stop;
      if (token.end > end) break;
      index++;
    }
    fragment.append(document.createTextNode(value.slice(local)));
    node.replaceWith(fragment);
    offset = end;
  }
  return tokens;
}

export function markProgress(container: HTMLElement, anchor: number | null) {
  for (const span of container.querySelectorAll<HTMLElement>("[data-token]")) {
    const id = Number(span.dataset.token);
    span.classList.toggle("read", anchor !== null && id < anchor);
    span.classList.toggle("current", id === anchor);
  }
}
