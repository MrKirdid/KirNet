"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@iarna/toml/lib/parser.js
var require_parser = __commonJS({
  "node_modules/@iarna/toml/lib/parser.js"(exports2, module2) {
    "use strict";
    var ParserEND = 1114112;
    var ParserError = class _ParserError extends Error {
      /* istanbul ignore next */
      constructor(msg, filename, linenumber) {
        super("[ParserError] " + msg, filename, linenumber);
        this.name = "ParserError";
        this.code = "ParserError";
        if (Error.captureStackTrace) Error.captureStackTrace(this, _ParserError);
      }
    };
    var State = class {
      constructor(parser) {
        this.parser = parser;
        this.buf = "";
        this.returned = null;
        this.result = null;
        this.resultTable = null;
        this.resultArr = null;
      }
    };
    var Parser = class {
      constructor() {
        this.pos = 0;
        this.col = 0;
        this.line = 0;
        this.obj = {};
        this.ctx = this.obj;
        this.stack = [];
        this._buf = "";
        this.char = null;
        this.ii = 0;
        this.state = new State(this.parseStart);
      }
      parse(str) {
        if (str.length === 0 || str.length == null) return;
        this._buf = String(str);
        this.ii = -1;
        this.char = -1;
        let getNext;
        while (getNext === false || this.nextChar()) {
          getNext = this.runOne();
        }
        this._buf = null;
      }
      nextChar() {
        if (this.char === 10) {
          ++this.line;
          this.col = -1;
        }
        ++this.ii;
        this.char = this._buf.codePointAt(this.ii);
        ++this.pos;
        ++this.col;
        return this.haveBuffer();
      }
      haveBuffer() {
        return this.ii < this._buf.length;
      }
      runOne() {
        return this.state.parser.call(this, this.state.returned);
      }
      finish() {
        this.char = ParserEND;
        let last;
        do {
          last = this.state.parser;
          this.runOne();
        } while (this.state.parser !== last);
        this.ctx = null;
        this.state = null;
        this._buf = null;
        return this.obj;
      }
      next(fn) {
        if (typeof fn !== "function") throw new ParserError("Tried to set state to non-existent state: " + JSON.stringify(fn));
        this.state.parser = fn;
      }
      goto(fn) {
        this.next(fn);
        return this.runOne();
      }
      call(fn, returnWith) {
        if (returnWith) this.next(returnWith);
        this.stack.push(this.state);
        this.state = new State(fn);
      }
      callNow(fn, returnWith) {
        this.call(fn, returnWith);
        return this.runOne();
      }
      return(value) {
        if (this.stack.length === 0) throw this.error(new ParserError("Stack underflow"));
        if (value === void 0) value = this.state.buf;
        this.state = this.stack.pop();
        this.state.returned = value;
      }
      returnNow(value) {
        this.return(value);
        return this.runOne();
      }
      consume() {
        if (this.char === ParserEND) throw this.error(new ParserError("Unexpected end-of-buffer"));
        this.state.buf += this._buf[this.ii];
      }
      error(err) {
        err.line = this.line;
        err.col = this.col;
        err.pos = this.pos;
        return err;
      }
      /* istanbul ignore next */
      parseStart() {
        throw new ParserError("Must declare a parseStart method");
      }
    };
    Parser.END = ParserEND;
    Parser.Error = ParserError;
    module2.exports = Parser;
  }
});

// node_modules/@iarna/toml/lib/create-datetime.js
var require_create_datetime = __commonJS({
  "node_modules/@iarna/toml/lib/create-datetime.js"(exports2, module2) {
    "use strict";
    module2.exports = (value) => {
      const date = new Date(value);
      if (isNaN(date)) {
        throw new TypeError("Invalid Datetime");
      } else {
        return date;
      }
    };
  }
});

// node_modules/@iarna/toml/lib/format-num.js
var require_format_num = __commonJS({
  "node_modules/@iarna/toml/lib/format-num.js"(exports2, module2) {
    "use strict";
    module2.exports = (d, num) => {
      num = String(num);
      while (num.length < d) num = "0" + num;
      return num;
    };
  }
});

// node_modules/@iarna/toml/lib/create-datetime-float.js
var require_create_datetime_float = __commonJS({
  "node_modules/@iarna/toml/lib/create-datetime-float.js"(exports2, module2) {
    "use strict";
    var f = require_format_num();
    var FloatingDateTime = class extends Date {
      constructor(value) {
        super(value + "Z");
        this.isFloating = true;
      }
      toISOString() {
        const date = `${this.getUTCFullYear()}-${f(2, this.getUTCMonth() + 1)}-${f(2, this.getUTCDate())}`;
        const time = `${f(2, this.getUTCHours())}:${f(2, this.getUTCMinutes())}:${f(2, this.getUTCSeconds())}.${f(3, this.getUTCMilliseconds())}`;
        return `${date}T${time}`;
      }
    };
    module2.exports = (value) => {
      const date = new FloatingDateTime(value);
      if (isNaN(date)) {
        throw new TypeError("Invalid Datetime");
      } else {
        return date;
      }
    };
  }
});

// node_modules/@iarna/toml/lib/create-date.js
var require_create_date = __commonJS({
  "node_modules/@iarna/toml/lib/create-date.js"(exports2, module2) {
    "use strict";
    var f = require_format_num();
    var DateTime = global.Date;
    var Date2 = class extends DateTime {
      constructor(value) {
        super(value);
        this.isDate = true;
      }
      toISOString() {
        return `${this.getUTCFullYear()}-${f(2, this.getUTCMonth() + 1)}-${f(2, this.getUTCDate())}`;
      }
    };
    module2.exports = (value) => {
      const date = new Date2(value);
      if (isNaN(date)) {
        throw new TypeError("Invalid Datetime");
      } else {
        return date;
      }
    };
  }
});

// node_modules/@iarna/toml/lib/create-time.js
var require_create_time = __commonJS({
  "node_modules/@iarna/toml/lib/create-time.js"(exports2, module2) {
    "use strict";
    var f = require_format_num();
    var Time = class extends Date {
      constructor(value) {
        super(`0000-01-01T${value}Z`);
        this.isTime = true;
      }
      toISOString() {
        return `${f(2, this.getUTCHours())}:${f(2, this.getUTCMinutes())}:${f(2, this.getUTCSeconds())}.${f(3, this.getUTCMilliseconds())}`;
      }
    };
    module2.exports = (value) => {
      const date = new Time(value);
      if (isNaN(date)) {
        throw new TypeError("Invalid Datetime");
      } else {
        return date;
      }
    };
  }
});

// node_modules/@iarna/toml/lib/toml-parser.js
var require_toml_parser = __commonJS({
  "node_modules/@iarna/toml/lib/toml-parser.js"(exports, module) {
    "use strict";
    module.exports = makeParserClass(require_parser());
    module.exports.makeParserClass = makeParserClass;
    var TomlError = class _TomlError extends Error {
      constructor(msg) {
        super(msg);
        this.name = "TomlError";
        if (Error.captureStackTrace) Error.captureStackTrace(this, _TomlError);
        this.fromTOML = true;
        this.wrapped = null;
      }
    };
    TomlError.wrap = (err) => {
      const terr = new TomlError(err.message);
      terr.code = err.code;
      terr.wrapped = err;
      return terr;
    };
    module.exports.TomlError = TomlError;
    var createDateTime = require_create_datetime();
    var createDateTimeFloat = require_create_datetime_float();
    var createDate = require_create_date();
    var createTime = require_create_time();
    var CTRL_I = 9;
    var CTRL_J = 10;
    var CTRL_M = 13;
    var CTRL_CHAR_BOUNDARY = 31;
    var CHAR_SP = 32;
    var CHAR_QUOT = 34;
    var CHAR_NUM = 35;
    var CHAR_APOS = 39;
    var CHAR_PLUS = 43;
    var CHAR_COMMA = 44;
    var CHAR_HYPHEN = 45;
    var CHAR_PERIOD = 46;
    var CHAR_0 = 48;
    var CHAR_1 = 49;
    var CHAR_7 = 55;
    var CHAR_9 = 57;
    var CHAR_COLON = 58;
    var CHAR_EQUALS = 61;
    var CHAR_A = 65;
    var CHAR_E = 69;
    var CHAR_F = 70;
    var CHAR_T = 84;
    var CHAR_U = 85;
    var CHAR_Z = 90;
    var CHAR_LOWBAR = 95;
    var CHAR_a = 97;
    var CHAR_b = 98;
    var CHAR_e = 101;
    var CHAR_f = 102;
    var CHAR_i = 105;
    var CHAR_l = 108;
    var CHAR_n = 110;
    var CHAR_o = 111;
    var CHAR_r = 114;
    var CHAR_s = 115;
    var CHAR_t = 116;
    var CHAR_u = 117;
    var CHAR_x = 120;
    var CHAR_z = 122;
    var CHAR_LCUB = 123;
    var CHAR_RCUB = 125;
    var CHAR_LSQB = 91;
    var CHAR_BSOL = 92;
    var CHAR_RSQB = 93;
    var CHAR_DEL = 127;
    var SURROGATE_FIRST = 55296;
    var SURROGATE_LAST = 57343;
    var escapes = {
      [CHAR_b]: "\b",
      [CHAR_t]: "	",
      [CHAR_n]: "\n",
      [CHAR_f]: "\f",
      [CHAR_r]: "\r",
      [CHAR_QUOT]: '"',
      [CHAR_BSOL]: "\\"
    };
    function isDigit(cp) {
      return cp >= CHAR_0 && cp <= CHAR_9;
    }
    function isHexit(cp) {
      return cp >= CHAR_A && cp <= CHAR_F || cp >= CHAR_a && cp <= CHAR_f || cp >= CHAR_0 && cp <= CHAR_9;
    }
    function isBit(cp) {
      return cp === CHAR_1 || cp === CHAR_0;
    }
    function isOctit(cp) {
      return cp >= CHAR_0 && cp <= CHAR_7;
    }
    function isAlphaNumQuoteHyphen(cp) {
      return cp >= CHAR_A && cp <= CHAR_Z || cp >= CHAR_a && cp <= CHAR_z || cp >= CHAR_0 && cp <= CHAR_9 || cp === CHAR_APOS || cp === CHAR_QUOT || cp === CHAR_LOWBAR || cp === CHAR_HYPHEN;
    }
    function isAlphaNumHyphen(cp) {
      return cp >= CHAR_A && cp <= CHAR_Z || cp >= CHAR_a && cp <= CHAR_z || cp >= CHAR_0 && cp <= CHAR_9 || cp === CHAR_LOWBAR || cp === CHAR_HYPHEN;
    }
    var _type = /* @__PURE__ */ Symbol("type");
    var _declared = /* @__PURE__ */ Symbol("declared");
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var defineProperty = Object.defineProperty;
    var descriptor = { configurable: true, enumerable: true, writable: true, value: void 0 };
    function hasKey(obj, key) {
      if (hasOwnProperty.call(obj, key)) return true;
      if (key === "__proto__") defineProperty(obj, "__proto__", descriptor);
      return false;
    }
    var INLINE_TABLE = /* @__PURE__ */ Symbol("inline-table");
    function InlineTable() {
      return Object.defineProperties({}, {
        [_type]: { value: INLINE_TABLE }
      });
    }
    function isInlineTable(obj) {
      if (obj === null || typeof obj !== "object") return false;
      return obj[_type] === INLINE_TABLE;
    }
    var TABLE = /* @__PURE__ */ Symbol("table");
    function Table() {
      return Object.defineProperties({}, {
        [_type]: { value: TABLE },
        [_declared]: { value: false, writable: true }
      });
    }
    function isTable(obj) {
      if (obj === null || typeof obj !== "object") return false;
      return obj[_type] === TABLE;
    }
    var _contentType = /* @__PURE__ */ Symbol("content-type");
    var INLINE_LIST = /* @__PURE__ */ Symbol("inline-list");
    function InlineList(type) {
      return Object.defineProperties([], {
        [_type]: { value: INLINE_LIST },
        [_contentType]: { value: type }
      });
    }
    function isInlineList(obj) {
      if (obj === null || typeof obj !== "object") return false;
      return obj[_type] === INLINE_LIST;
    }
    var LIST = /* @__PURE__ */ Symbol("list");
    function List() {
      return Object.defineProperties([], {
        [_type]: { value: LIST }
      });
    }
    function isList(obj) {
      if (obj === null || typeof obj !== "object") return false;
      return obj[_type] === LIST;
    }
    var _custom;
    try {
      const utilInspect = eval("require('util').inspect");
      _custom = utilInspect.custom;
    } catch (_) {
    }
    var _inspect = _custom || "inspect";
    var BoxedBigInt = class {
      constructor(value) {
        try {
          this.value = global.BigInt.asIntN(64, value);
        } catch (_) {
          this.value = null;
        }
        Object.defineProperty(this, _type, { value: INTEGER });
      }
      isNaN() {
        return this.value === null;
      }
      /* istanbul ignore next */
      toString() {
        return String(this.value);
      }
      /* istanbul ignore next */
      [_inspect]() {
        return `[BigInt: ${this.toString()}]}`;
      }
      valueOf() {
        return this.value;
      }
    };
    var INTEGER = /* @__PURE__ */ Symbol("integer");
    function Integer(value) {
      let num = Number(value);
      if (Object.is(num, -0)) num = 0;
      if (global.BigInt && !Number.isSafeInteger(num)) {
        return new BoxedBigInt(value);
      } else {
        return Object.defineProperties(new Number(num), {
          isNaN: { value: function() {
            return isNaN(this);
          } },
          [_type]: { value: INTEGER },
          [_inspect]: { value: () => `[Integer: ${value}]` }
        });
      }
    }
    function isInteger(obj) {
      if (obj === null || typeof obj !== "object") return false;
      return obj[_type] === INTEGER;
    }
    var FLOAT = /* @__PURE__ */ Symbol("float");
    function Float(value) {
      return Object.defineProperties(new Number(value), {
        [_type]: { value: FLOAT },
        [_inspect]: { value: () => `[Float: ${value}]` }
      });
    }
    function isFloat(obj) {
      if (obj === null || typeof obj !== "object") return false;
      return obj[_type] === FLOAT;
    }
    function tomlType(value) {
      const type = typeof value;
      if (type === "object") {
        if (value === null) return "null";
        if (value instanceof Date) return "datetime";
        if (_type in value) {
          switch (value[_type]) {
            case INLINE_TABLE:
              return "inline-table";
            case INLINE_LIST:
              return "inline-list";
            /* istanbul ignore next */
            case TABLE:
              return "table";
            /* istanbul ignore next */
            case LIST:
              return "list";
            case FLOAT:
              return "float";
            case INTEGER:
              return "integer";
          }
        }
      }
      return type;
    }
    function makeParserClass(Parser) {
      class TOMLParser extends Parser {
        constructor() {
          super();
          this.ctx = this.obj = Table();
        }
        /* MATCH HELPER */
        atEndOfWord() {
          return this.char === CHAR_NUM || this.char === CTRL_I || this.char === CHAR_SP || this.atEndOfLine();
        }
        atEndOfLine() {
          return this.char === Parser.END || this.char === CTRL_J || this.char === CTRL_M;
        }
        parseStart() {
          if (this.char === Parser.END) {
            return null;
          } else if (this.char === CHAR_LSQB) {
            return this.call(this.parseTableOrList);
          } else if (this.char === CHAR_NUM) {
            return this.call(this.parseComment);
          } else if (this.char === CTRL_J || this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M) {
            return null;
          } else if (isAlphaNumQuoteHyphen(this.char)) {
            return this.callNow(this.parseAssignStatement);
          } else {
            throw this.error(new TomlError(`Unknown character "${this.char}"`));
          }
        }
        // HELPER, this strips any whitespace and comments to the end of the line
        // then RETURNS. Last state in a production.
        parseWhitespaceToEOL() {
          if (this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M) {
            return null;
          } else if (this.char === CHAR_NUM) {
            return this.goto(this.parseComment);
          } else if (this.char === Parser.END || this.char === CTRL_J) {
            return this.return();
          } else {
            throw this.error(new TomlError("Unexpected character, expected only whitespace or comments till end of line"));
          }
        }
        /* ASSIGNMENT: key = value */
        parseAssignStatement() {
          return this.callNow(this.parseAssign, this.recordAssignStatement);
        }
        recordAssignStatement(kv) {
          let target = this.ctx;
          let finalKey = kv.key.pop();
          for (let kw of kv.key) {
            if (hasKey(target, kw) && (!isTable(target[kw]) || target[kw][_declared])) {
              throw this.error(new TomlError("Can't redefine existing key"));
            }
            target = target[kw] = target[kw] || Table();
          }
          if (hasKey(target, finalKey)) {
            throw this.error(new TomlError("Can't redefine existing key"));
          }
          if (isInteger(kv.value) || isFloat(kv.value)) {
            target[finalKey] = kv.value.valueOf();
          } else {
            target[finalKey] = kv.value;
          }
          return this.goto(this.parseWhitespaceToEOL);
        }
        /* ASSSIGNMENT expression, key = value possibly inside an inline table */
        parseAssign() {
          return this.callNow(this.parseKeyword, this.recordAssignKeyword);
        }
        recordAssignKeyword(key) {
          if (this.state.resultTable) {
            this.state.resultTable.push(key);
          } else {
            this.state.resultTable = [key];
          }
          return this.goto(this.parseAssignKeywordPreDot);
        }
        parseAssignKeywordPreDot() {
          if (this.char === CHAR_PERIOD) {
            return this.next(this.parseAssignKeywordPostDot);
          } else if (this.char !== CHAR_SP && this.char !== CTRL_I) {
            return this.goto(this.parseAssignEqual);
          }
        }
        parseAssignKeywordPostDot() {
          if (this.char !== CHAR_SP && this.char !== CTRL_I) {
            return this.callNow(this.parseKeyword, this.recordAssignKeyword);
          }
        }
        parseAssignEqual() {
          if (this.char === CHAR_EQUALS) {
            return this.next(this.parseAssignPreValue);
          } else {
            throw this.error(new TomlError('Invalid character, expected "="'));
          }
        }
        parseAssignPreValue() {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else {
            return this.callNow(this.parseValue, this.recordAssignValue);
          }
        }
        recordAssignValue(value) {
          return this.returnNow({ key: this.state.resultTable, value });
        }
        /* COMMENTS: #...eol */
        parseComment() {
          do {
            if (this.char === Parser.END || this.char === CTRL_J) {
              return this.return();
            }
          } while (this.nextChar());
        }
        /* TABLES AND LISTS, [foo] and [[foo]] */
        parseTableOrList() {
          if (this.char === CHAR_LSQB) {
            this.next(this.parseList);
          } else {
            return this.goto(this.parseTable);
          }
        }
        /* TABLE [foo.bar.baz] */
        parseTable() {
          this.ctx = this.obj;
          return this.goto(this.parseTableNext);
        }
        parseTableNext() {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else {
            return this.callNow(this.parseKeyword, this.parseTableMore);
          }
        }
        parseTableMore(keyword) {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else if (this.char === CHAR_RSQB) {
            if (hasKey(this.ctx, keyword) && (!isTable(this.ctx[keyword]) || this.ctx[keyword][_declared])) {
              throw this.error(new TomlError("Can't redefine existing key"));
            } else {
              this.ctx = this.ctx[keyword] = this.ctx[keyword] || Table();
              this.ctx[_declared] = true;
            }
            return this.next(this.parseWhitespaceToEOL);
          } else if (this.char === CHAR_PERIOD) {
            if (!hasKey(this.ctx, keyword)) {
              this.ctx = this.ctx[keyword] = Table();
            } else if (isTable(this.ctx[keyword])) {
              this.ctx = this.ctx[keyword];
            } else if (isList(this.ctx[keyword])) {
              this.ctx = this.ctx[keyword][this.ctx[keyword].length - 1];
            } else {
              throw this.error(new TomlError("Can't redefine existing key"));
            }
            return this.next(this.parseTableNext);
          } else {
            throw this.error(new TomlError("Unexpected character, expected whitespace, . or ]"));
          }
        }
        /* LIST [[a.b.c]] */
        parseList() {
          this.ctx = this.obj;
          return this.goto(this.parseListNext);
        }
        parseListNext() {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else {
            return this.callNow(this.parseKeyword, this.parseListMore);
          }
        }
        parseListMore(keyword) {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else if (this.char === CHAR_RSQB) {
            if (!hasKey(this.ctx, keyword)) {
              this.ctx[keyword] = List();
            }
            if (isInlineList(this.ctx[keyword])) {
              throw this.error(new TomlError("Can't extend an inline array"));
            } else if (isList(this.ctx[keyword])) {
              const next = Table();
              this.ctx[keyword].push(next);
              this.ctx = next;
            } else {
              throw this.error(new TomlError("Can't redefine an existing key"));
            }
            return this.next(this.parseListEnd);
          } else if (this.char === CHAR_PERIOD) {
            if (!hasKey(this.ctx, keyword)) {
              this.ctx = this.ctx[keyword] = Table();
            } else if (isInlineList(this.ctx[keyword])) {
              throw this.error(new TomlError("Can't extend an inline array"));
            } else if (isInlineTable(this.ctx[keyword])) {
              throw this.error(new TomlError("Can't extend an inline table"));
            } else if (isList(this.ctx[keyword])) {
              this.ctx = this.ctx[keyword][this.ctx[keyword].length - 1];
            } else if (isTable(this.ctx[keyword])) {
              this.ctx = this.ctx[keyword];
            } else {
              throw this.error(new TomlError("Can't redefine an existing key"));
            }
            return this.next(this.parseListNext);
          } else {
            throw this.error(new TomlError("Unexpected character, expected whitespace, . or ]"));
          }
        }
        parseListEnd(keyword) {
          if (this.char === CHAR_RSQB) {
            return this.next(this.parseWhitespaceToEOL);
          } else {
            throw this.error(new TomlError("Unexpected character, expected whitespace, . or ]"));
          }
        }
        /* VALUE string, number, boolean, inline list, inline object */
        parseValue() {
          if (this.char === Parser.END) {
            throw this.error(new TomlError("Key without value"));
          } else if (this.char === CHAR_QUOT) {
            return this.next(this.parseDoubleString);
          }
          if (this.char === CHAR_APOS) {
            return this.next(this.parseSingleString);
          } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
            return this.goto(this.parseNumberSign);
          } else if (this.char === CHAR_i) {
            return this.next(this.parseInf);
          } else if (this.char === CHAR_n) {
            return this.next(this.parseNan);
          } else if (isDigit(this.char)) {
            return this.goto(this.parseNumberOrDateTime);
          } else if (this.char === CHAR_t || this.char === CHAR_f) {
            return this.goto(this.parseBoolean);
          } else if (this.char === CHAR_LSQB) {
            return this.call(this.parseInlineList, this.recordValue);
          } else if (this.char === CHAR_LCUB) {
            return this.call(this.parseInlineTable, this.recordValue);
          } else {
            throw this.error(new TomlError("Unexpected character, expecting string, number, datetime, boolean, inline array or inline table"));
          }
        }
        recordValue(value) {
          return this.returnNow(value);
        }
        parseInf() {
          if (this.char === CHAR_n) {
            return this.next(this.parseInf2);
          } else {
            throw this.error(new TomlError('Unexpected character, expected "inf", "+inf" or "-inf"'));
          }
        }
        parseInf2() {
          if (this.char === CHAR_f) {
            if (this.state.buf === "-") {
              return this.return(-Infinity);
            } else {
              return this.return(Infinity);
            }
          } else {
            throw this.error(new TomlError('Unexpected character, expected "inf", "+inf" or "-inf"'));
          }
        }
        parseNan() {
          if (this.char === CHAR_a) {
            return this.next(this.parseNan2);
          } else {
            throw this.error(new TomlError('Unexpected character, expected "nan"'));
          }
        }
        parseNan2() {
          if (this.char === CHAR_n) {
            return this.return(NaN);
          } else {
            throw this.error(new TomlError('Unexpected character, expected "nan"'));
          }
        }
        /* KEYS, barewords or basic, literal, or dotted */
        parseKeyword() {
          if (this.char === CHAR_QUOT) {
            return this.next(this.parseBasicString);
          } else if (this.char === CHAR_APOS) {
            return this.next(this.parseLiteralString);
          } else {
            return this.goto(this.parseBareKey);
          }
        }
        /* KEYS: barewords */
        parseBareKey() {
          do {
            if (this.char === Parser.END) {
              throw this.error(new TomlError("Key ended without value"));
            } else if (isAlphaNumHyphen(this.char)) {
              this.consume();
            } else if (this.state.buf.length === 0) {
              throw this.error(new TomlError("Empty bare keys are not allowed"));
            } else {
              return this.returnNow();
            }
          } while (this.nextChar());
        }
        /* STRINGS, single quoted (literal) */
        parseSingleString() {
          if (this.char === CHAR_APOS) {
            return this.next(this.parseLiteralMultiStringMaybe);
          } else {
            return this.goto(this.parseLiteralString);
          }
        }
        parseLiteralString() {
          do {
            if (this.char === CHAR_APOS) {
              return this.return();
            } else if (this.atEndOfLine()) {
              throw this.error(new TomlError("Unterminated string"));
            } else if (this.char === CHAR_DEL || this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I) {
              throw this.errorControlCharInString();
            } else {
              this.consume();
            }
          } while (this.nextChar());
        }
        parseLiteralMultiStringMaybe() {
          if (this.char === CHAR_APOS) {
            return this.next(this.parseLiteralMultiString);
          } else {
            return this.returnNow();
          }
        }
        parseLiteralMultiString() {
          if (this.char === CTRL_M) {
            return null;
          } else if (this.char === CTRL_J) {
            return this.next(this.parseLiteralMultiStringContent);
          } else {
            return this.goto(this.parseLiteralMultiStringContent);
          }
        }
        parseLiteralMultiStringContent() {
          do {
            if (this.char === CHAR_APOS) {
              return this.next(this.parseLiteralMultiEnd);
            } else if (this.char === Parser.END) {
              throw this.error(new TomlError("Unterminated multi-line string"));
            } else if (this.char === CHAR_DEL || this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I && this.char !== CTRL_J && this.char !== CTRL_M) {
              throw this.errorControlCharInString();
            } else {
              this.consume();
            }
          } while (this.nextChar());
        }
        parseLiteralMultiEnd() {
          if (this.char === CHAR_APOS) {
            return this.next(this.parseLiteralMultiEnd2);
          } else {
            this.state.buf += "'";
            return this.goto(this.parseLiteralMultiStringContent);
          }
        }
        parseLiteralMultiEnd2() {
          if (this.char === CHAR_APOS) {
            return this.return();
          } else {
            this.state.buf += "''";
            return this.goto(this.parseLiteralMultiStringContent);
          }
        }
        /* STRINGS double quoted */
        parseDoubleString() {
          if (this.char === CHAR_QUOT) {
            return this.next(this.parseMultiStringMaybe);
          } else {
            return this.goto(this.parseBasicString);
          }
        }
        parseBasicString() {
          do {
            if (this.char === CHAR_BSOL) {
              return this.call(this.parseEscape, this.recordEscapeReplacement);
            } else if (this.char === CHAR_QUOT) {
              return this.return();
            } else if (this.atEndOfLine()) {
              throw this.error(new TomlError("Unterminated string"));
            } else if (this.char === CHAR_DEL || this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I) {
              throw this.errorControlCharInString();
            } else {
              this.consume();
            }
          } while (this.nextChar());
        }
        recordEscapeReplacement(replacement) {
          this.state.buf += replacement;
          return this.goto(this.parseBasicString);
        }
        parseMultiStringMaybe() {
          if (this.char === CHAR_QUOT) {
            return this.next(this.parseMultiString);
          } else {
            return this.returnNow();
          }
        }
        parseMultiString() {
          if (this.char === CTRL_M) {
            return null;
          } else if (this.char === CTRL_J) {
            return this.next(this.parseMultiStringContent);
          } else {
            return this.goto(this.parseMultiStringContent);
          }
        }
        parseMultiStringContent() {
          do {
            if (this.char === CHAR_BSOL) {
              return this.call(this.parseMultiEscape, this.recordMultiEscapeReplacement);
            } else if (this.char === CHAR_QUOT) {
              return this.next(this.parseMultiEnd);
            } else if (this.char === Parser.END) {
              throw this.error(new TomlError("Unterminated multi-line string"));
            } else if (this.char === CHAR_DEL || this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I && this.char !== CTRL_J && this.char !== CTRL_M) {
              throw this.errorControlCharInString();
            } else {
              this.consume();
            }
          } while (this.nextChar());
        }
        errorControlCharInString() {
          let displayCode = "\\u00";
          if (this.char < 16) {
            displayCode += "0";
          }
          displayCode += this.char.toString(16);
          return this.error(new TomlError(`Control characters (codes < 0x1f and 0x7f) are not allowed in strings, use ${displayCode} instead`));
        }
        recordMultiEscapeReplacement(replacement) {
          this.state.buf += replacement;
          return this.goto(this.parseMultiStringContent);
        }
        parseMultiEnd() {
          if (this.char === CHAR_QUOT) {
            return this.next(this.parseMultiEnd2);
          } else {
            this.state.buf += '"';
            return this.goto(this.parseMultiStringContent);
          }
        }
        parseMultiEnd2() {
          if (this.char === CHAR_QUOT) {
            return this.return();
          } else {
            this.state.buf += '""';
            return this.goto(this.parseMultiStringContent);
          }
        }
        parseMultiEscape() {
          if (this.char === CTRL_M || this.char === CTRL_J) {
            return this.next(this.parseMultiTrim);
          } else if (this.char === CHAR_SP || this.char === CTRL_I) {
            return this.next(this.parsePreMultiTrim);
          } else {
            return this.goto(this.parseEscape);
          }
        }
        parsePreMultiTrim() {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else if (this.char === CTRL_M || this.char === CTRL_J) {
            return this.next(this.parseMultiTrim);
          } else {
            throw this.error(new TomlError("Can't escape whitespace"));
          }
        }
        parseMultiTrim() {
          if (this.char === CTRL_J || this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M) {
            return null;
          } else {
            return this.returnNow();
          }
        }
        parseEscape() {
          if (this.char in escapes) {
            return this.return(escapes[this.char]);
          } else if (this.char === CHAR_u) {
            return this.call(this.parseSmallUnicode, this.parseUnicodeReturn);
          } else if (this.char === CHAR_U) {
            return this.call(this.parseLargeUnicode, this.parseUnicodeReturn);
          } else {
            throw this.error(new TomlError("Unknown escape character: " + this.char));
          }
        }
        parseUnicodeReturn(char) {
          try {
            const codePoint = parseInt(char, 16);
            if (codePoint >= SURROGATE_FIRST && codePoint <= SURROGATE_LAST) {
              throw this.error(new TomlError("Invalid unicode, character in range 0xD800 - 0xDFFF is reserved"));
            }
            return this.returnNow(String.fromCodePoint(codePoint));
          } catch (err) {
            throw this.error(TomlError.wrap(err));
          }
        }
        parseSmallUnicode() {
          if (!isHexit(this.char)) {
            throw this.error(new TomlError("Invalid character in unicode sequence, expected hex"));
          } else {
            this.consume();
            if (this.state.buf.length >= 4) return this.return();
          }
        }
        parseLargeUnicode() {
          if (!isHexit(this.char)) {
            throw this.error(new TomlError("Invalid character in unicode sequence, expected hex"));
          } else {
            this.consume();
            if (this.state.buf.length >= 8) return this.return();
          }
        }
        /* NUMBERS */
        parseNumberSign() {
          this.consume();
          return this.next(this.parseMaybeSignedInfOrNan);
        }
        parseMaybeSignedInfOrNan() {
          if (this.char === CHAR_i) {
            return this.next(this.parseInf);
          } else if (this.char === CHAR_n) {
            return this.next(this.parseNan);
          } else {
            return this.callNow(this.parseNoUnder, this.parseNumberIntegerStart);
          }
        }
        parseNumberIntegerStart() {
          if (this.char === CHAR_0) {
            this.consume();
            return this.next(this.parseNumberIntegerExponentOrDecimal);
          } else {
            return this.goto(this.parseNumberInteger);
          }
        }
        parseNumberIntegerExponentOrDecimal() {
          if (this.char === CHAR_PERIOD) {
            this.consume();
            return this.call(this.parseNoUnder, this.parseNumberFloat);
          } else if (this.char === CHAR_E || this.char === CHAR_e) {
            this.consume();
            return this.next(this.parseNumberExponentSign);
          } else {
            return this.returnNow(Integer(this.state.buf));
          }
        }
        parseNumberInteger() {
          if (isDigit(this.char)) {
            this.consume();
          } else if (this.char === CHAR_LOWBAR) {
            return this.call(this.parseNoUnder);
          } else if (this.char === CHAR_E || this.char === CHAR_e) {
            this.consume();
            return this.next(this.parseNumberExponentSign);
          } else if (this.char === CHAR_PERIOD) {
            this.consume();
            return this.call(this.parseNoUnder, this.parseNumberFloat);
          } else {
            const result = Integer(this.state.buf);
            if (result.isNaN()) {
              throw this.error(new TomlError("Invalid number"));
            } else {
              return this.returnNow(result);
            }
          }
        }
        parseNoUnder() {
          if (this.char === CHAR_LOWBAR || this.char === CHAR_PERIOD || this.char === CHAR_E || this.char === CHAR_e) {
            throw this.error(new TomlError("Unexpected character, expected digit"));
          } else if (this.atEndOfWord()) {
            throw this.error(new TomlError("Incomplete number"));
          }
          return this.returnNow();
        }
        parseNoUnderHexOctBinLiteral() {
          if (this.char === CHAR_LOWBAR || this.char === CHAR_PERIOD) {
            throw this.error(new TomlError("Unexpected character, expected digit"));
          } else if (this.atEndOfWord()) {
            throw this.error(new TomlError("Incomplete number"));
          }
          return this.returnNow();
        }
        parseNumberFloat() {
          if (this.char === CHAR_LOWBAR) {
            return this.call(this.parseNoUnder, this.parseNumberFloat);
          } else if (isDigit(this.char)) {
            this.consume();
          } else if (this.char === CHAR_E || this.char === CHAR_e) {
            this.consume();
            return this.next(this.parseNumberExponentSign);
          } else {
            return this.returnNow(Float(this.state.buf));
          }
        }
        parseNumberExponentSign() {
          if (isDigit(this.char)) {
            return this.goto(this.parseNumberExponent);
          } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
            this.consume();
            this.call(this.parseNoUnder, this.parseNumberExponent);
          } else {
            throw this.error(new TomlError("Unexpected character, expected -, + or digit"));
          }
        }
        parseNumberExponent() {
          if (isDigit(this.char)) {
            this.consume();
          } else if (this.char === CHAR_LOWBAR) {
            return this.call(this.parseNoUnder);
          } else {
            return this.returnNow(Float(this.state.buf));
          }
        }
        /* NUMBERS or DATETIMES  */
        parseNumberOrDateTime() {
          if (this.char === CHAR_0) {
            this.consume();
            return this.next(this.parseNumberBaseOrDateTime);
          } else {
            return this.goto(this.parseNumberOrDateTimeOnly);
          }
        }
        parseNumberOrDateTimeOnly() {
          if (this.char === CHAR_LOWBAR) {
            return this.call(this.parseNoUnder, this.parseNumberInteger);
          } else if (isDigit(this.char)) {
            this.consume();
            if (this.state.buf.length > 4) this.next(this.parseNumberInteger);
          } else if (this.char === CHAR_E || this.char === CHAR_e) {
            this.consume();
            return this.next(this.parseNumberExponentSign);
          } else if (this.char === CHAR_PERIOD) {
            this.consume();
            return this.call(this.parseNoUnder, this.parseNumberFloat);
          } else if (this.char === CHAR_HYPHEN) {
            return this.goto(this.parseDateTime);
          } else if (this.char === CHAR_COLON) {
            return this.goto(this.parseOnlyTimeHour);
          } else {
            return this.returnNow(Integer(this.state.buf));
          }
        }
        parseDateTimeOnly() {
          if (this.state.buf.length < 4) {
            if (isDigit(this.char)) {
              return this.consume();
            } else if (this.char === CHAR_COLON) {
              return this.goto(this.parseOnlyTimeHour);
            } else {
              throw this.error(new TomlError("Expected digit while parsing year part of a date"));
            }
          } else {
            if (this.char === CHAR_HYPHEN) {
              return this.goto(this.parseDateTime);
            } else {
              throw this.error(new TomlError("Expected hyphen (-) while parsing year part of date"));
            }
          }
        }
        parseNumberBaseOrDateTime() {
          if (this.char === CHAR_b) {
            this.consume();
            return this.call(this.parseNoUnderHexOctBinLiteral, this.parseIntegerBin);
          } else if (this.char === CHAR_o) {
            this.consume();
            return this.call(this.parseNoUnderHexOctBinLiteral, this.parseIntegerOct);
          } else if (this.char === CHAR_x) {
            this.consume();
            return this.call(this.parseNoUnderHexOctBinLiteral, this.parseIntegerHex);
          } else if (this.char === CHAR_PERIOD) {
            return this.goto(this.parseNumberInteger);
          } else if (isDigit(this.char)) {
            return this.goto(this.parseDateTimeOnly);
          } else {
            return this.returnNow(Integer(this.state.buf));
          }
        }
        parseIntegerHex() {
          if (isHexit(this.char)) {
            this.consume();
          } else if (this.char === CHAR_LOWBAR) {
            return this.call(this.parseNoUnderHexOctBinLiteral);
          } else {
            const result = Integer(this.state.buf);
            if (result.isNaN()) {
              throw this.error(new TomlError("Invalid number"));
            } else {
              return this.returnNow(result);
            }
          }
        }
        parseIntegerOct() {
          if (isOctit(this.char)) {
            this.consume();
          } else if (this.char === CHAR_LOWBAR) {
            return this.call(this.parseNoUnderHexOctBinLiteral);
          } else {
            const result = Integer(this.state.buf);
            if (result.isNaN()) {
              throw this.error(new TomlError("Invalid number"));
            } else {
              return this.returnNow(result);
            }
          }
        }
        parseIntegerBin() {
          if (isBit(this.char)) {
            this.consume();
          } else if (this.char === CHAR_LOWBAR) {
            return this.call(this.parseNoUnderHexOctBinLiteral);
          } else {
            const result = Integer(this.state.buf);
            if (result.isNaN()) {
              throw this.error(new TomlError("Invalid number"));
            } else {
              return this.returnNow(result);
            }
          }
        }
        /* DATETIME */
        parseDateTime() {
          if (this.state.buf.length < 4) {
            throw this.error(new TomlError("Years less than 1000 must be zero padded to four characters"));
          }
          this.state.result = this.state.buf;
          this.state.buf = "";
          return this.next(this.parseDateMonth);
        }
        parseDateMonth() {
          if (this.char === CHAR_HYPHEN) {
            if (this.state.buf.length < 2) {
              throw this.error(new TomlError("Months less than 10 must be zero padded to two characters"));
            }
            this.state.result += "-" + this.state.buf;
            this.state.buf = "";
            return this.next(this.parseDateDay);
          } else if (isDigit(this.char)) {
            this.consume();
          } else {
            throw this.error(new TomlError("Incomplete datetime"));
          }
        }
        parseDateDay() {
          if (this.char === CHAR_T || this.char === CHAR_SP) {
            if (this.state.buf.length < 2) {
              throw this.error(new TomlError("Days less than 10 must be zero padded to two characters"));
            }
            this.state.result += "-" + this.state.buf;
            this.state.buf = "";
            return this.next(this.parseStartTimeHour);
          } else if (this.atEndOfWord()) {
            return this.returnNow(createDate(this.state.result + "-" + this.state.buf));
          } else if (isDigit(this.char)) {
            this.consume();
          } else {
            throw this.error(new TomlError("Incomplete datetime"));
          }
        }
        parseStartTimeHour() {
          if (this.atEndOfWord()) {
            return this.returnNow(createDate(this.state.result));
          } else {
            return this.goto(this.parseTimeHour);
          }
        }
        parseTimeHour() {
          if (this.char === CHAR_COLON) {
            if (this.state.buf.length < 2) {
              throw this.error(new TomlError("Hours less than 10 must be zero padded to two characters"));
            }
            this.state.result += "T" + this.state.buf;
            this.state.buf = "";
            return this.next(this.parseTimeMin);
          } else if (isDigit(this.char)) {
            this.consume();
          } else {
            throw this.error(new TomlError("Incomplete datetime"));
          }
        }
        parseTimeMin() {
          if (this.state.buf.length < 2 && isDigit(this.char)) {
            this.consume();
          } else if (this.state.buf.length === 2 && this.char === CHAR_COLON) {
            this.state.result += ":" + this.state.buf;
            this.state.buf = "";
            return this.next(this.parseTimeSec);
          } else {
            throw this.error(new TomlError("Incomplete datetime"));
          }
        }
        parseTimeSec() {
          if (isDigit(this.char)) {
            this.consume();
            if (this.state.buf.length === 2) {
              this.state.result += ":" + this.state.buf;
              this.state.buf = "";
              return this.next(this.parseTimeZoneOrFraction);
            }
          } else {
            throw this.error(new TomlError("Incomplete datetime"));
          }
        }
        parseOnlyTimeHour() {
          if (this.char === CHAR_COLON) {
            if (this.state.buf.length < 2) {
              throw this.error(new TomlError("Hours less than 10 must be zero padded to two characters"));
            }
            this.state.result = this.state.buf;
            this.state.buf = "";
            return this.next(this.parseOnlyTimeMin);
          } else {
            throw this.error(new TomlError("Incomplete time"));
          }
        }
        parseOnlyTimeMin() {
          if (this.state.buf.length < 2 && isDigit(this.char)) {
            this.consume();
          } else if (this.state.buf.length === 2 && this.char === CHAR_COLON) {
            this.state.result += ":" + this.state.buf;
            this.state.buf = "";
            return this.next(this.parseOnlyTimeSec);
          } else {
            throw this.error(new TomlError("Incomplete time"));
          }
        }
        parseOnlyTimeSec() {
          if (isDigit(this.char)) {
            this.consume();
            if (this.state.buf.length === 2) {
              return this.next(this.parseOnlyTimeFractionMaybe);
            }
          } else {
            throw this.error(new TomlError("Incomplete time"));
          }
        }
        parseOnlyTimeFractionMaybe() {
          this.state.result += ":" + this.state.buf;
          if (this.char === CHAR_PERIOD) {
            this.state.buf = "";
            this.next(this.parseOnlyTimeFraction);
          } else {
            return this.return(createTime(this.state.result));
          }
        }
        parseOnlyTimeFraction() {
          if (isDigit(this.char)) {
            this.consume();
          } else if (this.atEndOfWord()) {
            if (this.state.buf.length === 0) throw this.error(new TomlError("Expected digit in milliseconds"));
            return this.returnNow(createTime(this.state.result + "." + this.state.buf));
          } else {
            throw this.error(new TomlError("Unexpected character in datetime, expected period (.), minus (-), plus (+) or Z"));
          }
        }
        parseTimeZoneOrFraction() {
          if (this.char === CHAR_PERIOD) {
            this.consume();
            this.next(this.parseDateTimeFraction);
          } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
            this.consume();
            this.next(this.parseTimeZoneHour);
          } else if (this.char === CHAR_Z) {
            this.consume();
            return this.return(createDateTime(this.state.result + this.state.buf));
          } else if (this.atEndOfWord()) {
            return this.returnNow(createDateTimeFloat(this.state.result + this.state.buf));
          } else {
            throw this.error(new TomlError("Unexpected character in datetime, expected period (.), minus (-), plus (+) or Z"));
          }
        }
        parseDateTimeFraction() {
          if (isDigit(this.char)) {
            this.consume();
          } else if (this.state.buf.length === 1) {
            throw this.error(new TomlError("Expected digit in milliseconds"));
          } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
            this.consume();
            this.next(this.parseTimeZoneHour);
          } else if (this.char === CHAR_Z) {
            this.consume();
            return this.return(createDateTime(this.state.result + this.state.buf));
          } else if (this.atEndOfWord()) {
            return this.returnNow(createDateTimeFloat(this.state.result + this.state.buf));
          } else {
            throw this.error(new TomlError("Unexpected character in datetime, expected period (.), minus (-), plus (+) or Z"));
          }
        }
        parseTimeZoneHour() {
          if (isDigit(this.char)) {
            this.consume();
            if (/\d\d$/.test(this.state.buf)) return this.next(this.parseTimeZoneSep);
          } else {
            throw this.error(new TomlError("Unexpected character in datetime, expected digit"));
          }
        }
        parseTimeZoneSep() {
          if (this.char === CHAR_COLON) {
            this.consume();
            this.next(this.parseTimeZoneMin);
          } else {
            throw this.error(new TomlError("Unexpected character in datetime, expected colon"));
          }
        }
        parseTimeZoneMin() {
          if (isDigit(this.char)) {
            this.consume();
            if (/\d\d$/.test(this.state.buf)) return this.return(createDateTime(this.state.result + this.state.buf));
          } else {
            throw this.error(new TomlError("Unexpected character in datetime, expected digit"));
          }
        }
        /* BOOLEAN */
        parseBoolean() {
          if (this.char === CHAR_t) {
            this.consume();
            return this.next(this.parseTrue_r);
          } else if (this.char === CHAR_f) {
            this.consume();
            return this.next(this.parseFalse_a);
          }
        }
        parseTrue_r() {
          if (this.char === CHAR_r) {
            this.consume();
            return this.next(this.parseTrue_u);
          } else {
            throw this.error(new TomlError("Invalid boolean, expected true or false"));
          }
        }
        parseTrue_u() {
          if (this.char === CHAR_u) {
            this.consume();
            return this.next(this.parseTrue_e);
          } else {
            throw this.error(new TomlError("Invalid boolean, expected true or false"));
          }
        }
        parseTrue_e() {
          if (this.char === CHAR_e) {
            return this.return(true);
          } else {
            throw this.error(new TomlError("Invalid boolean, expected true or false"));
          }
        }
        parseFalse_a() {
          if (this.char === CHAR_a) {
            this.consume();
            return this.next(this.parseFalse_l);
          } else {
            throw this.error(new TomlError("Invalid boolean, expected true or false"));
          }
        }
        parseFalse_l() {
          if (this.char === CHAR_l) {
            this.consume();
            return this.next(this.parseFalse_s);
          } else {
            throw this.error(new TomlError("Invalid boolean, expected true or false"));
          }
        }
        parseFalse_s() {
          if (this.char === CHAR_s) {
            this.consume();
            return this.next(this.parseFalse_e);
          } else {
            throw this.error(new TomlError("Invalid boolean, expected true or false"));
          }
        }
        parseFalse_e() {
          if (this.char === CHAR_e) {
            return this.return(false);
          } else {
            throw this.error(new TomlError("Invalid boolean, expected true or false"));
          }
        }
        /* INLINE LISTS */
        parseInlineList() {
          if (this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M || this.char === CTRL_J) {
            return null;
          } else if (this.char === Parser.END) {
            throw this.error(new TomlError("Unterminated inline array"));
          } else if (this.char === CHAR_NUM) {
            return this.call(this.parseComment);
          } else if (this.char === CHAR_RSQB) {
            return this.return(this.state.resultArr || InlineList());
          } else {
            return this.callNow(this.parseValue, this.recordInlineListValue);
          }
        }
        recordInlineListValue(value) {
          if (this.state.resultArr) {
            const listType = this.state.resultArr[_contentType];
            const valueType = tomlType(value);
            if (listType !== valueType) {
              throw this.error(new TomlError(`Inline lists must be a single type, not a mix of ${listType} and ${valueType}`));
            }
          } else {
            this.state.resultArr = InlineList(tomlType(value));
          }
          if (isFloat(value) || isInteger(value)) {
            this.state.resultArr.push(value.valueOf());
          } else {
            this.state.resultArr.push(value);
          }
          return this.goto(this.parseInlineListNext);
        }
        parseInlineListNext() {
          if (this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M || this.char === CTRL_J) {
            return null;
          } else if (this.char === CHAR_NUM) {
            return this.call(this.parseComment);
          } else if (this.char === CHAR_COMMA) {
            return this.next(this.parseInlineList);
          } else if (this.char === CHAR_RSQB) {
            return this.goto(this.parseInlineList);
          } else {
            throw this.error(new TomlError("Invalid character, expected whitespace, comma (,) or close bracket (])"));
          }
        }
        /* INLINE TABLE */
        parseInlineTable() {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else if (this.char === Parser.END || this.char === CHAR_NUM || this.char === CTRL_J || this.char === CTRL_M) {
            throw this.error(new TomlError("Unterminated inline array"));
          } else if (this.char === CHAR_RCUB) {
            return this.return(this.state.resultTable || InlineTable());
          } else {
            if (!this.state.resultTable) this.state.resultTable = InlineTable();
            return this.callNow(this.parseAssign, this.recordInlineTableValue);
          }
        }
        recordInlineTableValue(kv) {
          let target = this.state.resultTable;
          let finalKey = kv.key.pop();
          for (let kw of kv.key) {
            if (hasKey(target, kw) && (!isTable(target[kw]) || target[kw][_declared])) {
              throw this.error(new TomlError("Can't redefine existing key"));
            }
            target = target[kw] = target[kw] || Table();
          }
          if (hasKey(target, finalKey)) {
            throw this.error(new TomlError("Can't redefine existing key"));
          }
          if (isInteger(kv.value) || isFloat(kv.value)) {
            target[finalKey] = kv.value.valueOf();
          } else {
            target[finalKey] = kv.value;
          }
          return this.goto(this.parseInlineTableNext);
        }
        parseInlineTableNext() {
          if (this.char === CHAR_SP || this.char === CTRL_I) {
            return null;
          } else if (this.char === Parser.END || this.char === CHAR_NUM || this.char === CTRL_J || this.char === CTRL_M) {
            throw this.error(new TomlError("Unterminated inline array"));
          } else if (this.char === CHAR_COMMA) {
            return this.next(this.parseInlineTable);
          } else if (this.char === CHAR_RCUB) {
            return this.goto(this.parseInlineTable);
          } else {
            throw this.error(new TomlError("Invalid character, expected whitespace, comma (,) or close bracket (])"));
          }
        }
      }
      return TOMLParser;
    }
  }
});

// node_modules/@iarna/toml/parse-pretty-error.js
var require_parse_pretty_error = __commonJS({
  "node_modules/@iarna/toml/parse-pretty-error.js"(exports2, module2) {
    "use strict";
    module2.exports = prettyError;
    function prettyError(err, buf) {
      if (err.pos == null || err.line == null) return err;
      let msg = err.message;
      msg += ` at row ${err.line + 1}, col ${err.col + 1}, pos ${err.pos}:
`;
      if (buf && buf.split) {
        const lines = buf.split(/\n/);
        const lineNumWidth = String(Math.min(lines.length, err.line + 3)).length;
        let linePadding = " ";
        while (linePadding.length < lineNumWidth) linePadding += " ";
        for (let ii = Math.max(0, err.line - 1); ii < Math.min(lines.length, err.line + 2); ++ii) {
          let lineNum = String(ii + 1);
          if (lineNum.length < lineNumWidth) lineNum = " " + lineNum;
          if (err.line === ii) {
            msg += lineNum + "> " + lines[ii] + "\n";
            msg += linePadding + "  ";
            for (let hh = 0; hh < err.col; ++hh) {
              msg += " ";
            }
            msg += "^\n";
          } else {
            msg += lineNum + ": " + lines[ii] + "\n";
          }
        }
      }
      err.message = msg + "\n";
      return err;
    }
  }
});

// node_modules/@iarna/toml/parse-string.js
var require_parse_string = __commonJS({
  "node_modules/@iarna/toml/parse-string.js"(exports2, module2) {
    "use strict";
    module2.exports = parseString;
    var TOMLParser = require_toml_parser();
    var prettyError = require_parse_pretty_error();
    function parseString(str) {
      if (global.Buffer && global.Buffer.isBuffer(str)) {
        str = str.toString("utf8");
      }
      const parser = new TOMLParser();
      try {
        parser.parse(str);
        return parser.finish();
      } catch (err) {
        throw prettyError(err, str);
      }
    }
  }
});

// node_modules/@iarna/toml/parse-async.js
var require_parse_async = __commonJS({
  "node_modules/@iarna/toml/parse-async.js"(exports2, module2) {
    "use strict";
    module2.exports = parseAsync;
    var TOMLParser = require_toml_parser();
    var prettyError = require_parse_pretty_error();
    function parseAsync(str, opts) {
      if (!opts) opts = {};
      const index = 0;
      const blocksize = opts.blocksize || 40960;
      const parser = new TOMLParser();
      return new Promise((resolve2, reject) => {
        setImmediate(parseAsyncNext, index, blocksize, resolve2, reject);
      });
      function parseAsyncNext(index2, blocksize2, resolve2, reject) {
        if (index2 >= str.length) {
          try {
            return resolve2(parser.finish());
          } catch (err) {
            return reject(prettyError(err, str));
          }
        }
        try {
          parser.parse(str.slice(index2, index2 + blocksize2));
          setImmediate(parseAsyncNext, index2 + blocksize2, blocksize2, resolve2, reject);
        } catch (err) {
          reject(prettyError(err, str));
        }
      }
    }
  }
});

// node_modules/@iarna/toml/parse-stream.js
var require_parse_stream = __commonJS({
  "node_modules/@iarna/toml/parse-stream.js"(exports2, module2) {
    "use strict";
    module2.exports = parseStream;
    var stream = require("stream");
    var TOMLParser = require_toml_parser();
    function parseStream(stm) {
      if (stm) {
        return parseReadable(stm);
      } else {
        return parseTransform(stm);
      }
    }
    function parseReadable(stm) {
      const parser = new TOMLParser();
      stm.setEncoding("utf8");
      return new Promise((resolve2, reject) => {
        let readable;
        let ended = false;
        let errored = false;
        function finish() {
          ended = true;
          if (readable) return;
          try {
            resolve2(parser.finish());
          } catch (err) {
            reject(err);
          }
        }
        function error2(err) {
          errored = true;
          reject(err);
        }
        stm.once("end", finish);
        stm.once("error", error2);
        readNext();
        function readNext() {
          readable = true;
          let data;
          while ((data = stm.read()) !== null) {
            try {
              parser.parse(data);
            } catch (err) {
              return error2(err);
            }
          }
          readable = false;
          if (ended) return finish();
          if (errored) return;
          stm.once("readable", readNext);
        }
      });
    }
    function parseTransform() {
      const parser = new TOMLParser();
      return new stream.Transform({
        objectMode: true,
        transform(chunk, encoding, cb) {
          try {
            parser.parse(chunk.toString(encoding));
          } catch (err) {
            this.emit("error", err);
          }
          cb();
        },
        flush(cb) {
          try {
            this.push(parser.finish());
          } catch (err) {
            this.emit("error", err);
          }
          cb();
        }
      });
    }
  }
});

// node_modules/@iarna/toml/parse.js
var require_parse = __commonJS({
  "node_modules/@iarna/toml/parse.js"(exports2, module2) {
    "use strict";
    module2.exports = require_parse_string();
    module2.exports.async = require_parse_async();
    module2.exports.stream = require_parse_stream();
    module2.exports.prettyError = require_parse_pretty_error();
  }
});

// node_modules/@iarna/toml/stringify.js
var require_stringify = __commonJS({
  "node_modules/@iarna/toml/stringify.js"(exports2, module2) {
    "use strict";
    module2.exports = stringify;
    module2.exports.value = stringifyInline;
    function stringify(obj) {
      if (obj === null) throw typeError("null");
      if (obj === void 0) throw typeError("undefined");
      if (typeof obj !== "object") throw typeError(typeof obj);
      if (typeof obj.toJSON === "function") obj = obj.toJSON();
      if (obj == null) return null;
      const type = tomlType2(obj);
      if (type !== "table") throw typeError(type);
      return stringifyObject("", "", obj);
    }
    function typeError(type) {
      return new Error("Can only stringify objects, not " + type);
    }
    function arrayOneTypeError() {
      return new Error("Array values can't have mixed types");
    }
    function getInlineKeys(obj) {
      return Object.keys(obj).filter((key) => isInline(obj[key]));
    }
    function getComplexKeys(obj) {
      return Object.keys(obj).filter((key) => !isInline(obj[key]));
    }
    function toJSON(obj) {
      let nobj = Array.isArray(obj) ? [] : Object.prototype.hasOwnProperty.call(obj, "__proto__") ? { ["__proto__"]: void 0 } : {};
      for (let prop of Object.keys(obj)) {
        if (obj[prop] && typeof obj[prop].toJSON === "function" && !("toISOString" in obj[prop])) {
          nobj[prop] = obj[prop].toJSON();
        } else {
          nobj[prop] = obj[prop];
        }
      }
      return nobj;
    }
    function stringifyObject(prefix, indent, obj) {
      obj = toJSON(obj);
      var inlineKeys;
      var complexKeys;
      inlineKeys = getInlineKeys(obj);
      complexKeys = getComplexKeys(obj);
      var result = [];
      var inlineIndent = indent || "";
      inlineKeys.forEach((key) => {
        var type = tomlType2(obj[key]);
        if (type !== "undefined" && type !== "null") {
          result.push(inlineIndent + stringifyKey(key) + " = " + stringifyAnyInline(obj[key], true));
        }
      });
      if (result.length > 0) result.push("");
      var complexIndent = prefix && inlineKeys.length > 0 ? indent + "  " : "";
      complexKeys.forEach((key) => {
        result.push(stringifyComplex(prefix, complexIndent, key, obj[key]));
      });
      return result.join("\n");
    }
    function isInline(value) {
      switch (tomlType2(value)) {
        case "undefined":
        case "null":
        case "integer":
        case "nan":
        case "float":
        case "boolean":
        case "string":
        case "datetime":
          return true;
        case "array":
          return value.length === 0 || tomlType2(value[0]) !== "table";
        case "table":
          return Object.keys(value).length === 0;
        /* istanbul ignore next */
        default:
          return false;
      }
    }
    function tomlType2(value) {
      if (value === void 0) {
        return "undefined";
      } else if (value === null) {
        return "null";
      } else if (typeof value === "bigint" || Number.isInteger(value) && !Object.is(value, -0)) {
        return "integer";
      } else if (typeof value === "number") {
        return "float";
      } else if (typeof value === "boolean") {
        return "boolean";
      } else if (typeof value === "string") {
        return "string";
      } else if ("toISOString" in value) {
        return isNaN(value) ? "undefined" : "datetime";
      } else if (Array.isArray(value)) {
        return "array";
      } else {
        return "table";
      }
    }
    function stringifyKey(key) {
      var keyStr = String(key);
      if (/^[-A-Za-z0-9_]+$/.test(keyStr)) {
        return keyStr;
      } else {
        return stringifyBasicString(keyStr);
      }
    }
    function stringifyBasicString(str) {
      return '"' + escapeString(str).replace(/"/g, '\\"') + '"';
    }
    function stringifyLiteralString(str) {
      return "'" + str + "'";
    }
    function numpad(num, str) {
      while (str.length < num) str = "0" + str;
      return str;
    }
    function escapeString(str) {
      return str.replace(/\\/g, "\\\\").replace(/[\b]/g, "\\b").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\f/g, "\\f").replace(/\r/g, "\\r").replace(/([\u0000-\u001f\u007f])/, (c) => "\\u" + numpad(4, c.codePointAt(0).toString(16)));
    }
    function stringifyMultilineString(str) {
      let escaped = str.split(/\n/).map((str2) => {
        return escapeString(str2).replace(/"(?="")/g, '\\"');
      }).join("\n");
      if (escaped.slice(-1) === '"') escaped += "\\\n";
      return '"""\n' + escaped + '"""';
    }
    function stringifyAnyInline(value, multilineOk) {
      let type = tomlType2(value);
      if (type === "string") {
        if (multilineOk && /\n/.test(value)) {
          type = "string-multiline";
        } else if (!/[\b\t\n\f\r']/.test(value) && /"/.test(value)) {
          type = "string-literal";
        }
      }
      return stringifyInline(value, type);
    }
    function stringifyInline(value, type) {
      if (!type) type = tomlType2(value);
      switch (type) {
        case "string-multiline":
          return stringifyMultilineString(value);
        case "string":
          return stringifyBasicString(value);
        case "string-literal":
          return stringifyLiteralString(value);
        case "integer":
          return stringifyInteger(value);
        case "float":
          return stringifyFloat(value);
        case "boolean":
          return stringifyBoolean(value);
        case "datetime":
          return stringifyDatetime(value);
        case "array":
          return stringifyInlineArray(value.filter((_) => tomlType2(_) !== "null" && tomlType2(_) !== "undefined" && tomlType2(_) !== "nan"));
        case "table":
          return stringifyInlineTable(value);
        /* istanbul ignore next */
        default:
          throw typeError(type);
      }
    }
    function stringifyInteger(value) {
      return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "_");
    }
    function stringifyFloat(value) {
      if (value === Infinity) {
        return "inf";
      } else if (value === -Infinity) {
        return "-inf";
      } else if (Object.is(value, NaN)) {
        return "nan";
      } else if (Object.is(value, -0)) {
        return "-0.0";
      }
      var chunks = String(value).split(".");
      var int = chunks[0];
      var dec = chunks[1] || 0;
      return stringifyInteger(int) + "." + dec;
    }
    function stringifyBoolean(value) {
      return String(value);
    }
    function stringifyDatetime(value) {
      return value.toISOString();
    }
    function isNumber(type) {
      return type === "float" || type === "integer";
    }
    function arrayType(values) {
      var contentType = tomlType2(values[0]);
      if (values.every((_) => tomlType2(_) === contentType)) return contentType;
      if (values.every((_) => isNumber(tomlType2(_)))) return "float";
      return "mixed";
    }
    function validateArray(values) {
      const type = arrayType(values);
      if (type === "mixed") {
        throw arrayOneTypeError();
      }
      return type;
    }
    function stringifyInlineArray(values) {
      values = toJSON(values);
      const type = validateArray(values);
      var result = "[";
      var stringified = values.map((_) => stringifyInline(_, type));
      if (stringified.join(", ").length > 60 || /\n/.test(stringified)) {
        result += "\n  " + stringified.join(",\n  ") + "\n";
      } else {
        result += " " + stringified.join(", ") + (stringified.length > 0 ? " " : "");
      }
      return result + "]";
    }
    function stringifyInlineTable(value) {
      value = toJSON(value);
      var result = [];
      Object.keys(value).forEach((key) => {
        result.push(stringifyKey(key) + " = " + stringifyAnyInline(value[key], false));
      });
      return "{ " + result.join(", ") + (result.length > 0 ? " " : "") + "}";
    }
    function stringifyComplex(prefix, indent, key, value) {
      var valueType = tomlType2(value);
      if (valueType === "array") {
        return stringifyArrayOfTables(prefix, indent, key, value);
      } else if (valueType === "table") {
        return stringifyComplexTable(prefix, indent, key, value);
      } else {
        throw typeError(valueType);
      }
    }
    function stringifyArrayOfTables(prefix, indent, key, values) {
      values = toJSON(values);
      validateArray(values);
      var firstValueType = tomlType2(values[0]);
      if (firstValueType !== "table") throw typeError(firstValueType);
      var fullKey = prefix + stringifyKey(key);
      var result = "";
      values.forEach((table) => {
        if (result.length > 0) result += "\n";
        result += indent + "[[" + fullKey + "]]\n";
        result += stringifyObject(fullKey + ".", indent, table);
      });
      return result;
    }
    function stringifyComplexTable(prefix, indent, key, value) {
      var fullKey = prefix + stringifyKey(key);
      var result = "";
      if (getInlineKeys(value).length > 0) {
        result += indent + "[" + fullKey + "]\n";
      }
      return result + stringifyObject(fullKey + ".", indent, value);
    }
  }
});

// node_modules/@iarna/toml/toml.js
var require_toml = __commonJS({
  "node_modules/@iarna/toml/toml.js"(exports2) {
    "use strict";
    exports2.parse = require_parse();
    exports2.stringify = require_stringify();
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode4 = __toESM(require("vscode"));
var path3 = __toESM(require("path"));
var fs3 = __toESM(require("fs"));

// src/config.ts
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var import_toml = __toESM(require_toml());

// src/logger.ts
var vscode = __toESM(require("vscode"));
var channel;
function getChannel() {
  if (!channel) {
    channel = vscode.window.createOutputChannel("KirNet Type Generator");
  }
  return channel;
}
function log(message) {
  const ts = (/* @__PURE__ */ new Date()).toISOString();
  getChannel().appendLine(`[${ts}] ${message}`);
}
function warn(message) {
  log(`\u26A0 ${message}`);
}
function error(message) {
  log(`\u2716 ${message}`);
}
function debug(message, isDebug) {
  if (isDebug) {
    log(`[DEBUG] ${message}`);
  }
}
function dispose() {
  channel?.dispose();
  channel = void 0;
}

// src/config.ts
var DEFAULTS = {
  paths: {
    services: "src",
    controllers: "",
    output: "src/ReplicatedStorage/Shared/Packages/KirNet/Types.luau",
    kirnet_package: ""
  },
  options: {
    kirnet_require_path: 'game:GetService("ReplicatedStorage").Shared.Packages.KirNet',
    debug: false
  }
};
function readConfig(workspaceRoot2) {
  const configPath = path.join(workspaceRoot2, "kirnet.toml");
  if (!fs.existsSync(configPath)) {
    return structuredClone(DEFAULTS);
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = import_toml.default.parse(raw);
    const paths = parsed.paths ?? {};
    const options = parsed.options ?? {};
    return {
      paths: {
        services: typeof paths.services === "string" ? paths.services : DEFAULTS.paths.services,
        controllers: typeof paths.controllers === "string" ? paths.controllers : DEFAULTS.paths.controllers,
        output: typeof paths.output === "string" ? paths.output : DEFAULTS.paths.output,
        kirnet_package: typeof paths.kirnet_package === "string" ? paths.kirnet_package : DEFAULTS.paths.kirnet_package
      },
      options: {
        kirnet_require_path: typeof options.kirnet_require_path === "string" ? options.kirnet_require_path : DEFAULTS.options.kirnet_require_path,
        debug: typeof options.debug === "boolean" ? options.debug : DEFAULTS.options.debug
      }
    };
  } catch (e) {
    warn(`Failed to parse kirnet.toml: ${e.message ?? e} \u2014 using defaults`);
    return structuredClone(DEFAULTS);
  }
}

// src/parser.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
function detectKirNetVar(content) {
  const match = content.match(/local\s+(\w+)\s*=\s*require\s*\([^)]*kirnet[^)]*\)/i);
  return match ? match[1] : "KirNet";
}
function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function inferLiteralType(value) {
  if (value === "true" || value === "false") return "boolean";
  if (value === "nil") return "any";
  if (/^-?\d+(\.\d+)?$/.test(value)) return "number";
  if (/^["']/.test(value)) return "string";
  if (/^\{/.test(value)) return "any";
  return "any";
}
function detectDirectionOption(optionsText) {
  const m = optionsText.match(/direction\s*=\s*["'](server|client)["']/);
  return m ? m[1] : null;
}
function inferSignalKindFromConstructor(constructorText, optionsText) {
  if (constructorText.includes("CreateClientSignal")) return "ClientSignal";
  if (constructorText.includes("CreateServerSignal")) return "ServerSignal";
  const dir = detectDirectionOption(optionsText);
  if (dir === "server") return "ServerSignal";
  if (dir === "client") return "ClientSignal";
  return "Signal";
}
function stripInlineComment(line) {
  let inString = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inString = ch;
      } else if (ch === "-" && i + 1 < line.length && line[i + 1] === "-") {
        return line.substring(0, i).trimEnd();
      }
    }
  }
  return line;
}
function parseAll(workspaceRoot2, servicePaths, isDebug) {
  const allServices = [];
  const allWarnings = [];
  const uniquePaths = [...new Set(servicePaths)];
  for (const rel of uniquePaths) {
    const dir = path2.join(workspaceRoot2, rel);
    if (!fs2.existsSync(dir)) {
      continue;
    }
    const files = collectLuauFiles(dir);
    for (const filePath of files) {
      try {
        const content = fs2.readFileSync(filePath, "utf-8");
        const result = parseFile(content, filePath, isDebug);
        allServices.push(...result.services);
        allWarnings.push(...result.warnings);
      } catch (e) {
        error(`Failed to parse ${filePath}: ${e.message}`);
      }
    }
  }
  return { services: allServices, warnings: allWarnings };
}
function collectLuauFiles(dir) {
  const results = [];
  try {
    const entries = fs2.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path2.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectLuauFiles(full));
      } else if (/\.luau?$/.test(entry.name)) {
        results.push(full);
      }
    }
  } catch {
  }
  return results;
}
function parseFile(content, filePath, isDebug) {
  const services = [];
  const warnings = [];
  const kirnetVar = detectKirNetVar(content);
  const registerPattern = new RegExp(
    `${escapeForRegex(kirnetVar)}\\s*(?:\\.|:)\\s*RegisterService\\s*\\(\\s*["']([^"']+)["']\\s*,\\s*\\{`,
    "g"
  );
  let match;
  while ((match = registerPattern.exec(content)) !== null) {
    const kind = "service";
    const serviceName = match[1];
    const braceStart = match.index + match[0].length - 1;
    try {
      const tableBody = extractTableBody(content, braceStart);
      if (tableBody === null) {
        warnings.push({
          filePath,
          line: lineAt(content, match.index),
          message: `Could not find matching closing brace for ${serviceName} definition`
        });
        continue;
      }
      const fields = parseDefinitionTable(
        tableBody.text,
        serviceName,
        filePath,
        tableBody.startOffset,
        content,
        warnings,
        isDebug,
        kirnetVar
      );
      services.push({ name: serviceName, fields, filePath, kind });
      if (isDebug) {
        debug(
          `Parsed ${serviceName}: ${fields.map((f) => `${f.name}: ${f.type}`).join(", ")}`,
          true
        );
      }
    } catch (e) {
      warnings.push({
        filePath,
        line: lineAt(content, match.index),
        message: `Error parsing ${serviceName}: ${e.message}`
      });
    }
  }
  return { services, warnings };
}
function extractTableBody(content, bracePos) {
  let depth = 0;
  for (let i = bracePos; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const bodyStart = bracePos + 1;
        return {
          text: content.slice(bodyStart, i),
          startOffset: bodyStart
        };
      }
    } else if (ch === "-" && content[i + 1] === "-") {
      if (content[i + 2] === "[") {
        const afterDashes = content.substring(i + 2);
        const blockOpenMatch = afterDashes.match(/^\[(=*)\[/);
        if (blockOpenMatch) {
          const eqs = blockOpenMatch[1];
          const closeTag = `]${eqs}]`;
          const closeIdx = content.indexOf(closeTag, i + 2 + blockOpenMatch[0].length);
          if (closeIdx === -1) break;
          i = closeIdx + closeTag.length - 1;
          continue;
        }
      }
      const eol = content.indexOf("\n", i);
      if (eol === -1) {
        break;
      }
      i = eol;
    } else if (ch === '"' || ch === "'") {
      i = skipString(content, i, ch);
    } else if (ch === "[" && (content[i + 1] === "[" || content[i + 1] === "=")) {
      const afterBracket = content.substring(i);
      const longStringMatch = afterBracket.match(/^\[(=*)\[/);
      if (longStringMatch) {
        const eqs = longStringMatch[1];
        const closeTag = `]${eqs}]`;
        const closeIdx = content.indexOf(closeTag, i + longStringMatch[0].length);
        if (closeIdx === -1) break;
        i = closeIdx + closeTag.length - 1;
      }
    }
  }
  return null;
}
function skipString(content, start, quote) {
  for (let i = start + 1; i < content.length; i++) {
    if (content[i] === "\\") {
      i++;
    } else if (content[i] === quote) {
      return i;
    }
  }
  return content.length - 1;
}
function findMatchingParen(content, openPos) {
  let depth = 0;
  for (let i = openPos; i < content.length; i++) {
    const ch = content[i];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    } else if (ch === '"' || ch === "'") {
      i = skipString(content, i, ch);
    } else if (ch === "-" && content[i + 1] === "-") {
      if (content[i + 2] === "[") {
        const afterDashes = content.substring(i + 2);
        const blockOpenMatch = afterDashes.match(/^\[(=*)\[/);
        if (blockOpenMatch) {
          const eqs = blockOpenMatch[1];
          const closeTag = `]${eqs}]`;
          const closeIdx = content.indexOf(closeTag, i + 2 + blockOpenMatch[0].length);
          if (closeIdx === -1) break;
          i = closeIdx + closeTag.length - 1;
          continue;
        }
      }
      const eol = content.indexOf("\n", i);
      if (eol === -1) break;
      i = eol;
    } else if (ch === "[" && (content[i + 1] === "[" || content[i + 1] === "=")) {
      const afterBracket = content.substring(i);
      const longStringMatch = afterBracket.match(/^\[(=*)\[/);
      if (longStringMatch) {
        const eqs = longStringMatch[1];
        const closeTag = `]${eqs}]`;
        const closeIdx = content.indexOf(closeTag, i + longStringMatch[0].length);
        if (closeIdx === -1) break;
        i = closeIdx + closeTag.length - 1;
      }
    }
  }
  return -1;
}
function findMatchingAngle(content, openPos) {
  let depth = 0;
  for (let i = openPos; i < content.length; i++) {
    const ch = content[i];
    if (ch === "<") depth++;
    else if (ch === ">") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
function parseDefinitionTable(tableBody, serviceName, filePath, bodyOffset, fullContent, warnings, isDebug, kirnetVar) {
  const fields = [];
  const v = escapeForRegex(kirnetVar);
  const lines = tableBody.split("\n");
  let lineOffset = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = stripInlineComment(line.trim());
    if (!trimmed) {
      lineOffset += line.length + 1;
      i++;
      continue;
    }
    const createVarStart = trimmed.match(
      new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateVariable\\s*\\(`)
    );
    if (createVarStart) {
      const fieldName = createVarStart[1];
      const absOffset = bodyOffset + lineOffset;
      const actualIdx = fullContent.indexOf("CreateVariable", absOffset);
      if (actualIdx !== -1) {
        const parenOpen = fullContent.indexOf("(", actualIdx);
        if (parenOpen !== -1) {
          const parenClose = findMatchingParen(fullContent, parenOpen);
          if (parenClose !== -1) {
            const afterParen = fullContent.substring(parenClose + 1);
            const castMatch = afterParen.match(
              new RegExp(`^[\\s\\n]*::[\\s\\n]*(?:${v}[\\s\\n]*\\.[\\s\\n]*)?Variable[\\s\\n]*<`)
            );
            let varField;
            let exprEnd;
            if (castMatch) {
              const angleOpen = parenClose + 1 + castMatch[0].length - 1;
              const angleClose = findMatchingAngle(fullContent, angleOpen);
              if (angleClose !== -1) {
                const typeArg = fullContent.substring(angleOpen + 1, angleClose).replace(/[\s\n]+/g, " ").trim();
                varField = { name: fieldName, type: `Variable<${typeArg}>` };
                exprEnd = angleClose + 1;
              } else {
                varField = { name: fieldName, type: "Variable<any>" };
                exprEnd = parenClose + 1;
              }
            } else {
              const initValue = fullContent.substring(parenOpen + 1, parenClose).trim();
              const inferredType = inferLiteralType(initValue);
              varField = { name: fieldName, type: `Variable<${inferredType}>` };
              exprEnd = parenClose + 1;
            }
            fields.push(varField);
            if (isDebug) {
              debug(`  ${serviceName}.${varField.name} \u2192 ${varField.type}`, true);
            }
            while (i < lines.length && bodyOffset + lineOffset < exprEnd) {
              lineOffset += lines[i].length + 1;
              i++;
            }
            continue;
          }
        }
      }
    }
    const createSignalStart = trimmed.match(
      new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*(?:CreateServerSignal|CreateClientSignal|CreateSignal)\\s*\\(`)
    );
    if (createSignalStart) {
      const fieldName = createSignalStart[1];
      const absOffset = bodyOffset + lineOffset;
      const csIdx = fullContent.search(new RegExp(`(?:CreateServerSignal|CreateClientSignal|CreateSignal)`, "g"));
      const actualIdx = fullContent.indexOf("Create", absOffset);
      if (actualIdx !== -1) {
        const parenOpen = fullContent.indexOf("(", actualIdx);
        if (parenOpen !== -1) {
          const parenClose = findMatchingParen(fullContent, parenOpen);
          if (parenClose !== -1) {
            const afterParen = fullContent.substring(parenClose + 1);
            const castMatch = afterParen.match(
              new RegExp(`^[\\s\\n]*::[\\s\\n]*(?:${v}[\\s\\n]*\\.[\\s\\n]*)?(?:ServerSignal|ClientSignal|Signal)[\\s\\n]*<`)
            );
            let signalField;
            let exprEnd;
            if (castMatch) {
              const angleOpen = parenClose + 1 + castMatch[0].length - 1;
              const angleClose = findMatchingAngle(fullContent, angleOpen);
              if (angleClose !== -1) {
                const typeArgs = fullContent.substring(angleOpen + 1, angleClose).replace(/[\s\n]+/g, " ").trim();
                const castText = castMatch[0];
                let signalTypeName = "Signal";
                if (castText.includes("ClientSignal")) {
                  signalTypeName = "ClientSignal";
                } else if (castText.includes("ServerSignal")) {
                  signalTypeName = "ServerSignal";
                } else if (castText.includes("Signal")) {
                  const constructorText = fullContent.substring(absOffset, parenOpen);
                  const optionsText = fullContent.substring(parenOpen + 1, parenClose);
                  signalTypeName = inferSignalKindFromConstructor(constructorText, optionsText);
                }
                signalField = { name: fieldName, type: `${signalTypeName}<${typeArgs}>` };
                exprEnd = angleClose + 1;
              } else {
                const constructorText = fullContent.substring(absOffset, parenOpen);
                const optionsText = fullContent.substring(parenOpen + 1, parenClose);
                const fallbackType = inferSignalKindFromConstructor(constructorText, optionsText);
                signalField = { name: fieldName, type: `${fallbackType}<any>` };
                exprEnd = parenClose + 1;
              }
            } else {
              const constructorText = fullContent.substring(absOffset, parenOpen);
              const optionsText = fullContent.substring(parenOpen + 1, parenClose);
              const untypedType = inferSignalKindFromConstructor(constructorText, optionsText);
              signalField = { name: fieldName, type: `${untypedType}<any>` };
              exprEnd = parenClose + 1;
            }
            fields.push(signalField);
            if (isDebug) {
              debug(`  ${serviceName}.${signalField.name} \u2192 ${signalField.type}`, true);
            }
            while (i < lines.length && bodyOffset + lineOffset < exprEnd) {
              lineOffset += lines[i].length + 1;
              i++;
            }
            continue;
          }
        }
      }
    }
    const createFuncStart = trimmed.match(
      new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*(?:CreateServerFunction|CreateFunction)\\s*\\(`)
    );
    if (createFuncStart) {
      const fieldName = createFuncStart[1];
      const absOffset = bodyOffset + lineOffset;
      const cfIdx = fullContent.search(new RegExp(`(?:CreateServerFunction|CreateFunction)`, "g"));
      const actualCfIdx = fullContent.indexOf("Create", absOffset);
      if (actualCfIdx !== -1) {
        const outerParenOpen = fullContent.indexOf("(", actualCfIdx);
        if (outerParenOpen !== -1) {
          const outerParenClose = findMatchingParen(fullContent, outerParenOpen);
          if (outerParenClose !== -1) {
            const inner = fullContent.substring(outerParenOpen + 1, outerParenClose);
            const funcSigMatch = inner.match(/function\s*\(([^)]*)\)/);
            if (funcSigMatch) {
              const sigEnd = inner.indexOf(")", inner.indexOf("function"));
              const afterSig = inner.substring(sigEnd + 1);
              const retMatch = afterSig.match(/^\s*:\s*([^\n]+)/);
              let funcField;
              if (retMatch) {
                const returnType = retMatch[1].replace(/\s*,?\s*$/, "").trim();
                funcField = { name: fieldName, type: `ServerFunction<${returnType}>` };
              } else {
                funcField = { name: fieldName, type: "ServerFunction<any>" };
              }
              fields.push(funcField);
              if (isDebug) {
                debug(`  ${serviceName}.${funcField.name} \u2192 ${funcField.type}`, true);
              }
              const exprEnd = outerParenClose + 1;
              while (i < lines.length && bodyOffset + lineOffset < exprEnd) {
                lineOffset += lines[i].length + 1;
                i++;
              }
              continue;
            }
          }
        }
      }
    }
    const field = tryParseField(trimmed, serviceName, filePath, bodyOffset + lineOffset, fullContent, warnings, kirnetVar);
    if (field) {
      fields.push(field);
      if (isDebug) {
        debug(`  ${serviceName}.${field.name} \u2192 ${field.type}`, true);
      }
      if (/\bfunction\s*\(/.test(trimmed) && !/\bend\b/.test(trimmed)) {
        const endIdx = skipToMatchingEnd(lines, i);
        for (let j = i + 1; j <= endIdx; j++) {
          lineOffset += lines[j].length + 1;
        }
      }
      lineOffset += line.length + 1;
      i = /\bfunction\s*\(/.test(trimmed) && !/\bend\b/.test(trimmed) ? skipToMatchingEnd(lines, i) + 1 : i + 1;
      continue;
    }
    const bareFuncMatch = trimmed.match(
      /^(\w+)\s*=\s*function\s*\(([^)]*)\)\s*(?::\s*(.+?))?$/
    );
    if (bareFuncMatch) {
      const funcField = parseBareFunction(
        bareFuncMatch[1],
        bareFuncMatch[2],
        bareFuncMatch[3],
        serviceName,
        filePath,
        bodyOffset + lineOffset,
        fullContent,
        warnings
      );
      if (funcField) {
        fields.push(funcField);
        if (isDebug) {
          debug(`  ${serviceName}.${funcField.name} \u2192 ${funcField.type}`, true);
        }
      }
      const endIdx = skipToMatchingEnd(lines, i);
      for (let j = i; j <= endIdx; j++) {
        lineOffset += lines[j].length + 1;
      }
      i = endIdx + 1;
      continue;
    }
    const nestedTableMatch = trimmed.match(/^(\w+)\s*=\s*\{/);
    if (nestedTableMatch) {
      const absBracePos = bodyOffset + lineOffset + line.indexOf("{");
      const nested = extractTableBody(fullContent, absBracePos);
      if (nested) {
        const nestedFields = parseDefinitionTable(
          nested.text,
          serviceName,
          filePath,
          nested.startOffset,
          fullContent,
          warnings,
          isDebug,
          kirnetVar
        );
        fields.push(...nestedFields);
        const closingBracePos = nested.startOffset + nested.text.length;
        while (i < lines.length) {
          lineOffset += lines[i].length + 1;
          i++;
          if (bodyOffset + lineOffset > closingBracePos) {
            break;
          }
        }
        continue;
      }
    }
    lineOffset += line.length + 1;
    i++;
  }
  return fields;
}
function parseBareFunction(name, paramsRaw, returnTypeRaw, serviceName, filePath, offsetInContent, fullContent, warnings) {
  if (!returnTypeRaw) {
    return { name, type: "ServerFunction<any>" };
  }
  const returnType = returnTypeRaw.replace(/\s*,?\s*$/, "").trim();
  return { name, type: `ServerFunction<${returnType}>` };
}
function skipToMatchingEnd(lines, startLine) {
  let depth = 0;
  let inBlockComment = false;
  let blockCloseTag = "]]";
  for (let i = startLine; i < lines.length; i++) {
    let line = lines[i];
    if (inBlockComment) {
      const closeIdx = line.indexOf(blockCloseTag);
      if (closeIdx === -1) continue;
      line = line.substring(closeIdx + blockCloseTag.length);
      inBlockComment = false;
    }
    line = line.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, "");
    const blockStart = line.match(/--\[(=*)\[/);
    if (blockStart) {
      line = line.substring(0, blockStart.index);
      inBlockComment = true;
      blockCloseTag = `]${blockStart[1]}]`;
    }
    const stripped = line.replace(/--.*$/, "").trim();
    const noStrings = stripped.replace(/"[^"]*"|'[^']*'/g, "");
    const words = noStrings.split(/\W+/);
    for (const word of words) {
      if (word === "function" || word === "if" || word === "for" || word === "while") {
        depth++;
      } else if (word === "end") {
        depth--;
        if (depth <= 0) {
          return i;
        }
      } else if (word === "repeat") {
        depth++;
      } else if (word === "until") {
        depth--;
        if (depth <= 0) {
          return i;
        }
      }
    }
  }
  return lines.length - 1;
}
function tryParseField(line, serviceName, filePath, offsetInContent, fullContent, warnings, kirnetVar) {
  const v = escapeForRegex(kirnetVar);
  const typedVarMatch = line.match(
    new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateVariable\\s*\\(.*?\\)\\s*::\\s*(?:${v}\\s*\\.\\s*)?Variable\\s*<(.+)>\\s*,?\\s*$`)
  );
  if (typedVarMatch) {
    const name = typedVarMatch[1];
    const typeArg = typedVarMatch[2].trim();
    return { name, type: `Variable<${typeArg}>` };
  }
  const untypedVarMatch = line.match(
    new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateVariable\\s*\\((.+?)\\)\\s*,?\\s*$`)
  );
  if (untypedVarMatch) {
    const name = untypedVarMatch[1];
    const inferredType = inferLiteralType(untypedVarMatch[2].trim());
    return { name, type: `Variable<${inferredType}>` };
  }
  const typedSignalMatch = line.match(
    new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*(?:CreateServerSignal|CreateClientSignal|CreateSignal)\\s*\\(.*?\\)\\s*::\\s*((?:${v}\\s*\\.\\s*)?(?:ServerSignal|ClientSignal|Signal)\\s*<(.+)>)\\s*,?\\s*$`)
  );
  if (typedSignalMatch) {
    const name = typedSignalMatch[1];
    const rawType = typedSignalMatch[2];
    let type = rawType.replace(/\s+/g, " ").replace(new RegExp(`${v}\\s*\\.\\s*`, "g"), "").trim();
    if (type.startsWith("Signal<")) {
      const innerType = typedSignalMatch[3];
      const kind = inferSignalKindFromConstructor(line, line);
      if (kind !== "Signal") {
        type = `${kind}<${innerType}>`;
      }
    }
    return { name, type };
  }
  const untypedSignalMatch = line.match(
    new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*(?:CreateServerSignal|CreateClientSignal|CreateSignal)\\s*\\(.*?\\)\\s*,?\\s*$`)
  );
  if (untypedSignalMatch) {
    const name = untypedSignalMatch[1];
    const signalKind = inferSignalKindFromConstructor(line, line);
    return { name, type: `${signalKind}<any>` };
  }
  const funcMatch = line.match(
    new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*(?:CreateServerFunction|CreateFunction)\\s*\\(\\s*function\\s*\\((.+?)\\)`)
  );
  if (funcMatch) {
    const name = funcMatch[1];
    const returnMatch = line.match(/\)\s*:\s*(.+?)$/);
    if (!returnMatch) {
      return { name, type: "ServerFunction<any>" };
    }
    const returnType = returnMatch[1].replace(/\s*,?\s*$/, "").trim();
    return { name, type: `ServerFunction<${returnType}>` };
  }
  const directTypeMatch = line.match(/^(\w+)\s*:\s*(.+?)\s*,?\s*$/);
  if (directTypeMatch) {
    const name = directTypeMatch[1];
    const type = directTypeMatch[2].trim();
    return { name, type };
  }
  return null;
}
function lineAt(content, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") {
      line++;
    }
  }
  return line;
}

// src/generator.ts
function generateTypesContent(services, requirePath) {
  const sorted = [...services].sort((a, b) => a.name.localeCompare(b.name));
  const lines = [];
  lines.push("-- AUTO-GENERATED by KirNet Type Generator");
  lines.push("-- Do not edit manually. This file is overwritten on every save.");
  lines.push("--");
  lines.push("-- Require this module instead of KirNet for fully typed GetService().");
  lines.push("-- All other KirNet methods (CreateSignal, RegisterService, etc.) work as normal.");
  lines.push("");
  lines.push(`local KirNet = require(${requirePath})`);
  lines.push("");
  if (sorted.length === 0) {
    lines.push("return KirNet");
    return lines.join("\n") + "\n";
  }
  lines.push("-- ============================================================");
  lines.push("-- KirNet types (inlined for reliable autocomplete)");
  lines.push("-- ============================================================");
  lines.push("");
  lines.push("type ServerSignal<T...> = {");
  lines.push("	Fire: (self: ServerSignal<T...>, player: Player, T...) -> (),");
  lines.push("	FireAll: (self: ServerSignal<T...>, T...) -> (),");
  lines.push("	FireExcept: (self: ServerSignal<T...>, player: Player, T...) -> (),");
  lines.push("	FireList: (self: ServerSignal<T...>, players: { Player }, T...) -> (),");
  lines.push("	Connect: (self: ServerSignal<T...>, callback: (T...) -> ()) -> (),");
  lines.push("	Once: (self: ServerSignal<T...>, callback: (T...) -> ()) -> (),");
  lines.push("	Wait: (self: ServerSignal<T...>, timeout: number?) -> T...,");
  lines.push("	Disconnect: (self: ServerSignal<T...>) -> (),");
  lines.push("}");
  lines.push("");
  lines.push("type ClientSignal<T...> = {");
  lines.push("	FireServer: (self: ClientSignal<T...>, T...) -> (),");
  lines.push("	OnServerEvent: (self: ClientSignal<T...>, callback: (player: Player, T...) -> ()) -> (),");
  lines.push("}");
  lines.push("");
  lines.push("type Signal<T...> = {");
  lines.push("	Fire: (self: Signal<T...>, player: Player, T...) -> (),");
  lines.push("	FireAll: (self: Signal<T...>, T...) -> (),");
  lines.push("	FireExcept: (self: Signal<T...>, player: Player, T...) -> (),");
  lines.push("	FireList: (self: Signal<T...>, players: { Player }, T...) -> (),");
  lines.push("	FireServer: (self: Signal<T...>, T...) -> (),");
  lines.push("	Connect: (self: Signal<T...>, callback: (T...) -> ()) -> (),");
  lines.push("	Once: (self: Signal<T...>, callback: (T...) -> ()) -> (),");
  lines.push("	Wait: (self: Signal<T...>, timeout: number?) -> T...,");
  lines.push("	Disconnect: (self: Signal<T...>) -> (),");
  lines.push("	OnServerEvent: (self: Signal<T...>, callback: (player: Player, T...) -> ()) -> (),");
  lines.push("}");
  lines.push("");
  lines.push("type ServerFunction<TReturn> = {");
  lines.push("	Call: (self: ServerFunction<TReturn>, ...any) -> TReturn,");
  lines.push("}");
  lines.push("");
  lines.push("type Variable<T> = {");
  lines.push("	Get: (self: Variable<T>) -> T,");
  lines.push("	Set: (self: Variable<T>, value: T) -> (),");
  lines.push("	OnChanged: (self: Variable<T>, callback: (newValue: T, oldValue: T) -> ()) -> (),");
  lines.push("}");
  lines.push("");
  lines.push("-- ============================================================");
  lines.push("-- Service Types");
  lines.push("-- ============================================================");
  lines.push("");
  for (const svc of sorted) {
    const typeName = `${svc.name}Type`;
    lines.push(`export type ${typeName} = {`);
    for (const field of svc.fields) {
      const fieldType = field.type.replace(/\bKirNet\s*\.\s*ServerSignal\s*</g, "ServerSignal<").replace(/\bKirNet\s*\.\s*ClientSignal\s*</g, "ClientSignal<").replace(/\bKirNet\s*\.\s*ServerFunction\s*</g, "ServerFunction<").replace(/\bKirNet\s*\.\s*Signal\s*</g, "Signal<").replace(/\bKirNet\s*\.\s*Function\s*</g, "ServerFunction<").replace(/\bKirNet\s*\.\s*Variable\s*</g, "Variable<");
      lines.push(`	${field.name}: ${fieldType},`);
    }
    lines.push("}");
    lines.push("");
  }
  lines.push("-- ============================================================");
  lines.push("-- Typed KirNet - drop-in replacement with overloaded GetService");
  lines.push("-- ============================================================");
  lines.push("");
  lines.push("type GetServiceOverloads =");
  for (let i = 0; i < sorted.length; i++) {
    const svc = sorted[i];
    const prefix = i === 0 ? "	" : "	& ";
    lines.push(`${prefix}((name: "${svc.name}") -> ${svc.name}Type)`);
  }
  const svcFallbackPrefix = sorted.length === 0 ? "	" : "	& ";
  lines.push(`${svcFallbackPrefix}((name: string) -> { [string]: any })`);
  lines.push("");
  lines.push("type RegisterServiceOverloads =");
  for (let i = 0; i < sorted.length; i++) {
    const svc = sorted[i];
    const prefix = i === 0 ? "	" : "	& ";
    lines.push(`${prefix}((name: "${svc.name}", definition: ${svc.name}Type) -> ${svc.name}Type)`);
  }
  const regFallbackPrefix = sorted.length === 0 ? "	" : "	& ";
  lines.push(`${regFallbackPrefix}((name: string, definition: { [string]: any }) -> { [string]: any })`);
  lines.push("");
  lines.push("type TypedKirNet = {");
  lines.push("	GetService: GetServiceOverloads,");
  lines.push("	RegisterService: RegisterServiceOverloads,");
  lines.push("	CreateSignal: typeof(KirNet.CreateSignal),");
  lines.push("	CreateFunction: typeof(KirNet.CreateFunction),");
  lines.push("	CreateVariable: typeof(KirNet.CreateVariable),");
  lines.push("	UseMiddleware: typeof(KirNet.UseMiddleware),");
  lines.push("	SetDebug: typeof(KirNet.SetDebug),");
  lines.push("}");
  lines.push("");
  lines.push("return (KirNet :: any) :: TypedKirNet");
  return lines.join("\n") + "\n";
}

// src/completions.ts
var vscode2 = __toESM(require("vscode"));
var knownServices = [];
function updateKnownServices(services) {
  knownServices = services;
}
function createCompletionProvider() {
  return {
    provideCompletionItems(document, position) {
      const lineText = document.lineAt(position).text;
      const textBeforeCursor = lineText.substring(0, position.character);
      const pattern = /KirNet\s*[.:]\s*GetService\s*\(\s*["']([^"']*)$/;
      const match = textBeforeCursor.match(pattern);
      if (!match) {
        return void 0;
      }
      const query = match[1];
      const quoteStartPos = position.character - query.length;
      const items = [];
      for (const svc of knownServices) {
        if (query && !fuzzyMatch(query, svc.name)) {
          continue;
        }
        const item = new vscode2.CompletionItem(
          svc.name,
          vscode2.CompletionItemKind.Value
        );
        item.insertText = svc.name;
        const range = new vscode2.Range(
          position.line,
          quoteStartPos,
          position.line,
          position.character
        );
        item.range = range;
        item.detail = `KirNet Service`;
        const docLines = svc.fields.map(
          (f) => `- \`${f.name}\`: \`${f.type}\``
        );
        item.documentation = new vscode2.MarkdownString(
          `**${svc.name}**

` + docLines.join("\n")
        );
        item.sortText = query ? fuzzyScore(query, svc.name).toString().padStart(5, "0") : svc.name;
        items.push(item);
      }
      return items;
    }
  };
}
function fuzzyMatch(query, candidate) {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  let qi = 0;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      qi++;
    }
  }
  return qi === q.length;
}
function fuzzyScore(query, candidate) {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      qi++;
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 0;
    }
  }
  return 1e3 - maxConsecutive * 100 + candidate.length;
}
function registerCompletionProvider(context) {
  const provider = createCompletionProvider();
  context.subscriptions.push(
    vscode2.languages.registerCompletionItemProvider(
      [{ language: "lua" }, { language: "luau" }],
      provider,
      '"',
      "'"
    )
  );
}

// src/watcher.ts
var vscode3 = __toESM(require("vscode"));
var debounceTimer;
function createSaveHandler(onTrigger, isInScope) {
  const sub = vscode3.workspace.onDidSaveTextDocument((doc) => {
    const uri = doc.uri;
    if (!/\.luau?$/.test(uri.fsPath)) {
      return;
    }
    if (!isInScope(uri)) {
      return;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = void 0;
      onTrigger(uri);
    }, 300);
  });
  return {
    dispose() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = void 0;
      }
      sub.dispose();
    }
  };
}

// src/extension.ts
var config;
var workspaceRoot;
var statusBarItem;
var diagnosticCollection;
var extensionEnabled = true;
var extensionContext;
var DEFAULT_GITHUB_README_URL = "https://github.com/MrKirdid/KirNet#readme";
var resolvedEntry = null;
var lastParsedServices = [];
function activate(context) {
  const folders = vscode4.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }
  workspaceRoot = folders[0].uri.fsPath;
  extensionContext = context;
  if (!fs3.existsSync(path3.join(workspaceRoot, "default.project.json"))) {
    return;
  }
  config = readConfig(workspaceRoot);
  log("KirNet Type Generator activated");
  log(`Workspace: ${workspaceRoot}`);
  const storedEnabled = context.workspaceState.get("kirnet.enabled");
  if (storedEnabled !== void 0) {
    extensionEnabled = storedEnabled;
  } else {
    extensionEnabled = fs3.existsSync(path3.join(workspaceRoot, "kirnet.toml"));
  }
  statusBarItem = vscode4.window.createStatusBarItem(vscode4.StatusBarAlignment.Right, 100);
  statusBarItem.command = "kirnet.showOutput";
  context.subscriptions.push(statusBarItem);
  updateStatusBar();
  diagnosticCollection = vscode4.languages.createDiagnosticCollection("kirnet");
  context.subscriptions.push(diagnosticCollection);
  registerCompletionProvider(context);
  context.subscriptions.push(
    vscode4.commands.registerCommand("kirnet.regenerateTypes", () => regenerate("command")),
    vscode4.commands.registerCommand("kirnet.showOutput", () => getChannel().show()),
    vscode4.commands.registerCommand("kirnet.openGithubReadme", () => openGitHubReadmeCommand(context.extension)),
    vscode4.commands.registerCommand("kirnet.openTypesFile", () => {
      const target = resolvedEntry?.entryFile ?? path3.join(workspaceRoot, config.paths.output);
      if (fs3.existsSync(target)) {
        vscode4.window.showTextDocument(vscode4.Uri.file(target));
      } else {
        vscode4.window.showWarningMessage("Types file has not been generated yet.");
      }
    }),
    vscode4.commands.registerCommand("kirnet.reloadConfig", () => {
      config = readConfig(workspaceRoot);
      resolvedEntry = null;
      log("Config reloaded");
      regenerate("config reload");
    }),
    vscode4.commands.registerCommand("kirnet.listServices", () => listServicesCommand()),
    vscode4.commands.registerCommand("kirnet.goToService", () => goToServiceCommand()),
    vscode4.commands.registerCommand("kirnet.restorePackage", () => restorePackageCommand()),
    vscode4.commands.registerCommand("kirnet.createService", () => scaffoldCommand()),
    vscode4.commands.registerCommand("kirnet.init", () => initCommand()),
    vscode4.commands.registerCommand("kirnet.enable", () => setEnabled(true)),
    vscode4.commands.registerCommand("kirnet.disable", () => setEnabled(false))
  );
  const servicesAbsPath = path3.resolve(workspaceRoot, config.paths.services).toLowerCase();
  const controllersAbsPath = config.paths.controllers ? path3.resolve(workspaceRoot, config.paths.controllers).toLowerCase() : null;
  context.subscriptions.push(
    createSaveHandler(
      (uri) => regenerate(`saved: ${path3.relative(workspaceRoot, uri.fsPath)}`),
      (uri) => {
        const fp = uri.fsPath.toLowerCase();
        if (resolvedEntry && fp === resolvedEntry.entryFile.toLowerCase()) {
          return false;
        }
        if (fp.startsWith(servicesAbsPath)) return true;
        if (controllersAbsPath && fp.startsWith(controllersAbsPath)) return true;
        return false;
      }
    )
  );
  for (const pattern of [
    "{Packages,ServerPackages,DevPackages}/{kirnet,KirNet}.{luau,lua}",
    "{Packages,ServerPackages,DevPackages}/{kirnet,KirNet}/init.{luau,lua}",
    "{Packages,ServerPackages,DevPackages}/_Index/*kirnet*/**/init.{luau,lua}"
  ]) {
    const glob = new vscode4.RelativePattern(workspaceRoot, pattern);
    const watcher = vscode4.workspace.createFileSystemWatcher(glob);
    const handler = () => {
      log("Detected KirNet package file change \u2014 re-injecting...");
      resolvedEntry = null;
      regenerate("packages changed");
    };
    watcher.onDidChange(handler);
    watcher.onDidCreate(handler);
    context.subscriptions.push(watcher);
  }
  regenerate("session start");
}
function findKirNetEntry() {
  log("Searching for KirNet package...");
  if (config.paths.kirnet_package) {
    const target = path3.resolve(workspaceRoot, config.paths.kirnet_package);
    log(`  Checking configured path: ${target}`);
    const result2 = probeExplicit(target);
    if (result2) {
      return result2;
    }
    warn(`  Configured kirnet_package not found or not valid`);
  }
  for (const root of ["Packages", "ServerPackages", "DevPackages"]) {
    const packagesDir = path3.join(workspaceRoot, root);
    if (!fs3.existsSync(packagesDir)) {
      continue;
    }
    log(`  Scanning ${root}/`);
    const proxy = probeProxyFile(packagesDir);
    if (proxy) {
      return proxy;
    }
    const dirMod = probeDirModule(packagesDir);
    if (dirMod) {
      return dirMod;
    }
    const idx = probeIndex(packagesDir);
    if (idx) {
      return idx;
    }
  }
  const outputDir = path3.resolve(workspaceRoot, path3.dirname(config.paths.output));
  const result = probeExplicit(outputDir);
  if (result) {
    return result;
  }
  warn(
    'Could not find KirNet package.\n  Searched: Packages/kirnet.luau, Packages/kirnet/init.luau, _Index/*kirnet*\n  Fix: add [paths] kirnet_package = "Packages/kirnet" in kirnet.toml'
  );
  return null;
}
function probeExplicit(target) {
  if (!fs3.existsSync(target)) {
    return null;
  }
  const stat = fs3.statSync(target);
  if (stat.isFile()) {
    return probeFile(target);
  }
  if (stat.isDirectory()) {
    for (const ext of [".luau", ".lua"]) {
      const init = path3.join(target, `init${ext}`);
      if (fs3.existsSync(init)) {
        return probeFile(init);
      }
    }
  }
  return null;
}
function probeFile(filePath) {
  let content;
  try {
    content = fs3.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  if (content.includes("AUTO-GENERATED by KirNet Type Generator")) {
    const reqMatch = content.match(/^local KirNet = require\((.+)\)$/m);
    if (reqMatch) {
      const expr = reqMatch[1].trim();
      const isProxy = expr !== "script._KirNetImpl";
      log(`    Found existing injection: ${path3.basename(filePath)} (${isProxy ? "proxy" : "source"})`);
      return {
        entryFile: filePath,
        requireExpr: expr,
        kind: isProxy ? "proxy" : "source"
      };
    }
  }
  const proxyMatch = content.match(/^\s*return\s+require\(([^)]+)\)\s*$/m);
  const codeLines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("--")).length;
  if (proxyMatch && codeLines <= 3) {
    log(`    Proxy file: ${path3.basename(filePath)} \u2192 ${proxyMatch[1].trim()}`);
    return {
      entryFile: filePath,
      requireExpr: proxyMatch[1].trim(),
      kind: "proxy"
    };
  }
  if (content.includes("GetService") && content.includes("RegisterService")) {
    log(`    KirNet source: ${path3.basename(filePath)}`);
    return {
      entryFile: filePath,
      requireExpr: "script._KirNetImpl",
      kind: "source"
    };
  }
  return null;
}
function probeProxyFile(packagesDir) {
  try {
    for (const entry of fs3.readdirSync(packagesDir)) {
      const lower = entry.toLowerCase();
      if (lower === "kirnet.luau" || lower === "kirnet.lua") {
        const fp = path3.join(packagesDir, entry);
        try {
          if (fs3.statSync(fp).isFile()) {
            return probeFile(fp);
          }
        } catch {
        }
      }
    }
  } catch {
  }
  return null;
}
function probeDirModule(packagesDir) {
  try {
    for (const entry of fs3.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.toLowerCase() !== "kirnet") {
        continue;
      }
      const dir = path3.join(packagesDir, entry.name);
      for (const ext of [".luau", ".lua"]) {
        const init = path3.join(dir, `init${ext}`);
        if (fs3.existsSync(init)) {
          return probeFile(init);
        }
      }
    }
  } catch {
  }
  return null;
}
function probeIndex(packagesDir) {
  const indexDir = path3.join(packagesDir, "_Index");
  if (!fs3.existsSync(indexDir)) {
    return null;
  }
  try {
    for (const vendor of fs3.readdirSync(indexDir, { withFileTypes: true })) {
      if (!vendor.isDirectory() || !vendor.name.toLowerCase().includes("kirnet")) {
        continue;
      }
      const vendorDir = path3.join(indexDir, vendor.name);
      try {
        for (const pkg of fs3.readdirSync(vendorDir, { withFileTypes: true })) {
          if (!pkg.isDirectory() || pkg.name.toLowerCase() !== "kirnet") {
            continue;
          }
          const dir = path3.join(vendorDir, pkg.name);
          for (const ext of [".luau", ".lua"]) {
            const init = path3.join(dir, `init${ext}`);
            if (fs3.existsSync(init)) {
              return probeFile(init);
            }
          }
        }
      } catch {
      }
    }
  } catch {
  }
  return null;
}
function ensureBackup(entry) {
  if (entry.kind !== "source") {
    return;
  }
  const dir = path3.dirname(entry.entryFile);
  const backupPath = path3.join(dir, "_KirNetImpl.luau");
  if (fs3.existsSync(backupPath)) {
    return;
  }
  const content = fs3.readFileSync(entry.entryFile, "utf-8");
  if (content.includes("AUTO-GENERATED by KirNet Type Generator")) {
    warn("Init is already generated but _KirNetImpl.luau backup is missing.");
    return;
  }
  log(`Backing up ${path3.basename(entry.entryFile)} \u2192 _KirNetImpl.luau`);
  fs3.copyFileSync(entry.entryFile, backupPath);
}
async function regenerate(trigger) {
  if (!extensionEnabled) {
    log(`Skipped regeneration (disabled) \u2014 trigger: ${trigger}`);
    return;
  }
  statusBarItem.text = "$(sync~spin) KirNet Types";
  log(`--- Regenerating (trigger: ${trigger}) ---`);
  try {
    const scanPaths = [config.paths.services];
    if (config.paths.controllers) {
      scanPaths.push(config.paths.controllers);
    }
    const result = parseAll(
      workspaceRoot,
      scanPaths,
      config.options.debug
    );
    log(`Found ${result.services.length} service(s)`);
    for (const svc of result.services) {
      log(`  ${svc.name}: ${svc.fields.map((f) => f.name).join(", ")}`);
    }
    for (const w of result.warnings) {
      warn(`${path3.relative(workspaceRoot, w.filePath)}:${w.line} \u2014 ${w.message}`);
    }
    resolvedEntry = findKirNetEntry();
    let requirePath;
    let outputAbsPath;
    if (resolvedEntry) {
      ensureBackup(resolvedEntry);
      requirePath = resolvedEntry.requireExpr;
      outputAbsPath = resolvedEntry.entryFile;
      log(`Injection mode (${resolvedEntry.kind}): ${path3.relative(workspaceRoot, outputAbsPath)}`);
      log(`  require = ${requirePath}`);
    } else {
      requirePath = config.options.kirnet_require_path;
      outputAbsPath = path3.resolve(workspaceRoot, config.paths.output);
      log(`Standalone mode: ${config.paths.output}`);
    }
    const content = generateTypesContent(result.services, requirePath);
    const outputDir = path3.dirname(outputAbsPath);
    fs3.mkdirSync(outputDir, { recursive: true });
    const existing = fs3.existsSync(outputAbsPath) ? fs3.readFileSync(outputAbsPath, "utf-8") : "";
    if (existing !== content) {
      const outputUri = vscode4.Uri.file(outputAbsPath);
      await vscode4.workspace.fs.writeFile(outputUri, Buffer.from(content, "utf-8"));
    }
    lastParsedServices = result.services;
    updateKnownServices(result.services);
    updateDiagnostics(result);
    if (result.warnings.length > 0) {
      statusBarItem.text = "$(warning) KirNet Types";
      statusBarItem.tooltip = `${result.warnings.length} warning(s) \u2014 click to view`;
    } else {
      statusBarItem.text = "$(check) KirNet Types";
      const mode = resolvedEntry ? `injected (${resolvedEntry.kind})` : "standalone";
      statusBarItem.tooltip = `${result.services.length} service(s) \u2014 ${mode}`;
    }
    log("Generation complete");
  } catch (e) {
    error(`Generation failed: ${e.message}
${e.stack ?? ""}`);
    statusBarItem.text = "$(error) KirNet Types";
    statusBarItem.tooltip = "Generation failed \u2014 click to view";
  }
}
function updateDiagnostics(result) {
  diagnosticCollection.clear();
  const byFile = /* @__PURE__ */ new Map();
  for (const w of result.warnings) {
    const uri = w.filePath;
    if (!byFile.has(uri)) {
      byFile.set(uri, []);
    }
    const line = Math.max(0, w.line - 1);
    const diag = new vscode4.Diagnostic(
      new vscode4.Range(line, 0, line, 1e3),
      w.message,
      vscode4.DiagnosticSeverity.Warning
    );
    diag.source = "KirNet";
    byFile.get(uri).push(diag);
  }
  for (const [filePath, diags] of byFile) {
    diagnosticCollection.set(vscode4.Uri.file(filePath), diags);
  }
}
function getGitHubReadmeUrl(extension) {
  const homepage = extension.packageJSON.homepage;
  if (typeof homepage === "string" && homepage.trim().length > 0) {
    return homepage;
  }
  return DEFAULT_GITHUB_README_URL;
}
async function openGitHubReadmeCommand(extension) {
  const url = getGitHubReadmeUrl(extension);
  const didOpen = await vscode4.env.openExternal(vscode4.Uri.parse(url));
  if (!didOpen) {
    vscode4.window.showWarningMessage("Could not open the KirNet GitHub README.");
    return;
  }
  log(`Opened GitHub README: ${url}`);
}
async function listServicesCommand() {
  if (lastParsedServices.length === 0) {
    vscode4.window.showInformationMessage("No services detected yet.");
    return;
  }
  const items = lastParsedServices.map((svc) => ({
    label: `$(symbol-class) ${svc.name}`,
    description: "service",
    detail: svc.fields.map((f) => `${f.name}: ${f.type}`).join(", ")
  }));
  await vscode4.window.showQuickPick(items, {
    title: "KirNet Services",
    placeHolder: "Browse registered services"
  });
}
async function goToServiceCommand() {
  if (lastParsedServices.length === 0) {
    vscode4.window.showInformationMessage("No services detected yet.");
    return;
  }
  const items = lastParsedServices.map((svc) => ({
    label: svc.name,
    description: `service \u2014 ${path3.relative(workspaceRoot, svc.filePath)}`,
    filePath: svc.filePath
  }));
  const picked = await vscode4.window.showQuickPick(items, {
    title: "Jump to Service Definition",
    placeHolder: "Select a service to open"
  });
  if (picked) {
    const doc = await vscode4.workspace.openTextDocument(picked.filePath);
    const text = doc.getText();
    const registerPattern = new RegExp(
      `RegisterService\\s*\\(\\s*["']${picked.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`
    );
    const match = registerPattern.exec(text);
    const pos = match ? doc.positionAt(match.index) : new vscode4.Position(0, 0);
    await vscode4.window.showTextDocument(doc, {
      selection: new vscode4.Range(pos, pos)
    });
  }
}
async function restorePackageCommand() {
  if (!resolvedEntry) {
    vscode4.window.showWarningMessage("No KirNet package injection found to restore.");
    return;
  }
  if (resolvedEntry.kind === "source") {
    const backupPath = path3.join(path3.dirname(resolvedEntry.entryFile), "_KirNetImpl.luau");
    if (!fs3.existsSync(backupPath)) {
      vscode4.window.showWarningMessage("Backup file _KirNetImpl.luau not found \u2014 cannot restore.");
      return;
    }
    const confirm = await vscode4.window.showWarningMessage(
      "Restore original KirNet init.luau from backup? This will remove typed overloads.",
      "Restore",
      "Cancel"
    );
    if (confirm !== "Restore") {
      return;
    }
    fs3.copyFileSync(backupPath, resolvedEntry.entryFile);
    fs3.unlinkSync(backupPath);
    resolvedEntry = null;
    log("Restored original KirNet package from backup.");
    vscode4.window.showInformationMessage("KirNet package restored to original.");
  } else {
    const confirm = await vscode4.window.showWarningMessage(
      "Restore original KirNet proxy file? This will remove typed overloads.",
      "Restore",
      "Cancel"
    );
    if (confirm !== "Restore") {
      return;
    }
    const content = `return require(${resolvedEntry.requireExpr})
`;
    fs3.writeFileSync(resolvedEntry.entryFile, content, "utf-8");
    resolvedEntry = null;
    log("Restored original KirNet proxy file.");
    vscode4.window.showInformationMessage("KirNet proxy file restored to original.");
  }
}
async function scaffoldCommand() {
  const dir = path3.resolve(workspaceRoot, config.paths.services);
  const name = await vscode4.window.showInputBox({
    title: "New KirNet Service",
    prompt: "Enter the service name (e.g. CombatService)",
    validateInput: (value) => {
      if (!value || !/^[A-Z]\w*$/.test(value)) {
        return "Name must start with an uppercase letter and contain only word characters";
      }
      return void 0;
    }
  });
  if (!name) {
    return;
  }
  const filePath = path3.join(dir, `${name}.luau`);
  if (fs3.existsSync(filePath)) {
    vscode4.window.showWarningMessage(`File already exists: ${path3.relative(workspaceRoot, filePath)}`);
    return;
  }
  const content = [
    "--!strict",
    "",
    `local KirNet = require(game:GetService("ReplicatedStorage").Shared.Packages.kirnet)`,
    "",
    `KirNet.RegisterService("${name}", {`,
    `	ExampleBroadcast = KirNet.CreateSignal({ direction = "server" }) :: KirNet.Signal<string>,`,
    `	ExampleEvent = KirNet.CreateSignal({ direction = "client" }) :: KirNet.Signal<string>,`,
    "})",
    ""
  ].join("\n");
  fs3.mkdirSync(path3.dirname(filePath), { recursive: true });
  fs3.writeFileSync(filePath, content, "utf-8");
  const doc = await vscode4.workspace.openTextDocument(filePath);
  await vscode4.window.showTextDocument(doc);
  log(`Created service: ${path3.relative(workspaceRoot, filePath)}`);
}
async function initCommand() {
  const configPath = path3.join(workspaceRoot, "kirnet.toml");
  if (fs3.existsSync(configPath)) {
    const overwrite = await vscode4.window.showWarningMessage(
      "kirnet.toml already exists. Overwrite?",
      "Overwrite",
      "Cancel"
    );
    if (overwrite !== "Overwrite") {
      return;
    }
  }
  const content = [
    "[paths]",
    'services = "src/Server/Services"',
    'controllers = "src/Shared/Controllers"',
    'output = "src/ReplicatedStorage/Shared/Packages/KirNet/Types.luau"',
    'kirnet_package = ""',
    "",
    "[options]",
    `kirnet_require_path = 'game:GetService("ReplicatedStorage").Shared.Packages.KirNet'`,
    "debug = false",
    ""
  ].join("\n");
  fs3.writeFileSync(configPath, content, "utf-8");
  log("Created kirnet.toml");
  config = readConfig(workspaceRoot);
  resolvedEntry = null;
  await setEnabled(true);
  const doc = await vscode4.workspace.openTextDocument(configPath);
  await vscode4.window.showTextDocument(doc);
  vscode4.window.showInformationMessage("KirNet initialized \u2014 edit kirnet.toml to match your project.");
}
async function setEnabled(enabled) {
  extensionEnabled = enabled;
  await extensionContext.workspaceState.update("kirnet.enabled", enabled);
  updateStatusBar();
  log(`KirNet ${enabled ? "enabled" : "disabled"}`);
  vscode4.window.showInformationMessage(`KirNet type generation ${enabled ? "enabled" : "disabled"}.`);
  if (enabled) {
    regenerate("enabled");
  }
}
function updateStatusBar() {
  if (!extensionEnabled) {
    statusBarItem.text = "$(circle-slash) KirNet (disabled)";
    statusBarItem.tooltip = "KirNet type generation is disabled. Run 'KirNet: Enable' to turn it on.";
    statusBarItem.show();
  } else {
    statusBarItem.text = "$(check) KirNet Types";
    statusBarItem.show();
  }
}
function deactivate() {
  dispose();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
