# Word to Markdown Converter

Single-page utility that lets you paste formatted content (e.g. from Word), edit it with a Quill-based rich text toolbar, and instantly see the generated Markdown as well as a rendered preview.

## Features

- [Quill](https://quilljs.com/) editor with headers, emphasis, lists, links, and superscript controls
- Auto-converted Markdown source with syntax-normalized tables and footnotes
- Live preview powered by [markdown-it](https://github.com/markdown-it/markdown-it) + [markdown-it-footnote](https://github.com/markdown-it/markdown-it-footnote)
- Copy-to-clipboard actions (button + icon)

## Getting Started

1. Clone or download this repository.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
3. Paste or type your content into the editor and watch the Markdown + preview update in real time.

## Project Structure

- [index.html](index.html): Base layout, toolbar markup, and script/style wiring.
- [css/snow.css](css/snow.css): Vanilla Quill "snow" theme.
- [css/styles.css](css/styles.css): App-specific layout, panels, and responsive tweaks.
- [js/app.js](js/app.js): Quill initialization, HTML→Markdown serializer, preview + copy handlers.
- [js/markdown-it.min.js](js/markdown-it.min.js) & [js/markdown-it-footnote.min.js](js/markdown-it-footnote.min.js): Markdown preview engine + footnote plugin.
- [js/quill.js](js/quill.js): Embedded Quill build (toolbar + clipboard modules).

## Copy Markdown Tips

- Use the primary `Copy Markdown` button beneath the editor for quick copies.
- The icon in the Markdown pane offers an alternative copy affordance when the source is non-empty.
- In insecure contexts (e.g. `file://`), the app automatically falls back to a hidden textarea + `execCommand` copy.

## Development Notes

- Quill is initialized with the `snow` theme and a custom toolbar defined in the DOM.
- Markdown generation walks the DOM to normalize lists, tables, blockquotes, inline code, and Word-style footnotes/endnotes.
- Footnote detection handles Word `_ftn` / `_edn` anchors and strips backreference links before registering definitions.

## Todo

- [ ] Honor normal external links without footnote semantics
- [x] Convert unordered lists to markdown `- ` style
- [ ] Support nested lists

## License

MIT License © 2025 Grandgeorg Websolutions & Contributors
