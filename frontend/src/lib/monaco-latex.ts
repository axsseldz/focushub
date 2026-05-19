/**
 * LaTeX language registration for Monaco Editor.
 *
 * Monaco ships with JS/TS/HTML/CSS etc. out of the box, but no LaTeX
 * grammar. We add a Monarch tokenizer that covers the constructs that
 * actually appear in our Workspace docs — commands, environments,
 * comments, inline / display math, and braced argument groups — so
 * the Peek editor reads like a real IDE instead of plain text.
 *
 * Monarch grammars are a single function over a state machine: each
 * regex action either pushes/pops a state or emits a token whose
 * name maps to a CSS class through the editor theme. The defaults
 * (`keyword`, `comment`, `string`, `number`, `delimiter`, `tag`) hit
 * the same hues Monaco uses for other languages, so we don't need a
 * custom theme to get useful colors.
 */

import type * as MonacoNamespace from "monaco-editor";

let registered = false;

export function registerLatexLanguage(monaco: typeof MonacoNamespace): void {
  if (registered) return;

  if (monaco.languages.getLanguages().some((l) => l.id === "latex")) {
    registered = true;
    return;
  }

  monaco.languages.register({
    id: "latex",
    extensions: [".tex", ".sty", ".cls"],
    aliases: ["LaTeX", "latex", "TeX"],
  });

  monaco.languages.setLanguageConfiguration("latex", {
    comments: { lineComment: "%" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "$", close: "$" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "$", close: "$" },
    ],
  });

  monaco.languages.setMonarchTokensProvider("latex", {
    defaultToken: "",
    tokenPostfix: ".tex",

    // Common commands worth a stronger highlight (they steer document
    // structure or pull in packages).
    structureCommands: [
      "documentclass",
      "usepackage",
      "begin",
      "end",
      "section",
      "subsection",
      "subsubsection",
      "paragraph",
      "subparagraph",
      "chapter",
      "part",
      "title",
      "author",
      "date",
      "maketitle",
      "newpage",
      "clearpage",
      "pagebreak",
      "newcommand",
      "renewcommand",
      "input",
      "include",
      "bibliographystyle",
      "bibliography",
    ],

    tokenizer: {
      root: [
        // Comments — to end of line.
        [/%.*$/, "comment"],

        // Display math: \[ ... \]
        [/\\\[/, { token: "delimiter.math", next: "@displayMath" }],

        // Inline math: $ ... $
        [/\$/, { token: "delimiter.math", next: "@inlineMath" }],

        // \begin{env} / \end{env}
        [
          /(\\(?:begin|end))(\{)(\w[\w*]*)(\})/,
          ["keyword.flow", "delimiter.curly", "type", "delimiter.curly"],
        ],

        // Structural commands — highlighted as keywords (and pulling
        // the following braced argument as the document name/title).
        [
          /\\([a-zA-Z@]+)\*?/,
          {
            cases: {
              "@structureCommands": "keyword",
              "@default": "tag",
            },
          },
        ],

        // Numbers (lengths, counters).
        [/\d+(\.\d+)?(pt|pc|in|bp|cm|mm|dd|cc|sp|ex|em)?/, "number"],

        // Braced argument groups.
        [/\{/, { token: "delimiter.curly", next: "@bracedGroup" }],
        [/\[/, { token: "delimiter.square", next: "@optionalGroup" }],

        // Stray punctuation / fallthrough.
        [/[&~^_]/, "delimiter"],
      ],

      bracedGroup: [
        [/[^{}%$\\]+/, ""],
        [/%.*$/, "comment"],
        [/\\([a-zA-Z@]+)\*?/, "tag"],
        [/\{/, { token: "delimiter.curly", next: "@push" }],
        [/\}/, { token: "delimiter.curly", next: "@pop" }],
        [/\$/, { token: "delimiter.math", next: "@inlineMath" }],
      ],

      optionalGroup: [
        [/[^[\]%$\\]+/, "string"],
        [/%.*$/, "comment"],
        [/\\([a-zA-Z@]+)\*?/, "tag"],
        [/\[/, { token: "delimiter.square", next: "@push" }],
        [/\]/, { token: "delimiter.square", next: "@pop" }],
      ],

      inlineMath: [
        [/[^$\\]+/, "string"],
        [/\\([a-zA-Z@]+)\*?/, "keyword.math"],
        [/\$/, { token: "delimiter.math", next: "@pop" }],
      ],

      displayMath: [
        [/[^\\]+/, "string"],
        [/\\\]/, { token: "delimiter.math", next: "@pop" }],
        [/\\([a-zA-Z@]+)\*?/, "keyword.math"],
      ],
    },
  });

  registered = true;
}
