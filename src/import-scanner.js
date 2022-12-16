// TODO split API vs CLI version

/*

FIXME convert number to string
or better: convert string to array

let delimiter = ""; // string
delimiter += inputNext(); // bad: string + number
delimiter += String.fromCharCode(inputNext()); // good: string + string

typescript does not help here
-> eslint rule @typescript-eslint/restrict-plus-operands
https://stackoverflow.com/a/56606330/10440128
-> autofix with custom eslint plugin?
find all variables in scope, fix read + write access

ideally, use an array

let delimiter = []; // Array<number>
delimiter.push(inputNext());

*/

import {readFileSync} from "fs"
//import {parser as lezerCpp} from "@lezer/cpp"
import {parser as lezerCpp} from "./lezer-parser-cpp/dist/index.cjs"
import { firstChild, nextSibling, getParent, nodeText, findNode, filterNodes, reduceNodes } from './lezer-tree-utils.js'
import {stringifyTree} from "./lezer-tree-format.js"
import {getAsciiNames} from "./ascii-constants.js"
import {format as prettierFormat} from "prettier"
import {ESLint} from "eslint"
import MagicString from "magic-string"
import lineColumn from 'line-column'

const tokensObjectName = "Tokens"
const tokenNamePrefix = tokensObjectName + "."

const asciiNames = getAsciiNames()

const eslintConfig = {
  "extends": [
    "eslint:recommended",
  ],
  //"parser": "@typescript-eslint/parser",
  "parserOptions": {
    "sourceType": "module",
    "ecmaVersion": "latest",
    //"project": "./jsconfig.json", // slow
    // 30 seconds vs 6 seconds = 5x slower
  },
  "env": {
    "es2022": true,
  },
  "plugins": [
    //"@typescript-eslint", // slow
    //"eslint-plugin-jsdoc", // TODO remove?
  ],
  "rules": {
    //"no-unused-vars": "off",
    "no-constant-condition": "off", // while (true)
    "curly": ["error", "all"],
    // TODO remove?
    // FIXME not working
    // requires parserOptions.project
    //"@typescript-eslint/restrict-plus-operands": "error", // slow
    // TODO remove?
    //"@eslint-plugin-jsdoc/check-types": "error",
  }
}

// TODO
//const prettierConfig = {}



// global state
const usedAsciiCodes = new Set()
const convertStringToArrayNames = []



main()

async function main() {

// TODO make grammar.json optional

if (
  //process.argv.length != 3 &&
  process.argv.length != 4
) {
  console.error("usage:")
  //console.error("node src/import-scanner.js path/to/scanner.cc")
  console.error("node src/import-scanner.js path/to/scanner.cc path/to/grammar.json")
  process.exit(1)
}

function formatNode(node, state, label = "") {
  const s = stringifyTree(node, {
    source: state.source,
    human: true,
    firstLine: true,
  })
  if (label) {
    return s.split("\n").map(line => label + ": " + line).join("\n")
  }
  else {
    return s
  }
}

function printNode(node, state, label = "") {
  console.log(formatNode(node, state, label))
}

function exitNode(node, state, label = "") {
  printNode(node, state, label)
  process.exit()
}

/** convert tree-sitter to lezer-parser token name */
function getTokenName(name) {
  //console.error(`getTokenName: tokenName ${name} -> externalName ${externalOfTokenType[name]}`)
  // note: usually scanner.cc and grammar.js use the same names for external tokens,
  // but the names *can* be different.
  // but the names *must* have the same order in both files.
  name = externalOfTokenType[name]
  // convert to PascalCase
  return name.split("_").map(part => (
    part[0].toUpperCase() + part.slice(1).toLowerCase()
  )).join("")
}

const parser = lezerCpp.configure({
  strict: true, // throw on parse error
})

function commentLines(s, label = "") {
  if (label) {
    return s.trim().split("\n").map(line => "/// @" + label + " " + line).join("\n") + "\n"
  }
  return s.trim().split("\n").map(line => "/// " + line).join("\n") + "\n"
}

const transpileOfNodeType = {
  PreprocDirective(node) {
    // example: #include <tree_sitter/parser.h>
    const text = nodeText(node, state)
    return commentLines(text, "preproc")
  },
  /*
  DeclarationList(node) {
    node = firstChild(node)
    node = nextSibling(node) // skip first child "{"
    let result = ""
    while (node) {
      result += node.type.transpile(node, state)
      node = nextSibling(node)
    }
    return result
  },
  EnumSpecifier(node) {
    let result = ""
    node = firstChild(node)
    // enum
    //printNode(node, state, "enum")
    node = nextSibling(node)
    // TypeIdentifier
    //printNode(node, state, "TypeIdentifier")
    const name = nodeText(node, state)
    //console.dir({name})
    node = nextSibling(node)
    // EnumeratorList
    //printNode(node, state, "EnumeratorList")
    node = firstChild(node)
    let i = 0
    while (node) {
      if (node.type.name == "Enumerator") {
        // Enumerator
        //printNode(node, state, "Enumerator " + i)
        result += `/// @enum ${name}.${nodeText(node, state)}\n`
        i++
      }
      node = nextSibling(node)
    }
    //exitNode(node, state)
    return result
  },
  StructSpecifier(node) {
    let result = ""
    node = firstChild(node)
    // struct
    //printNode(node, state, "struct")
    node = nextSibling(node)
    // TypeIdentifier
    //printNode(node, state, "TypeIdentifier")
    const name = nodeText(node, state)
    //console.dir({name})
    result += `/// @class ${name} start\n`
    node = nextSibling(node)
    // FieldDeclarationList
    //printNode(node, state, "FieldDeclarationList")
    node = firstChild(node)
    let i = 0
    while (node) {
      /*
      if (node.type.name == "FunctionDefinition") {
        printNode(node, state, "FunctionDefinition " + i)
        result += `/// @fn ${name}.${nodeText(node, state)}\n`
        i++
      }
      else
      *xxxxxxxxx/
      if (node.type.name == "FieldDeclaration") {
        //printNode(node, state, "FunctionDefinition " + i)
        //result += `/// @fn ${name}.${nodeText(node, state)}\n`
        result += formatNode(node, state, `/// @fn ${node.type.name}`)
        i++
      }
      else if (node.type.name == "{" || node.type.name == "}") {
        // ignore
      }
      else {
        result += formatNode(node, state, `/// @todo type ${node.type.name}`)
      }
      node = nextSibling(node)
    }
    //exitNode(node, state)
    result += `/// @class ${name} end\n`
    return result
  },
  */
  ExpressionStatement(node, state) {
    node = firstChild(node)
    return node.type.transpile(node, state) + ";\n"
  },
  UpdateExpression(node, state) {
    // example: i++
    // TODO convertStringToArrayNames
    //return unwrapNode(node, state) + ";\n"
    return (
      //todoNode(node, state) + "\n" +
      unwrapNode(node, state) + ";\n"
    )
  },
  LineComment(node, state) {
    return nodeText(node, state) + "\n"
  },
  FieldExpression(node, state) {
    const fullNode = node
    const text = nodeText(node, state)
    if (text == "lexer->lookahead") {
      //return "input.next"
      /*
      // verbose
      return (
        "// https://github.com/microsoft/TypeScript/issues/9998\n" +
        "// @ts-ignore condition will always return 'true'\n" +
        "input.next"
      )
      */
      // workaround for https://github.com/microsoft/TypeScript/issues/9998
      return "inputNext()"
      
    }
    node = firstChild(node) // object
    const name = nodeText(node, state)
    node = nextSibling(node) // key1
    let keys = [nodeText(node, state)]
    node = nextSibling(node) // key2?
    while (node) {
      keys.push(nodeText(node, state))
      node = nextSibling(node)
    }
    // translate keys
    const keysMap = {
      size: "length",
    }
    keys = keys.map(key => (key in keysMap) ? keysMap[key] : key)
    return (
      //"\n" + formatNode(node, state, "/// @todo(FieldExpression) " + JSON.stringify(text)) +
      "\n" + formatNode(fullNode, state, "/// @todo(FieldExpression) " + JSON.stringify(text)) +
      //"\n" + commentLines("@todo(FieldExpression) " + JSON.stringify(text)) +
      name + "." + keys.join(".")
    )
  },
  CallExpression(node, state) {
    // TODO
    const fullNode = node
    const text = nodeText(node, state)
    const funcNameMap = {
      //"lexer->advance": "todo", // no. we also must transpile the arguments
    }
    node = firstChild(node)
    // function
    const nameNode = node
    let name = nodeText(node, state)
    if (node.type.name == "FieldExpression") {
      // based on FieldExpression(node, state)
      /*
      let node = firstChild(node)
      const object = nodeText(node, state)
      node = nextSibling(node)
      let keys = [nodeText(node, state)]
      */
      let node = firstChild(nameNode) // object
      const name = nodeText(node, state)
      node = nextSibling(node) // key1
      let keys = [nodeText(node, state)]
      node = nextSibling(node) // key2?
      while (node) {
        keys.push(nodeText(node, state))
        node = nextSibling(node)
      }
      /*
      // debug
      if (
        keys[0] != "advance"
      ) {
        throw new Error("TODO CallExpression to FieldExpression: " + text + " " + JSON.stringify(keys) + " " + keys.slice(-1)[0])
      }
      */
      if (keys.slice(-1)[0] == "size") {
        // x.size() -> x.length
        // translate keys
        const keysMap = {
          size: "length",
        }
        keys = keys.map(key => (key in keysMap) ? keysMap[key] : key)
        // debug
        if (
          name != "delimiter" &&
          keys[0] != "advance"
        ) {
          throw new Error("TODO CallExpression to FieldExpression: " + name + "." + keys.join("."))
        }
        return (
          //"\n" + formatNode(fullNode, state, "/// @todo(CallExpression) " + JSON.stringify(text)) +
          //"\n" + commentLines("@todo(FieldExpression) " + JSON.stringify(text)) +
          //"\n" +
          name + "." + keys.join(".")
        )
      }
    }
    /*
    if (name in funcNameMap) {
      name = funcNameMap[name]
    }
    */
    node = nextSibling(node)
    // arguments
    if (name == "lexer->advance") {
      //return `input.advance(${transpileNode(node, state)}) // TODO arguments\n`
      // https://tree-sitter.github.io/tree-sitter/creating-parsers
      // void (*advance)(TSLexer *, bool skip)
      // A function for advancing to the next character.
      // If you pass true for the second argument, the current character will be treated as whitespace.
      // https://lezer.codemirror.net/docs/ref/#lr.InputStream
      // 
      // parse arguments
      const args = []
      node = firstChild(node)
      while (node) {
        if (
          node.type.name != "(" &&
          node.type.name != "," &&
          node.type.name != ")"
        ) {
          args.push(nodeText(node, state))
        }
        node = nextSibling(node)
      }
      return (
        //"\n" +
        //todoNode(fullNode, state) + "\n" +
        //commentLines("TODO arguments?\n" + nodeText(fullNode, state)) +
        //commentLines("TODO arguments? " + JSON.stringify(args)) +
        (args[1] == "true" ? commentLines("TODO skip whitespace\noriginal call:\n" + nodeText(fullNode, state)) : "") +
        //(args[1] == "true" ? ("\n" + commentLines("TODO skip whitespace: lexer->advance(lexer, true)")) : "") +
        //`input.advance();\n`
        `input.advance()`
      )
    }
    return unwrapNode(fullNode, state)
    //return formatNode(fullNode, state, "/// @todo CallExpression")

    /*
    const text = nodeText(node, state)
    if (text == "lexer->advance(lexer, true)") {
      return "TODO"
    }
    */
  },
  TemplateFunction(node, state) {
    const text = nodeText(node, state);
    //if (text == "static_cast<unsigned>") {
    if (text.startsWith("static_cast<")) {
      return ""
      //return unwrapNode(node, state)
    }
    return todoNode(node, state)
    /*
    const fullNode = node
    node = firstChild(node) // Identifier
    const name = nodeText(node, state)
    node = nextSibling(node) // TemplateArgumentList
    const args = nodeText(node, state)
    // TODO ...
    */
  },
  AssignmentExpression(node, state) {
    // TODO
    const fullNode = node
    const funcNameMap = {
      //"lexer->advance": "todo", // no. we also must transpile the arguments
    }
    node = firstChild(node)
    // left node
    let name = nodeText(node, state)
    /*
    if (name in funcNameMap) {
      name = funcNameMap[name]
    }
    */
    // TODO fix lezer-parser-cpp. "=" should be second node
    node = nextSibling(node) // middle or right node
    const middleOrRightNode = node
    node = nextSibling(node) // right node?
    const operatorText = node ? nodeText(middleOrRightNode, state) : "="
    const rightNode = node ? node : middleOrRightNode
    if (name == "lexer->result_symbol") {
      //return `input.advance(${transpileNode(node, state)}) // TODO arguments\n`
      const tokenName = getTokenName(nodeText(rightNode, state))
      return (
        "\n" +
        //commentLines("TODO arguments?\n" + nodeText(fullNode, state)) +
        `/// TODO defer acceptToken?\n` +
        `input.acceptToken(${tokenNamePrefix}${tokenName});\n`
      )
    }
    if (convertStringToArrayNames.includes(name)) {
      // convert string to array
      return (
        `/// converted string to number[]\n` +
        `${name}.push(${transpileNode(rightNode, state)})`
      )
    }
    //return unwrapNode(fullNode, state) // wrong, "=" is missing
    //return formatNode(fullNode, state, "/// @todo CallExpression")
    return (
      //todoNode(fullNode, state) + "\n" +
      name +
      operatorText +
      transpileNode(rightNode, state)
    )

    /*
    const text = nodeText(node, state)
    if (text == "lexer->advance(lexer, true)") {
      return "TODO"
    }
    */
  },
  _CharLiteral(node, state) {
    const text = nodeText(node, state);
    const char = JSON.parse('"' + (
      text
      .slice(1, -1) // unwrap single quotes
      .replace("\\'", "'") // remove escape
      .replace('"', '\\"') // add escape
    ) + '"')
    // eval char to number
    return (
      char.charCodeAt(0) +
      //` // ${text}.charCodeAt(0)\n`
      ` // ${text}\n`
    )
  },
  CharLiteral(node, state) {
    const text = nodeText(node, state);
    const char = JSON.parse('"' + (
      text
      .slice(1, -1) // unwrap single quotes
      .replace("\\'", "'") // remove escape
      .replace('"', '\\"') // add escape
    ) + '"')
    // eval char to number
    const code = char.charCodeAt(0)
    const name = asciiNames[code]
    usedAsciiCodes.add(code)
    return name
  },
  ReturnStatement(node, state) {
    // TODO?
    const fullNode = node
    return (
      //"\n" +
      commentLines("TODO return?") +
      unwrapNode(fullNode, state) +
      //";\n"
      ";"
    )
  },
  Declaration(node, state) {
    // TODO?
    const fullNode = node
    //console.error("fullNode", formatNode(fullNode, state))
    node = firstChild(node)
    let type = nodeText(node, state)
    node = nextSibling(node)
    // TODO refactor branches
    let name = "";
    let value = "";
    if (node.type.name == "InitDeclarator") {
      /*
        // type + name + value
        Declaration: "int delimiter_index = -1;" // fullNode
          PrimitiveType: "int" // name
          InitDeclarator: "delimiter_index = -1"
            Identifier: "delimiter_index"
            UnaryExpression: "-1"
              ArithOp: "-"
              Number: "1"
      */
      node = firstChild(node)
      name = nodeText(node, state)
      node = nextSibling(node)
      value = transpileNode(node, state)
    }
    else {
      /*
        // type + name
        Declaration: "wstring delimiter;"
          TypeIdentifier: "wstring"
          Identifier: "delimiter"
      */
      name = nodeText(node, state)
    }

    let tsType;
    const typesMap = {
      int: "number",
      wstring: "string", // TODO what is wstring
      // TODO more
    }
    if (type in typesMap) {
      type = typesMap[type]
    }
    if (type == "string") {
      // quickfix: lezer-parser returns characters as numbers
      // so instead of strings, we usually want Array<number>
      type = "array"
      tsType = "number[]"
      // TODO find next parent scope
      convertStringToArrayNames.push(name)
    }

    if (!value) {
      // we must set init value, otherwise ...
      // let s; s += 'x'; s == 'undefinedx'
      // let n; n += 1"; n == NaN
      const initValueOfType = {
        string: '""',
        number: '0',
        boolean: 'false',
        array: '[]',
        object: '{}',
      }
      // get init value, or make it explicitly undefined
      value = initValueOfType[type] || "undefined"
    }

    const isConst = ["array", "object"].includes(type)

    return (
      //"\n" +
      `/** @type {${tsType || type}} */\n` +
      `${isConst ? "const" : "let"} ${name}` + " = " + value + ";\n"
    )
  },
  _IfStatement() {},
  ForStatement(node, state) {
    // cannot use unwrapNode because semicolons are missing in the parse tree
    const fullNode = node
    node = firstChild(node) // "for"
    node = nextSibling(node) // "("
    node = nextSibling(node)
    //throw new Error("asdf: " + nodeText(node, state)) // debug
    //throw new Error(node.type.name) // debug
    if (node.type.name == ")") {
      // for (;;) == while (true)
      node = nextSibling(node) // body: { ... }
      return `while (true) ` + transpileNode(node, state) + "\n"
    }
    return todoNode(fullNode, state)
  },
}

function unwrapNode(node, state) {
  node = firstChild(node)
  let result = ""
  while (node) {
    result += node.type.transpile(node, state)
    node = nextSibling(node)
  }
  return result
}

function ignoreNode(_node, _state) {
  return ""
}

function todoNode(node, state) {
  const nodeStr = formatNode(node, state)
  return "\n" + commentLines(nodeStr, `todo(${node.type.name})`)
}

function copyNode(node, state) {
  return nodeText(node, state)
}

/*
function copyNodeLine(node, state) {
  return nodeText(node, state) + "\n"
}
*/

function copyNodeSpace(node, state) {
  return " " + nodeText(node, state) + " "
}



// trivial transpilers

transpileOfNodeType.UsingDeclaration = ignoreNode // example: use std::iswspace;

transpileOfNodeType.Program = unwrapNode
//transpileOfNodeType.PreprocDirective = transpileOfNodeType.Todo
transpileOfNodeType.NamespaceDefinition = unwrapNode
transpileOfNodeType.namespace = unwrapNode
//transpileOfNodeType.DeclarationList = transpileOfNodeType.Program
// code block: { ... }
transpileOfNodeType.CompoundStatement = unwrapNode
//transpileOfNodeType.ReturnStatement = unwrapNode

transpileOfNodeType.WhileStatement = unwrapNode
//transpileOfNodeType.ForStatement = unwrapNode // no. semicolons are missing
transpileOfNodeType.ConditionClause = unwrapNode
transpileOfNodeType.IfStatement = unwrapNode
transpileOfNodeType.BinaryExpression = unwrapNode
transpileOfNodeType.SubscriptExpression = unwrapNode
transpileOfNodeType.UnaryExpression = unwrapNode
transpileOfNodeType.ArgumentList = unwrapNode

transpileOfNodeType[","] = copyNode
transpileOfNodeType["("] = copyNode
transpileOfNodeType[")"] = copyNode
transpileOfNodeType["["] = copyNode
transpileOfNodeType["]"] = copyNode
transpileOfNodeType["{"] = copyNode
transpileOfNodeType["}"] = copyNode

transpileOfNodeType.ArithOp = copyNodeSpace // ex: +
transpileOfNodeType.UpdateOp = copyNodeSpace // ex: +=
transpileOfNodeType.CompareOp = copyNodeSpace // ex: ==
transpileOfNodeType.LogicOp = copyNodeSpace // ex: &&
transpileOfNodeType.True = copyNodeSpace
transpileOfNodeType.False = copyNodeSpace
transpileOfNodeType.Null = copyNodeSpace // TODO verify
transpileOfNodeType.Number = copyNodeSpace
transpileOfNodeType.Identifier = copyNodeSpace
transpileOfNodeType.BreakStatement = copyNodeSpace

transpileOfNodeType.while = copyNodeSpace
transpileOfNodeType.for = copyNodeSpace
transpileOfNodeType.if = copyNodeSpace
transpileOfNodeType.else = copyNodeSpace
transpileOfNodeType.continue = copyNodeSpace
transpileOfNodeType.break = copyNodeSpace
transpileOfNodeType.return = copyNodeSpace

/*
transpileOfNodeType.ForStatement = unwrapNode
transpileOfNodeType["for"] = copyNode
*/

const debug = true


function transpileNode(node, state) {
  const debug = false
  if (!(node.type.name in transpileOfNodeType)) {
    return todoNode(node, state)
    //throw new Error("not implemented: node.type.name = " + node.type.name)
  }
  return (
    (debug ? ("\n" + commentLines(nodeText(node, state).split("\n")[0], `source(${node.type.name})`)) : "") +
    transpileOfNodeType[node.type.name](node, state)
  )
}

/*
function getEval(typeName) {
  if (!(typeName in transpileOfNodeType)) {
    throw new Error("not implemented: node.type.name = " + typeName)
  }
  return transpileOfNodeType[typeName]
}
*/

for (const type of parser.nodeSet.types) {
  //type.transpile = transpileOfNodeType[type.name]
  //type.transpile = (node) => getEval(type.name)(node)
  type.transpile = (node, state) => transpileNode(node, state)
}

const scannerCppSource = readFileSync(process.argv[2], "utf8")
//const scannerCppSource = readFileSync(process.argv[2]) // TypeError: this.input.chunk is not a function

const grammarJsonSource = readFileSync(process.argv[3], "utf8")
const grammar = JSON.parse(grammarJsonSource)
const externalNames = grammar.externals.map(ext => {
  if (ext.type != "SYMBOL") {
    throw new Error("not implemented: external type " + ext.type)
  }
  return ext.name
})

var tree = parser.parse(scannerCppSource)

const state = {
  source: scannerCppSource,
}

/* too generic
let result = tree.topNode.type.transpile(tree.topNode, state)
//const result = transpileNode(tree.topNode)
*/



// find "enum TokenType"
// "enum TokenType" has the same order as the "externals" rule in tree-sitter grammar.js
// these are "entry points" for the scan function
// trivial case: only one value in enum TokenType, example: tree-sitter-cpp

const tokenTypeEnumNode = findNode(tree, (node) => {
  if (node.type.name != "EnumSpecifier") {
    return false
  }
  node = firstChild(node)
  // struct
  //printNode(node, state, "struct")
  node = nextSibling(node)
  // TypeIdentifier
  //printNode(node, state, "TypeIdentifier")
  const name = nodeText(node, state)
  return (name == "TokenType")
})

//printNode(tokenTypeEnumNode, state)

const tokenTypeNames = reduceNodes(tokenTypeEnumNode, (acc, node) => {
  if (node.type.name == "Enumerator") {
    acc.push(nodeText(node, state))
  }
  return acc
}, [])

if (tokenTypeNames.length == 0) {
  throw new Error("not found token type names")
}

//console.dir({tokenTypeNames})



const externalOfTokenType = tokenTypeNames.reduce((acc, name, idx) => {
  acc[name] = externalNames[idx];
  return acc
}, {})

//console.dir({externalOfTokenType})



// find the Scanner struct
const scannerStructNode = findNode(tree, (node) => {
  if (node.type.name != "StructSpecifier") {
    return false
  }
  node = firstChild(node)
  // struct
  //printNode(node, state, "struct")
  node = nextSibling(node)
  // TypeIdentifier
  //printNode(node, state, "TypeIdentifier")
  const name = nodeText(node, state)
  return (name == "Scanner")
})



// find the Scanner.scan function
const scanFuncNode = findNode(scannerStructNode, (node) => {
  if (node.type.name != "FunctionDefinition") {
    return false
  }
  node = firstChild(node)
  // returntype
  //printNode(node, state, "returntype")
  node = nextSibling(node)
  // FunctionDeclarator
  //printNode(node, state, "TypeIdentifier")
  node = firstChild(node)
  // FieldIdentifier
  const name = nodeText(node, state)
  return (name == "scan")
})



// codegen

let result = ""

if (tokenTypeNames.length == 1) {
  // trivial case: only one entry point
  const name = tokenTypeNames[0]
  // jsdoc type. not needed
  //result += `export const ${getTokenName(name)} = new ExternalTokenizer(/** @type {ETF} */ (input) => {\n`
  result += `export const ${getTokenName(name)} = new ExternalTokenizer((input) => {\n`
  result += `/// workaround for https://github.com/microsoft/TypeScript/issues/9998\n`
  result += `const inputNext = () => /** @type {number} */ input.next;\n`
  // TODO transpile the scan function
  //result += formatNode(scanFuncNode, state, "/// @fn scan")

  let node = scanFuncNode
  node = firstChild(node)
  // return type
  node = nextSibling(node)
  // function head
  node = nextSibling(node)
  // function body
  //result += formatNode(node, state, "/// @fn scan body")
  if (node.type.name == "CompoundStatement") {
    // code block -> unwrap
    node = firstChild(node) // "{"
    node = nextSibling(node)
    while (node) {
      if (node.type.name != "}") {
        result += node.type.transpile(node, state)
      }
      node = nextSibling(node)
    }
  }
  else {
    // TODO verify. not reachable?
    result += node.type.transpile(node, state)
  }
  // this causes double curly braces: { { ... } }
  //result += node.type.transpile(node, state)

  result += `})\n`
}

else {
  // multiple entry points
  for (const name of tokenTypeNames) {
    //result += `export const ${getTokenName(name)} = new ExternalTokenizer(/** @type {ETF} */ (input) => {\n`
    result += `export const ${getTokenName(name)} = new ExternalTokenizer((input) => {\n`
    // TODO find conditional block or codepath
    result += `})\n`
  }
}




// TODO get names from grammar -> import.ts
const newNames = ["Todo", "Todo2"]

const fileHeader = [
  //`// tokens.js`,
  `// scanner.js - generated from scanner.cc`,
  //`/// TODO translate functions from scanner.c`,
  ``,
  //`const debug = true`,
  //``,
  /*
  `import {`,
  `  ExternalTokenizer,`,
  `  //ContextTracker,`,
  `} from "@lezer/lr"`,
  */
  `import { ExternalTokenizer } from "@lezer/lr"`,
  ``,

  // jsdoc types: not needed, @lezer/lr has typescript types
  //`/**`,
  // TODO import types?
  // https://lezer.codemirror.net/docs/ref/#lr.InputStream
  // /** @typedef {import("@lezer/lr").SomeType} SomeType */
  /*
  // two types: Input + ETF
  `  @typedef {{`,
  `    next: number;`,
  `    pos: number;`,
  `    peek: (offset: number) => number;`,
  `    advance: (count?: number = 1) => number;`,
  `    acceptToken: (type: number, endOffset?: number = 0) => void;`,
  `  }} Input`,
  ``,
  `  @typedef {(input: Input) => any} ETF`, // TODO return type?
  `  external tokenizer function`,
  */
  // one type: ETF
  /*
  `  @typedef {(input: {`,
  `    next: number;`,
  `    peek: (offset: number) => number;`,
  `    advance: (count?: number = 1) => number;`,
  `    acceptToken: (type: number, endOffset?: number = 0) => void;`,
  `  }) => any} ETF`, // TODO return type?
  `  external tokenizer function`,
  */
  //`*/`,
  //``,

  /*
  ...(
    tokenTypeNames
    ? [
      // no. cannot use same names for import + export
      `import {`,
      ...tokenTypeNames.map(name => `  ${getTokenName(name)},`),
      `} from "./parser.terms.js"`,
    ]
    : [
      `import * as ${tokensObjectName} from "./parser.terms.js"`,
    ]
  ),
  */
  `// @ts-ignore Cannot find module - file is generated`,
  `import * as ${tokensObjectName} from "./parser.terms.js"`,
  ``,
  `// ascii chars`,
  (
    "const " +
    Array.from(usedAsciiCodes.values()).sort().map(code => `${asciiNames[code]} = ${code}`).join(", ") +
    ";"
  ),
  ``,
  /*
  `const spaceCodes = [`,
  `  9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200,`,
  `  8201, 8202, 8232, 8233, 8239, 8287, 12288`,
  `]`,
  ``,
  `const iswspace = (code) => spaceCodes.includes(code);`,
  */
  `const spaceCodeSet = new Set([`,
  `  9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200,`,
  `  8201, 8202, 8232, 8233, 8239, 8287, 12288`,
  `])`,
  ``,
  `/** @param {number} code */`,
  `const iswspace = (code) => spaceCodeSet.has(code);`,
  ``,
  // TODO restore. add only used charsugly
  ``,
].map(line => line + "\n").join("")

// TODO restore
result = fileHeader + result



// lint

const eslint = new ESLint({
  fix: true,
  useEslintrc: false,
  overrideConfig: eslintConfig,
});

const lintResults = await eslint.lintText(result, {filePath: "/output/scanner.js"});
//await ESLint.outputFixes(lintResult);

// print messages from eslint
const formatter = await eslint.loadFormatter("stylish");
const lintMessages = formatter.format(lintResults);
if (lintResults[0].output) {
  result = lintResults[0].output;
}
if (lintMessages) {
  const ms = new MagicString(result)
  const finder = lineColumn(result)
  //console.log(result) // debug: print ugly code
  for (const msg of lintResults[0].messages) {
    const idx = finder.toIndex(msg.line, 1)
    // debug
    /*
    console.dir({
      line: msg.line,
      column: msg.column,
      idx,
    })
    */
    // ${msg.line}:${msg.column} is the location in the ugly code, so its only useful for debugging
    //ms.appendRight(idx, commentLines(`eslint: ${msg.ruleId}: ${msg.message} ${msg.line}:${msg.column}`));
    ms.appendRight(idx, commentLines(`eslint: ${msg.ruleId}: ${msg.message}`));
  }
  result = ms.toString()
}



// format

try {
  result = prettierFormat(result, {filepath: "/output/scanner.js", text: result})
}
catch (error) {
  result += "\n" + commentLines(error.message)
  console.error(error)
}



// output

console.log(result)



process.exit()



// find conditional blocks
/*
if (valid_symbols[CONCAT]) { ... }


*/


if (false) {

  // find result assignments
  // lexer->result_symbol = CONCAT;
  /*
    AssignmentExpression: "lexer->result_symbol = CONCAT"
      FieldExpression: "lexer->result_symbol"
        Identifier: "lexer"
        FieldIdentifier: "result_symbol"
      Identifier: "CONCAT"
  */
  // lexer->result_symbol = EMPTY_VALUE;
  // lexer->result_symbol = HEREDOC_ARROW_DASH;

  const resultAssignmentValues = []

  const resultAssignmentNodes = filterNodes(scannerStructNode, (node) => {
    if (node.type.name != "AssignmentExpression") {
      return false
    }
    node = firstChild(node)
    // FieldExpression
    //printNode(node, state, "FieldExpression")
    if (nodeText(node, state) != "lexer->result_symbol") {
      return false
    }
    node = nextSibling(node)
    resultAssignmentValues.push(nodeText(node, state))
    return true
  })

  /*
  const resultAssignmentValues = reduceNodes(scannerStructNode, (acc, node) => {
    if (node.type.name != "AssignmentExpression") {
      return acc
    }
    node = firstChild(node)
    // FieldExpression
    //printNode(node, state, "FieldExpression")
    if (nodeText(node, state) != "lexer->result_symbol") {
      return acc
    }
    node = nextSibling(node)
    acc.push(nodeText(node, state))
    return acc
  })
  */

  printNode(scanFuncNode, state)

  result = ""

  for (const node of resultAssignmentNodes) {
    printNode(node, state)
    // TODO emit: input.acceptToken(StringContent)
    result += `input.acceptToken(${tokenName})`
  }

  for (const value of resultAssignmentValues) {
    console.log(`value = ${value}`)
  }

  process.exit()
}



console.log(result)

}
