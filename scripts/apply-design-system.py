#!/usr/bin/env python3
"""Apply Scintilla design system chrome to tools and blogs."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TOOL_HEADER_OLD = re.compile(
    r"<!-- SCINTILLA WORLD HEADER -->\s*"
    r'<header style="position:sticky;top:0;z-index:9999;[^"]*">'
    r".*?"
    r"</header>\s*",
    re.DOTALL,
)

TOOL_HEADER_OLD2 = re.compile(
    r"<!-- Scintilla chrome -->\s*"
    r'(?:<link rel="stylesheet" href="/assets/css/scintilla\.css">\s*)?'
    r'<header class="sw-header sw-header--tool">.*?</header>\s*',
    re.DOTALL,
)

TOOL_HEADER_NEW = """<!-- Scintilla chrome -->
<header class="sw-header sw-header--tool">
  <div class="sw-header__inner">
    <a href="/" class="sw-logo">
      <span class="sw-logo__mark" aria-hidden="true">S</span>
      Scintilla World
    </a>
    <nav class="sw-nav" aria-label="Site">
      <a href="/#tools">Tools</a>
      <a href="/blogs/">Blog</a>
    </nav>
  </div>
</header>
"""

BLOG_CHROME = """<header class="sw-header sw-header--tool">
  <motion class="sw-header__inner">
    <a href="/" class="sw-logo">
      <span class="sw-logo__mark" aria-hidden="true">S</span>
      Scintilla World
    </a>
    <button type="button" class="sw-menu-btn" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <nav class="sw-nav" aria-label="Site">
      <a href="/#tools">Tools</a>
      <a href="/blogs/">Blog</a>
      <a href="/privacy-policy.html">Privacy</a>
    </nav>
  </div>
</header>
<script src="/assets/js/scintilla-nav.js" defer></script>
""".replace("<motion class", "<div class")

BLOG_INLINE_HEADER = re.compile(
    r'<header style="width:100%;[^"]*">.*?</header>\s*'
    r'<div id="mobMenu"[^>]*>.*?</motion>\s*',
    re.DOTALL,
).pattern.replace("</motion>", "</motion>")

# fix regex - use </div> not </motion>
BLOG_INLINE_HEADER = re.compile(
    r'<header style="width:100%;[^"]*">.*?</header>\s*'
    r'<div id="mobMenu"[^>]*>.*?</div>\s*',
    re.DOTALL,
)

CSS_LINK = '<link rel="stylesheet" href="/assets/css/scintilla.css">'


def inject_css_link(html: str, after: str = "</head>") -> str:
    if "scintilla.css" in html:
        return html
    if after in html:
        return html.replace(after, f"  {CSS_LINK}\n{after}", 1)
    return html


def patch_tool(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text
    text = text.replace(
        "<!-- Scintilla chrome -->\n<link rel=\"stylesheet\" href=\"/assets/css/scintilla.css\">\n",
        "<!-- Scintilla chrome -->\n",
    )
    if TOOL_HEADER_OLD2.search(text):
        text = TOOL_HEADER_OLD2.sub(TOOL_HEADER_NEW + "\n", text, count=1)
    elif TOOL_HEADER_OLD.search(text):
        text = TOOL_HEADER_OLD.sub(TOOL_HEADER_NEW + "\n", text, count=1)
    if CSS_LINK not in text:
        text = inject_css_link(text)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def patch_blog_body(path: Path) -> bool:
    if path.name == "index.html":
        return False
    text = path.read_text(encoding="utf-8")
    orig = text
    text = inject_css_link(text)
    if 'class="sw-blog-legacy"' not in text:
        text = re.sub(r"<body([^>]*)>", r'<body class="sw-blog-legacy"\1>', text, count=1)
    if BLOG_INLINE_HEADER.search(text):
        text = BLOG_INLINE_HEADER.sub(BLOG_CHROME + "\n        ", text, count=1)
    text = text.replace("#a78bfa", "var(--sw-emerald, #10b981)")
    text = text.replace("#c4b5fd", "var(--sw-emerald-bright, #34d399)")
    text = text.replace("#7c3aed", "var(--sw-emerald, #10b981)")
    text = text.replace("rgba(124,58,237,", "rgba(16,185,129,")
    text = text.replace("background-color:#050505", "background-color:#06080c")
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    tools = list((ROOT / "tools").glob("*/index.html"))
    blogs = list((ROOT / "blogs").glob("*.html"))

    t_count = sum(1 for p in tools if patch_tool(p))
    b_count = sum(1 for p in blogs if patch_blog_body(p))
    print(f"Tools updated: {t_count}/{len(tools)}")
    print(f"Blogs patched: {b_count}/{len(blogs)}")


if __name__ == "__main__":
    main()
