export function getSourceProp(node, state) {
  const source = {
    file: '(string)', // TODO nix file path
    from: node.from,
    to: node.to,
  };
  const setLineColumn = (lambdaSource) => {
    const sourceLines = state.source.split('\n');
    //console.log(`setLineColumn lambdaSource`, lambdaSource)
    //console.log(`setLineColumn sourceLines`, sourceLines)
    let lineFrom = 0;
    for (let lineIdx = 0; lineIdx < sourceLines.length; lineIdx++) {
      const line = sourceLines[lineIdx];
      const lineTo = lineFrom + line.length;
      if (lineFrom <= lambdaSource.from && lambdaSource.from <= lineTo) {
        // found line
        lambdaSource._line = lineIdx + 1; // lines are 1 based in Nix
        lambdaSource._column = (lambdaSource.from - lineFrom) + 1; // columns are 1 based in Nix
        return;
      }
      lineFrom += line.length + 1; // +1 for \n
    }
    // error
    lambdaSource._line = 'not';
    lambdaSource._column = 'found';
  }
  Object.defineProperty(source, 'line', {
    enumerable: true,
    get() {
      if (!this._line) setLineColumn(this);
      return this._line;
    },
  });
  Object.defineProperty(source, 'column', {
    enumerable: true,
    get() {
      if (!this._column) setLineColumn(this);
      return this._column;
    },
  });
  return source;
}



/** @type {(node: SyntaxNode, label: string) => void} */
export function printNode(node, state, env, options = {}) {
  if (!options) options = {};
  const label = options.label || '';
  let extraDepth = 0;
  if (label) {
    //console.log(label);
    extraDepth = 1; // indent the node
  }
  // note: this will print a trailing newline
  //console.log(node.toString(0, 5, "  ", extraDepth));
  const nodeSource = state.source.slice(node.from, node.to)
  console.log((label ? (label + ': ') : '') + `${node.type.name}: ${nodeSource}`);
}



/** @type {function(SyntaxNode): SyntaxNode} */
function skipComments(node) {
  //checkInfiniteLoop();
  while (
    node && (
      node.type.name == 'Comment' ||
      node.type.name == 'CommentBlock'
    )
  ) {
    node = node.nextSibling;
  }
  return node;
}



/** @type {function(SyntaxNode): SyntaxNode} */
export function firstChild(node) {
  if (!node) return null;
  if (!(node = node.firstChild)) {
    //console.log(`firstChild: node.firstChild is empty`);
    return null;
  }
  if (!(node = skipComments(node))) {
    //console.log(`firstChild: skipComments failed`);
    return null;
  }
  return node;
}



/** @type {function(SyntaxNode): SyntaxNode} */
export function nextSibling(node) {
  if (!node) return null;
  if (!(node = node.nextSibling)) {
    //console.log(`nextSibling: node.nextSibling is empty`);
    return null;
  }
  if (!(node = skipComments(node))) {
    //console.log(`nextSibling: skipComments failed`);
    return null;
  }
  return node;
}




/** @type {function(SyntaxNode): SyntaxNode} */
export function getParent(node) {
  if (!node) return null;
  return node.parent; // TODO?
}




/** @type {function(SyntaxNode, State): string} */
export function nodeText(node, state) {
  // source = full source code of the Nix file
  // text = source code of this node
  return state.source.slice(node.from, node.to);
}



/** @type {function(SyntaxNode, State, Env): any} */
export function callThunk(node, state, env) {
  if (!node.type.thunk) {
    throw new NixEvalNotImplemented(`thunk is undefined for type ${node.type.name}`);
  }
  return node.type.thunk(node, state, env);
}
// regex to inline callThunk:
// a: callThunk\((.*?), (.*?), (.*?)\)
// b: $1.type.thunk($1, $2, $3)



// alias so we can shadow Set in nix-thunks
export class JavascriptSet extends Set {
}



// different type than string
export class Path {
  constructor(path) {
    this.path = path
  }
  toString() {
    return this.path
  }
}



// nix/src/libexpr/parser-tab.cc
// static Expr * stripIndentation

export function stripIndentation(string) {

  if (string == "") return string

  const lines = string.split("\n")

  // remove first line if empty or spaces
  if (/^ *$/.test(lines[0])) lines.shift()

  // right trim last line
  // note: keep empty last line -> unix line format, newline at end of file
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ +$/, '')

  let minIndent = 1000000
  for (const line in lines) {
    //// ignore whitespace lines
    //if (/^ *$/.test(line)) continue
    const curIndent = line.match(/^ */)[0].length
    // ignore whitespace lines
    if (curIndent == line.length) continue
    if (curIndent < minIndent) minIndent = curIndent
  }

  return lines.map(line => line.slice(minIndent)).join("\n")
}



// based on stringifyTree
/**
  @param {Node|Tree} parentNode
  @param {(node: Node) => boolean} condition
  @return {Node|undefined}
*/
export function findNode(parentNode, condition) {
  if (parentNode.topNode) {
    // parentNode is a Tree
    parentNode = parentNode.topNode
  }
  /*
  const cursor = tree.cursor()
  if (!cursor) {
    throw new Error("no cursor")
  }
  */
  let node = parentNode
  let nextNode
  let depth = 0;

  while (true) {
    // NLR: Node, Left, Right
    // Node
    if (condition(node)) {
      return node
    }
    // Left
    nextNode = firstChild(node)
    if (nextNode) {
      // moved down
      depth++;
      node = nextNode
      continue;
    }
    // Right
    if (depth > 0) {
      nextNode = nextSibling(node)
      if (nextNode) {
        // moved right
        node = nextNode
        continue;
      }
    }
    let continueMainLoop = false;
    nextNode = getParent(node)
    while (nextNode) {
      // moved up
      node = nextNode
      depth--;
      if (depth <= 0) {
        return
      }
      nextNode = nextSibling(node)
      if (nextNode) {
        // moved up + right
        node = nextNode
        continueMainLoop = true;
        break
      }
      nextNode = getParent(node)
    }
    if (continueMainLoop) continue;
    break;
  }
}



// based on findNode
/**
  @param {Node|Tree} parentNode
  @param {(node: Node) => boolean} condition
  @return {Node[]}
*/
export function filterNodes(parentNode, condition) {
  const result = []
  if (parentNode.topNode) {
    // parentNode is a Tree
    parentNode = parentNode.topNode
  }
  /*
  const cursor = tree.cursor()
  if (!cursor) {
    throw new Error("no cursor")
  }
  */
  let node = parentNode
  let nextNode
  let depth = 0;

  while (true) {
    // NLR: Node, Left, Right
    // Node
    if (condition(node)) {
      //return node
      result.push(node)
    }
    // Left
    nextNode = firstChild(node)
    if (nextNode) {
      // moved down
      depth++;
      node = nextNode
      continue;
    }
    // Right
    if (depth > 0) {
      nextNode = nextSibling(node)
      if (nextNode) {
        // moved right
        node = nextNode
        continue;
      }
    }
    let continueMainLoop = false;
    nextNode = getParent(node)
    while (nextNode) {
      // moved up
      node = nextNode
      depth--;
      if (depth <= 0) {
        return result
      }
      nextNode = nextSibling(node)
      if (nextNode) {
        // moved up + right
        node = nextNode
        continueMainLoop = true;
        break
      }
      nextNode = getParent(node)
    }
    if (continueMainLoop) continue;
    break;
  }
  return result
}



// based on filterNodes
/**
  @template T
  @param {Node|Tree} parentNode
  @param {(acc: T, node: Node) => T} reducer
  @param {T} initValue
  @return {T}
*/
export function reduceNodes(parentNode, reducer, initValue) {
  let acc = initValue
  if (parentNode.topNode) {
    // parentNode is a Tree
    parentNode = parentNode.topNode
  }
  /*
  const cursor = tree.cursor()
  if (!cursor) {
    throw new Error("no cursor")
  }
  */
  let node = parentNode
  let nextNode
  let depth = 0;

  while (true) {
    // NLR: Node, Left, Right
    // Node
    acc = reducer(acc, node)
    // Left
    nextNode = firstChild(node)
    if (nextNode) {
      // moved down
      depth++;
      node = nextNode
      continue;
    }
    // Right
    if (depth > 0) {
      nextNode = nextSibling(node)
      if (nextNode) {
        // moved right
        node = nextNode
        continue;
      }
    }
    let continueMainLoop = false;
    nextNode = getParent(node)
    while (nextNode) {
      // moved up
      node = nextNode
      depth--;
      if (depth <= 0) {
        return acc
      }
      nextNode = nextSibling(node)
      if (nextNode) {
        // moved up + right
        node = nextNode
        continueMainLoop = true;
        break
      }
      nextNode = getParent(node)
    }
    if (continueMainLoop) continue;
    break;
  }
  return acc
}

