// called from nix-eval-js/demo/src/treeview.jsx

/** @param {Tree | TreeNode} tree */

export function stringifyTree(tree, options) {

  if (!options) options = {};
  const pretty = options.pretty || false;
  const human = options.human || false; // human readable, like python or yaml
  const positions = options.positions || false; // add node positions
  const firstLine = options.firstLine || false; // show only first line of node source
  const compact = (!pretty && !human);
  const format = compact ? 'compact' : pretty ? 'pretty' : human ? 'human' : null;
  const source = options.source || options.text || '';
  const indentStep = options.indent || '  ';

  const cursor = tree.cursor();
  if (!cursor) return '';

  let depth = 0;
  let result = '';

  const indent = () => indentStep.repeat(depth);
  const cursorType = () => positions ? `${cursor.name}:${cursor.from}` : cursor.name;
  const cursorText = () => {
    let src = source.slice(cursor.from, cursor.to);
    if (firstLine) {
      return src.split('\n')[0];
    }
    return src;
  };

  const formatNodeByFormat = {
    //human: () => `${indent()}${cursorType()}: ${cursorText()}\n`,
    human: () => `${indent()}${cursorType()}: ${JSON.stringify(cursorText())}\n`,
    pretty: () => `${indent()}${cursorType()}`,
    compact: () => cursorType(),
  };
  const formatNode = formatNodeByFormat[format];

  while (true) {
    // NLR: Node, Left, Right
    // Node
    result += formatNode()
    // Left
    if (cursor.firstChild()) {
      // moved down
      depth++;
      if (compact) result += '('
      if (pretty) result += ' (\n'
      continue;
    }
    // Right
    if (depth > 0 && cursor.nextSibling()) {
      // moved right
      if (compact) result += ','
      if (pretty) result += ',\n'
      continue;
    }
    let continueMainLoop = false;
    let firstUp = true;
    while (cursor.parent()) {
      // moved up
      depth--;
      //console.log(`stringifyTree: moved up to depth=${depth}. result: ${result}`)
      //if (depth < 0) { // wrong?
      if (depth <= 0) {
        // when tree is a node, stop at the end of node
        // == dont visit sibling or parent nodes
        return result;
      }
      if (compact) result += ')'
      if (pretty && firstUp) result += `\n`
      if (pretty) result += `${indent()})`
      if (cursor.nextSibling()) {
        // moved up + right
        continueMainLoop = true;
        if (compact) result += ','
        if (pretty) result += ',\n'
        break;
      }
      if (pretty) result += `\n`
      firstUp = false;
    }
    if (continueMainLoop) continue;

    break;
  }

  //console.log(`stringifyTree: final depth: ${depth}`)

  return result;
}
