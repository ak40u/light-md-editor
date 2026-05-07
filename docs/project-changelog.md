# Project Changelog

## Unreleased

- **Mermaid diagrams**: live WYSIWYG preview for ` ```mermaid ` blocks, with
  zoom/pan, fullscreen, and clipboard export (SVG/PNG). Hardened against
  XSS via DOMPurify chokepoint + locked mermaid config (`securityLevel:
  'strict'`, `htmlLabels: false`, `secure` list against in-doc `%%{init}%%`
  overrides). CSP tightened: dropped `https:` from `img-src`, dropped Google
  Fonts, added `object-src 'none'`, `base-uri 'self'`, `frame-ancestors
  'none'`, `connect-src 'self'`. Mermaid loads lazily via dynamic import;
  diagram grammars further code-split by Rollup.
