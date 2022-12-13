#! /usr/bin/env node

import { importGrammar } from "./import.js"
import { readFileSync } from "fs"

const binName = "lezer-import-tree-sitter"

function main(args: string[]) {
  if (args.length != 2) {
    console.error(`usage: ${binName} path/to/grammar.json`)
    process.exit(1)
  }
  const inputFile = args[1]
  const content = readFileSync(inputFile, "utf8")
  const grammar = importGrammar(content)
  console.log(grammar)
}

main(process.argv.slice(1))
