import { Marked } from "marked";
import { base } from "$app/paths";

const marked = new Marked({
  gfm: true,
  breaks: false,
  async: false,
});

// Prefix relative image src with the SvelteKit base path so a GH Pages subpath
// deploy still resolves `assets/foo.png` correctly.
marked.use({
  renderer: {
    image(this: unknown, { href, title, text }: { href: string; title?: string | null; text: string }) {
      const resolved = /^(https?:|data:|\/)/.test(href) ? href : `${base}/${href}`;
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      return `<img src="${escapeAttr(resolved)}" alt="${escapeAttr(text)}"${titleAttr} loading="lazy" />`;
    },
  },
});

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function renderMarkdown(src: string): string {
  return marked.parse(src) as string;
}
