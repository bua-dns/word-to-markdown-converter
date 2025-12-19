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

- [index.html](index.html): Application markup plus converter logic.
- [css/](css/): Quill snow theme and custom layout styles.
- [js/](js/): Quill editor bundle, markdown-it, and markdown-it-footnote plugins.

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
- [ ] Convert unordered lists to markdown `- ` style

## License

MIT License © 2025 Grandgeorg Websolutions & Contributors
