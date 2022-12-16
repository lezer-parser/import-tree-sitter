#! /usr/bin/env bash

# chdir to project root
cd "$(dirname "$0")"/..

# get absolute paths
import_js="$(readlink -f dist/import-cli.js)"
import_scanner_js="$(readlink -f src/import-scanner.js)"

# loop test cases
for dir in $(find test/cases/ -mindepth 1 -maxdepth 1 -type d)
do

echo
echo "test case: $dir"
[ -d "$dir/out/actual" ] || mkdir -p "$dir/out/actual"

echo "importing $dir/src/grammar.json to $dir/out/actual/grammar.lezer"
node "$import_js" "$dir/src/grammar.json" >"$dir/out/actual/grammar.lezer"

for scanner_src in "$dir"/src/scanner.[cC]*
do
echo "importing $scanner_src to $dir/out/actual/scanner.js"
node "$import_scanner_js" "$scanner_src" "$dir/src/grammar.json" >"$dir/out/actual/scanner.js"
done

done
