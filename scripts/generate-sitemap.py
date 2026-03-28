#!/usr/bin/env python3
"""Regenerate sitemap.xml for https://scintilla.world (run from repository root)."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

BASE = "https://scintilla.world"
ROOT = Path(__file__).resolve().parent.parent


def url_entry(loc: str, priority: str, changefreq: str) -> ET.Element:
    u = ET.Element("url")
    ET.SubElement(u, "loc").text = loc
    ET.SubElement(u, "lastmod").text = date.today().isoformat()
    ET.SubElement(u, "changefreq").text = changefreq
    ET.SubElement(u, "priority").text = priority
    return u


def main() -> None:
    root_el = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    root_el.append(url_entry(f"{BASE}/", "1.0", "weekly"))

    pp = ROOT / "privacy-policy.html"
    if pp.is_file():
        root_el.append(url_entry(f"{BASE}/privacy-policy.html", "0.4", "yearly"))

    blog_dir = ROOT / "blogs"
    if blog_dir.is_dir():
        for p in sorted(blog_dir.glob("*.html")):
            rel = p.relative_to(ROOT).as_posix()
            pri = "0.9" if p.name == "index.html" else "0.8"
            root_el.append(url_entry(f"{BASE}/{rel}", pri, "monthly"))

    tools_root = ROOT / "tools/crazy-ideas"
    if tools_root.is_dir():
        for p in sorted(tools_root.glob("*/index.html")):
            rel = p.relative_to(ROOT).as_posix()
            root_el.append(url_entry(f"{BASE}/{rel}", "0.7", "monthly"))

    priv = ROOT / "website/privacypolicy"
    if priv.is_dir():
        for p in sorted(priv.glob("*.html")):
            rel = p.relative_to(ROOT).as_posix()
            root_el.append(url_entry(f"{BASE}/{rel}", "0.3", "yearly"))

    ET.indent(root_el, space="  ")
    out = ROOT / "sitemap.xml"
    tree = ET.ElementTree(root_el)
    with open(out, "wb") as f:
        f.write(b'<?xml version="1.0" encoding="UTF-8"?>\n')
        tree.write(f, encoding="utf-8", xml_declaration=False)
    print(f"Wrote {out} ({len(list(root_el))} URLs)")


if __name__ == "__main__":
    main()
