/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 99);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

var store = __webpack_require__(25)('wks');
var uid = __webpack_require__(24);
var Symbol = __webpack_require__(1).Symbol;
var USE_SYMBOL = typeof Symbol == 'function';

var $exports = module.exports = function (name) {
  return store[name] || (store[name] =
    USE_SYMBOL && Symbol[name] || (USE_SYMBOL ? Symbol : uid)('Symbol.' + name));
};

$exports.store = store;


/***/ }),
/* 1 */
/***/ (function(module, exports) {

// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global = module.exports = typeof window != 'undefined' && window.Math == Math
  ? window : typeof self != 'undefined' && self.Math == Math ? self
  // eslint-disable-next-line no-new-func
  : Function('return this')();
if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(5);
module.exports = function (it) {
  if (!isObject(it)) throw TypeError(it + ' is not an object!');
  return it;
};


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

// Thank's IE8 for his funny defineProperty
module.exports = !__webpack_require__(6)(function () {
  return Object.defineProperty({}, 'a', { get: function () { return 7; } }).a != 7;
});


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(1);
var core = __webpack_require__(13);
var hide = __webpack_require__(11);
var redefine = __webpack_require__(8);
var ctx = __webpack_require__(14);
var PROTOTYPE = 'prototype';

var $export = function (type, name, source) {
  var IS_FORCED = type & $export.F;
  var IS_GLOBAL = type & $export.G;
  var IS_STATIC = type & $export.S;
  var IS_PROTO = type & $export.P;
  var IS_BIND = type & $export.B;
  var target = IS_GLOBAL ? global : IS_STATIC ? global[name] || (global[name] = {}) : (global[name] || {})[PROTOTYPE];
  var exports = IS_GLOBAL ? core : core[name] || (core[name] = {});
  var expProto = exports[PROTOTYPE] || (exports[PROTOTYPE] = {});
  var key, own, out, exp;
  if (IS_GLOBAL) source = name;
  for (key in source) {
    // contains in native
    own = !IS_FORCED && target && target[key] !== undefined;
    // export native or passed
    out = (own ? target : source)[key];
    // bind timers to global for call from export context
    exp = IS_BIND && own ? ctx(out, global) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
    // extend global
    if (target) redefine(target, key, out, type & $export.U);
    // export
    if (exports[key] != out) hide(exports, key, exp);
    if (IS_PROTO && expProto[key] != out) expProto[key] = out;
  }
};
global.core = core;
// type bitmap
$export.F = 1;   // forced
$export.G = 2;   // global
$export.S = 4;   // static
$export.P = 8;   // proto
$export.B = 16;  // bind
$export.W = 32;  // wrap
$export.U = 64;  // safe
$export.R = 128; // real proto method for `library`
module.exports = $export;


/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = function (it) {
  return typeof it === 'object' ? it !== null : typeof it === 'function';
};


/***/ }),
/* 6 */
/***/ (function(module, exports) {

module.exports = function (exec) {
  try {
    return !!exec();
  } catch (e) {
    return true;
  }
};


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(2);
var IE8_DOM_DEFINE = __webpack_require__(34);
var toPrimitive = __webpack_require__(23);
var dP = Object.defineProperty;

exports.f = __webpack_require__(3) ? Object.defineProperty : function defineProperty(O, P, Attributes) {
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if (IE8_DOM_DEFINE) try {
    return dP(O, P, Attributes);
  } catch (e) { /* empty */ }
  if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
  if ('value' in Attributes) O[P] = Attributes.value;
  return O;
};


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(1);
var hide = __webpack_require__(11);
var has = __webpack_require__(12);
var SRC = __webpack_require__(24)('src');
var $toString = __webpack_require__(63);
var TO_STRING = 'toString';
var TPL = ('' + $toString).split(TO_STRING);

__webpack_require__(13).inspectSource = function (it) {
  return $toString.call(it);
};

(module.exports = function (O, key, val, safe) {
  var isFunction = typeof val == 'function';
  if (isFunction) has(val, 'name') || hide(val, 'name', key);
  if (O[key] === val) return;
  if (isFunction) has(val, SRC) || hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key)));
  if (O === global) {
    O[key] = val;
  } else if (!safe) {
    delete O[key];
    hide(O, key, val);
  } else if (O[key]) {
    O[key] = val;
  } else {
    hide(O, key, val);
  }
// add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
})(Function.prototype, TO_STRING, function toString() {
  return typeof this == 'function' && this[SRC] || $toString.call(this);
});


/***/ }),
/* 9 */
/***/ (function(module, exports) {

// 7.2.1 RequireObjectCoercible(argument)
module.exports = function (it) {
  if (it == undefined) throw TypeError("Can't call method on  " + it);
  return it;
};


/***/ }),
/* 10 */
/***/ (function(module, exports) {

var toString = {}.toString;

module.exports = function (it) {
  return toString.call(it).slice(8, -1);
};


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

var dP = __webpack_require__(7);
var createDesc = __webpack_require__(30);
module.exports = __webpack_require__(3) ? function (object, key, value) {
  return dP.f(object, key, createDesc(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};


/***/ }),
/* 12 */
/***/ (function(module, exports) {

var hasOwnProperty = {}.hasOwnProperty;
module.exports = function (it, key) {
  return hasOwnProperty.call(it, key);
};


/***/ }),
/* 13 */
/***/ (function(module, exports) {

var core = module.exports = { version: '2.6.9' };
if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

// optional / simple context binding
var aFunction = __webpack_require__(15);
module.exports = function (fn, that, length) {
  aFunction(fn);
  if (that === undefined) return fn;
  switch (length) {
    case 1: return function (a) {
      return fn.call(that, a);
    };
    case 2: return function (a, b) {
      return fn.call(that, a, b);
    };
    case 3: return function (a, b, c) {
      return fn.call(that, a, b, c);
    };
  }
  return function (/* ...args */) {
    return fn.apply(that, arguments);
  };
};


/***/ }),
/* 15 */
/***/ (function(module, exports) {

module.exports = function (it) {
  if (typeof it != 'function') throw TypeError(it + ' is not a function!');
  return it;
};


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

// 7.1.15 ToLength
var toInteger = __webpack_require__(17);
var min = Math.min;
module.exports = function (it) {
  return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
};


/***/ }),
/* 17 */
/***/ (function(module, exports) {

// 7.1.4 ToInteger
var ceil = Math.ceil;
var floor = Math.floor;
module.exports = function (it) {
  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
};


/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

// getting tag from 19.1.3.6 Object.prototype.toString()
var cof = __webpack_require__(10);
var TAG = __webpack_require__(0)('toStringTag');
// ES3 wrong here
var ARG = cof(function () { return arguments; }()) == 'Arguments';

// fallback for IE11 Script Access Denied error
var tryGet = function (it, key) {
  try {
    return it[key];
  } catch (e) { /* empty */ }
};

module.exports = function (it) {
  var O, T, B;
  return it === undefined ? 'Undefined' : it === null ? 'Null'
    // @@toStringTag case
    : typeof (T = tryGet(O = Object(it), TAG)) == 'string' ? T
    // builtinTag case
    : ARG ? cof(O)
    // ES3 arguments fallback
    : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
};


/***/ }),
/* 19 */
/***/ (function(module, exports) {

module.exports = {};


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var $export = __webpack_require__(4);
var aFunction = __webpack_require__(15);
var toObject = __webpack_require__(42);
var fails = __webpack_require__(6);
var $sort = [].sort;
var test = [1, 2, 3];

$export($export.P + $export.F * (fails(function () {
  // IE8-
  test.sort(undefined);
}) || !fails(function () {
  // V8 bug
  test.sort(null);
  // Old WebKit
}) || !__webpack_require__(100)($sort)), 'Array', {
  // 22.1.3.25 Array.prototype.sort(comparefn)
  sort: function sort(comparefn) {
    return comparefn === undefined
      ? $sort.call(toObject(this))
      : $sort.call(toObject(this), aFunction(comparefn));
  }
});


/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

// to indexed object, toObject with fallback for non-array-like ES3 strings
var IObject = __webpack_require__(55);
var defined = __webpack_require__(9);
module.exports = function (it) {
  return IObject(defined(it));
};


/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(5);
var document = __webpack_require__(1).document;
// typeof document.createElement is 'object' in old IE
var is = isObject(document) && isObject(document.createElement);
module.exports = function (it) {
  return is ? document.createElement(it) : {};
};


/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

// 7.1.1 ToPrimitive(input [, PreferredType])
var isObject = __webpack_require__(5);
// instead of the ES6 spec version, we didn't implement @@toPrimitive case
// and the second argument - flag - preferred type is a string
module.exports = function (it, S) {
  if (!isObject(it)) return it;
  var fn, val;
  if (S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  if (typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it))) return val;
  if (!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  throw TypeError("Can't convert object to primitive value");
};


/***/ }),
/* 24 */
/***/ (function(module, exports) {

var id = 0;
var px = Math.random();
module.exports = function (key) {
  return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
};


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

var core = __webpack_require__(13);
var global = __webpack_require__(1);
var SHARED = '__core-js_shared__';
var store = global[SHARED] || (global[SHARED] = {});

(module.exports = function (key, value) {
  return store[key] || (store[key] = value !== undefined ? value : {});
})('versions', []).push({
  version: core.version,
  mode: __webpack_require__(31) ? 'pure' : 'global',
  copyright: '© 2019 Denis Pushkarev (zloirock.ru)'
});


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// 19.1.3.6 Object.prototype.toString()
var classof = __webpack_require__(18);
var test = {};
test[__webpack_require__(0)('toStringTag')] = 'z';
if (test + '' != '[object z]') {
  __webpack_require__(8)(Object.prototype, 'toString', function toString() {
    return '[object ' + classof(this) + ']';
  }, true);
}


/***/ }),
/* 27 */
/***/ (function(module, exports) {

// IE 8- don't enum bug keys
module.exports = (
  'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'
).split(',');


/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var regexpFlags = __webpack_require__(49);

var nativeExec = RegExp.prototype.exec;
// This always refers to the native implementation, because the
// String#replace polyfill uses ./fix-regexp-well-known-symbol-logic.js,
// which loads this file before patching the method.
var nativeReplace = String.prototype.replace;

var patchedExec = nativeExec;

var LAST_INDEX = 'lastIndex';

var UPDATES_LAST_INDEX_WRONG = (function () {
  var re1 = /a/,
      re2 = /b*/g;
  nativeExec.call(re1, 'a');
  nativeExec.call(re2, 'a');
  return re1[LAST_INDEX] !== 0 || re2[LAST_INDEX] !== 0;
})();

// nonparticipating capturing group, copied from es5-shim's String#split patch.
var NPCG_INCLUDED = /()??/.exec('')[1] !== undefined;

var PATCH = UPDATES_LAST_INDEX_WRONG || NPCG_INCLUDED;

if (PATCH) {
  patchedExec = function exec(str) {
    var re = this;
    var lastIndex, reCopy, match, i;

    if (NPCG_INCLUDED) {
      reCopy = new RegExp('^' + re.source + '$(?!\\s)', regexpFlags.call(re));
    }
    if (UPDATES_LAST_INDEX_WRONG) lastIndex = re[LAST_INDEX];

    match = nativeExec.call(re, str);

    if (UPDATES_LAST_INDEX_WRONG && match) {
      re[LAST_INDEX] = re.global ? match.index + match[0].length : lastIndex;
    }
    if (NPCG_INCLUDED && match && match.length > 1) {
      // Fix browsers whose `exec` methods don't consistently return `undefined`
      // for NPCG, like IE8. NOTE: This doesn' work for /(.?)?/
      // eslint-disable-next-line no-loop-func
      nativeReplace.call(match[0], reCopy, function () {
        for (i = 1; i < arguments.length - 2; i++) {
          if (arguments[i] === undefined) match[i] = undefined;
        }
      });
    }

    return match;
  };
}

module.exports = patchedExec;


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

var dP = __webpack_require__(7).f;
var FProto = Function.prototype;
var nameRE = /^\s*function ([^ (]*)/;
var NAME = 'name';

// 19.2.4.2 name
NAME in FProto || __webpack_require__(3) && dP(FProto, NAME, {
  configurable: true,
  get: function () {
    try {
      return ('' + this).match(nameRE)[1];
    } catch (e) {
      return '';
    }
  }
});


/***/ }),
/* 30 */
/***/ (function(module, exports) {

module.exports = function (bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value: value
  };
};


/***/ }),
/* 31 */
/***/ (function(module, exports) {

module.exports = false;


/***/ }),
/* 32 */
/***/ (function(module, exports, __webpack_require__) {

var shared = __webpack_require__(25)('keys');
var uid = __webpack_require__(24);
module.exports = function (key) {
  return shared[key] || (shared[key] = uid(key));
};


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var global = __webpack_require__(1);
var has = __webpack_require__(12);
var cof = __webpack_require__(10);
var inheritIfRequired = __webpack_require__(82);
var toPrimitive = __webpack_require__(23);
var fails = __webpack_require__(6);
var gOPN = __webpack_require__(84).f;
var gOPD = __webpack_require__(50).f;
var dP = __webpack_require__(7).f;
var $trim = __webpack_require__(85).trim;
var NUMBER = 'Number';
var $Number = global[NUMBER];
var Base = $Number;
var proto = $Number.prototype;
// Opera ~12 has broken Object#toString
var BROKEN_COF = cof(__webpack_require__(60)(proto)) == NUMBER;
var TRIM = 'trim' in String.prototype;

// 7.1.3 ToNumber(argument)
var toNumber = function (argument) {
  var it = toPrimitive(argument, false);
  if (typeof it == 'string' && it.length > 2) {
    it = TRIM ? it.trim() : $trim(it, 3);
    var first = it.charCodeAt(0);
    var third, radix, maxCode;
    if (first === 43 || first === 45) {
      third = it.charCodeAt(2);
      if (third === 88 || third === 120) return NaN; // Number('+0x1') should be NaN, old V8 fix
    } else if (first === 48) {
      switch (it.charCodeAt(1)) {
        case 66: case 98: radix = 2; maxCode = 49; break; // fast equal /^0b[01]+$/i
        case 79: case 111: radix = 8; maxCode = 55; break; // fast equal /^0o[0-7]+$/i
        default: return +it;
      }
      for (var digits = it.slice(2), i = 0, l = digits.length, code; i < l; i++) {
        code = digits.charCodeAt(i);
        // parseInt parses a string to a first unavailable symbol
        // but ToNumber should return NaN if a string contains unavailable symbols
        if (code < 48 || code > maxCode) return NaN;
      } return parseInt(digits, radix);
    }
  } return +it;
};

if (!$Number(' 0o1') || !$Number('0b1') || $Number('+0x1')) {
  $Number = function Number(value) {
    var it = arguments.length < 1 ? 0 : value;
    var that = this;
    return that instanceof $Number
      // check on 1..constructor(foo) case
      && (BROKEN_COF ? fails(function () { proto.valueOf.call(that); }) : cof(that) != NUMBER)
        ? inheritIfRequired(new Base(toNumber(it)), that, $Number) : toNumber(it);
  };
  for (var keys = __webpack_require__(3) ? gOPN(Base) : (
    // ES3:
    'MAX_VALUE,MIN_VALUE,NaN,NEGATIVE_INFINITY,POSITIVE_INFINITY,' +
    // ES6 (in case, if modules with ES6 Number statics required before):
    'EPSILON,isFinite,isInteger,isNaN,isSafeInteger,MAX_SAFE_INTEGER,' +
    'MIN_SAFE_INTEGER,parseFloat,parseInt,isInteger'
  ).split(','), j = 0, key; keys.length > j; j++) {
    if (has(Base, key = keys[j]) && !has($Number, key)) {
      dP($Number, key, gOPD(Base, key));
    }
  }
  $Number.prototype = proto;
  proto.constructor = $Number;
  __webpack_require__(8)(global, NUMBER, $Number);
}


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = !__webpack_require__(3) && !__webpack_require__(6)(function () {
  return Object.defineProperty(__webpack_require__(22)('div'), 'a', { get: function () { return 7; } }).a != 7;
});


/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

// 7.2.8 IsRegExp(argument)
var isObject = __webpack_require__(5);
var cof = __webpack_require__(10);
var MATCH = __webpack_require__(0)('match');
module.exports = function (it) {
  var isRegExp;
  return isObject(it) && ((isRegExp = it[MATCH]) !== undefined ? !!isRegExp : cof(it) == 'RegExp');
};


/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var LIBRARY = __webpack_require__(31);
var global = __webpack_require__(1);
var ctx = __webpack_require__(14);
var classof = __webpack_require__(18);
var $export = __webpack_require__(4);
var isObject = __webpack_require__(5);
var aFunction = __webpack_require__(15);
var anInstance = __webpack_require__(64);
var forOf = __webpack_require__(65);
var speciesConstructor = __webpack_require__(37);
var task = __webpack_require__(38).set;
var microtask = __webpack_require__(70)();
var newPromiseCapabilityModule = __webpack_require__(40);
var perform = __webpack_require__(71);
var userAgent = __webpack_require__(72);
var promiseResolve = __webpack_require__(73);
var PROMISE = 'Promise';
var TypeError = global.TypeError;
var process = global.process;
var versions = process && process.versions;
var v8 = versions && versions.v8 || '';
var $Promise = global[PROMISE];
var isNode = classof(process) == 'process';
var empty = function () { /* empty */ };
var Internal, newGenericPromiseCapability, OwnPromiseCapability, Wrapper;
var newPromiseCapability = newGenericPromiseCapability = newPromiseCapabilityModule.f;

var USE_NATIVE = !!function () {
  try {
    // correct subclassing with @@species support
    var promise = $Promise.resolve(1);
    var FakePromise = (promise.constructor = {})[__webpack_require__(0)('species')] = function (exec) {
      exec(empty, empty);
    };
    // unhandled rejections tracking support, NodeJS Promise without it fails @@species test
    return (isNode || typeof PromiseRejectionEvent == 'function')
      && promise.then(empty) instanceof FakePromise
      // v8 6.6 (Node 10 and Chrome 66) have a bug with resolving custom thenables
      // https://bugs.chromium.org/p/chromium/issues/detail?id=830565
      // we can't detect it synchronously, so just check versions
      && v8.indexOf('6.6') !== 0
      && userAgent.indexOf('Chrome/66') === -1;
  } catch (e) { /* empty */ }
}();

// helpers
var isThenable = function (it) {
  var then;
  return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
};
var notify = function (promise, isReject) {
  if (promise._n) return;
  promise._n = true;
  var chain = promise._c;
  microtask(function () {
    var value = promise._v;
    var ok = promise._s == 1;
    var i = 0;
    var run = function (reaction) {
      var handler = ok ? reaction.ok : reaction.fail;
      var resolve = reaction.resolve;
      var reject = reaction.reject;
      var domain = reaction.domain;
      var result, then, exited;
      try {
        if (handler) {
          if (!ok) {
            if (promise._h == 2) onHandleUnhandled(promise);
            promise._h = 1;
          }
          if (handler === true) result = value;
          else {
            if (domain) domain.enter();
            result = handler(value); // may throw
            if (domain) {
              domain.exit();
              exited = true;
            }
          }
          if (result === reaction.promise) {
            reject(TypeError('Promise-chain cycle'));
          } else if (then = isThenable(result)) {
            then.call(result, resolve, reject);
          } else resolve(result);
        } else reject(value);
      } catch (e) {
        if (domain && !exited) domain.exit();
        reject(e);
      }
    };
    while (chain.length > i) run(chain[i++]); // variable length - can't use forEach
    promise._c = [];
    promise._n = false;
    if (isReject && !promise._h) onUnhandled(promise);
  });
};
var onUnhandled = function (promise) {
  task.call(global, function () {
    var value = promise._v;
    var unhandled = isUnhandled(promise);
    var result, handler, console;
    if (unhandled) {
      result = perform(function () {
        if (isNode) {
          process.emit('unhandledRejection', value, promise);
        } else if (handler = global.onunhandledrejection) {
          handler({ promise: promise, reason: value });
        } else if ((console = global.console) && console.error) {
          console.error('Unhandled promise rejection', value);
        }
      });
      // Browsers should not trigger `rejectionHandled` event if it was handled here, NodeJS - should
      promise._h = isNode || isUnhandled(promise) ? 2 : 1;
    } promise._a = undefined;
    if (unhandled && result.e) throw result.v;
  });
};
var isUnhandled = function (promise) {
  return promise._h !== 1 && (promise._a || promise._c).length === 0;
};
var onHandleUnhandled = function (promise) {
  task.call(global, function () {
    var handler;
    if (isNode) {
      process.emit('rejectionHandled', promise);
    } else if (handler = global.onrejectionhandled) {
      handler({ promise: promise, reason: promise._v });
    }
  });
};
var $reject = function (value) {
  var promise = this;
  if (promise._d) return;
  promise._d = true;
  promise = promise._w || promise; // unwrap
  promise._v = value;
  promise._s = 2;
  if (!promise._a) promise._a = promise._c.slice();
  notify(promise, true);
};
var $resolve = function (value) {
  var promise = this;
  var then;
  if (promise._d) return;
  promise._d = true;
  promise = promise._w || promise; // unwrap
  try {
    if (promise === value) throw TypeError("Promise can't be resolved itself");
    if (then = isThenable(value)) {
      microtask(function () {
        var wrapper = { _w: promise, _d: false }; // wrap
        try {
          then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
        } catch (e) {
          $reject.call(wrapper, e);
        }
      });
    } else {
      promise._v = value;
      promise._s = 1;
      notify(promise, false);
    }
  } catch (e) {
    $reject.call({ _w: promise, _d: false }, e); // wrap
  }
};

// constructor polyfill
if (!USE_NATIVE) {
  // 25.4.3.1 Promise(executor)
  $Promise = function Promise(executor) {
    anInstance(this, $Promise, PROMISE, '_h');
    aFunction(executor);
    Internal.call(this);
    try {
      executor(ctx($resolve, this, 1), ctx($reject, this, 1));
    } catch (err) {
      $reject.call(this, err);
    }
  };
  // eslint-disable-next-line no-unused-vars
  Internal = function Promise(executor) {
    this._c = [];             // <- awaiting reactions
    this._a = undefined;      // <- checked in isUnhandled reactions
    this._s = 0;              // <- state
    this._d = false;          // <- done
    this._v = undefined;      // <- value
    this._h = 0;              // <- rejection state, 0 - default, 1 - handled, 2 - unhandled
    this._n = false;          // <- notify
  };
  Internal.prototype = __webpack_require__(74)($Promise.prototype, {
    // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
    then: function then(onFulfilled, onRejected) {
      var reaction = newPromiseCapability(speciesConstructor(this, $Promise));
      reaction.ok = typeof onFulfilled == 'function' ? onFulfilled : true;
      reaction.fail = typeof onRejected == 'function' && onRejected;
      reaction.domain = isNode ? process.domain : undefined;
      this._c.push(reaction);
      if (this._a) this._a.push(reaction);
      if (this._s) notify(this, false);
      return reaction.promise;
    },
    // 25.4.5.1 Promise.prototype.catch(onRejected)
    'catch': function (onRejected) {
      return this.then(undefined, onRejected);
    }
  });
  OwnPromiseCapability = function () {
    var promise = new Internal();
    this.promise = promise;
    this.resolve = ctx($resolve, promise, 1);
    this.reject = ctx($reject, promise, 1);
  };
  newPromiseCapabilityModule.f = newPromiseCapability = function (C) {
    return C === $Promise || C === Wrapper
      ? new OwnPromiseCapability(C)
      : newGenericPromiseCapability(C);
  };
}

$export($export.G + $export.W + $export.F * !USE_NATIVE, { Promise: $Promise });
__webpack_require__(41)($Promise, PROMISE);
__webpack_require__(75)(PROMISE);
Wrapper = __webpack_require__(13)[PROMISE];

// statics
$export($export.S + $export.F * !USE_NATIVE, PROMISE, {
  // 25.4.4.5 Promise.reject(r)
  reject: function reject(r) {
    var capability = newPromiseCapability(this);
    var $$reject = capability.reject;
    $$reject(r);
    return capability.promise;
  }
});
$export($export.S + $export.F * (LIBRARY || !USE_NATIVE), PROMISE, {
  // 25.4.4.6 Promise.resolve(x)
  resolve: function resolve(x) {
    return promiseResolve(LIBRARY && this === Wrapper ? $Promise : this, x);
  }
});
$export($export.S + $export.F * !(USE_NATIVE && __webpack_require__(76)(function (iter) {
  $Promise.all(iter)['catch'](empty);
})), PROMISE, {
  // 25.4.4.1 Promise.all(iterable)
  all: function all(iterable) {
    var C = this;
    var capability = newPromiseCapability(C);
    var resolve = capability.resolve;
    var reject = capability.reject;
    var result = perform(function () {
      var values = [];
      var index = 0;
      var remaining = 1;
      forOf(iterable, false, function (promise) {
        var $index = index++;
        var alreadyCalled = false;
        values.push(undefined);
        remaining++;
        C.resolve(promise).then(function (value) {
          if (alreadyCalled) return;
          alreadyCalled = true;
          values[$index] = value;
          --remaining || resolve(values);
        }, reject);
      });
      --remaining || resolve(values);
    });
    if (result.e) reject(result.v);
    return capability.promise;
  },
  // 25.4.4.4 Promise.race(iterable)
  race: function race(iterable) {
    var C = this;
    var capability = newPromiseCapability(C);
    var reject = capability.reject;
    var result = perform(function () {
      forOf(iterable, false, function (promise) {
        C.resolve(promise).then(capability.resolve, reject);
      });
    });
    if (result.e) reject(result.v);
    return capability.promise;
  }
});


/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

// 7.3.20 SpeciesConstructor(O, defaultConstructor)
var anObject = __webpack_require__(2);
var aFunction = __webpack_require__(15);
var SPECIES = __webpack_require__(0)('species');
module.exports = function (O, D) {
  var C = anObject(O).constructor;
  var S;
  return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? D : aFunction(S);
};


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

var ctx = __webpack_require__(14);
var invoke = __webpack_require__(69);
var html = __webpack_require__(39);
var cel = __webpack_require__(22);
var global = __webpack_require__(1);
var process = global.process;
var setTask = global.setImmediate;
var clearTask = global.clearImmediate;
var MessageChannel = global.MessageChannel;
var Dispatch = global.Dispatch;
var counter = 0;
var queue = {};
var ONREADYSTATECHANGE = 'onreadystatechange';
var defer, channel, port;
var run = function () {
  var id = +this;
  // eslint-disable-next-line no-prototype-builtins
  if (queue.hasOwnProperty(id)) {
    var fn = queue[id];
    delete queue[id];
    fn();
  }
};
var listener = function (event) {
  run.call(event.data);
};
// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
if (!setTask || !clearTask) {
  setTask = function setImmediate(fn) {
    var args = [];
    var i = 1;
    while (arguments.length > i) args.push(arguments[i++]);
    queue[++counter] = function () {
      // eslint-disable-next-line no-new-func
      invoke(typeof fn == 'function' ? fn : Function(fn), args);
    };
    defer(counter);
    return counter;
  };
  clearTask = function clearImmediate(id) {
    delete queue[id];
  };
  // Node.js 0.8-
  if (__webpack_require__(10)(process) == 'process') {
    defer = function (id) {
      process.nextTick(ctx(run, id, 1));
    };
  // Sphere (JS game engine) Dispatch API
  } else if (Dispatch && Dispatch.now) {
    defer = function (id) {
      Dispatch.now(ctx(run, id, 1));
    };
  // Browsers with MessageChannel, includes WebWorkers
  } else if (MessageChannel) {
    channel = new MessageChannel();
    port = channel.port2;
    channel.port1.onmessage = listener;
    defer = ctx(port.postMessage, port, 1);
  // Browsers with postMessage, skip WebWorkers
  // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
  } else if (global.addEventListener && typeof postMessage == 'function' && !global.importScripts) {
    defer = function (id) {
      global.postMessage(id + '', '*');
    };
    global.addEventListener('message', listener, false);
  // IE8-
  } else if (ONREADYSTATECHANGE in cel('script')) {
    defer = function (id) {
      html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function () {
        html.removeChild(this);
        run.call(id);
      };
    };
  // Rest old browsers
  } else {
    defer = function (id) {
      setTimeout(ctx(run, id, 1), 0);
    };
  }
}
module.exports = {
  set: setTask,
  clear: clearTask
};


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

var document = __webpack_require__(1).document;
module.exports = document && document.documentElement;


/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// 25.4.1.5 NewPromiseCapability(C)
var aFunction = __webpack_require__(15);

function PromiseCapability(C) {
  var resolve, reject;
  this.promise = new C(function ($$resolve, $$reject) {
    if (resolve !== undefined || reject !== undefined) throw TypeError('Bad Promise constructor');
    resolve = $$resolve;
    reject = $$reject;
  });
  this.resolve = aFunction(resolve);
  this.reject = aFunction(reject);
}

module.exports.f = function (C) {
  return new PromiseCapability(C);
};


/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

var def = __webpack_require__(7).f;
var has = __webpack_require__(12);
var TAG = __webpack_require__(0)('toStringTag');

module.exports = function (it, tag, stat) {
  if (it && !has(it = stat ? it : it.prototype, TAG)) def(it, TAG, { configurable: true, value: tag });
};


/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

// 7.1.13 ToObject(argument)
var defined = __webpack_require__(9);
module.exports = function (it) {
  return Object(defined(it));
};


/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

// 19.1.2.14 / 15.2.3.14 Object.keys(O)
var $keys = __webpack_require__(44);
var enumBugKeys = __webpack_require__(27);

module.exports = Object.keys || function keys(O) {
  return $keys(O, enumBugKeys);
};


/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

var has = __webpack_require__(12);
var toIObject = __webpack_require__(21);
var arrayIndexOf = __webpack_require__(45)(false);
var IE_PROTO = __webpack_require__(32)('IE_PROTO');

module.exports = function (object, names) {
  var O = toIObject(object);
  var i = 0;
  var result = [];
  var key;
  for (key in O) if (key != IE_PROTO) has(O, key) && result.push(key);
  // Don't enum bug & hidden keys
  while (names.length > i) if (has(O, key = names[i++])) {
    ~arrayIndexOf(result, key) || result.push(key);
  }
  return result;
};


/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

// false -> Array#indexOf
// true  -> Array#includes
var toIObject = __webpack_require__(21);
var toLength = __webpack_require__(16);
var toAbsoluteIndex = __webpack_require__(78);
module.exports = function (IS_INCLUDES) {
  return function ($this, el, fromIndex) {
    var O = toIObject($this);
    var length = toLength(O.length);
    var index = toAbsoluteIndex(fromIndex, length);
    var value;
    // Array#includes uses SameValueZero equality algorithm
    // eslint-disable-next-line no-self-compare
    if (IS_INCLUDES && el != el) while (length > index) {
      value = O[index++];
      // eslint-disable-next-line no-self-compare
      if (value != value) return true;
    // Array#indexOf ignores holes, Array#includes - not
    } else for (;length > index; index++) if (IS_INCLUDES || index in O) {
      if (O[index] === el) return IS_INCLUDES || index || 0;
    } return !IS_INCLUDES && -1;
  };
};


/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var at = __webpack_require__(80)(true);

 // `AdvanceStringIndex` abstract operation
// https://tc39.github.io/ecma262/#sec-advancestringindex
module.exports = function (S, index, unicode) {
  return index + (unicode ? at(S, index).length : 1);
};


/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var classof = __webpack_require__(18);
var builtinExec = RegExp.prototype.exec;

 // `RegExpExec` abstract operation
// https://tc39.github.io/ecma262/#sec-regexpexec
module.exports = function (R, S) {
  var exec = R.exec;
  if (typeof exec === 'function') {
    var result = exec.call(R, S);
    if (typeof result !== 'object') {
      throw new TypeError('RegExp exec method returned something other than an Object or null');
    }
    return result;
  }
  if (classof(R) !== 'RegExp') {
    throw new TypeError('RegExp#exec called on incompatible receiver');
  }
  return builtinExec.call(R, S);
};


/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

__webpack_require__(81);
var redefine = __webpack_require__(8);
var hide = __webpack_require__(11);
var fails = __webpack_require__(6);
var defined = __webpack_require__(9);
var wks = __webpack_require__(0);
var regexpExec = __webpack_require__(28);

var SPECIES = wks('species');

var REPLACE_SUPPORTS_NAMED_GROUPS = !fails(function () {
  // #replace needs built-in support for named groups.
  // #match works fine because it just return the exec results, even if it has
  // a "grops" property.
  var re = /./;
  re.exec = function () {
    var result = [];
    result.groups = { a: '7' };
    return result;
  };
  return ''.replace(re, '$<a>') !== '7';
});

var SPLIT_WORKS_WITH_OVERWRITTEN_EXEC = (function () {
  // Chrome 51 has a buggy "split" implementation when RegExp#exec !== nativeExec
  var re = /(?:)/;
  var originalExec = re.exec;
  re.exec = function () { return originalExec.apply(this, arguments); };
  var result = 'ab'.split(re);
  return result.length === 2 && result[0] === 'a' && result[1] === 'b';
})();

module.exports = function (KEY, length, exec) {
  var SYMBOL = wks(KEY);

  var DELEGATES_TO_SYMBOL = !fails(function () {
    // String methods call symbol-named RegEp methods
    var O = {};
    O[SYMBOL] = function () { return 7; };
    return ''[KEY](O) != 7;
  });

  var DELEGATES_TO_EXEC = DELEGATES_TO_SYMBOL ? !fails(function () {
    // Symbol-named RegExp methods call .exec
    var execCalled = false;
    var re = /a/;
    re.exec = function () { execCalled = true; return null; };
    if (KEY === 'split') {
      // RegExp[@@split] doesn't call the regex's exec method, but first creates
      // a new one. We need to return the patched regex when creating the new one.
      re.constructor = {};
      re.constructor[SPECIES] = function () { return re; };
    }
    re[SYMBOL]('');
    return !execCalled;
  }) : undefined;

  if (
    !DELEGATES_TO_SYMBOL ||
    !DELEGATES_TO_EXEC ||
    (KEY === 'replace' && !REPLACE_SUPPORTS_NAMED_GROUPS) ||
    (KEY === 'split' && !SPLIT_WORKS_WITH_OVERWRITTEN_EXEC)
  ) {
    var nativeRegExpMethod = /./[SYMBOL];
    var fns = exec(
      defined,
      SYMBOL,
      ''[KEY],
      function maybeCallNative(nativeMethod, regexp, str, arg2, forceStringMethod) {
        if (regexp.exec === regexpExec) {
          if (DELEGATES_TO_SYMBOL && !forceStringMethod) {
            // The native String method already delegates to @@method (this
            // polyfilled function), leasing to infinite recursion.
            // We avoid it by directly calling the native @@method method.
            return { done: true, value: nativeRegExpMethod.call(regexp, str, arg2) };
          }
          return { done: true, value: nativeMethod.call(str, regexp, arg2) };
        }
        return { done: false };
      }
    );
    var strfn = fns[0];
    var rxfn = fns[1];

    redefine(String.prototype, KEY, strfn);
    hide(RegExp.prototype, SYMBOL, length == 2
      // 21.2.5.8 RegExp.prototype[@@replace](string, replaceValue)
      // 21.2.5.11 RegExp.prototype[@@split](string, limit)
      ? function (string, arg) { return rxfn.call(string, this, arg); }
      // 21.2.5.6 RegExp.prototype[@@match](string)
      // 21.2.5.9 RegExp.prototype[@@search](string)
      : function (string) { return rxfn.call(string, this); }
    );
  }
};


/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// 21.2.5.3 get RegExp.prototype.flags
var anObject = __webpack_require__(2);
module.exports = function () {
  var that = anObject(this);
  var result = '';
  if (that.global) result += 'g';
  if (that.ignoreCase) result += 'i';
  if (that.multiline) result += 'm';
  if (that.unicode) result += 'u';
  if (that.sticky) result += 'y';
  return result;
};


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

var pIE = __webpack_require__(56);
var createDesc = __webpack_require__(30);
var toIObject = __webpack_require__(21);
var toPrimitive = __webpack_require__(23);
var has = __webpack_require__(12);
var IE8_DOM_DEFINE = __webpack_require__(34);
var gOPD = Object.getOwnPropertyDescriptor;

exports.f = __webpack_require__(3) ? gOPD : function getOwnPropertyDescriptor(O, P) {
  O = toIObject(O);
  P = toPrimitive(P, true);
  if (IE8_DOM_DEFINE) try {
    return gOPD(O, P);
  } catch (e) { /* empty */ }
  if (has(O, P)) return createDesc(!pIE.f.call(O, P), O[P]);
};


/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var isRegExp = __webpack_require__(35);
var anObject = __webpack_require__(2);
var speciesConstructor = __webpack_require__(37);
var advanceStringIndex = __webpack_require__(46);
var toLength = __webpack_require__(16);
var callRegExpExec = __webpack_require__(47);
var regexpExec = __webpack_require__(28);
var fails = __webpack_require__(6);
var $min = Math.min;
var $push = [].push;
var $SPLIT = 'split';
var LENGTH = 'length';
var LAST_INDEX = 'lastIndex';
var MAX_UINT32 = 0xffffffff;

// babel-minify transpiles RegExp('x', 'y') -> /x/y and it causes SyntaxError
var SUPPORTS_Y = !fails(function () { RegExp(MAX_UINT32, 'y'); });

// @@split logic
__webpack_require__(48)('split', 2, function (defined, SPLIT, $split, maybeCallNative) {
  var internalSplit;
  if (
    'abbc'[$SPLIT](/(b)*/)[1] == 'c' ||
    'test'[$SPLIT](/(?:)/, -1)[LENGTH] != 4 ||
    'ab'[$SPLIT](/(?:ab)*/)[LENGTH] != 2 ||
    '.'[$SPLIT](/(.?)(.?)/)[LENGTH] != 4 ||
    '.'[$SPLIT](/()()/)[LENGTH] > 1 ||
    ''[$SPLIT](/.?/)[LENGTH]
  ) {
    // based on es5-shim implementation, need to rework it
    internalSplit = function (separator, limit) {
      var string = String(this);
      if (separator === undefined && limit === 0) return [];
      // If `separator` is not a regex, use native split
      if (!isRegExp(separator)) return $split.call(string, separator, limit);
      var output = [];
      var flags = (separator.ignoreCase ? 'i' : '') +
                  (separator.multiline ? 'm' : '') +
                  (separator.unicode ? 'u' : '') +
                  (separator.sticky ? 'y' : '');
      var lastLastIndex = 0;
      var splitLimit = limit === undefined ? MAX_UINT32 : limit >>> 0;
      // Make `global` and avoid `lastIndex` issues by working with a copy
      var separatorCopy = new RegExp(separator.source, flags + 'g');
      var match, lastIndex, lastLength;
      while (match = regexpExec.call(separatorCopy, string)) {
        lastIndex = separatorCopy[LAST_INDEX];
        if (lastIndex > lastLastIndex) {
          output.push(string.slice(lastLastIndex, match.index));
          if (match[LENGTH] > 1 && match.index < string[LENGTH]) $push.apply(output, match.slice(1));
          lastLength = match[0][LENGTH];
          lastLastIndex = lastIndex;
          if (output[LENGTH] >= splitLimit) break;
        }
        if (separatorCopy[LAST_INDEX] === match.index) separatorCopy[LAST_INDEX]++; // Avoid an infinite loop
      }
      if (lastLastIndex === string[LENGTH]) {
        if (lastLength || !separatorCopy.test('')) output.push('');
      } else output.push(string.slice(lastLastIndex));
      return output[LENGTH] > splitLimit ? output.slice(0, splitLimit) : output;
    };
  // Chakra, V8
  } else if ('0'[$SPLIT](undefined, 0)[LENGTH]) {
    internalSplit = function (separator, limit) {
      return separator === undefined && limit === 0 ? [] : $split.call(this, separator, limit);
    };
  } else {
    internalSplit = $split;
  }

  return [
    // `String.prototype.split` method
    // https://tc39.github.io/ecma262/#sec-string.prototype.split
    function split(separator, limit) {
      var O = defined(this);
      var splitter = separator == undefined ? undefined : separator[SPLIT];
      return splitter !== undefined
        ? splitter.call(separator, O, limit)
        : internalSplit.call(String(O), separator, limit);
    },
    // `RegExp.prototype[@@split]` method
    // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@split
    //
    // NOTE: This cannot be properly polyfilled in engines that don't support
    // the 'y' flag.
    function (regexp, limit) {
      var res = maybeCallNative(internalSplit, regexp, this, limit, internalSplit !== $split);
      if (res.done) return res.value;

      var rx = anObject(regexp);
      var S = String(this);
      var C = speciesConstructor(rx, RegExp);

      var unicodeMatching = rx.unicode;
      var flags = (rx.ignoreCase ? 'i' : '') +
                  (rx.multiline ? 'm' : '') +
                  (rx.unicode ? 'u' : '') +
                  (SUPPORTS_Y ? 'y' : 'g');

      // ^(? + rx + ) is needed, in combination with some S slicing, to
      // simulate the 'y' flag.
      var splitter = new C(SUPPORTS_Y ? rx : '^(?:' + rx.source + ')', flags);
      var lim = limit === undefined ? MAX_UINT32 : limit >>> 0;
      if (lim === 0) return [];
      if (S.length === 0) return callRegExpExec(splitter, S) === null ? [S] : [];
      var p = 0;
      var q = 0;
      var A = [];
      while (q < S.length) {
        splitter.lastIndex = SUPPORTS_Y ? q : 0;
        var z = callRegExpExec(splitter, SUPPORTS_Y ? S : S.slice(q));
        var e;
        if (
          z === null ||
          (e = $min(toLength(splitter.lastIndex + (SUPPORTS_Y ? 0 : q)), S.length)) === p
        ) {
          q = advanceStringIndex(S, q, unicodeMatching);
        } else {
          A.push(S.slice(p, q));
          if (A.length === lim) return A;
          for (var i = 1; i <= z.length - 1; i++) {
            A.push(z[i]);
            if (A.length === lim) return A;
          }
          q = p = e;
        }
      }
      A.push(S.slice(p));
      return A;
    }
  ];
});


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunctionPrototype[toStringTagSymbol] =
    GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      if (!(toStringTagSymbol in genFun)) {
        genFun[toStringTagSymbol] = "GeneratorFunction";
      }
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return Promise.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return Promise.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new Promise(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[toStringTagSymbol] = "Generator";

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
   true ? module.exports : undefined
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  Function("r", "regeneratorRuntime = r")(runtime);
}


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

// helper for String#{startsWith, endsWith, includes}
var isRegExp = __webpack_require__(35);
var defined = __webpack_require__(9);

module.exports = function (that, searchString, NAME) {
  if (isRegExp(searchString)) throw TypeError('String#' + NAME + " doesn't accept regex!");
  return String(defined(that));
};


/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

var MATCH = __webpack_require__(0)('match');
module.exports = function (KEY) {
  var re = /./;
  try {
    '/./'[KEY](re);
  } catch (e) {
    try {
      re[MATCH] = false;
      return !'/./'[KEY](re);
    } catch (f) { /* empty */ }
  } return true;
};


/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

// fallback for non-array-like ES3 and non-enumerable old V8 strings
var cof = __webpack_require__(10);
// eslint-disable-next-line no-prototype-builtins
module.exports = Object('z').propertyIsEnumerable(0) ? Object : function (it) {
  return cof(it) == 'String' ? it.split('') : Object(it);
};


/***/ }),
/* 56 */
/***/ (function(module, exports) {

exports.f = {}.propertyIsEnumerable;


/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// https://github.com/tc39/Array.prototype.includes
var $export = __webpack_require__(4);
var $includes = __webpack_require__(45)(true);

$export($export.P, 'Array', {
  includes: function includes(el /* , fromIndex = 0 */) {
    return $includes(this, el, arguments.length > 1 ? arguments[1] : undefined);
  }
});

__webpack_require__(58)('includes');


/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {

// 22.1.3.31 Array.prototype[@@unscopables]
var UNSCOPABLES = __webpack_require__(0)('unscopables');
var ArrayProto = Array.prototype;
if (ArrayProto[UNSCOPABLES] == undefined) __webpack_require__(11)(ArrayProto, UNSCOPABLES, {});
module.exports = function (key) {
  ArrayProto[UNSCOPABLES][key] = true;
};


/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// 21.1.3.7 String.prototype.includes(searchString, position = 0)

var $export = __webpack_require__(4);
var context = __webpack_require__(53);
var INCLUDES = 'includes';

$export($export.P + $export.F * __webpack_require__(54)(INCLUDES), 'String', {
  includes: function includes(searchString /* , position = 0 */) {
    return !!~context(this, searchString, INCLUDES)
      .indexOf(searchString, arguments.length > 1 ? arguments[1] : undefined);
  }
});


/***/ }),
/* 60 */
/***/ (function(module, exports, __webpack_require__) {

// 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
var anObject = __webpack_require__(2);
var dPs = __webpack_require__(87);
var enumBugKeys = __webpack_require__(27);
var IE_PROTO = __webpack_require__(32)('IE_PROTO');
var Empty = function () { /* empty */ };
var PROTOTYPE = 'prototype';

// Create object with fake `null` prototype: use iframe Object with cleared prototype
var createDict = function () {
  // Thrash, waste and sodomy: IE GC bug
  var iframe = __webpack_require__(22)('iframe');
  var i = enumBugKeys.length;
  var lt = '<';
  var gt = '>';
  var iframeDocument;
  iframe.style.display = 'none';
  __webpack_require__(39).appendChild(iframe);
  iframe.src = 'javascript:'; // eslint-disable-line no-script-url
  // createDict = iframe.contentWindow.Object;
  // html.removeChild(iframe);
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write(lt + 'script' + gt + 'document.F=Object' + lt + '/script' + gt);
  iframeDocument.close();
  createDict = iframeDocument.F;
  while (i--) delete createDict[PROTOTYPE][enumBugKeys[i]];
  return createDict();
};

module.exports = Object.create || function create(O, Properties) {
  var result;
  if (O !== null) {
    Empty[PROTOTYPE] = anObject(O);
    result = new Empty();
    Empty[PROTOTYPE] = null;
    // add "__proto__" for Object.getPrototypeOf polyfill
    result[IE_PROTO] = O;
  } else result = createDict();
  return Properties === undefined ? result : dPs(result, Properties);
};


/***/ }),
/* 61 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(52);


/***/ }),
/* 62 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// 21.1.3.18 String.prototype.startsWith(searchString [, position ])

var $export = __webpack_require__(4);
var toLength = __webpack_require__(16);
var context = __webpack_require__(53);
var STARTS_WITH = 'startsWith';
var $startsWith = ''[STARTS_WITH];

$export($export.P + $export.F * __webpack_require__(54)(STARTS_WITH), 'String', {
  startsWith: function startsWith(searchString /* , position = 0 */) {
    var that = context(this, searchString, STARTS_WITH);
    var index = toLength(Math.min(arguments.length > 1 ? arguments[1] : undefined, that.length));
    var search = String(searchString);
    return $startsWith
      ? $startsWith.call(that, search, index)
      : that.slice(index, index + search.length) === search;
  }
});


/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(25)('native-function-to-string', Function.toString);


/***/ }),
/* 64 */
/***/ (function(module, exports) {

module.exports = function (it, Constructor, name, forbiddenField) {
  if (!(it instanceof Constructor) || (forbiddenField !== undefined && forbiddenField in it)) {
    throw TypeError(name + ': incorrect invocation!');
  } return it;
};


/***/ }),
/* 65 */
/***/ (function(module, exports, __webpack_require__) {

var ctx = __webpack_require__(14);
var call = __webpack_require__(66);
var isArrayIter = __webpack_require__(67);
var anObject = __webpack_require__(2);
var toLength = __webpack_require__(16);
var getIterFn = __webpack_require__(68);
var BREAK = {};
var RETURN = {};
var exports = module.exports = function (iterable, entries, fn, that, ITERATOR) {
  var iterFn = ITERATOR ? function () { return iterable; } : getIterFn(iterable);
  var f = ctx(fn, that, entries ? 2 : 1);
  var index = 0;
  var length, step, iterator, result;
  if (typeof iterFn != 'function') throw TypeError(iterable + ' is not iterable!');
  // fast case for arrays with default iterator
  if (isArrayIter(iterFn)) for (length = toLength(iterable.length); length > index; index++) {
    result = entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
    if (result === BREAK || result === RETURN) return result;
  } else for (iterator = iterFn.call(iterable); !(step = iterator.next()).done;) {
    result = call(iterator, f, step.value, entries);
    if (result === BREAK || result === RETURN) return result;
  }
};
exports.BREAK = BREAK;
exports.RETURN = RETURN;


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

// call something on iterator step with safe closing on error
var anObject = __webpack_require__(2);
module.exports = function (iterator, fn, value, entries) {
  try {
    return entries ? fn(anObject(value)[0], value[1]) : fn(value);
  // 7.4.6 IteratorClose(iterator, completion)
  } catch (e) {
    var ret = iterator['return'];
    if (ret !== undefined) anObject(ret.call(iterator));
    throw e;
  }
};


/***/ }),
/* 67 */
/***/ (function(module, exports, __webpack_require__) {

// check on default Array iterator
var Iterators = __webpack_require__(19);
var ITERATOR = __webpack_require__(0)('iterator');
var ArrayProto = Array.prototype;

module.exports = function (it) {
  return it !== undefined && (Iterators.Array === it || ArrayProto[ITERATOR] === it);
};


/***/ }),
/* 68 */
/***/ (function(module, exports, __webpack_require__) {

var classof = __webpack_require__(18);
var ITERATOR = __webpack_require__(0)('iterator');
var Iterators = __webpack_require__(19);
module.exports = __webpack_require__(13).getIteratorMethod = function (it) {
  if (it != undefined) return it[ITERATOR]
    || it['@@iterator']
    || Iterators[classof(it)];
};


/***/ }),
/* 69 */
/***/ (function(module, exports) {

// fast apply, http://jsperf.lnkit.com/fast-apply/5
module.exports = function (fn, args, that) {
  var un = that === undefined;
  switch (args.length) {
    case 0: return un ? fn()
                      : fn.call(that);
    case 1: return un ? fn(args[0])
                      : fn.call(that, args[0]);
    case 2: return un ? fn(args[0], args[1])
                      : fn.call(that, args[0], args[1]);
    case 3: return un ? fn(args[0], args[1], args[2])
                      : fn.call(that, args[0], args[1], args[2]);
    case 4: return un ? fn(args[0], args[1], args[2], args[3])
                      : fn.call(that, args[0], args[1], args[2], args[3]);
  } return fn.apply(that, args);
};


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(1);
var macrotask = __webpack_require__(38).set;
var Observer = global.MutationObserver || global.WebKitMutationObserver;
var process = global.process;
var Promise = global.Promise;
var isNode = __webpack_require__(10)(process) == 'process';

module.exports = function () {
  var head, last, notify;

  var flush = function () {
    var parent, fn;
    if (isNode && (parent = process.domain)) parent.exit();
    while (head) {
      fn = head.fn;
      head = head.next;
      try {
        fn();
      } catch (e) {
        if (head) notify();
        else last = undefined;
        throw e;
      }
    } last = undefined;
    if (parent) parent.enter();
  };

  // Node.js
  if (isNode) {
    notify = function () {
      process.nextTick(flush);
    };
  // browsers with MutationObserver, except iOS Safari - https://github.com/zloirock/core-js/issues/339
  } else if (Observer && !(global.navigator && global.navigator.standalone)) {
    var toggle = true;
    var node = document.createTextNode('');
    new Observer(flush).observe(node, { characterData: true }); // eslint-disable-line no-new
    notify = function () {
      node.data = toggle = !toggle;
    };
  // environments with maybe non-completely correct, but existent Promise
  } else if (Promise && Promise.resolve) {
    // Promise.resolve without an argument throws an error in LG WebOS 2
    var promise = Promise.resolve(undefined);
    notify = function () {
      promise.then(flush);
    };
  // for other environments - macrotask based on:
  // - setImmediate
  // - MessageChannel
  // - window.postMessag
  // - onreadystatechange
  // - setTimeout
  } else {
    notify = function () {
      // strange IE + webpack dev server bug - use .call(global)
      macrotask.call(global, flush);
    };
  }

  return function (fn) {
    var task = { fn: fn, next: undefined };
    if (last) last.next = task;
    if (!head) {
      head = task;
      notify();
    } last = task;
  };
};


/***/ }),
/* 71 */
/***/ (function(module, exports) {

module.exports = function (exec) {
  try {
    return { e: false, v: exec() };
  } catch (e) {
    return { e: true, v: e };
  }
};


/***/ }),
/* 72 */
/***/ (function(module, exports, __webpack_require__) {

var global = __webpack_require__(1);
var navigator = global.navigator;

module.exports = navigator && navigator.userAgent || '';


/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

var anObject = __webpack_require__(2);
var isObject = __webpack_require__(5);
var newPromiseCapability = __webpack_require__(40);

module.exports = function (C, x) {
  anObject(C);
  if (isObject(x) && x.constructor === C) return x;
  var promiseCapability = newPromiseCapability.f(C);
  var resolve = promiseCapability.resolve;
  resolve(x);
  return promiseCapability.promise;
};


/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

var redefine = __webpack_require__(8);
module.exports = function (target, src, safe) {
  for (var key in src) redefine(target, key, src[key], safe);
  return target;
};


/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var global = __webpack_require__(1);
var dP = __webpack_require__(7);
var DESCRIPTORS = __webpack_require__(3);
var SPECIES = __webpack_require__(0)('species');

module.exports = function (KEY) {
  var C = global[KEY];
  if (DESCRIPTORS && C && !C[SPECIES]) dP.f(C, SPECIES, {
    configurable: true,
    get: function () { return this; }
  });
};


/***/ }),
/* 76 */
/***/ (function(module, exports, __webpack_require__) {

var ITERATOR = __webpack_require__(0)('iterator');
var SAFE_CLOSING = false;

try {
  var riter = [7][ITERATOR]();
  riter['return'] = function () { SAFE_CLOSING = true; };
  // eslint-disable-next-line no-throw-literal
  Array.from(riter, function () { throw 2; });
} catch (e) { /* empty */ }

module.exports = function (exec, skipClosing) {
  if (!skipClosing && !SAFE_CLOSING) return false;
  var safe = false;
  try {
    var arr = [7];
    var iter = arr[ITERATOR]();
    iter.next = function () { return { done: safe = true }; };
    arr[ITERATOR] = function () { return iter; };
    exec(arr);
  } catch (e) { /* empty */ }
  return safe;
};


/***/ }),
/* 77 */
/***/ (function(module, exports) {

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this,
        args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);

      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }

      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }

      _next(undefined);
    });
  };
}

module.exports = _asyncToGenerator;

/***/ }),
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

var toInteger = __webpack_require__(17);
var max = Math.max;
var min = Math.min;
module.exports = function (index, length) {
  index = toInteger(index);
  return index < 0 ? max(index + length, 0) : min(index, length);
};


/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(20);

var _regeneratorRuntime = __webpack_require__(61);

__webpack_require__(36);

__webpack_require__(26);

__webpack_require__(91);

__webpack_require__(52);

var _asyncToGenerator = __webpack_require__(77);

self.usgsarray = {};

window.updateOldDataWarning = function () {
  var toDelete = document.getElementById("topOldDataWarning");

  if (toDelete) {
    toDelete.remove();
  }

  if (!window.usgsDataAge) {
    return;
  } //No reason to make an old data warning when data is new (within 1 hour)
  //Make sure to change the warning text so that if the data becomes old while the page is open, they are not confused.


  if (window.usgsDataAge < 1000 * 60 * 60) {
    window.loadNewUSGS = "USGS Data has become old while this page was open. Click try again to update.";
    return;
  }

  var oldDataWarning = document.createElement("p");
  oldDataWarning.id = "topOldDataWarning";
  oldDataWarning.innerHTML = "All river data is more than " + Math.floor(window.usgsDataAge / 1000 / 60 / 60) + " hours old! ";
  oldDataWarning.innerHTML += "(" + window.loadNewUSGS + ") ";
  var reloadButton = document.createElement("button");
  reloadButton.addEventListener("click", function () {
    window.loadNewUSGS = "Trying to Load Data";

    __webpack_require__(79).loadUSGS();
  });
  reloadButton.innerHTML = "Try Again";
  oldDataWarning.appendChild(reloadButton);
  var legend = document.getElementById("legend");
  legend.parentNode.insertBefore(oldDataWarning, legend);
};

function updateUSGSDataInfo() {
  window.usgsDataAge = Date.now() - window.requestTime;
  window.updateOldDataWarning();
}

setInterval(updateUSGSDataInfo, 1000 * 60 * 1); //Every minute, make sure that the data has not become old. If it has, display a warning.

var timesLoadUSGSRan = 0;

var loadUSGS =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee(useCache) {
    var fileName, cache, response, _response, request, _response2, i, river, replacement, elem, expanded;

    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!(window.usgsDataAge < 1000 * 60 * 5)) {
              _context.next = 2;
              break;
            }

            return _context.abrupt("return");

          case 2:
            timesLoadUSGSRan++;
            fileName = "flowdata2.json";

            if (!useCache) {
              _context.next = 16;
              break;
            }

            _context.next = 7;
            return caches.open("rivers.run");

          case 7:
            cache = _context.sent;
            _context.next = 10;
            return caches.match(fileName);

          case 10:
            response = _context.sent;
            _context.next = 13;
            return response.json();

          case 13:
            window.usgsarray = _context.sent;
            _context.next = 30;
            break;

          case 16:
            if (!window.fetch) {
              _context.next = 25;
              break;
            }

            _context.next = 19;
            return fetch(fileName);

          case 19:
            _response = _context.sent;
            _context.next = 22;
            return _response.json();

          case 22:
            window.usgsarray = _context.sent;
            _context.next = 30;
            break;

          case 25:
            //For browsers that don't support fetch
            request = new XMLHttpRequest();
            _context.next = 28;
            return new Promise(function (resolve, reject) {
              request.onload = function (event) {
                resolve(event.target.response);
              };

              request.open("GET", fileName);
              request.send();
            });

          case 28:
            _response2 = _context.sent;
            window.usgsarray = JSON.parse(_response2);

          case 30:
            window.requestTime = usgsarray.generatedAt;
            updateUSGSDataInfo();
            window.updateOldDataWarning();

            if (!window.ItemHolder) {
              window.ItemHolder = [];
            } //Add USGS Data to Graph


            for (i = 0; i < ItemHolder.length; i++) {
              river = ItemHolder[i]; //Add river data to river objects, and updates them for the new information.
              //item.create(true) will force regeneration of the button
              //Replace the current button so that the flow info shows

              replacement = river.create(true); //Create the new button and update the version in cache.

              elem = document.getElementById(river.base + "1"); //Get the currently displayed button (if there is one.)

              if (elem) {
                expanded = river.expanded;

                try {
                  elem.parentNode.replaceChild(replacement, elem); //If the river was expanded before, keep it expanded

                  if (expanded) {
                    replacement.dispatchEvent(new Event("click"));
                    replacement.dispatchEvent(new Event("click"));
                  }
                } catch (e) {
                  console.error(e);
                }
              }
            }

            window.dispatchEvent(new Event("usgsDataUpdated"));

          case 36:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function loadUSGS(_x) {
    return _ref.apply(this, arguments);
  };
}();

window.addEventListener("usgsDataUpdated", function () {
  var query = getAdvancedSearchParameters();

  if (( //Make sure flow searching or sorting is being performed, so that re-running the search may make a difference.
  !objectsEqual(query.flow, defaultAdvancedSearchParameters.flow) //Flow search
  || query.sort.query === "running" //Flow sort
  ) && timesLoadUSGSRan >= 1 //And this is actually an update to the data, not the first load
  && ( //Make sure we don't close writeups that the user is looking at without their permission.
  ItemHolder.every(function (river) {
    return !river.expanded;
  }) //If no writeups are open, we can continue
  || confirm("USGS data has been updated. Would you like to re-run the previous search?") //Otherwise, ask the user if they would like the update.
  )) {
    NewList();
  }
});
module.exports = {
  loadUSGS: loadUSGS
};
window.loadUSGS = loadUSGS;

/***/ }),
/* 80 */
/***/ (function(module, exports, __webpack_require__) {

var toInteger = __webpack_require__(17);
var defined = __webpack_require__(9);
// true  -> String#at
// false -> String#codePointAt
module.exports = function (TO_STRING) {
  return function (that, pos) {
    var s = String(defined(that));
    var i = toInteger(pos);
    var l = s.length;
    var a, b;
    if (i < 0 || i >= l) return TO_STRING ? '' : undefined;
    a = s.charCodeAt(i);
    return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
      ? TO_STRING ? s.charAt(i) : a
      : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
  };
};


/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var regexpExec = __webpack_require__(28);
__webpack_require__(4)({
  target: 'RegExp',
  proto: true,
  forced: regexpExec !== /./.exec
}, {
  exec: regexpExec
});


/***/ }),
/* 82 */
/***/ (function(module, exports, __webpack_require__) {

var isObject = __webpack_require__(5);
var setPrototypeOf = __webpack_require__(83).set;
module.exports = function (that, target, C) {
  var S = target.constructor;
  var P;
  if (S !== C && typeof S == 'function' && (P = S.prototype) !== C.prototype && isObject(P) && setPrototypeOf) {
    setPrototypeOf(that, P);
  } return that;
};


/***/ }),
/* 83 */
/***/ (function(module, exports, __webpack_require__) {

// Works with __proto__ only. Old v8 can't work with null proto objects.
/* eslint-disable no-proto */
var isObject = __webpack_require__(5);
var anObject = __webpack_require__(2);
var check = function (O, proto) {
  anObject(O);
  if (!isObject(proto) && proto !== null) throw TypeError(proto + ": can't set as prototype!");
};
module.exports = {
  set: Object.setPrototypeOf || ('__proto__' in {} ? // eslint-disable-line
    function (test, buggy, set) {
      try {
        set = __webpack_require__(14)(Function.call, __webpack_require__(50).f(Object.prototype, '__proto__').set, 2);
        set(test, []);
        buggy = !(test instanceof Array);
      } catch (e) { buggy = true; }
      return function setPrototypeOf(O, proto) {
        check(O, proto);
        if (buggy) O.__proto__ = proto;
        else set(O, proto);
        return O;
      };
    }({}, false) : undefined),
  check: check
};


/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

// 19.1.2.7 / 15.2.3.4 Object.getOwnPropertyNames(O)
var $keys = __webpack_require__(44);
var hiddenKeys = __webpack_require__(27).concat('length', 'prototype');

exports.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
  return $keys(O, hiddenKeys);
};


/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

var $export = __webpack_require__(4);
var defined = __webpack_require__(9);
var fails = __webpack_require__(6);
var spaces = __webpack_require__(86);
var space = '[' + spaces + ']';
var non = '\u200b\u0085';
var ltrim = RegExp('^' + space + space + '*');
var rtrim = RegExp(space + space + '*$');

var exporter = function (KEY, exec, ALIAS) {
  var exp = {};
  var FORCE = fails(function () {
    return !!spaces[KEY]() || non[KEY]() != non;
  });
  var fn = exp[KEY] = FORCE ? exec(trim) : spaces[KEY];
  if (ALIAS) exp[ALIAS] = fn;
  $export($export.P + $export.F * FORCE, 'String', exp);
};

// 1 -> String#trimLeft
// 2 -> String#trimRight
// 3 -> String#trim
var trim = exporter.trim = function (string, TYPE) {
  string = String(defined(string));
  if (TYPE & 1) string = string.replace(ltrim, '');
  if (TYPE & 2) string = string.replace(rtrim, '');
  return string;
};

module.exports = exporter;


/***/ }),
/* 86 */
/***/ (function(module, exports) {

module.exports = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003' +
  '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';


/***/ }),
/* 87 */
/***/ (function(module, exports, __webpack_require__) {

var dP = __webpack_require__(7);
var anObject = __webpack_require__(2);
var getKeys = __webpack_require__(43);

module.exports = __webpack_require__(3) ? Object.defineProperties : function defineProperties(O, Properties) {
  anObject(O);
  var keys = getKeys(Properties);
  var length = keys.length;
  var i = 0;
  var P;
  while (length > i) dP.f(O, P = keys[i++], Properties[P]);
  return O;
};


/***/ }),
/* 88 */
/***/ (function(module, exports) {

function _typeof2(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof2 = function _typeof2(obj) { return typeof obj; }; } else { _typeof2 = function _typeof2(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof2(obj); }

function _typeof(obj) {
  if (typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol") {
    module.exports = _typeof = function _typeof(obj) {
      return _typeof2(obj);
    };
  } else {
    module.exports = _typeof = function _typeof(obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : _typeof2(obj);
    };
  }

  return _typeof(obj);
}

module.exports = _typeof;

/***/ }),
/* 89 */,
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

// 19.1.3.1 Object.assign(target, source)
var $export = __webpack_require__(4);

$export($export.S + $export.F, 'Object', { assign: __webpack_require__(101) });


/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var anObject = __webpack_require__(2);
var toLength = __webpack_require__(16);
var advanceStringIndex = __webpack_require__(46);
var regExpExec = __webpack_require__(47);

// @@match logic
__webpack_require__(48)('match', 1, function (defined, MATCH, $match, maybeCallNative) {
  return [
    // `String.prototype.match` method
    // https://tc39.github.io/ecma262/#sec-string.prototype.match
    function match(regexp) {
      var O = defined(this);
      var fn = regexp == undefined ? undefined : regexp[MATCH];
      return fn !== undefined ? fn.call(regexp, O) : new RegExp(regexp)[MATCH](String(O));
    },
    // `RegExp.prototype[@@match]` method
    // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@match
    function (regexp) {
      var res = maybeCallNative($match, regexp, this);
      if (res.done) return res.value;
      var rx = anObject(regexp);
      var S = String(this);
      if (!rx.global) return regExpExec(rx, S);
      var fullUnicode = rx.unicode;
      rx.lastIndex = 0;
      var A = [];
      var n = 0;
      var result;
      while ((result = regExpExec(rx, S)) !== null) {
        var matchStr = String(result[0]);
        A[n] = matchStr;
        if (matchStr === '') rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
        n++;
      }
      return n === 0 ? null : A;
    }
  ];
});


/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

var arrayWithoutHoles = __webpack_require__(104);

var iterableToArray = __webpack_require__(105);

var nonIterableSpread = __webpack_require__(106);

function _toConsumableArray(arr) {
  return arrayWithoutHoles(arr) || iterableToArray(arr) || nonIterableSpread();
}

module.exports = _toConsumableArray;

/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var addToUnscopables = __webpack_require__(58);
var step = __webpack_require__(111);
var Iterators = __webpack_require__(19);
var toIObject = __webpack_require__(21);

// 22.1.3.4 Array.prototype.entries()
// 22.1.3.13 Array.prototype.keys()
// 22.1.3.29 Array.prototype.values()
// 22.1.3.30 Array.prototype[@@iterator]()
module.exports = __webpack_require__(112)(Array, 'Array', function (iterated, kind) {
  this._t = toIObject(iterated); // target
  this._i = 0;                   // next index
  this._k = kind;                // kind
// 22.1.5.2.1 %ArrayIteratorPrototype%.next()
}, function () {
  var O = this._t;
  var kind = this._k;
  var index = this._i++;
  if (!O || index >= O.length) {
    this._t = undefined;
    return step(1);
  }
  if (kind == 'keys') return step(0, index);
  if (kind == 'values') return step(0, O[index]);
  return step(0, [index, O[index]]);
}, 'values');

// argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
Iterators.Arguments = Iterators.Array;

addToUnscopables('keys');
addToUnscopables('values');
addToUnscopables('entries');


/***/ }),
/* 94 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(20);

function simpleSort(list, propertyName) {
  list.sort(function (a, b) {
    if (a[propertyName] > b[propertyName]) {
      return 1;
    }

    if (a[propertyName] < b[propertyName]) {
      return -1;
    }

    return 0;
  });
  return list;
}

function alphabeticalsort(list, reverse) {
  list = simpleSort(list, "name");

  if (reverse) {
    list.reverse();
  }

  return list;
}

function ratingsort(list, reverse) {
  //In the sorting, the numbers all come before the letters
  //Convert numbers to strings so that we are comparng the same type, and do not always get false.
  //Convert back after.
  for (var i = 0; i < list.length; i++) {
    if (typeof list[i].rating === "number") {
      list[i].rating = String(list[i].rating);
    }
  }

  list = simpleSort(list, "rating");

  for (var _i = 0; _i < list.length; _i++) {
    if (!isNaN(parseFloat(list[_i].rating))) {
      list[_i].rating = parseFloat(list[_i].rating);
    }
  } //The list is backwards. Reverse it if reverse is NOT specified.


  if (!reverse) {
    list.reverse();
  } //Move error values to end


  while (list[0].rating === "Error") {
    list.push(list.shift());
  }

  return list;
}

function skillsort(list, reverse) {
  list.sort(function (a, b) {
    function ToNum(value) {
      var skillList = ["FW", "B", "N", "N+", "LI-", "LI", "LI+", "I-", "I", "I+", "HI-", "HI", "HI+", "A-", "A", "A+", "E-", "E", "E+"];
      value = skillList.indexOf(value.skill);

      if (value === undefined) {
        value = Infinity;
      }

      return value;
    }

    return ToNum(a) - ToNum(b);
  });

  if (reverse) {
    list.reverse();
  }

  while (list[0].skill === "?") {
    list.push(list.shift());
  }

  return list;
}

function runningSort(list, reverse) {
  var noData = [];
  var hasDam = [];
  var hasGauge = [];
  var hasGaugeAndDam = [];
  var knownState = [];
  list.forEach(function (item) {
    if (item.running !== undefined && !isNaN(item.running)) {
      knownState.push(item);
    } //If there is gauge data, the user may be able to determine level themselves
    //As such, put rivers with gauges second
    else if (item.flow && item.dam) {
        hasGaugeAndDam.push(item);
      } else if (item.flow) {
        hasGauge.push(item);
      } else if (item.dam) {
        hasDam.push(item);
      } else {
        noData.push(item);
      }
  });
  knownState = simpleSort(knownState, "running"); //Default order should be highest flow first.

  if (!reverse) {
    knownState.reverse();
  }

  if (window.usgsDataAge === undefined) {
    alert("Sorting based on flow requires flow data, which has not fully loaded. The flow sort is not being performed.");
    return list;
  }

  knownState = knownState.concat(hasGaugeAndDam);
  knownState = knownState.concat(hasGauge);
  knownState = knownState.concat(hasDam);
  knownState = knownState.concat(noData);
  return knownState;
}

function sort(method, list, reverse) {
  if (method === "none") {} else if (method === "alphabetical") {
    list = alphabeticalsort(list, reverse);
  } else if (method === "rating") {
    list = ratingsort(list, reverse);
  } else if (method === "skill") {
    list = skillsort(list, reverse);
  } else if (method === "running") {
    list = runningSort(list, reverse);
  } else {
    throw "Unknown sorting method " + method;
  }

  return list;
}

module.exports = {
  ratingsort: ratingsort,
  alphabeticalsort: alphabeticalsort,
  skillsort: skillsort,
  sort: sort
};

/***/ }),
/* 95 */,
/* 96 */,
/* 97 */,
/* 98 */,
/* 99 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _regeneratorRuntime = __webpack_require__(61);

__webpack_require__(62);

__webpack_require__(36);

__webpack_require__(26);

__webpack_require__(52);

var _asyncToGenerator = __webpack_require__(77);

__webpack_require__(20);

__webpack_require__(90);

__webpack_require__(57);

__webpack_require__(59);

try {
  window.loadNewUSGS = "Trying to Load Data";

  if ('serviceWorker' in navigator) {
    window.serviceWorkerMessages = [];
    navigator.serviceWorker.ready.then(function (registration) {
      navigator.serviceWorker.onmessage = function (event) {
        window.serviceWorkerMessages.push(event.data);
        var data = event.data;

        if (!data.includes("flowdata2.json")) {
          return;
        }

        window.oldLoadUSGS = window.loadNewUSGS;

        if (data.includes("Updated cache for")) {
          console.log("Updating");

          __webpack_require__(79).loadUSGS(true); //Update the information. true says to use cache.

        } else if (data.includes("errored. Using cache")) {
          window.loadNewUSGS = "Unable to load latest data";
        } else if (data.includes(" took too long to load from network")) {
          window.loadNewUSGS = "Updating data in backgroud";
        } else if (data.includes("has been loaded from the network")) {
          window.loadNewUSGS = "This is likely a glitch. You should be viewing the latest data.";
        }

        window.updateOldDataWarning();
      };
    });
  }
} catch (e) {
  console.error(e);
}

try {
  window.addLine = __webpack_require__(103).addLine;
} catch (e) {
  console.error(e);
} //Defines window.TopBar and window.triangle


Object.assign(window, __webpack_require__(107));
window.River = __webpack_require__(108).River;
window.sort = __webpack_require__(94).sort; //Defines window.normalSearch, window.advanedSearch, and window.toDecimalDegrees

Object.assign(window, __webpack_require__(117));
window.usgsarray = {}; //Defines recursiveAssign, deleteMatchingPortions, and objectsEqual

Object.assign(window, __webpack_require__(119));

__webpack_require__(120); //Defines window.setMenuFromSearch and window.getAdvancedSearchParameters


__webpack_require__(121); //Adds listeners to the searchbox and advanced search menu.


__webpack_require__(124); //Defines window.NewList


document.getElementById("Rivers").appendChild(new TopBar().create()); //createLegend.js needs a #Rivers > .riverbutton to get font-size using getComputedStyle

__webpack_require__(125);

_asyncToGenerator(
/*#__PURE__*/
_regeneratorRuntime.mark(function _callee() {
  var fileName, response, request, _response, search, query, dataNowLoaded, oldQuery, searchNotFinished, legend, _query;

  return _regeneratorRuntime.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          //Load flow information. This is async, and will finish whenever.
          __webpack_require__(79).loadUSGS(); //Load river data so that the page can be rendered.


          fileName = "riverdata.json";

          if (!window.fetch) {
            _context.next = 11;
            break;
          }

          _context.next = 5;
          return fetch(fileName);

        case 5:
          response = _context.sent;
          _context.next = 8;
          return response.json();

        case 8:
          window.riverarray = _context.sent;
          _context.next = 16;
          break;

        case 11:
          //For browsers that don't support fetch
          request = new XMLHttpRequest();
          _context.next = 14;
          return new Promise(function (resolve, reject) {
            request.onload = function (event) {
              resolve(event.target.response);
            };

            request.open("GET", fileName);
            request.send();
          });

        case 14:
          _response = _context.sent;
          window.riverarray = JSON.parse(_response);

        case 16:
          //ItemHolder is a list of all the DOM elements objects. New objects should be pushed into the list.
          window.ItemHolder = [];
          riverarray.map(function (event, index) {
            ItemHolder[index] = new River(index, event);
          }); //If there is a custom search link, use it. Otherwise, just call NewList.

          if (window.location.hash.length > 0) {
            search = decodeURI(window.location.hash.slice(1));

            if (search.startsWith("{")) {
              console.log(search); //Advanced search

              query = JSON.parse(search); //TODO: Set the advanced search areas to the query.
              //We have no usgs data yet. Wait to flow search/sort.

              if (window.usgsDataAge === undefined) {
                dataNowLoaded = function dataNowLoaded() {
                  //If the user has made any changes that caused the list to reload, or it has been over 5 seconds, ask.
                  if (timesNewListCalled <= 2 || confirm("Flow data has now loaded. Would you like to apply your original search link?")) {
                    setMenuFromSearch(oldQuery);
                    NewList();
                  }

                  window.removeEventListener("usgsDataUpdated", dataNowLoaded);
                };

                oldQuery = recursiveAssign({}, query);
                delete query.flow;

                if (query.sort && query.sort.query === "running") {
                  delete query.sort;
                }

                if (!objectsEqual(query, oldQuery)) {
                  window.addEventListener("usgsDataUpdated", dataNowLoaded);
                  searchNotFinished = document.createElement("p");
                  searchNotFinished.id = "topOldDataWarning"; //Reuse styling

                  searchNotFinished.innerHTML = "Portions of your search link use flow data, which is still loading. "; //loadUSGS.js will delete searchNotFinished when it is not needed due to the id overlap.

                  legend = document.getElementById("legend");
                  legend.parentNode.insertBefore(searchNotFinished, legend);
                }
              }

              setMenuFromSearch(query);
              NewList();
            } else {
              //Normal search
              _query = window.getAdvancedSearchParameters();
              _query.normalSearch = search;
              setMenuFromSearch(_query);
              NewList();
            }
          } else {
            NewList();
          }

        case 19:
        case "end":
          return _context.stop();
      }
    }
  }, _callee);
}))();

/***/ }),
/* 100 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var fails = __webpack_require__(6);

module.exports = function (method, arg) {
  return !!method && fails(function () {
    // eslint-disable-next-line no-useless-call
    arg ? method.call(null, function () { /* empty */ }, 1) : method.call(null);
  });
};


/***/ }),
/* 101 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// 19.1.2.1 Object.assign(target, source, ...)
var DESCRIPTORS = __webpack_require__(3);
var getKeys = __webpack_require__(43);
var gOPS = __webpack_require__(102);
var pIE = __webpack_require__(56);
var toObject = __webpack_require__(42);
var IObject = __webpack_require__(55);
var $assign = Object.assign;

// should work with symbols and should have deterministic property order (V8 bug)
module.exports = !$assign || __webpack_require__(6)(function () {
  var A = {};
  var B = {};
  // eslint-disable-next-line no-undef
  var S = Symbol();
  var K = 'abcdefghijklmnopqrst';
  A[S] = 7;
  K.split('').forEach(function (k) { B[k] = k; });
  return $assign({}, A)[S] != 7 || Object.keys($assign({}, B)).join('') != K;
}) ? function assign(target, source) { // eslint-disable-line no-unused-vars
  var T = toObject(target);
  var aLen = arguments.length;
  var index = 1;
  var getSymbols = gOPS.f;
  var isEnum = pIE.f;
  while (aLen > index) {
    var S = IObject(arguments[index++]);
    var keys = getSymbols ? getKeys(S).concat(getSymbols(S)) : getKeys(S);
    var length = keys.length;
    var j = 0;
    var key;
    while (length > j) {
      key = keys[j++];
      if (!DESCRIPTORS || isEnum.call(S, key)) T[key] = S[key];
    }
  } return T;
} : $assign;


/***/ }),
/* 102 */
/***/ (function(module, exports) {

exports.f = Object.getOwnPropertySymbols;


/***/ }),
/* 103 */
/***/ (function(module, exports, __webpack_require__) {

var _toConsumableArray = __webpack_require__(92);

__webpack_require__(33);

//Graph Code
//It's Ugly... It should be fixed
//BUT IT WORKS
//addline(canvas, horizontal, vertical, color, graphtype, numplace)
//canvas - HTML canvas element
//horizontal - array of horizontal values. Pass 0 and it will evenly space.
//vertical - array of vertical values
//color - Optional. Color of line. Default black
//graphtype - Optional. Specify 2 to put 2 lines and 2 scales on one graph. See numplace below
//numplace - Use only if you are using graphtype = 2.
//If you specify 0 or do not pass a value, the line's scale will be on the left side of the graph.
//If you specify 1, the line's scale will be on the right side of the graph
function addLine(GraphName, timeframe, Source, canvas, horizontal, vertical, color, graphtype, numplace) {
  if (graphtype === 3) {
    var endcolor = numplace;
  }

  if (graphtype !== 2) {
    numplace = 0;
  }

  var height = canvas.height * 0.80;
  var width = canvas.width;
  var ctx = canvas.getContext('2d');

  if (!isNaN(Number(horizontal))) {
    horizontal = [];

    for (var i = 0; i < vertical.length; i++) {
      horizontal.push(i * width);
    }
  }

  if (horizontal.length !== vertical.length) {
    console.warn("Uneven amount of datapoints. " + horizontal.length + " horizontal points found, but " + vertical.length + " vertical points found.");
  }

  color = color || "#000000";
  ctx.lineWidth = Math.ceil(Math.min(width, height) / 70);
  ctx.beginPath();

  if (graphtype === 2) {
    width = width * 0.86; //We need to put values on both sides

    ctx.lineWidth = Math.ceil(ctx.lineWidth / 1.3); //Because there are two lines, make the lines thinner.
  } else {
    width = width * 0.93;
  }

  var calcvertical = [];

  for (var i = 0; i < vertical.length; i++) {
    if (!isNaN(Number(vertical[i])) && vertical[i] !== "") {
      calcvertical.push(vertical[i]);
    } //else {
    //This is a valid warning - It just got TOO ANNOYING
    //console.warn("Element " + i + " in list is an invalid number. It had a value of: " + vertical[i])
    //}

  }

  var vscale = Math.max.apply(Math, calcvertical) - Math.min.apply(Math, calcvertical);
  var hscale = Math.max.apply(Math, _toConsumableArray(horizontal)) - Math.min.apply(Math, _toConsumableArray(horizontal));
  vscale = height / vscale;
  hscale = width / hscale;
  var voffset = Math.min.apply(Math, calcvertical);
  var hoffset = Math.min.apply(Math, _toConsumableArray(horizontal));
  hoffset -= (Math.max.apply(Math, _toConsumableArray(horizontal)) - Math.min.apply(Math, _toConsumableArray(horizontal))) * 0.07;
  var px = Math.floor(canvas.width * 0.07 / 2.6);
  ctx.font = px + 'px serif';

  if (color.length === 9) {
    color = color.slice(0, 7);
  }

  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  if (graphtype === 3) {
    var grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, color);
    grd.addColorStop(1, endcolor);
    ctx.strokeStyle = grd;
    ctx.fillStyle = grd;
  }

  if (numplace === 0 || numplace === undefined) {
    var start = 1;
  } else {
    var start = canvas.width - canvas.width * 0.07;
  }

  ctx.font = "bold " + ctx.font;

  for (var i = 1; i < 11; i++) {
    var Text = (Math.max.apply(Math, calcvertical) - Math.min.apply(Math, calcvertical)) * ((i - 1) / 10) + Math.min.apply(Math, calcvertical);

    var _precision = Math.max(0, 3 - String(Math.round(Text)).length);

    Text = Number(Text.toFixed(_precision));
    ctx.fillText(Text, start, height * (11 - i) / 10 - 5);
  } //Top one


  Text = (Math.max.apply(Math, calcvertical) - Math.min.apply(Math, calcvertical)) * ((i - 1) / 10) + Math.min.apply(Math, calcvertical);
  var precision = Math.max(0, 3 - String(Math.round(Text)).length);
  Text = Number(Text.toFixed(precision));
  ctx.fillText(Text, start, 27);
  var px = Math.floor(canvas.width * 0.07 / 2.8);
  ctx.font = px + 'px serif';

  if (color.length === 9) {
    color = color.slice(0, 7);
  }

  if (!window.darkMode) {
    ctx.fillStyle = "black";
  } else {
    //Dark Mode
    ctx.fillStyle = "#dddddd";
  }

  function formatDate(date) {
    var time = String(date.getHours());

    if (date.getHours() < 10) {
      time = "0" + time;
    }

    time += ":";

    if (date.getMinutes() < 10) {
      time += "0" + date.getMinutes();
    } else {
      time += date.getMinutes();
    }

    time += " " + (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear();
    return time;
  }

  var time1 = new Date(timeframe[0]);
  var time2 = new Date(timeframe[timeframe.length - 1]);
  var time3 = new Date((time2 - time1) / 2 + time1.getTime());
  var starttime = formatDate(time1);
  var endtime = formatDate(time2);
  var midtime = formatDate(time3);
  ctx.fillText(starttime, 10, canvas.height * (11 / 12) - canvas.height * 0.06 - 12);
  ctx.textAlign = "end";
  ctx.fillText(endtime, canvas.width - 10, canvas.height * (11 / 12) - canvas.height * 0.06 - 12);
  ctx.textAlign = "center";
  ctx.fillText(midtime, canvas.width / 2, canvas.height * (11 / 12) - canvas.height * 0.06 - 12);
  ctx.textAlign = "start";
  var px = Math.floor(canvas.width * 0.07 / 2.4);
  ctx.font = px + 'px serif';
  ctx.fillStyle = color; //We need to create a gradient for just the text "Water Temperature (F)"

  if (graphtype === 3) {
    var grd = ctx.createLinearGradient(0, height, 200, height);
    grd.addColorStop(0, color);
    grd.addColorStop(1, endcolor);
    ctx.strokeStyle = grd;
    ctx.fillStyle = grd;
  }

  if (graphtype === 2) {
    if (numplace === 0 || numplace === undefined) {
      ctx.fillText("Flow (Cubic Feet/Second)", start + 5, canvas.height * (11 / 12));
    } else {
      ctx.textAlign = "right";
      ctx.fillText("Gauge Height (Feet)", start - 5, canvas.height * (11 / 12));
      ctx.textAlign = "start";
    }
  } else if (graphtype === 3) {
    ctx.fillText("Water Temperature (°F)", start + 5, canvas.height * (11 / 12));
  } else {
    if (GraphName === "Precipitation") {
      ctx.fillText("Precipitation (Inches)", start + 5, canvas.height * (11 / 12));
      var fulldayprecip = 0;
      var halfdayprecip = 0;
      var preciplist = vertical.slice(-96);
      var preciplist = preciplist.map(Number); //convert strings to numbers

      preciplist.forEach(function (value) {
        fulldayprecip += value;
      });
      preciplist = preciplist.slice(-48);
      preciplist.forEach(function (value) {
        halfdayprecip += value;
      });
      fulldayprecip = fulldayprecip.toFixed(2);
      halfdayprecip = halfdayprecip.toFixed(2);
      ctx.fillText("Last 24 Hours: " + fulldayprecip + " in", canvas.width - 700, canvas.height * (11 / 12));
      ctx.fillText("Last 12 Hours: " + halfdayprecip + " in", canvas.width - 330, canvas.height * (11 / 12));
    } else if (GraphName === "cfs") {
      ctx.fillText("Flow (Cubic Feet/Second)", start + 5, canvas.height * (11 / 12));
    } else if (GraphName === "height") {
      ctx.fillText("Gauge Height (Feet)", start + 5, canvas.height * (11 / 12));
    } else {
      ctx.fillText("Labeling Error...", start + 5, canvas.height * (11 / 12));
    }
  } //set it back


  if (graphtype === 3) {
    //The area that actually has the graph is the top 80% height wise
    var grd = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.8);
    grd.addColorStop(0, color);
    grd.addColorStop(1, endcolor);
    ctx.strokeStyle = grd;
    ctx.fillStyle = grd;
  }

  if (!window.darkMode) {
    ctx.fillStyle = "black";
  } else {
    //Dark Mode
    ctx.fillStyle = "#cccccc";
  }

  ctx.textAlign = "center";
  ctx.fillText(Source, canvas.width / 2, canvas.height - 10);
  ctx.textAlign = "start";

  function H(Value) {
    return Math.round((Value - hoffset) * hscale);
  }

  function V(Value) {
    return Math.round(height - (Value - voffset) * vscale);
  }

  for (var p = 0; p < Math.min(vertical.length, horizontal.length); p++) {
    if (!isNaN(Number(vertical[p])) && vertical[p] !== "") {
      ctx.moveTo(H(horizontal[p]), V(vertical[p]));
      break;
    }
  }

  var valid = 1;

  for (var i = p; i < Math.min(vertical.length, horizontal.length); i++) {
    if (!isNaN(Number(vertical[i])) && vertical[i] !== "") {
      if (valid === 1) {
        ctx.lineTo(H(horizontal[i]), V(vertical[i]));
      } else {
        ctx.moveTo(H(horizontal[i]), V(vertical[i]) + 10);
        ctx.lineTo(H(horizontal[i]), V(vertical[i]));
        valid = 1;
      }
    } else {
      valid = 0;
    }
  }

  ctx.stroke();
  ctx.beginPath();
  ctx.lineWidth = Math.ceil(ctx.lineWidth / 10);

  if (!window.darkMode) {
    ctx.strokeStyle = "000000AA";
  } else {
    //Dark Mode
    ctx.strokeStyle = "#ccccccAA";
  }

  for (var i = 1; i < 11; i++) {
    ctx.moveTo(0, height * (11 - i) / 10);
    ctx.lineTo(canvas.width, height * (11 - i) / 10);
  }

  ctx.stroke();
}

module.exports = {
  addLine: addLine
};

/***/ }),
/* 104 */
/***/ (function(module, exports) {

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) {
      arr2[i] = arr[i];
    }

    return arr2;
  }
}

module.exports = _arrayWithoutHoles;

/***/ }),
/* 105 */
/***/ (function(module, exports) {

function _iterableToArray(iter) {
  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
}

module.exports = _iterableToArray;

/***/ }),
/* 106 */
/***/ (function(module, exports) {

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance");
}

module.exports = _nonIterableSpread;

/***/ }),
/* 107 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(20);

function NewSpan(Text) {
  var span = document.createElement("span");
  span.className = "riverspan";
  span.innerHTML = Text;
  return span;
}

function addSorting(span, type) {
  var reverse = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  span.addEventListener("click", function () {
    var query = window.getAdvancedSearchParameters();

    if (query.sort.query === type) {
      query.sort.reverse = !query.sort.reverse;
      reverse = query.sort.reverse;
    } else {
      query.sort.query = type;
      query.sort.reverse = reverse;
      reverse = !reverse;
    }

    window.setMenuFromSearch(query);
    NewList();
  });
}

function TopBar() {
  this.create = function () {
    var button = document.createElement("button");
    button.id = "topbar";
    button.className = "riverbutton";

    if (!!window.MSInputMethodContext && !!document.documentMode) {
      //IE 11 will not dispatch click events to the Name, Skill, Rating, etc, spans, but rather to their parent.
      //Time to do an evil workaround...
      button.onclick = function (e) {
        var x = e.clientX,
            y = e.clientY,
            elementMouseIsOver = document.elementFromPoint(x, y);
        elementMouseIsOver.click();
      };
    }

    var span = NewSpan("River⇅");
    addSorting(span, "alphabetical", true); //Starts sorted alphabetically, a-z. Pass 1 so the first sort reverses that.

    button.appendChild(span);
    button.appendChild(NewSpan("Section"));

    function addSkillSpan() {
      span = NewSpan("Skill⇅");
      span.classList.add("skillspan");
      addSorting(span, "skill", false);
      button.appendChild(span);
    }

    function addClassSpan() {
      span = NewSpan("Class");
      span.classList.add("classspan");
      button.appendChild(span);
    }

    if (localStorage.getItem("classOrSkill") === "class") {
      addClassSpan(); //Add the class span first so it shows up on small screens.

      addSkillSpan();
    } else {
      addSkillSpan(); //Add the skill span first so it shows up on small screens.

      addClassSpan();
    } //The rating span needs to be the same size as the stars.


    span = NewSpan(""); //Create an invisible star span. This will make the spans width the same as the ratings.

    var empty = document.createElement("span");
    empty.className = "emptyStars";
    empty.innerHTML = "☆☆☆☆☆";
    empty.style.opacity = "0"; //Invisible
    //Create the text span.

    var realContent = document.createElement("span");
    realContent.innerHTML = "Rating⇅"; //Make sure that the span is positioned correctly.

    realContent.style.position = "absolute";
    realContent.style.left = 0;
    realContent.style.bottom = 0;
    span.appendChild(empty);
    span.appendChild(realContent);
    addSorting(span, "rating", false); //We want greatest first, not least first, on the first sort. Pass 0 to not reverse

    button.appendChild(span);
    span = NewSpan("Flow/Trend⇅");
    addSorting(span, "running", false); //Show highest flow first, instead of lowest. Pass 0 to not reverse.

    button.appendChild(span);
    return button;
  };

  this.delete = function () {
    var Node = document.getElementById("topbar");

    if (Node) {
      Node.parentNode.removeChild(Node);
    }
  };
}

module.exports = {
  TopBar: TopBar
};

/***/ }),
/* 108 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(51);

__webpack_require__(90);

__webpack_require__(29);

__webpack_require__(62);

var addGraphs = __webpack_require__(109).addGraphs;

var _require = __webpack_require__(115),
    calculateColor = _require.calculateColor,
    calculateAge = _require.calculateAge,
    calculateDirection = _require.calculateDirection;

var skillTranslations = {
  "?": "Skill Unknown",
  "FW": "Flat Water",
  "B": "Beginner",
  "N": "Novice",
  "N+": "Novice Plus",
  "LI-": "Low-Intermediate Minus",
  "LI": "Low-Intermediate",
  "LI+": "Low-Intermediate Plus",
  "I-": "Intermediate Minus",
  "I": "Intermediate",
  "I+": "Intermediate Plus",
  "HI-": "High-Intermediate Minus",
  "HI": "High-Intermediate",
  "HI+": "High-Intermediate Plus",
  "A-": "Advanced Minus",
  "A": "Advanced",
  "A+": "Advanced Plus",
  "E-": "Expert Minus",
  "E": "Expert",
  "E+": "Expert Plus"
};

function addHandlers(button, locate) {
  var river = ItemHolder[locate];
  button.addEventListener("mouseover", function () {
    button.style.backgroundColor = calculateColor(river, {
      highlighted: true
    });
  });
  button.addEventListener("mouseout", function () {
    button.style.backgroundColor = calculateColor(river);
  });
  window.addEventListener("colorSchemeChanged", function () {
    if (river.dam) {
      button.style.background = createStripes();
    }

    button.style.backgroundColor = calculateColor(river);
  }); //Code that runs when the button is clicked

  button.onclick = function () {
    if (river.expanded === 0) {
      var addNotificationsSelector = function addNotificationsSelector(usgsID) {
        var data = {
          id: river.id,
          name: river.name
        };
        var existing;
        var current;

        function resyncData() {
          existing = JSON.parse(localStorage.getItem("flownotifications") || "{}");
          current = existing[usgsID];

          if (current) {
            current = current[river.id];
          }
        }

        resyncData();
        console.log(current); //Container for the river alert creator.

        var container = document.createElement("div");
        container.className = "notificationsContainer";
        div.appendChild(container); //Describe what this does, and alert the user if their browser is unsupported.

        var description = document.createElement("p");
        container.appendChild(description);
        description.innerHTML = "Set alerts for " + (usgsarray[usgsID] && usgsarray[usgsID].name || "this river") + ":<br>";
        description.style.marginBottom = "0.5em"; //Make the description closer to what it is describing...

        if (!("PushManager" in window) || !("Notification" in window) || !("serviceWorker" in navigator)) {
          description.innerHTML += "Your browser does not support flow alerts. You can try using Firefox, Chrome, Opera, or Edge, or Samsung Internet. On iOS, Apple provides no reasonable way to send web notifications, and uses their control of the App Store to prevent other browsers from supporting notifications. Rivers.run is working on email notifications to remedy this situation. ";
          return;
        }

        var low = document.createElement("input");
        low.className = "minimum";
        low.type = "number";
        low.placeholder = "Minimum";
        low.value = current && current.minimum || "";
        var high = document.createElement("input");
        high.className = "maximum";
        high.placeholder = "Maximum";
        high.value = current && current.maximum || "";
        high.type = "number";
        var units = document.createElement("select");
        var blank = document.createElement("option");
        blank.selected = true;
        blank.disabled = true;
        blank.value = "";
        blank.innerHTML = "Units";
        units.appendChild(blank);
        var feet = document.createElement("option");
        feet.value = "ft";
        feet.innerHTML = "Feet";
        feet.pattern = "[0-9]";
        units.appendChild(feet);
        var cfs = document.createElement("option");
        cfs.value = "cfs";
        cfs.innerHTML = "CFS";
        cfs.pattern = "[0-9]";
        units.appendChild(cfs);
        units.value = current && current.units || "";
        var save = document.createElement("button");
        save.innerHTML = "Save";
        save.addEventListener("click", function () {
          var lowValue = parseFloat(low.value);
          var highValue = parseFloat(high.value);
          data.minimum = lowValue;
          data.maximum = highValue;
          data.units = units.value;

          if (isNaN(lowValue)) {
            alert("Minimum must be a number. Ex: 2.37, 3000");
            return;
          }

          if (isNaN(highValue)) {
            alert("Maximum must be a number. Ex: 2.37, 3000");
            return;
          }

          if (!units.value) {
            alert("Please specify whether feet or cfs should be used.");
            return;
          }

          resyncData(); //Make sure we don't restore rivers that were removed while this river was open.

          existing[usgsID] = existing[usgsID] || {};
          existing[usgsID][river.id] = data;
          localStorage.setItem("flownotifications", JSON.stringify(existing));
          window.open("notifications.html");
        });
        var manage = document.createElement("button");
        manage.innerHTML = "Manage Notifications";
        manage.addEventListener("click", function () {
          window.open("notifications.html");
        });
        container.appendChild(low);
        container.appendChild(high);
        container.appendChild(units);
        container.appendChild(save);
        container.appendChild(manage);
      };

      //Auxillary function
      //TODO: Show button to see code used by virtual gauge.
      var addUSGSGraphs = function addUSGSGraphs(usgsID, relatedGauge) {
        var data = self.usgsarray[usgsID];

        if (!data) {
          return;
        } else {
          console.log("No flow data for " + usgsID);
        } //Alert the user if the data is (at least 2 hours) old


        var dataAge;

        try {
          dataAge = calculateAge(usgsID);
        } catch (e) {
          console.error(e);
          dataAge = null;
        }

        var maxAge = 1000 * 60 * 60 * 2;
        var oldDataWarning;

        if (dataAge > maxAge) {
          oldDataWarning = document.createElement("p");
          oldDataWarning.innerHTML = "Check the dates! This river data is more than " + Math.floor(dataAge / 1000 / 60 / 60) + " hours old!";
          oldDataWarning.className = "oldDataWarning";
          div.appendChild(oldDataWarning);
        }

        function addDisclaimer(text) {
          var disclaimer = document.createElement("p");
          disclaimer.style.fontWeight = "bold";
          disclaimer.style.textAlign = "center";
          disclaimer.innerHTML = text;
          return div.appendChild(disclaimer);
        }

        if (relatedGauge) {
          //Space out the gauges.
          div.appendChild(document.createElement("br"));
          div.appendChild(document.createElement("br"));
          div.appendChild(document.createElement("br"));
        }

        addNotificationsSelector(usgsID);
        console.time("Add Graphs");
        addGraphs(div, data);
        console.timeEnd("Add Graphs");
      }; //USGS data may not have loaded yet


      river.expanded = 1;
      var div = document.createElement("div");
      div.innerHTML = ""; //Only show a link if river.dam is a link. This allows rivers to be marked as dams and explainations to be put in the writeups.

      if (river.dam && river.dam.trim().startsWith("http")) {
        //Adding to div.innerHTML works, but logs CSP errors
        var _link = document.createElement("a");

        _link.target = "_blank";
        _link.rel = "noopener";
        _link.href = river.dam;
        _link.innerHTML = "This river has a dam. View information.";
        div.appendChild(_link);
        div.appendChild(document.createElement("br"));
        div.appendChild(document.createElement("br"));
      }

      div.innerHTML += river.writeup + "<br><br>";

      if (river.class && river.skill) {
        div.innerHTML += "This river is class " + river.class + " and is rated " + skillTranslations[river.skill] + ".<br>";
      } else if (river.class) {
        div.innerHTML += "This river is rated class " + river.class + ".<br>";
      } else if (river.skill) {
        div.innerHTML += "This river is rated " + skillTranslations[river.skill] + ".<br>";
      }

      if (river.averagegradient) {
        div.innerHTML += "Average gradient: " + river.averagegradient + " feet per mile.<br>";
      }

      if (river.maxgradient) {
        div.innerHTML += "Maximum gradient: " + river.maxgradient + " feet per mile.<br>";
      }

      if (river.plat && river.plon) {
        div.innerHTML += "Put-In GPS Coordinates: " + river.plat + ", " + river.plon + "<br>";
      }

      if (river.tlat && river.tlon) {
        div.innerHTML += "Take-Out GPS Coordinates: " + river.tlat + ", " + river.tlon + "<br>";
      } //Show the user the values being used for determining relative flow.


      var values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"];
      var flowRange = document.createElement("p");
      flowRange.innerHTML = "";

      for (var i = 0; i < values.length; i++) {
        var name = values[i];

        if (river[name] && !isNaN(parseFloat(river[name]))) {
          flowRange.innerHTML += name + ":" + river[name] + " ";
        }
      }

      if (flowRange.innerHTML !== "") {
        div.appendChild(flowRange);
      } //river.id should always be defined.


      div.appendChild(document.createElement("br"));
      var link = document.createElement("a");
      link.target = "_blank";
      link.rel = "noopener";
      link.href = "https://docs.google.com/document/d/" + river.id;
      link.innerHTML = "Edit this river";
      div.appendChild(link);

      if (river.aw) {
        div.appendChild(document.createElement("br"));

        var _link2 = document.createElement("a");

        _link2.target = "_blank";
        _link2.rel = "noopener";
        _link2.href = "https://www.americanwhitewater.org/content/River/detail/id/" + river.aw;
        _link2.innerHTML = "View this river on American Whitewater";
        div.appendChild(_link2);
      }

      if (river.usgs) {
        //Adding to div.innerHTML works, but logs CSP errors
        div.appendChild(document.createElement("br"));

        var _link3 = document.createElement("a");

        _link3.target = "_blank";
        _link3.rel = "noopener";
        _link3.href = "https://waterdata.usgs.gov/nwis/uv?site_no=" + river.usgs;
        _link3.innerHTML = "View flow information on USGS";
        div.appendChild(_link3);
      }

      div.appendChild(document.createElement("br"));
      var disclaimer = document.createElement("a");
      disclaimer.href = "legal/DISCLAIMER.html";
      disclaimer.target = "_blank";
      disclaimer.innerHTML = "Rivers.run Content and Flow Disclaimer";
      div.appendChild(disclaimer);
      var addedUSGSDisclaimer = false;
      var addedVirtualGaugeDisclaimer = false;

      if (self.usgsarray) {
        river.usgs && addUSGSGraphs(river.usgs);

        if (river.relatedusgs) {
          for (var _i = 0; _i < river.relatedusgs.length; _i++) {
            if (river.relatedusgs[_i] === "") {
              continue;
            }

            addUSGSGraphs(river.relatedusgs[_i], true);
          }
        }
      }

      div.style.padding = "6px";
      div.id = river.base + 2;
      button.parentNode.insertBefore(div, button.nextSibling);
    } else {
      river.expanded = 0;
      var elem = document.getElementById(river.base + 2);

      if (elem) {
        elem.parentNode.removeChild(elem);
      }
    }
  };
}

function createStripes() {
  var newColor = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : window.darkMode ? "rgba(256,256,256,0.25)" : "rgba(170,170,170,0.33)";
  var oldColor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "rgba(0,0,0,0)";
  //If the river has a dam, stripe it.
  var background = "linear-gradient(150deg";

  for (var i = 0; i < 19; i++) {
    background += ", ";
    background += i % 3 ? oldColor : newColor;
  }

  background += ")";
  return background;
}

function River(locate, event) {
  //Copies name, section, skill, rating, writeup, tags, usgs, plat,plon, tlat,tlon, aw, dam
  Object.assign(this, event); //tags needs to be a string. It can't be undefined

  this.tags = this.tags || ""; //Convert the numeric value to the filename

  this.rating = parseFloat(this.rating); //Consider allowing ratings less than 1.

  if (this.rating < 1 || this.rating > 5 || isNaN(this.rating) || this.rating === undefined) {
    this.rating = "Error";
  }

  this.skill = this.skill || "?";
  this.base = "b" + locate;
  this.expanded = 0;
  this.index = locate;

  if (this.relatedusgs) {
    try {
      this.relatedusgs = JSON.parse(this.relatedusgs);
    } catch (e) {
      console.warn(e);
    }
  }

  this.create = function (forceregenerate) {
    //Only create the button once - It's about 3 times faster.
    if (!this.finished || forceregenerate) {
      var AddSpan = function AddSpan(text) {
        var span = document.createElement("span");
        span.innerHTML = text;
        span.className = "riverspan";
        button.appendChild(span);
        return span;
      };

      var addClassSpan = function addClassSpan(river) {
        var riverclass = river.class || ""; //Put a zero width space between a parantheses and the preceeding character so that the browser knows it can split the line.

        riverclass = riverclass.split("(").join("\u200B(");
        AddSpan(riverclass).classList.add("classspan");
      };

      var addSkillSpan = function addSkillSpan(river) {
        //Add a setting for the tooltips.
        if (localStorage.getItem("skillTooltips") === "false") {
          AddSpan(river.skill).classList.add("skillspan");
        } else {
          var skillSpan = document.createElement("span");
          skillSpan.className = "riverspan skillspan tooltip";
          var tooltip = document.createElement("div");
          tooltip.innerHTML = river.skill;
          tooltip.className = "tooltip";
          var tooltiptext = document.createElement("span");
          tooltiptext.innerHTML = skillTranslations[river.skill];
          tooltiptext.className = "tooltiptext";
          skillSpan.style.borderBottom = "none";
          tooltip.appendChild(tooltiptext);
          skillSpan.appendChild(tooltip);
          button.appendChild(skillSpan);
        }
      };

      var button = document.createElement("button");
      button.id = this.base + 1;
      AddSpan(this.name);
      AddSpan(this.section);

      if (localStorage.getItem("classOrSkill") === "class") {
        //Put class first so that it will show up if screen small.
        addClassSpan(this);
        addSkillSpan(this);
      } else {
        //Put skill first so that it will show up if screen small.
        addSkillSpan(this);
        addClassSpan(this);
      } //Star images for rating


      if (this.rating === "Error") {
        //Make sure that the span is the correct width, but inivisble.
        var span = AddSpan("☆☆☆☆☆");
        span.style.opacity = "0.2";
        span.classList.add("emptyStars");
      } else {
        var _span = document.createElement("span");

        _span.className = "riverspan"; //We will use one empty span to set the width of the containing span.
        //We will use another empty span to overlay the full stars

        var spacer = document.createElement("span");
        spacer.className = "emptyStars";
        spacer.innerHTML = "☆☆☆☆☆";
        spacer.style.opacity = "0";

        _span.appendChild(spacer);

        var empty = document.createElement("span");
        empty.className = "emptyStars";
        empty.innerHTML = "☆☆☆☆☆";
        empty.style.position = "absolute";
        empty.style.zIndex = "1"; //Overlay the full stars

        _span.appendChild(empty);

        var full = document.createElement("span");
        full.className = "fullStars";
        full.innerHTML = "★★★★★";
        full.style.width = this.rating * 20 + "%";

        _span.appendChild(full);

        button.appendChild(_span);
      } //Load this.flow from usgsarray.


      var data = usgsarray[this.usgs];

      if (data) {
        var cfs = data.cfs;
        var feet = data.feet;
        var latestCfs, latestFeet;

        if (cfs) {
          latestCfs = cfs[cfs.length - 1].value;
        }

        if (feet) {
          latestFeet = feet[feet.length - 1].value;
        }

        this.feet = latestFeet;
        this.cfs = latestCfs;

        if (latestCfs && latestFeet) {
          this.flow = latestCfs + "cfs " + latestFeet + "ft";
        } else if (latestCfs) {
          this.flow = cfs[cfs.length - 1].value + " cfs";
        } else if (latestFeet) {
          this.flow = feet[feet.length - 1].value + " ft";
        }
      }

      if (this.flow) {
        var value = this.flow + calculateDirection(this.usgs); //If the user has color blind mode enabled, add river.running to one digit onto the flow data.

        if (localStorage.getItem("colorBlindMode") === "true" && calculateColor(this) && this.running !== undefined) {
          value += "(" + Math.round(this.running * 10) / 10 + ")";
        } //TODO: Show the text "Dam" if there is plenty of space to do so. Consider using a smaller icon instead.
        //value += this.dam ? "Dam" : ""


        AddSpan(value);
      } else if (this.dam) {
        AddSpan("Dam");
      }

      button.className = "riverbutton"; //Add the click handler

      addHandlers(button, locate); //Store button for reuse later

      this.finished = button;
    }

    this.updateExpansion = function () {
      //Do not use "this". If called from event listener on window it will fail.
      var river = ItemHolder[locate]; //Make sure it is expanded. Otherwise, there is no need to update the expansion - and
      //updating the expansion can take a lot of time, expecially if it causes reflow.

      if (river.expanded) {
        river.finished.onclick();
        river.finished.onclick();
      }
    };

    window.addEventListener("colorSchemeChanged", this.updateExpansion);

    if (this.dam) {
      this.finished.style.background = createStripes();
    }

    if (calculateColor(this)) {
      this.finished.style.backgroundColor = calculateColor(this);
    } else if (this.dam) {
      //Background color gets overwrote by background. This class uses !important to prevent that.
      this.finished.classList.add("riverbuttonDam");
    } //Return finished button


    return this.finished;
  };

  this.delete = function () {
    var river = ItemHolder[locate];

    function Remove(Code) {
      var ToDelete = document.getElementById(river.base + Code);

      if (ToDelete) {
        ToDelete.parentNode.removeChild(ToDelete);
      }
    } //Reset background color


    var reset = document.getElementById(river.base + 1);

    if (reset) {
      reset.style.backgroundColor = "";
    }

    Remove(2);
    Remove(1);
  };
}

module.exports = {
  River: River
};

/***/ }),
/* 109 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(110);

__webpack_require__(93);

__webpack_require__(26);

__webpack_require__(29);

//Auxillary Function
//Creates the canvas used by each of the graphs
function createcanvas() {
  var canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800; //Make sure the background is not transparent

  var ctx = canvas.getContext("2d");

  if (!window.darkMode) {
    ctx.fillStyle = "white";
  } else {
    //Dark Mode
    ctx.fillStyle = "black";
  }

  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
} //Auxillary Function


function toparts(arr) {
  var values = [];
  var timestamps = [];

  for (var i = 0; i < arr.length; i++) {
    var obj = arr[i];
    values.push(obj.value);
    timestamps.push(obj.dateTime);
  }

  return {
    values: values,
    timestamps: timestamps
  };
}

function addCanvasAsImage(appendTo, canvas) {
  //For some reason, only the last canvas was showing. Use images.
  //I tried using blob urls instead of dataurls to improve performance, but they didn't help, and actually made things WORSE!!!
  //Images also allow "Save Image As"
  var img = document.createElement("img");
  img.className = "graph";
  img.src = canvas.toDataURL("image/png");
  appendTo.appendChild(img);
} //In dark mode, blue doesn't show up well enough, so different colors are used.


function addFlowGraph(div, cfs, height, data) {
  //Make sure we actually have some data, and don't create an empty graph
  if (!(cfs || height)) {
    return;
  }

  var canvas = createcanvas(); //Time to create a dual lined graph!

  if (cfs && height) {
    var parts = toparts(cfs);
    addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00CCFFa0", 2);
    parts = toparts(height);
    addLine("height", parts.timestamps, data.name, canvas, 0, parts.values, window.darkMode ? "#7175f0a0" : "#0000FFa0", 2, 1);
  } //We won't have both cfs and height. Draw a single line graph for whichever we have.
  else if (cfs) {
      var _parts = toparts(cfs);

      addLine("cfs", _parts.timestamps, data.name, canvas, 0, _parts.values, "#00CCFF");
    } else {
      var _parts2 = toparts(height);

      addLine("height", _parts2.timestamps, data.name, canvas, 0, _parts2.values, window.darkMode ? "#7175f0" : "blue");
    }

  return addCanvasAsImage(div, canvas);
}

function addTempGraph(div, temp, data) {
  if (temp) {
    var canvas = createcanvas();
    var parts = toparts(temp);
    addLine("", parts.timestamps, data.name, canvas, 0, parts.values, "red", 3, window.darkMode ? "#00AAFF" : "blue");
    return addCanvasAsImage(div, canvas);
  }
}

function addPrecipGraph(div, precip, data) {
  if (precip) {
    var canvas = createcanvas();
    var parts = toparts(precip);
    addLine("Precipitation", parts.timestamps, data.name, canvas, 0, parts.values, "#0099FF");
    return addCanvasAsImage(div, canvas);
  }
}

function addGraphs(div, data) {
  //The graphing is wrapped in a try-catch statement because USGS often supplies invalid data
  //for a specific river due to gauge problems.
  //Each canvas is wrapped individually because sometimes only some graphs have invalid data
  try {
    if (!localStorage.getItem("colorBlindMode")) {
      addFlowGraph(div, data.cfs, data.feet, data);
    } else {
      //Use one graph for cfs and one for feet if the user is in color blind mode.
      addFlowGraph(div, data.cfs, undefined, data);
      addFlowGraph(div, undefined, data.feet, data);
    }
  } catch (e) {
    console.warn("Error creating flow graph: " + e);
  }

  try {
    addTempGraph(div, data.temp, data);
  } catch (e) {
    console.warn("Error creating temperature graph: " + e);
  }

  try {
    addPrecipGraph(div, data.precip, data);
  } catch (e) {
    console.warn("Error creating precipitation graph: " + e);
  }
}

module.exports = {
  addGraphs: addGraphs
};

/***/ }),
/* 110 */
/***/ (function(module, exports, __webpack_require__) {

var $iterators = __webpack_require__(93);
var getKeys = __webpack_require__(43);
var redefine = __webpack_require__(8);
var global = __webpack_require__(1);
var hide = __webpack_require__(11);
var Iterators = __webpack_require__(19);
var wks = __webpack_require__(0);
var ITERATOR = wks('iterator');
var TO_STRING_TAG = wks('toStringTag');
var ArrayValues = Iterators.Array;

var DOMIterables = {
  CSSRuleList: true, // TODO: Not spec compliant, should be false.
  CSSStyleDeclaration: false,
  CSSValueList: false,
  ClientRectList: false,
  DOMRectList: false,
  DOMStringList: false,
  DOMTokenList: true,
  DataTransferItemList: false,
  FileList: false,
  HTMLAllCollection: false,
  HTMLCollection: false,
  HTMLFormElement: false,
  HTMLSelectElement: false,
  MediaList: true, // TODO: Not spec compliant, should be false.
  MimeTypeArray: false,
  NamedNodeMap: false,
  NodeList: true,
  PaintRequestList: false,
  Plugin: false,
  PluginArray: false,
  SVGLengthList: false,
  SVGNumberList: false,
  SVGPathSegList: false,
  SVGPointList: false,
  SVGStringList: false,
  SVGTransformList: false,
  SourceBufferList: false,
  StyleSheetList: true, // TODO: Not spec compliant, should be false.
  TextTrackCueList: false,
  TextTrackList: false,
  TouchList: false
};

for (var collections = getKeys(DOMIterables), i = 0; i < collections.length; i++) {
  var NAME = collections[i];
  var explicit = DOMIterables[NAME];
  var Collection = global[NAME];
  var proto = Collection && Collection.prototype;
  var key;
  if (proto) {
    if (!proto[ITERATOR]) hide(proto, ITERATOR, ArrayValues);
    if (!proto[TO_STRING_TAG]) hide(proto, TO_STRING_TAG, NAME);
    Iterators[NAME] = ArrayValues;
    if (explicit) for (key in $iterators) if (!proto[key]) redefine(proto, key, $iterators[key], true);
  }
}


/***/ }),
/* 111 */
/***/ (function(module, exports) {

module.exports = function (done, value) {
  return { value: value, done: !!done };
};


/***/ }),
/* 112 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var LIBRARY = __webpack_require__(31);
var $export = __webpack_require__(4);
var redefine = __webpack_require__(8);
var hide = __webpack_require__(11);
var Iterators = __webpack_require__(19);
var $iterCreate = __webpack_require__(113);
var setToStringTag = __webpack_require__(41);
var getPrototypeOf = __webpack_require__(114);
var ITERATOR = __webpack_require__(0)('iterator');
var BUGGY = !([].keys && 'next' in [].keys()); // Safari has buggy iterators w/o `next`
var FF_ITERATOR = '@@iterator';
var KEYS = 'keys';
var VALUES = 'values';

var returnThis = function () { return this; };

module.exports = function (Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED) {
  $iterCreate(Constructor, NAME, next);
  var getMethod = function (kind) {
    if (!BUGGY && kind in proto) return proto[kind];
    switch (kind) {
      case KEYS: return function keys() { return new Constructor(this, kind); };
      case VALUES: return function values() { return new Constructor(this, kind); };
    } return function entries() { return new Constructor(this, kind); };
  };
  var TAG = NAME + ' Iterator';
  var DEF_VALUES = DEFAULT == VALUES;
  var VALUES_BUG = false;
  var proto = Base.prototype;
  var $native = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT];
  var $default = $native || getMethod(DEFAULT);
  var $entries = DEFAULT ? !DEF_VALUES ? $default : getMethod('entries') : undefined;
  var $anyNative = NAME == 'Array' ? proto.entries || $native : $native;
  var methods, key, IteratorPrototype;
  // Fix native
  if ($anyNative) {
    IteratorPrototype = getPrototypeOf($anyNative.call(new Base()));
    if (IteratorPrototype !== Object.prototype && IteratorPrototype.next) {
      // Set @@toStringTag to native iterators
      setToStringTag(IteratorPrototype, TAG, true);
      // fix for some old engines
      if (!LIBRARY && typeof IteratorPrototype[ITERATOR] != 'function') hide(IteratorPrototype, ITERATOR, returnThis);
    }
  }
  // fix Array#{values, @@iterator}.name in V8 / FF
  if (DEF_VALUES && $native && $native.name !== VALUES) {
    VALUES_BUG = true;
    $default = function values() { return $native.call(this); };
  }
  // Define iterator
  if ((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])) {
    hide(proto, ITERATOR, $default);
  }
  // Plug for library
  Iterators[NAME] = $default;
  Iterators[TAG] = returnThis;
  if (DEFAULT) {
    methods = {
      values: DEF_VALUES ? $default : getMethod(VALUES),
      keys: IS_SET ? $default : getMethod(KEYS),
      entries: $entries
    };
    if (FORCED) for (key in methods) {
      if (!(key in proto)) redefine(proto, key, methods[key]);
    } else $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
  }
  return methods;
};


/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var create = __webpack_require__(60);
var descriptor = __webpack_require__(30);
var setToStringTag = __webpack_require__(41);
var IteratorPrototype = {};

// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
__webpack_require__(11)(IteratorPrototype, __webpack_require__(0)('iterator'), function () { return this; });

module.exports = function (Constructor, NAME, next) {
  Constructor.prototype = create(IteratorPrototype, { next: descriptor(1, next) });
  setToStringTag(Constructor, NAME + ' Iterator');
};


/***/ }),
/* 114 */
/***/ (function(module, exports, __webpack_require__) {

// 19.1.2.9 / 15.2.3.2 Object.getPrototypeOf(O)
var has = __webpack_require__(12);
var toObject = __webpack_require__(42);
var IE_PROTO = __webpack_require__(32)('IE_PROTO');
var ObjectProto = Object.prototype;

module.exports = Object.getPrototypeOf || function (O) {
  O = toObject(O);
  if (has(O, IE_PROTO)) return O[IE_PROTO];
  if (typeof O.constructor == 'function' && O instanceof O.constructor) {
    return O.constructor.prototype;
  } return O instanceof Object ? ObjectProto : null;
};


/***/ }),
/* 115 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(116);

__webpack_require__(29);

__webpack_require__(91);

__webpack_require__(51);

__webpack_require__(33);

//These functions are used by River.js to calculate things based on a rivers flow.
function calculateDirection(usgsNumber) {
  var usgsData = usgsarray[usgsNumber];

  if (usgsData) {
    var data = usgsData.cfs || usgsData.feet;

    if (data) {
      var current;
      var previous; //We will go back 4 datapoints (1 hour) if possible.
      //Do this because USGS sometimes does 1 hour intervals instead of 15 minutes

      var stop = Math.max(data.length - 5, 0);

      for (var i = data.length; i > stop; i--) {
        var item = data[i];

        if (!item) {
          continue;
        }

        var value = item.value;

        if (!current) {
          current = value;
        } else {
          previous = value;
        }
      }

      if (current > previous) {
        //Water level rising
        return "⬆";
      } else if (previous > current) {
        //Water level falling
        return "⬇";
      } else if (current === previous) {
        //Water level stable
        return " –"; //En dash preceeded by a thin space.
      }
    }
  }

  return; //If we got here, there is not enough USGS data.
}

function calculateAge(usgsNumber) {
  //Returns millseconds old that USGS data is
  var usgsData = window.usgsarray[usgsNumber];

  if (usgsData) {
    var data = usgsData.cfs || usgsData.feet || usgsData.temp || usgsData.precip;

    if (data) {
      for (var i = data.length; i >= 0; i--) {
        var item = data[i];

        if (!item) {
          continue;
        }

        return Date.now() - Number(new Date(item.dateTime));
      }
    }
  }

  return null; //If we got here, there is not enough USGS data.
}

function calculateColor(river, options) {
  //hsla color values
  //hsla(hue, saturation, lightness, opacity)
  //Saturation hue is 0 red 120 green 240 blue
  //Saturation - use 100%
  //Lightness - use 50%
  //Opacity - Decimal 0 to 1
  //Defines river.running
  //0-4
  //0 is too low, 4 is too high, other values in between
  var values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"];
  var type; //Currently, we skip a value if one datapoint is cfs and another feet

  for (var i = 0; i < values.length; i++) {
    var str = river[values[i]];

    if (!str) {
      values[i] = undefined;
      continue;
    }

    str = str.split("(computer)").join("");
    str = str.trim();
    var value = parseFloat(str);
    var currentType = str.match(/[^\d|.]+/); //Match a series of non-digits

    if (currentType) {
      currentType = currentType[0].trim().toLowerCase(); //Use the first match
    }

    if (!type && currentType) {
      type = currentType;
    } else if (type !== currentType && !isNaN(value)) {
      console.warn(values[i] + " on " + river.name + " " + river.section + " has a different extension and has been skipped");
      values[i] = undefined;
      continue;
    }

    values[i] = value;
  }

  var flow;

  if (type === "cfs") {
    flow = river.cfs;
  } else if (type === "feet" || type === "ft") {
    flow = river.feet;
  } //Use or equal to
  //While that technically may not be correct (says that river is too low at minrun), it makes no significant difference
  //In addition, values equal to minrun or maxrun result in a river.running of 0 or 4
  //Meaning that they may be included in the middle of a darker highlighted rivers
  //When sorting by runnability is used.
  //It would be better if rivers that are too high or too low are still given river.running values
  //related to their level. This would also help in determining if something is just barely
  //too low, and may come up with rain, or is truely too low.
  //If we don't have some values, fill them in using logarithms
  //Although these calculations are not needed when flow is below minrun or above maxrun. they can be useful in
  //alerting people what values are being used, so that they can


  function logDist(low, high) {
    var ratio = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0.5;
    //ratio is how a decimal between 0 and 1. 0.5 means to factor lowLog and highLog evenly. Values greater than 0.5 factor in highLog more, vice versa.
    var lowLog = Math.log10(low);
    var highLog = Math.log10(high);

    if (lowLog > highLog) {
      console.error("Low greater than high on " + river.name + " " + river.section);
      return;
    }

    return Math.pow(10, lowLog + (highLog - lowLog) * ratio);
  }

  var minrun = values[0];
  var maxrun = values[4]; //For midflow, use the nearest values to calculate midflow.

  var midflow = values[2]; //Prefer the specified midflow.

  midflow = midflow || logDist(values[1], values[3]); //Average lowflow and highflow

  midflow = midflow || logDist(values[0], values[3], 2 / 3); // two-thirds of the way between minrun and highflow

  midflow = midflow || logDist(values[1], values[4], 1 / 3); // one-third of the way between lowflow and maxrun

  midflow = midflow || logDist(minrun, maxrun); //Average minrun and maxrun.

  var lowflow = values[1] || logDist(minrun, midflow);
  var highflow = values[3] || logDist(midflow, maxrun); //Add computer generated properties to the river object so that they will display and people can see the values used in calculations.

  values[1] || (river.lowflow = parseFloat(lowflow.toFixed(2)) + type + " (computer)");
  values[2] || (river.midflow = parseFloat(midflow.toFixed(2)) + type + " (computer)");
  values[3] || (river.highflow = parseFloat(highflow.toFixed(2)) + type + " (computer)");

  if (flow <= minrun) {
    //Too low
    river.running = 0;
    var lightness = options && options.highlighted ? window.darkMode ? "28%" : "63%" : window.darkMode ? "23%" : "67%";
    return "hsl(0,100%," + lightness + ")";
  } else if (flow >= maxrun) {
    //Too high
    river.running = 4;

    var _lightness = options && options.highlighted ? window.darkMode ? "30%" : "67%" : window.darkMode ? "20%" : "69%";

    return "hsl(240,100%," + _lightness + ")";
  } else {
    var calculateRatio = function calculateRatio(low, high, current) {
      low = Math.log(low);
      high = Math.log(high);
      current = Math.log(current);
      var range = high - low;
      var value = current - low;
      return value / range;
    };

    //Normal Flow lightness values
    //Tough to see a difference when highlighted amount the more middle values in light mode.
    var _lightness2 = options && options.highlighted ? window.darkMode ? "30%" : "65%" : window.darkMode ? "25%" : "70%";

    if (flow < lowflow && minrun) {
      river.running = calculateRatio(minrun, lowflow, flow);
    } else if (flow < midflow && lowflow) {
      river.running = 1 + calculateRatio(lowflow, midflow, flow);
    } else if (flow < highflow && midflow) {
      river.running = 2 + calculateRatio(midflow, highflow, flow);
    } //Use else if and comparison against maxrun to go to the else in case of isNaN(maxrun)
    else if (flow < maxrun && highflow) {
        river.running = 3 + calculateRatio(highflow, maxrun, flow);
      } else {
        return ""; //We can't calculate a color or ratio. We lack enough information. Example: only have minrun and flow above minrun.
      }

    return "hsl(" + (0 + 60 * river.running) + ",100%," + _lightness2 + ")";
  }
}

module.exports = {
  calculateColor: calculateColor,
  calculateAge: calculateAge,
  calculateDirection: calculateDirection
};

/***/ }),
/* 116 */
/***/ (function(module, exports, __webpack_require__) {

// 20.2.2.21 Math.log10(x)
var $export = __webpack_require__(4);

$export($export.S, 'Math', {
  log10: function log10(x) {
    return Math.log(x) * Math.LOG10E;
  }
});


/***/ }),
/* 117 */
/***/ (function(module, exports, __webpack_require__) {

var _toConsumableArray = __webpack_require__(92);

__webpack_require__(62);

__webpack_require__(29);

__webpack_require__(20);

__webpack_require__(57);

__webpack_require__(59);

__webpack_require__(51);

__webpack_require__(33);

(globalThis || window).toDecimalDegrees = function (coord) {
  if (!isNaN(Number(coord))) {
    return Number(coord); //Coordinate is already in decimal form.
  }

  if (typeof coord !== "string") {
    return undefined;
  }

  var parts = coord.split(/[^.\w]+/); //Split on non-alphanumeric characters that aren't decimals.

  console.log(parts);
  var direction;

  for (var i = 0; i < parts.length; i++) {
    if (["N", "S", "E", "W"].includes(parts[i])) {
      direction = parts[i];
      parts.splice(i, 1);
      break;
    }
  }

  console.log(parts);
  var degrees = Number(parts[0]);
  var minutes = Number(parts[1]) || 0;
  var seconds = Number(parts[2]) || 0;
  minutes += seconds / 60;
  degrees += minutes / 60;

  if (isNaN(Number(degrees))) {
    throw "Coordinate " + coord + " could not be processed.";
  }

  if (direction === "S" || direction === "W") {
    degrees = -degrees;
  }

  return degrees;
};

var sortUtils = __webpack_require__(94);

function normalSearch(list, query, returnBuckets) {
  var _ref;

  query = query.toLowerCase().trim();

  if (query === "") {
    return sortUtils.sort("alphabetical", list);
  } //Don't search for an empty query.
  //The first buckets are better matches than later ones.


  var buckets = [[], [], [], [], [], []];
  var bucket2 = []; //Bucket 2 - index 1 - is special.

  list.forEach(function (event) {
    //First bucket
    var nameExactMatch = event.name.toLowerCase() === query;
    var sectionExactMatch = event.section.toLowerCase() === query; //Second Bucket
    //This bucket is build to handle searches across name and section - such as "Lower Haw"
    //As long as name and section contain all space seperated parts of the query, this bucket can be used.

    var splitter = /[ ,]+/; //Split on spaces and commas. This handles things like "Lower, Lower Yough"

    var words = query.split(splitter);
    var passes = words.every(function (word) {
      return event.name.toLowerCase().indexOf(word) !== -1 || event.section.toLowerCase().indexOf(word) !== -1;
    });
    var nameWords = event.name.toLowerCase().split(splitter);
    var sectionWords = event.section.toLowerCase().split(splitter); //For the search "Lower Haw", the Lower Haw should show up higher than Lower Hawksbill Creek.
    //This works by assigning higher relevance to exact matches, then startsWith, than contains.

    var bonus = words.reduce(function (bonus, word) {
      //TODO: Consider making .includes() and startsWith worth 7.
      if (nameWords.includes(word)) {
        delete nameWords[nameWords.indexOf(word)]; //Remove the word so that is can't be matched twice (ex. text lower, search lower lower)

        return bonus + 5;
      } else if (sectionWords.includes(word)) {
        delete sectionWords[sectionWords.indexOf(word)];
        return bonus + 5;
      } else if (event.name.toLowerCase().startsWith(word) || event.section.toLowerCase().startsWith(word)) {
        return bonus + 3;
      } //If name or section contains word.
      else if (event.name.toLowerCase().indexOf(word) !== -1 || event.section.toLowerCase().indexOf(word) !== -1) {
          return bonus + 1;
        }

      return bonus;
    }, 0); //Thrid bucket

    var nameMatches = event.name.toLowerCase().startsWith(query);
    var sectionMatches = event.section.toLowerCase().startsWith(query);
    var tagsContains = event.tags.toLowerCase().indexOf(query) !== -1; //Fourth bucket

    var nameContains = event.name.toLowerCase().indexOf(query) !== -1; //Fifth Bucket

    var sectionContains = event.section.toLowerCase().indexOf(query) !== -1; //Final Bucket

    var writeupContains = event.writeup.toLowerCase().indexOf(query) !== -1;

    if (nameExactMatch || sectionExactMatch) {
      buckets[0].push(event);
    } //TODO: Use bucket 1 for even better matches in multi word.
    else if (words.length > 1 && passes) {
        bucket2[bonus] = bucket2[bonus] || [];
        bucket2[bonus].push(event);
      } else if (nameMatches || sectionMatches || tagsContains) {
        buckets[2].push(event);
      } else if (nameContains) {
        buckets[3].push(event);
      } else if (sectionContains) {
        buckets[4].push(event);
      } else if (writeupContains) {
        buckets[5].push(event);
      }
  }); //Sort each match level alphabetically by river name

  buckets = buckets.map(function (bucket) {
    return sortUtils.sort("alphabetical", bucket);
  });
  bucket2.reverse(); //Highest relevance ones come first in the second bucket.

  if (returnBuckets) {
    buckets[1] = bucket2; //We won't process bucket2 if returnBuckets is set.

    return buckets;
  }

  for (var i = 0; i < bucket2.length; i++) {
    var subbucket = bucket2[i];

    if (subbucket) {
      //Sort the subbucket alphabetically.
      subbucket = sortUtils.sort("alphabetical", subbucket);
      subbucket.forEach(function (value) {
        buckets[1].push(value);
      });
    }
  }

  return (_ref = []).concat.apply(_ref, _toConsumableArray(buckets));
}

function stringQuery(parameters) {
  var content = parameters.content;
  var query = parameters.query; //Ignore case by default

  if (!parameters.matchCase) {
    content = content.toLowerCase();
    query = query.toLowerCase();
  }

  if (parameters.type === "contains") {
    return content.includes(query);
  } else if (parameters.type === "matches") {
    return content === query;
  } else {
    throw "Unknown Search Type " + parameters.type;
  }
}

function stringFilter(list, property, parameters) {
  //Filter out the elements that fail the test
  //Since we may be deleting elements in the list, items will be skipped if we use array.length
  for (var item in list) {
    parameters.content = list[item][property];
    var passes = stringQuery(parameters);

    if (!passes) {
      //Remove the item if it fails
      delete list[item];
    }
  }

  delete parameters.content; //Cleanup

  return list;
}

function skillToNumber(skill) {
  var value;

  switch (skill) {
    case "FW":
      value = 1;
      break;

    case "B":
      value = 2;
      break;

    case "N":
      value = 3;
      break;

    case "LI":
      value = 4;
      break;

    case "I":
      value = 5;
      break;

    case "HI":
      value = 6;
      break;

    case "A":
      value = 7;
      break;

    case "E":
      value = 8;
  }

  return value;
}

function skillFilter(list, parameters) {
  var query = parameters.query;
  var min = Math.min(query[0], query[1]);
  var max = Math.max(query[0], query[1]);

  for (var item in list) {
    var passes = false;
    var skill = skillToNumber(list[item].skill);

    if (min <= skill && skill <= max) {
      passes = true;
    }

    if (!passes && !(parameters.includeUnknown && skill === undefined)) {
      //Remove the item if it fails
      delete list[item];
    }
  }

  return list;
}

function ratingFilter(list, parameters) {
  console.error("Rating based filtering is not yet implemented");
  return list;
}

var calculateDistance = __webpack_require__(118).lambert; //Lambert formula


function locationFilter(list, parameters) {
  var maxDistance = Number(parameters.distance);
  var lat1 = toDecimalDegrees(parameters.lat);
  var lon1 = toDecimalDegrees(parameters.lon);

  if (!(maxDistance && lat1 && lon1)) {
    //Cancel the search.
    //Technically we could be missing part of 1 coordinate, sometimes both, and eliminate some rivers, however this goes against
    //the purpose of location sorting - to find rivers, not eliminate them (we want all rivers to have full coordinates)
    return list;
  }

  for (var item in list) {
    var river = list[item];
    var lat2 = toDecimalDegrees(river.plat) || toDecimalDegrees(river.tlat) || toDecimalDegrees(river.hidlat);
    var lon2 = toDecimalDegrees(river.plon) || toDecimalDegrees(river.tlon) || toDecimalDegrees(river.hidlon);
    var distance = calculateDistance(lat1, lon1, lat2, lon2);
    var passes = distance < maxDistance || parameters.includeUnknown; //Follow parameters.includeUnknown unless the river has been eliminated on distance.

    if (!passes) {
      //Remove the item if it does not pass the test.
      delete list[item];
    }
  }

  return list;
}

function flowFilter(list, parameters) {
  var query = parameters.query;
  var min = query[0];
  var max = query[1]; //Alert user when an actually useful flow search can't be performed.

  if (window.usgsDataAge === undefined && (max !== 4 || min !== 0)) {
    alert("Searching based on flow requires flow data, which has not fully loaded. The flow search is not being performed.");
    return list;
  }

  for (var item in list) {
    var river = list[item];

    if (river.dam && parameters.includeDams) {} //Do nothing if the river is a dam and dams are to be included.
    //If we do not know flow status, follow parameters.includeUnknown
    else if (river.running === undefined) {
        if (!parameters.includeUnknown) {
          delete list[item];
        }
      } //If we do know flow status, filter based on the flow.
      else if (river.running < min || river.running > max) {
          delete list[item];
        }
  }

  return list;
}

function tagsFilter(list, parameters) {
  var query = parameters.query;
  var components = parameters.query.split(" ").join("").split(",");

  for (var item in list) {
    var river = list[item];

    for (var i = 0; i < components.length; i++) {
      if (typeof river.tags !== "string" || !river.tags.toLowerCase().includes(components[i].toLowerCase())) {
        delete list[item];
      }
    }
  }

  return list;
} //Query is in form of:
//{
//  name: {
//    type: "matches",
//    query: "potomac"
//},
//section: {
//    type: "contains",
//    query: "something"
//  },
// skill: {
//	type:"" //easier harder exactly from
//	value: 3 //An array of 2 if from
//from is inclusive (From medium to hard)
//},
//location:{
//	distance: 100 //Maximum distance in miles
//	lat: 78//Starting latitude
//	lon:-56 //Starting londitude
//	includeUnknown: false //Do not eliminate if location not known
//}
//}


function IDSearch(list, query) {
  if (query === undefined) {
    return list;
  }

  var components = query.split(",");

  if (components.length === 0) {
    return list;
  } //No IDs to search for.


  for (var item in list) {
    var river = list[item];

    if (!components.includes(river.id)) {
      delete list[item];
    }
  }

  return list;
} //This doesn't work for difficulty and rating - no greater than or equal to.
//That needs to be added


function advancedSearch(list, query) {
  //List is the array of river elements that we are searching
  //Query is the search parameters
  console.log(recursiveAssign({}, query));

  for (var property in query) {
    //Iterate through each part of the query
    var parameters = query[property];

    if (["name", "section", "writeup"].includes(property)) {
      list = stringFilter(list, property, parameters);
    } else if (property === "normalSearch" || property === "sort") {//These are delt with later
    } else if (property === "skill") {
      list = skillFilter(list, parameters);
    } else if (property === "rating") {
      list = ratingFilter(list, parameters);
    } else if (property === "location") {
      list = locationFilter(list, parameters);
    } else if (property === "flow") {
      list = flowFilter(list, parameters);
    } else if (property === "tags") {
      list = tagsFilter(list, parameters);
    } else if (property === "id") {
      list = IDSearch(list, parameters);
    } else {
      alert("Unable to search based on " + property);
    }
  }

  list = list.filter(function (item) {
    return item !== undefined;
  });

  if (query["normalSearch"] !== undefined) {
    list = normalSearch(list, query["normalSearch"]);
  }

  if (query["sort"]) {
    list = sortUtils.sort(query["sort"].query, list, query["sort"].reverse);
  }

  return list;
}

module.exports = {
  normalSearch: normalSearch,
  advancedSearch: advancedSearch
};

/***/ }),
/* 118 */
/***/ (function(module, exports) {

function lambert(lat1, lon1, lat2, lon2) {
  //Should be accurate to <100 meters
  //Parameters from WGS-84
  var radius = 3963.1905919430524; //Equatorial radius in miles

  var flattening = 0.0033528106647474805;
  lat1 = lat1 / 180 * Math.PI;
  lon1 = lon1 / 180 * Math.PI;
  lat2 = lat2 / 180 * Math.PI;
  lon2 = lon2 / 180 * Math.PI;
  var ratio = 1 - flattening;
  var reducedLat1 = Math.atan(ratio * Math.tan(lat1));
  var reducedLat2 = Math.atan(ratio * Math.tan(lat2)); //Spherical Law of Cosines

  var angle = Math.acos(Math.sin(reducedLat1) * Math.sin(reducedLat2) + Math.cos(reducedLat1) * Math.cos(reducedLat2) * Math.cos(lon2 - lon1));
  var p = (reducedLat1 + reducedLat2) / 2;
  var q = (reducedLat2 - reducedLat1) / 2;
  var x = (angle - Math.sin(angle)) * (Math.pow(Math.sin(p), 2) * Math.pow(Math.cos(q), 2) / Math.pow(Math.cos(angle / 2), 2));
  var y = (angle + Math.sin(angle)) * (Math.pow(Math.cos(p), 2) * Math.pow(Math.sin(q), 2) / Math.pow(Math.sin(angle / 2), 2));
  return radius * (angle - flattening / 2 * (x + y));
}

module.exports = {
  lambert: lambert
};

/***/ }),
/* 119 */
/***/ (function(module, exports, __webpack_require__) {

var _typeof = __webpack_require__(88);

//Used to determine where search parameters match the default.
//This is rather ineffecient, because it has to be called twice. A new system (probably using object.keys()) should be used instead.
function _objectsEqual(obj1, obj2) {
  //Tells if all properties, recursively, match.
  //Avoid property of undefined issues.
  if (obj1 === undefined || obj2 === undefined) {
    if (obj1 !== obj2) {
      return false;
    }

    return true;
  }

  for (var property in obj1) {
    if (_typeof(obj1[property]) === "object") {
      if (!objectsEqual(obj1[property], obj2[property])) {
        return false;
      }
    } else {
      if (obj1[property] !== obj2[property]) {
        return false;
      }
    }
  }

  return true;
}

function objectsEqual(obj1, obj2) {
  return _objectsEqual(obj1, obj2) && _objectsEqual(obj2, obj1);
}

function deleteMatchingPortions(obj1, obj2) {
  //Deletes all properties on obj1, recursively, that are identical to obj2
  if (!obj1 || !obj2) {
    return obj1;
  }

  for (var property in obj1) {
    if (_typeof(obj1[property]) === "object") {
      if (objectsEqual(obj1[property], obj2[property])) {
        //If the objects are equal, delete them.
        delete obj1[property];
      } //With an array, positional data can be totally lost by this. Do not delete portions of arrays.
      else if (!(obj1[property] instanceof Array)) {
          //Delete the portions of the objects that match.
          deleteMatchingPortions(obj1[property], obj2[property]);
        }
    } else {
      if (obj1[property] === obj2[property]) {
        delete obj1[property];
      }
    }
  }

  return obj1;
}

function recursiveAssign(target) {
  if ((arguments.length <= 1 ? 0 : arguments.length - 1) > 1) {
    for (var i = 0; i < (arguments.length <= 1 ? 0 : arguments.length - 1); i++) {
      recursiveAssign(target, i + 1 < 1 || arguments.length <= i + 1 ? undefined : arguments[i + 1]);
    }
  } else {
    var object = arguments.length <= 1 ? undefined : arguments[1];

    for (var property in object) {
      if (_typeof(object[property]) === "object") {
        if (_typeof(target[property]) !== "object") {
          //Fixing needed!!!
          //Right here we need to clone, recursively, object[property]
          //Object.assign() is only one level deep.
          target[property] = recursiveAssign({}, object[property]);
        } else {
          //Setting target[property] to the result probably isn't needed.
          target[property] = recursiveAssign(target[property], object[property]);
        }
      } else {
        target[property] = object[property];
      }
    }
  }

  return target;
}

module.exports = {
  recursiveAssign: recursiveAssign,
  deleteMatchingPortions: deleteMatchingPortions,
  objectsEqual: objectsEqual
};

/***/ }),
/* 120 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(20);

__webpack_require__(29);

__webpack_require__(33);

function highlightFailingFields(parameters) {
  //Input checking. Highlight fields that fail in red.
  if (!toDecimalDegrees(parameters.location.lat) && (toDecimalDegrees(parameters.location.lon) || Number(parameters.location.distance) > 0)) {
    document.getElementById("latitudeQuery").style.border = "3px solid red";
  } else {
    document.getElementById("latitudeQuery").style.border = "";
  }

  if (!toDecimalDegrees(parameters.location.lon) && (toDecimalDegrees(parameters.location.lat) || Number(parameters.location.distance) > 0)) {
    document.getElementById("longitudeQuery").style.border = "3px solid red";
  } else {
    document.getElementById("longitudeQuery").style.border = "";
  }

  if (!(Number(parameters.location.distance) > 0) && (toDecimalDegrees(parameters.location.lat) || toDecimalDegrees(parameters.location.lon))) {
    document.getElementById("distanceQuery").style.border = "3px solid red";
  } else {
    document.getElementById("distanceQuery").style.border = "";
  }
} //Generate advanced search parameters from menu


window.getAdvancedSearchParameters = function (filter) {
  //filter: Filter out parameters that match defaults.
  var parameters = {};
  parameters.name = {
    type: document.getElementById("nameType").value,
    query: document.getElementById("nameQuery").value
  };
  parameters.section = {
    type: document.getElementById("sectionType").value,
    query: document.getElementById("sectionQuery").value
  };
  parameters.writeup = {
    type: document.getElementById("writeupType").value,
    query: document.getElementById("writeupQuery").value
  };
  parameters.location = {
    lat: document.getElementById("latitudeQuery").value,
    lon: document.getElementById("longitudeQuery").value,
    distance: document.getElementById("distanceQuery").value,
    includeUnknown: document.getElementById("includeUnknownLocation").checked //ID search is currently hidden from the user.

  };
  parameters.id = window.IDSearchParameters;
  parameters.tags = {
    query: document.getElementById("tagsQuery").value
  };
  parameters.skill = {
    type: "from",
    query: [Number(document.getElementById("skillQuery1").value), Number(document.getElementById("skillQuery2").value)],
    includeUnknown: document.getElementById("includeUnknownSkill").checked
  };
  parameters.normalSearch = document.getElementById("searchbox").value;
  parameters.flow = {
    type: "from",
    query: [Number(document.getElementById("flowQuery1").value), Number(document.getElementById("flowQuery2").value)],
    includeDams: document.getElementById("includeDams").checked,
    includeUnknown: document.getElementById("includeUnknownFlow").checked
  };
  parameters.sort = {
    query: document.getElementById("sortQuery").value,
    reverse: document.getElementById("sortQueryReverse").checked
  };
  highlightFailingFields(parameters);
  return parameters;
};

window.setMenuFromSearch = function (query) {
  query = recursiveAssign(window.getAdvancedSearchParameters(), query);
  document.getElementById("nameType").value = query.name.type;
  document.getElementById("nameQuery").value = query.name.query;
  document.getElementById("sectionType").value = query.section.type;
  document.getElementById("sectionQuery").value = query.section.query;
  document.getElementById("writeupType").value = query.writeup.type;
  document.getElementById("writeupQuery").value = query.writeup.query;
  document.getElementById("distanceQuery").value = query.location.distance;
  document.getElementById("includeUnknownLocation").checked = query.location.includeUnknown;
  document.getElementById("latitudeQuery").value = query.location.lat;
  document.getElementById("longitudeQuery").value = query.location.lon;
  document.getElementById("tagsQuery").value = query.tags.query;
  document.getElementById("skillQuery1").value = query.skill.query[0];
  document.getElementById("skillQuery2").value = query.skill.query[1];
  document.getElementById("includeUnknownSkill").checked = query.skill.includeUnknown;
  document.getElementById("searchbox").value = query.normalSearch;
  document.getElementById("normalSearchBoxOnAdvancedSearch").value = query.normalSearch;
  document.getElementById("flowQuery1").value = query.flow.query[0];
  document.getElementById("flowQuery2").value = query.flow.query[1];
  document.getElementById("includeDams").checked = query.flow.includeDams;
  document.getElementById("includeUnknownFlow").checked = query.flow.includeUnknown;
  document.getElementById("sortQuery").value = query.sort.query;
  document.getElementById("sortQueryReverse").checked = query.sort.reverse; //ID search is currently hidden from the user.

  window.IDSearchParameters = query.id;
  highlightFailingFields(query);
}; //Previously I just used the initial state of the HTML fields to calculate defaultAdvancedSearchParameters (call getAdvancedSearchParameters at page load) - 
//However Chrome will remember the state of input fields if the hits the back button to go back to the page (sometimes with the app to), causing issues.
//This is probably a feature intended to stop users from losing form inputs if they navigate accidentally - meaning that filing a bug report would be useless.


window.defaultAdvancedSearchParameters = {
  "name": {
    "type": "contains",
    "query": ""
  },
  "section": {
    "type": "contains",
    "query": ""
  },
  "writeup": {
    "type": "contains",
    "query": ""
  },
  "location": {
    "lat": "",
    "lon": "",
    "distance": "",
    "includeUnknown": false
  },
  "tags": {
    "query": ""
  },
  "skill": {
    "type": "from",
    "query": [1, 8],
    "includeUnknown": true
  },
  "normalSearch": "",
  "flow": {
    "type": "from",
    "query": [0, 4],
    "includeDams": true,
    "includeUnknown": true
  },
  "sort": {
    "query": "none",
    "reverse": false
  }
};
window.setMenuFromSearch(window.defaultAdvancedSearchParameters);

/***/ }),
/* 121 */
/***/ (function(module, exports, __webpack_require__) {

var _regeneratorRuntime = __webpack_require__(61);

__webpack_require__(36);

__webpack_require__(26);

__webpack_require__(122);

__webpack_require__(52);

var _asyncToGenerator = __webpack_require__(77);

__webpack_require__(20);

//Prepare the Advanced Search button
var advanced_search_modal = document.getElementById('advanced-search-modal');

var span = document.getElementById("advanced-search-modal-close").onclick = function () {
  advanced_search_modal.style.display = "none";
};

window.addEventListener("click", function (event) {
  if (event.target === advanced_search_modal) {
    advanced_search_modal.style.display = "none";
  }
});
document.getElementById("advancedsearch").addEventListener("click", function () {
  advanced_search_modal.style.display = "block";
}); //For dynamic searching, we may want to use the keyup event instead of input if there are performance issues when users hold down delete.
//Event listeners for the normal search boxes.

document.querySelectorAll("#searchbox, #normalSearchBoxOnAdvancedSearch").forEach(function (element) {
  element.addEventListener("input", function searchBoxKeyPress(event) {
    //If the user presses the "Go" button (Actually an Enter/Return), unfocus the searchbox.
    if (event.keyCode === 13) {
      event.target.blur();
    }

    var query = window.getAdvancedSearchParameters();
    query.sort.query = "none"; //Normal searches apply their own sorting. query.sort will override this.

    query.normalSearch = event.target.value;
    setMenuFromSearch(query); //Make sure the user knows that the sort has been canceled.

    NewList(query);
  });
}); //Advanced search event listeners.

var elements = document.querySelectorAll("#advanced-search-modal > .modal-content > input, " + "#advanced-search-modal > .modal-content > select, " + "#advanced-search-modal > .modal-content > #locationSearchPortion > input").forEach(function (element) {
  function input() {
    //If the user presses the "Go" key (Actually an Enter/Return), unfocus the searchbox.
    if (event.keyCode === 13) {
      event.target.blur();
    }

    NewList();
  }

  element.addEventListener("input", input);
  element.addEventListener("change", input); //Some browsers don't fire input event in some cases due to bugs

  element.addEventListener("click", input); //Just an extra precaution.
});

function calculateCoordinates() {
  return _calculateCoordinates.apply(this, arguments);
}

function _calculateCoordinates() {
  _calculateCoordinates = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee() {
    var status, num, progress, position, output, _status, coords;

    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            status = document.getElementById("locationProgress");
            num = 0;
            progress = setInterval(function () {
              num = (num + 1) % 6;
              status.innerHTML = "Calculating your Approximate Location (Expect this to take 15-60 seconds)" + ".".repeat(num);
            }, 500);
            _context.prev = 3;
            _context.next = 6;
            return new Promise(function (resolve, reject) {
              navigator.geolocation.getCurrentPosition(resolve, reject);
            });

          case 6:
            position = _context.sent;
            _context.next = 21;
            break;

          case 9:
            _context.prev = 9;
            _context.t0 = _context["catch"](3);
            output = "Your device encountered an error when attempting to find your position. "; //Message for POSITION_UNAVAILABLE error.

            if (!_context.t0.PERMISSION_DENIED) {
              _context.next = 17;
              break;
            }

            _context.next = 15;
            return navigator.permissions.query({
              name: 'geolocation'
            });

          case 15:
            _status = _context.sent;

            if (_status.state === "granted") {
              //If we do have location permission, odds are that the browser did not. Tell that to the user.
              //Browsers used to do this, but it looks like they now give a POSITION_UNAVAILABLE error.
              output = "It appears that your browser could not access your location. Make sure that location services is enabled and allowed for your browser.";
            } else if (_status.state === "denied") {
              //If the user denied permission, tell the user that they need to enable it.
              output = "You denied rivers.run access to your location. Please enable location permission in site settings.";
            } else if (_status.state === "prompt") {
              //If the user dismissed the prompt, tell them that they need to click Allow.
              output = "It appears that you dismissed the permission prompt. To find your location, you need to grant the location permission.";
            }

          case 17:
            output += "\n\nError message: " + _context.t0.message;
            alert(output);
            clearInterval(progress);
            status.innerHTML = output;

          case 21:
            coords = position.coords;
            clearInterval(progress);
            document.getElementById("latitudeQuery").value = coords.latitude;
            document.getElementById("longitudeQuery").value = coords.longitude;
            status.innerHTML = "You are within " + coords.accuracy + " meters of " + coords.latitude + " degrees latitude and " + coords.longitude + " degrees longitude.";
            NewList();

          case 27:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, null, [[3, 9]]);
  }));
  return _calculateCoordinates.apply(this, arguments);
}

document.getElementById("calculateCoordinates").addEventListener("click", calculateCoordinates);
elements = document.querySelectorAll(".clearAdvancedSearch");

for (var i = 0; i < elements.length; i++) {
  elements[i].addEventListener("click", function () {
    if (confirm("Are you sure that you would like to clear the advanced search query?")) {
      //Reset all but normalSearch
      var query = recursiveAssign({}, window.defaultAdvancedSearchParameters);
      query.normalSearch = getAdvancedSearchParameters().normalSearch;
      window.setMenuFromSearch(query);
      NewList();
    }
  });
}

var ipLocation = document.getElementById("ipLocation");

try {
  fetch("https://rivers.run/node/ip2location").then(function (response) {
    response.json().then(function (locationInfo) {
      ipLocation.innerHTML = "Would you like to use coordinates for " + locationInfo.city + ", " + locationInfo.region + "?";
      ipLocation.style.display = "block";

      function close() {
        //IP2Location wants attribution.
        ipLocation.innerHTML = "IP to geolocation data from <a href='https://lite.ip2location.com'>http://lite.ip2location.com</a>";
        ipLocation.style.opacity = 0;
        ipLocation.style.fontSize = 0;
        setTimeout(function () {
          ipLocation.remove();
        }, 3000);
      }

      var yes = document.createElement("button");
      yes.innerHTML = "Yes";
      yes.addEventListener("click", function () {
        var query = window.getAdvancedSearchParameters();
        query.location.lat = locationInfo.latitude;
        query.location.lon = locationInfo.longitude;
        window.setMenuFromSearch(query);
        close();
      });
      ipLocation.appendChild(yes);
      var no = document.createElement("button");
      no.innerHTML = "No";
      no.addEventListener("click", function () {
        close();
      });
      ipLocation.appendChild(no);
    });
  });
} catch (e) {
  console.error(e);
}

/***/ }),
/* 122 */
/***/ (function(module, exports, __webpack_require__) {

var $export = __webpack_require__(4);

$export($export.P, 'String', {
  // 21.1.3.13 String.prototype.repeat(count)
  repeat: __webpack_require__(123)
});


/***/ }),
/* 123 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var toInteger = __webpack_require__(17);
var defined = __webpack_require__(9);

module.exports = function repeat(count) {
  var str = String(defined(this));
  var res = '';
  var n = toInteger(count);
  if (n < 0 || n == Infinity) throw RangeError("Count can't be negative");
  for (;n > 0; (n >>>= 1) && (str += str)) if (n & 1) res += str;
  return res;
};


/***/ }),
/* 124 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(20);

window.timesNewListCalled = 0; //Used to handle advanced search links with flow, and to prevent drawing rivers from an older search.

var previousSearchQuery; //Used to avoid spending CPU to do the same search query again.

window.NewList = function () {
  var query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : recursiveAssign({}, defaultAdvancedSearchParameters, window.getAdvancedSearchParameters());

  //For the advanced search paramters, use the defaults in all non-specified cases. This is ineffecient because we run a search with every parameter, even when that parameter is useless (as the defaults are).
  if (objectsEqual(previousSearchQuery, query)) {
    //The search query is the same as the one that was run before. Ignore it.
    console.log("Killed search");
    return;
  }

  previousSearchQuery = query;
  timesNewListCalled++;
  var orderedlist = ItemHolder.slice(0); //Clone the array

  orderedlist = advancedSearch(orderedlist, query); //Clear Current

  ItemHolder.forEach(function (event) {
    event.delete();
  }); //Append New

  var div = document.getElementById("Rivers"); //To avoid lagging, append a small amount of rivers at the start, then finish adding rivers in the background.

  var completed = 0;
  var callNumber = timesNewListCalled;

  function drawMore() {
    var milliseconds = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 8;
    //Draw rivers to the screen for milliseconds milliseconds.
    var start = Date.now();

    for (; completed < orderedlist.length; completed++) {
      if (Date.now() - start > milliseconds || callNumber !== timesNewListCalled) {
        break;
      }

      div.appendChild(orderedlist[completed].create());
    }

    return {
      finished: completed >= orderedlist.length,
      time: Date.now() - start //Really slow devices may take more than the allocated amount of time to finish

    };
  }

  function asyncDraw() {
    var drawing = drawMore();

    if (callNumber === timesNewListCalled && !drawing.finished) {
      setTimeout(asyncDraw, Math.min(Math.max(16, drawing.time * 2), 100));
    }
  }

  asyncDraw();
  query = deleteMatchingPortions(query, defaultAdvancedSearchParameters); //Filter out parameters where the default is used.
  //Add link to this search to the advanced search menu.

  var link; //If the only parameter is normalSearch, create a normal search link.

  if (query.normalSearch && objectsEqual(query, {
    normalSearch: query.normalSearch
  })) {
    link = encodeURI(window.root + "#" + query.normalSearch);
  } else if (objectsEqual(query, {})) {
    link = window.root; //There is no search. Provide the link to this page.
  } else {
    link = encodeURI(window.root + "#" + JSON.stringify(query)); //There are advanced search parameters other than normalSearch. Show the advanced search warning.
  }

  document.getElementById("searchlink").innerHTML = "Link to this search: <a target=\"_blank\" href=\"" + link + "\">" + link + "</a>";

  try {
    history.replaceState("", document.title, link);
  } catch (e) {
    console.error(e);
  } //If there are parameters other than normalSearch and sort, show the advanced search warning


  if (objectsEqual(query, {
    normalSearch: query.normalSearch,
    sort: query.sort
  })) {
    document.getElementById("advancedSearchWarning").style.display = "none"; //No parameters other than sort and normalSearch
  } else {
    document.getElementById("advancedSearchWarning").style.display = "block"; //Advanced search is in affect!
  }
};

/***/ }),
/* 125 */
/***/ (function(module, exports) {

function drawColors(canvas, height) {
  var context = canvas.getContext("2d"); //Some browsers flip screen.width and screen.height on rotation - some don't
  //window.innerWidth fails - the window is expanded to handle the width of the legend
  //Then the legend doesn't resize (because the window has resized to it)
  //This seems to be the only simple cross browser solution, although it fails if numerous rotations are made

  var tooLowLightness = window.darkMode ? "23%" : "67%";
  var tooHighLightness = window.darkMode ? "20%" : "69%";
  var normalValueLightness = window.darkMode ? "25%" : "70%";
  canvas.width = document.documentElement.clientWidth;
  canvas.height = height;
  var gradient = context.createLinearGradient(0, 0, canvas.width, 0); //Horizontal gradient

  var redColor = "hsl(0,100%," + tooLowLightness + ")";
  var blueColor = "hsl(240,100%," + tooHighLightness + ")";
  gradient.addColorStop(0, redColor);
  gradient.addColorStop(0.08, redColor);
  var start = 0.08;
  var end = 0.92;
  var range = end - start; //240 is number of whole number hsl values

  for (var i = 0; i <= 240; i++) {
    gradient.addColorStop(start + i / 240 * range, "hsl(" + i + ",100%," + normalValueLightness + ")");
  }

  gradient.addColorStop(0.92, blueColor);
  gradient.addColorStop(1, blueColor);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
} //To makes these stand out slightly better, styles have been changed from the striping applied to the rivers.
//In addition, the canvas does some weird things (why did changing from transparent black to transparent white do anything?),
//and makes some features of linear-gradient tough to use.


function drawStripes(canvas) {
  var newColor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : window.darkMode ? "rgba(256,256,256,0.4)" : "rgba(170,170,170,0.33)";
  var oldColor = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : window.darkMode ? "rgba(255,255,255,0)" : "rgba(0,0,0,0)";
  //Stripe the bottom (has dam) portion of the legend.
  var context = canvas.getContext("2d");
  var angle = 60 / 180 * Math.PI; //First number is degrees

  var gradient = context.createLinearGradient(0, 0, canvas.width * Math.cos(angle), canvas.width * Math.sin(angle));

  for (var i = 0; i < 37; i++) {
    gradient.addColorStop(i / 36, i % 3 ? oldColor : newColor);
  }

  console.log(gradient);
  context.fillStyle = gradient; //Apply stripes to bottom 40% of legend.

  context.fillRect(0, canvas.height * 3 / 5, canvas.width, canvas.height);
}

function drawText(canvas, fontSize) {
  var context = canvas.getContext("2d");
  context.fillStyle = window.darkMode ? "white" : "black"; //The fourth parameter is the maximum width of the text in pixels
  //We use it here, but it takes an extremely small screen before it comes into affect.

  var maxWidth = canvas.width / 5;
  var height = fontSize;
  context.font = fontSize + "px Arial";
  context.textAlign = "start";
  context.fillText("Too Low", 0, height, maxWidth);
  context.textAlign = "center"; //Draw the "Has Dam text at the center on the bottom, in smaller text."

  context.font = fontSize / 1.15 + "px Arial";
  context.fillText("Has Dam", canvas.width / 2, canvas.height - height / 4);
  context.font = fontSize + "px Arial"; //Low Flow and High Flow confine the legend, making the range for low-high flow between 8% and 92%. Because of this, lowflow is 29% (8+84*0.25), and highflow is 71%.

  context.fillText("Low Flow", canvas.width * 0.29, height, maxWidth);
  context.fillText("Mid Flow", canvas.width / 2, height, maxWidth);
  context.fillText("High Flow", canvas.width * 0.71, height, maxWidth); //Black text on blue is near inivisible - so use white text on blue

  if (!window.darkMode) {
    context.fillStyle = "white";
  }

  context.textAlign = "end";
  context.fillText("Too High", canvas.width, height, maxWidth);
}

function makeSticky(canvas) {
  //Make the legend stick to the top of the screen
  //We should use position:sticky here, but there were some issues with it in Safari.
  //canvas.style.position = "-webkit-sticky"
  //canvas.style.position = "sticky"
  //canvas.style.top = 0
  canvas.style.zIndex = 2; //Show up on top of stars.

  window.addEventListener("scroll", function () {
    //We could use canvas.offsetTop, but that doesn't work with absolute positioning, and can't be calculated once,
    //because warnings and alerts above the canvas can change the correct offset.
    //As such, we will use #topbar, and subtract the height of the canvas.
    var elementOffset = document.getElementById("topbar").offsetTop - canvas.height;
    var pageOffset = window.pageYOffset;

    if (pageOffset > elementOffset) {
      canvas.style.position = "fixed";
      canvas.style.top = 0;
      document.body.style.paddingTop = canvas.height + "px"; //Avoid sudden jerk in page content
    } else {
      canvas.style.position = "";
      canvas.style.top = "";
      document.body.style.paddingTop = 0;
    }
  });
}

function updateLegend() {
  try {
    var canvas = document.getElementById("legend");
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    var fontSize = parseFloat(window.getComputedStyle(document.getElementById("Rivers").firstChild).getPropertyValue("font-size"));
    var height; //Picked what I thought looked best

    if (fontSize > 18) {
      height = 10 + fontSize * 2;
    } else if (fontSize > 14.8) {
      fontSize *= 1.2;
      height = 10 + fontSize * 2;
    } else {
      fontSize *= 1.4;
      height = 10 + fontSize * 2;
    } //Smart watch mode


    if (window.innerWidth <= 309) {
      fontSize = window.innerWidth * 0.032 * 1.5;
      height = 10 + fontSize * 2;
    }

    drawColors(canvas, height);
    drawText(canvas, fontSize);
    drawStripes(canvas);
    makeSticky(canvas);
  } catch (e) {
    //Something went badly wrong. Prevent from taking down whole page.
    console.error("Legend failed to draw. Logging error.");
    console.error(e);
  }
}

window.addEventListener("resize", updateLegend); //orientationchange should be fired on resize, but some browsers (such as Safari) do not

window.addEventListener("orientationchange", updateLegend);
window.addEventListener("colorSchemeChanged", updateLegend);
updateLegend();

/***/ })
/******/ ]);
//# sourceMappingURL=index.js.map