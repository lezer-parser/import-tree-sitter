// scanner.js - generated from scanner.cc

import { ExternalTokenizer } from "@lezer/lr";

// @ts-ignore Cannot find module - file is generated
import * as Tokens from "./parser.terms.js";

// ascii chars
const smallU = 117,
  doubleQuotes = 34,
  parenOpen = 40,
  parenClose = 41,
  number8 = 56,
  bigL = 76,
  bigR = 82,
  bigU = 85,
  backslash = 92;

const spaceCodeSet = new Set([
  9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
  8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288,
]);

/** @param {number} code */
const iswspace = (code) => spaceCodeSet.has(code);

export const RawStringLiteral = new ExternalTokenizer((input) => {
  /// workaround for https://github.com/microsoft/TypeScript/issues/9998
  const inputNext = () => /** @type {number} */ input.next;
  while (iswspace(inputNext())) {
    /// TODO skip whitespace
    /// original call:
    /// lexer->advance(lexer, true)
    input.advance();
  }
  /// TODO defer acceptToken?
  input.acceptToken(Tokens.RawStringLiteral);

  // Raw string literals can start with: R, LR, uR, UR, u8R
  // Consume 'R'
  if (inputNext() == bigL || inputNext() == bigU) {
    input.advance();
    if (inputNext() != bigR) {
      /// TODO return?
      return false;
    }
  } else if (inputNext() == smallU) {
    input.advance();
    if (inputNext() == number8) {
      input.advance();
      if (inputNext() != bigR) {
        /// TODO return?
        return false;
      }
    } else if (inputNext() != bigR) {
      /// TODO return?
      return false;
    }
  } else if (inputNext() != bigR) {
    /// TODO return?
    return false;
  }
  input.advance();
  // Consume '"'
  if (inputNext() != doubleQuotes) {
    /// TODO return?
    return false;
  }
  input.advance();
  // Consume '(', delimiter
  /** @type {number[]} */
  const delimiter = [];
  while (true) {
    if (inputNext() == 0 || inputNext() == backslash || iswspace(inputNext())) {
      /// TODO return?
      return false;
    }
    if (inputNext() == parenOpen) {
      input.advance();
      break;
    } /// converted string to number[]
    delimiter.push(inputNext());
    input.advance();
  }
  // Consume content, delimiter, ')', '"'
  /** @type {number} */
  let delimiter_index = -1;
  while (true) {
    if (inputNext() == 0) {
      /// TODO return?
      return false;
    }
    if (delimiter_index >= 0) {
      if (delimiter_index == delimiter.length) {
        if (inputNext() == doubleQuotes) {
          input.advance();
          /// TODO return?
          return true;
        } else {
          delimiter_index = -1;
        }
      } else {
        if (inputNext() == delimiter[delimiter_index]) {
          delimiter_index++;
        } else {
          delimiter_index = -1;
        }
      }
    }
    if (delimiter_index == -1 && inputNext() == parenClose) {
      delimiter_index = 0;
    }
    input.advance();
  }
});

