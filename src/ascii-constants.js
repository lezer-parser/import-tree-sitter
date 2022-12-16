// based on https://gist.github.com/angeloped/eaa4e1d0d5c1f707a7381d23c3cf9c4f
// ["DEC", "OCT", "HEX",	"BIN", "Symbol", "Name"]

// ERR_IMPORT_ASSERTION_TYPE_MISSING
//import ascii_list from "./ascii-constants.json"

import {readFileSync} from "fs"

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const ascii_list = JSON.parse(readFileSync(__dirname + "/ascii-constants.json", "utf8"))

function toPascalCase(s) {
  return s.replace(/(\w)(\w*)(\s*)/g,
    function(_g0, g1, g2) {
      return g1.toUpperCase() + g2.toLowerCase();});
}

function toCamelCase(s) {
  return toPascalCase(s).replace(/^\w/g,
    function(g0) {
      return g0.toLowerCase();});
}

export function getAsciiNames() {
  // TODO port to typescript
  //const lines = []
  const names = []
  for (const [dec, _oct, _hex, _bin, sym, name] of ascii_list) {
    if (48 <= dec && dec < 58) {
      // number
      const n = dec - 48
      //lines.push(`const Number${n} = ${dec} // ${name}`)
      //lines.push(`const number${n} = ${dec} // ${name}`)
      names.push(`number${n}`)
    }
    else if (sym.length > 1) {
      // control char
      const s = JSON.stringify(String.fromCharCode(dec))
      //lines.push(`const ${sym} = ${dec} // ${name}${s.length == 4 ? ` = ${s}` : ""}`)
      names.push(sym)
    }
    else {
      // printable char
      const s = JSON.stringify(String.fromCharCode(dec))
      //lines.push(`const ${toPascalCase(name)} = ${dec} // ${s}`)
      //lines.push(`const ${toCamelCase(name)} = ${dec} // ${s}`)
      names.push(toCamelCase(name))
    }
  }
  return names
}

//console.log(asciiConstants().map(line => `${line}\n`).join(""))
//console.log(asciiConstants().map(line => `  \`${line}\`,\n`).join(""))
