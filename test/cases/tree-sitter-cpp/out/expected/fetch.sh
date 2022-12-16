#! /bin/sh

curl -L https://github.com/lezer-parser/cpp/raw/main/src/tokens.js >scanner.js
curl -L https://github.com/lezer-parser/cpp/raw/main/src/cpp.grammar >grammar.lezer
curl -L https://github.com/lezer-parser/cpp/raw/main/src/highlight.js >queries.js
