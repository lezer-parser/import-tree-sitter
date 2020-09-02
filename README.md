# import-tree-sitter

Utility to help convert grammars written for [tree-sitter](https://tree-sitter.github.io/) to Lezer's grammar notation.

This isn't a polished easy-to-use tool, but might help save time when porting a grammar.

If you pass the tree-sitter grammar JSON representation (usually in `src/grammar.json`), as a string, to the `buildGrammar` function defined in `src/import.ts`, it'll spit out an equivalent Lezer grammar file.

Because tree-sitter's concepts don't all map to Lezer concepts, you'll only get a working, finished grammar for very trivial grammars. Specifically:

 - Precedences are specified in a more fine-grained way in Lezer, so the tool only emits a comment indicating that a precedence was specified, and leaves it to you to put the proper conflict markers in.

 - Tree-sitter's alias expressions are a bit like inline rules, but make the inner rule's name disappear. That's not something you can do in Lezer, so you'll get additional noise in your tree in some cases if you don't further clean up the grammar.
