import {createRegExpParser} from "regexp-parser-literal"
import {AST as RE} from "regexpp2"

type RepeatExpr = {type: "REPEAT" | "REPEAT1", content: TSExpr}
type SymbolExpr = {type: "SYMBOL", name: string}
type ChoiceExpr = {type: "CHOICE", members: TSExpr[]}
type AliasExpr = {type: "ALIAS", content: TSExpr, named: boolean, value: string}
type SeqExpr = {type: "SEQ", members: TSExpr[]}
type StringExpr = {type: "STRING", value: string}
type PatternExpr = {type: "PATTERN", value: string}
type FieldExpr = {type: "FIELD", name: string, content: TSExpr}
type TokenExpr = {type: "TOKEN" | "IMMEDIATE_TOKEN", content: TSExpr}
type BlankExpr = {type: "BLANK"}
type PrecExpr = {type: "PREC" | "PREC_DYNAMIC" | "PREC_LEFT" | "PREC_RIGHT", value: number, content: TSExpr}

type TSExpr = RepeatExpr | SymbolExpr | ChoiceExpr | AliasExpr | SeqExpr | StringExpr | PatternExpr | FieldExpr |
  TokenExpr | BlankExpr | PrecExpr

type TSDefinition = {
  name: string,
  word?: string,
  rules: {[name: string]: TSExpr},
  extras?: TSExpr[],
  conflicts?: string[][],
  externals?: SymbolExpr[],
  inline?: string[],
  supertypes?: string[]
}

function prec(expr: TSExpr): number {
  switch (expr.type) {
    case "CHOICE": return isOption(expr) ? 10 : 1
    case "SEQ": return 2
    case "REPEAT": case "REPEAT1": return 3
    case "ALIAS": return expr.named ? 10 : prec(expr.content)
    case "FIELD": return prec(expr.content)
    default: return 10
  }
}

function isOption(expr: ChoiceExpr): TSExpr | null {
  if (expr.members.length != 2) return null
  let empty = expr.members.findIndex(e => e.type == "BLANK")
  if (empty < 0) return null
  return expr.members[empty ? 0 : 1]
}

function choices(expr: TSExpr): TSExpr[] {
  if (expr.type != "CHOICE") return [expr]
  return expr.members.reduce((a, b) => a.concat(choices(b)), [] as TSExpr[])
}

class Context {
  rules: {[name: string]: string} = Object.create(null)
  tokens: {[name: string]: string} = Object.create(null)
  precedences: {value: number, type: "PREC" | "PREC_LEFT" | "PREC_RIGHT"}[] = []
  skip: string = ""

  wordRE: RegExp | null = null
  wordRule: string = ""
  wordRuleName: string  = ""

  constructor(readonly def: TSDefinition) {}
  
  translateInner(expr: TSExpr, token: boolean, outerPrec: number): string {
    let inner = this.translateExpr(expr, token)
    return prec(expr) < outerPrec ? "(" + inner + ")" : inner
  }

  translateName(name: string) {
    if (name[0] != "_") return name[0].toUpperCase() + name.slice(1).replace(/_\w/g, m => m.slice(1).toUpperCase())
    if (name[1].toUpperCase() != name[1]) return name[1] + name.slice(2).replace(/_\w/g, m => m.slice(1).toUpperCase())
    return name
  }

  translateSeq(members: TSExpr[], token: boolean, markers: string[] = []) {
    let markerStr = !markers.length ? "" : markers.join(" ") + " "
    return markerStr + members.map(e => this.translateInner(e, token, 2)).join(" " + markerStr)
  }

  translateExpr(expr: TSExpr, token: boolean): string {
    switch (expr.type) {
      case "REPEAT": case "REPEAT1":
        return this.translateInner(expr.content, token, prec(expr)) + (expr.type == "REPEAT" ? "*" : "+")
      case "SYMBOL":
        return this.translateName(expr.name)
      case "CHOICE":
        let opt = isOption(expr)
        return opt ? this.translateInner(opt, token, 10) + "?"
          : expr.members.map(e => this.translateInner(e, token, prec(expr))).join(" | ")
      case "ALIAS": // FIXME this should override/drop the name of the inner expr, somehow
        if (token) throw new RangeError("Alias expression in token")
        if (expr.named && (expr.content.type == "TOKEN" || expr.content.type == "IMMEDIATE_TOKEN"))
          return this.defineToken(expr.value, expr.content.content)
        let inner = this.translateExpr(expr.content, token)
        return expr.named ? `${this.translateName(expr.value)} { ${inner} }` : inner
      case "SEQ":
        return this.translateSeq(expr.members, token)
      case "STRING":
        if (!token && this.wordRE?.test(expr.value)) return `${this.wordRuleName}<${JSON.stringify(expr.value)}>`
        return JSON.stringify(expr.value)
      case "PATTERN":
        if (!token) return this.defineToken(null, expr)
        return this.translateRegExp(expr.value)
      case "FIELD":
        return this.translateExpr(expr.content, token)
      case "TOKEN": case "IMMEDIATE_TOKEN":
        return this.defineToken(null, expr.content)
      case "BLANK":
        return '""'
      case "PREC": case "PREC_LEFT": case "PREC_RIGHT": // FIXME?
        if (token) return this.translateExpr(expr.content, token)
        let marker = this.definePrec(expr.type, expr.value) + " "
        if (expr.content.type == "SEQ")
          return this.translateSeq(expr.content.members, token, [marker])
        return marker + this.translateInner(expr.content, token, 2)
      case "PREC_DYNAMIC":
        return this.translateExpr(expr.content, token)
      default:
        throw new RangeError("Unexpected expression type: " + (expr as any).type)
    }
  }

  isTokenish(expr: TSExpr): boolean {
    return (expr.type == "STRING" && !this.wordRE?.test(expr.value)) ||
      expr.type == "PATTERN" || expr.type == "BLANK" ||
      (expr.type == "SEQ" || expr.type == "CHOICE") && expr.members.every(e => this.isTokenish(e)) ||
      (expr.type == "REPEAT" || expr.type == "REPEAT1") && this.isTokenish(expr.content)
  }

  translateRule(name: string, content: TSExpr, top: boolean) {
    if (!top && content.type == "TOKEN") {
      this.defineToken(name, content.content)
    } else if (!top && this.isTokenish(content)) {
      this.defineToken(name, content)
    } else {
      let conflictMarkers = []
      if (this.def.conflicts) for (let i = 0; i < this.def.conflicts.length; i++)
        if (this.def.conflicts[i].includes(name)) conflictMarkers.push("~c" + i)
      let result = []
      for (let choice of choices(content)) {
        if (choice.type == "SEQ") result.push(this.translateSeq(choice.members, false, conflictMarkers))
        else result.push(this.translateExpr(choice, false))
      }
      this.rules[(top ? "@top " : "") + this.translateName(name)] = `{\n  ${result.join(" |\n  ")}\n}`
    }
  }

  translateRegExp(value: string) {
    let parsed = createRegExpParser().parsePattern(value)
    return this.translateRegExpElements(parsed.elements)
  }

  translateRegExpElements(elts: RE.Element[]): string {
    let result = ""
    for (let i = 0; i < elts.length;) {
      if (result) result += " "
      let next = elts[i++]
      if (next.type == "Character") {
        let chars = next.raw
        while (i < elts.length && elts[i].type == "Character") chars += elts[i++].raw
        result += JSON.stringify(chars)
      } else {
        result += this.translateRegExpElement(next)
      }
    }
    return result
  }

  translateRegExpElement(elt: RE.Element): string {
    switch (elt.type) {
      case "Disjunction":
        return elt.alternatives.map(e => this.translateRegExpElements(e)).join(" | ")
      case "Group": case "CapturingGroup":
        return "(" + this.translateRegExpElements(elt.elements) + ")"
      case "Quantifier":
        let inner = this.translateRegExpElement(elt.element), {min, max} = elt
        if (min == 0 && max == 1) return inner + "?"
        if (min == 0 && max == Infinity) return inner + "*"
        if (min == 1 && max == Infinity) return inner + "+"
        return (inner + " ").repeat(min) + (max == Infinity ? inner + "*" : (inner + "? ").repeat(max - min))
      case "CharacterClass":
        return (elt.negate ? "!" : "$") + "[" + elt.elements.map(r => {
          switch (r.type) {
            case "CharacterSet":
              if ((r as any).negate) throw new Error("No support for negated character set elements")
              if (r.kind == "digit") return "0-9"
              else if (r.kind == "space") return " \\t\\n\\r"
              else if (r.kind == "word") return "a-zA-Z0-9_"
              else new Error("Unhandled range type: EscapeCharacterSet/property")
            case "Character":
              return r.raw
            case "CharacterClassRange":
              return r.min.raw + "-" + r.max.raw
            default:
              throw new Error("Unhandled range type: " + r.type)
          }
        }).join("") + "]"
      case "CharacterSet":
        if (elt.kind == "any") return "![\\n]"
        else if (elt.kind == "digit") return `${elt.negate ? "!" : "$"}[0-9]`
        else if (elt.kind == "space") return `${elt.negate ? "!" : "$"}[ \\t\\r\\n]`
        else if (elt.kind == "word") return `${elt.negate ? "!" : "$"}[a-zA-Z0-9_]`
        else new Error("Unhandled range type: EscapeCharacterSet/property")
      case "Character":
        return JSON.stringify(elt.raw)
      default:
        throw new RangeError("Unhandled regexp element type: " + elt.type)
    }
  }

  definePrec(type: "PREC" | "PREC_LEFT" | "PREC_RIGHT", value: number) {
    if (!this.precedences.some(p => p.value == value && p.type == type)) this.precedences.push({value, type})
    return "!" + this.precName(value, type)
  }

  precName(value: number, type: "PREC" | "PREC_LEFT" | "PREC_RIGHT") {
    return "prec_" + (value < 0 ? "m" + -value : value) + (type == "PREC_LEFT" ? "_l" : type == "PREC_RIGHT" ? "_r" : "")
  }

  defineToken(name: string | null, content: TSExpr) {
    while (/^PREC/.test(content.type)) content = (content as PrecExpr).content
    if (name == null && content.type == "STRING")
      return JSON.stringify(content.value)
    let newName = name ? this.translateName(name) : this.generateName("token")
    this.tokens[newName] = `{\n    ${this.translateExpr(content, true)}\n  }`
    return newName
  }

  generateName(prefix: string) {
    for (let i = 1;; i++) {
      let name = prefix + "_" + i
      if (!(name in this.tokens || name in this.rules)) return name
    }
  }

  build() {
    if (this.def.word) {
      let expr = this.def.rules[this.def.word], pattern = ""
      for (let part of expr.type == "SEQ" ? expr.members : [expr]) {
        if (part.type == "STRING") pattern += part.value.replace(/[^\w\s]/g, "\\$&")
        else if (part.type == "PATTERN") pattern += part.value
        else throw new RangeError("Word token too complex")
      }
      this.wordRuleName = this.def.rules["_kw"] ? this.generateName("kw") : "kw"
      this.wordRule = `${this.wordRuleName}<term> { @specialize[name={term}]<${this.translateName(this.def.word)}, term> }\n\n`
      this.wordRE = new RegExp("^(" + pattern + ")$")
    }

    if (this.def.extras) {
      this.skip = this.def.extras.map(e => this.translateExpr(e, false)).join(" | ")
    } else {
      this.tokens["space_1"] = "{ std.whitespace+ }"
      this.skip = "space_1"
    }

    let first = true
    for (let name in this.def.rules) {
      this.translateRule(name, this.def.rules[name], first)
      first = false
    }
  }

  grammar() {
    let precStr = this.precedences.length ? `@precedence {\n  ${
      this.precedences.sort((a, b) => b.value - a.value).map(({value, type}) => {
        return this.precName(value, type) + (type == "PREC_LEFT" ? " @left" : type == "PREC_RIGHT" ? " @right" : "")
      }).join("\n  ")}\n}\n\n` : ""
    let rules = Object.keys(this.rules)
    let ruleStr = rules.map(r => `${r} ${this.rules[r]}\n\n`).join("")
    let externalStr = this.def.externals && this.def.externals.length
      ? `@external tokens token from "./tokens" { ${this.def.externals.map(s => this.translateName(s.name)).join(", ")} }\n\n`
      : ""
    let tokens = Object.keys(this.tokens)
    let tokenStr = `@tokens {\n${tokens.map(t => `  ${t} ${this.tokens[t]}\n`).join("")}}`
    let skipStr = `@skip { ${this.skip} }\n\n`
    return precStr + ruleStr + this.wordRule + skipStr + externalStr + tokenStr
  }
}

export function build(content: string) {
  let def = JSON.parse(content) as TSDefinition
  let cx = new Context(def)
  cx.build()
  return cx.grammar()
} 
