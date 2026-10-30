var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod2) => function __require() {
  try {
    return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
  } catch (e) {
    throw mod2 = 0, e;
  }
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
var __toESM = (mod2, isNodeMode, target) => (target = mod2 != null ? __create(__getProtoOf(mod2)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod2 || !mod2.__esModule ? __defProp(target, "default", { value: mod2, enumerable: true }) : target,
  mod2
));
var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function anumber(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes(value, length, title = "") {
  if (isBytes(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber(length, "length");
  const bytes3 = isBytes(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes3 ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes3)
    throw new TypeError(message);
  throw new RangeError(message);
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new TypeError("expected hash wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
  if (h.outputLen < 1 || h.blockLen < 1)
    throw new Error("hash blockLen / outputLen must be >= 1");
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function bytesToHex(bytes3) {
  abytes(bytes3);
  if (hasHexBuiltin)
    return bytes3.toHex();
  let hex2 = "";
  for (let i = 0; i < bytes3.length; i++) {
    hex2 += hexes[bytes3[i]];
  }
  return hex2;
}
function asciiToBase16(ch) {
  return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
}
function hexToBytes(hex2) {
  if (typeof hex2 !== "string")
    throw new TypeError("hex string expected, got " + typeof hex2);
  if (hasHexBuiltin) {
    try {
      return Uint8Array.fromHex(hex2);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new RangeError(error.message);
      throw error;
    }
  }
  const hl = hex2.length;
  const al = hl / 2;
  if (hl % 2)
    throw new RangeError("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex2.charCodeAt(hi));
    const n2 = asciiToBase16(hex2.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex2[hi] + hex2[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new TypeError("string expected");
  const encoded = new TextEncoder().encode(str);
  try {
    return new Uint8Array(encoded);
  } finally {
    clean(encoded);
  }
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function checkOpts(defaults, opts, title = "opts") {
  aopts(defaults, "defaults");
  if (opts !== void 0)
    aopts(opts, title);
  const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
  return merged;
}
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = /* @__PURE__ */ __name((msg, opts) => hashCons(opts).update(msg).digest(), "hashC");
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes(bytesLength = 32) {
  anumber(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  if (bytesLength > 65536)
    throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var atitle, aobject, aopts, hasHexBuiltin, hexes, oidNist;
var init_utils = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/utils.js"() {
    __name(isBytes, "isBytes");
    atitle = /* @__PURE__ */ __name((title) => title ? `"${title}" ` : "", "atitle");
    __name(anumber, "anumber");
    __name(abytes, "abytes");
    __name(ahash, "ahash");
    aobject = /* @__PURE__ */ __name((value, label) => {
      if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
    }, "aobject");
    aopts = /* @__PURE__ */ __name((value, label) => {
      aobject(value, label);
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null)
        throw new TypeError(`"${label}" expected plain object`);
      if (Object.hasOwn(value, "__proto__"))
        throw new TypeError(`"${label}.__proto__" is not allowed`);
    }, "aopts");
    __name(aexists, "aexists");
    __name(aoutput, "aoutput");
    __name(clean, "clean");
    __name(createView, "createView");
    __name(rotr, "rotr");
    hasHexBuiltin = /* @__PURE__ */ (() => (
      // @ts-ignore
      typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
    ))();
    hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    __name(bytesToHex, "bytesToHex");
    __name(asciiToBase16, "asciiToBase16");
    __name(hexToBytes, "hexToBytes");
    __name(utf8ToBytes, "utf8ToBytes");
    __name(concatBytes, "concatBytes");
    __name(checkOpts, "checkOpts");
    __name(createHasher, "createHasher");
    __name(randomBytes, "randomBytes");
    oidNist = /* @__PURE__ */ __name((suffix) => ({
      // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
      // Larger suffix values would need base-128 OID encoding and a different length byte.
      oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
    }), "oidNist");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/hmac.js
var hmac_exports = {};
__export(hmac_exports, {
  _HMAC: () => _HMAC,
  hmac: () => hmac
});
var _HMAC, hmac;
var init_hmac = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/hmac.js"() {
    init_utils();
    _HMAC = class {
      static {
        __name(this, "_HMAC");
      }
      oHash;
      iHash;
      blockLen;
      outputLen;
      canXOF = false;
      finished = false;
      destroyed = false;
      constructor(hash, key) {
        ahash(hash);
        abytes(key, void 0, "key");
        this.iHash = hash.create();
        if (typeof this.iHash.update !== "function")
          throw new Error("expected Hash instance");
        this.blockLen = this.iHash.blockLen;
        this.outputLen = this.iHash.outputLen;
        const blockLen = this.blockLen;
        const pad = new Uint8Array(blockLen);
        pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54;
        this.iHash.update(pad);
        this.oHash = hash.create();
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54 ^ 92;
        this.oHash.update(pad);
        clean(pad);
      }
      update(buf) {
        aexists(this);
        this.iHash.update(buf);
        return this;
      }
      digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        const buf = out.subarray(0, this.outputLen);
        this.iHash.digestInto(buf);
        this.oHash.update(buf);
        this.oHash.digestInto(buf);
        this.destroy();
      }
      digest() {
        const out = new Uint8Array(this.oHash.outputLen);
        this.digestInto(out);
        return out;
      }
      _cloneInto(to) {
        to ||= Object.create(Object.getPrototypeOf(this), {});
        const { oHash, iHash, finished, destroyed, blockLen, outputLen, canXOF } = this;
        to = to;
        to.finished = finished;
        to.destroyed = destroyed;
        to.blockLen = blockLen;
        to.outputLen = outputLen;
        to.canXOF = canXOF;
        to.oHash = oHash._cloneInto(to.oHash);
        to.iHash = iHash._cloneInto(to.iHash);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
      destroy() {
        this.destroyed = true;
        this.oHash.destroy();
        this.iHash.destroy();
      }
    };
    hmac = /* @__PURE__ */ (() => {
      const hmac_ = /* @__PURE__ */ __name(((hash, key, message) => new _HMAC(hash, key).update(message).digest()), "hmac_");
      hmac_.create = (hash, key) => new _HMAC(hash, key);
      return hmac_;
    })();
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/hkdf.js
var hkdf_exports = {};
__export(hkdf_exports, {
  expand: () => expand,
  extract: () => extract,
  hkdf: () => hkdf
});
function extract(hash, ikm, salt) {
  ahash(hash);
  if (salt === void 0)
    salt = new Uint8Array(hash.outputLen);
  return hmac(hash, salt, ikm);
}
function expand(hash, prk, info, length = 32, _recycled) {
  ahash(hash);
  anumber(length, "length");
  abytes(prk, void 0, "prk");
  const olen = hash.outputLen;
  if (prk.length < olen)
    throw new Error('"prk" must be at least HashLen octets');
  if (length > 255 * olen)
    throw new Error("Length must be <= 255*HashLen");
  const blocks = Math.ceil(length / olen);
  if (info === void 0)
    info = EMPTY_BUFFER;
  else
    abytes(info, void 0, "info");
  if (!blocks) {
    if (_recycled)
      clean(prk);
    return new Uint8Array();
  }
  const okm = _recycled && blocks === 1 ? prk : new Uint8Array(blocks * olen);
  const { iHash, oHash } = hmac.create(hash, prk);
  const T = _recycled ? prk : new Uint8Array(olen);
  const worker = blocks > 1 ? _recycled?.iHash || hash.create() : void 0;
  for (let counter = 0; counter < blocks - 1; counter++) {
    HKDF_COUNTER[0] = counter + 1;
    const iWork = iHash._cloneInto(worker);
    if (counter)
      iWork.update(T);
    iWork.update(info).update(HKDF_COUNTER).digestInto(T);
    oHash._cloneInto(worker).update(T).digestInto(T);
    okm.set(T, olen * counter);
  }
  HKDF_COUNTER[0] = blocks;
  if (blocks > 1)
    iHash.update(T);
  iHash.update(info).update(HKDF_COUNTER).digestInto(T);
  oHash.update(T).digestInto(T);
  okm.set(T, olen * (blocks - 1));
  iHash.destroy();
  oHash.destroy();
  worker?.destroy();
  if (T !== okm)
    clean(T);
  clean(HKDF_COUNTER);
  if (length === okm.length)
    return okm;
  const res = okm.slice(0, length);
  clean(okm);
  return res;
}
var HKDF_COUNTER, EMPTY_BUFFER, hkdf;
var init_hkdf = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/hkdf.js"() {
    init_hmac();
    init_utils();
    __name(extract, "extract");
    HKDF_COUNTER = /* @__PURE__ */ Uint8Array.of(0);
    EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
    __name(expand, "expand");
    hkdf = /* @__PURE__ */ __name((hash, ikm, salt, info, length) => {
      ahash(hash);
      if (salt === void 0)
        salt = new Uint8Array(hash.outputLen);
      const HMAC = hmac.create(hash, salt).update(ikm);
      return expand(hash, HMAC.digest(), info, length, HMAC);
    }, "hkdf");
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/hkdf.js
var require_hkdf = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/hkdf.js"(exports, module) {
    module.exports = (init_hkdf(), __toCommonJS(hkdf_exports));
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/_u64.js
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
function setU64FromNum(view, byteOffset, n, isLE2) {
  const h = fromNumH(n);
  const l = fromNumL(n);
  view.setUint32(byteOffset, isLE2 ? l : h, isLE2);
  view.setUint32(byteOffset + 4, isLE2 ? h : l, isLE2);
}
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var U32_MASK64, _32n, fromNumH, fromNumL, shrSH, shrSL, rotrSH, rotrSL, rotrBH, rotrBL, add3L, add3H, add4L, add4H, add5L, add5H;
var init_u64 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/_u64.js"() {
    U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();
    _32n = /* @__PURE__ */ BigInt(32);
    __name(fromBig, "fromBig");
    __name(split, "split");
    fromNumH = /* @__PURE__ */ __name((n) => n / 2 ** 32 | 0, "fromNumH");
    fromNumL = /* @__PURE__ */ __name((n) => n >>> 0, "fromNumL");
    __name(setU64FromNum, "setU64FromNum");
    shrSH = /* @__PURE__ */ __name((h, _l, s) => h >>> s, "shrSH");
    shrSL = /* @__PURE__ */ __name((h, l, s) => h << 32 - s | l >>> s, "shrSL");
    rotrSH = /* @__PURE__ */ __name((h, l, s) => h >>> s | l << 32 - s, "rotrSH");
    rotrSL = /* @__PURE__ */ __name((h, l, s) => h << 32 - s | l >>> s, "rotrSL");
    rotrBH = /* @__PURE__ */ __name((h, l, s) => h << 64 - s | l >>> s - 32, "rotrBH");
    rotrBL = /* @__PURE__ */ __name((h, l, s) => h >>> s - 32 | l << 64 - s, "rotrBL");
    __name(add, "add");
    add3L = /* @__PURE__ */ __name((Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0), "add3L");
    add3H = /* @__PURE__ */ __name((low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0, "add3H");
    add4L = /* @__PURE__ */ __name((Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0), "add4L");
    add4H = /* @__PURE__ */ __name((low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0, "add4H");
    add5L = /* @__PURE__ */ __name((Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0), "add5L");
    add5H = /* @__PURE__ */ __name((low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0, "add5H");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD, SHA256_IV, SHA224_IV, SHA384_IV, SHA512_IV;
var init_md = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/_md.js"() {
    init_u64();
    init_utils();
    __name(Chi, "Chi");
    __name(Maj, "Maj");
    HashMD = class {
      static {
        __name(this, "HashMD");
      }
      blockLen;
      outputLen;
      canXOF = false;
      padOffset;
      isLE;
      // For partial updates less than block size
      buffer;
      view;
      finished = false;
      length = 0;
      pos = 0;
      destroyed = false;
      constructor(blockLen, outputLen, padOffset, isLE2) {
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE2;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView(this.buffer);
      }
      update(data) {
        aexists(this);
        abytes(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        let processed = false;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            const dataView = createView(data);
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(dataView, pos);
            processed = true;
            continue;
          }
          buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
            processed = true;
          }
        }
        this.length += data.length;
        if (processed)
          this.roundClean();
        return this;
      }
      digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE: isLE2 } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        buffer.fill(0, pos);
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          buffer.fill(0);
        }
        setU64FromNum(view, blockLen - 8, this.length * 8, isLE2);
        this.process(view, 0);
        this.roundClean();
        const oview = out === buffer ? view : createView(out);
        const len = this.outputLen;
        const outLen = len / 4;
        const state = this.get();
        if (len % 4 || outLen > state.length)
          throw new Error("invalid outputLen");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE2);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneIntoMeta(to) {
        const { buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (pos)
          to.buffer.set(buffer);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
    };
    SHA256_IV = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    SHA224_IV = /* @__PURE__ */ Uint32Array.from([
      3238371032,
      914150663,
      812702999,
      4144912697,
      4290775857,
      1750603025,
      1694076839,
      3204075428
    ]);
    SHA384_IV = /* @__PURE__ */ Uint32Array.from([
      3418070365,
      3238371032,
      1654270250,
      914150663,
      2438529370,
      812702999,
      355462360,
      4144912697,
      1731405415,
      4290775857,
      2394180231,
      1750603025,
      3675008525,
      1694076839,
      1203062813,
      3204075428
    ]);
    SHA512_IV = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      4089235720,
      3144134277,
      2227873595,
      1013904242,
      4271175723,
      2773480762,
      1595750129,
      1359893119,
      2917565137,
      2600822924,
      725511199,
      528734635,
      4215389547,
      1541459225,
      327033209
    ]);
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/sha2.js
var sha2_exports = {};
__export(sha2_exports, {
  _SHA224: () => _SHA224,
  _SHA256: () => _SHA256,
  _SHA384: () => _SHA384,
  _SHA512: () => _SHA512,
  _SHA512_224: () => _SHA512_224,
  _SHA512_256: () => _SHA512_256,
  sha224: () => sha224,
  sha256: () => sha256,
  sha384: () => sha384,
  sha512: () => sha512,
  sha512_224: () => sha512_224,
  sha512_256: () => sha512_256
});
var SHA256_K, SHA256_W, SHA2_32B, _SHA256, _SHA224, K512, SHA512_Kh, SHA512_Kl, SHA512_W_H, SHA512_W_L, SHA2_64B, _SHA512, _SHA384, T224_IV, T256_IV, _SHA512_224, _SHA512_256, sha256, sha224, sha512, sha384, sha512_256, sha512_224;
var init_sha2 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/sha2.js"() {
    init_md();
    init_u64();
    init_utils();
    SHA256_K = /* @__PURE__ */ Uint32Array.from([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    SHA2_32B = class extends HashMD {
      static {
        __name(this, "SHA2_32B");
      }
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      // Numeric initializers matter: starting the fields as `undefined` changes
      // V8's field representation and makes sha256 3x slower (measured).
      A = 0;
      B = 0;
      C = 0;
      D = 0;
      E = 0;
      F = 0;
      G = 0;
      H = 0;
      constructor(outputLen, IV) {
        super(64, outputLen, 8, false);
        this.A = IV[0] | 0;
        this.B = IV[1] | 0;
        this.C = IV[2] | 0;
        this.D = IV[3] | 0;
        this.E = IV[4] | 0;
        this.F = IV[5] | 0;
        this.G = IV[6] | 0;
        this.H = IV[7] | 0;
      }
      get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
      }
      // prettier-ignore
      set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      _cloneInto(to) {
        (to ||= new this.constructor()).set(...this.get());
        return this._cloneIntoMeta(to);
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W[i - 15];
          const W2 = SHA256_W[i - 2];
          const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
          const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
          SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
        }
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
          const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
          const T2 = sigma0 + Maj(A, B, C) | 0;
          H = G;
          G = F;
          F = E;
          E = D + T1 | 0;
          D = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D = D + this.D | 0;
        E = E + this.E | 0;
        F = F + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D, E, F, G, H);
      }
      roundClean() {
        clean(SHA256_W);
      }
      destroy() {
        this.destroyed = true;
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean(this.buffer);
      }
    };
    _SHA256 = class extends SHA2_32B {
      static {
        __name(this, "_SHA256");
      }
      constructor() {
        super(32, SHA256_IV);
      }
    };
    _SHA224 = class extends SHA2_32B {
      static {
        __name(this, "_SHA224");
      }
      constructor() {
        super(28, SHA224_IV);
      }
    };
    K512 = /* @__PURE__ */ (() => split([
      "0x428a2f98d728ae22",
      "0x7137449123ef65cd",
      "0xb5c0fbcfec4d3b2f",
      "0xe9b5dba58189dbbc",
      "0x3956c25bf348b538",
      "0x59f111f1b605d019",
      "0x923f82a4af194f9b",
      "0xab1c5ed5da6d8118",
      "0xd807aa98a3030242",
      "0x12835b0145706fbe",
      "0x243185be4ee4b28c",
      "0x550c7dc3d5ffb4e2",
      "0x72be5d74f27b896f",
      "0x80deb1fe3b1696b1",
      "0x9bdc06a725c71235",
      "0xc19bf174cf692694",
      "0xe49b69c19ef14ad2",
      "0xefbe4786384f25e3",
      "0x0fc19dc68b8cd5b5",
      "0x240ca1cc77ac9c65",
      "0x2de92c6f592b0275",
      "0x4a7484aa6ea6e483",
      "0x5cb0a9dcbd41fbd4",
      "0x76f988da831153b5",
      "0x983e5152ee66dfab",
      "0xa831c66d2db43210",
      "0xb00327c898fb213f",
      "0xbf597fc7beef0ee4",
      "0xc6e00bf33da88fc2",
      "0xd5a79147930aa725",
      "0x06ca6351e003826f",
      "0x142929670a0e6e70",
      "0x27b70a8546d22ffc",
      "0x2e1b21385c26c926",
      "0x4d2c6dfc5ac42aed",
      "0x53380d139d95b3df",
      "0x650a73548baf63de",
      "0x766a0abb3c77b2a8",
      "0x81c2c92e47edaee6",
      "0x92722c851482353b",
      "0xa2bfe8a14cf10364",
      "0xa81a664bbc423001",
      "0xc24b8b70d0f89791",
      "0xc76c51a30654be30",
      "0xd192e819d6ef5218",
      "0xd69906245565a910",
      "0xf40e35855771202a",
      "0x106aa07032bbd1b8",
      "0x19a4c116b8d2d0c8",
      "0x1e376c085141ab53",
      "0x2748774cdf8eeb99",
      "0x34b0bcb5e19b48a8",
      "0x391c0cb3c5c95a63",
      "0x4ed8aa4ae3418acb",
      "0x5b9cca4f7763e373",
      "0x682e6ff3d6b2b8a3",
      "0x748f82ee5defb2fc",
      "0x78a5636f43172f60",
      "0x84c87814a1f0ab72",
      "0x8cc702081a6439ec",
      "0x90befffa23631e28",
      "0xa4506cebde82bde9",
      "0xbef9a3f7b2c67915",
      "0xc67178f2e372532b",
      "0xca273eceea26619c",
      "0xd186b8c721c0c207",
      "0xeada7dd6cde0eb1e",
      "0xf57d4f7fee6ed178",
      "0x06f067aa72176fba",
      "0x0a637dc5a2c898a6",
      "0x113f9804bef90dae",
      "0x1b710b35131c471b",
      "0x28db77f523047d84",
      "0x32caab7b40c72493",
      "0x3c9ebe0a15c9bebc",
      "0x431d67c49c100d4c",
      "0x4cc5d4becb3e42b6",
      "0x597f299cfc657e2a",
      "0x5fcb6fab3ad6faec",
      "0x6c44198c4a475817"
    ].map((n) => BigInt(n))))();
    SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
    SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
    SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
    SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
    SHA2_64B = class extends HashMD {
      static {
        __name(this, "SHA2_64B");
      }
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      // h -- high 32 bits, l -- low 32 bits
      // Numeric initializers matter: starting the fields as `undefined` changes
      // V8's field representation and slows hashing down (measured on sha256).
      Ah = 0;
      Al = 0;
      Bh = 0;
      Bl = 0;
      Ch = 0;
      Cl = 0;
      Dh = 0;
      Dl = 0;
      Eh = 0;
      El = 0;
      Fh = 0;
      Fl = 0;
      Gh = 0;
      Gl = 0;
      Hh = 0;
      Hl = 0;
      constructor(outputLen, IV) {
        super(128, outputLen, 16, false);
        this.Ah = IV[0] | 0;
        this.Al = IV[1] | 0;
        this.Bh = IV[2] | 0;
        this.Bl = IV[3] | 0;
        this.Ch = IV[4] | 0;
        this.Cl = IV[5] | 0;
        this.Dh = IV[6] | 0;
        this.Dl = IV[7] | 0;
        this.Eh = IV[8] | 0;
        this.El = IV[9] | 0;
        this.Fh = IV[10] | 0;
        this.Fl = IV[11] | 0;
        this.Gh = IV[12] | 0;
        this.Gl = IV[13] | 0;
        this.Hh = IV[14] | 0;
        this.Hl = IV[15] | 0;
      }
      // prettier-ignore
      get() {
        const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
      }
      // prettier-ignore
      set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
        this.Ah = Ah | 0;
        this.Al = Al | 0;
        this.Bh = Bh | 0;
        this.Bl = Bl | 0;
        this.Ch = Ch | 0;
        this.Cl = Cl | 0;
        this.Dh = Dh | 0;
        this.Dl = Dl | 0;
        this.Eh = Eh | 0;
        this.El = El | 0;
        this.Fh = Fh | 0;
        this.Fl = Fl | 0;
        this.Gh = Gh | 0;
        this.Gl = Gl | 0;
        this.Hh = Hh | 0;
        this.Hl = Hl | 0;
      }
      _cloneInto(to) {
        (to ||= new this.constructor()).set(...this.get());
        return this._cloneIntoMeta(to);
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4) {
          SHA512_W_H[i] = view.getUint32(offset);
          SHA512_W_L[i] = view.getUint32(offset += 4);
        }
        for (let i = 16; i < 80; i++) {
          const W15h = SHA512_W_H[i - 15] | 0;
          const W15l = SHA512_W_L[i - 15] | 0;
          const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
          const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
          const W2h = SHA512_W_H[i - 2] | 0;
          const W2l = SHA512_W_L[i - 2] | 0;
          const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
          const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
          const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
          const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
          SHA512_W_H[i] = SUMh | 0;
          SHA512_W_L[i] = SUMl | 0;
        }
        let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        for (let i = 0; i < 80; i++) {
          const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
          const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
          const CHIh = Eh & Fh ^ ~Eh & Gh;
          const CHIl = El & Fl ^ ~El & Gl;
          const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
          const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
          const T1l = T1ll | 0;
          const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
          const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
          const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
          const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
          Hh = Gh | 0;
          Hl = Gl | 0;
          Gh = Fh | 0;
          Gl = Fl | 0;
          Fh = Eh | 0;
          Fl = El | 0;
          ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
          Dh = Ch | 0;
          Dl = Cl | 0;
          Ch = Bh | 0;
          Cl = Bl | 0;
          Bh = Ah | 0;
          Bl = Al | 0;
          const All = add3L(T1l, sigma0l, MAJl);
          Ah = add3H(All, T1h, sigma0h, MAJh);
          Al = All | 0;
        }
        ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
        ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
        ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
        ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
        ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
        ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
        ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
        ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
        this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
      }
      roundClean() {
        clean(SHA512_W_H, SHA512_W_L);
      }
      destroy() {
        this.destroyed = true;
        clean(this.buffer);
        this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      }
    };
    _SHA512 = class extends SHA2_64B {
      static {
        __name(this, "_SHA512");
      }
      constructor() {
        super(64, SHA512_IV);
      }
    };
    _SHA384 = class extends SHA2_64B {
      static {
        __name(this, "_SHA384");
      }
      constructor() {
        super(48, SHA384_IV);
      }
    };
    T224_IV = /* @__PURE__ */ Uint32Array.from([
      2352822216,
      424955298,
      1944164710,
      2312950998,
      502970286,
      855612546,
      1738396948,
      1479516111,
      258812777,
      2077511080,
      2011393907,
      79989058,
      1067287976,
      1780299464,
      286451373,
      2446758561
    ]);
    T256_IV = /* @__PURE__ */ Uint32Array.from([
      573645204,
      4230739756,
      2673172387,
      3360449730,
      596883563,
      1867755857,
      2520282905,
      1497426621,
      2519219938,
      2827943907,
      3193839141,
      1401305490,
      721525244,
      746961066,
      246885852,
      2177182882
    ]);
    _SHA512_224 = class extends SHA2_64B {
      static {
        __name(this, "_SHA512_224");
      }
      constructor() {
        super(28, T224_IV);
      }
    };
    _SHA512_256 = class extends SHA2_64B {
      static {
        __name(this, "_SHA512_256");
      }
      constructor() {
        super(32, T256_IV);
      }
    };
    sha256 = /* @__PURE__ */ createHasher(
      () => new _SHA256(),
      /* @__PURE__ */ oidNist(1)
    );
    sha224 = /* @__PURE__ */ createHasher(
      () => new _SHA224(),
      /* @__PURE__ */ oidNist(4)
    );
    sha512 = /* @__PURE__ */ createHasher(
      () => new _SHA512(),
      /* @__PURE__ */ oidNist(3)
    );
    sha384 = /* @__PURE__ */ createHasher(
      () => new _SHA384(),
      /* @__PURE__ */ oidNist(2)
    );
    sha512_256 = /* @__PURE__ */ createHasher(
      () => new _SHA512_256(),
      /* @__PURE__ */ oidNist(6)
    );
    sha512_224 = /* @__PURE__ */ createHasher(
      () => new _SHA512_224(),
      /* @__PURE__ */ oidNist(5)
    );
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/sha2.js
var require_sha2 = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/sha2.js"(exports, module) {
    module.exports = (init_sha2(), __toCommonJS(sha2_exports));
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/utils.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function abool(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle2(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function anumber2(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle2(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle2(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes2(value, length, title = "") {
  if (isBytes2(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber2(length, "length");
  const bytes3 = isBytes2(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes3 ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle2(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes3)
    throw new TypeError(message);
  throw new RangeError(message);
}
function aexists2(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput2(out, instance) {
  abytes2(out, void 0, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function aoutput32(out, instance) {
  aoutput2(out, instance);
  if (!isAligned32(out))
    throw new Error("invalid output, must be aligned");
}
function u8(arr) {
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean2(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView2(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
function overlapBytes(a, b) {
  if (!a.byteLength || !b.byteLength)
    return false;
  return a.buffer === b.buffer && // best we can do, may fail with an obscure Proxy
  a.byteOffset < b.byteOffset + b.byteLength && // a starts before b end
  b.byteOffset < a.byteOffset + a.byteLength;
}
function complexOverlapBytes(input, output) {
  if (overlapBytes(input, output) && input.byteOffset < output.byteOffset)
    throw new Error("complex overlap of input and output is not supported");
}
function concatBytes2(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes2(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function checkOpts2(defaults, opts) {
  aobject2(defaults, "defaults");
  aobject2(opts, "opts");
  const merged = Object.assign(defaults, opts);
  return merged;
}
function equalBytes(a, b) {
  a = abytes2(a);
  b = abytes2(b);
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function wrapMacConstructor(keyLen, macCons, fromMsg) {
  const mac = macCons;
  const getArgs = fromMsg || (() => []);
  const macC = /* @__PURE__ */ __name((msg, key) => mac(key, ...getArgs(msg)).update(msg).digest(), "macC");
  const tmp = mac(new Uint8Array(keyLen), ...getArgs(new Uint8Array(0)));
  macC.outputLen = tmp.outputLen;
  macC.blockLen = tmp.blockLen;
  macC.create = (key, ...args) => mac(key, ...args);
  return macC;
}
function getOutput(expectedLength, out, onlyAligned = true) {
  if (out === void 0)
    return new Uint8Array(expectedLength);
  abytes2(out, expectedLength, "output");
  if (onlyAligned && !isAligned32(out))
    throw new Error("invalid output, must be aligned");
  return out;
}
function u64Lengths(dataLength, aadLength, isLE2) {
  anumber2(dataLength);
  anumber2(aadLength);
  abool(isLE2);
  const num = new Uint8Array(16);
  const view = createView2(num);
  view.setBigUint64(0, BigInt(aadLength), isLE2);
  view.setBigUint64(8, BigInt(dataLength), isLE2);
  return num;
}
function isAligned32(bytes3) {
  return bytes3.byteOffset % 4 === 0;
}
function copyBytes(bytes3) {
  return Uint8Array.from(abytes2(bytes3));
}
function randomBytes2(bytesLength = 32) {
  anumber2(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  if (bytesLength > 65536)
    throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var atitle2, aobject2, isLE, swap8IfBE, swap32IfBE, wrapCipher;
var init_utils2 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/utils.js"() {
    __name(isBytes2, "isBytes");
    atitle2 = /* @__PURE__ */ __name((title) => title ? `"${title}" ` : "", "atitle");
    __name(abool, "abool");
    __name(anumber2, "anumber");
    __name(abytes2, "abytes");
    aobject2 = /* @__PURE__ */ __name((value, label) => {
      if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new TypeError(label === "object" ? "expected valid options object" : `"${label}" expected object, got type=${typeof value}`);
    }, "aobject");
    __name(aexists2, "aexists");
    __name(aoutput2, "aoutput");
    __name(aoutput32, "aoutput32");
    __name(u8, "u8");
    __name(u32, "u32");
    __name(clean2, "clean");
    __name(createView2, "createView");
    isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    __name(byteSwap, "byteSwap");
    swap8IfBE = isLE ? (n) => n : (n) => byteSwap(n) >>> 0;
    __name(byteSwap32, "byteSwap32");
    swap32IfBE = isLE ? (u) => u : byteSwap32;
    __name(overlapBytes, "overlapBytes");
    __name(complexOverlapBytes, "complexOverlapBytes");
    __name(concatBytes2, "concatBytes");
    __name(checkOpts2, "checkOpts");
    __name(equalBytes, "equalBytes");
    __name(wrapMacConstructor, "wrapMacConstructor");
    wrapCipher = /* @__PURE__ */ __name(/* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
      function wrappedCipher(key, ...args) {
        abytes2(key, void 0, "key");
        if (params.nonceLength !== void 0) {
          const nonce = args[0];
          abytes2(nonce, params.varSizeNonce ? void 0 : params.nonceLength, "nonce");
        }
        const tagl = params.tagLength;
        const aadStart = params.nonceLength !== void 0 ? 1 : 0;
        if (!params.withAAD) {
          for (let i = aadStart; i < args.length; i++)
            if (isBytes2(args[i]))
              throw new Error("AAD not supported");
        }
        if (params.withAAD && args[aadStart] !== void 0)
          abytes2(args[aadStart], void 0, "AAD");
        const cipher = constructor(key, ...args);
        const checkOutput = /* @__PURE__ */ __name((fnLength, output) => {
          if (output !== void 0) {
            if (fnLength !== 2)
              throw new Error("cipher output not supported");
            abytes2(output, void 0, "output");
          }
        }, "checkOutput");
        let called = false;
        const wrCipher = {
          encrypt(data, output) {
            if (called)
              throw new Error("cannot encrypt() twice with same key + nonce");
            called = true;
            abytes2(data, void 0, "data");
            checkOutput(cipher.encrypt.length, output);
            return cipher.encrypt(data, output);
          },
          decrypt(data, output) {
            abytes2(data, void 0, "data");
            if (tagl && data.length < tagl)
              throw new Error('"ciphertext" expected length >= tagLength=' + tagl);
            checkOutput(cipher.decrypt.length, output);
            return cipher.decrypt(data, output);
          }
        };
        return wrCipher;
      }
      __name(wrappedCipher, "wrappedCipher");
      Object.assign(wrappedCipher, params);
      return wrappedCipher;
    }, "wrapCipher");
    __name(getOutput, "getOutput");
    __name(u64Lengths, "u64Lengths");
    __name(isAligned32, "isAligned32");
    __name(copyBytes, "copyBytes");
    __name(randomBytes2, "randomBytes");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/_polyval.js
function _toGHASHKey(k) {
  k.reverse();
  const hiBit = k[15] & 1;
  let carry = 0;
  for (let i = 0; i < k.length; i++) {
    const t = k[i];
    k[i] = t >>> 1 | carry;
    carry = (t & 1) << 7;
  }
  k[0] ^= -hiBit & 225;
  return k;
}
var BLOCK_SIZE, ZEROS16, ZEROS32, POLY, mul2, swapLE, swap8IfLE, estimateWindow, GHASH, Polyval, ghash, polyval;
var init_polyval = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/_polyval.js"() {
    init_utils2();
    BLOCK_SIZE = 16;
    ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
    ZEROS32 = /* @__PURE__ */ u32(ZEROS16);
    POLY = 225;
    mul2 = /* @__PURE__ */ __name((s0, s1, s2, s3) => {
      const hiBit = s3 & 1;
      return {
        s3: s2 << 31 | s3 >>> 1,
        s2: s1 << 31 | s2 >>> 1,
        s1: s0 << 31 | s1 >>> 1,
        // NIST SP 800-38D §6.3 applies `V >> 1` and XORs R on carry. In this
        // 4x32-bit split, R = 0xe1 || 0^120 lives in the top byte of s0.
        s0: s0 >>> 1 ^ POLY << 24 & -(hiBit & 1)
        // reduce % poly
      };
    }, "mul2");
    swapLE = /* @__PURE__ */ __name((n) => (n >>> 0 & 255) << 24 | (n >>> 8 & 255) << 16 | (n >>> 16 & 255) << 8 | n >>> 24 & 255 | 0, "swapLE");
    swap8IfLE = /* @__PURE__ */ __name((n) => swap8IfBE(swapLE(n)), "swap8IfLE");
    __name(_toGHASHKey, "_toGHASHKey");
    estimateWindow = /* @__PURE__ */ __name((bytes3) => {
      if (bytes3 > 64 * 1024)
        return 8;
      if (bytes3 > 1024)
        return 4;
      return 2;
    }, "estimateWindow");
    GHASH = class {
      static {
        __name(this, "GHASH");
      }
      blockLen = BLOCK_SIZE;
      outputLen = BLOCK_SIZE;
      s0 = 0;
      s1 = 0;
      s2 = 0;
      s3 = 0;
      finished = false;
      destroyed = false;
      t;
      W;
      windowSize;
      // We select bits per window adaptively based on expectedLength
      constructor(key, expectedLength) {
        abytes2(key, 16, "key");
        key = copyBytes(key);
        const kView = createView2(key);
        let k0 = kView.getUint32(0, false);
        let k1 = kView.getUint32(4, false);
        let k2 = kView.getUint32(8, false);
        let k3 = kView.getUint32(12, false);
        const doubles = [];
        for (let i = 0; i < 128; i++) {
          doubles.push({ s0: swapLE(k0), s1: swapLE(k1), s2: swapLE(k2), s3: swapLE(k3) });
          ({ s0: k0, s1: k1, s2: k2, s3: k3 } = mul2(k0, k1, k2, k3));
        }
        const W = estimateWindow(expectedLength || 1024);
        if (![1, 2, 4, 8].includes(W))
          throw new Error("ghash: invalid window size, expected 2, 4 or 8");
        this.W = W;
        const bits = 128;
        const windows = bits / W;
        const windowSize = this.windowSize = 2 ** W;
        const items = [];
        for (let w = 0; w < windows; w++) {
          for (let byte = 0; byte < windowSize; byte++) {
            let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
            for (let j = 0; j < W; j++) {
              const bit = byte >>> W - j - 1 & 1;
              if (!bit)
                continue;
              const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W * w + j];
              s0 ^= d0, s1 ^= d1, s2 ^= d2, s3 ^= d3;
            }
            items.push({ s0, s1, s2, s3 });
          }
        }
        this.t = items;
      }
      _updateBlock(s0, s1, s2, s3) {
        s0 ^= this.s0, s1 ^= this.s1, s2 ^= this.s2, s3 ^= this.s3;
        const { W, t, windowSize } = this;
        let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
        const mask = (1 << W) - 1;
        let w = 0;
        for (const num of [s0, s1, s2, s3]) {
          for (let bytePos = 0; bytePos < 4; bytePos++) {
            const byte = num >>> 8 * bytePos & 255;
            for (let bitPos = 8 / W - 1; bitPos >= 0; bitPos--) {
              const bit = byte >>> W * bitPos & mask;
              const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
              o0 ^= e0, o1 ^= e1, o2 ^= e2, o3 ^= e3;
              w += 1;
            }
          }
        }
        this.s0 = o0;
        this.s1 = o1;
        this.s2 = o2;
        this.s3 = o3;
      }
      update(data) {
        aexists2(this);
        abytes2(data);
        data = copyBytes(data);
        const b32 = u32(data);
        const blocks = Math.floor(data.length / BLOCK_SIZE);
        const left = data.length % BLOCK_SIZE;
        for (let i = 0; i < blocks; i++) {
          this._updateBlock(swap8IfBE(b32[i * 4 + 0]), swap8IfBE(b32[i * 4 + 1]), swap8IfBE(b32[i * 4 + 2]), swap8IfBE(b32[i * 4 + 3]));
        }
        if (left) {
          ZEROS16.set(data.subarray(blocks * BLOCK_SIZE));
          this._updateBlock(swap8IfBE(ZEROS32[0]), swap8IfBE(ZEROS32[1]), swap8IfBE(ZEROS32[2]), swap8IfBE(ZEROS32[3]));
          clean2(ZEROS32);
        }
        return this;
      }
      destroy() {
        this.destroyed = true;
        const { t } = this;
        for (const elm of t) {
          elm.s0 = 0, elm.s1 = 0, elm.s2 = 0, elm.s3 = 0;
        }
      }
      digestInto(out) {
        aexists2(this);
        aoutput32(out, this);
        this.finished = true;
        const { s0, s1, s2, s3 } = this;
        const o32 = u32(out);
        o32[0] = s0;
        o32[1] = s1;
        o32[2] = s2;
        o32[3] = s3;
        if (!isLE)
          swap32IfBE(o32.subarray(0, BLOCK_SIZE / 4));
      }
      digest() {
        const res = new Uint8Array(BLOCK_SIZE);
        this.digestInto(res);
        this.destroy();
        return res;
      }
    };
    Polyval = class extends GHASH {
      static {
        __name(this, "Polyval");
      }
      constructor(key, expectedLength) {
        abytes2(key);
        const ghKey = _toGHASHKey(copyBytes(key));
        super(ghKey, expectedLength);
        clean2(ghKey);
      }
      update(data) {
        aexists2(this);
        abytes2(data);
        data = copyBytes(data);
        const b32 = u32(data);
        const left = data.length % BLOCK_SIZE;
        const blocks = Math.floor(data.length / BLOCK_SIZE);
        for (let i = 0; i < blocks; i++) {
          this._updateBlock(swap8IfLE(b32[i * 4 + 3]), swap8IfLE(b32[i * 4 + 2]), swap8IfLE(b32[i * 4 + 1]), swap8IfLE(b32[i * 4 + 0]));
        }
        if (left) {
          ZEROS16.set(data.subarray(blocks * BLOCK_SIZE));
          this._updateBlock(swap8IfLE(ZEROS32[3]), swap8IfLE(ZEROS32[2]), swap8IfLE(ZEROS32[1]), swap8IfLE(ZEROS32[0]));
          clean2(ZEROS32);
        }
        return this;
      }
      digestInto(out) {
        aexists2(this);
        aoutput32(out, this);
        this.finished = true;
        const view = out.subarray(0, this.outputLen);
        const { s0, s1, s2, s3 } = this;
        const o32 = u32(view);
        o32[0] = s0;
        o32[1] = s1;
        o32[2] = s2;
        o32[3] = s3;
        swap32IfBE(o32);
        view.reverse();
      }
    };
    ghash = /* @__PURE__ */ wrapMacConstructor(16, (key, expectedLength) => new GHASH(key, expectedLength), (msg) => [msg.length]);
    polyval = /* @__PURE__ */ wrapMacConstructor(16, (key, expectedLength) => new Polyval(key, expectedLength), (msg) => [msg.length]);
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/aes.js
var aes_exports = {};
__export(aes_exports, {
  __TESTS: () => __TESTS,
  aeskw: () => aeskw,
  aeskwp: () => aeskwp,
  aessiv: () => aessiv2,
  cbc: () => cbc,
  cfb: () => cfb,
  cmac: () => cmac,
  ctr: () => ctr,
  ecb: () => ecb,
  gcm: () => gcm,
  gcmsiv: () => gcmsiv,
  rngAesCtrDrbg128: () => rngAesCtrDrbg128,
  rngAesCtrDrbg256: () => rngAesCtrDrbg256,
  siv: () => siv,
  unsafe: () => unsafe
});
function validateKeyLength(key) {
  if (![16, 24, 32].includes(key.length))
    throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length=' + key.length);
}
function mul22(n) {
  return n << 1 ^ POLY2 & -(n >> 7);
}
function mul(a, b) {
  let res = 0;
  for (; b > 0; b >>= 1) {
    res ^= a & -(b & 1);
    a = mul22(a);
  }
  return res;
}
function genTtable(sbox2, fn) {
  if (sbox2.length !== 256)
    throw new Error("wrong sbox length");
  const T0 = new Uint32Array(256).map((_, j) => fn(sbox2[j]));
  const T1 = T0.map(rotl32_8);
  const T2 = T1.map(rotl32_8);
  const T3 = T2.map(rotl32_8);
  const T01 = new Uint32Array(256 * 256);
  const T23 = new Uint32Array(256 * 256);
  const sbox22 = new Uint16Array(256 * 256);
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const idx = i * 256 + j;
      T01[idx] = T0[i] ^ T1[j];
      T23[idx] = T2[i] ^ T3[j];
      sbox22[idx] = sbox2[i] << 8 | sbox2[j];
    }
  }
  return { sbox: sbox2, sbox2: sbox22, T0, T1, T2, T3, T01, T23 };
}
function expandKeyLE(key) {
  abytes2(key);
  const len = key.length;
  validateKeyLength(key);
  const { sbox2 } = tableEncoding;
  const toClean = [];
  if (!isLE || !isAligned32(key))
    toClean.push(key = copyBytes(key));
  const k32 = swap32IfBE(u32(key));
  const Nk = k32.length;
  const subByte = /* @__PURE__ */ __name((n) => applySbox(sbox2, n, n, n, n), "subByte");
  const xk = new Uint32Array(len + 28);
  xk.set(k32);
  for (let i = Nk; i < xk.length; i++) {
    let t = xk[i - 1];
    if (i % Nk === 0)
      t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
    else if (Nk > 6 && i % Nk === 4)
      t = subByte(t);
    xk[i] = xk[i - Nk] ^ t;
  }
  clean2(...toClean);
  return xk;
}
function expandKeyDecLE(key) {
  const encKey = expandKeyLE(key);
  const xk = encKey.slice();
  const Nk = encKey.length;
  const { sbox2 } = tableEncoding;
  const { T0, T1, T2, T3 } = tableDecoding;
  for (let i = 0; i < Nk; i += 4) {
    for (let j = 0; j < 4; j++)
      xk[i + j] = encKey[Nk - i - 4 + j];
  }
  clean2(encKey);
  for (let i = 4; i < Nk - 4; i++) {
    const x = xk[i];
    const w = applySbox(sbox2, x, x, x, x);
    xk[i] = T0[w & 255] ^ T1[w >>> 8 & 255] ^ T2[w >>> 16 & 255] ^ T3[w >>> 24];
  }
  return xk;
}
function apply0123(T01, T23, s0, s1, s2, s3) {
  return T01[s0 << 8 & 65280 | s1 >>> 8 & 255] ^ T23[s2 >>> 8 & 65280 | s3 >>> 24 & 255];
}
function applySbox(sbox2, s0, s1, s2, s3) {
  return sbox2[s0 & 255 | s1 & 65280] | sbox2[s2 >>> 16 & 255 | s3 >>> 16 & 65280] << 16;
}
function encrypt(xk, s0, s1, s2, s3) {
  const { sbox2, T01, T23 } = tableEncoding;
  let k = 0;
  s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
  const rounds = xk.length / 4 - 2;
  for (let i = 0; i < rounds; i++) {
    const t02 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
    const t12 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
    const t22 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
    const t32 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
    s0 = t02, s1 = t12, s2 = t22, s3 = t32;
  }
  const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
  const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
  const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
  const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
  return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function decrypt(xk, s0, s1, s2, s3) {
  const { sbox2, T01, T23 } = tableDecoding;
  let k = 0;
  s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
  const rounds = xk.length / 4 - 2;
  for (let i = 0; i < rounds; i++) {
    const t02 = xk[k++] ^ apply0123(T01, T23, s0, s3, s2, s1);
    const t12 = xk[k++] ^ apply0123(T01, T23, s1, s0, s3, s2);
    const t22 = xk[k++] ^ apply0123(T01, T23, s2, s1, s0, s3);
    const t32 = xk[k++] ^ apply0123(T01, T23, s3, s2, s1, s0);
    s0 = t02, s1 = t12, s2 = t22, s3 = t32;
  }
  const t0 = xk[k++] ^ applySbox(sbox2, s0, s3, s2, s1);
  const t1 = xk[k++] ^ applySbox(sbox2, s1, s0, s3, s2);
  const t2 = xk[k++] ^ applySbox(sbox2, s2, s1, s0, s3);
  const t3 = xk[k++] ^ applySbox(sbox2, s3, s2, s1, s0);
  return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function ctrCounter(xk, nonce, src, dst) {
  abytes2(nonce, BLOCK_SIZE2, "nonce");
  abytes2(src);
  const srcLen = src.length;
  dst = getOutput(srcLen, dst);
  complexOverlapBytes(src, dst);
  const ctr2 = nonce;
  const c32 = u32(ctr2);
  const src32 = u32(src);
  const dst32 = u32(dst);
  for (let i = 0; i + 4 <= src32.length; i += 4) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    dst32[i + 0] = src32[i + 0] ^ swap8IfBE(s0);
    dst32[i + 1] = src32[i + 1] ^ swap8IfBE(s1);
    dst32[i + 2] = src32[i + 2] ^ swap8IfBE(s2);
    dst32[i + 3] = src32[i + 3] ^ swap8IfBE(s3);
    for (let j = BLOCK_SIZE2 - 1, carry = 1; j >= 0; j--) {
      carry = carry + ctr2[j] | 0;
      ctr2[j] = carry & 255;
      carry >>>= 8;
    }
  }
  const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
  if (start < srcLen) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    const b32 = new Uint32Array([s0, s1, s2, s3]);
    swap32IfBE(b32);
    const buf = u8(b32);
    for (let i = start, pos = 0; i < srcLen; i++, pos++)
      dst[i] = src[i] ^ buf[pos];
    clean2(b32);
  }
  return dst;
}
function ctr32(xk, isLE2, nonce, src, dst) {
  abytes2(nonce, BLOCK_SIZE2, "nonce");
  abytes2(src);
  dst = getOutput(src.length, dst);
  const ctr2 = nonce;
  const c32 = u32(ctr2);
  const view = createView2(ctr2);
  const src32 = u32(src);
  const dst32 = u32(dst);
  const ctrPos = isLE2 ? 0 : 12;
  const srcLen = src.length;
  let ctrNum = view.getUint32(ctrPos, isLE2);
  for (let i = 0; i + 4 <= src32.length; i += 4) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    dst32[i + 0] = src32[i + 0] ^ swap8IfBE(s0);
    dst32[i + 1] = src32[i + 1] ^ swap8IfBE(s1);
    dst32[i + 2] = src32[i + 2] ^ swap8IfBE(s2);
    dst32[i + 3] = src32[i + 3] ^ swap8IfBE(s3);
    ctrNum = ctrNum + 1 >>> 0;
    view.setUint32(ctrPos, ctrNum, isLE2);
  }
  const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
  if (start < srcLen) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    const b32 = new Uint32Array([s0, s1, s2, s3]);
    swap32IfBE(b32);
    const buf = u8(b32);
    for (let i = start, pos = 0; i < srcLen; i++, pos++)
      dst[i] = src[i] ^ buf[pos];
    clean2(b32);
  }
  return dst;
}
function validateBlockDecrypt(data, dst) {
  abytes2(data);
  if (data.length % BLOCK_SIZE2 !== 0) {
    throw new Error("ciphertext must be multiple of " + BLOCK_SIZE2);
  }
  if (dst !== void 0) {
    getOutput(data.length, dst);
    complexOverlapBytes(data, dst);
  }
}
function validateBlockEncrypt(plaintext, pkcs5, dst) {
  abytes2(plaintext);
  let outLen = plaintext.length;
  const remaining = outLen % BLOCK_SIZE2;
  if (!pkcs5 && remaining !== 0)
    throw new Error("plaintext must be multiple of " + BLOCK_SIZE2);
  if (pkcs5) {
    let left = BLOCK_SIZE2 - remaining;
    if (!left)
      left = BLOCK_SIZE2;
    outLen = outLen + left;
  }
  if (dst !== void 0) {
    getOutput(outLen, dst);
    complexOverlapBytes(plaintext, dst);
  }
  return outLen;
}
function prepareBlockEncrypt(plaintext, outLen, dst) {
  if (dst === void 0)
    dst = new Uint8Array(outLen);
  if (!isLE || !isAligned32(plaintext))
    plaintext = copyBytes(plaintext);
  const o = u32(dst);
  return { b: plaintext, o, out: dst };
}
function validatePKCS(data, pkcs5) {
  if (!pkcs5)
    return data;
  const len = data.length;
  if (len === 0)
    throw new Error("pkcs7: empty ciphertext not allowed");
  const lastByte = data[len - 1];
  let valid = 1;
  valid &= lastByte - 1 >>> 31 ^ 1;
  valid &= 16 - lastByte >>> 31 ^ 1;
  for (let i = 0; i < 16; i++) {
    const shouldCheck = i - lastByte >>> 31;
    const eq = (data[len - 1 - i] ^ lastByte) === 0 ? 1 : 0;
    valid &= eq | shouldCheck ^ 1;
  }
  if (!valid)
    throw new Error("aes: bad decrypt");
  return data.subarray(0, len - lastByte);
}
function padPCKS(left) {
  const tmp = new Uint8Array(16);
  const tmp32 = u32(tmp);
  tmp.set(left);
  const paddingByte = BLOCK_SIZE2 - left.length;
  for (let i = BLOCK_SIZE2 - paddingByte; i < BLOCK_SIZE2; i++)
    tmp[i] = paddingByte;
  return tmp32;
}
function computeTag(fn, isLE2, key, data, AAD) {
  const aadLength = AAD ? AAD.length : 0;
  const h = fn.create(key, data.length + aadLength);
  if (AAD)
    h.update(AAD);
  const num = u64Lengths(8 * data.length, 8 * aadLength, isLE2);
  h.update(data);
  h.update(num);
  const res = h.digest();
  clean2(num);
  return res;
}
function isBytes32(a) {
  return a instanceof Uint32Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint32Array";
}
function encryptBlock(xk, block) {
  abytes2(block, 16, "block");
  if (!isBytes32(xk))
    throw new Error("_encryptBlock accepts result of expandKeyLE");
  const b32 = u32(block);
  swap32IfBE(b32);
  let { s0, s1, s2, s3 } = encrypt(xk, b32[0], b32[1], b32[2], b32[3]);
  b32[0] = s0, b32[1] = s1, b32[2] = s2, b32[3] = s3;
  swap32IfBE(b32);
  return block;
}
function decryptBlock(xk, block) {
  abytes2(block, 16, "block");
  if (!isBytes32(xk))
    throw new Error("_decryptBlock accepts result of expandKeyLE");
  const b32 = u32(block);
  swap32IfBE(b32);
  let { s0, s1, s2, s3 } = decrypt(xk, b32[0], b32[1], b32[2], b32[3]);
  b32[0] = s0, b32[1] = s1, b32[2] = s2, b32[3] = s3;
  swap32IfBE(b32);
  return block;
}
function dbl(block) {
  let carry = 0;
  for (let i = BLOCK_SIZE2 - 1; i >= 0; i--) {
    const newCarry = (block[i] & 128) >>> 7;
    block[i] = block[i] << 1 | carry;
    carry = newCarry;
  }
  block[BLOCK_SIZE2 - 1] ^= 135 & -carry;
  return block;
}
function xorBlock(a, b) {
  if (a.length !== b.length)
    throw new Error("xorBlock: blocks must have same length");
  for (let i = 0; i < a.length; i++) {
    a[i] = a[i] ^ b[i];
  }
  return a;
}
function xorend(a, b) {
  if (b.length > a.length) {
    throw new Error("xorend: expected len(B) <= len(A)");
  }
  const offset = a.length - b.length;
  for (let i = 0; i < b.length; i++) {
    a[offset + i] = a[offset + i] ^ b[i];
  }
  return a;
}
function s2v(key, strings) {
  validateKeyLength(key);
  const len = strings.length;
  if (len > 127) {
    throw new Error("s2v: expected <= 127 inputs");
  }
  if (len === 0)
    return cmac(ONE_BLOCK, key);
  let d = cmac(EMPTY_BLOCK, key);
  for (let i = 0; i < len - 1; i++) {
    dbl(d);
    const cmacResult = cmac(strings[i], key);
    xorBlock(d, cmacResult);
    clean2(cmacResult);
  }
  const s_n = strings[len - 1];
  abytes2(s_n);
  let t;
  if (s_n.byteLength >= BLOCK_SIZE2) {
    t = xorend(Uint8Array.from(s_n), d);
  } else {
    const paddedSn = new Uint8Array(BLOCK_SIZE2);
    paddedSn.set(s_n);
    paddedSn[s_n.length] = 128;
    t = xorBlock(dbl(d), paddedSn);
    clean2(paddedSn);
  }
  const result = cmac(t, key);
  clean2(d, t);
  return result;
}
var BLOCK_SIZE2, BLOCK_SIZE32, EMPTY_BLOCK, ONE_BLOCK, POLY2, incBytes, sbox, invSbox, rotr32_8, rotl32_8, tableEncoding, tableDecoding, xPowers, ctr, ecb, cbc, cfb, gcm, limit, gcmsiv, AESW, AESKW_IV, aeskw, AESKWP_IV, aeskwp, _AesCtrDRBG, createAesDrbg, rngAesCtrDrbg128, rngAesCtrDrbg256, _CMAC, cmac, siv, aessiv2, unsafe, __TESTS;
var init_aes = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/aes.js"() {
    init_polyval();
    init_utils2();
    BLOCK_SIZE2 = 16;
    BLOCK_SIZE32 = 4;
    EMPTY_BLOCK = /* @__PURE__ */ new Uint8Array(BLOCK_SIZE2);
    ONE_BLOCK = /* @__PURE__ */ Uint8Array.from([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1
    ]);
    POLY2 = 283;
    __name(validateKeyLength, "validateKeyLength");
    __name(mul22, "mul2");
    __name(mul, "mul");
    incBytes = /* @__PURE__ */ __name((data, isLE2, carry = 1) => {
      if (!Number.isSafeInteger(carry) || carry < 0 || carry > 4294967040)
        throw new Error("incBytes: wrong carry " + carry);
      abytes2(data);
      for (let i = 0; i < data.length; i++) {
        const pos = !isLE2 ? data.length - 1 - i : i;
        carry = carry + (data[pos] & 255) | 0;
        data[pos] = carry & 255;
        carry >>>= 8;
      }
    }, "incBytes");
    sbox = /* @__PURE__ */ (() => {
      const t = new Uint8Array(256);
      for (let i = 0, x = 1; i < 256; i++, x ^= mul22(x))
        t[i] = x;
      const box = new Uint8Array(256);
      box[0] = 99;
      for (let i = 0; i < 255; i++) {
        let x = t[255 - i];
        x |= x << 8;
        box[t[i]] = (x ^ x >> 4 ^ x >> 5 ^ x >> 6 ^ x >> 7 ^ 99) & 255;
      }
      clean2(t);
      return box;
    })();
    invSbox = /* @__PURE__ */ sbox.map((_, j) => sbox.indexOf(j));
    rotr32_8 = /* @__PURE__ */ __name((n) => n << 24 | n >>> 8, "rotr32_8");
    rotl32_8 = /* @__PURE__ */ __name((n) => n << 8 | n >>> 24, "rotl32_8");
    __name(genTtable, "genTtable");
    tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => mul(s, 3) << 24 | s << 16 | s << 8 | mul(s, 2));
    tableDecoding = /* @__PURE__ */ genTtable(invSbox, (s) => mul(s, 11) << 24 | mul(s, 13) << 16 | mul(s, 9) << 8 | mul(s, 14));
    xPowers = /* @__PURE__ */ (() => {
      const p = new Uint8Array(16);
      for (let i = 0, x = 1; i < 16; i++, x = mul22(x))
        p[i] = x;
      return p;
    })();
    __name(expandKeyLE, "expandKeyLE");
    __name(expandKeyDecLE, "expandKeyDecLE");
    __name(apply0123, "apply0123");
    __name(applySbox, "applySbox");
    __name(encrypt, "encrypt");
    __name(decrypt, "decrypt");
    __name(ctrCounter, "ctrCounter");
    __name(ctr32, "ctr32");
    ctr = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, /* @__PURE__ */ __name(function aesctr(key, nonce) {
      function processCtr(buf, dst) {
        abytes2(buf);
        if (dst !== void 0) {
          abytes2(dst);
          if (!isAligned32(dst))
            throw new Error("unaligned destination");
        }
        const xk = expandKeyLE(key);
        const n = copyBytes(nonce);
        const toClean = [xk, n];
        if (!isAligned32(buf))
          toClean.push(buf = copyBytes(buf));
        const out = ctrCounter(xk, n, buf, dst);
        clean2(...toClean);
        return out;
      }
      __name(processCtr, "processCtr");
      return {
        encrypt: /* @__PURE__ */ __name((plaintext, dst) => processCtr(plaintext, dst), "encrypt"),
        decrypt: /* @__PURE__ */ __name((ciphertext, dst) => processCtr(ciphertext, dst), "decrypt")
      };
    }, "aesctr"));
    __name(validateBlockDecrypt, "validateBlockDecrypt");
    __name(validateBlockEncrypt, "validateBlockEncrypt");
    __name(prepareBlockEncrypt, "prepareBlockEncrypt");
    __name(validatePKCS, "validatePKCS");
    __name(padPCKS, "padPCKS");
    ecb = /* @__PURE__ */ wrapCipher({ blockSize: 16 }, /* @__PURE__ */ __name(function aesecb(key, opts = {}) {
      const pkcs5 = !opts.disablePadding;
      return {
        encrypt(plaintext, dst) {
          const outLen = validateBlockEncrypt(plaintext, pkcs5, dst);
          const xk = expandKeyLE(key);
          const { b: input, o, out: _out } = prepareBlockEncrypt(plaintext, outLen, dst);
          const b = u32(input);
          swap32IfBE(b);
          let i = 0;
          for (; i + 4 <= b.length; ) {
            const { s0, s1, s2, s3 } = encrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
          }
          if (pkcs5) {
            const tmp32 = padPCKS(plaintext.subarray(i * 4));
            swap32IfBE(tmp32);
            const { s0, s1, s2, s3 } = encrypt(xk, tmp32[0], tmp32[1], tmp32[2], tmp32[3]);
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
            clean2(tmp32);
          }
          swap32IfBE(o);
          clean2(xk);
          if (input !== plaintext)
            clean2(input);
          return _out;
        },
        decrypt(ciphertext, dst) {
          validateBlockDecrypt(ciphertext, dst);
          const xk = expandKeyDecLE(key);
          if (dst === void 0)
            dst = new Uint8Array(ciphertext.length);
          const toClean = [xk];
          if (!isLE || !isAligned32(ciphertext))
            toClean.push(ciphertext = copyBytes(ciphertext));
          const b = u32(ciphertext);
          const o = u32(dst);
          swap32IfBE(b);
          for (let i = 0; i + 4 <= b.length; ) {
            const { s0, s1, s2, s3 } = decrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
          }
          swap32IfBE(o);
          clean2(...toClean);
          return validatePKCS(dst, pkcs5);
        }
      };
    }, "aesecb"));
    cbc = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, /* @__PURE__ */ __name(function aescbc(key, iv, opts = {}) {
      const pkcs5 = !opts.disablePadding;
      return {
        encrypt(plaintext, dst) {
          const outLen = validateBlockEncrypt(plaintext, pkcs5, dst);
          const xk = expandKeyLE(key);
          const { b: input, o, out: _out } = prepareBlockEncrypt(plaintext, outLen, dst);
          const b = u32(input);
          swap32IfBE(b);
          let _iv = iv;
          const toClean = [xk];
          if (!isLE || !isAligned32(_iv))
            toClean.push(_iv = copyBytes(_iv));
          const n32 = u32(_iv);
          swap32IfBE(n32);
          let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
          let i = 0;
          for (; i + 4 <= b.length; ) {
            s0 ^= b[i + 0], s1 ^= b[i + 1], s2 ^= b[i + 2], s3 ^= b[i + 3];
            ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
          }
          if (pkcs5) {
            const tmp32 = padPCKS(plaintext.subarray(i * 4));
            swap32IfBE(tmp32);
            s0 ^= tmp32[0], s1 ^= tmp32[1], s2 ^= tmp32[2], s3 ^= tmp32[3];
            ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
            clean2(tmp32);
          }
          swap32IfBE(o);
          clean2(...toClean);
          if (input !== plaintext)
            clean2(input);
          return _out;
        },
        decrypt(ciphertext, dst) {
          validateBlockDecrypt(ciphertext, dst);
          const xk = expandKeyDecLE(key);
          if (dst === void 0)
            dst = new Uint8Array(ciphertext.length);
          let _iv = iv;
          const toClean = [xk];
          if (!isLE || !isAligned32(_iv))
            toClean.push(_iv = copyBytes(_iv));
          const n32 = u32(_iv);
          swap32IfBE(n32);
          if (!isLE || !isAligned32(ciphertext))
            toClean.push(ciphertext = copyBytes(ciphertext));
          const b = u32(ciphertext);
          const o = u32(dst);
          swap32IfBE(b);
          let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
          for (let i = 0; i + 4 <= b.length; ) {
            const ps0 = s0, ps1 = s1, ps2 = s2, ps3 = s3;
            s0 = b[i + 0], s1 = b[i + 1], s2 = b[i + 2], s3 = b[i + 3];
            const { s0: o0, s1: o1, s2: o2, s3: o3 } = decrypt(xk, s0, s1, s2, s3);
            o[i++] = o0 ^ ps0, o[i++] = o1 ^ ps1, o[i++] = o2 ^ ps2, o[i++] = o3 ^ ps3;
          }
          swap32IfBE(o);
          clean2(...toClean);
          return validatePKCS(dst, pkcs5);
        }
      };
    }, "aescbc"));
    cfb = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, /* @__PURE__ */ __name(function aescfb(key, iv) {
      function processCfb(src, isEncrypt, dst) {
        abytes2(src);
        const srcLen = src.length;
        dst = getOutput(srcLen, dst);
        if (overlapBytes(src, dst))
          throw new Error("overlapping src and dst not supported");
        const xk = expandKeyLE(key);
        let _iv = iv;
        const toClean = [xk];
        if (!isLE || !isAligned32(_iv))
          toClean.push(_iv = copyBytes(_iv));
        if (!isLE || !isAligned32(src))
          toClean.push(src = copyBytes(src));
        const src32 = u32(src);
        const dst32 = u32(dst);
        const next32 = isEncrypt ? dst32 : src32;
        const n32 = u32(_iv);
        swap32IfBE(src32);
        swap32IfBE(n32);
        let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
        for (let i = 0; i + 4 <= src32.length; ) {
          const { s0: e0, s1: e1, s2: e2, s3: e3 } = encrypt(xk, s0, s1, s2, s3);
          dst32[i + 0] = src32[i + 0] ^ e0;
          dst32[i + 1] = src32[i + 1] ^ e1;
          dst32[i + 2] = src32[i + 2] ^ e2;
          dst32[i + 3] = src32[i + 3] ^ e3;
          s0 = next32[i++], s1 = next32[i++], s2 = next32[i++], s3 = next32[i++];
        }
        const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
        if (start < srcLen) {
          if (!isLE)
            swap32IfBE(src32.subarray(start / 4));
          ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
          const tmp = new Uint32Array([s0, s1, s2, s3]);
          swap32IfBE(tmp);
          const buf = u8(tmp);
          for (let i = start, pos = 0; i < srcLen; i++, pos++)
            dst[i] = src[i] ^ buf[pos];
          clean2(buf);
        }
        if (!isLE)
          swap32IfBE(dst32.subarray(0, start / 4));
        clean2(...toClean);
        return dst;
      }
      __name(processCfb, "processCfb");
      return {
        encrypt: /* @__PURE__ */ __name((plaintext, dst) => processCfb(plaintext, true, dst), "encrypt"),
        decrypt: /* @__PURE__ */ __name((ciphertext, dst) => processCfb(ciphertext, false, dst), "decrypt")
      };
    }, "aescfb"));
    __name(computeTag, "computeTag");
    gcm = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, withAAD: true, varSizeNonce: true }, /* @__PURE__ */ __name(function aesgcm(key, nonce, AAD) {
      if (nonce.length < 8)
        throw new Error("aes/gcm: invalid nonce length");
      const tagLength = 16;
      function _computeTag(authKey, tagMask, data) {
        const tag = computeTag(ghash, false, authKey, data, AAD);
        for (let i = 0; i < tagMask.length; i++)
          tag[i] ^= tagMask[i];
        return tag;
      }
      __name(_computeTag, "_computeTag");
      function deriveKeys() {
        const xk = expandKeyLE(key);
        const authKey = EMPTY_BLOCK.slice();
        const counter = EMPTY_BLOCK.slice();
        ctr32(xk, false, counter, counter, authKey);
        if (nonce.length === 12) {
          counter.set(nonce);
        } else {
          const nonceLen = EMPTY_BLOCK.slice();
          const view = createView2(nonceLen);
          view.setBigUint64(8, BigInt(nonce.length * 8), false);
          const g = ghash.create(authKey).update(nonce).update(nonceLen);
          g.digestInto(counter);
          g.destroy();
        }
        const tagMask = ctr32(xk, false, counter, EMPTY_BLOCK);
        return { xk, authKey, counter, tagMask };
      }
      __name(deriveKeys, "deriveKeys");
      return {
        encrypt(plaintext) {
          const { xk, authKey, counter, tagMask } = deriveKeys();
          const out = new Uint8Array(plaintext.length + tagLength);
          const toClean = [xk, authKey, counter, tagMask];
          if (!isAligned32(plaintext))
            toClean.push(plaintext = copyBytes(plaintext));
          ctr32(xk, false, counter, plaintext, out.subarray(0, plaintext.length));
          const tag = _computeTag(authKey, tagMask, out.subarray(0, out.length - tagLength));
          toClean.push(tag);
          out.set(tag, plaintext.length);
          clean2(...toClean);
          return out;
        },
        decrypt(ciphertext) {
          const { xk, authKey, counter, tagMask } = deriveKeys();
          const toClean = [xk, authKey, tagMask, counter];
          if (!isAligned32(ciphertext))
            toClean.push(ciphertext = copyBytes(ciphertext));
          const data = ciphertext.subarray(0, -tagLength);
          const passedTag = ciphertext.subarray(-tagLength);
          const tag = _computeTag(authKey, tagMask, data);
          toClean.push(tag);
          if (!equalBytes(tag, passedTag)) {
            clean2(...toClean);
            throw new Error("aes-gcm: invalid tag");
          }
          const out = ctr32(xk, false, counter, data);
          clean2(...toClean);
          return out;
        }
      };
    }, "aesgcm"));
    limit = /* @__PURE__ */ __name((name, min, max) => (value) => {
      if (!Number.isSafeInteger(value) || min > value || value > max) {
        const minmax = "[" + min + ".." + max + "]";
        throw new Error("" + name + ": expected value in range " + minmax + ", got " + value);
      }
    }, "limit");
    gcmsiv = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, withAAD: true, varSizeNonce: true }, /* @__PURE__ */ __name(function aessiv(key, nonce, AAD) {
      const tagLength = 16;
      const AAD_LIMIT = limit("AAD", 0, 2 ** 36);
      const PLAIN_LIMIT = limit("plaintext", 0, 2 ** 36);
      const NONCE_LIMIT = limit("nonce", 12, 12);
      const CIPHER_LIMIT = limit("ciphertext", 16, 2 ** 36 + 16);
      abytes2(key);
      validateKeyLength(key);
      NONCE_LIMIT(nonce.length);
      if (AAD !== void 0)
        AAD_LIMIT(AAD.length);
      function deriveKeys() {
        const xk = expandKeyLE(key);
        const encKey = new Uint8Array(key.length);
        const authKey = new Uint8Array(16);
        const toClean = [xk, encKey];
        let _nonce = nonce;
        if (!isLE || !isAligned32(_nonce))
          toClean.push(_nonce = copyBytes(_nonce));
        const n32 = u32(_nonce);
        swap32IfBE(n32);
        let s0 = 0, s1 = n32[0], s2 = n32[1], s3 = n32[2];
        let counter = 0;
        for (const derivedKey of [authKey, encKey].map(u32)) {
          const d32 = u32(derivedKey);
          for (let i = 0; i < d32.length; i += 2) {
            const { s0: o0, s1: o1 } = encrypt(xk, s0, s1, s2, s3);
            d32[i + 0] = o0;
            d32[i + 1] = o1;
            s0 = ++counter;
          }
          swap32IfBE(d32);
        }
        const res = { authKey, encKey: expandKeyLE(encKey) };
        clean2(...toClean);
        return res;
      }
      __name(deriveKeys, "deriveKeys");
      function _computeTag(encKey, authKey, data) {
        const tag = computeTag(polyval, true, authKey, data, AAD);
        for (let i = 0; i < 12; i++)
          tag[i] ^= nonce[i];
        tag[15] &= 127;
        const t32 = u32(tag);
        swap32IfBE(t32);
        let s0 = t32[0], s1 = t32[1], s2 = t32[2], s3 = t32[3];
        ({ s0, s1, s2, s3 } = encrypt(encKey, s0, s1, s2, s3));
        t32[0] = s0, t32[1] = s1, t32[2] = s2, t32[3] = s3;
        swap32IfBE(t32);
        return tag;
      }
      __name(_computeTag, "_computeTag");
      function processSiv(encKey, tag, input) {
        let block = copyBytes(tag);
        block[15] |= 128;
        const res = ctr32(encKey, true, block, input);
        clean2(block);
        return res;
      }
      __name(processSiv, "processSiv");
      return {
        encrypt(plaintext) {
          PLAIN_LIMIT(plaintext.length);
          const { encKey, authKey } = deriveKeys();
          const tag = _computeTag(encKey, authKey, plaintext);
          const toClean = [encKey, authKey, tag];
          if (!isAligned32(plaintext))
            toClean.push(plaintext = copyBytes(plaintext));
          const out = new Uint8Array(plaintext.length + tagLength);
          out.set(tag, plaintext.length);
          out.set(processSiv(encKey, tag, plaintext));
          clean2(...toClean);
          return out;
        },
        decrypt(ciphertext) {
          CIPHER_LIMIT(ciphertext.length);
          const tag = ciphertext.subarray(-tagLength);
          const { encKey, authKey } = deriveKeys();
          const toClean = [encKey, authKey];
          if (!isAligned32(ciphertext))
            toClean.push(ciphertext = copyBytes(ciphertext));
          const plaintext = processSiv(encKey, tag, ciphertext.subarray(0, -tagLength));
          const expectedTag = _computeTag(encKey, authKey, plaintext);
          toClean.push(expectedTag);
          if (!equalBytes(tag, expectedTag)) {
            clean2(plaintext, ...toClean);
            throw new Error("invalid polyval tag");
          }
          clean2(...toClean);
          return plaintext;
        }
      };
    }, "aessiv"));
    __name(isBytes32, "isBytes32");
    __name(encryptBlock, "encryptBlock");
    __name(decryptBlock, "decryptBlock");
    AESW = {
      /*
      High-level pseudocode:
      ```
      A: u64 = IV
      out = []
      for (let i=0, ctr = 0; i<6; i++) {
        for (const chunk of chunks(plaintext, 8)) {
          A ^= swapEndianess(ctr++)
          [A, res] = chunks(encrypt(A || chunk), 8);
          out ||= res
        }
      }
      out = A || out
      ```
      Decrypt is the same, but reversed.
      */
      encrypt(kek, out) {
        if (out.length >= 2 ** 32)
          throw new Error("plaintext should be less than 4gb");
        const xk = expandKeyLE(kek);
        if (out.length === 16)
          encryptBlock(xk, out);
        else {
          const o32 = u32(out);
          swap32IfBE(o32);
          let a0 = o32[0], a1 = o32[1];
          for (let j = 0, ctr2 = 1; j < 6; j++) {
            for (let pos = 2; pos < o32.length; pos += 2, ctr2++) {
              const { s0, s1, s2, s3 } = encrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
              a0 = s0, a1 = s1 ^ byteSwap(ctr2), o32[pos] = s2, o32[pos + 1] = s3;
            }
          }
          o32[0] = a0, o32[1] = a1;
          swap32IfBE(o32);
        }
        xk.fill(0);
      },
      decrypt(kek, out) {
        if (out.length - 8 >= 2 ** 32)
          throw new Error("ciphertext should be less than 4gb");
        const xk = expandKeyDecLE(kek);
        const chunks = out.length / 8 - 1;
        if (chunks === 1)
          decryptBlock(xk, out);
        else {
          const o32 = u32(out);
          swap32IfBE(o32);
          let a0 = o32[0], a1 = o32[1];
          for (let j = 0, ctr2 = chunks * 6; j < 6; j++) {
            for (let pos = chunks * 2; pos >= 1; pos -= 2, ctr2--) {
              a1 ^= byteSwap(ctr2);
              const { s0, s1, s2, s3 } = decrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
              a0 = s0, a1 = s1, o32[pos] = s2, o32[pos + 1] = s3;
            }
          }
          o32[0] = a0, o32[1] = a1;
          swap32IfBE(o32);
        }
        xk.fill(0);
      }
    };
    AESKW_IV = /* @__PURE__ */ new Uint8Array(8).fill(166);
    aeskw = /* @__PURE__ */ wrapCipher({ blockSize: 8 }, (kek) => ({
      encrypt(plaintext) {
        if (!plaintext.length || plaintext.length % 8 !== 0)
          throw new Error("invalid plaintext length");
        if (plaintext.length === 8)
          throw new Error("8-byte keys not allowed, use AESKWP");
        const out = concatBytes2(AESKW_IV, plaintext);
        AESW.encrypt(kek, out);
        return out;
      },
      decrypt(ciphertext) {
        if (ciphertext.length % 8 !== 0 || ciphertext.length < 3 * 8)
          throw new Error("invalid ciphertext length");
        const out = copyBytes(ciphertext);
        AESW.decrypt(kek, out);
        if (!equalBytes(out.subarray(0, 8), AESKW_IV))
          throw new Error("integrity check failed");
        out.subarray(0, 8).fill(0);
        return out.subarray(8);
      }
    }));
    AESKWP_IV = 2790873510;
    aeskwp = /* @__PURE__ */ wrapCipher({ blockSize: 8 }, (kek) => ({
      encrypt(plaintext) {
        if (!plaintext.length)
          throw new Error("invalid plaintext length");
        const padded = Math.ceil(plaintext.length / 8) * 8;
        const out = new Uint8Array(8 + padded);
        out.set(plaintext, 8);
        const out32 = u32(out);
        out32[0] = swap8IfBE(AESKWP_IV);
        out32[1] = swap8IfBE(byteSwap(plaintext.length));
        AESW.encrypt(kek, out);
        return out;
      },
      decrypt(ciphertext) {
        if (ciphertext.length < 16)
          throw new Error("invalid ciphertext length");
        const out = copyBytes(ciphertext);
        const o32 = u32(out);
        AESW.decrypt(kek, out);
        const len = byteSwap(swap8IfBE(o32[1])) >>> 0;
        const padded = Math.ceil(len / 8) * 8;
        if (swap8IfBE(o32[0]) !== AESKWP_IV || out.length - 8 !== padded)
          throw new Error("integrity check failed");
        for (let i = len; i < padded; i++)
          if (out[8 + i] !== 0)
            throw new Error("integrity check failed");
        out.subarray(0, 8).fill(0);
        return out.subarray(8, 8 + len);
      }
    }));
    _AesCtrDRBG = class {
      static {
        __name(this, "_AesCtrDRBG");
      }
      blockLen;
      key;
      nonce;
      state;
      reseedCnt;
      destroyed = false;
      constructor(keyLen, seed, personalization) {
        this.blockLen = ctr.blockSize;
        const keyLenBytes = keyLen / 8;
        const nonceLen = 16;
        this.state = new Uint8Array(keyLenBytes + nonceLen);
        this.key = this.state.subarray(0, keyLenBytes);
        this.nonce = this.state.subarray(keyLenBytes, keyLenBytes + nonceLen);
        this.reseedCnt = 1;
        incBytes(this.nonce, false, 1);
        this.addEntropy(seed, personalization);
      }
      update(data) {
        ctr(this.key, this.nonce).encrypt(new Uint8Array(this.state.length), this.state);
        if (data) {
          abytes2(data);
          for (let i = 0; i < data.length; i++)
            this.state[i] ^= data[i];
        }
        incBytes(this.nonce, false, 1);
      }
      // Optional `info` is additional input XORed into the reseed block and is
      // limited to the internal state width.
      addEntropy(seed, info) {
        if (this.destroyed)
          throw new Error("cannot use destroyed DRBG");
        abytes2(seed, this.state.length, "seed");
        const _seed = seed.slice();
        if (info) {
          abytes2(info);
          if (info.length > _seed.length)
            throw new Error("info length is too big");
          for (let i = 0; i < info.length; i++)
            _seed[i] ^= info[i];
        }
        this.update(_seed);
        _seed.fill(0);
        this.reseedCnt = 1;
      }
      // Optional `info` is additional input for the pre/post-update steps; bytes
      // SP 800-90A Rev. 1 CTR_DRBG without a derivation function limits
      // additional_input to seedlen, which is exactly this internal state width.
      randomBytes(len, info) {
        if (this.destroyed)
          throw new Error("cannot use destroyed DRBG");
        anumber2(len);
        if (len > 2 ** 16)
          throw new Error("requested output is too big");
        if (this.reseedCnt > 2 ** 48)
          throw new Error("entropy exhausted");
        if (info) {
          abytes2(info);
          if (info.length > this.state.length)
            throw new Error("info length is too big");
          this.update(info);
        }
        const res = new Uint8Array(len);
        ctr(this.key, this.nonce).encrypt(res, res);
        incBytes(this.nonce, false, Math.ceil(len / this.blockLen));
        this.update(info);
        this.reseedCnt++;
        return res;
      }
      // Zeroes the current state and marks the instance destroyed. Fails closed:
      // any later randomBytes()/addEntropy() throws instead of continuing from the
      // zeroed state (which would make subsequent output the predictable zero-key stream).
      clean() {
        this.state.fill(0);
        this.reseedCnt = 0;
        this.destroyed = true;
      }
    };
    createAesDrbg = /* @__PURE__ */ __name((keyLen) => {
      return (seed, personalization = void 0) => new _AesCtrDRBG(keyLen, seed, personalization);
    }, "createAesDrbg");
    rngAesCtrDrbg128 = /* @__PURE__ */ createAesDrbg(128);
    rngAesCtrDrbg256 = /* @__PURE__ */ createAesDrbg(256);
    __name(dbl, "dbl");
    __name(xorBlock, "xorBlock");
    __name(xorend, "xorend");
    _CMAC = class {
      static {
        __name(this, "_CMAC");
      }
      blockLen = BLOCK_SIZE2;
      outputLen = BLOCK_SIZE2;
      // CMAC can only decide between `K1` and `K2` once the true final block is known,
      // so updates process older blocks eagerly but keep one pending block buffered.
      buffer;
      pos;
      finished;
      destroyed;
      k1;
      k2;
      x;
      x32;
      xk;
      constructor(key) {
        abytes2(key);
        validateKeyLength(key);
        this.xk = expandKeyLE(key);
        this.buffer = new Uint8Array(BLOCK_SIZE2);
        this.pos = 0;
        this.finished = false;
        this.destroyed = false;
        this.x = new Uint8Array(BLOCK_SIZE2);
        this.x32 = u32(this.x);
        const L = new Uint8Array(BLOCK_SIZE2);
        encryptBlock(this.xk, L);
        this.k1 = dbl(L);
        this.k2 = dbl(new Uint8Array(this.k1));
      }
      // Consumes 16 bytes of `data` starting at `pos`; `pos` avoids a per-block
      // subarray view allocation in update().
      process(data, pos) {
        const { x, x32, xk } = this;
        for (let i = 0; i < BLOCK_SIZE2; i++)
          x[i] ^= data[pos + i];
        swap32IfBE(x32);
        const { s0, s1, s2, s3 } = encrypt(xk, x32[0], x32[1], x32[2], x32[3]);
        x32[0] = s0, x32[1] = s1, x32[2] = s2, x32[3] = s3;
        swap32IfBE(x32);
      }
      update(data) {
        aexists2(this);
        abytes2(data);
        let pos = 0;
        if (this.pos) {
          const take = Math.min(BLOCK_SIZE2 - this.pos, data.length);
          this.buffer.set(data.subarray(0, take), this.pos);
          this.pos += take;
          pos = take;
          if (this.pos === BLOCK_SIZE2 && pos < data.length) {
            this.process(this.buffer, 0);
            this.pos = 0;
          }
        }
        while (pos + BLOCK_SIZE2 < data.length) {
          this.process(data, pos);
          pos += BLOCK_SIZE2;
        }
        if (pos < data.length) {
          this.buffer.set(data.subarray(pos), 0);
          this.pos = data.length - pos;
        }
        return this;
      }
      // See {@link https://www.rfc-editor.org/rfc/rfc4493.html#section-2.4 | RFC 4493 Section 2.4}.
      digestInto(out) {
        aexists2(this);
        aoutput32(out, this);
        this.finished = true;
        const view = out.subarray(0, this.outputLen);
        let last = new Uint8Array(BLOCK_SIZE2);
        if (this.pos === BLOCK_SIZE2) {
          last.set(this.buffer);
          xorBlock(last, this.k1);
        } else {
          last.set(this.buffer.subarray(0, this.pos));
          last[this.pos] = 128;
          xorBlock(last, this.k2);
        }
        view.set(this.x);
        xorBlock(view, last);
        encryptBlock(this.xk, view);
        clean2(last);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      destroy() {
        const { buffer, destroyed, x, xk, k1, k2 } = this;
        if (destroyed)
          return;
        this.destroyed = true;
        clean2(buffer, x, xk, k1, k2);
      }
    };
    cmac = /* @__PURE__ */ wrapMacConstructor(16, (key) => new _CMAC(key));
    __name(s2v, "s2v");
    siv = /* @__PURE__ */ __name(() => {
      throw new Error('"siv" from v1 is now "gcmsiv"');
    }, "siv");
    aessiv2 = /* @__PURE__ */ wrapCipher({ blockSize: 16, tagLength: 16, withAAD: true }, /* @__PURE__ */ __name(function aessiv3(key, ...AAD) {
      const PLAIN_LIMIT = limit("plaintext", 0, 2 ** 132);
      const CIPHER_LIMIT = limit("ciphertext", 16, 2 ** 132 + 16);
      if (AAD.length > 126) {
        throw new Error('"AAD" expected <= 126 items');
      }
      AAD.forEach((aad) => abytes2(aad));
      abytes2(key);
      if (![32, 48, 64].includes(key.length))
        throw new Error('"aes key" expected Uint8Array of length 32/48/64, got length=' + key.length);
      const k1 = key.subarray(0, key.length / 2);
      const k2 = key.subarray(key.length / 2);
      return {
        // {@link https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.6 | RFC 5297 Section 2.6}
        encrypt(plaintext) {
          PLAIN_LIMIT(plaintext.length);
          const v = s2v(k1, [...AAD, plaintext]);
          const q = Uint8Array.from(v);
          q[8] &= 127;
          q[12] &= 127;
          const c = ctr(k2, q).encrypt(plaintext);
          return concatBytes2(v, c);
        },
        // {@link https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.7 | RFC 5297 Section 2.7}
        decrypt(ciphertext) {
          CIPHER_LIMIT(ciphertext.length);
          const v = ciphertext.subarray(0, BLOCK_SIZE2);
          const c = ciphertext.subarray(BLOCK_SIZE2);
          const q = Uint8Array.from(v);
          q[8] &= 127;
          q[12] &= 127;
          const p = ctr(k2, q).decrypt(c);
          const t = s2v(k1, [...AAD, p]);
          if (equalBytes(t, v)) {
            return p;
          } else {
            clean2(p);
            throw new Error("invalid siv tag");
          }
        }
      };
    }, "aessiv"));
    unsafe = /* @__PURE__ */ Object.freeze({
      expandKeyLE,
      expandKeyDecLE,
      encrypt,
      decrypt,
      encryptBlock,
      decryptBlock,
      ctrCounter,
      ctr32,
      dbl,
      xorBlock,
      xorend,
      s2v
    });
    __TESTS = /* @__PURE__ */ Object.freeze({
      incBytes
    });
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/ciphers/aes.js
var require_aes = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/ciphers/aes.js"(exports, module) {
    module.exports = (init_aes(), __toCommonJS(aes_exports));
  }
});

// node_modules/node-onlykey-lib/src/bytes.js
var require_bytes = __commonJS({
  "node_modules/node-onlykey-lib/src/bytes.js"(exports, module) {
    "use strict";
    var HEX = "0123456789abcdef";
    function toHex(bytes3) {
      let out = "";
      for (let i = 0; i < bytes3.length; i++) {
        const v = bytes3[i] & 255;
        out += HEX[v >>> 4] + HEX[v & 15];
      }
      return out;
    }
    __name(toHex, "toHex");
    function fromHex(hex2) {
      const clean3 = String(hex2).replace(/[\s:_-]/g, "");
      if (clean3.length % 2 !== 0) {
        throw new Error(`fromHex: odd-length hex string (${clean3.length} chars)`);
      }
      const out = new Uint8Array(clean3.length / 2);
      for (let i = 0; i < out.length; i++) {
        const hi = digit(clean3.charCodeAt(i * 2));
        const lo = digit(clean3.charCodeAt(i * 2 + 1));
        if (hi < 0 || lo < 0) {
          throw new Error(`fromHex: invalid hex at offset ${i * 2}`);
        }
        out[i] = hi << 4 | lo;
      }
      return out;
    }
    __name(fromHex, "fromHex");
    function digit(code) {
      if (code >= 48 && code <= 57) return code - 48;
      if (code >= 97 && code <= 102) return code - 97 + 10;
      if (code >= 65 && code <= 70) return code - 65 + 10;
      return -1;
    }
    __name(digit, "digit");
    function formatHex(bytes3) {
      const hex2 = typeof bytes3 === "string" ? bytes3 : toHex(bytes3);
      return (hex2.match(/.{1,2}/g) || []).join(" ");
    }
    __name(formatHex, "formatHex");
    function toLatin1(bytes3) {
      let out = "";
      for (let i = 0; i < bytes3.length; i++) out += String.fromCharCode(bytes3[i] & 255);
      return out;
    }
    __name(toLatin1, "toLatin1");
    function fromLatin1(text2) {
      const out = new Uint8Array(text2.length);
      for (let i = 0; i < text2.length; i++) out[i] = text2.charCodeAt(i) & 255;
      return out;
    }
    __name(fromLatin1, "fromLatin1");
    function toPrintable(bytes3) {
      let out = "";
      for (let i = 0; i < bytes3.length; i++) {
        const b = bytes3[i];
        if (b >= 32 && b <= 126) out += String.fromCharCode(b);
      }
      return out;
    }
    __name(toPrintable, "toPrintable");
    function concat(chunks) {
      let total = 0;
      for (const c of chunks) total += c.length;
      const out = new Uint8Array(total);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.length;
      }
      return out;
    }
    __name(concat, "concat");
    function equalConstantTime(a, b) {
      if (a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
      return diff === 0;
    }
    __name(equalConstantTime, "equalConstantTime");
    function utf8ToBytes2(text2) {
      const str = String(text2);
      const out = [];
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code >= 55296 && code <= 56319 && i + 1 < str.length) {
          const low = str.charCodeAt(i + 1);
          if (low >= 56320 && low <= 57343) {
            code = 65536 + (code - 55296 << 10) + (low - 56320);
            i++;
          }
        }
        if (code < 128) {
          out.push(code);
        } else if (code < 2048) {
          out.push(192 | code >> 6, 128 | code & 63);
        } else if (code < 65536) {
          out.push(224 | code >> 12, 128 | code >> 6 & 63, 128 | code & 63);
        } else {
          out.push(
            240 | code >> 18,
            128 | code >> 12 & 63,
            128 | code >> 6 & 63,
            128 | code & 63
          );
        }
      }
      return Uint8Array.from(out);
    }
    __name(utf8ToBytes2, "utf8ToBytes");
    function bytesToUtf8(bytes3) {
      let out = "";
      for (let i = 0; i < bytes3.length; ) {
        const b = bytes3[i];
        let code;
        let size;
        if (b < 128) {
          code = b;
          size = 1;
        } else if ((b & 224) === 192) {
          code = b & 31;
          size = 2;
        } else if ((b & 240) === 224) {
          code = b & 15;
          size = 3;
        } else if ((b & 248) === 240) {
          code = b & 7;
          size = 4;
        } else {
          out += "\uFFFD";
          i += 1;
          continue;
        }
        if (i + size > bytes3.length) {
          out += "\uFFFD";
          break;
        }
        for (let k = 1; k < size; k++) {
          const cont = bytes3[i + k];
          if ((cont & 192) !== 128) {
            code = -1;
            break;
          }
          code = code << 6 | cont & 63;
        }
        i += size;
        if (code < 0) {
          out += "\uFFFD";
          continue;
        }
        if (code > 65535) {
          code -= 65536;
          out += String.fromCharCode(55296 + (code >> 10), 56320 + (code & 1023));
        } else {
          out += String.fromCharCode(code);
        }
      }
      return out;
    }
    __name(bytesToUtf8, "bytesToUtf8");
    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    function toBase64(bytes3) {
      let out = "";
      for (let i = 0; i < bytes3.length; i += 3) {
        const a = bytes3[i];
        const b = i + 1 < bytes3.length ? bytes3[i + 1] : 0;
        const c = i + 2 < bytes3.length ? bytes3[i + 2] : 0;
        out += B64[a >> 2];
        out += B64[(a & 3) << 4 | b >> 4];
        out += i + 1 < bytes3.length ? B64[(b & 15) << 2 | c >> 6] : "=";
        out += i + 2 < bytes3.length ? B64[c & 63] : "=";
      }
      return out;
    }
    __name(toBase64, "toBase64");
    function toBase64Url(bytes3) {
      return toBase64(bytes3).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    __name(toBase64Url, "toBase64Url");
    function fromBase64Url(text2) {
      return fromBase64(String(text2).replace(/-/g, "+").replace(/_/g, "/"));
    }
    __name(fromBase64Url, "fromBase64Url");
    function fromBase64(text2) {
      const clean3 = String(text2).replace(/[^A-Za-z0-9+/]/g, "");
      const out = new Uint8Array(Math.floor(clean3.length * 3 / 4));
      let at = 0;
      let acc = 0;
      let bits = 0;
      for (const ch of clean3) {
        const v = B64.indexOf(ch);
        if (v === -1) throw new Error(`invalid base64 character "${ch}"`);
        acc = acc << 6 | v;
        bits += 6;
        if (bits >= 8) {
          bits -= 8;
          out[at++] = acc >> bits & 255;
        }
      }
      return out.subarray(0, at);
    }
    __name(fromBase64, "fromBase64");
    module.exports = {
      utf8ToBytes: utf8ToBytes2,
      bytesToUtf8,
      toBase64,
      fromBase64,
      toBase64Url,
      fromBase64Url,
      toHex,
      fromHex,
      formatHex,
      toLatin1,
      fromLatin1,
      toPrintable,
      concat,
      equalConstantTime
    };
  }
});

// node_modules/node-onlykey-lib/src/crypto/vault.js
var require_vault = __commonJS({
  "node_modules/node-onlykey-lib/src/crypto/vault.js"(exports, module) {
    "use strict";
    var { hkdf: hkdf2 } = require_hkdf();
    var { sha256: sha2562 } = require_sha2();
    var { gcm: gcm2 } = require_aes();
    var { utf8ToBytes: utf8ToBytes2, bytesToUtf8, toBase64, fromBase64 } = require_bytes();
    var HKDF_INFO = utf8ToBytes2("onlyagent-vault-v1");
    var HKDF_SALT = new Uint8Array(32);
    var NONCE_BYTES = 12;
    var TAG_BYTES = 16;
    function deriveVaultKey(sharedSecret) {
      const ikm = Uint8Array.from(sharedSecret);
      if (!ikm.length) throw new Error("the shared secret is empty");
      return hkdf2(sha2562, ikm, HKDF_SALT, HKDF_INFO, 32);
    }
    __name(deriveVaultKey, "deriveVaultKey");
    function seal(key, plaintext, randomBytes4) {
      if (typeof randomBytes4 !== "function") {
        throw new TypeError("seal needs randomBytes (from the host plugin)");
      }
      const nonce = Uint8Array.from(randomBytes4(NONCE_BYTES));
      if (nonce.length !== NONCE_BYTES) {
        throw new Error(`the nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`);
      }
      const ct = gcm2(Uint8Array.from(key), nonce).encrypt(utf8ToBytes2(String(plaintext)));
      const out = new Uint8Array(NONCE_BYTES + ct.length);
      out.set(nonce, 0);
      out.set(ct, NONCE_BYTES);
      return toBase64(out);
    }
    __name(seal, "seal");
    function open(key, blob) {
      const raw = fromBase64(String(blob));
      if (raw.length < NONCE_BYTES + TAG_BYTES) {
        throw new Error(`blob too short: ${raw.length} bytes, minimum ${NONCE_BYTES + TAG_BYTES}`);
      }
      const nonce = raw.subarray(0, NONCE_BYTES);
      const body = raw.subarray(NONCE_BYTES);
      const pt = gcm2(Uint8Array.from(key), nonce).decrypt(body);
      return bytesToUtf8(pt);
    }
    __name(open, "open");
    var DEFAULT_POLICY = "session:30m";
    function parsePolicy(policy) {
      if (!policy || policy === "always") return { ttlMs: 0, sliding: false, noCache: true };
      if (policy === "startup") return { ttlMs: 0, sliding: false, noCache: false };
      const match = /^session:(\d+)(m|h)$/.exec(policy);
      if (!match) return { ttlMs: 0, sliding: false, noCache: true };
      const value = parseInt(match[1], 10);
      const ttlMs = match[2] === "h" ? value * 36e5 : value * 6e4;
      return { ttlMs, sliding: ttlMs <= 36e5, noCache: false };
    }
    __name(parsePolicy, "parsePolicy");
    function createSessionCache({ now = Date.now, defaultPolicy = DEFAULT_POLICY } = {}) {
      const entries = /* @__PURE__ */ new Map();
      const policies = /* @__PURE__ */ new Map();
      function wipe(entry) {
        if (entry && entry.key) entry.key.fill(0);
      }
      __name(wipe, "wipe");
      function expired(entry, at) {
        if (entry.ttlMs <= 0) return false;
        const since = entry.sliding ? entry.lastUsedAt : entry.createdAt;
        return at - since > entry.ttlMs;
      }
      __name(expired, "expired");
      return {
        getPolicy(serviceId) {
          return policies.get(serviceId) || defaultPolicy;
        },
        setPolicy(serviceId, policy) {
          policies.set(serviceId, policy);
          if (parsePolicy(policy).noCache) this.evict(serviceId);
        },
        get(serviceId) {
          const entry = entries.get(serviceId);
          if (!entry) return null;
          const at = now();
          if (expired(entry, at)) {
            wipe(entry);
            entries.delete(serviceId);
            return null;
          }
          entry.lastUsedAt = at;
          return entry.key;
        },
        put(serviceId, key) {
          const policy = this.getPolicy(serviceId);
          const parsed = parsePolicy(policy);
          if (parsed.noCache) return false;
          const at = now();
          wipe(entries.get(serviceId));
          entries.set(serviceId, {
            key: Uint8Array.from(key),
            createdAt: at,
            lastUsedAt: at,
            policy,
            ttlMs: parsed.ttlMs,
            sliding: parsed.sliding
          });
          return true;
        },
        evict(serviceId) {
          wipe(entries.get(serviceId));
          return entries.delete(serviceId);
        },
        clear() {
          for (const entry of entries.values()) wipe(entry);
          entries.clear();
        },
        /** Drop everything expired. Returns the service ids that went. */
        reap() {
          const at = now();
          const gone = [];
          for (const [serviceId, entry] of entries) {
            if (expired(entry, at)) gone.push(serviceId);
          }
          for (const serviceId of gone) this.evict(serviceId);
          return gone;
        },
        /** What is cached and for how much longer, for a sessions panel. */
        status() {
          const at = now();
          return [...entries].map(([serviceId, entry]) => {
            const since = entry.sliding ? entry.lastUsedAt : entry.createdAt;
            const remainingMs = entry.ttlMs > 0 ? Math.max(0, entry.ttlMs - (at - since)) : Infinity;
            return {
              serviceId,
              policy: entry.policy,
              sliding: entry.sliding,
              remainingMs,
              remaining: remainingMs === Infinity ? "until close" : `${Math.ceil(remainingMs / 6e4)}m`
            };
          });
        },
        get size() {
          return entries.size;
        }
      };
    }
    __name(createSessionCache, "createSessionCache");
    module.exports = {
      HKDF_INFO,
      HKDF_SALT,
      NONCE_BYTES,
      TAG_BYTES,
      DEFAULT_POLICY,
      deriveVaultKey,
      seal,
      open,
      parsePolicy,
      createSessionCache
    };
  }
});

// node_modules/node-onlykey-lib/bucket/src/bucket.js
var require_bucket = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/bucket.js"(exports, module) {
    "use strict";
    var vault = require_vault();
    var FORMAT = "onlykey-bucket";
    var SEALED_FORMAT = "onlykey-bucket-sealed";
    var VERSION = 1;
    var err = /* @__PURE__ */ __name((code, message) => Object.assign(new Error(message), { code }), "err");
    var iso = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "iso");
    function create({ owner = null } = {}) {
      return { format: FORMAT, v: VERSION, owner, stores: {}, clock: null };
    }
    __name(create, "create");
    function stamp(bucket, now) {
      const t = now();
      const s = !bucket.clock || t > bucket.clock ? t : new Date(Date.parse(bucket.clock) + 1).toISOString();
      bucket.clock = s;
      return s;
    }
    __name(stamp, "stamp");
    var live = /* @__PURE__ */ __name((rec) => Boolean(rec) && !rec.archived && rec.v !== null, "live");
    function newer(a, b) {
      if (!a) return true;
      if (!b) return false;
      if (b.at !== a.at) return b.at > a.at;
      const sig = /* @__PURE__ */ __name((r) => `${r.archived ? 1 : 0}${r.v ?? ""}`, "sig");
      return sig(b) > sig(a);
    }
    __name(newer, "newer");
    function kv(bucket, name, { now = iso } = {}) {
      if (!name || typeof name !== "string") throw new Error("a store needs a name");
      const store = /* @__PURE__ */ __name(() => {
        if (!bucket.stores[name]) bucket.stores[name] = {};
        return bucket.stores[name];
      }, "store");
      return {
        getItem(key) {
          const rec = (bucket.stores[name] || {})[key];
          return live(rec) ? rec.v : null;
        },
        setItem(key, value) {
          const text2 = String(value);
          const rec = store()[key];
          if (live(rec) && rec.v === text2) return;
          store()[key] = { v: text2, at: stamp(bucket, now) };
        },
        /* never deleted: the value stays, archived and dated, until purgeArchived() */
        removeItem(key) {
          const rec = store()[key];
          if (!live(rec)) return;
          store()[key] = { v: rec.v, at: stamp(bucket, now), archived: true };
        },
        keys() {
          return Object.keys(bucket.stores[name] || {}).filter((k) => live(bucket.stores[name][k]));
        },
        /** the archived keys - removed, still kept */
        archivedKeys() {
          return Object.keys(bucket.stores[name] || {}).filter((k) => (bucket.stores[name][k] || {}).archived === true);
        }
      };
    }
    __name(kv, "kv");
    function canonical(value) {
      if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
      if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
      }
      return JSON.stringify(value);
    }
    __name(canonical, "canonical");
    function serialize(bucket) {
      return canonical(bucket);
    }
    __name(serialize, "serialize");
    function parse(text2) {
      let b;
      try {
        b = JSON.parse(String(text2));
      } catch (e) {
        throw err("EBUCKET_FORMAT", `not a bucket: ${e.message}`);
      }
      if (!b || b.format !== FORMAT) throw err("EBUCKET_FORMAT", 'not a bucket (no "onlykey-bucket" format)');
      if (b.v !== VERSION) throw err("EBUCKET_VERSION", `bucket version ${b.v}; this build reads ${VERSION}`);
      if (!b.stores || typeof b.stores !== "object") throw err("EBUCKET_FORMAT", "a bucket without stores");
      for (const [name, store] of Object.entries(b.stores)) {
        for (const [key, rec] of Object.entries(store || {})) {
          if (!rec || typeof rec.at !== "string" || rec.v !== null && typeof rec.v !== "string" || rec.archived !== void 0 && rec.archived !== true) {
            throw err("EBUCKET_FORMAT", `store "${name}" key "${key}" is not {v, at, archived?}`);
          }
        }
      }
      return { format: FORMAT, v: VERSION, owner: b.owner ?? null, stores: b.stores, clock: typeof b.clock === "string" ? b.clock : null };
    }
    __name(parse, "parse");
    function seal(bucket, key, randomBytes4, { keyVersion } = {}) {
      return canonical({ format: SEALED_FORMAT, v: VERSION, ...keyVersion ? { kv: keyVersion } : {}, owner: bucket.owner ?? null, blob: vault.seal(key, serialize(bucket), randomBytes4) });
    }
    __name(seal, "seal");
    function sealedKeyVersion(text2) {
      try {
        const outer = JSON.parse(String(text2));
        return outer && outer.format === SEALED_FORMAT ? Number.isInteger(outer.kv) ? outer.kv : 1 : null;
      } catch (_) {
        return null;
      }
    }
    __name(sealedKeyVersion, "sealedKeyVersion");
    var AGE_FORMAT = "onlykey-bucket-age";
    var AGE_LABEL = "onlykey-bucket";
    var { toBase64: toB64, fromBase64: fromB64 } = require_bytes();
    function sealToKey(bucket, recipient, encrypt2) {
      const plain = new TextEncoder().encode(serialize(bucket));
      return canonical({ format: AGE_FORMAT, v: VERSION, owner: bucket.owner ?? null, label: AGE_LABEL, age: toB64(encrypt2(plain, recipient)) });
    }
    __name(sealToKey, "sealToKey");
    async function openWithKey(text2, { decrypt: decrypt2, owner = null }) {
      let outer;
      try {
        outer = JSON.parse(String(text2));
      } catch (e) {
        throw err("EBUCKET_FORMAT", `not a bucket: ${e.message}`);
      }
      if (!outer || outer.format !== AGE_FORMAT) throw err("EBUCKET_FORMAT", "not a bucket sealed to a key");
      if (owner !== null && (outer.owner ?? null) !== owner) throw err("EBUCKET_NOT_YOURS", "this bucket belongs to another identity - its key is not this one");
      let inner;
      try {
        inner = new TextDecoder().decode(await decrypt2(fromB64(outer.age), outer.label || AGE_LABEL));
      } catch (e) {
        throw Object.assign(err("EBUCKET_NOT_OPENED", `the key did not open this bucket: ${e && e.message}`), { cause: e });
      }
      const bucket = parse(inner);
      if ((outer.owner ?? null) !== (bucket.owner ?? null)) throw err("EBUCKET_FORMAT", "the owner outside the seal does not match the one inside");
      return { bucket, sealed: true };
    }
    __name(openWithKey, "openWithKey");
    function open(text2, { key = null, allowUnsealed = false } = {}) {
      let outer;
      try {
        outer = JSON.parse(String(text2));
      } catch (e) {
        throw err("EBUCKET_FORMAT", `not a bucket: ${e.message}`);
      }
      if (outer && outer.format === SEALED_FORMAT) {
        if (!key) throw err("EBUCKET_KEY", "this bucket is sealed: it opens with its OnlyKey");
        let inner;
        try {
          inner = vault.open(key, outer.blob);
        } catch (_) {
          throw err("EBUCKET_NOT_YOURS", "this bucket does not open with this key - it was sealed by another OnlyKey, or the file is damaged");
        }
        const bucket = parse(inner);
        if ((outer.owner ?? null) !== (bucket.owner ?? null)) throw err("EBUCKET_FORMAT", "the owner outside the seal does not match the one inside");
        return { bucket, sealed: true };
      }
      if (outer && outer.format === FORMAT) {
        if (!allowUnsealed) throw err("EBUCKET_UNSEALED", "an unsealed bucket opens only in a development build");
        return { bucket: parse(text2), sealed: false };
      }
      throw err("EBUCKET_FORMAT", "not a bucket");
    }
    __name(open, "open");
    function mergeKeys(into = {}, from = {}) {
      const store = { ...into };
      let taken = 0;
      for (const [key, rec] of Object.entries(from)) {
        if (newer(into[key], rec)) {
          store[key] = { ...rec };
          taken += 1;
        }
      }
      return { store, taken, conflicts: [] };
    }
    __name(mergeKeys, "mergeKeys");
    function merge(into, from, { rules = {} } = {}) {
      if ((into.owner ?? null) !== (from.owner ?? null)) {
        throw err("EBUCKET_OWNER", "these buckets belong to different keys - they do not merge");
      }
      const bucket = { format: FORMAT, v: VERSION, owner: into.owner ?? null, stores: {}, clock: [into.clock, from.clock].filter(Boolean).sort().pop() || null };
      const report = { taken: {}, conflicts: [] };
      const names = /* @__PURE__ */ new Set([...Object.keys(into.stores), ...Object.keys(from.stores)]);
      for (const name of [...names].sort()) {
        const rule = rules[name] || mergeKeys;
        const r = rule(into.stores[name] || {}, from.stores[name] || {});
        bucket.stores[name] = r.store;
        report.taken[name] = r.taken;
        for (const c of r.conflicts) report.conflicts.push({ store: name, ...c });
        for (const rec of Object.values(r.store)) if (rec && rec.at && (!bucket.clock || rec.at > bucket.clock)) bucket.clock = rec.at;
      }
      return { bucket, report };
    }
    __name(merge, "merge");
    function purgeArchived(bucket, { before }) {
      let n = 0;
      for (const store of Object.values(bucket.stores)) {
        for (const [key, rec] of Object.entries(store)) {
          if (rec && (rec.archived || rec.v === null) && rec.at < before) {
            delete store[key];
            n += 1;
          }
        }
      }
      return n;
    }
    __name(purgeArchived, "purgeArchived");
    function resolve(bucket, conflict, side) {
      if (side !== "into" && side !== "from") throw new Error("pick 'into' or 'from'");
      if (!bucket.stores[conflict.store]) bucket.stores[conflict.store] = {};
      if (typeof conflict.apply === "function") {
        conflict.apply(bucket.stores[conflict.store], side);
        return;
      }
      bucket.stores[conflict.store][conflict.key] = { ...conflict[side] };
    }
    __name(resolve, "resolve");
    module.exports = { FORMAT, SEALED_FORMAT, AGE_FORMAT, AGE_LABEL, VERSION, create, kv, newer, purgeArchived, serialize, parse, seal, sealedKeyVersion, open, sealToKey, openWithKey, mergeKeys, merge, resolve };
  }
});

// node_modules/node-onlykey-lib/bucket/src/rules.js
var require_rules = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/rules.js"(exports, module) {
    "use strict";
    var { mergeKeys, newer } = require_bucket();
    var live = /* @__PURE__ */ __name((rec) => Boolean(rec) && !rec.archived && rec.v !== null, "live");
    var ordered = /* @__PURE__ */ __name((a, b) => newer(a, b) ? [a, b] : [b, a], "ordered");
    var later = /* @__PURE__ */ __name((a, b) => a && b ? a > b ? a : b : a || b, "later");
    function withOthers(key, rule) {
      const omit = /* @__PURE__ */ __name((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)), "omit");
      const pick = /* @__PURE__ */ __name((s) => s[key] ? { [key]: s[key] } : {}, "pick");
      return (into = {}, from = {}) => {
        const others = mergeKeys(omit(into), omit(from));
        const own = rule(pick(into), pick(from));
        return { store: { ...others.store, ...own.store }, taken: others.taken + own.taken, conflicts: [...others.conflicts, ...own.conflicts] };
      };
    }
    __name(withOthers, "withOthers");
    function canonical(v) {
      if (Array.isArray(v)) return v.map(canonical);
      if (v && typeof v === "object") return Object.keys(v).sort().reduce((o, k) => {
        o[k] = canonical(v[k]);
        return o;
      }, {});
      return v;
    }
    __name(canonical, "canonical");
    function listParts(key, field) {
      return {
        key,
        /** @param {string} v the value @returns {Object<string, string>} part id -> its text */
        split(v) {
          const j = JSON.parse(v);
          if (!j || typeof j !== "object" || !Array.isArray(j[field])) throw new Error(`not a list of ${field}`);
          const { [field]: items, ...rest } = j;
          const out = { "": JSON.stringify(canonical(rest)) };
          for (const it of items) if (it && it.id !== void 0) out[`#${it.id}`] = JSON.stringify(canonical(it));
          return out;
        },
        /** @param {Object<string, string>} parts @returns {string} a value holding just these parts */
        join(parts) {
          const rest = parts[""] ? JSON.parse(parts[""]) : {};
          const items = Object.keys(parts).filter((p) => p !== "").sort().map((p) => JSON.parse(parts[p]));
          return JSON.stringify({ ...rest, [field]: items });
        }
      };
    }
    __name(listParts, "listParts");
    var withParts = /* @__PURE__ */ __name((rule, parts) => Object.assign(rule, { parts }), "withParts");
    var settings = mergeKeys;
    function keychain(list, { key = "list" } = {}) {
      return withParts(withOthers(key, (into = {}, from = {}) => {
        const store = { ...into };
        const a = into[key];
        const b = from[key];
        if (!b) return { store, taken: 0, conflicts: [] };
        if (!live(a) || !live(b)) {
          if (!newer(a, b)) return { store, taken: 0, conflicts: [] };
          store[key] = { ...b };
          return { store, taken: live(b) ? list.parse(b.v).length : 1, conflicts: [] };
        }
        const [lo, hi] = ordered(a, b);
        const r = list.merge(list.parse(lo.v), list.parse(hi.v));
        const v = list.serialize(r.entries);
        if (v === a.v) return { store, taken: 0, conflicts: [] };
        store[key] = { v, at: later(a.at, b.at) };
        const had = new Set(list.parse(a.v).map((e) => e.id));
        return { store, taken: Math.max(1, r.entries.filter((e) => !had.has(e.id)).length), conflicts: [] };
      }), listParts(key, "entries"));
    }
    __name(keychain, "keychain");
    function passwords() {
      const INDEX = "entries/index";
      return (into = {}, from = {}) => {
        const notIndex = /* @__PURE__ */ __name((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.endsWith(INDEX))), "notIndex");
        const r = mergeKeys(notIndex(into), notIndex(from));
        const store = r.store;
        const indexes = new Set([...Object.keys(into), ...Object.keys(from)].filter((k) => k.endsWith(INDEX)));
        for (const k of indexes) {
          const ids = /* @__PURE__ */ new Set();
          for (const side of [into[k], from[k]]) {
            if (live(side)) for (const id of JSON.parse(side.v)) ids.add(id);
          }
          const prefix = k.slice(0, -INDEX.length);
          const listed = [...ids].filter((id) => {
            const rec = store[`${prefix}entries/${id}`];
            return live(rec);
          }).sort();
          store[k] = { v: JSON.stringify(listed), at: later(into[k] && into[k].at, from[k] && from[k].at) };
        }
        return { store, taken: r.taken, conflicts: r.conflicts };
      };
    }
    __name(passwords, "passwords");
    function guestbook({ key = "guestbook:v1" } = {}) {
      const changedAt = /* @__PURE__ */ __name((c, blobAt) => [...(c.keys || []).map((k) => k.updatedAt), ...(c.history || []).map((h) => h && h.at)].map((t) => String(t || "")).filter(Boolean).sort().pop() || blobAt, "changedAt");
      return withParts(withOthers(key, (into = {}, from = {}) => {
        const store = { ...into };
        const a = into[key];
        const b = from[key];
        if (!b) return { store, taken: 0, conflicts: [] };
        if (!live(a) || !live(b)) {
          if (!newer(a, b)) return { store, taken: 0, conflicts: [] };
          store[key] = { ...b };
          return { store, taken: live(b) ? JSON.parse(b.v).contacts.length : 1, conflicts: [] };
        }
        const mine = JSON.parse(a.v);
        const theirs = JSON.parse(b.v);
        const at = new Map(mine.contacts.map((c, i) => [c.id, i]));
        let taken = 0;
        for (const c of theirs.contacts) {
          const i = at.get(c.id);
          if (i === void 0) {
            at.set(c.id, mine.contacts.length);
            mine.contacts.push(c);
            taken += 1;
            continue;
          }
          const have = mine.contacts[i];
          const h = JSON.stringify(have);
          const o = JSON.stringify(c);
          if (h === o) continue;
          const ha = changedAt(have, a.at);
          const oa = changedAt(c, b.at);
          if (oa > ha || oa === ha && o > h) {
            mine.contacts[i] = c;
            taken += 1;
          }
        }
        if (!taken) return { store, taken: 0, conflicts: [] };
        store[key] = { v: JSON.stringify(mine), at: later(a.at, b.at) };
        return { store, taken, conflicts: [] };
      }), listParts(key, "contacts"));
    }
    __name(guestbook, "guestbook");
    function edgeCopies(copyfile) {
      const { fromHex } = require_bytes();
      return (into = {}, from = {}) => {
        const store = { ...into };
        const conflicts = [];
        let taken = 0;
        for (const [key, rec] of Object.entries(from)) {
          const have = into[key];
          if (!rec || rec.v === null) continue;
          if (!have || have.v === null) {
            store[key] = { ...rec };
            taken += JSON.parse(rec.v).links.length;
            continue;
          }
          const ja = JSON.parse(have.v);
          const jb = JSON.parse(rec.v);
          const id = fromHex(ja.deviceId);
          const r = copyfile.merge(copyfile.fromJSON(ja, id), copyfile.fromJSON(jb, id));
          if (r.fork) {
            conflicts.push({
              key,
              reason: r.fork.reason,
              into: { ...have },
              from: { ...rec },
              apply() {
                throw new Error(`${r.fork.reason}: a fork is reported, never repaired`);
              }
            });
            continue;
          }
          if (!r.taken && JSON.stringify(copyfile.toJSON(r.copy)) === JSON.stringify(ja)) continue;
          store[key] = { v: JSON.stringify(copyfile.toJSON(r.copy)), at: later(have.at, rec.at) };
          taken += r.taken;
        }
        return { store, taken, conflicts };
      };
    }
    __name(edgeCopies, "edgeCopies");
    function edgeLogs(logblocks) {
      return (into = {}, from = {}) => {
        const store = { ...into };
        const conflicts = [];
        let taken = 0;
        for (const [key, rec] of Object.entries(from)) {
          if (!live(rec)) continue;
          const have = into[key];
          if (!live(have)) {
            store[key] = { ...rec };
            taken += 1;
            continue;
          }
          if (have.v === rec.v) continue;
          const [lo, hi] = ordered(have, rec);
          const r = logblocks.mergeEntry(key, have.v, lo.v, hi.v);
          if (r.fork) {
            conflicts.push({ key, reason: r.fork, into: { ...have }, from: { ...rec }, apply() {
              throw new Error(`${r.fork}: a fork is reported, never repaired`);
            } });
            continue;
          }
          if (r.v === have.v) continue;
          store[key] = { v: r.v, at: later(have.at, rec.at) };
          taken += r.taken;
        }
        return { store, taken, conflicts };
      };
    }
    __name(edgeLogs, "edgeLogs");
    function edgeBlocks(bucket, copyfile, { net, store = "edge.copies" }) {
      const { fromHex } = require_bytes();
      return Object.values(bucket.stores[store] || {}).filter(live).map((rec) => {
        const j = JSON.parse(rec.v);
        return copyfile.blocks(copyfile.fromJSON(j, fromHex(j.deviceId)), { net });
      });
    }
    __name(edgeBlocks, "edgeBlocks");
    function cryptobox({ key = "cryptobox:v1" } = {}) {
      const parse = /* @__PURE__ */ __name((rec) => {
        try {
          const j = JSON.parse(rec.v);
          return j && Array.isArray(j.messages) ? j : null;
        } catch {
          return null;
        }
      }, "parse");
      return withParts(withOthers(key, (into = {}, from = {}) => {
        const store = { ...into };
        const a = into[key];
        const b = from[key];
        if (!b) return { store, taken: 0, conflicts: [] };
        const pa = live(a) ? parse(a) : null;
        const pb = live(b) ? parse(b) : null;
        if (!pa || !pb) {
          if (!newer(a, b)) return { store, taken: 0, conflicts: [] };
          store[key] = { ...b };
          return { store, taken: 1, conflicts: [] };
        }
        const [lo, hi] = ordered(a, b).map((r) => r === a ? pa : pb);
        const byId = new Map(lo.messages.map((m) => [m.id, m]));
        for (const m of hi.messages) {
          const old = byId.get(m.id);
          if (!old) {
            byId.set(m.id, m);
            continue;
          }
          const gone = old.archived || m.archived;
          byId.set(m.id, gone ? { ...m, archived: true, archivedAt: m.archivedAt || old.archivedAt || "" } : m);
        }
        const messages = [...byId.values()].sort((x, y) => x.at < y.at ? -1 : x.at > y.at ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
        const v = JSON.stringify({ v: hi.v || 1, messages });
        if (v === a.v) return { store, taken: 0, conflicts: [] };
        store[key] = { v, at: later(a.at, b.at) };
        const had = new Set(pa.messages.filter((m) => !m.archived).map((m) => m.id));
        const changed = messages.filter((m) => !had.has(m.id) || m.archived).length;
        return { store, taken: Math.max(1, changed), conflicts: [] };
      }), listParts(key, "messages"));
    }
    __name(cryptobox, "cryptobox");
    module.exports = { settings, keychain, passwords, guestbook, edgeCopies, edgeLogs, edgeBlocks, cryptobox };
  }
});

// node_modules/node-onlykey-lib/bucket/src/replicate.js
var require_replicate = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/replicate.js"(exports, module) {
    "use strict";
    var { sha256: sha2562 } = require_sha2();
    var { toHex } = require_bytes();
    var { mergeKeys } = require_bucket();
    var h = /* @__PURE__ */ __name((text2) => toHex(sha2562(new TextEncoder().encode(text2))), "h");
    var hashOf = /* @__PURE__ */ __name((rec) => h(`${rec.archived || rec.v === null ? "a" : "l"}${typeof rec.v === "string" ? rec.v : JSON.stringify(rec.v ?? "")}`), "hashOf");
    var SEP = "";
    var live = /* @__PURE__ */ __name((rec) => Boolean(rec) && !rec.archived && rec.v !== null, "live");
    function units(bucket, name, rules) {
      const parts = rules[name] && rules[name].parts;
      const out = {};
      for (const [key, rec] of Object.entries((bucket.stores || {})[name] || {})) {
        if (parts && key === parts.key && live(rec)) {
          let split2 = null;
          try {
            split2 = parts.split(rec.v);
          } catch {
          }
          if (split2) {
            for (const [p, text2] of Object.entries(split2)) out[`${key}${SEP}${p}`] = { at: rec.at, h: h(`l${text2}`), part: text2 };
            continue;
          }
        }
        out[key] = { at: rec.at, h: hashOf(rec), rec };
      }
      return out;
    }
    __name(units, "units");
    function stateOf(bucket, { rules = {} } = {}) {
      const stores = {};
      for (const name of Object.keys(bucket.stores || {}).sort()) {
        const u = units(bucket, name, rules);
        const keys = Object.keys(u).sort();
        if (!keys.length) continue;
        stores[name] = h(keys.map((k) => `${k}\0${u[k].h}\0${u[k].at || ""}`).join("\n"));
      }
      return { hash: h(Object.entries(stores).map(([n, s]) => `${n}\0${s}`).join("\n")), at: bucket.clock || null, stores };
    }
    __name(stateOf, "stateOf");
    function differs(a, b) {
      const names = /* @__PURE__ */ new Set([...Object.keys(a && a.stores || {}), ...Object.keys(b && b.stores || {})]);
      return [...names].filter((n) => (a.stores || {})[n] !== (b.stores || {})[n]).sort();
    }
    __name(differs, "differs");
    function summarize(bucket, { rules = {} } = {}) {
      const have = {};
      for (const name of Object.keys(bucket.stores)) {
        have[name] = {};
        for (const [k, u] of Object.entries(units(bucket, name, rules))) have[name][k] = { at: u.at, h: u.h };
      }
      return have;
    }
    __name(summarize, "summarize");
    function give(bucket, mine, theirs, { rules = {} } = {}) {
      const out = {};
      for (const [name, keys] of Object.entries(mine)) {
        let u = null;
        for (const [key, m] of Object.entries(keys)) {
          const t = theirs[name] && theirs[name][key];
          if (t && t.h === m.h) continue;
          if (!u) u = units(bucket, name, rules);
          const now = u[key];
          if (!now || now.h !== m.h) throw Object.assign(new Error("the bucket changed during the trade - trade again"), { code: "EBUCKET_CHANGED" });
          if (!out[name]) out[name] = {};
          out[name][key] = now.part !== void 0 ? { v: now.part, at: now.at, part: true } : { ...now.rec };
        }
      }
      return out;
    }
    __name(give, "give");
    function joinParts(bucket, name, key, given, parts) {
      const map = {};
      let at = null;
      for (const [k, rec] of Object.entries(given)) {
        if (!k.startsWith(`${key}${SEP}`)) continue;
        map[k.slice(key.length + 1)] = rec.v;
        if (!at || rec.at > at) at = rec.at;
      }
      if (map[""] === void 0) {
        const own = ((bucket.stores || {})[name] || {})[key];
        try {
          if (live(own)) map[""] = parts.split(own.v)[""];
        } catch {
        }
      }
      return { v: parts.join(map), at };
    }
    __name(joinParts, "joinParts");
    function take(bucket, given, { rules = {} } = {}) {
      const taken = {};
      const conflicts = [];
      for (const [name, recs] of Object.entries(given)) {
        const parts = rules[name] && rules[name].parts;
        let incoming = recs;
        if (!parts) incoming = Object.fromEntries(Object.entries(recs).filter(([k]) => !k.includes(SEP)));
        if (parts && Object.keys(recs).some((k) => k.startsWith(`${parts.key}${SEP}`))) {
          incoming = Object.fromEntries(Object.entries(recs).filter(([k]) => !k.startsWith(`${parts.key}${SEP}`)));
          incoming[parts.key] = joinParts(bucket, name, parts.key, recs, parts);
        }
        const r = (rules[name] || mergeKeys)(bucket.stores[name] || {}, incoming);
        bucket.stores[name] = r.store;
        if (r.taken) taken[name] = r.taken;
        for (const c of r.conflicts) conflicts.push({ store: name, ...c });
        for (const rec of Object.values(r.store)) if (rec && rec.at && (!bucket.clock || rec.at > bucket.clock)) bucket.clock = rec.at;
      }
      return { taken, conflicts };
    }
    __name(take, "take");
    module.exports = { summarize, give, take, hashOf, stateOf, differs };
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/utils.js
function aarray(item, title, inner = () => {
}) {
  if (!Array.isArray(item))
    throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
  for (let i = 0; i < item.length; i++)
    inner(item[i], `${title}[${i}]`);
  return item;
}
function astring(value, title = "") {
  if (typeof value !== "string") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected string, got type=" + typeof value);
  }
  return value;
}
function aobject3(value, title = "object") {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
  return value;
}
function afunction(value, title) {
  if (typeof value !== "function")
    throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
  return value;
}
function abool2(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle3(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new RangeError("positive bigint expected, got " + n);
  } else
    anumber3(n);
  return n;
}
function asafenumber(value, title = "") {
  if (typeof value !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected number, got type=" + typeof value);
  }
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new RangeError(prefix + "expected safe integer, got " + value);
  }
}
function hexToNumber(hex2) {
  if (typeof hex2 !== "string")
    throw new TypeError("hex string expected, got " + typeof hex2);
  return hex2 === "" ? _0n : BigInt("0x" + hex2);
}
function bytesToNumberBE(bytes3) {
  return hexToNumber(bytesToHex(bytes3));
}
function bytesToNumberLE(bytes3) {
  return hexToNumber(bytesToHex(copyBytes2(abytes(bytes3)).reverse()));
}
function numberToBytesBE(n, len) {
  anumber(len);
  if (len === 0)
    throw new Error("zero output length is invalid");
  n = abignumber(n);
  const expectedLen = len * 2;
  const hex2 = n.toString(16);
  if (hex2.length > expectedLen)
    throw new RangeError("number is too large");
  return hexToBytes(hex2.padStart(expectedLen, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function equalBytes2(a, b) {
  a = abytes3(a);
  b = abytes3(b);
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function copyBytes2(bytes3) {
  return Uint8Array.from(abytes3(bytes3));
}
function asciiToBytes(ascii) {
  if (typeof ascii !== "string")
    throw new TypeError("ascii string expected, got " + typeof ascii);
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
function isPosBig(n) {
  return typeof n === "bigint" && _0n <= n;
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  if (n < _0n)
    throw new Error("expected non-negative bigint, got " + n);
  return n === _0n ? 0 : n.toString(2).length;
}
function validateObject(object, fields = {}, optFields = {}, title = "object") {
  aobject3(object, title);
  aobject3(fields, "fields");
  aobject3(optFields, "optFields");
  function checkField(fieldName, expectedType, isOpt) {
    const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
    const val = object[fieldName];
    if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== void 0 : expectedType !== "function")) {
      throw new TypeError(`${label} is invalid: expected own property`);
    }
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
  }
  __name(checkField, "checkField");
  const iter = /* @__PURE__ */ __name((f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt)), "iter");
  iter(fields, false);
  iter(optFields, true);
}
var abytes3, anumber3, bytesToHex2, concatBytes3, hexToBytes2, isBytes3, randomBytes3, _0n, _1n, atitle3, bitMask, notImplemented;
var init_utils3 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/utils.js"() {
    init_utils();
    __name(aarray, "aarray");
    abytes3 = /* @__PURE__ */ __name((value, length, title) => abytes(value, length, title), "abytes");
    anumber3 = anumber;
    __name(astring, "astring");
    __name(aobject3, "aobject");
    __name(afunction, "afunction");
    bytesToHex2 = bytesToHex;
    concatBytes3 = /* @__PURE__ */ __name((...arrays) => concatBytes(...arrays), "concatBytes");
    hexToBytes2 = /* @__PURE__ */ __name((hex2) => hexToBytes(hex2), "hexToBytes");
    isBytes3 = isBytes;
    randomBytes3 = /* @__PURE__ */ __name((bytesLength) => randomBytes(bytesLength), "randomBytes");
    _0n = /* @__PURE__ */ BigInt(0);
    _1n = /* @__PURE__ */ BigInt(1);
    atitle3 = /* @__PURE__ */ __name((title) => title ? `"${title}" ` : "", "atitle");
    __name(abool2, "abool");
    __name(abignumber, "abignumber");
    __name(asafenumber, "asafenumber");
    __name(hexToNumber, "hexToNumber");
    __name(bytesToNumberBE, "bytesToNumberBE");
    __name(bytesToNumberLE, "bytesToNumberLE");
    __name(numberToBytesBE, "numberToBytesBE");
    __name(numberToBytesLE, "numberToBytesLE");
    __name(equalBytes2, "equalBytes");
    __name(copyBytes2, "copyBytes");
    __name(asciiToBytes, "asciiToBytes");
    __name(isPosBig, "isPosBig");
    __name(inRange, "inRange");
    __name(aInRange, "aInRange");
    __name(bitLen, "bitLen");
    bitMask = /* @__PURE__ */ __name((n) => {
      asafenumber(n, "n");
      return (_1n << BigInt(n)) - _1n;
    }, "bitMask");
    __name(validateObject, "validateObject");
    notImplemented = /* @__PURE__ */ __name(() => {
      throw new Error("not implemented");
    }, "notImplemented");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/modular.js
function mod(a, b) {
  if (b <= _0n2)
    throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow(num, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow: expected modulus > 1, got " + modulo);
  if (typeof power !== "bigint")
    throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return _1n2;
  if (power === _1n2)
    return num;
  let d = num % modulo;
  if (d < _0n2)
    d += modulo;
  if (power < POW_WINDOWED_MIN) {
    let p2 = _1n2;
    while (power > _0n2) {
      if (power & _1n2)
        p2 = p2 * d % modulo;
      d = d * d % modulo;
      power >>= _1n2;
    }
    return p2;
  }
  const digits = [];
  while (power > _0n2) {
    digits.push(Number(power & _15n));
    power >>= _4n;
  }
  const table = new Array(16);
  table[0] = _1n2;
  table[1] = d;
  for (let i = 2; i < 16; i++)
    table[i] = table[i - 1] * d % modulo;
  let p = table[digits[digits.length - 1]];
  for (let w = digits.length - 2; w >= 0; w--) {
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    const digit = digits[w];
    if (digit !== 0)
      p = p * table[digit] % modulo;
  }
  return p;
}
function pow2(x, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow2: expected modulus > 1, got " + modulo);
  if (power < _0n2)
    throw new Error("pow2: expected non-negative exponent, got " + power);
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _1n2)
    throw new Error("invert: expected modulus > 1, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, u = _1n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    b = a, a = r, x = u, u = m;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function invertCt(a, prime) {
  if (prime <= _1n2)
    throw new Error("invertCt: expected prime modulus > 1, got " + prime);
  const an = mod(a, prime);
  if (an === _0n2)
    throw new Error("invertCt: expected non-zero number");
  const inverse = pow(an, prime - _2n, prime);
  if (mod(an * inverse, prime) !== _1n2)
    throw new Error("invertCt: does not exist");
  return inverse;
}
function assertIsSquare(Fp2, root, n) {
  const F = Fp2;
  if (!F.eql(F.sqr(root), n))
    throw new Error("Cannot find square root");
}
function aoddModulus(order, fnName) {
  if ((order & _1n2) === _0n2)
    throw new Error(fnName + ": expected odd modulus, got " + order);
}
function sqrt3mod4(Fp2, n) {
  const F = Fp2;
  const p1div4 = (F.ORDER + _1n2) / _4n;
  const root = F.pow(n, p1div4);
  assertIsSquare(F, root, n);
  return root;
}
function sqrt5mod8(Fp2, n) {
  const F = Fp2;
  const p5div8 = (F.ORDER - _5n) / _8n;
  const n2 = F.mul(n, _2n);
  const v = F.pow(n2, p5div8);
  const nv = F.mul(n, v);
  const i = F.mul(F.mul(nv, _2n), v);
  const root = F.mul(nv, F.sub(i, F.ONE));
  assertIsSquare(F, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return ((Fp2, n) => {
    const F = Fp2;
    let tv1 = F.pow(n, c4);
    let tv2 = F.mul(tv1, c1);
    const tv3 = F.mul(tv1, c2);
    const tv4 = F.mul(tv1, c3);
    const e1 = F.eql(F.sqr(tv2), n);
    const e2 = F.eql(F.sqr(tv3), n);
    tv1 = F.cmov(tv1, tv2, e1);
    tv2 = F.cmov(tv4, tv3, e2);
    const e3 = F.eql(F.sqr(tv2), n);
    const root = F.cmov(tv1, tv2, e3);
    assertIsSquare(F, root, n);
    return root;
  });
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  aoddModulus(P, "tonelliShanks");
  let Q = P - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return /* @__PURE__ */ __name(function tonelliSlow(Fp2, n) {
    const F = Fp2;
    if (F.is0(n))
      return n;
    if (FpLegendre(F, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = F.mul(F.ONE, cc);
    let t = F.pow(n, Q);
    let R = F.pow(n, Q1div2);
    while (!F.eql(t, F.ONE)) {
      if (F.is0(t))
        throw new Error("Cannot find square root: probably non-prime P");
      let i = 1;
      let t_tmp = F.sqr(t);
      while (!F.eql(t_tmp, F.ONE)) {
        i++;
        t_tmp = F.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = F.pow(c, exponent);
      M = i;
      c = F.sqr(b);
      t = F.mul(t, c);
      R = F.mul(R, b);
    }
    return R;
  }, "tonelliSlow");
}
function FpSqrt(P) {
  aoddModulus(P, "Fp.sqrt");
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
function validateField(field) {
  aobject3(field, "field");
  if (typeof field.ORDER !== "bigint")
    throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
  asafenumber(field.BYTES, "BYTES");
  asafenumber(field.BITS, "BITS");
  for (const name of FIELD_FIELDS)
    afunction(field[name], "field." + name);
  if (field.BYTES < 1 || field.BITS < 1)
    throw new Error("invalid field: expected BYTES/BITS > 0");
  if (field.ORDER <= _1n2)
    throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
function FpInvertBatch(Fp2, nums, passZero = false) {
  validateField(Fp2);
  aarray(nums, "nums");
  abool2(passZero, "passZero");
  const F = Fp2;
  const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (F.is0(num))
      return acc;
    inverted[i] = acc;
    return F.mul(acc, num);
  }, F.ONE);
  const invertedAcc = F.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (F.is0(num))
      return acc;
    inverted[i] = F.mul(acc, inverted[i]);
    return F.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp2, n) {
  validateField(Fp2);
  const F = Fp2;
  aoddModulus(F.ORDER, "FpLegendre");
  const p1mod2 = (F.ORDER - _1n2) / _2n;
  const powered = F.pow(n, p1mod2);
  const yes = F.eql(powered, F.ONE);
  const zero = F.eql(powered, F.ZERO);
  const no = F.eql(powered, F.neg(F.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber3(nBitLength);
  if (n <= _0n2)
    throw new Error("invalid n length: expected positive n, got " + n);
  if (nBitLength !== void 0 && nBitLength < 1)
    throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
  const bits = bitLen(n);
  if (nBitLength !== void 0 && nBitLength < bits)
    throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, opts = {}) {
  Object.freeze(_Field.prototype);
  return new _Field(ORDER, opts);
}
function FpSqrtEven(Fp2, elm) {
  validateField(Fp2);
  const F = Fp2;
  if (!F.isOdd)
    throw new Error("Field doesn't have isOdd");
  const root = F.sqrt(elm);
  return F.isOdd(root) ? F.neg(root) : root;
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  if (fieldOrder <= _1n2)
    throw new Error("field order must be greater than 1");
  const bitLength = bitLen(fieldOrder - _1n2);
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
  abytes3(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = Math.max(getMinHashLength(fieldOrder), 16);
  if (len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num, fieldOrder - _1n2) + _1n2;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
var _0n2, _1n2, _2n, _3n, _4n, _5n, _7n, _8n, _9n, _15n, _16n, POW_WINDOWED_MIN, isNegativeLE, FIELD_FIELDS, FIELD_SQRT, _Field;
var init_modular = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/modular.js"() {
    init_utils3();
    _0n2 = /* @__PURE__ */ BigInt(0);
    _1n2 = /* @__PURE__ */ BigInt(1);
    _2n = /* @__PURE__ */ BigInt(2);
    _3n = /* @__PURE__ */ BigInt(3);
    _4n = /* @__PURE__ */ BigInt(4);
    _5n = /* @__PURE__ */ BigInt(5);
    _7n = /* @__PURE__ */ BigInt(7);
    _8n = /* @__PURE__ */ BigInt(8);
    _9n = /* @__PURE__ */ BigInt(9);
    _15n = /* @__PURE__ */ BigInt(15);
    _16n = /* @__PURE__ */ BigInt(16);
    POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
    __name(mod, "mod");
    __name(pow, "pow");
    __name(pow2, "pow2");
    __name(invert, "invert");
    __name(invertCt, "invertCt");
    __name(assertIsSquare, "assertIsSquare");
    __name(aoddModulus, "aoddModulus");
    __name(sqrt3mod4, "sqrt3mod4");
    __name(sqrt5mod8, "sqrt5mod8");
    __name(sqrt9mod16, "sqrt9mod16");
    __name(tonelliShanks, "tonelliShanks");
    __name(FpSqrt, "FpSqrt");
    isNegativeLE = /* @__PURE__ */ __name((num, modulo) => (mod(num, modulo) & _1n2) === _1n2, "isNegativeLE");
    FIELD_FIELDS = [
      "create",
      "isValid",
      "is0",
      "neg",
      "inv",
      "sqrt",
      "sqr",
      "eql",
      "add",
      "sub",
      "mul",
      "pow",
      "div",
      "addN",
      "subN",
      "mulN",
      "sqrN"
    ];
    __name(validateField, "validateField");
    __name(FpInvertBatch, "FpInvertBatch");
    __name(FpLegendre, "FpLegendre");
    __name(nLength, "nLength");
    FIELD_SQRT = /* @__PURE__ */ new WeakMap();
    _Field = class {
      static {
        __name(this, "_Field");
      }
      ORDER;
      BITS;
      BYTES;
      isLE;
      ZERO = _0n2;
      ONE = _1n2;
      _lengths;
      _mod;
      constructor(ORDER, opts = {}) {
        if (ORDER <= _1n2)
          throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
        let _nbitLength = void 0;
        this.isLE = false;
        if (opts != null && typeof opts === "object") {
          if (typeof opts.BITS === "number")
            _nbitLength = opts.BITS;
          if (typeof opts.sqrt === "function")
            Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
          if (typeof opts.isLE === "boolean")
            this.isLE = opts.isLE;
          if (opts.allowedLengths)
            this._lengths = Object.freeze(opts.allowedLengths.slice());
          if (typeof opts.modFromBytes === "boolean")
            this._mod = opts.modFromBytes;
        }
        const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
        if (nByteLength > 2048)
          throw new Error("invalid field: expected ORDER of <= 2048 bytes");
        this.ORDER = ORDER;
        this.BITS = nBitLength;
        this.BYTES = nByteLength;
        Object.freeze(this);
      }
      create(num) {
        return mod(num, this.ORDER);
      }
      isValid(num) {
        if (typeof num !== "bigint")
          throw new TypeError("invalid field element: expected bigint, got " + typeof num);
        return _0n2 <= num && num < this.ORDER;
      }
      is0(num) {
        return num === _0n2;
      }
      // is valid and invertible
      isValidNot0(num) {
        return !this.is0(num) && this.isValid(num);
      }
      isOdd(num) {
        return (num & _1n2) === _1n2;
      }
      neg(num) {
        return mod(-num, this.ORDER);
      }
      eql(lhs, rhs) {
        return lhs === rhs;
      }
      sqr(num) {
        return mod(num * num, this.ORDER);
      }
      add(lhs, rhs) {
        return mod(lhs + rhs, this.ORDER);
      }
      sub(lhs, rhs) {
        return mod(lhs - rhs, this.ORDER);
      }
      mul(lhs, rhs) {
        return mod(lhs * rhs, this.ORDER);
      }
      pow(num, power) {
        return pow(num, power, this.ORDER);
      }
      div(lhs, rhs) {
        return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
      }
      // Same as above, but doesn't normalize
      sqrN(num) {
        return num * num;
      }
      addN(lhs, rhs) {
        return lhs + rhs;
      }
      subN(lhs, rhs) {
        return lhs - rhs;
      }
      mulN(lhs, rhs) {
        return lhs * rhs;
      }
      inv(num) {
        return invert(num, this.ORDER);
      }
      sqrt(num) {
        let sqrt = FIELD_SQRT.get(this);
        if (!sqrt)
          FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
        return sqrt(this, num);
      }
      toBytes(num) {
        return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
      }
      fromBytes(bytes3, skipValidation = false) {
        abytes3(bytes3);
        const { _lengths: allowedLengths, BYTES, isLE: isLE2, ORDER, _mod: modFromBytes } = this;
        if (allowedLengths) {
          if (bytes3.length < 1 || !allowedLengths.includes(bytes3.length) || bytes3.length > BYTES) {
            throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes3.length);
          }
          const padded = new Uint8Array(BYTES);
          padded.set(bytes3, isLE2 ? 0 : padded.length - bytes3.length);
          bytes3 = padded;
        }
        if (bytes3.length !== BYTES)
          throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes3.length);
        let scalar = isLE2 ? bytesToNumberLE(bytes3) : bytesToNumberBE(bytes3);
        if (modFromBytes)
          scalar = mod(scalar, ORDER);
        if (!skipValidation) {
          if (!this.isValid(scalar))
            throw new Error("invalid field element: outside of range 0..ORDER");
        }
        return scalar;
      }
      // TODO: we don't need it here, move out to separate fn
      invertBatch(lst) {
        return FpInvertBatch(this, lst, true);
      }
      // We can't move this out because Fp6, Fp12 implement it
      // and it's unclear what to return in there.
      cmov(a, b, condition) {
        abool2(condition, "condition");
        return condition ? b : a;
      }
    };
    __name(Field, "Field");
    __name(FpSqrtEven, "FpSqrtEven");
    __name(getFieldBytesLength, "getFieldBytesLength");
    __name(getMinHashLength, "getMinHashLength");
    __name(mapHashToField, "mapHashToField");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/curve.js
function validatePointCons(Point) {
  const pc = Point;
  if (typeof pc !== "function")
    throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
  afunction(pc.fromAffine, "Point.fromAffine");
  afunction(pc.fromBytes, "Point.fromBytes");
  afunction(pc.fromHex, "Point.fromHex");
  aobject3(pc.BASE, "Point.BASE");
  aobject3(pc.ZERO, "Point.ZERO");
  validateField(pc.Fp);
  validateField(pc.Fn);
}
function normalizeZ(c, points) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits, min = 1) {
  if (!Number.isSafeInteger(W) || W < min || W > bits)
    throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
}
function validateTableBytes(numPoints, fpBytes) {
  const bytes3 = numPoints * (4 * fpBytes + 128);
  if (bytes3 > TABLE_BYTES_MAX)
    throw new Error("invalid window size: table would need ~" + Math.ceil(bytes3 / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
}
function probeRandomBytes(randomBytes4, length) {
  if (randomBytes4 === void 0)
    return void 0;
  afunction(randomBytes4, "randomBytes");
  try {
    const probe = randomBytes4(length);
    if (!isBytes3(probe) || probe.length !== length)
      return void 0;
  } catch {
    return void 0;
  }
  return randomBytes4;
}
function validateMSMPoints(points, c) {
  aarray(points, "points");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field, maxScalar) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    const ok = maxScalar === void 0 ? field.isValid(s) : isPosBig(s) && s < maxScalar;
    if (!ok)
      throw new Error("invalid scalar at index " + i);
  });
}
function getWindowSize(P) {
  return pointWindowSizes.get(P) || 1;
}
function oddMultiples(p, size) {
  const dbl2 = p.double();
  const t = [p];
  for (let j = 1; j < size; j++)
    t.push(t[j - 1].add(dbl2));
  return t;
}
function wnafDigits(n, W) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const d = [];
  while (n > _0n3) {
    let w = 0;
    if (n & _1n3) {
      w = Number(n & mask);
      if (w >= half)
        w -= size;
      n -= BigInt(w);
    }
    d.push(w);
    n >>= _1n3;
  }
  return d;
}
function signedWindowDigits(n, W, windows) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const shiftBy = BigInt(W);
  const d = [];
  for (let w = 0; w < windows; w++) {
    let v = Number(n & mask);
    n >>= shiftBy;
    if (v > half) {
      v -= size;
      n += _1n3;
    }
    d.push(v);
  }
  if (n !== _0n3)
    throw new Error("invalid wnaf");
  return d;
}
function wnafWalk(zero, tables, digits) {
  let max = 0;
  for (const d of digits)
    max = Math.max(max, d.length);
  let acc = zero;
  for (let bit = max - 1; bit >= 0; bit--) {
    if (bit !== max - 1)
      acc = acc.double();
    for (let i = 0; i < digits.length; i++) {
      const w = digits[i][bit];
      if (w) {
        const item = tables[i][Math.abs(w) - 1 >> 1];
        acc = acc.add(w < 0 ? item.negate() : item);
      }
    }
  }
  return acc;
}
function mulAddUnsafe(c, points, scalars, allowOversized = false) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  abool2(allowOversized, "allowOversized");
  validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
  if (points.length !== scalars.length)
    throw new Error("arrays of points and scalars must have equal length");
  const tables = points.map((p) => oddMultiples(p, 4));
  const digits = scalars.map((n) => wnafDigits(n, 4));
  return wnafWalk(c.ZERO, tables, digits);
}
function createField(order, field, isLE2) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE2 });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (type !== "weierstrass" && type !== "edwards")
    throw new Error('expected curve type "weierstrass" or "edwards"');
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  validateObject(curveOpts);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(isPosBig(val) && val !== _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp2 = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn2 = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp2.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp: Fp2, Fn: Fn2 };
}
function createKeygen(randomSecretKey, getPublicKey) {
  return /* @__PURE__ */ __name(function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }, "keygen");
}
var _0n3, _1n3, _4n2, BLIND_BYTES, BLIND_BITS, FW_WINDOW, TABLE_BYTES_MAX, pointWindowSizes, ScalarMultiplier;
var init_curve = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/curve.js"() {
    init_utils3();
    init_modular();
    _0n3 = /* @__PURE__ */ BigInt(0);
    _1n3 = /* @__PURE__ */ BigInt(1);
    _4n2 = /* @__PURE__ */ BigInt(4);
    BLIND_BYTES = 16;
    BLIND_BITS = 128;
    FW_WINDOW = 5;
    TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
    __name(validatePointCons, "validatePointCons");
    __name(normalizeZ, "normalizeZ");
    __name(validateW, "validateW");
    __name(validateTableBytes, "validateTableBytes");
    __name(probeRandomBytes, "probeRandomBytes");
    __name(validateMSMPoints, "validateMSMPoints");
    __name(validateMSMScalars, "validateMSMScalars");
    pointWindowSizes = /* @__PURE__ */ new WeakMap();
    __name(getWindowSize, "getWindowSize");
    __name(oddMultiples, "oddMultiples");
    __name(wnafDigits, "wnafDigits");
    __name(signedWindowDigits, "signedWindowDigits");
    __name(wnafWalk, "wnafWalk");
    ScalarMultiplier = class {
      static {
        __name(this, "ScalarMultiplier");
      }
      Point;
      BASE;
      ZERO;
      randomBytes;
      wnafPrecomputes = /* @__PURE__ */ new WeakMap();
      baseCanBeBlinded;
      bits;
      // Parametrized with a given Point class (not individual point)
      constructor(Point, randomBytes4) {
        validatePointCons(Point);
        this.randomBytes = probeRandomBytes(randomBytes4, BLIND_BYTES);
        this.Point = Point;
        this.BASE = Point.BASE;
        this.ZERO = Point.ZERO;
        this.bits = Point.Fn.BITS;
      }
      /**
       * Creates a signed fixed-window wNAF precomputation table: for every window w, the
       * multiples `[1..2^(W−1)]⋅2^(w⋅W)⋅P`, flattened. All doublings are baked into the table,
       * so cached multiplication is additions-only. `windows = ceil(bits/W) + 1`: the extra
       * window absorbs the final carry of signed-digit recoding.
       * For a 256-bit curve and W=6, the table is 44⋅32 = 1408 points.
       * @param point - Point instance
       * @param W - window size
       * @param bits - scalar bitlength the table must cover
       */
      buildWnafTable(point, W, bits) {
        const windows = Math.ceil(bits / W) + 1;
        const half = 2 ** (W - 1);
        const comp = [];
        let base = point;
        for (let w = 0; w < windows; w++) {
          let acc = base;
          for (let i = 0; i < half; i++) {
            comp.push(acc);
            acc = acc.add(base);
          }
          base = comp[comp.length - 1].double();
        }
        return { W, bits, windows, comp };
      }
      /**
       * Implements ec multiplication using precomputed signed fixed-window wNAF tables.
       * Constant-time: fixed window count with one table addition per window — zero digits feed
       * the fake accumulator — and no doublings; the lookup scans the whole window slice.
       * Scalar bounds are validated by the public entry points ({@link ScalarMultiplier.mulCT},
       * {@link ScalarMultiplier.mulCTBlinded}, {@link ScalarMultiplier.mulUnsafe});
       * signedWindowDigits throws if `n` exceeds the table.
       * @returns real and fake (for const-time) points
       */
      wnafCachedCT(precomputes, n) {
        const { W, windows, comp } = precomputes;
        const half = 2 ** (W - 1);
        const digits = signedWindowDigits(n, W, windows);
        let p = this.ZERO;
        let f = this.BASE;
        for (let w = 0; w < windows; w++) {
          const digit = digits[w];
          const start = w * half;
          const idx = Math.abs(digit) - 1;
          let sel = comp[start];
          for (let i = 1; i < half; i++)
            sel = i === idx ? comp[start + i] : sel;
          const neg = sel.negate();
          if (digit === 0)
            f = f.add(comp[start]);
          else
            p = p.add(digit < 0 ? neg : sel);
        }
        return { p, f };
      }
      // Cache key is point identity plus (W, bits); at most two entries exist per point (public-width
      // `Fn.BITS` and blinded `Fn.BITS + BLIND_BITS`). Callers must not reuse the same point with
      // incompatible `transform(...)` layouts and expect a separate cache entry.
      getWnafPrecomputes(W, point, bits, transform) {
        let entries = this.wnafPrecomputes.get(point);
        let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
        if (!comp) {
          comp = this.buildWnafTable(point, W, bits);
          if (typeof transform === "function")
            comp = { ...comp, comp: transform(comp.comp) };
          if (!entries) {
            entries = [];
            this.wnafPrecomputes.set(point, entries);
          }
          entries.push(comp);
        }
        return comp;
      }
      assertPoint(point) {
        if (!(point instanceof this.Point))
          throw new TypeError('"point" expected Point instance, got type=' + typeof point);
      }
      // Shared prologue of the constant-time entry points. Rejects scalar 0: in key/signature-style
      // callers a zero scalar means broken upstream plumbing, and concrete Points already reject it.
      // Uses inRange instead of Fn.isValidNot0: validateField() only certifies the arithmetic subset.
      validateMulInput(point, scalar) {
        this.assertPoint(point);
        if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
          throw new Error("invalid scalar");
      }
      // Constant-time dispatch shared by mulCT / mulCTBlinded. Un-precomputed points (W===1, e.g.
      // ECDH peer keys) skip building a throwaway cached table in favor of a small fixed-window
      // multiply. `n` must be < 2^bits.
      runCT(point, n, bits, transform) {
        const W = getWindowSize(point);
        if (W === 1)
          return this.fixedWindowCT(point, n, bits);
        return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
      }
      mulCT(point, scalar, transform) {
        this.validateMulInput(point, scalar);
        return this.runCT(point, scalar, this.bits, transform);
      }
      mulCTBlinded(point, scalar, transform) {
        this.validateMulInput(point, scalar);
        if (this.randomBytes === void 0)
          throw new Error("randomBytes is required for scalar blinding");
        const bits = this.Point.Fn.BITS + BLIND_BITS;
        const blind = this.randomBytes(BLIND_BYTES);
        if (!isBytes3(blind) || blind.length !== BLIND_BYTES)
          throw new Error("randomBytes returned invalid byte array");
        blind[0] = blind[0] & 63 | 128;
        const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
        return this.runCT(point, n, bits, transform);
      }
      /**
       * Constant-time multiplication `n*point` for an un-precomputed point, via a small fixed window.
       * A cached wNAF table only pays off when reused; a flat 2^FW_WINDOW table (`size-1` adds) is
       * far cheaper to build for a single use. The point-operation sequence is independent of `n`:
       * build the table, then per window exactly FW_WINDOW doublings, a data-oblivious scan over
       * every table entry, and one addition (adds the identity when the window digit is 0 — never
       * skipped).
       *
       * `n` must be `< 2^bits`. Assumes complete addition (adding the identity costs the same as any
       * add), which holds for the Weierstrass/Edwards point types used here. The table is left in
       * projective form (no normalizeZ): normalizing this small a table costs more than the
       * mixed-add savings it would buy for a single multiply.
       * @returns real point `p`; `f` duplicates it only to match {@link wnafCachedCT}'s return shape
       * (this path needs no fake accumulator — its op-count is already scalar-independent).
       */
      fixedWindowCT(point, n, bits) {
        const W = FW_WINDOW;
        const size = 1 << W;
        const mask = bitMask(W);
        const table = new Array(size);
        table[0] = this.ZERO;
        for (let i = 1; i < size; i++)
          table[i] = table[i - 1].add(point);
        const windows = Math.ceil(bits / W);
        let acc = this.ZERO;
        for (let window = windows - 1; window >= 0; window--) {
          if (window !== windows - 1)
            for (let d = 0; d < W; d++)
              acc = acc.double();
          const digit = Number(n >> BigInt(window * W) & mask);
          let sel = table[0];
          for (let i = 1; i < size; i++)
            sel = i === digit ? table[i] : sel;
          acc = acc.add(sel);
        }
        return { p: acc, f: acc };
      }
      shouldBlind(point, cofactor) {
        if (this.randomBytes === void 0)
          return false;
        if (cofactor === _1n3)
          return true;
        if (point !== this.BASE)
          return false;
        if (this.baseCanBeBlinded === void 0)
          this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
        return this.baseCanBeBlinded;
      }
      mulSecret(point, scalar, cofactor, transform) {
        return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
      }
      mulUnsafe(point, scalar, transform) {
        this.assertPoint(point);
        if (!isPosBig(scalar))
          throw new Error("invalid scalar");
        const W = getWindowSize(point);
        if (W === 1 || scalar >= this.Point.Fn.ORDER)
          return mulAddUnsafe(this.Point, [point], [scalar], true);
        const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
        return this.wnafCachedCT(precomputes, scalar).p;
      }
      // Remembers the window size used for precomputed wNAF multiplication of the given point
      // and drops any previously built tables. Usually only the base point is precomputed.
      // W=1 resets the point to the un-precomputed (table-less) paths.
      // W is additionally capped so tables stay under ~2 GiB ({@link TABLE_BYTES_MAX}).
      setWindowSize(point, W) {
        this.assertPoint(point);
        validateW(W, this.bits);
        const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
        validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
        pointWindowSizes.set(point, W);
        this.wnafPrecomputes.delete(point);
      }
      // True when a window size is set: tables themselves are built lazily on first multiply.
      hasWindowSize(point) {
        return getWindowSize(point) !== 1;
      }
    };
    __name(mulAddUnsafe, "mulAddUnsafe");
    __name(createField, "createField");
    __name(createCurveFields, "createCurveFields");
    __name(createKeygen, "createKeygen");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/edwards.js
function isEdValidXY(Fp2, CURVE, x, y) {
  const x2 = Fp2.sqr(x);
  const y2 = Fp2.sqr(y);
  const left = Fp2.add(Fp2.mul(CURVE.a, x2), y2);
  const right = Fp2.add(Fp2.ONE, Fp2.mul(CURVE.d, Fp2.mul(x2, y2)));
  return Fp2.eql(left, right);
}
function edwards(params, extraOpts = {}) {
  validateObject(extraOpts, {}, {}, "extraOpts");
  const opts = extraOpts;
  const validated = createCurveFields("edwards", params, opts, opts.FpFnLE);
  const { Fp: Fp2, Fn: Fn2 } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor } = CURVE;
  if (FpLegendre(Fp2, CURVE.a) !== 1)
    throw new Error("edwards: CURVE.a must be a square in Fp for complete addition formulas");
  if (FpLegendre(Fp2, CURVE.d) !== -1)
    throw new Error("edwards: CURVE.d must be a non-square in Fp for complete addition formulas");
  validateObject(opts, {}, { uvRatio: "function", randomBytes: "function" });
  const randomBytes4 = opts.randomBytes === void 0 ? randomBytes3 : opts.randomBytes;
  const MASK = _2n2 << BigInt(Fp2.BYTES * 8) - _1n4;
  function isOdd(n) {
    if (!Fp2.isOdd)
      throw new Error("Field does not have .isOdd()");
    return Fp2.isOdd(n);
  }
  __name(isOdd, "isOdd");
  const uvRatio2 = opts.uvRatio === void 0 ? (u, v) => {
    try {
      return { isValid: true, value: Fp2.sqrt(Fp2.div(u, v)) };
    } catch (e) {
      return { isValid: false, value: _0n4 };
    }
  } : opts.uvRatio;
  if (!isEdValidXY(Fp2, CURVE, CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const mulA = Fp2.eql(CURVE.a, Fp2.neg(Fp2.ONE)) ? (x) => Fp2.neg(x) : Fp2.eql(CURVE.a, Fp2.ONE) ? (x) => x : (x) => Fp2.mul(CURVE.a, x);
  function acoord(title, n, banZero = false) {
    const min = banZero ? _1n4 : _0n4;
    aInRange("coordinate " + title, n, min, MASK);
    return n;
  }
  __name(acoord, "acoord");
  function aedpoint(other) {
    if (!(other instanceof Point))
      throw new Error("EdwardsPoint expected");
  }
  __name(aedpoint, "aedpoint");
  class Point {
    static {
      __name(this, "Point");
    }
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp2.ONE, Fp2.mul(CURVE.Gx, CURVE.Gy));
    static ZERO = new Point(Fp2.ZERO, Fp2.ONE, Fp2.ONE, Fp2.ZERO);
    static Fp = Fp2;
    static Fn = Fn2;
    X;
    Y;
    Z;
    T;
    constructor(X, Y, Z, T) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y);
      this.Z = acoord("z", Z, true);
      this.T = acoord("t", T);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /**
     * Create one extended Edwards point from affine coordinates.
     * Does NOT validate that the point is on-curve or torsion-free.
     * Use `.assertValidity()` on adversarial inputs.
     */
    static fromAffine(p) {
      if (p instanceof Point)
        throw new Error("extended point not allowed");
      const { x, y } = p || {};
      acoord("x", x);
      acoord("y", y);
      return new Point(x, y, Fp2.ONE, Fp2.mul(x, y));
    }
    // Uses algo from RFC8032 5.1.3.
    static fromBytes(bytes3, zip215 = false) {
      const len = Fp2.BYTES;
      const { a, d } = CURVE;
      bytes3 = copyBytes2(abytes3(bytes3, len, "point"));
      abool2(zip215, "zip215");
      const normed = copyBytes2(bytes3);
      const lastByte = bytes3[len - 1];
      normed[len - 1] = lastByte & ~128;
      const y = bytesToNumberLE(normed);
      const max = zip215 ? MASK : Fp2.ORDER;
      aInRange("point.y", y, _0n4, max);
      const y2 = Fp2.sqr(y);
      const u = Fp2.sub(y2, Fp2.ONE);
      const v = Fp2.sub(Fp2.mulN(d, y2), a);
      let { isValid, value: x } = uvRatio2(u, v);
      if (!isValid)
        throw new Error("bad point: invalid y coordinate");
      const isXOdd = isOdd(x);
      const isLastByteOdd = (lastByte & 128) !== 0;
      if (!zip215 && Fp2.is0(x) && isLastByteOdd)
        throw new Error("bad point: x=0 and x_0=1");
      if (isLastByteOdd !== isXOdd)
        x = Fp2.neg(x);
      return Point.fromAffine({ x, y });
    }
    static fromHex(hex2, zip215 = false) {
      return Point.fromBytes(hexToBytes2(hex2), zip215);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 6, isLazy = true) {
      wnaf.setWindowSize(this, windowSize);
      if (!isLazy)
        this.multiply(_2n2);
      return this;
    }
    // Useful in fromAffine() - not for fromBytes(), which always created valid points.
    assertValidity() {
      const p = this;
      const { a, d } = CURVE;
      if (p.is0())
        throw new Error("bad point: ZERO");
      const { X, Y, Z, T } = p;
      const X2 = Fp2.sqr(X);
      const Y2 = Fp2.sqr(Y);
      const Z2 = Fp2.sqr(Z);
      const Z4 = Fp2.sqr(Z2);
      const aX2 = Fp2.mul(X2, a);
      const left = Fp2.mul(Fp2.add(aX2, Y2), Z2);
      const right = Fp2.add(Z4, Fp2.mul(d, Fp2.mul(X2, Y2)));
      if (!Fp2.eql(left, right))
        throw new Error("bad point: equation left != right (1)");
      const XY = Fp2.mul(X, Y);
      const ZT = Fp2.mul(Z, T);
      if (!Fp2.eql(XY, ZT))
        throw new Error("bad point: equation left != right (2)");
    }
    // Compare one point to another.
    equals(other) {
      aedpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const X1Z2 = Fp2.mul(X1, Z2);
      const X2Z1 = Fp2.mul(X2, Z1);
      const Y1Z2 = Fp2.mul(Y1, Z2);
      const Y2Z1 = Fp2.mul(Y2, Z1);
      return Fp2.eql(X1Z2, X2Z1) && Fp2.eql(Y1Z2, Y2Z1);
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    negate() {
      return new Point(Fp2.neg(this.X), this.Y, this.Z, Fp2.neg(this.T));
    }
    // Fast algo for doubling Extended Point.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
    // Cost: 4M + 4S + 1*a + 6add + 1*2.
    double() {
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const A = Fp2.sqr(X1);
      const B = Fp2.sqr(Y1);
      const C = Fp2.mul(Fp2.sqr(Z1), _2n2);
      const D = mulA(A);
      const x1y1 = Fp2.addN(X1, Y1);
      const E = Fp2.sub(Fp2.subN(Fp2.sqr(x1y1), A), B);
      const G = Fp2.addN(D, B);
      const F = Fp2.subN(G, C);
      const H = Fp2.subN(D, B);
      const X3 = Fp2.mul(E, F);
      const Y3 = Fp2.mul(G, H);
      const T3 = Fp2.mul(E, H);
      const Z3 = Fp2.mul(F, G);
      return new Point(X3, Y3, Z3, T3);
    }
    // Fast algo for adding 2 Extended Points.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
    // Cost: 9M + 1*a + 1*d + 7add.
    add(other) {
      aedpoint(other);
      const { d } = CURVE;
      const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
      const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
      const A = Fp2.mul(X1, X2);
      const B = Fp2.mul(Y1, Y2);
      const C = Fp2.mul(Fp2.mulN(T1, d), T2);
      const D = Fp2.mul(Z1, Z2);
      const E = Fp2.sub(Fp2.subN(Fp2.mulN(Fp2.addN(X1, Y1), Fp2.addN(X2, Y2)), A), B);
      const F = Fp2.subN(D, C);
      const G = Fp2.addN(D, C);
      const H = Fp2.sub(B, mulA(A));
      const X3 = Fp2.mul(E, F);
      const Y3 = Fp2.mul(G, H);
      const T3 = Fp2.mul(E, H);
      const Z3 = Fp2.mul(F, G);
      return new Point(X3, Y3, Z3, T3);
    }
    subtract(other) {
      aedpoint(other);
      return this.add(other.negate());
    }
    // Constant-time multiplication.
    multiply(scalar) {
      if (!Fn2.isValidNot0(scalar))
        throw new RangeError("invalid scalar: expected 1 <= sc < curve.n");
      const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
      return normalize([p, f])[0];
    }
    // Non-constant-time multiplication. Uses double-and-add algorithm.
    // It's faster, but should only be used when you don't care about
    // an exposed private key e.g. sig verification.
    // Keeps the same subgroup-scalar contract: 0 is allowed for public-scalar callers, but
    // n and larger values are rejected instead of being reduced mod n to the identity point.
    multiplyUnsafe(scalar) {
      if (!Fn2.isValid(scalar))
        throw new RangeError("invalid scalar: expected 0 <= sc < curve.n");
      if (scalar === _0n4)
        return Point.ZERO;
      if (this.is0() || scalar === _1n4)
        return this;
      return wnaf.mulUnsafe(this, scalar, normalize);
    }
    // Checks if point is of small order.
    // If you add something to small order point, you will have "dirty"
    // point with torsion component.
    // Clears cofactor and checks if the result is 0.
    isSmallOrder() {
      return this.clearCofactor().is0();
    }
    // Multiplies point by curve order and checks if the result is 0.
    // Returns `false` is the point is dirty.
    isTorsionFree() {
      return wnaf.mulUnsafe(this, CURVE.n).is0();
    }
    // Converts Extended point to default (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      if (iz != null && typeof iz !== "bigint")
        throw new TypeError('"invertedZ" expected bigint, got type=' + typeof iz);
      const { X, Y, Z } = p;
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp2.create(_8n2) : Fp2.inv(Z);
      const x = Fp2.mul(X, iz);
      const y = Fp2.mul(Y, iz);
      const zz = Fp2.mul(Z, iz);
      if (is0)
        return { x: Fp2.ZERO, y: Fp2.ONE };
      if (!Fp2.eql(zz, Fp2.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    clearCofactor() {
      if (cofactor === _1n4)
        return this;
      if (cofactor === _2n2)
        return this.double();
      if (cofactor === _4n3)
        return this.double().double();
      if (cofactor === _8n2)
        return this.double().double().double();
      return this.multiplyUnsafe(cofactor);
    }
    toBytes() {
      const { x, y } = this.toAffine();
      const bytes3 = Fp2.toBytes(y);
      bytes3[bytes3.length - 1] |= isOdd(x) ? 128 : 0;
      return bytes3;
    }
    toHex() {
      return bytesToHex2(this.toBytes());
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const normalize = /* @__PURE__ */ __name((points) => normalizeZ(Point, points), "normalize");
  const wnaf = new ScalarMultiplier(Point, randomBytes4);
  if (wnaf.bits >= 6)
    Point.BASE.precompute(6);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
function eddsa(Point, cHash, eddsaOpts = {}) {
  validatePointCons(Point);
  if (typeof cHash !== "function")
    throw new Error('"hash" function param is required');
  const hash = cHash;
  const opts = eddsaOpts;
  validateObject(opts, {}, {
    adjustScalarBytes: "function",
    randomBytes: "function",
    domain: "function",
    prehash: "function",
    zip215: "boolean",
    mapToCurve: "function",
    toMontgomery: "function",
    toMontgomerySecret: "function"
  });
  const { prehash } = opts;
  const { BASE, Fp: Fp2, Fn: Fn2 } = Point;
  const outputLen = hash.outputLen;
  const expectedLen = 2 * Fp2.BYTES;
  if (outputLen !== void 0) {
    asafenumber(outputLen, "hash.outputLen");
    if (outputLen !== expectedLen)
      throw new Error(`hash.outputLen must be ${expectedLen}, got ${outputLen}`);
  }
  const randomBytes4 = opts.randomBytes === void 0 ? randomBytes3 : opts.randomBytes;
  const toMontgomery2 = opts.toMontgomery;
  const toMontgomerySecret2 = opts.toMontgomerySecret;
  const adjustScalarBytes2 = opts.adjustScalarBytes === void 0 ? (bytes3) => bytes3 : opts.adjustScalarBytes;
  const domain = opts.domain === void 0 ? (data, ctx, phflag) => {
    abool2(phflag, "phflag");
    if (ctx.length || phflag)
      throw new Error("Contexts/pre-hash are not supported");
    return data;
  } : opts.domain;
  function modN_LE(hash2) {
    return Fn2.create(bytesToNumberLE(hash2));
  }
  __name(modN_LE, "modN_LE");
  function getPrivateScalar(key) {
    const len = lengths.secretKey;
    abytes3(key, lengths.secretKey, "secretKey");
    const hashed = abytes3(hash(key), 2 * len, "hashedSecretKey");
    const head = adjustScalarBytes2(hashed.slice(0, len));
    const prefix = hashed.slice(len, 2 * len);
    const scalar = modN_LE(head);
    return { head, prefix, scalar };
  }
  __name(getPrivateScalar, "getPrivateScalar");
  function getExtendedPublicKey(secretKey) {
    const { head, prefix, scalar } = getPrivateScalar(secretKey);
    const point = BASE.multiply(scalar);
    const pointBytes = point.toBytes();
    return { head, prefix, scalar, point, pointBytes };
  }
  __name(getExtendedPublicKey, "getExtendedPublicKey");
  function getPublicKey(secretKey) {
    return getExtendedPublicKey(secretKey).pointBytes;
  }
  __name(getPublicKey, "getPublicKey");
  function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
    const msg = concatBytes3(...msgs);
    return modN_LE(hash(domain(msg, abytes3(context, void 0, "context"), !!prehash)));
  }
  __name(hashDomainToScalar, "hashDomainToScalar");
  function sign(msg, secretKey, options = {}) {
    validateObject(options, {}, {}, "options");
    msg = copyBytes2(abytes3(msg, void 0, "message"));
    if (prehash)
      msg = prehash(msg);
    const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
    const r = hashDomainToScalar(options.context, prefix, msg);
    const R = BASE.multiply(r).toBytes();
    const k = hashDomainToScalar(options.context, R, pointBytes, msg);
    const s = Fn2.create(r + k * scalar);
    if (!Fn2.isValid(s))
      throw new Error("sign failed: invalid s");
    const rs = concatBytes3(R, Fn2.toBytes(s));
    return abytes3(rs, lengths.signature, "result");
  }
  __name(sign, "sign");
  const verifyOpts = {
    zip215: opts.zip215
  };
  function verify(sig, msg, publicKey, options = verifyOpts) {
    validateObject(options);
    const { context } = options;
    const zip215 = options.zip215 === void 0 ? !!verifyOpts.zip215 : options.zip215;
    const len = lengths.signature;
    sig = abytes3(sig, len, "signature");
    msg = abytes3(msg, void 0, "message");
    publicKey = abytes3(publicKey, lengths.publicKey, "publicKey");
    if (zip215 !== void 0)
      abool2(zip215, "zip215");
    if (prehash)
      msg = prehash(msg);
    const mid = len / 2;
    const r = sig.subarray(0, mid);
    const s = bytesToNumberLE(sig.subarray(mid, len));
    let A, R, SB;
    try {
      A = Point.fromBytes(publicKey, zip215);
      R = Point.fromBytes(r, zip215);
      SB = BASE.multiplyUnsafe(s);
    } catch (error) {
      return false;
    }
    if (!zip215 && A.isSmallOrder())
      return false;
    const k = hashDomainToScalar(context, r, publicKey, msg);
    const RkA = R.add(A.multiplyUnsafe(k));
    return RkA.subtract(SB).clearCofactor().is0();
  }
  __name(verify, "verify");
  const _size = Fp2.BYTES;
  const lengths = {
    secretKey: _size,
    publicKey: _size,
    signature: 2 * _size,
    seed: _size
  };
  function randomSecretKey(seed) {
    seed = seed === void 0 ? randomBytes4(lengths.seed) : seed;
    return abytes3(seed, lengths.seed, "seed");
  }
  __name(randomSecretKey, "randomSecretKey");
  function isValidSecretKey(key) {
    return isBytes3(key) && key.length === lengths.secretKey;
  }
  __name(isValidSecretKey, "isValidSecretKey");
  function isValidPublicKey(key, zip215) {
    try {
      return !!Point.fromBytes(key, zip215 === void 0 ? verifyOpts.zip215 : zip215);
    } catch (error) {
      return false;
    }
  }
  __name(isValidPublicKey, "isValidPublicKey");
  const utils = {
    getExtendedPublicKey,
    randomSecretKey,
    isValidSecretKey,
    isValidPublicKey,
    /** Converts an Edwards public key to a companion Montgomery public key. */
    toMontgomery(publicKey) {
      if (toMontgomery2 === void 0)
        throw new Error("Montgomery conversion is not supported for this curve");
      return toMontgomery2(Point.fromBytes(publicKey));
    },
    toMontgomerySecret(secretKey) {
      if (toMontgomerySecret2 === void 0)
        throw new Error("Montgomery conversion is not supported for this curve");
      return toMontgomerySecret2(secretKey);
    }
  };
  Object.freeze(lengths);
  Object.freeze(utils);
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getPublicKey,
    sign,
    verify,
    utils,
    Point,
    lengths
  });
}
var _0n4, _1n4, _2n2, _4n3, _8n2, PrimeEdwardsPoint;
var init_edwards = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/edwards.js"() {
    init_utils3();
    init_curve();
    init_modular();
    _0n4 = /* @__PURE__ */ BigInt(0);
    _1n4 = /* @__PURE__ */ BigInt(1);
    _2n2 = /* @__PURE__ */ BigInt(2);
    _4n3 = /* @__PURE__ */ BigInt(4);
    _8n2 = /* @__PURE__ */ BigInt(8);
    __name(isEdValidXY, "isEdValidXY");
    __name(edwards, "edwards");
    PrimeEdwardsPoint = class {
      static {
        __name(this, "PrimeEdwardsPoint");
      }
      static BASE;
      static ZERO;
      static Fp;
      static Fn;
      ep;
      /**
       * Wrap one internal Edwards representative directly.
       * This is not a canonical encoding boundary: alternate Edwards
       * representatives may still describe the same abstract wrapper element.
       */
      constructor(ep) {
        this.ep = ep;
      }
      // Static methods that must be implemented by subclasses
      static fromBytes(_bytes) {
        notImplemented();
      }
      static fromHex(_hex) {
        notImplemented();
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      // Common implementations
      clearCofactor() {
        return this;
      }
      assertValidity() {
        this.ep.assertValidity();
      }
      /**
       * Return affine coordinates of the current internal Edwards representative.
       * This is a convenience helper, not a canonical Ristretto/Decaf encoding.
       * Equal abstract elements may expose different `x` / `y`; use
       * `toBytes()` / `fromBytes()` for canonical roundtrips.
       */
      toAffine(invertedZ) {
        return this.ep.toAffine(invertedZ);
      }
      toHex() {
        return bytesToHex2(this.toBytes());
      }
      toString() {
        return this.toHex();
      }
      isTorsionFree() {
        return true;
      }
      isSmallOrder() {
        return false;
      }
      add(other) {
        this.assertSame(other);
        return this.init(this.ep.add(other.ep));
      }
      subtract(other) {
        this.assertSame(other);
        return this.init(this.ep.subtract(other.ep));
      }
      multiply(scalar) {
        return this.init(this.ep.multiply(scalar));
      }
      multiplyUnsafe(scalar) {
        return this.init(this.ep.multiplyUnsafe(scalar));
      }
      double() {
        return this.init(this.ep.double());
      }
      negate() {
        return this.init(this.ep.negate());
      }
      precompute(windowSize, isLazy) {
        this.ep.precompute(windowSize, isLazy);
        return this;
      }
    };
    __name(eddsa, "eddsa");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/fft.js
function checkU32(n, title = "n") {
  if (typeof n !== "number")
    throw new TypeError(`wrong u32 integer "${title}": expected number, got type=${typeof n}`);
  if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
    throw new RangeError(`wrong u32 integer "${title}": expected 0..4294967295, got ${n}`);
  return n;
}
function isPowerOfTwo(x) {
  checkU32(x, "x");
  return (x & x - 1) === 0 && x !== 0;
}
function nextPowerOfTwo(n) {
  checkU32(n);
  if (n <= 1)
    return 1;
  if (n > 2147483648)
    throw new Error("nextPowerOfTwo overflow: result does not fit u32");
  return 1 << log2(n - 1) + 1 >>> 0;
}
function log2(n) {
  checkU32(n);
  return 31 - Math.clz32(n);
}
function poly(field, roots, create, fft, length) {
  validateField(field);
  const F = field;
  const _create = create || ((len, elm) => new Array(len).fill(elm ?? F.ZERO));
  const isPoly = /* @__PURE__ */ __name((x) => {
    if (Array.isArray(x))
      return true;
    if (!ArrayBuffer.isView(x))
      return false;
    const v = x;
    return typeof v.length === "number" && typeof v.slice === "function" && typeof v[Symbol.iterator] === "function";
  }, "isPoly");
  const checkPoly = /* @__PURE__ */ __name((title, value) => {
    if (!isPoly(value))
      throw new TypeError(`"${title}" expected polynomial, got type=${typeof value}`);
  }, "checkPoly");
  const checkLength = /* @__PURE__ */ __name((a, b) => {
    checkPoly("a", a);
    const L = a.length;
    if (b !== void 0) {
      checkPoly("b", b);
      if (b.length !== L)
        throw new Error(`poly: mismatched lengths ${L} vs ${b.length}`);
    }
    if (length !== void 0 && L !== length)
      throw new Error(`poly: expected fixed length ${length}, got ${L}`);
    return L;
  }, "checkLength");
  function findOmegaIndex(x, n, brp = false, weights) {
    if (!isPowerOfTwo(n))
      throw new Error("poly.lagrange: expected power of two length, got " + n);
    const omega = weights || (brp ? roots.brp(log2(n)) : roots.roots(log2(n)));
    for (let i = 0; i < n; i++)
      if (F.eql(x, omega[i]))
        return i;
    return -1;
  }
  __name(findOmegaIndex, "findOmegaIndex");
  return {
    roots,
    create: _create,
    length,
    extend: /* @__PURE__ */ __name((a, len) => {
      checkLength(a);
      const out = _create(len, F.ZERO);
      for (let i = 0; i < Math.min(a.length, len); i++)
        out[i] = a[i];
      return out;
    }, "extend"),
    degree: /* @__PURE__ */ __name((a) => {
      checkLength(a);
      for (let i = a.length - 1; i >= 0; i--)
        if (!F.is0(a[i]))
          return i;
      return -1;
    }, "degree"),
    add: /* @__PURE__ */ __name((a, b) => {
      const len = checkLength(a, b);
      const out = _create(len);
      for (let i = 0; i < len; i++)
        out[i] = F.add(a[i], b[i]);
      return out;
    }, "add"),
    sub: /* @__PURE__ */ __name((a, b) => {
      const len = checkLength(a, b);
      const out = _create(len);
      for (let i = 0; i < len; i++)
        out[i] = F.sub(a[i], b[i]);
      return out;
    }, "sub"),
    dot: /* @__PURE__ */ __name((a, b) => {
      const len = checkLength(a, b);
      const out = _create(len);
      for (let i = 0; i < len; i++)
        out[i] = F.mul(a[i], b[i]);
      return out;
    }, "dot"),
    mul: /* @__PURE__ */ __name((a, b) => {
      if (isPoly(b)) {
        const len = checkLength(a, b);
        if (fft) {
          const A = fft.direct(a, false, true);
          const B = fft.direct(b, false, true);
          for (let i = 0; i < A.length; i++)
            A[i] = F.mul(A[i], B[i]);
          return fft.inverse(A, true, false);
        } else {
          const res = _create(len);
          for (let i = 0; i < len; i++) {
            for (let j = 0; j < len; j++) {
              const k = (i + j) % len;
              res[k] = F.add(res[k], F.mul(a[i], b[j]));
            }
          }
          return res;
        }
      } else {
        const out = _create(checkLength(a));
        for (let i = 0; i < out.length; i++)
          out[i] = F.mul(a[i], b);
        return out;
      }
    }, "mul"),
    convolve(a, b) {
      checkPoly("a", a);
      checkPoly("b", b);
      const len = nextPowerOfTwo(a.length + b.length - 1);
      return this.mul(this.extend(a, len), this.extend(b, len));
    },
    shift(p, factor) {
      checkPoly("p", p);
      const out = _create(p.length);
      if (length !== void 0 && p.length !== length)
        throw new Error(`poly: expected fixed length ${length}, got ${p.length}`);
      if (!p.length)
        return out;
      out[0] = p[0];
      for (let i = 1, power = F.ONE; i < p.length; i++) {
        power = F.mul(power, factor);
        out[i] = F.mul(p[i], power);
      }
      return out;
    },
    clone: /* @__PURE__ */ __name((a) => {
      checkLength(a);
      const out = _create(a.length);
      for (let i = 0; i < a.length; i++)
        out[i] = a[i];
      return out;
    }, "clone"),
    eval: /* @__PURE__ */ __name((a, basis) => {
      checkLength(a, basis);
      let acc = F.ZERO;
      for (let i = 0; i < a.length; i++)
        acc = F.add(acc, F.mul(a[i], basis[i]));
      return acc;
    }, "eval"),
    monomial: {
      basis: /* @__PURE__ */ __name((x, n) => {
        const out = _create(n);
        let pow3 = F.ONE;
        for (let i = 0; i < n; i++) {
          out[i] = pow3;
          pow3 = F.mul(pow3, x);
        }
        return out;
      }, "basis"),
      eval: /* @__PURE__ */ __name((a, x) => {
        checkLength(a);
        let acc = F.ZERO;
        for (let i = a.length - 1; i >= 0; i--)
          acc = F.add(F.mul(acc, x), a[i]);
        return acc;
      }, "eval")
    },
    lagrange: {
      basis: /* @__PURE__ */ __name((x, n, brp = false, weights) => {
        if (!isPowerOfTwo(n))
          throw new Error("poly.lagrange: expected power of two length, got " + n);
        const bits = log2(n);
        const cache = weights || (brp ? roots.brp(bits) : roots.roots(bits));
        const out = _create(n);
        const idx = findOmegaIndex(x, n, brp, weights);
        if (idx !== -1) {
          out[idx] = F.ONE;
          return out;
        }
        const tm = F.pow(x, BigInt(n));
        const c = F.mul(F.sub(tm, F.ONE), F.inv(BigInt(n)));
        const denom = _create(n);
        for (let i = 0; i < n; i++)
          denom[i] = F.sub(x, cache[i]);
        const inv = F.invertBatch(denom);
        for (let i = 0; i < n; i++)
          out[i] = F.mul(c, F.mul(cache[i], inv[i]));
        return out;
      }, "basis"),
      eval(a, x, brp = false) {
        checkLength(a);
        const idx = findOmegaIndex(x, a.length, brp);
        if (idx !== -1)
          return a[idx];
        const L = this.basis(x, a.length, brp);
        let acc = F.ZERO;
        for (let i = 0; i < a.length; i++)
          if (!F.is0(a[i]))
            acc = F.add(acc, F.mul(a[i], L[i]));
        return acc;
      }
    },
    vanishing(roots2) {
      checkPoly("roots", roots2);
      if (length !== void 0 && roots2.length !== length)
        throw new Error(`poly: expected fixed length ${length}, got ${roots2.length}`);
      const out = _create(roots2.length + 1, F.ZERO);
      out[0] = F.ONE;
      for (const r of roots2) {
        const neg = F.neg(r);
        for (let j = out.length - 1; j > 0; j--)
          out[j] = F.add(F.mul(out[j], neg), out[j - 1]);
        out[0] = F.mul(out[0], neg);
      }
      return out;
    }
  };
}
var init_fft = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/fft.js"() {
    init_modular();
    __name(checkU32, "checkU32");
    __name(isPowerOfTwo, "isPowerOfTwo");
    __name(nextPowerOfTwo, "nextPowerOfTwo");
    __name(log2, "log2");
    __name(poly, "poly");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/hash-to-curve.js
function i2osp(value, length) {
  asafenumber(value);
  asafenumber(length);
  if (length < 0 || length > 4)
    throw new Error("invalid I2OSP length: " + length);
  if (value < 0 || value > 2 ** (8 * length) - 1)
    throw new Error("invalid I2OSP input: " + value);
  const res = Array.from({ length }).fill(0);
  for (let i = length - 1; i >= 0; i--) {
    res[i] = value & 255;
    value >>>= 8;
  }
  return new Uint8Array(res);
}
function strxor(a, b) {
  const arr = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    arr[i] = a[i] ^ b[i];
  }
  return arr;
}
function normDST(DST) {
  if (!isBytes3(DST) && typeof DST !== "string")
    throw new Error("DST must be Uint8Array or ascii string");
  const dst = typeof DST === "string" ? asciiToBytes(DST) : DST;
  if (dst.length === 0)
    throw new Error("DST must be non-empty");
  return dst;
}
function expand_message_xmd(msg, DST, lenInBytes, H) {
  abytes3(msg);
  asafenumber(lenInBytes);
  if (typeof H !== "function")
    throw new Error("expand_message_xmd: expected hash function");
  asafenumber(H.outputLen, "hash.outputLen");
  asafenumber(H.blockLen, "hash.blockLen");
  DST = normDST(DST);
  if (DST.length > 255)
    DST = H(concatBytes3(asciiToBytes("H2C-OVERSIZE-DST-"), DST));
  const { outputLen: b_in_bytes, blockLen: r_in_bytes } = H;
  const ell = Math.ceil(lenInBytes / b_in_bytes);
  if (lenInBytes > 65535 || ell > 255)
    throw new Error("expand_message_xmd: invalid lenInBytes");
  const DST_prime = concatBytes3(DST, i2osp(DST.length, 1));
  const Z_pad = new Uint8Array(r_in_bytes);
  const l_i_b_str = i2osp(lenInBytes, 2);
  const b = new Array(ell);
  const b_0 = H(concatBytes3(Z_pad, msg, l_i_b_str, i2osp(0, 1), DST_prime));
  b[0] = H(concatBytes3(b_0, i2osp(1, 1), DST_prime));
  for (let i = 1; i < ell; i++) {
    const args = [strxor(b_0, b[i - 1]), i2osp(i + 1, 1), DST_prime];
    b[i] = H(concatBytes3(...args));
  }
  const pseudo_random_bytes = concatBytes3(...b);
  return pseudo_random_bytes.slice(0, lenInBytes);
}
function expand_message_xof(msg, DST, lenInBytes, k, H) {
  abytes3(msg);
  asafenumber(lenInBytes);
  asafenumber(k, "k");
  if (k < 0)
    throw new Error("expand_message_xof: invalid k");
  if (typeof H !== "function")
    throw new Error("expand_message_xof: expected XOF function");
  if (typeof H.create !== "function")
    throw new Error("expand_message_xof: expected XOF create");
  DST = normDST(DST);
  if (lenInBytes < 0 || lenInBytes > 65535)
    throw new Error("expand_message_xof: invalid lenInBytes");
  if (DST.length > 255) {
    const dkLen = Math.ceil(2 * k / 8);
    DST = H.create({ dkLen }).update(asciiToBytes("H2C-OVERSIZE-DST-")).update(DST).digest();
  }
  if (DST.length > 255)
    throw new Error("expand_message_xof: invalid DST");
  return H.create({ dkLen: lenInBytes }).update(msg).update(i2osp(lenInBytes, 2)).update(DST).update(i2osp(DST.length, 1)).digest();
}
function hash_to_field(msg, count, options) {
  validateObject(options, {
    p: "bigint",
    m: "number",
    k: "number",
    hash: "function"
  });
  const { p, k, m, hash, expand: expand2, DST } = options;
  asafenumber(hash.outputLen, "valid hash");
  abytes3(msg);
  asafenumber(count);
  asafenumber(m, "m");
  asafenumber(k, "k");
  if (p <= BigInt(1))
    throw new Error("hash_to_field: expected valid field characteristic");
  if (count < 1)
    throw new Error("hash_to_field: expected count >= 1");
  if (m < 1)
    throw new Error("hash_to_field: expected m >= 1");
  if (k < 0)
    throw new Error("hash_to_field: invalid k");
  const log2p = p.toString(2).length;
  const L = Math.ceil((log2p + k) / 8);
  const len_in_bytes = count * m * L;
  let prb;
  if (expand2 === "xmd") {
    prb = expand_message_xmd(msg, DST, len_in_bytes, hash);
  } else if (expand2 === "xof") {
    prb = expand_message_xof(msg, DST, len_in_bytes, k, hash);
  } else if (expand2 === "_internal_pass") {
    prb = msg;
  } else {
    throw new Error('expand must be "xmd" or "xof"');
  }
  const u = new Array(count);
  for (let i = 0; i < count; i++) {
    const e = new Array(m);
    for (let j = 0; j < m; j++) {
      const elm_offset = L * (j + i * m);
      const tv = prb.subarray(elm_offset, elm_offset + L);
      e[j] = mod(os2ip(tv), p);
    }
    u[i] = e;
  }
  return u;
}
function createHasher2(Point, mapToCurve, defaults) {
  if (typeof mapToCurve !== "function")
    throw new Error("mapToCurve() must be defined");
  validateObject(defaults);
  const snapshot = /* @__PURE__ */ __name((src) => Object.freeze({
    ...src,
    DST: isBytes3(src.DST) ? copyBytes2(src.DST) : src.DST,
    ...src.encodeDST === void 0 ? {} : { encodeDST: isBytes3(src.encodeDST) ? copyBytes2(src.encodeDST) : src.encodeDST }
  }), "snapshot");
  const safeDefaults = snapshot(defaults);
  const dstOverride = /* @__PURE__ */ __name((options) => options && options.DST !== void 0 ? { DST: options.DST } : void 0, "dstOverride");
  function map(num) {
    return Point.fromAffine(mapToCurve(num));
  }
  __name(map, "map");
  function clear(initial) {
    const P = initial.clearCofactor();
    if (P.equals(Point.ZERO))
      return Point.ZERO;
    P.assertValidity();
    return P;
  }
  __name(clear, "clear");
  return Object.freeze({
    get defaults() {
      return snapshot(safeDefaults);
    },
    Point,
    hashToCurve(msg, options) {
      const opts = Object.assign({}, safeDefaults, dstOverride(options));
      const u = hash_to_field(msg, 2, opts);
      const u0 = map(u[0]);
      const u1 = map(u[1]);
      return clear(u0.add(u1));
    },
    encodeToCurve(msg, options) {
      const optsDst = safeDefaults.encodeDST === void 0 ? {} : { DST: safeDefaults.encodeDST };
      const opts = Object.assign({}, safeDefaults, optsDst, dstOverride(options));
      const u = hash_to_field(msg, 1, opts);
      const u0 = map(u[0]);
      return clear(u0);
    },
    /** See {@link H2CHasher} */
    mapToCurve(scalars) {
      if (safeDefaults.m === 1) {
        if (typeof scalars !== "bigint")
          throw new Error("expected bigint (m=1)");
        return clear(map([scalars]));
      }
      if (!Array.isArray(scalars))
        throw new Error("expected array of bigints");
      if (scalars.length !== safeDefaults.m)
        throw new Error(`expected array of ${safeDefaults.m} bigints`);
      for (const i of scalars)
        if (typeof i !== "bigint")
          throw new Error("expected array of bigints");
      return clear(map(scalars));
    },
    // hash_to_scalar can produce 0: https://www.rfc-editor.org/errata/eid8393
    // RFC 9380, draft-irtf-cfrg-bbs-signatures-08. Default scalar DST is the shared generic
    // `HashToScalar-` prefix above unless the caller overrides it per invocation.
    hashToScalar(msg, options) {
      const N = Point.Fn.ORDER;
      const opts = Object.assign({}, safeDefaults, { DST: _DST_scalar }, dstOverride(options), {
        p: N,
        m: 1
      });
      return hash_to_field(msg, 1, opts)[0][0];
    }
  });
}
var os2ip, _DST_scalar;
var init_hash_to_curve = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/hash-to-curve.js"() {
    init_utils3();
    init_modular();
    os2ip = bytesToNumberBE;
    __name(i2osp, "i2osp");
    __name(strxor, "strxor");
    __name(normDST, "normDST");
    __name(expand_message_xmd, "expand_message_xmd");
    __name(expand_message_xof, "expand_message_xof");
    __name(hash_to_field, "hash_to_field");
    _DST_scalar = "HashToScalar-";
    __name(createHasher2, "createHasher");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/frost.js
function createFROST(opts) {
  validateObject(opts, {
    name: "string",
    hash: "function"
  }, {
    hashToScalar: "function",
    validatePoint: "function",
    parsePublicKey: "function",
    adjustScalar: "function",
    adjustPoint: "function",
    challenge: "function",
    adjustNonces: "function",
    adjustSecret: "function",
    adjustPublic: "function",
    adjustGroupCommitmentShare: "function",
    adjustTx: "object",
    adjustDKG: "function"
  });
  validatePointCons(opts.Point);
  const { Point, validatePoint, parsePublicKey, adjustScalar, adjustPoint: adjustPointHook, challenge, adjustNonces, adjustSecret, adjustPublic, adjustGroupCommitmentShare, adjustDKG } = opts;
  const Fn2 = opts.Fn === void 0 ? Point.Fn : opts.Fn;
  const adjustTx = opts.adjustTx === void 0 ? void 0 : { encode: opts.adjustTx.encode, decode: opts.adjustTx.decode };
  if (adjustTx)
    validateObject(adjustTx, { encode: "function", decode: "function" });
  const hashBytes = opts.hash;
  const hashToScalar = opts.hashToScalar === void 0 ? (msg, opts2 = { DST: new Uint8Array() }) => {
    const t = hashBytes(concatBytes3(opts2.DST, msg));
    return Fn2.create(Fn2.isLE ? bytesToNumberLE(t) : bytesToNumberBE(t));
  } : opts.hashToScalar;
  const H1Prefix = utf8ToBytes(opts.H1 !== void 0 ? opts.H1 : opts.name + "rho");
  const H2Prefix = utf8ToBytes(opts.H2 !== void 0 ? opts.H2 : opts.name + "chal");
  const H3Prefix = utf8ToBytes(opts.H3 !== void 0 ? opts.H3 : opts.name + "nonce");
  const H4Prefix = utf8ToBytes(opts.H4 !== void 0 ? opts.H4 : opts.name + "msg");
  const H5Prefix = utf8ToBytes(opts.H5 !== void 0 ? opts.H5 : opts.name + "com");
  const HDKGPrefix = utf8ToBytes(opts.HDKG !== void 0 ? opts.HDKG : opts.name + "dkg");
  const HIDPrefix = utf8ToBytes(opts.HID !== void 0 ? opts.HID : opts.name + "id");
  const H1 = /* @__PURE__ */ __name((msg) => hashToScalar(msg, { DST: H1Prefix }), "H1");
  const H2 = /* @__PURE__ */ __name((msg) => hashToScalar(msg, { DST: H2Prefix }), "H2");
  const H3 = /* @__PURE__ */ __name((msg) => hashToScalar(msg, { DST: H3Prefix }), "H3");
  const H4 = /* @__PURE__ */ __name((msg) => hashBytes(concatBytes3(H4Prefix, msg)), "H4");
  const H5 = /* @__PURE__ */ __name((msg) => hashBytes(concatBytes3(H5Prefix, msg)), "H5");
  const HDKG = /* @__PURE__ */ __name((msg) => hashToScalar(msg, { DST: HDKGPrefix }), "HDKG");
  const HID = /* @__PURE__ */ __name((msg) => hashToScalar(msg, { DST: HIDPrefix }), "HID");
  const randomScalar = /* @__PURE__ */ __name((rng = randomBytes3) => {
    if (typeof rng !== "function")
      throw new TypeError('"rng" expected function, got type=' + typeof rng);
    const t = mapHashToField(rng(getMinHashLength(Fn2.ORDER)), Fn2.ORDER, Fn2.isLE);
    return Fn2.isLE ? bytesToNumberLE(t) : bytesToNumberBE(t);
  }, "randomScalar");
  const serializePoint = /* @__PURE__ */ __name((p) => p.toBytes(), "serializePoint");
  const validatePublicPoint = /* @__PURE__ */ __name((p) => {
    p.assertValidity();
    if (p.is0())
      throw new Error("invalid point: identity");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    if (validatePoint)
      validatePoint(p);
    return p;
  }, "validatePublicPoint");
  const parsePoint = /* @__PURE__ */ __name((bytes3) => validatePublicPoint(Point.fromBytes(bytes3)), "parsePoint");
  const nonceCommitments = /* @__PURE__ */ __name((identifier, nonces) => ({
    identifier,
    hiding: serializePoint(Point.BASE.multiply(Fn2.fromBytes(nonces.hiding))),
    binding: serializePoint(Point.BASE.multiply(Fn2.fromBytes(nonces.binding)))
  }), "nonceCommitments");
  const adjustPoint = adjustPointHook === void 0 ? (n) => n : adjustPointHook;
  const validateIdentifier = /* @__PURE__ */ __name((n) => {
    if (!Fn2.isValid(n) || Fn2.is0(n))
      throw new Error("Invalid identifier " + n);
    return n;
  }, "validateIdentifier");
  const serializeIdentifier = /* @__PURE__ */ __name((id) => bytesToHex2(Fn2.toBytes(validateIdentifier(id))), "serializeIdentifier");
  const parseIdentifier = /* @__PURE__ */ __name((id, title = "identifier") => {
    astring(id, title);
    const n = validateIdentifier(Fn2.fromBytes(hexToBytes2(id)));
    if (serializeIdentifier(n) !== id)
      throw new Error("expected canonical identifier hex");
    return n;
  }, "parseIdentifier");
  const copyRound1Package = /* @__PURE__ */ __name((p) => ({
    identifier: serializeIdentifier(parseIdentifier(p.identifier)),
    commitment: p.commitment.map((c) => copyBytes2(c)),
    proofOfKnowledge: copyBytes2(p.proofOfKnowledge)
  }), "copyRound1Package");
  const canonicalRound1Packages = /* @__PURE__ */ __name((packages) => {
    const snapshot = packages.map(copyRound1Package);
    snapshot.sort((a, b) => {
      const ai = parseIdentifier(a.identifier);
      const bi = parseIdentifier(b.identifier);
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    });
    return snapshot;
  }, "canonicalRound1Packages");
  const equalRound1Transcripts = /* @__PURE__ */ __name((a, b) => {
    if (a.length !== b.length)
      return false;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const q = b[i];
      if (p.identifier !== q.identifier || p.commitment.length !== q.commitment.length)
        return false;
      for (let j = 0; j < p.commitment.length; j++) {
        if (!equalBytes2(p.commitment[j], q.commitment[j]))
          return false;
      }
      if (!equalBytes2(p.proofOfKnowledge, q.proofOfKnowledge))
        return false;
    }
    return true;
  }, "equalRound1Transcripts");
  const Signature = {
    // RFC 9591 Appendix A encodes signatures canonically as
    // SerializeElement(R) || SerializeScalar(z).
    encode: /* @__PURE__ */ __name((R, z) => {
      let res = concatBytes3(serializePoint(R), Fn2.toBytes(z));
      if (adjustTx)
        res = adjustTx.encode(res);
      return res;
    }, "encode"),
    decode: /* @__PURE__ */ __name((sig) => {
      if (adjustTx)
        sig = adjustTx.decode(sig);
      const Rbytes = sig.subarray(0, -Fn2.BYTES);
      const R = parsePoint(Rbytes);
      if (serializePoint(R).length !== Rbytes.length)
        throw new Error("invalid signature encoding");
      const z = Fn2.fromBytes(sig.subarray(-Fn2.BYTES));
      return { R, z };
    }, "decode")
  };
  const genPointScalarPair = /* @__PURE__ */ __name((rng = randomBytes3) => {
    let n = randomScalar(rng);
    if (adjustScalar)
      n = adjustScalar(n);
    let p = Point.BASE.multiply(n);
    return { scalar: n, point: p };
  }, "genPointScalarPair");
  const nrErr = "roots are unavailable in FROST polynomial mode";
  const noRoots = {
    info: { G: Fn2.ZERO, oddFactor: Fn2.ZERO, powerOfTwo: 0 },
    roots() {
      throw new Error(nrErr);
    },
    brp() {
      throw new Error(nrErr);
    },
    inverse() {
      throw new Error(nrErr);
    },
    omega() {
      throw new Error(nrErr);
    },
    clear() {
    }
  };
  const Poly = poly(Fn2, noRoots);
  const msm = /* @__PURE__ */ __name((points, scalars) => mulAddUnsafe(Point, points, scalars), "msm");
  const polynomialEvaluate = /* @__PURE__ */ __name((x, coeffs) => {
    if (!coeffs.length)
      throw new Error("empty coefficients");
    return Poly.monomial.eval(coeffs, x);
  }, "polynomialEvaluate");
  const deriveInterpolatingValue = /* @__PURE__ */ __name((L, xi) => {
    const err = "invalid parameters";
    if (!L.some((x) => Fn2.eql(x, xi)))
      throw new Error(err);
    const Lset = new Set(L);
    if (Lset.size !== L.length)
      throw new Error(err);
    if (!Lset.has(xi))
      throw new Error(err);
    let num = Fn2.ONE;
    let den = Fn2.ONE;
    for (const x of L) {
      if (Fn2.eql(x, xi))
        continue;
      num = Fn2.mul(num, x);
      den = Fn2.mul(den, Fn2.sub(x, xi));
    }
    return Fn2.div(num, den);
  }, "deriveInterpolatingValue");
  const evalutateVSS = /* @__PURE__ */ __name((identifier, commitment) => {
    const monomial = Poly.monomial.basis(identifier, commitment.length);
    return msm(commitment, monomial);
  }, "evalutateVSS");
  const generateSecretPolynomial = /* @__PURE__ */ __name((signers, secret, coeffs, rng = randomBytes3) => {
    validateSigners(signers);
    if (secret !== void 0)
      abytes3(secret, Fn2.BYTES, "secret");
    if (coeffs !== void 0)
      aarray(coeffs, "coeffs");
    if (typeof rng !== "function")
      throw new TypeError('"rng" expected function, got type=' + typeof rng);
    const secretScalar = secret === void 0 ? randomScalar(rng) : Fn2.fromBytes(secret);
    if (!coeffs) {
      coeffs = [];
      for (let i = 0; i < signers.min - 1; i++)
        coeffs.push(randomScalar(rng));
    }
    if (coeffs.length !== signers.min - 1)
      throw new Error("wrong coefficients length");
    const coefficients = [secretScalar, ...coeffs];
    const commitment = coefficients.map((i) => Point.BASE.multiply(i));
    return { coefficients, commitment, secret: secretScalar };
  }, "generateSecretPolynomial");
  const ProofOfKnowledge = {
    challenge: /* @__PURE__ */ __name((id, verKey, R) => HDKG(concatBytes3(Fn2.toBytes(id), serializePoint(verKey), serializePoint(R))), "challenge"),
    compute(id, coefficents, commitments, rng = randomBytes3) {
      if (coefficents.length < 1)
        throw new Error("coefficients should have at least one element");
      const { point: R, scalar: k } = genPointScalarPair(rng);
      const verKey = commitments[0];
      const c = this.challenge(id, verKey, R);
      const mu = Fn2.add(k, Fn2.mul(coefficents[0], c));
      return Signature.encode(R, mu);
    },
    validate(id, commitment, proof) {
      if (commitment.length < 1)
        throw new Error("commitment should have at least one element");
      const { R, z } = Signature.decode(proof);
      const phi = parsePoint(commitment[0]);
      const c = this.challenge(id, phi, R);
      if (!R.equals(Point.BASE.multiplyUnsafe(z).subtract(phi.multiplyUnsafe(c))))
        throw new Error("invalid proof of knowledge");
    }
  };
  const Basic = {
    challenge: /* @__PURE__ */ __name((R, PK, msg) => {
      if (challenge)
        return challenge(R, PK, msg);
      return H2(concatBytes3(serializePoint(R), serializePoint(PK), msg));
    }, "challenge"),
    sign(msg, sk, rng = randomBytes3) {
      const { point: R, scalar: r } = genPointScalarPair(rng);
      const PK = Point.BASE.multiply(sk);
      const c = this.challenge(R, PK, msg);
      const z = Fn2.add(r, Fn2.mul(c, sk));
      return [R, z];
    },
    verify(msg, R, z, PK) {
      if (adjustPointHook)
        PK = adjustPointHook(PK);
      if (adjustPointHook)
        R = adjustPointHook(R);
      const c = this.challenge(R, PK, msg);
      const zB = Point.BASE.multiplyUnsafe(z);
      const cA = PK.multiplyUnsafe(c);
      let check = zB.subtract(cA).subtract(R);
      if (check.clearCofactor)
        check = check.clearCofactor();
      return Point.ZERO.equals(check);
    }
  };
  const validateSecretShare = /* @__PURE__ */ __name((identifier, commitment, signingShare) => {
    if (!Point.BASE.multiply(signingShare).equals(evalutateVSS(identifier, commitment)))
      throw new Error("invalid secret share");
  }, "validateSecretShare");
  const Identifier = {
    fromNumber(n) {
      if (!Number.isSafeInteger(n))
        throw new Error("expected safe interger");
      return serializeIdentifier(BigInt(n));
    },
    // Not in spec, but in FROST implementation,
    // seems useful and nice, no need to sync identifiers (would require more interactions)
    derive(s) {
      astring(s, "s");
      return serializeIdentifier(HID(utf8ToBytes(s)));
    }
  };
  const generateNonce = /* @__PURE__ */ __name((secret, rng = randomBytes3) => H3(concatBytes3(rng(32), Fn2.toBytes(secret))), "generateNonce");
  const getGroupCommitment = /* @__PURE__ */ __name((GPK, commitmentList, msg) => {
    const CL = commitmentList.map((i) => [
      i.identifier,
      parseIdentifier(i.identifier),
      parsePoint(i.hiding),
      parsePoint(i.binding)
    ]);
    CL.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
    const Cbytes = [];
    for (const [_, id, hC, bC] of CL)
      Cbytes.push(Fn2.toBytes(id), serializePoint(hC), serializePoint(bC));
    const encodedCommitmentHash = H5(concatBytes3(...Cbytes));
    const rhoPrefix = concatBytes3(serializePoint(GPK), H4(msg), encodedCommitmentHash);
    const bindingFactors = {};
    for (const [i, id] of CL) {
      bindingFactors[i] = H1(concatBytes3(rhoPrefix, Fn2.toBytes(id)));
    }
    let hidingSum = Point.ZERO;
    const points = [];
    const scalars = [];
    for (const [i, _, hC, bC] of CL) {
      if (Point.ZERO.equals(hC) || Point.ZERO.equals(bC))
        throw new Error("infinity commitment");
      hidingSum = hidingSum.add(hC);
      points.push(bC);
      scalars.push(bindingFactors[i]);
    }
    const groupCommitment = hidingSum.add(msm(points, scalars));
    const identifiers = CL.map((i) => i[1]);
    return { identifiers, groupCommitment, bindingFactors };
  }, "getGroupCommitment");
  const prepareShare = /* @__PURE__ */ __name((PK, commitmentList, msg, identifier) => {
    const GPK = adjustPoint(parsePoint(PK));
    const id = parseIdentifier(identifier);
    const { identifiers, groupCommitment, bindingFactors } = getGroupCommitment(GPK, commitmentList, msg);
    const bindingFactor = bindingFactors[identifier];
    const lambda = deriveInterpolatingValue(identifiers, id);
    const challenge2 = Basic.challenge(groupCommitment, GPK, msg);
    return { lambda, challenge: challenge2, bindingFactor, groupCommitment };
  }, "prepareShare");
  Object.freeze(Identifier);
  const frost = {
    Identifier,
    // DKG is Distributed Key Generation, not Trusted Dealer Key Generation.
    DKG: Object.freeze({
      // NOTE: we allow to pass secret scalar from user side,
      // this way it can be derived, instead of random generation
      round1: /* @__PURE__ */ __name((id, signers, secret, rng = randomBytes3) => {
        const idNum = parseIdentifier(id, "id");
        validateSigners(signers);
        const { coefficients, commitment } = generateSecretPolynomial(signers, secret, void 0, rng);
        const proofOfKnowledge = ProofOfKnowledge.compute(idNum, coefficients, commitment, rng);
        const commitmentBytes = commitment.map(serializePoint);
        const round1Public = {
          identifier: serializeIdentifier(idNum),
          commitment: commitmentBytes,
          proofOfKnowledge
        };
        const round1Secret = {
          identifier: idNum,
          coefficients,
          commitment: commitment.map(serializePoint),
          // Copy threshold metadata instead of retaining the caller-owned object by reference.
          signers: { min: signers.min, max: signers.max },
          step: 1
        };
        return { public: round1Public, secret: round1Secret };
      }, "round1"),
      round2: /* @__PURE__ */ __name((secret, others) => {
        validateObject(secret, { identifier: "bigint", commitment: "object", signers: "object" }, { coefficients: "object", round1Cache: "object", round2Cache: "object", step: "number" }, "secret");
        validateSigners(secret.signers, "secret.signers");
        aarray(others, "others");
        if (others.length !== secret.signers.max - 1)
          throw new Error("wrong number of round1 packages");
        if (!secret.coefficients || secret.step === 3)
          throw new Error("round3 package used in round2");
        const authenticatedRound1 = canonicalRound1Packages(others);
        if (secret.round2Cache !== void 0) {
          if (secret.round1Cache === void 0 || !equalRound1Transcripts(secret.round1Cache, authenticatedRound1))
            throw new Error("round1 packages do not match authenticated transcript");
          return secret.round2Cache;
        }
        const res = {};
        for (const p of authenticatedRound1) {
          if (p.commitment.length !== secret.signers.min)
            throw new Error("wrong number of commitments");
          const id = parseIdentifier(p.identifier);
          if (id === secret.identifier)
            throw new Error("duplicate id=" + serializeIdentifier(id));
          ProofOfKnowledge.validate(id, p.commitment, p.proofOfKnowledge);
          for (const c of p.commitment)
            parsePoint(c);
          if (res[p.identifier])
            throw new Error("Duplicate id=" + id);
          const signingShare = Fn2.toBytes(polynomialEvaluate(id, secret.coefficients));
          res[p.identifier] = {
            identifier: serializeIdentifier(secret.identifier),
            signingShare
          };
        }
        secret.round1Cache = authenticatedRound1;
        secret.round2Cache = res;
        secret.step = 2;
        return res;
      }, "round2"),
      round3: /* @__PURE__ */ __name((secret, round1, round2) => {
        validateObject(secret, { identifier: "bigint", commitment: "object", signers: "object" }, { coefficients: "object", round1Cache: "object", round2Cache: "object", step: "number" }, "secret");
        validateSigners(secret.signers, "secret.signers");
        aarray(round1, "round1");
        aarray(round2, "round2");
        if (round1.length !== secret.signers.max - 1)
          throw new Error("wrong length of round1 packages");
        if (!secret.coefficients || secret.step !== 2 || !secret.round1Cache)
          throw new Error("round2 package used in round3");
        const suppliedRound1 = canonicalRound1Packages(round1);
        const authenticatedRound1 = secret.round1Cache;
        if (!equalRound1Transcripts(authenticatedRound1, suppliedRound1))
          throw new Error("round1 packages do not match authenticated transcript");
        if (round2.length !== authenticatedRound1.length)
          throw new Error("wrong length of round2 packages");
        const merged = {};
        for (const r1 of authenticatedRound1) {
          if (!r1.identifier || !r1.commitment)
            throw new Error("wrong round1 share");
          merged[r1.identifier] = { ...r1 };
        }
        for (const r2 of round2) {
          if (!r2.identifier || !r2.signingShare)
            throw new Error("wrong round2 share");
          if (!merged[r2.identifier])
            throw new Error("round1 share for " + r2.identifier + " is missing");
          merged[r2.identifier].signingShare = r2.signingShare;
        }
        if (Object.keys(merged).length !== authenticatedRound1.length)
          throw new Error("mismatch identifiers between rounds");
        let signingShare = Fn2.ZERO;
        if (secret.commitment.length !== secret.signers.min)
          throw new Error("wrong commitments length");
        const localCommitment = secret.commitment.map(parsePoint);
        const localShare = polynomialEvaluate(secret.identifier, secret.coefficients);
        validateSecretShare(secret.identifier, localCommitment, localShare);
        const localCommitmentBytes = localCommitment.map(serializePoint);
        const commitments = {
          [serializeIdentifier(secret.identifier)]: localCommitmentBytes
        };
        for (const k in merged) {
          const v = merged[k];
          if (!v.signingShare || !v.commitment)
            throw new Error("mismatch identifiers");
          const id = parseIdentifier(k);
          const signingSharePart = Fn2.fromBytes(v.signingShare);
          const commitment = v.commitment.map(parsePoint);
          validateSecretShare(secret.identifier, commitment, signingSharePart);
          signingShare = Fn2.add(signingShare, signingSharePart);
          const idSer = serializeIdentifier(id);
          if (commitments[idSer])
            throw new Error("duplicated id=" + idSer);
          commitments[idSer] = v.commitment;
        }
        signingShare = Fn2.add(signingShare, localShare);
        const mergedCommitment = new Array(secret.signers.min).fill(Point.ZERO);
        for (const k in commitments) {
          const v = commitments[k];
          if (v.length !== secret.signers.min)
            throw new Error("wrong commitments length");
          for (let i = 0; i < v.length; i++)
            mergedCommitment[i] = mergedCommitment[i].add(parsePoint(v[i]));
        }
        const mergedCommitmentBytes = mergedCommitment.map(serializePoint);
        const verifyingShares = {};
        for (const k in commitments)
          verifyingShares[k] = serializePoint(evalutateVSS(parseIdentifier(k), mergedCommitment));
        let res = {
          public: {
            signers: { min: secret.signers.min, max: secret.signers.max },
            commitments: mergedCommitmentBytes,
            verifyingShares: Object.fromEntries(Object.entries(verifyingShares).map(([k, v]) => [k, v.slice()]))
          },
          secret: {
            identifier: serializeIdentifier(secret.identifier),
            signingShare: Fn2.toBytes(signingShare)
          }
        };
        if (adjustDKG)
          res = adjustDKG(res);
        for (let i = 0; i < secret.coefficients.length; i++)
          secret.coefficients[i] -= secret.coefficients[i];
        delete secret.coefficients;
        delete secret.round1Cache;
        delete secret.round2Cache;
        secret.step = 3;
        return res;
      }, "round3"),
      clean(secret) {
        validateObject(secret, { identifier: "bigint", commitment: "object", signers: "object" }, { coefficients: "object", round1Cache: "object", round2Cache: "object", step: "number" }, "secret");
        secret.identifier -= secret.identifier;
        if (secret.coefficients) {
          for (let i = 0; i < secret.coefficients.length; i++)
            secret.coefficients[i] -= secret.coefficients[i];
        }
        delete secret.round1Cache;
        delete secret.round2Cache;
        secret.step = 3;
      }
    }),
    // Trusted dealer setup
    // Generates keys for all participants
    trustedDealer(signers, identifiers, secret, rng = randomBytes3) {
      validateSigners(signers);
      if (identifiers === void 0) {
        identifiers = [];
        for (let i = 1; i <= signers.max; i++)
          identifiers.push(Identifier.fromNumber(i));
      } else {
        aarray(identifiers, "identifiers");
        if (identifiers.length !== signers.max)
          throw new Error("identifiers should be array of " + signers.max);
      }
      const identifierNums = {};
      for (const id of identifiers) {
        const idNum = parseIdentifier(id);
        if (id in identifierNums)
          throw new Error("duplicated id=" + id);
        identifierNums[id] = idNum;
      }
      const sp = generateSecretPolynomial(signers, secret, void 0, rng);
      const commitmentBytes = sp.commitment.map(serializePoint);
      const secretShares = {};
      const verifyingShares = {};
      for (const id of identifiers) {
        const signingShare = polynomialEvaluate(identifierNums[id], sp.coefficients);
        verifyingShares[id] = serializePoint(Point.BASE.multiply(signingShare));
        secretShares[id] = {
          identifier: id,
          signingShare: Fn2.toBytes(signingShare)
        };
      }
      return {
        public: {
          signers: { min: signers.min, max: signers.max },
          commitments: commitmentBytes,
          verifyingShares
        },
        secretShares
      };
    },
    // Validate secret (from trusted dealer or DKG)
    validateSecret(secret, pub) {
      validateObject(secret, { identifier: "string", signingShare: "object" }, {}, "secret");
      abytes3(secret.signingShare, Fn2.BYTES, "secret.signingShare");
      validateObject(pub, {
        signers: "object",
        commitments: "object",
        verifyingShares: "object"
      }, {}, "pub");
      validateSigners(pub.signers, "pub.signers");
      aarray(pub.commitments, "pub.commitments");
      const id = parseIdentifier(secret.identifier);
      const commitment = pub.commitments.map(parsePoint);
      const signingShare = Fn2.fromBytes(secret.signingShare);
      validateSecretShare(id, commitment, signingShare);
    },
    // Actual signing
    // Round 1: each participant commit to nonces
    // Nonces kept private, commitments sent to coordinator (or every other participant)
    // NOTE: we don't need the message at this point, which lets a coordinator
    // keep multiple nonce commitments per participant in advance and skip
    // round1 for signing.
    // But then each participant needs to remember generated shares
    commit(secret, rng = randomBytes3) {
      validateObject(secret, { identifier: "string", signingShare: "object" }, {}, "secret");
      abytes3(secret.signingShare, Fn2.BYTES, "secret.signingShare");
      if (typeof rng !== "function")
        throw new TypeError('"rng" expected function, got type=' + typeof rng);
      const secretScalar = Fn2.fromBytes(secret.signingShare);
      const hiding = generateNonce(secretScalar, rng);
      const binding = generateNonce(secretScalar, rng);
      const nonces = { hiding: Fn2.toBytes(hiding), binding: Fn2.toBytes(binding) };
      return { nonces, commitments: nonceCommitments(secret.identifier, nonces) };
    },
    // Round2: sign. Each participant creates a signature share from the secret
    // and the selected nonce commitments.
    signShare(secret, pub, nonces, commitmentList, msg) {
      validateObject(secret, { identifier: "string", signingShare: "object" }, {}, "secret");
      abytes3(secret.signingShare, Fn2.BYTES, "secret.signingShare");
      validateObject(pub, {
        signers: "object",
        commitments: "object",
        verifyingShares: "object"
      }, {}, "pub");
      validateSigners(pub.signers, "pub.signers");
      aarray(pub.commitments, "pub.commitments");
      validateObject(nonces, { hiding: "object", binding: "object" }, {}, "nonces");
      abytes3(nonces.hiding, Fn2.BYTES, "nonces.hiding");
      abytes3(nonces.binding, Fn2.BYTES, "nonces.binding");
      aarray(commitmentList, "commitmentList");
      abytes3(msg, void 0, "msg");
      validateCommitmentsNum(pub.signers, commitmentList.length);
      const hidingNonce0 = Fn2.fromBytes(nonces.hiding);
      const bindingNonce0 = Fn2.fromBytes(nonces.binding);
      if (Fn2.is0(hidingNonce0) || Fn2.is0(bindingNonce0))
        throw new Error("signing nonces already used");
      const expectedCommitment = {
        identifier: secret.identifier,
        hiding: serializePoint(Point.BASE.multiply(hidingNonce0)),
        binding: serializePoint(Point.BASE.multiply(bindingNonce0))
      };
      const commitment = commitmentList.find((i) => i.identifier === secret.identifier);
      if (!commitment)
        throw new Error("missing signer commitment");
      if (bytesToHex2(commitment.hiding) !== bytesToHex2(expectedCommitment.hiding) || bytesToHex2(commitment.binding) !== bytesToHex2(expectedCommitment.binding))
        throw new Error("incorrect signer commitment");
      if (adjustSecret)
        secret = adjustSecret(secret, pub);
      if (adjustPublic)
        pub = adjustPublic(pub);
      const SK = Fn2.fromBytes(secret.signingShare);
      const { lambda, challenge: challenge2, bindingFactor, groupCommitment } = prepareShare(pub.commitments[0], commitmentList, msg, secret.identifier);
      const N = adjustNonces ? adjustNonces(groupCommitment, nonces) : nonces;
      const hidingNonce = adjustNonces ? Fn2.fromBytes(N.hiding) : hidingNonce0;
      const bindingNonce = adjustNonces ? Fn2.fromBytes(N.binding) : bindingNonce0;
      const t = Fn2.mul(Fn2.mul(lambda, SK), challenge2);
      const t2 = Fn2.mul(bindingNonce, bindingFactor);
      const r = Fn2.toBytes(Fn2.add(Fn2.add(hidingNonce, t2), t));
      nonces.hiding.fill(0);
      nonces.binding.fill(0);
      return r;
    },
    // Each participant (or coordinator) can verify signatures from other participants
    verifyShare(pub, commitmentList, msg, identifier, sigShare) {
      validateObject(pub, {
        signers: "object",
        commitments: "object",
        verifyingShares: "object"
      }, {}, "pub");
      validateSigners(pub.signers, "pub.signers");
      aarray(pub.commitments, "pub.commitments");
      aarray(commitmentList, "commitmentList");
      abytes3(msg, void 0, "msg");
      parseIdentifier(identifier);
      abytes3(sigShare, Fn2.BYTES, "sigShare");
      if (adjustPublic)
        pub = adjustPublic(pub);
      const comm = commitmentList.find((i) => i.identifier === identifier);
      if (!comm)
        throw new Error("cannot find identifier commitment");
      const PK = parsePoint(pub.verifyingShares[identifier]);
      const hidingNonceCommitment = parsePoint(comm.hiding);
      const bindingNonceCommitment = parsePoint(comm.binding);
      const { lambda, challenge: challenge2, bindingFactor, groupCommitment } = prepareShare(pub.commitments[0], commitmentList, msg, identifier);
      let commShare = hidingNonceCommitment.add(bindingNonceCommitment.multiplyUnsafe(bindingFactor));
      if (adjustGroupCommitmentShare)
        commShare = adjustGroupCommitmentShare(groupCommitment, commShare);
      const l = Point.BASE.multiplyUnsafe(Fn2.fromBytes(sigShare));
      const r = commShare.add(PK.multiplyUnsafe(Fn2.mul(challenge2, lambda)));
      return l.equals(r);
    },
    // Aggregate multiple signature shares into groupSignature
    aggregate(pub, commitmentList, msg, sigShares) {
      validateObject(pub, {
        signers: "object",
        commitments: "object",
        verifyingShares: "object"
      }, {}, "pub");
      validateSigners(pub.signers, "pub.signers");
      aarray(pub.commitments, "pub.commitments");
      aarray(commitmentList, "commitmentList");
      abytes3(msg, void 0, "msg");
      validateObject(sigShares, {}, {}, "sigShares");
      const rawPub = pub;
      if (adjustPublic)
        pub = adjustPublic(pub);
      try {
        validateCommitmentsNum(pub.signers, commitmentList.length);
      } catch {
        throw new AggErr("aggregation failed", []);
      }
      const ids = commitmentList.map((i) => i.identifier);
      const seen = /* @__PURE__ */ new Set();
      for (const id of ids) {
        if (seen.has(id))
          throw new AggErr("aggregation failed", []);
        seen.add(id);
      }
      if (ids.length !== Object.keys(sigShares).length)
        throw new AggErr("aggregation failed", []);
      for (const id of ids) {
        if (!(id in sigShares) || !(id in pub.verifyingShares))
          throw new AggErr("aggregation failed", []);
      }
      const GPK = parsePoint(pub.commitments[0]);
      const { groupCommitment } = getGroupCommitment(GPK, commitmentList, msg);
      let z = Fn2.ZERO;
      for (const id of ids)
        z = Fn2.add(z, Fn2.fromBytes(sigShares[id]));
      if (!Basic.verify(msg, groupCommitment, z, GPK)) {
        const cheaters = [];
        for (const id of ids) {
          if (!this.verifyShare(rawPub, commitmentList, msg, id, sigShares[id]))
            cheaters.push(id);
        }
        throw new AggErr("aggregation failed", cheaters);
      }
      return Signature.encode(groupCommitment, z);
    },
    // Basic sign/verify using single key
    sign(msg, secretKey) {
      let sk = Fn2.fromBytes(secretKey);
      if (adjustScalar)
        sk = adjustScalar(sk);
      const [R, z] = Basic.sign(msg, sk);
      return Signature.encode(R, z);
    },
    verify(sig, msg, publicKey) {
      const PK = parsePublicKey ? validatePublicPoint(parsePublicKey(publicKey)) : parsePoint(publicKey);
      const { R, z } = Signature.decode(sig);
      return Basic.verify(msg, R, z, PK);
    },
    // Combine multiple secret shares to restore secret
    combineSecret(shares, signers) {
      aarray(shares, "shares");
      validateSigners(signers);
      if (shares.length < signers.min || shares.length > signers.max)
        throw new Error("wrong secret shares array");
      const points = [];
      const seen = {};
      for (const s of shares) {
        const idNum = parseIdentifier(s.identifier);
        const id = serializeIdentifier(idNum);
        if (seen[id])
          throw new Error("duplicated id=" + id);
        seen[id] = true;
        points.push([idNum, Fn2.fromBytes(s.signingShare)]);
      }
      const xCoords = points.map(([x]) => x);
      let res = Fn2.ZERO;
      for (const [x, y] of points)
        res = Fn2.add(res, Fn2.mul(y, deriveInterpolatingValue(xCoords, x)));
      return Fn2.toBytes(res);
    },
    // Utils
    utils: Object.freeze({
      Fn: Fn2,
      // NOTE: we re-export it here because it may be different from Point.Fn (ed448 is fun!)
      // Test RNG overrides still go through noble's non-zero scalar derivation; this is not a raw
      // "bytes become scalar" escape hatch.
      randomScalar: /* @__PURE__ */ __name((rng = randomBytes3) => Fn2.toBytes(genPointScalarPair(rng).scalar), "randomScalar"),
      generateSecretPolynomial: /* @__PURE__ */ __name((signers, secret, coeffs, rng) => {
        const res = generateSecretPolynomial(signers, secret, coeffs, rng);
        return { ...res, commitment: res.commitment.map(serializePoint) };
      }, "generateSecretPolynomial")
    })
  };
  return Object.freeze(frost);
}
var validateSigners, validateCommitmentsNum, AggErr;
var init_frost = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/frost.js"() {
    init_utils();
    init_utils3();
    init_curve();
    init_fft();
    init_modular();
    validateSigners = /* @__PURE__ */ __name((signers, title = "signers") => {
      validateObject(signers, { min: "number", max: "number" }, {}, title);
      asafenumber(signers.min, title + ".min");
      asafenumber(signers.max, title + ".max");
      if (signers.min < 2 || signers.max < 2 || signers.min > signers.max)
        throw new Error("Wrong signers info: min=" + signers.min + " max=" + signers.max);
    }, "validateSigners");
    validateCommitmentsNum = /* @__PURE__ */ __name((signers, len) => {
      if (len < signers.min || len > signers.max)
        throw new Error("Wrong number of commitments=" + len);
    }, "validateCommitmentsNum");
    AggErr = class extends Error {
      static {
        __name(this, "AggErr");
      }
      // Empty means aggregation failed before per-share verification could attribute a signer.
      cheaters;
      constructor(msg, cheaters) {
        super(msg);
        this.cheaters = cheaters;
      }
    };
    __name(createFROST, "createFROST");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/montgomery.js
function cmask(P, swap) {
  return P + swap - (swap >> _1n5 << _1n5);
}
function cswap(P) {
  const offset = BigInt(6) * P;
  return (mask, x_2, x_3) => {
    const sum = x_2 + x_3;
    const d = offset + x_3 - x_2;
    const a = (d * mask + x_2) % P;
    return { x_2: a, x_3: sum - a };
  };
}
function validateOpts(curve) {
  validateObject(curve, {
    P: "bigint",
    type: "string",
    adjustScalarBytes: "function",
    powPminus2: "function"
  }, {
    randomBytes: "function",
    scalarMultBase: "function"
  });
  return Object.freeze({ ...curve });
}
function montgomery(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { P, type, adjustScalarBytes: adjustScalarBytes2, powPminus2, randomBytes: rand } = CURVE;
  const mulBaseHook = CURVE.scalarMultBase;
  const is25519 = type === "x25519";
  if (!is25519 && type !== "x448")
    throw new Error("invalid type");
  const randomBytes_ = rand === void 0 ? randomBytes3 : rand;
  const montgomeryBits = is25519 ? 255 : 448;
  const swap = cswap(P);
  const fieldLen = is25519 ? 32 : 56;
  const Gu = is25519 ? BigInt(9) : BigInt(5);
  const a24 = is25519 ? BigInt(121665) : BigInt(39081);
  const minScalar = is25519 ? _2n3 ** BigInt(254) : _2n3 ** BigInt(447);
  const maxAdded = is25519 ? BigInt(8) * (_2n3 ** BigInt(251) - _1n5) : BigInt(4) * (_2n3 ** BigInt(445) - _1n5);
  const maxScalar = minScalar + maxAdded + _1n5;
  const modP = /* @__PURE__ */ __name((n) => mod(n, P), "modP");
  const GuBytes = encodeU(Gu);
  function encodeU(u) {
    return numberToBytesLE(modP(u), fieldLen);
  }
  __name(encodeU, "encodeU");
  function decodeU(u) {
    const _u = copyBytes2(abytes3(u, fieldLen, "uCoordinate"));
    if (is25519)
      _u[31] &= 127;
    return modP(bytesToNumberLE(_u));
  }
  __name(decodeU, "decodeU");
  function decodeScalar(scalar) {
    return bytesToNumberLE(adjustScalarBytes2(copyBytes2(abytes3(scalar, fieldLen, "scalar"))));
  }
  __name(decodeScalar, "decodeScalar");
  const lowOrderU = new Set(is25519 ? [
    _0n5,
    _1n5,
    P - _1n5,
    BigInt("325606250916557431795983626356110631294008115727848805560023387167927233504"),
    BigInt("39382357235489614581723060781553021112529911719440698176882885853963445705823")
  ] : [_0n5, _1n5, P - _1n5]);
  function scalarMult(scalar, u) {
    const pointU = decodeU(u);
    if (lowOrderU.has(pointU))
      throw new Error("invalid private or public key received");
    const pu = montgomeryLadder(pointU, decodeScalar(scalar));
    if (pu === _0n5)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  __name(scalarMult, "scalarMult");
  function scalarMultBase(scalar) {
    if (mulBaseHook === void 0)
      return scalarMult(scalar, GuBytes);
    const k = decodeScalar(scalar);
    aInRange("scalar", k, minScalar, maxScalar);
    const pu = modP(mulBaseHook(k));
    if (pu === _0n5)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  __name(scalarMultBase, "scalarMultBase");
  const getPublicKey = scalarMultBase;
  const getSharedSecret = scalarMult;
  function montgomeryLadder(u, scalar) {
    aInRange("u", u, _0n5, P);
    aInRange("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = _1n5;
    let z_2 = _0n5;
    let x_3 = u;
    let z_3 = _1n5;
    const kx = k ^ k >> _1n5;
    for (let t = BigInt(montgomeryBits - 1); t >= _0n5; t--) {
      const mask2 = cmask(P, kx >> t);
      ({ x_2, x_3 } = swap(mask2, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = swap(mask2, z_2, z_3));
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B = x_2 - z_2;
      const BB = modP(B * B);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D = x_3 - z_3;
      const DA = modP(D * A);
      const CB = modP(C * B);
      const dacb = DA + CB;
      const da_cb = DA - CB;
      x_3 = modP(dacb * dacb);
      z_3 = modP(x_1 * modP(da_cb * da_cb));
      x_2 = modP(AA * BB);
      z_2 = modP(E * (AA + modP(a24 * E)));
    }
    const mask = cmask(P, k);
    ({ x_2, x_3 } = swap(mask, x_2, x_3));
    ({ x_2: z_2, x_3: z_3 } = swap(mask, z_2, z_3));
    const z2 = powPminus2(z_2);
    return modP(x_2 * z2);
  }
  __name(montgomeryLadder, "montgomeryLadder");
  const lengths = {
    secretKey: fieldLen,
    publicKey: fieldLen,
    seed: fieldLen
  };
  const randomSecretKey = /* @__PURE__ */ __name((seed) => {
    seed = seed === void 0 ? randomBytes_(fieldLen) : seed;
    abytes3(seed, lengths.seed, "seed");
    return seed;
  }, "randomSecretKey");
  const utils = { randomSecretKey };
  Object.freeze(lengths);
  Object.freeze(utils);
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getSharedSecret,
    getPublicKey,
    scalarMult,
    scalarMultBase,
    utils,
    GuBytes: GuBytes.slice(),
    lengths
  });
}
var _0n5, _1n5, _2n3;
var init_montgomery = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/montgomery.js"() {
    init_utils3();
    init_curve();
    init_modular();
    _0n5 = /* @__PURE__ */ BigInt(0);
    _1n5 = /* @__PURE__ */ BigInt(1);
    _2n3 = /* @__PURE__ */ BigInt(2);
    __name(cmask, "cmask");
    __name(cswap, "cswap");
    __name(validateOpts, "validateOpts");
    __name(montgomery, "montgomery");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/oprf.js
function createOPRF(opts) {
  validateObject(opts, {
    name: "string",
    hash: "function",
    hashToScalar: "function",
    hashToGroup: "function"
  });
  validatePointCons(opts.Point);
  const { name, Point, hash, hashToGroup: hashToGroupHook, hashToScalar } = opts;
  const { Fn: Fn2 } = Point;
  const invertSecret = /* @__PURE__ */ __name((value) => invertCt(value, Fn2.ORDER), "invertSecret");
  const hashToGroup = /* @__PURE__ */ __name((msg, ctx) => hashToGroupHook(msg, {
    DST: concatBytes3(asciiToBytes("HashToGroup-"), ctx)
  }), "hashToGroup");
  const hashToScalarPrefixed = /* @__PURE__ */ __name((msg, ctx) => hashToScalar(msg, { DST: concatBytes3(_DST_scalarBytes, ctx) }), "hashToScalarPrefixed");
  const randomScalar = /* @__PURE__ */ __name((rng = randomBytes3) => {
    if (typeof rng !== "function")
      throw new TypeError('"rng" expected function, got type=' + typeof rng);
    const t = mapHashToField(rng(getMinHashLength(Fn2.ORDER)), Fn2.ORDER, Fn2.isLE);
    return Fn2.isLE ? bytesToNumberLE(t) : bytesToNumberBE(t);
  }, "randomScalar");
  const msm = /* @__PURE__ */ __name((points, scalars) => mulAddUnsafe(Point, points, scalars), "msm");
  const getCtx = /* @__PURE__ */ __name((mode) => concatBytes3(asciiToBytes("OPRFV1-"), new Uint8Array([mode]), asciiToBytes("-" + name)), "getCtx");
  const ctxOPRF = getCtx(0);
  const ctxVOPRF = getCtx(1);
  const ctxPOPRF = getCtx(2);
  function encode(...args) {
    const res2 = [];
    for (const a of args) {
      if (typeof a === "number")
        res2.push(numberToBytesBE(a, 2));
      else if (typeof a === "string")
        res2.push(asciiToBytes(a));
      else {
        abytes3(a);
        res2.push(numberToBytesBE(a.length, 2), a);
      }
    }
    return concatBytes3(...res2);
  }
  __name(encode, "encode");
  const inputBytes = /* @__PURE__ */ __name((title, bytes3) => {
    abytes3(bytes3, void 0, title);
    if (bytes3.length > 65535)
      throw new Error(`"${title}" expected Uint8Array of length <= 65535, got length=${bytes3.length}`);
    return bytes3;
  }, "inputBytes");
  const hashInput = /* @__PURE__ */ __name((...bytes3) => hash(encode(...bytes3, "Finalize")), "hashInput");
  function getTranscripts(B, C, D, ctx) {
    const Bm = B.toBytes();
    const seed = hash(encode(Bm, concatBytes3(asciiToBytes("Seed-"), ctx)));
    const res2 = [];
    for (let i = 0; i < C.length; i++) {
      const Ci = C[i].toBytes();
      const Di = D[i].toBytes();
      const di = hashToScalarPrefixed(encode(seed, i, Ci, Di, "Composite"), ctx);
      res2.push(di);
    }
    return res2;
  }
  __name(getTranscripts, "getTranscripts");
  function computeComposites(B, C, D, ctx) {
    const T = getTranscripts(B, C, D, ctx);
    const M = msm(C, T);
    const Z = msm(D, T);
    return { M, Z };
  }
  __name(computeComposites, "computeComposites");
  function computeCompositesFast(k, B, C, D, ctx) {
    const T = getTranscripts(B, C, D, ctx);
    const M = msm(C, T);
    const Z = M.multiply(k);
    return { M, Z };
  }
  __name(computeCompositesFast, "computeCompositesFast");
  function challengeTranscript(B, M, Z, t2, t3, ctx) {
    const [Bm, a0, a1, a2, a3] = [B, M, Z, t2, t3].map((i) => i.toBytes());
    return hashToScalarPrefixed(encode(Bm, a0, a1, a2, a3, "Challenge"), ctx);
  }
  __name(challengeTranscript, "challengeTranscript");
  function generateProof(ctx, k, B, C, D, rng) {
    const { M, Z } = computeCompositesFast(k, B, C, D, ctx);
    const r = randomScalar(rng);
    const t2 = Point.BASE.multiply(r);
    const t3 = M.multiply(r);
    const c = challengeTranscript(B, M, Z, t2, t3, ctx);
    const s = Fn2.sub(r, Fn2.mul(c, k));
    return concatBytes3(...[c, s].map((i) => Fn2.toBytes(i)));
  }
  __name(generateProof, "generateProof");
  function verifyProof(ctx, B, C, D, proof) {
    abytes3(proof, 2 * Fn2.BYTES);
    const { M, Z } = computeComposites(B, C, D, ctx);
    const [c, s] = [proof.subarray(0, Fn2.BYTES), proof.subarray(Fn2.BYTES)].map((f) => Fn2.fromBytes(f));
    const t2 = msm([Point.BASE, B], [s, c]);
    const t3 = msm([M, Z], [s, c]);
    const expectedC = challengeTranscript(B, M, Z, t2, t3, ctx);
    if (!Fn2.eql(c, expectedC))
      throw new Error("proof verification failed");
  }
  __name(verifyProof, "verifyProof");
  function generateKeyPair() {
    const skS = randomScalar();
    const pkS = Point.BASE.multiply(skS);
    return { secretKey: Fn2.toBytes(skS), publicKey: pkS.toBytes() };
  }
  __name(generateKeyPair, "generateKeyPair");
  function deriveKeyPair(ctx, seed, info) {
    abytes3(seed, 32, "seed");
    info = inputBytes("keyInfo", info);
    const dst = concatBytes3(asciiToBytes("DeriveKeyPair"), ctx);
    const msg = concatBytes3(seed, encode(info), Uint8Array.of(0));
    for (let counter = 0; counter <= 255; counter++) {
      msg[msg.length - 1] = counter;
      const skS = hashToScalar(msg, { DST: dst });
      if (Fn2.is0(skS))
        continue;
      return {
        secretKey: Fn2.toBytes(skS),
        publicKey: Point.BASE.multiply(skS).toBytes()
      };
    }
    throw new Error("Cannot derive key");
  }
  __name(deriveKeyPair, "deriveKeyPair");
  const wirePoint = /* @__PURE__ */ __name((label, bytes3) => {
    const point = Point.fromBytes(bytes3);
    if (point.equals(Point.ZERO))
      throw new Error(label + " point at infinity");
    return point;
  }, "wirePoint");
  function blind(ctx, input, rng = randomBytes3) {
    input = inputBytes("input", input);
    const blind2 = randomScalar(rng);
    const inputPoint = hashToGroup(input, ctx);
    if (inputPoint.equals(Point.ZERO))
      throw new Error("Input point at infinity");
    const blinded = inputPoint.multiply(blind2);
    return { blind: Fn2.toBytes(blind2), blinded: blinded.toBytes() };
  }
  __name(blind, "blind");
  function evaluate(ctx, secretKey, input) {
    input = inputBytes("input", input);
    const skS = Fn2.fromBytes(secretKey);
    const inputPoint = hashToGroup(input, ctx);
    if (inputPoint.equals(Point.ZERO))
      throw new Error("Input point at infinity");
    const unblinded = inputPoint.multiply(skS).toBytes();
    return hashInput(input, unblinded);
  }
  __name(evaluate, "evaluate");
  const oprf = Object.freeze({
    generateKeyPair,
    deriveKeyPair: /* @__PURE__ */ __name((seed, keyInfo) => deriveKeyPair(ctxOPRF, seed, keyInfo), "deriveKeyPair"),
    blind: /* @__PURE__ */ __name((input, rng = randomBytes3) => blind(ctxOPRF, input, rng), "blind"),
    blindEvaluate(secretKey, blindedPoint) {
      const skS = Fn2.fromBytes(secretKey);
      const elm = wirePoint("blinded", blindedPoint);
      return elm.multiply(skS).toBytes();
    },
    finalize(input, blindBytes, evaluatedBytes) {
      input = inputBytes("input", input);
      const blind2 = Fn2.fromBytes(blindBytes);
      const evalPoint = wirePoint("evaluated", evaluatedBytes);
      const unblinded = evalPoint.multiply(Fn2.inv(blind2)).toBytes();
      return hashInput(input, unblinded);
    },
    evaluate: /* @__PURE__ */ __name((secretKey, input) => evaluate(ctxOPRF, secretKey, input), "evaluate")
  });
  const voprf = Object.freeze({
    generateKeyPair,
    deriveKeyPair: /* @__PURE__ */ __name((seed, keyInfo) => deriveKeyPair(ctxVOPRF, seed, keyInfo), "deriveKeyPair"),
    blind: /* @__PURE__ */ __name((input, rng = randomBytes3) => blind(ctxVOPRF, input, rng), "blind"),
    blindEvaluateBatch(secretKey, publicKey, blinded, rng = randomBytes3) {
      if (!Array.isArray(blinded))
        throw new Error("expected array");
      const skS = Fn2.fromBytes(secretKey);
      const pkS = wirePoint("public key", publicKey);
      const blindedPoints = blinded.map((i) => wirePoint("blinded", i));
      const evaluated = blindedPoints.map((i) => i.multiply(skS));
      const proof = generateProof(ctxVOPRF, skS, pkS, blindedPoints, evaluated, rng);
      return { evaluated: evaluated.map((i) => i.toBytes()), proof };
    },
    blindEvaluate(secretKey, publicKey, blinded, rng = randomBytes3) {
      const res2 = this.blindEvaluateBatch(secretKey, publicKey, [blinded], rng);
      return { evaluated: res2.evaluated[0], proof: res2.proof };
    },
    finalizeBatch(items, publicKey, proof) {
      if (!Array.isArray(items))
        throw new Error("expected array");
      const pkS = wirePoint("public key", publicKey);
      const blindedPoints = items.map((i) => wirePoint("blinded", i.blinded));
      const evalPoints = items.map((i) => wirePoint("evaluated", i.evaluated));
      verifyProof(ctxVOPRF, pkS, blindedPoints, evalPoints, proof);
      return items.map((i, j) => {
        const input = inputBytes("input", i.input);
        const blind2 = Fn2.fromBytes(i.blind);
        const unblinded = evalPoints[j].multiply(Fn2.inv(blind2)).toBytes();
        return hashInput(input, unblinded);
      });
    },
    finalize(input, blind2, evaluated, blinded, publicKey, proof) {
      return this.finalizeBatch([{ input, blind: blind2, evaluated, blinded }], publicKey, proof)[0];
    },
    evaluate: /* @__PURE__ */ __name((secretKey, input) => evaluate(ctxVOPRF, secretKey, input), "evaluate")
  });
  const poprf = /* @__PURE__ */ __name((info) => {
    info = copyBytes2(inputBytes("info", info));
    const m = hashToScalarPrefixed(encode("Info", info), ctxPOPRF);
    const T = Point.BASE.multiply(m);
    return Object.freeze({
      generateKeyPair,
      deriveKeyPair: /* @__PURE__ */ __name((seed, keyInfo) => deriveKeyPair(ctxPOPRF, seed, keyInfo), "deriveKeyPair"),
      blind(input, publicKey, rng = randomBytes3) {
        input = inputBytes("input", input);
        const pkS = wirePoint("public key", publicKey);
        const tweakedKey = T.add(pkS);
        if (tweakedKey.equals(Point.ZERO))
          throw new Error("tweakedKey point at infinity");
        const blind2 = randomScalar(rng);
        const inputPoint = hashToGroup(input, ctxPOPRF);
        if (inputPoint.equals(Point.ZERO))
          throw new Error("Input point at infinity");
        const blindedPoint = inputPoint.multiply(blind2);
        return {
          blind: Fn2.toBytes(blind2),
          blinded: blindedPoint.toBytes(),
          tweakedKey: tweakedKey.toBytes()
        };
      },
      blindEvaluateBatch(secretKey, blinded, rng = randomBytes3) {
        if (!Array.isArray(blinded))
          throw new Error("expected array");
        const skS = Fn2.fromBytes(secretKey);
        const t = Fn2.add(skS, m);
        const invT = invertSecret(t);
        const blindedPoints = blinded.map((i) => wirePoint("blinded", i));
        const evalPoints = blindedPoints.map((i) => i.multiply(invT));
        const tweakedKey = Point.BASE.multiply(t);
        const proof = generateProof(ctxPOPRF, t, tweakedKey, evalPoints, blindedPoints, rng);
        return { evaluated: evalPoints.map((i) => i.toBytes()), proof };
      },
      blindEvaluate(secretKey, blinded, rng = randomBytes3) {
        const res2 = this.blindEvaluateBatch(secretKey, [blinded], rng);
        return { evaluated: res2.evaluated[0], proof: res2.proof };
      },
      finalizeBatch(items, proof, tweakedKey) {
        if (!Array.isArray(items))
          throw new Error("expected array");
        const inputs = items.map((i) => inputBytes("input", i.input));
        const evalPoints = items.map((i) => wirePoint("evaluated", i.evaluated));
        verifyProof(ctxPOPRF, wirePoint("tweakedKey", tweakedKey), evalPoints, items.map((i) => wirePoint("blinded", i.blinded)), proof);
        return items.map((i, j) => {
          const blind2 = Fn2.fromBytes(i.blind);
          const point = evalPoints[j].multiply(Fn2.inv(blind2)).toBytes();
          return hashInput(inputs[j], info, point);
        });
      },
      finalize(input, blind2, evaluated, blinded, proof, tweakedKey) {
        return this.finalizeBatch([{ input, blind: blind2, evaluated, blinded }], proof, tweakedKey)[0];
      },
      evaluate(secretKey, input) {
        input = inputBytes("input", input);
        const skS = Fn2.fromBytes(secretKey);
        const inputPoint = hashToGroup(input, ctxPOPRF);
        if (inputPoint.equals(Point.ZERO))
          throw new Error("Input point at infinity");
        const t = Fn2.add(skS, m);
        const invT = invertSecret(t);
        const unblinded = inputPoint.multiply(invT).toBytes();
        return hashInput(input, info, unblinded);
      }
    });
  }, "poprf");
  const res = { name, oprf, voprf, poprf, __tests: Object.freeze({ Fn: Fn2, invertSecret }) };
  return Object.freeze(res);
}
var _DST_scalarBytes;
var init_oprf = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/oprf.js"() {
    init_utils3();
    init_curve();
    init_hash_to_curve();
    init_modular();
    _DST_scalarBytes = /* @__PURE__ */ asciiToBytes(_DST_scalar);
    __name(createOPRF, "createOPRF");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/ed25519.js
var ed25519_exports = {};
__export(ed25519_exports, {
  ED25519_TORSION_SUBGROUP: () => ED25519_TORSION_SUBGROUP,
  _map_to_curve_elligator2_curve25519: () => _map_to_curve_elligator2_curve25519,
  ed25519: () => ed25519,
  ed25519_FROST: () => ed25519_FROST,
  ed25519_hasher: () => ed25519_hasher,
  ed25519ctx: () => ed25519ctx,
  ed25519ph: () => ed25519ph,
  ristretto255: () => ristretto255,
  ristretto255_FROST: () => ristretto255_FROST,
  ristretto255_hasher: () => ristretto255_hasher,
  ristretto255_oprf: () => ristretto255_oprf,
  x25519: () => x25519
});
function ed25519_pow_2_252_3(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, _2n4, P) * b2 % P;
  const b5 = pow2(b4, _1n6, P) * x % P;
  const b10 = pow2(b5, _5n2, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n4, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes(bytes3) {
  bytes3[0] &= 248;
  bytes3[31] &= 127;
  bytes3[31] |= 64;
  return bytes3;
}
function uvRatio(u, v) {
  const P = ed25519_CURVE_p;
  const v3 = mod(v * v * v, P);
  const v7 = mod(v3 * v3 * v, P);
  const pow3 = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
  let x = mod(u * v3 * pow3, P);
  const vx2 = mod(v * x * x, P);
  const root1 = x;
  const root2 = mod(x * ED25519_SQRT_M1, P);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === mod(-u, P);
  const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if (isNegativeLE(x, P))
    x = mod(-x, P);
  return { isValid: useRoot1 || useRoot2, value: x };
}
function toMontgomery(point) {
  const { y } = point;
  return Fp.toBytes(Fp.div(_1n6 + y, _1n6 - y));
}
function toMontgomerySecret(secretKey) {
  const size = ed25519_Point.Fp.BYTES;
  abytes(secretKey, size);
  return adjustScalarBytes(sha512(secretKey.subarray(0, size))).subarray(0, size);
}
function ed25519_domain(data, ctx, phflag) {
  if (ctx.length > 255)
    throw new Error("Context is too big");
  return concatBytes(asciiToBytes("SigEd25519 no Ed25519 collisions"), new Uint8Array([phflag ? 1 : 0, ctx.length]), ctx, data);
}
function ed(opts) {
  return eddsa(ed25519_Point, sha512, Object.assign({ adjustScalarBytes, toMontgomery, toMontgomerySecret, zip215: true }, opts));
}
function _map_to_curve_elligator2_curve25519(u) {
  let tv1 = Fp.sqr(u);
  tv1 = Fp.mul(tv1, _2n4);
  let xd = Fp.add(tv1, Fp.ONE);
  let x1n = Fp.neg(ELL2_J);
  let tv2 = Fp.sqr(xd);
  let gxd = Fp.mul(tv2, xd);
  let gx1 = Fp.mul(tv1, ELL2_J);
  gx1 = Fp.mul(gx1, x1n);
  gx1 = Fp.add(gx1, tv2);
  gx1 = Fp.mul(gx1, x1n);
  let tv3 = Fp.sqr(gxd);
  tv2 = Fp.sqr(tv3);
  tv3 = Fp.mul(tv3, gxd);
  tv3 = Fp.mul(tv3, gx1);
  tv2 = Fp.mul(tv2, tv3);
  let y11 = ed25519_pow_2_252_3(tv2).pow_p_5_8;
  y11 = Fp.mul(y11, tv3);
  let y12 = Fp.mul(y11, ELL2_C3);
  tv2 = Fp.sqr(y11);
  tv2 = Fp.mul(tv2, gxd);
  let e1 = Fp.eql(tv2, gx1);
  let y1 = Fp.cmov(y12, y11, e1);
  let x2n = Fp.mul(x1n, tv1);
  let y21 = Fp.mul(y11, u);
  y21 = Fp.mul(y21, ELL2_C2);
  let y22 = Fp.mul(y21, ELL2_C3);
  let gx2 = Fp.mul(gx1, tv1);
  tv2 = Fp.sqr(y21);
  tv2 = Fp.mul(tv2, gxd);
  let e2 = Fp.eql(tv2, gx2);
  let y2 = Fp.cmov(y22, y21, e2);
  tv2 = Fp.sqr(y1);
  tv2 = Fp.mul(tv2, gxd);
  let e3 = Fp.eql(tv2, gx1);
  let xn = Fp.cmov(x2n, x1n, e3);
  let y = Fp.cmov(y2, y1, e3);
  let e4 = Fp.isOdd(y);
  y = Fp.cmov(y, Fp.neg(y), e3 !== e4);
  return { xMn: xn, xMd: xd, yMn: y, yMd: _1n6 };
}
function map_to_curve_elligator2_edwards25519(u) {
  const { xMn, xMd, yMn, yMd } = _map_to_curve_elligator2_curve25519(u);
  let xn = Fp.mul(xMn, yMd);
  xn = Fp.mul(xn, ELL2_C1_EDWARDS);
  let xd = Fp.mul(xMd, yMn);
  let yn = Fp.sub(xMn, xMd);
  let yd = Fp.add(xMn, xMd);
  let tv1 = Fp.mul(xd, yd);
  let e = Fp.eql(tv1, Fp.ZERO);
  xn = Fp.cmov(xn, Fp.ZERO, e);
  xd = Fp.cmov(xd, Fp.ONE, e);
  yn = Fp.cmov(yn, Fp.ONE, e);
  yd = Fp.cmov(yd, Fp.ONE, e);
  const [xd_inv, yd_inv] = FpInvertBatch(Fp, [xd, yd], true);
  return { x: Fp.mul(xn, xd_inv), y: Fp.mul(yn, yd_inv) };
}
function calcElligatorRistrettoMap(r0) {
  const { d } = ed25519_CURVE;
  const r = Fp.mul(Fp.mulN(SQRT_M1, r0), r0);
  const Ns = Fp.mul(Fp.addN(r, _1n6), ONE_MINUS_D_SQ);
  let c = BigInt(-1);
  const D = Fp.mul(Fp.subN(c, Fp.mulN(d, r)), Fp.add(r, d));
  let { isValid: Ns_D_is_sq, value: s } = uvRatio(Ns, D);
  let s_ = Fp.mul(s, r0);
  if (!Fp.isOdd(s_))
    s_ = Fp.neg(s_);
  if (!Ns_D_is_sq)
    s = s_;
  if (!Ns_D_is_sq)
    c = r;
  const Nt = Fp.sub(Fp.mulN(Fp.mulN(c, Fp.subN(r, _1n6)), D_MINUS_ONE_SQ), D);
  const s2 = Fp.sqrN(s);
  const W0 = Fp.mul(Fp.addN(s, s), D);
  const W1 = Fp.mul(Nt, SQRT_AD_MINUS_ONE);
  const W2 = Fp.sub(_1n6, s2);
  const W3 = Fp.add(_1n6, s2);
  return new ed25519_Point(Fp.mul(W0, W3), Fp.mul(W2, W1), Fp.mul(W1, W3), Fp.mul(W0, W2));
}
var _0n6, _1n6, _2n4, _3n2, _5n2, _8n3, ed25519_CURVE_p, ed25519_CURVE, ED25519_SQRT_M1, ed25519_Point, Fp, Fn, ed25519, ed25519ctx, ed25519ph, ed25519_FROST, x25519, ELL2_C1, ELL2_C2, ELL2_C3, ELL2_J, ELL2_C1_EDWARDS, ed25519_hasher, SQRT_M1, SQRT_AD_MINUS_ONE, INVSQRT_A_MINUS_D, ONE_MINUS_D_SQ, D_MINUS_ONE_SQ, invertSqrt, MAX_255B, bytes255ToNumberLE, _RistrettoPoint, ristretto255, ristretto255_hasher, ristretto255_oprf, ristretto255_FROST, ED25519_TORSION_SUBGROUP;
var init_ed25519 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/ed25519.js"() {
    init_sha2();
    init_utils();
    init_edwards();
    init_frost();
    init_hash_to_curve();
    init_modular();
    init_montgomery();
    init_oprf();
    init_utils3();
    _0n6 = /* @__PURE__ */ BigInt(0);
    _1n6 = /* @__PURE__ */ BigInt(1);
    _2n4 = /* @__PURE__ */ BigInt(2);
    _3n2 = /* @__PURE__ */ BigInt(3);
    _5n2 = /* @__PURE__ */ BigInt(5);
    _8n3 = /* @__PURE__ */ BigInt(8);
    ed25519_CURVE_p = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
    ed25519_CURVE = /* @__PURE__ */ (() => ({
      p: ed25519_CURVE_p,
      n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
      h: _8n3,
      a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
      d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
      Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
      Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
    }))();
    __name(ed25519_pow_2_252_3, "ed25519_pow_2_252_3");
    __name(adjustScalarBytes, "adjustScalarBytes");
    ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
    __name(uvRatio, "uvRatio");
    ed25519_Point = /* @__PURE__ */ edwards(ed25519_CURVE, { uvRatio });
    Fp = /* @__PURE__ */ (() => ed25519_Point.Fp)();
    __name(toMontgomery, "toMontgomery");
    __name(toMontgomerySecret, "toMontgomerySecret");
    Fn = /* @__PURE__ */ (() => ed25519_Point.Fn)();
    __name(ed25519_domain, "ed25519_domain");
    __name(ed, "ed");
    ed25519 = /* @__PURE__ */ ed({});
    ed25519ctx = /* @__PURE__ */ ed({ domain: ed25519_domain });
    ed25519ph = /* @__PURE__ */ ed({ domain: ed25519_domain, prehash: sha512 });
    ed25519_FROST = /* @__PURE__ */ (() => createFROST({
      name: "FROST-ED25519-SHA512-v1",
      Point: ed25519_Point,
      validatePoint: /* @__PURE__ */ __name((p) => {
        p.assertValidity();
        if (!p.isTorsionFree())
          throw new Error("bad point: not torsion-free");
      }, "validatePoint"),
      hash: sha512,
      // RFC 9591 keeps H2 undecorated here for RFC 8032 compatibility. In createFROST(),
      // `H2: ''` becomes an empty DST prefix; the built-in hashToScalar fallback treats
      // that the same as omitted DST, even though custom hooks can still observe the empty bag.
      H2: ""
    }))();
    x25519 = /* @__PURE__ */ (() => {
      const P = ed25519_CURVE_p;
      const powPminus2 = /* @__PURE__ */ __name((x) => {
        const { pow_p_5_8, b2 } = ed25519_pow_2_252_3(x);
        return mod(pow2(pow_p_5_8, _3n2, P) * b2, P);
      }, "powPminus2");
      return montgomery({
        P,
        type: "x25519",
        powPminus2,
        adjustScalarBytes,
        // ~3x faster fixed-base: [k]B on the birationally-equivalent Edwards curve using cached
        // base tables, mapped back via u = (1+y)/(1-y) = (Z+Y)/(Z-Y) with one Fermat inversion.
        // Same construction as libsodium's crypto_scalarmult_curve25519_base.
        scalarMultBase: /* @__PURE__ */ __name((k) => {
          const kn = mod(k, ed25519_Point.Fn.ORDER);
          if (kn === _0n6)
            return _0n6;
          const p = ed25519_Point.BASE.multiply(kn);
          return mod((p.Z + p.Y) * powPminus2(mod(p.Z - p.Y, P)), P);
        }, "scalarMultBase")
      });
    })();
    ELL2_C1 = /* @__PURE__ */ (() => (ed25519_CURVE_p + _3n2) / _8n3)();
    ELL2_C2 = /* @__PURE__ */ (() => Fp.pow(_2n4, ELL2_C1))();
    ELL2_C3 = /* @__PURE__ */ (() => Fp.sqrt(Fp.neg(Fp.ONE)))();
    ELL2_J = /* @__PURE__ */ BigInt(486662);
    __name(_map_to_curve_elligator2_curve25519, "_map_to_curve_elligator2_curve25519");
    ELL2_C1_EDWARDS = /* @__PURE__ */ (() => FpSqrtEven(Fp, Fp.neg(BigInt(486664))))();
    __name(map_to_curve_elligator2_edwards25519, "map_to_curve_elligator2_edwards25519");
    ed25519_hasher = /* @__PURE__ */ (() => createHasher2(ed25519_Point, (scalars) => map_to_curve_elligator2_edwards25519(scalars[0]), {
      DST: "edwards25519_XMD:SHA-512_ELL2_RO_",
      encodeDST: "edwards25519_XMD:SHA-512_ELL2_NU_",
      p: ed25519_CURVE_p,
      m: 1,
      k: 128,
      expand: "xmd",
      hash: sha512
    }))();
    SQRT_M1 = ED25519_SQRT_M1;
    SQRT_AD_MINUS_ONE = /* @__PURE__ */ BigInt("25063068953384623474111414158702152701244531502492656460079210482610430750235");
    INVSQRT_A_MINUS_D = /* @__PURE__ */ BigInt("54469307008909316920995813868745141605393597292927456921205312896311721017578");
    ONE_MINUS_D_SQ = /* @__PURE__ */ BigInt("1159843021668779879193775521855586647937357759715417654439879720876111806838");
    D_MINUS_ONE_SQ = /* @__PURE__ */ BigInt("40440834346308536858101042469323190826248399146238708352240133220865137265952");
    invertSqrt = /* @__PURE__ */ __name((number) => uvRatio(_1n6, number), "invertSqrt");
    MAX_255B = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    bytes255ToNumberLE = /* @__PURE__ */ __name((bytes3) => Fp.create(bytesToNumberLE(bytes3) & MAX_255B), "bytes255ToNumberLE");
    __name(calcElligatorRistrettoMap, "calcElligatorRistrettoMap");
    _RistrettoPoint = class __RistrettoPoint extends PrimeEdwardsPoint {
      static {
        __name(this, "_RistrettoPoint");
      }
      // Do NOT change syntax: the following gymnastics is done,
      // because typescript strips comments, which makes bundlers disable tree-shaking.
      // prettier-ignore
      static BASE = /* @__PURE__ */ (() => new __RistrettoPoint(ed25519_Point.BASE))();
      // prettier-ignore
      static ZERO = /* @__PURE__ */ (() => new __RistrettoPoint(ed25519_Point.ZERO))();
      // prettier-ignore
      static Fp = /* @__PURE__ */ (() => Fp)();
      // prettier-ignore
      static Fn = /* @__PURE__ */ (() => Fn)();
      constructor(ep) {
        super(ep);
      }
      /**
       * Create one Ristretto255 point from affine Edwards coordinates.
       * This wraps the internal Edwards representative directly and is not a
       * canonical ristretto255 decoding path.
       * Use `toBytes()` / `fromBytes()` if canonical ristretto255 bytes matter.
       */
      static fromAffine(ap) {
        return new __RistrettoPoint(ed25519_Point.fromAffine(ap));
      }
      assertSame(other) {
        if (!(other instanceof __RistrettoPoint))
          throw new Error("RistrettoPoint expected");
      }
      init(ep) {
        return new __RistrettoPoint(ep);
      }
      static fromBytes(bytes3) {
        abytes(bytes3, 32);
        const { a, d } = ed25519_CURVE;
        const s = bytes255ToNumberLE(bytes3);
        if (!equalBytes2(Fp.toBytes(s), bytes3) || Fp.isOdd(s))
          throw new Error("invalid ristretto255 encoding 1");
        const s2 = Fp.sqr(s);
        const u1 = Fp.add(_1n6, Fp.mulN(a, s2));
        const u2 = Fp.sub(_1n6, Fp.mulN(a, s2));
        const u1_2 = Fp.sqr(u1);
        const u2_2 = Fp.sqr(u2);
        const v = Fp.sub(Fp.mulN(Fp.mulN(a, d), u1_2), u2_2);
        const { isValid, value: I } = invertSqrt(Fp.mul(v, u2_2));
        const Dx = Fp.mul(I, u2);
        const Dy = Fp.mul(Fp.mulN(I, Dx), v);
        let x = Fp.mul(Fp.addN(s, s), Dx);
        if (Fp.isOdd(x))
          x = Fp.neg(x);
        const y = Fp.mul(u1, Dy);
        const t = Fp.mul(x, y);
        if (!isValid || Fp.isOdd(t) || Fp.is0(y))
          throw new Error("invalid ristretto255 encoding 2");
        return new __RistrettoPoint(new ed25519_Point(x, y, Fp.ONE, t));
      }
      /**
       * Converts ristretto-encoded string to ristretto point.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-decode).
       * @param hex - Ristretto-encoded 32 bytes. Not every 32-byte string is valid ristretto encoding
       */
      static fromHex(hex2) {
        return __RistrettoPoint.fromBytes(hexToBytes(hex2));
      }
      /**
       * Encodes ristretto point to Uint8Array.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-encode).
       */
      toBytes() {
        let { X, Y, Z, T } = this.ep;
        const u1 = Fp.mul(Fp.add(Z, Y), Fp.sub(Z, Y));
        const u2 = Fp.mul(X, Y);
        const u2sq = Fp.sqr(u2);
        const { value: invsqrt } = invertSqrt(Fp.mul(u1, u2sq));
        const D1 = Fp.mul(invsqrt, u1);
        const D2 = Fp.mul(invsqrt, u2);
        const zInv = Fp.mul(Fp.mulN(D1, D2), T);
        let D;
        if (Fp.isOdd(Fp.mul(T, zInv))) {
          let _x = Fp.mul(Y, SQRT_M1);
          let _y = Fp.mul(X, SQRT_M1);
          X = _x;
          Y = _y;
          D = Fp.mul(D1, INVSQRT_A_MINUS_D);
        } else {
          D = D2;
        }
        if (Fp.isOdd(Fp.mul(X, zInv)))
          Y = Fp.neg(Y);
        let s = Fp.mul(Fp.subN(Z, Y), D);
        if (Fp.isOdd(s))
          s = Fp.neg(s);
        return Fp.toBytes(s);
      }
      /**
       * Compares two Ristretto points.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-equals).
       */
      equals(other) {
        this.assertSame(other);
        const { X: X1, Y: Y1 } = this.ep;
        const { X: X2, Y: Y2 } = other.ep;
        const one = Fp.eql(Fp.mul(X1, Y2), Fp.mul(Y1, X2));
        const two = Fp.eql(Fp.mul(Y1, Y2), Fp.mul(X1, X2));
        return one || two;
      }
      is0() {
        return this.equals(__RistrettoPoint.ZERO);
      }
    };
    ristretto255 = /* @__PURE__ */ (() => {
      Object.freeze(_RistrettoPoint.BASE);
      Object.freeze(_RistrettoPoint.ZERO);
      Object.freeze(_RistrettoPoint.prototype);
      Object.freeze(_RistrettoPoint);
      return Object.freeze({ Point: _RistrettoPoint });
    })();
    ristretto255_hasher = /* @__PURE__ */ Object.freeze({
      Point: _RistrettoPoint,
      /**
      * Spec: https://www.rfc-editor.org/rfc/rfc9380.html#name-hashing-to-ristretto255. Caveats:
      * * There are no test vectors
      * * encodeToCurve / mapToCurve is undefined
      * * mapToCurve would be `calcElligatorRistrettoMap(scalars[0])`, not ristretto255_map!
      * * hashToScalar is undefined too, so we just use OPRF implementation
      * * We cannot re-use 'createHasher', because ristretto255_map is different algorithm/RFC
        (os2ip -> bytes255ToNumberLE)
      * * mapToCurve == calcElligatorRistrettoMap, hashToCurve == ristretto255_map
      * * hashToScalar is undefined in RFC9380 for ristretto, so we use the OPRF
        version here. Using `bytes255ToNumblerLE` will create a different result
        if we use `bytes255ToNumberLE` as os2ip
      * * current version is closest to spec.
      */
      hashToCurve(msg, options) {
        const DST = options?.DST === void 0 ? "ristretto255_XMD:SHA-512_R255MAP_RO_" : options.DST;
        const xmd = expand_message_xmd(msg, DST, 64, sha512);
        return ristretto255_hasher.deriveToCurve(xmd);
      },
      hashToScalar(msg, options) {
        const DST = options?.DST === void 0 ? _DST_scalar : options.DST;
        const xmd = expand_message_xmd(msg, DST, 64, sha512);
        return Fn.create(bytesToNumberLE(xmd));
      },
      /**
       * HashToCurve-like construction based on RFC 9496 (Element Derivation).
       * Converts 64 uniform random bytes into a curve point.
       *
       * WARNING: This represents an older hash-to-curve construction from before
       * RFC 9380 was finalized.
       * It was later reused as a component in the newer
       * `hash_to_ristretto255` function defined in RFC 9380.
       */
      deriveToCurve(bytes3) {
        abytes(bytes3, 64);
        const r1 = bytes255ToNumberLE(bytes3.subarray(0, 32));
        const R1 = calcElligatorRistrettoMap(r1);
        const r2 = bytes255ToNumberLE(bytes3.subarray(32, 64));
        const R2 = calcElligatorRistrettoMap(r2);
        return new _RistrettoPoint(R1.add(R2));
      }
    });
    ristretto255_oprf = /* @__PURE__ */ (() => createOPRF({
      name: "ristretto255-SHA512",
      Point: _RistrettoPoint,
      hash: sha512,
      hashToGroup: ristretto255_hasher.hashToCurve,
      hashToScalar: ristretto255_hasher.hashToScalar
    }))();
    ristretto255_FROST = /* @__PURE__ */ (() => createFROST({
      name: "FROST-RISTRETTO255-SHA512-v1",
      Point: _RistrettoPoint,
      validatePoint: /* @__PURE__ */ __name((p) => {
        p.assertValidity();
      }, "validatePoint"),
      hash: sha512
    }))();
    ED25519_TORSION_SUBGROUP = /* @__PURE__ */ Object.freeze([
      "0100000000000000000000000000000000000000000000000000000000000000",
      "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
      "0000000000000000000000000000000000000000000000000000000000000080",
      "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05",
      "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
      "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85",
      "0000000000000000000000000000000000000000000000000000000000000000",
      "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa"
    ]);
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/curves/ed25519.js
var require_ed25519 = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/curves/ed25519.js"(exports, module) {
    module.exports = (init_ed25519(), __toCommonJS(ed25519_exports));
  }
});

// node_modules/node-onlykey-lib/bucket/src/bucket-identity.js
var require_bucket_identity = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/bucket-identity.js"(exports, module) {
    "use strict";
    var { sha256: sha2562 } = require_sha2();
    var { hkdf: hkdf2 } = require_hkdf();
    var { ed25519: ed255192 } = require_ed25519();
    var { toHex } = require_bytes();
    var IDENTITY_LABEL = "";
    var AGENT = { version: 1 };
    var ED25519 = 1;
    var utf8 = /* @__PURE__ */ __name((s) => new TextEncoder().encode(s), "utf8");
    var concat = /* @__PURE__ */ __name((...parts) => {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    }, "concat");
    var H = /* @__PURE__ */ __name((domain, ...parts) => sha2562(concat(utf8(domain), ...parts.map((p) => Uint8Array.from(p)))), "H");
    var labelHash = /* @__PURE__ */ __name((label) => sha2562(utf8(label)), "labelHash");
    var isBucketIdentityId = /* @__PURE__ */ __name((s) => typeof s === "string" && /^[0-9a-f]{32}$/.test(s), "isBucketIdentityId");
    function identityIdOf(identityPublicKey) {
      return toHex(H("OKBUCKET-ID-v1", identityPublicKey)).slice(0, 32);
    }
    __name(identityIdOf, "identityIdOf");
    async function readIdentity(okcrypto, opts = {}) {
      const publicKey = Uint8Array.from(await okcrypto.agent.publicKey(labelHash(IDENTITY_LABEL), { ...opts, ...AGENT, keyType: ED25519 }));
      return { publicKey, id: identityIdOf(publicKey) };
    }
    __name(readIdentity, "readIdentity");
    var BUCKET_KEY_VERSION = 2;
    var bucketKeyLabel = /* @__PURE__ */ __name((identityPublicKey) => `okedge/bucket-key/v2/${identityIdOf(identityPublicKey)}`, "bucketKeyLabel");
    async function deriveBucketKeyAt(okcrypto, identityPublicKey, site, opts = {}) {
      if (typeof site !== "string" || !site) {
        throw Object.assign(new Error("bucket key: this key names no site (ctap_bridge) - its bucket key is bound to that site, and there is no other"), { code: "NO_KEY_SITE" });
      }
      const secret = Uint8Array.from(await okcrypto.deriveSecret(bucketKeyLabel(identityPublicKey), { ...opts, rpId: site }));
      try {
        const secretKey = hkdf2(sha2562, secret, utf8("OKBUCKET-KEY-v2"), Uint8Array.from(identityPublicKey), 32);
        return { secretKey, publicKey: ed255192.getPublicKey(secretKey), version: BUCKET_KEY_VERSION };
      } finally {
        secret.fill(0);
      }
    }
    __name(deriveBucketKeyAt, "deriveBucketKeyAt");
    var certDigest = /* @__PURE__ */ __name((identityPublicKey, bucketPublicKey) => H("OKBUCKET-CERT-v1", identityPublicKey, bucketPublicKey), "certDigest");
    async function certify(okcrypto, identityPublicKey, bucketPublicKey, opts = {}) {
      const sig = await okcrypto.agent.sign(labelHash(IDENTITY_LABEL), certDigest(identityPublicKey, bucketPublicKey), { ...opts, ...AGENT, keyType: ED25519 });
      return Uint8Array.from(sig).slice(0, 64);
    }
    __name(certify, "certify");
    function verifyCertificate({ identityPublicKey, bucketPublicKey, certificate }) {
      try {
        return ed255192.verify(Uint8Array.from(certificate), certDigest(identityPublicKey, bucketPublicKey), Uint8Array.from(identityPublicKey));
      } catch {
        return false;
      }
    }
    __name(verifyCertificate, "verifyCertificate");
    var PURPOSES = /* @__PURE__ */ new Set(["proof", "give", "accept", "revoke", "join"]);
    var purposeDigest = /* @__PURE__ */ __name((purpose, bytes3) => {
      if (!PURPOSES.has(purpose)) throw new Error(`the bucket key signs ${[...PURPOSES].join(", ")} - not ${purpose}`);
      return H(`OKBUCKET-${purpose.toUpperCase()}-v1`, bytes3);
    }, "purposeDigest");
    function sign(bucketKey, purpose, bytes3) {
      return ed255192.sign(purposeDigest(purpose, Uint8Array.from(bytes3)), bucketKey.secretKey);
    }
    __name(sign, "sign");
    function verify({ identityPublicKey, bucketPublicKey, certificate, purpose, bytes: bytes3, signature }) {
      try {
        return verifyCertificate({ identityPublicKey, bucketPublicKey, certificate }) && ed255192.verify(Uint8Array.from(signature), purposeDigest(purpose, Uint8Array.from(bytes3)), Uint8Array.from(bucketPublicKey));
      } catch {
        return false;
      }
    }
    __name(verify, "verify");
    module.exports = { IDENTITY_LABEL, isBucketIdentityId, identityIdOf, readIdentity, deriveBucketKeyAt, BUCKET_KEY_VERSION, bucketKeyLabel, certify, verifyCertificate, sign, verify };
  }
});

// node_modules/node-onlykey-lib/bucket/src/trade.js
var require_trade = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/trade.js"(exports, module) {
    "use strict";
    var rep = require_replicate();
    var bid = require_bucket_identity();
    var { toHex, fromHex } = require_bytes();
    var TYPES = { HELLO: "okbucket.hello", PROVE: "okbucket.prove", HAVE: "okbucket.have", GIVE: "okbucket.give" };
    var NONCE = 32;
    var ROUNDS = 3;
    var REFUSED = { ok: false, refusal: "no" };
    var enc = /* @__PURE__ */ __name((b) => toHex(b), "enc");
    var dec = /* @__PURE__ */ __name((h) => fromHex(String(h)), "dec");
    var proofBytes = /* @__PURE__ */ __name((nonce, side, identity) => new Uint8Array([...nonce, ...new TextEncoder().encode(`|${side}|${identity}`)]), "proofBytes");
    function prove(me, nonce, side) {
      return {
        identityPublicKey: enc(me.identityPublicKey),
        bucketPublicKey: enc(me.bucketKey.publicKey),
        certificate: enc(me.certificate),
        signature: enc(bid.sign(me.bucketKey, "proof", proofBytes(nonce, side, me.id)))
      };
    }
    __name(prove, "prove");
    function checks(proof, nonce, side, id) {
      try {
        const identityPublicKey = dec(proof.identityPublicKey);
        if (bid.identityIdOf(identityPublicKey) !== id) return false;
        return bid.verify({
          identityPublicKey,
          bucketPublicKey: dec(proof.bucketPublicKey),
          certificate: dec(proof.certificate),
          purpose: "proof",
          bytes: proofBytes(nonce, side, id),
          signature: dec(proof.signature)
        });
      } catch {
        return false;
      }
    }
    __name(checks, "checks");
    function computerSide({ bucket, me, randomBytes: randomBytes4, rules = {} }) {
      const nonce = randomBytes4(NONCE);
      let mine = null;
      let peerProven = false;
      let rounds = 0;
      const haveMessage = /* @__PURE__ */ __name(() => {
        rounds += 1;
        mine = rep.summarize(bucket, { rules });
        return { type: TYPES.HAVE, v: 1, identity: me.id, have: mine };
      }, "haveMessage");
      return {
        hello: /* @__PURE__ */ __name(() => ({ type: TYPES.HELLO, v: 1, nonce: enc(nonce), identity: me.id }), "hello"),
        /* the peer's answer to hello: its proof over our nonce - only then do we prove ourselves and show our state */
        prove(answer) {
          if (!answer || !answer.ok || !answer.proof || !checks(answer.proof, nonce, "peer", me.id)) return null;
          peerProven = true;
          return { type: TYPES.PROVE, v: 1, identity: me.id, proof: prove(me, dec(answer.nonce), "computer"), state: rep.stateOf(bucket, { rules }) };
        },
        /* the peer's state: the same as ours - in sync, nothing to send; different - our HAVE */
        compare(answer) {
          if (!peerProven || !answer || !answer.ok || !answer.state) return null;
          if (answer.state.hash === rep.stateOf(bucket, { rules }).hash) return { same: true };
          return { same: false, differs: rep.differs(rep.stateOf(bucket, { rules }), answer.state), message: haveMessage() };
        },
        /* the peer's HAVE and GIVE: take its GIVE, then give what it lacks */
        give(answer) {
          if (!peerProven || !mine || !answer || !answer.ok || !answer.have || !answer.give) return null;
          const theirs = answer.have;
          const out = rep.give(bucket, mine, theirs, { rules });
          const taken = rep.take(bucket, answer.give, { rules });
          return { message: { type: TYPES.GIVE, v: 1, identity: me.id, give: out }, taken: taken.taken, mine, theirs };
        },
        /*
         * the peer's taken and its state after: the same as ours now - complete; else another HAVE, while rounds are left;
         * else not settled, and which stores still differ
         */
        settle(answer) {
          if (!answer || !answer.ok || !answer.state) return null;
          const now = rep.stateOf(bucket, { rules });
          const taken = answer.taken || {};
          if (answer.state.hash === now.hash) return { same: true, taken };
          const differs = rep.differs(now, answer.state);
          return rounds < ROUNDS ? { same: false, taken, differs, message: haveMessage() } : { same: false, taken, differs };
        }
      };
    }
    __name(computerSide, "computerSide");
    function peerSide({ bucket, me, randomBytes: randomBytes4, rules = {}, seen = /* @__PURE__ */ new Set() }) {
      const trades = /* @__PURE__ */ new Map();
      return (message, from) => {
        if (!message || !Object.values(TYPES).includes(message.type)) return null;
        const b = bucket();
        const m = me();
        if (!b || !m || message.identity !== m.id) {
          trades.delete(from);
          return REFUSED;
        }
        if (message.type === TYPES.HELLO) {
          const theirNonce = String(message.nonce || "");
          if (theirNonce.length !== NONCE * 2 || seen.has(theirNonce)) return REFUSED;
          seen.add(theirNonce);
          const nonce = randomBytes4(NONCE);
          trades.set(from, { nonce, proven: false, rounds: 0, mine: null });
          return { ok: true, nonce: enc(nonce), proof: prove(m, dec(theirNonce), "peer") };
        }
        const t = trades.get(from);
        if (message.type === TYPES.PROVE) {
          if (!t || t.proven || !message.proof || !checks(message.proof, t.nonce, "computer", m.id) || !message.state) {
            trades.delete(from);
            return REFUSED;
          }
          t.proven = true;
          return { ok: true, state: rep.stateOf(b, { rules }) };
        }
        if (message.type === TYPES.HAVE) {
          if (!t || !t.proven || !message.have || t.rounds >= ROUNDS) {
            trades.delete(from);
            return REFUSED;
          }
          t.rounds += 1;
          t.mine = rep.summarize(b, { rules });
          return { ok: true, have: t.mine, give: rep.give(b, t.mine, message.have, { rules }) };
        }
        if (!t || !t.proven || !t.mine || !message.give) {
          trades.delete(from);
          return REFUSED;
        }
        t.mine = null;
        const r = rep.take(b, message.give, { rules });
        return { ok: true, taken: r.taken, state: rep.stateOf(b, { rules }) };
      };
    }
    __name(peerSide, "peerSide");
    module.exports = { TYPES, computerSide, peerSide, prove, checks };
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/_arx.js
function rotl(a, b) {
  return a << b | a >>> 32 - b;
}
function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
  const len = data.length;
  const block = new Uint8Array(BLOCK_LEN);
  const b32 = u32(block);
  const isAligned = isLE && isAligned32(data) && isAligned32(output);
  const d32 = isAligned ? u32(data) : U32_EMPTY;
  const o32 = isAligned ? u32(output) : U32_EMPTY;
  if (!isLE) {
    for (let pos = 0; pos < len; counter++) {
      core(sigma, key, nonce, b32, counter, rounds);
      swap32IfBE(b32);
      if (counter >= MAX_COUNTER)
        throw new Error("arx: counter overflow");
      const take = Math.min(BLOCK_LEN, len - pos);
      for (let j = 0, posj; j < take; j++) {
        posj = pos + j;
        output[posj] = data[posj] ^ block[j];
      }
      pos += take;
    }
    return;
  }
  for (let pos = 0; pos < len; counter++) {
    core(sigma, key, nonce, b32, counter, rounds);
    if (counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const take = Math.min(BLOCK_LEN, len - pos);
    if (isAligned && take === BLOCK_LEN) {
      const pos32 = pos / 4;
      if (pos % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let j = 0, posj; j < BLOCK_LEN32; j++) {
        posj = pos32 + j;
        o32[posj] = d32[posj] ^ b32[j];
      }
      pos += BLOCK_LEN;
      continue;
    }
    for (let j = 0, posj; j < take; j++) {
      posj = pos + j;
      output[posj] = data[posj] ^ block[j];
    }
    pos += take;
  }
}
function createCipher(core, opts) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts2({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  anumber2(counterLength);
  anumber2(rounds);
  abool(counterRight);
  abool(allowShortKeys);
  return (key, nonce, data, output, counter = 0) => {
    abytes2(key, void 0, "key");
    abytes2(nonce, void 0, "nonce");
    abytes2(data, void 0, "data");
    const len = data.length;
    const hasOutput = output !== void 0;
    output = getOutput(len, output, false);
    if (hasOutput)
      complexOverlapBytes(data, output);
    anumber2(counter);
    if (counter < 0 || counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const toClean = [];
    let l = key.length;
    let k;
    let sigma;
    if (l === 32) {
      toClean.push(k = copyBytes(key));
      sigma = sigma32_32;
    } else if (l === 16 && allowShortKeys) {
      k = new Uint8Array(32);
      k.set(key);
      k.set(key, 16);
      sigma = sigma16_32;
      toClean.push(k);
    } else {
      abytes2(key, 32, "arx key");
      throw new Error("invalid key size");
    }
    if (!isLE || !isAligned32(nonce))
      toClean.push(nonce = copyBytes(nonce));
    let k32 = u32(k);
    if (extendNonceFn) {
      if (nonce.length !== 24)
        throw new Error("arx: extended nonce must be 24 bytes");
      const n16 = nonce.subarray(0, 16);
      if (isLE)
        extendNonceFn(sigma, k32, u32(n16), k32);
      else {
        const sigmaRaw = swap32IfBE(Uint32Array.from(sigma));
        extendNonceFn(sigmaRaw, k32, u32(n16), k32);
        clean2(sigmaRaw);
        swap32IfBE(k32);
      }
      nonce = nonce.subarray(16);
    } else if (!isLE)
      swap32IfBE(k32);
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length)
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    if (nonceNcLen !== 12) {
      const nc = new Uint8Array(12);
      nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc;
      toClean.push(nonce);
    }
    const n32 = swap32IfBE(u32(nonce));
    try {
      runCipher(core, sigma, k32, n32, data, output, counter, rounds);
      return output;
    } finally {
      clean2(...toClean);
    }
  };
}
var encodeStr, sigma16_32, sigma32_32, BLOCK_LEN, BLOCK_LEN32, MAX_COUNTER, U32_EMPTY, _XorStreamPRG, createPRG;
var init_arx = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/_arx.js"() {
    init_utils2();
    encodeStr = /* @__PURE__ */ __name((str) => Uint8Array.from(str.split(""), (c) => c.charCodeAt(0)), "encodeStr");
    sigma16_32 = /* @__PURE__ */ (() => swap32IfBE(u32(encodeStr("expand 16-byte k"))))();
    sigma32_32 = /* @__PURE__ */ (() => swap32IfBE(u32(encodeStr("expand 32-byte k"))))();
    __name(rotl, "rotl");
    BLOCK_LEN = 64;
    BLOCK_LEN32 = 16;
    MAX_COUNTER = /* @__PURE__ */ (() => 2 ** 32 - 1)();
    U32_EMPTY = /* @__PURE__ */ Uint32Array.of();
    __name(runCipher, "runCipher");
    __name(createCipher, "createCipher");
    _XorStreamPRG = class __XorStreamPRG {
      static {
        __name(this, "_XorStreamPRG");
      }
      blockLen;
      keyLen;
      nonceLen;
      state;
      buf;
      key;
      nonce;
      pos;
      ctr;
      cipher;
      destroyed = false;
      constructor(cipher, blockLen, keyLen, nonceLen, seed) {
        this.cipher = cipher;
        this.blockLen = blockLen;
        this.keyLen = keyLen;
        this.nonceLen = nonceLen;
        this.state = new Uint8Array(this.keyLen + this.nonceLen);
        this.reseed(seed);
        this.ctr = 0;
        this.pos = this.blockLen;
        this.buf = new Uint8Array(this.blockLen);
        this.key = this.state.subarray(0, this.keyLen);
        this.nonce = this.state.subarray(this.keyLen);
      }
      reseed(seed) {
        abytes2(seed, void 0, "seed");
        if (!seed || seed.length === 0)
          throw new Error("entropy required");
        for (let i = 0; i < seed.length; i++)
          this.state[i % this.state.length] ^= seed[i];
        this.ctr = 0;
        this.pos = this.blockLen;
      }
      addEntropy(seed) {
        if (this.destroyed)
          throw new Error("cannot use destroyed PRG");
        abytes2(seed, void 0, "seed");
        if (seed.length === 0)
          throw new Error("entropy required");
        this.state.set(this.randomBytes(this.state.length));
        this.reseed(seed);
      }
      randomBytes(len) {
        if (this.destroyed)
          throw new Error("cannot use destroyed PRG");
        anumber2(len);
        if (len === 0)
          return new Uint8Array(0);
        const avail = this.pos < this.blockLen ? this.blockLen - this.pos : 0;
        const blocks = Math.ceil(Math.max(0, len - avail) / this.blockLen);
        if (blocks > 0 && this.ctr > MAX_COUNTER - blocks)
          throw new Error("arx: counter overflow");
        const out = new Uint8Array(len);
        let outPos = 0;
        if (this.pos < this.blockLen) {
          const take = Math.min(len, this.blockLen - this.pos);
          out.set(this.buf.subarray(this.pos, this.pos + take), 0);
          this.pos += take;
          outPos += take;
          if (outPos === len)
            return out;
        }
        const full = Math.floor((len - outPos) / this.blockLen);
        if (full > 0) {
          const blockBytes = full * this.blockLen;
          const b = out.subarray(outPos, outPos + blockBytes);
          this.cipher(this.key, this.nonce, b, b, this.ctr);
          this.ctr += full;
          outPos += blockBytes;
        }
        const left = len - outPos;
        if (left > 0) {
          this.buf.fill(0);
          this.cipher(this.key, this.nonce, this.buf, this.buf, this.ctr++);
          out.set(this.buf.subarray(0, left), outPos);
          this.pos = left;
        }
        return out;
      }
      // Clone seeds the new instance from this stream, so the source PRG advances too.
      clone() {
        if (this.destroyed)
          throw new Error("cannot use destroyed PRG");
        return new __XorStreamPRG(this.cipher, this.blockLen, this.keyLen, this.nonceLen, this.randomBytes(this.state.length));
      }
      // Zeroes the current state, leftover buffer, and marks the instance destroyed.
      // The instance fails closed: any later randomBytes()/addEntropy()/clone() throws instead
      // of silently continuing from zero key||nonce state (which would yield predictable output).
      clean() {
        this.pos = 0;
        this.ctr = 0;
        this.buf.fill(0);
        this.state.fill(0);
        this.destroyed = true;
      }
    };
    createPRG = /* @__PURE__ */ __name((cipher, blockLen, keyLen, nonceLen) => {
      return ((seed = randomBytes2(32)) => new _XorStreamPRG(cipher, blockLen, keyLen, nonceLen, seed));
    }, "createPRG");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/_poly1305.js
function u8to16(a, i) {
  return a[i++] & 255 | (a[i++] & 255) << 8;
}
var Poly1305, poly1305;
var init_poly1305 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/_poly1305.js"() {
    init_utils2();
    __name(u8to16, "u8to16");
    Poly1305 = class {
      static {
        __name(this, "Poly1305");
      }
      blockLen = 16;
      outputLen = 16;
      buffer = new Uint8Array(16);
      r = new Uint16Array(10);
      // Allocating 1 array with .subarray() here is slower than 3
      h = new Uint16Array(10);
      pad = new Uint16Array(8);
      pos = 0;
      finished = false;
      destroyed = false;
      // Can be speed-up using BigUint64Array, at the cost of complexity
      constructor(key) {
        key = copyBytes(abytes2(key, 32, "key"));
        const t0 = u8to16(key, 0);
        const t1 = u8to16(key, 2);
        const t2 = u8to16(key, 4);
        const t3 = u8to16(key, 6);
        const t4 = u8to16(key, 8);
        const t5 = u8to16(key, 10);
        const t6 = u8to16(key, 12);
        const t7 = u8to16(key, 14);
        this.r[0] = t0 & 8191;
        this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
        this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
        this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
        this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
        this.r[5] = t4 >>> 1 & 8190;
        this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
        this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
        this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
        this.r[9] = t7 >>> 5 & 127;
        for (let i = 0; i < 8; i++)
          this.pad[i] = u8to16(key, 16 + 2 * i);
      }
      process(data, offset, isLast = false) {
        const hibit = isLast ? 0 : 1 << 11;
        const { h, r } = this;
        const r0 = r[0];
        const r1 = r[1];
        const r2 = r[2];
        const r3 = r[3];
        const r4 = r[4];
        const r5 = r[5];
        const r6 = r[6];
        const r7 = r[7];
        const r8 = r[8];
        const r9 = r[9];
        const t0 = u8to16(data, offset + 0);
        const t1 = u8to16(data, offset + 2);
        const t2 = u8to16(data, offset + 4);
        const t3 = u8to16(data, offset + 6);
        const t4 = u8to16(data, offset + 8);
        const t5 = u8to16(data, offset + 10);
        const t6 = u8to16(data, offset + 12);
        const t7 = u8to16(data, offset + 14);
        let h0 = h[0] + (t0 & 8191);
        let h1 = h[1] + ((t0 >>> 13 | t1 << 3) & 8191);
        let h2 = h[2] + ((t1 >>> 10 | t2 << 6) & 8191);
        let h3 = h[3] + ((t2 >>> 7 | t3 << 9) & 8191);
        let h4 = h[4] + ((t3 >>> 4 | t4 << 12) & 8191);
        let h5 = h[5] + (t4 >>> 1 & 8191);
        let h6 = h[6] + ((t4 >>> 14 | t5 << 2) & 8191);
        let h7 = h[7] + ((t5 >>> 11 | t6 << 5) & 8191);
        let h8 = h[8] + ((t6 >>> 8 | t7 << 8) & 8191);
        let h9 = h[9] + (t7 >>> 5 | hibit);
        let c = 0;
        let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
        c = d0 >>> 13;
        d0 &= 8191;
        d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
        c += d0 >>> 13;
        d0 &= 8191;
        let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
        c = d1 >>> 13;
        d1 &= 8191;
        d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
        c += d1 >>> 13;
        d1 &= 8191;
        let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
        c = d2 >>> 13;
        d2 &= 8191;
        d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
        c += d2 >>> 13;
        d2 &= 8191;
        let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
        c = d3 >>> 13;
        d3 &= 8191;
        d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
        c += d3 >>> 13;
        d3 &= 8191;
        let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
        c = d4 >>> 13;
        d4 &= 8191;
        d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
        c += d4 >>> 13;
        d4 &= 8191;
        let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
        c = d5 >>> 13;
        d5 &= 8191;
        d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
        c += d5 >>> 13;
        d5 &= 8191;
        let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
        c = d6 >>> 13;
        d6 &= 8191;
        d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
        c += d6 >>> 13;
        d6 &= 8191;
        let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
        c = d7 >>> 13;
        d7 &= 8191;
        d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
        c += d7 >>> 13;
        d7 &= 8191;
        let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
        c = d8 >>> 13;
        d8 &= 8191;
        d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
        c += d8 >>> 13;
        d8 &= 8191;
        let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
        c = d9 >>> 13;
        d9 &= 8191;
        d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
        c += d9 >>> 13;
        d9 &= 8191;
        c = (c << 2) + c | 0;
        c = c + d0 | 0;
        d0 = c & 8191;
        c = c >>> 13;
        d1 += c;
        h[0] = d0;
        h[1] = d1;
        h[2] = d2;
        h[3] = d3;
        h[4] = d4;
        h[5] = d5;
        h[6] = d6;
        h[7] = d7;
        h[8] = d8;
        h[9] = d9;
      }
      finalize() {
        const { h, pad } = this;
        const g = new Uint16Array(10);
        let c = h[1] >>> 13;
        h[1] &= 8191;
        for (let i = 2; i < 10; i++) {
          h[i] += c;
          c = h[i] >>> 13;
          h[i] &= 8191;
        }
        h[0] += c * 5;
        c = h[0] >>> 13;
        h[0] &= 8191;
        h[1] += c;
        c = h[1] >>> 13;
        h[1] &= 8191;
        h[2] += c;
        g[0] = h[0] + 5;
        c = g[0] >>> 13;
        g[0] &= 8191;
        for (let i = 1; i < 10; i++) {
          g[i] = h[i] + c;
          c = g[i] >>> 13;
          g[i] &= 8191;
        }
        g[9] -= 1 << 13;
        let mask = (c ^ 1) - 1;
        for (let i = 0; i < 10; i++)
          g[i] &= mask;
        mask = ~mask;
        for (let i = 0; i < 10; i++)
          h[i] = h[i] & mask | g[i];
        h[0] = (h[0] | h[1] << 13) & 65535;
        h[1] = (h[1] >>> 3 | h[2] << 10) & 65535;
        h[2] = (h[2] >>> 6 | h[3] << 7) & 65535;
        h[3] = (h[3] >>> 9 | h[4] << 4) & 65535;
        h[4] = (h[4] >>> 12 | h[5] << 1 | h[6] << 14) & 65535;
        h[5] = (h[6] >>> 2 | h[7] << 11) & 65535;
        h[6] = (h[7] >>> 5 | h[8] << 8) & 65535;
        h[7] = (h[8] >>> 8 | h[9] << 5) & 65535;
        let f = h[0] + pad[0];
        h[0] = f & 65535;
        for (let i = 1; i < 8; i++) {
          f = (h[i] + pad[i] | 0) + (f >>> 16) | 0;
          h[i] = f & 65535;
        }
        clean2(g);
      }
      update(data) {
        aexists2(this);
        abytes2(data);
        data = copyBytes(data);
        const { buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(data, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(buffer, 0, false);
            this.pos = 0;
          }
        }
        return this;
      }
      destroy() {
        this.destroyed = true;
        clean2(this.h, this.r, this.buffer, this.pad);
      }
      digestInto(out) {
        aexists2(this);
        aoutput2(out, this);
        this.finished = true;
        const { buffer, h } = this;
        let { pos } = this;
        if (pos) {
          buffer[pos++] = 1;
          for (; pos < 16; pos++)
            buffer[pos] = 0;
          this.process(buffer, 0, true);
        }
        this.finalize();
        let opos = 0;
        for (let i = 0; i < 8; i++) {
          out[opos++] = h[i] >>> 0;
          out[opos++] = h[i] >>> 8;
        }
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
    };
    poly1305 = /* @__PURE__ */ wrapMacConstructor(32, (key) => new Poly1305(key));
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/chacha.js
var chacha_exports = {};
__export(chacha_exports, {
  __TESTS: () => __TESTS2,
  _poly1305_aead: () => _poly1305_aead,
  chacha12: () => chacha12,
  chacha20: () => chacha20,
  chacha20orig: () => chacha20orig,
  chacha20poly1305: () => chacha20poly1305,
  chacha8: () => chacha8,
  hchacha: () => hchacha,
  rngChacha20: () => rngChacha20,
  rngChacha8: () => rngChacha8,
  xchacha20: () => xchacha20,
  xchacha20poly1305: () => xchacha20poly1305
});
function chachaCore(s, k, n, out, cnt, rounds = 20) {
  let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let r = 0; r < rounds; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function hchacha(s, k, i, out) {
  const s2 = isLE ? s : swap32IfBE(s.slice(0, 4));
  const k2 = isLE ? k : swap32IfBE(k.slice(0, 8));
  const i2 = isLE ? i : swap32IfBE(i.slice(0, 4));
  const t = new Uint32Array(16);
  chachaCore(s2, k2, i2.subarray(1), t, i2[0]);
  let oi = 0;
  out[oi++] = t[0] - s2[0] | 0;
  out[oi++] = t[1] - s2[1] | 0;
  out[oi++] = t[2] - s2[2] | 0;
  out[oi++] = t[3] - s2[3] | 0;
  out[oi++] = t[12] - i2[0] | 0;
  out[oi++] = t[13] - i2[1] | 0;
  out[oi++] = t[14] - i2[2] | 0;
  out[oi++] = t[15] - i2[3] | 0;
  swap32IfBE(out);
  if (!isLE)
    clean2(s2, k2, i2);
  clean2(t);
}
function computeTag2(fn, key, nonce, ciphertext, AAD) {
  if (AAD !== void 0)
    abytes2(AAD, void 0, "AAD");
  const authKey = fn(key, nonce, ZEROS322);
  const lengths = u64Lengths(ciphertext.length, AAD ? AAD.length : 0, true);
  const h = poly1305.create(authKey);
  if (AAD)
    updatePadded(h, AAD);
  updatePadded(h, ciphertext);
  h.update(lengths);
  const res = h.digest();
  clean2(authKey, lengths);
  return res;
}
var chacha20orig, chacha20, xchacha20, chacha8, chacha12, __TESTS2, ZEROS162, updatePadded, ZEROS322, _poly1305_aead, chacha20poly1305, xchacha20poly1305, rngChacha20, rngChacha8;
var init_chacha = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/chacha.js"() {
    init_arx();
    init_poly1305();
    init_utils2();
    __name(chachaCore, "chachaCore");
    __name(hchacha, "hchacha");
    chacha20orig = /* @__PURE__ */ createCipher(chachaCore, {
      counterRight: false,
      counterLength: 8,
      allowShortKeys: true
    });
    chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
      counterRight: false,
      counterLength: 4,
      allowShortKeys: false
    });
    xchacha20 = /* @__PURE__ */ createCipher(chachaCore, {
      counterRight: false,
      counterLength: 8,
      extendNonceFn: hchacha,
      allowShortKeys: false
    });
    chacha8 = /* @__PURE__ */ createCipher(chachaCore, {
      counterRight: false,
      counterLength: 4,
      rounds: 8
    });
    chacha12 = /* @__PURE__ */ createCipher(chachaCore, {
      counterRight: false,
      counterLength: 4,
      rounds: 12
    });
    __TESTS2 = /* @__PURE__ */ Object.freeze({ chachaCore });
    ZEROS162 = /* @__PURE__ */ new Uint8Array(16);
    updatePadded = /* @__PURE__ */ __name((h, msg) => {
      h.update(msg);
      const leftover = msg.length % 16;
      if (leftover)
        h.update(ZEROS162.subarray(leftover));
    }, "updatePadded");
    ZEROS322 = /* @__PURE__ */ new Uint8Array(32);
    __name(computeTag2, "computeTag");
    _poly1305_aead = /* @__PURE__ */ __name((xorStream) => (key, nonce, AAD) => {
      const tagLength = 16;
      return {
        encrypt(plaintext, output) {
          const plength = plaintext.length;
          output = getOutput(plength + tagLength, output, false);
          output.set(plaintext);
          const oPlain = output.subarray(0, -tagLength);
          xorStream(key, nonce, oPlain, oPlain, 1);
          const tag = computeTag2(xorStream, key, nonce, oPlain, AAD);
          output.set(tag, plength);
          clean2(tag);
          return output;
        },
        decrypt(ciphertext, output) {
          output = getOutput(ciphertext.length - tagLength, output, false);
          const data = ciphertext.subarray(0, -tagLength);
          const passedTag = ciphertext.subarray(-tagLength);
          const tag = computeTag2(xorStream, key, nonce, data, AAD);
          if (!equalBytes(passedTag, tag)) {
            clean2(tag);
            throw new Error("invalid tag");
          }
          output.set(ciphertext.subarray(0, -tagLength));
          xorStream(key, nonce, output, output, 1);
          clean2(tag);
          return output;
        }
      };
    }, "_poly1305_aead");
    chacha20poly1305 = /* @__PURE__ */ wrapCipher(
      { blockSize: 64, nonceLength: 12, tagLength: 16, withAAD: true },
      /* @__PURE__ */ _poly1305_aead(chacha20)
    );
    xchacha20poly1305 = /* @__PURE__ */ wrapCipher(
      { blockSize: 64, nonceLength: 24, tagLength: 16, withAAD: true },
      /* @__PURE__ */ _poly1305_aead(xchacha20)
    );
    rngChacha20 = /* @__PURE__ */ createPRG(chacha20orig, 64, 32, 8);
    rngChacha8 = /* @__PURE__ */ createPRG(chacha8, 64, 32, 12);
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/ciphers/chacha.js
var require_chacha = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/ciphers/chacha.js"(exports, module) {
    module.exports = (init_chacha(), __toCommonJS(chacha_exports));
  }
});

// node_modules/node-onlykey-lib/bucket/src/room.js
var require_room = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/room.js"(exports, module) {
    "use strict";
    var bid = require_bucket_identity();
    var { toHex, fromHex } = require_bytes();
    var { sha256: sha2562 } = require_sha2();
    var { hkdf: hkdf2 } = require_hkdf();
    var { xchacha20poly1305: xchacha20poly13052 } = require_chacha();
    var NONCE = 32;
    var KINDS2 = /* @__PURE__ */ new Set(["webapp", "desktop", "android", "cli", "agent"]);
    var REFUSED = { ok: false };
    var utf8 = /* @__PURE__ */ __name((s) => new TextEncoder().encode(s), "utf8");
    var hex2 = /* @__PURE__ */ __name((s, n) => typeof s === "string" && (n ? s.length === n * 2 : s.length > 0) && /^[0-9a-f]+$/.test(s), "hex");
    var joinBytes = /* @__PURE__ */ __name((host, nonce) => new Uint8Array([...utf8(`${String(host).toLowerCase()}|`), ...nonce]), "joinBytes");
    function challenge(randomBytes4) {
      const nonce = Uint8Array.from(randomBytes4(NONCE));
      return { nonce, message: { t: "challenge", nonce: toHex(nonce) } };
    }
    __name(challenge, "challenge");
    function join(me, asked, device) {
      return {
        t: "join",
        identityPublicKey: toHex(me.identityPublicKey),
        bucketPublicKey: toHex(me.bucketKey.publicKey),
        certificate: toHex(me.certificate),
        signature: toHex(bid.sign(me.bucketKey, "join", joinBytes(asked.host, fromHex(asked.nonce)))),
        device
      };
    }
    __name(join, "join");
    function deviceOf(d) {
      if (!d || !hex2(d.id) || d.id.length < 16 || d.id.length > 64) return null;
      if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 64 || !KINDS2.has(d.kind)) return null;
      return { id: d.id, name: d.name.trim(), kind: d.kind };
    }
    __name(deviceOf, "deviceOf");
    function checkJoin(room2, msg, asked) {
      try {
        if (!msg || msg.t !== "join" || !hex2(msg.identityPublicKey, 32) || !hex2(msg.bucketPublicKey, 32)) return REFUSED;
        if (!hex2(msg.certificate, 64) || !hex2(msg.signature, 64)) return REFUSED;
        const device = deviceOf(msg.device);
        const identityPublicKey = fromHex(msg.identityPublicKey);
        if (!device || bid.identityIdOf(identityPublicKey) !== room2) return REFUSED;
        const ok = bid.verify({
          identityPublicKey,
          bucketPublicKey: fromHex(msg.bucketPublicKey),
          certificate: fromHex(msg.certificate),
          purpose: "join",
          bytes: joinBytes(asked.host, asked.nonce),
          signature: fromHex(msg.signature)
        });
        return ok ? { ok: true, identity: room2, device } : REFUSED;
      } catch {
        return REFUSED;
      }
    }
    __name(checkJoin, "checkJoin");
    var FRAME_NONCE = 24;
    var utf8bytes = /* @__PURE__ */ __name((s) => new TextEncoder().encode(s), "utf8bytes");
    function frameKey(bucketKey, roomId) {
      return hkdf2(sha2562, Uint8Array.from(bucketKey.secretKey), utf8bytes("OKSERVER-FRAME-v1"), utf8bytes(String(roomId)), 32);
    }
    __name(frameKey, "frameKey");
    var frameAad = /* @__PURE__ */ __name((roomId, from, to) => utf8bytes(`okroom|${roomId}|${from}|${to}`), "frameAad");
    function sealFrame(key, who, payload, randomBytes4) {
      const nonce = Uint8Array.from(randomBytes4(FRAME_NONCE));
      const ct = xchacha20poly13052(key, nonce, frameAad(who.room, who.from, who.to)).encrypt(utf8bytes(JSON.stringify(payload)));
      return toHex(nonce) + toHex(ct);
    }
    __name(sealFrame, "sealFrame");
    function openFrame(key, who, body) {
      try {
        if (typeof body !== "string" || !/^[0-9a-f]+$/.test(body) || body.length < (FRAME_NONCE + 16) * 2) return null;
        const bytes3 = fromHex(body);
        const pt = xchacha20poly13052(key, bytes3.subarray(0, FRAME_NONCE), frameAad(who.room, who.from, who.to)).decrypt(bytes3.subarray(FRAME_NONCE));
        return JSON.parse(new TextDecoder().decode(pt));
      } catch {
        return null;
      }
    }
    __name(openFrame, "openFrame");
    module.exports = { NONCE, KINDS: KINDS2, challenge, join, checkJoin, deviceOf, frameKey, sealFrame, openFrame };
  }
});

// node_modules/node-onlykey-lib/bucket/src/room-client.js
var require_room_client = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/room-client.js"(exports, module) {
    "use strict";
    var room2 = require_room();
    var PING_MS = 25e3;
    function connectRoom({ url, me, device, WebSocket: WS, randomBytes: randomBytes4, timeoutMs = 15e3 }) {
      const base = new URL(url);
      const host = base.host;
      const wsUrl = `${base.protocol === "https:" ? "wss:" : "ws:"}//${host}/ws/${me.id}`;
      const key = room2.frameKey(me.bucketKey, me.id);
      const listeners = /* @__PURE__ */ new Map();
      const emit = /* @__PURE__ */ __name((ev, v) => (listeners.get(ev) || []).forEach((l) => {
        try {
          l(v);
        } catch {
        }
      }), "emit");
      const peers = /* @__PURE__ */ new Map();
      const pending = /* @__PURE__ */ new Map();
      const mcpPending = /* @__PURE__ */ new Map();
      let handler = null;
      let you = null;
      let seq = 0;
      let mcpSeq = 0;
      let ping = null;
      return new Promise((resolve, reject) => {
        const ws = new WS(wsUrl);
        const send2 = /* @__PURE__ */ __name((m) => ws.send(JSON.stringify(m)), "send");
        const fail = /* @__PURE__ */ __name((why) => {
          for (const [, p] of pending) p.reject(new Error(why));
          pending.clear();
          for (const [, p] of mcpPending) p.reject(new Error(why));
          mcpPending.clear();
        }, "fail");
        const joinTimer = setTimeout(() => {
          reject(new Error(`${host}: no answer to the join within ${timeoutMs} ms`));
          try {
            ws.close();
          } catch {
          }
        }, timeoutMs);
        ws.onmessage = async (ev) => {
          let m;
          try {
            m = JSON.parse(typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data));
          } catch {
            return;
          }
          if (m.re !== void 0 && mcpPending.has(m.re) && (m.t === "mcp" || m.t === "sealed" || m.t === "error")) {
            const p = mcpPending.get(m.re);
            mcpPending.delete(m.re);
            if (m.t === "error") p.reject(new Error(`the room refused it: ${m.why}`));
            else p.resolve(m);
            return;
          }
          switch (m.t) {
            case "mcp": {
              const { t, ...rest } = m;
              emit("mcp", rest);
              return;
            }
            case "challenge":
              send2(room2.join(me, { nonce: m.nonce, host }, device));
              return;
            case "joined":
              clearTimeout(joinTimer);
              you = m.you;
              for (const p of m.peers || []) peers.set(p.id, p);
              ping = setInterval(() => {
                try {
                  send2({ t: "ping" });
                } catch {
                }
              }, PING_MS);
              if (ping.unref) ping.unref();
              resolve(api);
              return;
            case "refused":
              clearTimeout(joinTimer);
              reject(new Error(`${host} refused the join: this key is not this room's identity, or the server's host is not the one it answers on`));
              return;
            case "peer":
              if (m.up) {
                peers.set(m.up.id, m.up);
                emit("peer", { up: m.up });
              }
              if (m.down) {
                peers.delete(m.down);
                for (const [id, p] of pending) if (p.to === m.down) {
                  pending.delete(id);
                  p.reject(new Error(`the device ${m.down} left the room`));
                }
                emit("peer", { down: m.down });
              }
              return;
            case "gone":
              for (const [id, p] of pending) if (p.to === m.to) {
                pending.delete(id);
                p.reject(new Error(`the device ${m.to} is not in the room`));
              }
              return;
            case "frame": {
              const body = room2.openFrame(key, { room: me.id, from: m.from, to: you }, m.body);
              if (!body) return;
              if (body.re !== void 0) {
                const p = pending.get(body.re);
                if (p && p.to === m.from) {
                  pending.delete(body.re);
                  p.resolve(body.answer === void 0 ? null : body.answer);
                }
                return;
              }
              if (body.id === void 0 || !handler) return;
              let answer = null;
              try {
                answer = await handler(m.from, body.message);
              } catch {
                answer = null;
              }
              try {
                send2({ t: "frame", to: m.from, body: room2.sealFrame(key, { room: me.id, from: you, to: m.from }, { re: body.id, answer }, randomBytes4) });
              } catch {
              }
              return;
            }
            default:
          }
        };
        ws.onclose = () => {
          clearTimeout(joinTimer);
          if (ping) clearInterval(ping);
          fail("the room connection closed");
          emit("close");
          reject(new Error(`${host}: the connection closed before the join`));
        };
        ws.onerror = () => {
        };
        const api = {
          get you() {
            return you;
          },
          peers: /* @__PURE__ */ __name(() => [...peers.values()], "peers"),
          on(ev, l) {
            if (!listeners.has(ev)) listeners.set(ev, []);
            listeners.get(ev).push(l);
            return api;
          },
          serve(fn) {
            handler = fn;
            return api;
          },
          request(to, message, { timeoutMs: t = 12e4 } = {}) {
            return new Promise((res, rej) => {
              const id = ++seq;
              const timer = setTimeout(() => {
                if (pending.delete(id)) rej(new Error(`no answer from ${to} within ${t} ms`));
              }, t);
              pending.set(id, {
                to,
                resolve: /* @__PURE__ */ __name((v) => {
                  clearTimeout(timer);
                  res(v);
                }, "resolve"),
                reject: /* @__PURE__ */ __name((e) => {
                  clearTimeout(timer);
                  rej(e);
                }, "reject")
              });
              try {
                send2({ t: "frame", to, body: room2.sealFrame(key, { room: me.id, from: you, to }, { id, message }, randomBytes4) });
              } catch (e) {
                pending.delete(id);
                clearTimeout(timer);
                rej(e);
              }
            });
          },
          /* one answer to the agents' side of the room, and the room's reply ({ev: 'ok' | 'agents', ...}) */
          mcp(op, fields = {}, { timeoutMs: t = 15e3 } = {}) {
            return new Promise((res, rej) => {
              const re = ++mcpSeq;
              const timer = setTimeout(() => {
                if (mcpPending.delete(re)) rej(new Error(`the room did not answer ${op} within ${t} ms`));
              }, t);
              mcpPending.set(re, {
                resolve: /* @__PURE__ */ __name((v) => {
                  clearTimeout(timer);
                  res(v);
                }, "resolve"),
                reject: /* @__PURE__ */ __name((e) => {
                  clearTimeout(timer);
                  rej(e);
                }, "reject")
              });
              try {
                send2({ t: "mcp-re", op, re, ...fields });
              } catch (e) {
                mcpPending.delete(re);
                clearTimeout(timer);
                rej(e);
              }
            });
          },
          async agents() {
            const r = await api.mcp("agents");
            return { agents: r.agents || [], plans: r.plans || [] };
          },
          async setAgent(agent, state) {
            await api.mcp("agent", { agent, state });
          },
          async planUpdate(plan, { state, results, receipts, why } = {}) {
            await api.mcp("plan", { plan, ...state ? { state } : {}, ...results ? { results } : {}, ...receipts ? { receipts } : {}, ...why ? { why } : {} });
          },
          /*
           * THE SERVER'S SEALED COPY OF THIS BUCKET (bucket/src/sealedcopy.js; Phase 3): the room's rows as a row store for
           * sealedcopy.syncWith - ids and tags, sealed units the server cannot read. on: false when this server keeps no
           * copy for the identity (its allowlist): the table is empty and a put is refused.
           */
          sealed(op, fields = {}, { timeoutMs: t = 3e4 } = {}) {
            return new Promise((res, rej) => {
              const re = ++mcpSeq;
              const timer = setTimeout(() => {
                if (mcpPending.delete(re)) rej(new Error(`the room did not answer sealed ${op} within ${t} ms`));
              }, t);
              mcpPending.set(re, {
                resolve: /* @__PURE__ */ __name((v) => {
                  clearTimeout(timer);
                  res(v);
                }, "resolve"),
                reject: /* @__PURE__ */ __name((e) => {
                  clearTimeout(timer);
                  rej(e);
                }, "reject")
              });
              try {
                send2({ t: "sealed", op, re, ...fields });
              } catch (e) {
                mcpPending.delete(re);
                clearTimeout(timer);
                rej(e);
              }
            });
          },
          sealedStore() {
            return {
              async on() {
                return Boolean((await api.sealed("table")).on);
              },
              async table() {
                return (await api.sealed("table")).rows || {};
              },
              async get(ids) {
                return ids.length ? (await api.sealed("get", { ids })).rows || {} : {};
              },
              async put(rows) {
                const r = await api.sealed("put", { rows });
                if (!r.ok) throw new Error(`the server did not keep the rows: ${r.why || "refused"}`);
              }
            };
          },
          close() {
            try {
              ws.close();
            } catch {
            }
          }
        };
      });
    }
    __name(connectRoom, "connectRoom");
    module.exports = { connectRoom };
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/hmac.js
var require_hmac = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/hmac.js"(exports, module) {
    module.exports = (init_hmac(), __toCommonJS(hmac_exports));
  }
});

// node_modules/node-onlykey-lib/bucket/src/sealedcopy.js
var require_sealedcopy = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/sealedcopy.js"(exports, module) {
    "use strict";
    var { sha256: sha2562 } = require_sha2();
    var { hkdf: hkdf2 } = require_hkdf();
    var { hmac: hmac2 } = require_hmac();
    var { toHex } = require_bytes();
    var vault = require_vault();
    var replicate = require_replicate();
    var utf8 = /* @__PURE__ */ __name((s) => new TextEncoder().encode(s), "utf8");
    var mac = /* @__PURE__ */ __name((key, text2) => toHex(hmac2(sha2562, key, utf8(text2))).slice(0, 32), "mac");
    var HEADS = "\0heads";
    function keysOf(bucketKey) {
      const salt = utf8("OKBUCKET-SEALED-v1");
      return {
        tableKey: hkdf2(sha2562, bucketKey.secretKey, salt, utf8("table"), 32),
        unitKey: hkdf2(sha2562, bucketKey.secretKey, salt, utf8("unit"), 32)
      };
    }
    __name(keysOf, "keysOf");
    var headsId = /* @__PURE__ */ __name((keys) => mac(keys.tableKey, HEADS), "headsId");
    function table(bucket, keys, { rules = {} } = {}) {
      const rows = {};
      const where = {};
      for (const [name, units] of Object.entries(replicate.summarize(bucket, { rules }))) {
        for (const [k, u] of Object.entries(units)) {
          const id = mac(keys.tableKey, `${name}\0${k}`);
          rows[id] = mac(keys.tableKey, `${u.h}\0${u.at || ""}`);
          where[id] = [name, k];
        }
      }
      return { rows, where };
    }
    __name(table, "table");
    function plan(mine, theirs, keys) {
      const h = keys ? headsId(keys) : null;
      const get = Object.keys(theirs).filter((id) => id !== h && mine[id] !== theirs[id]).sort();
      const put = Object.keys(mine).filter((id) => theirs[id] !== mine[id]).sort();
      return { get, put };
    }
    __name(plan, "plan");
    function sealRows(bucket, keys, ids, { rules = {}, randomBytes: randomBytes4 }) {
      const t = table(bucket, keys, { rules });
      const mine = replicate.summarize(bucket, { rules });
      const theirs = JSON.parse(JSON.stringify(mine));
      for (const id of ids) {
        const w = t.where[id];
        if (!w) throw Object.assign(new Error("a row to put is not in this bucket now - plan again"), { code: "EBUCKET_CHANGED" });
        delete theirs[w[0]][w[1]];
      }
      const given = replicate.give(bucket, mine, theirs, { rules });
      const out = {};
      for (const id of ids) {
        const [name, k] = t.where[id];
        out[id] = { tag: t.rows[id], blob: vault.seal(keys.unitKey, JSON.stringify({ id, s: name, k, r: given[name][k] }), randomBytes4) };
      }
      return out;
    }
    __name(sealRows, "sealRows");
    function openRows(rows, keys) {
      const given = {};
      const refused = [];
      for (const [id, blob] of Object.entries(rows)) {
        let u;
        try {
          u = JSON.parse(vault.open(keys.unitKey, blob));
        } catch (_) {
          refused.push(`${id}: does not open with this bucket key`);
          continue;
        }
        if (!u || u.id !== id || typeof u.s !== "string" || typeof u.k !== "string" || !u.r) {
          refused.push(`${id}: not this row's unit`);
          continue;
        }
        if (!given[u.s]) given[u.s] = {};
        given[u.s][u.k] = u.r;
      }
      return { given, refused };
    }
    __name(openRows, "openRows");
    function sealHeads(heads, keys, randomBytes4) {
      const text2 = JSON.stringify(Object.fromEntries(Object.entries(heads).sort()));
      const id = headsId(keys);
      return { id, tag: mac(keys.tableKey, text2), blob: vault.seal(keys.unitKey, JSON.stringify({ id, heads: JSON.parse(text2) }), randomBytes4) };
    }
    __name(sealHeads, "sealHeads");
    function openHeads(blob, keys) {
      if (!blob) return {};
      try {
        const u = JSON.parse(vault.open(keys.unitKey, blob));
        return u && u.id === headsId(keys) && u.heads && typeof u.heads === "object" ? u.heads : {};
      } catch (_) {
        return {};
      }
    }
    __name(openHeads, "openHeads");
    async function syncWith(bucket, keys, store, { rules = {}, randomBytes: randomBytes4, heads = null } = {}) {
      const theirs = await store.table();
      const p = plan(table(bucket, keys, { rules }).rows, theirs, keys);
      let taken = {};
      let conflicts = [];
      let refused = [];
      if (p.get.length) {
        const opened = openRows(await store.get(p.get), keys);
        refused = opened.refused;
        const r = replicate.take(bucket, opened.given, { rules });
        taken = r.taken;
        conflicts = r.conflicts;
      }
      const put = plan(table(bucket, keys, { rules }).rows, theirs, keys).put;
      const rows = put.length ? sealRows(bucket, keys, put, { rules, randomBytes: randomBytes4 }) : {};
      if (heads) {
        const h = sealHeads(heads, keys, randomBytes4);
        if (theirs[h.id] !== h.tag) rows[h.id] = { tag: h.tag, blob: h.blob };
      }
      if (Object.keys(rows).length) await store.put(rows);
      return { got: p.get.length, put: Object.keys(rows).length, taken, conflicts, refused };
    }
    __name(syncWith, "syncWith");
    var OWNER = "\0owner";
    var ownerId = /* @__PURE__ */ __name((keys) => mac(keys.tableKey, OWNER), "ownerId");
    function sealOwner(owner, keys, randomBytes4) {
      const id = ownerId(keys);
      return { id, tag: mac(keys.tableKey, `${OWNER}\0${owner}`), blob: vault.seal(keys.unitKey, JSON.stringify({ id, owner }), randomBytes4) };
    }
    __name(sealOwner, "sealOwner");
    function bucketFromRows(rows, keys, { owner, rules = {} }) {
      const oid = ownerId(keys);
      const hid = headsId(keys);
      let who = null;
      try {
        const u = JSON.parse(vault.open(keys.unitKey, rows[oid]));
        who = u && u.id === oid ? u.owner : null;
      } catch (_) {
        return null;
      }
      if (who !== owner) return null;
      const units = Object.fromEntries(Object.entries(rows).filter(([id]) => id !== oid && id !== hid));
      const { given, refused } = openRows(units, keys);
      if (refused.length) return null;
      const { create } = require_bucket();
      const b = create({ owner });
      replicate.take(b, given, { rules });
      return b;
    }
    __name(bucketFromRows, "bucketFromRows");
    module.exports = { keysOf, headsId, table, plan, sealRows, openRows, sealHeads, openHeads, syncWith, ownerId, sealOwner, bucketFromRows };
  }
});

// node_modules/node-onlykey-lib/bucket/src/index.js
var require_src = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/index.js"(exports, module) {
    "use strict";
    module.exports = { ...require_bucket(), rules: require_rules(), replicate: require_replicate(), bucketIdentity: require_bucket_identity(), trade: require_trade(), room: require_room(), roomClient: require_room_client(), sealedCopy: require_sealedcopy() };
  }
});

// mcp-server/src/index.js
var import_bucket2 = __toESM(require_src());
var import_bytes2 = __toESM(require_bytes());
import { DurableObject as DurableObject2 } from "cloudflare:workers";

// mcp-server/src/mcp.js
var import_bucket = __toESM(require_src());
var import_bytes = __toESM(require_bytes());
import { DurableObject } from "cloudflare:workers";
var PROTOCOL = "2025-06-18";
var SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
var SESSION_ID = /^[0-9a-f]{32}$/;
var HEX64 = /^[0-9a-f]{64}$/;
var MAX_ITEMS = 32;
var MAX_DATA = 64 * 1024;
var MAX_TEXT = 200;
var WAIT_MAX_S = 60;
var OPS = ["sign", "decrypt"];
var KINDS = ["ssh", "gpg"];
var hex = /* @__PURE__ */ __name((u82) => import_bytes.default.toHex(u82), "hex");
var randomHex = /* @__PURE__ */ __name((n) => hex(crypto.getRandomValues(new Uint8Array(n))), "randomHex");
var sha256Hex = /* @__PURE__ */ __name(async (h) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", import_bytes.default.fromHex(h)))), "sha256Hex");
var roomOf = /* @__PURE__ */ __name((identityPublicKey) => import_bucket.default.bucketIdentity.identityIdOf(import_bytes.default.fromHex(identityPublicKey)), "roomOf");
var Refused = class extends Error {
  static {
    __name(this, "Refused");
  }
};
var need = /* @__PURE__ */ __name((ok, why) => {
  if (!ok) throw new Refused(why);
}, "need");
var text = /* @__PURE__ */ __name((v, name, { max = MAX_TEXT, optional = false } = {}) => {
  if (optional && (v === void 0 || v === null || v === "")) return null;
  need(typeof v === "string" && v.trim().length > 0 && v.length <= max, `${name}: text, 1-${max} characters`);
  return v.trim();
}, "text");
var identityArg = /* @__PURE__ */ __name((v) => {
  const h = typeof v === "string" ? v.trim().toLowerCase() : "";
  need(HEX64.test(h), "identity: the identity PUBLIC KEY, 64 hex characters (the owner gives it to you)");
  return h;
}, "identityArg");
var KEY_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: KINDS, description: "ssh or gpg: the agent-derived key Edge uses" },
    identity: { type: "string", description: `the key's label, e.g. "you@example.com" (gpg) or "ssh://user@host" (ssh)` }
  },
  required: ["kind", "identity"]
};
var ITEM_PROPS = {
  plan_id: { type: "string" },
  op: { type: "string", enum: OPS },
  key: KEY_SCHEMA,
  reason: { type: "string", description: "why, in a few words - the owner reads it before approving" }
};
var TOOLS = [
  {
    name: "hello",
    description: "Start here. Name yourself; the first time you get an agent_key - keep it and send it in every later hello, so the owners who accepted you know you again.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, agent_key: { type: "string", description: "64 hex characters, from your first hello" } }, required: ["name"] }
  },
  {
    name: "status",
    description: "Your plans, and for an identity: whether its owner has accepted you, and whether the owner is online.",
    inputSchema: { type: "object", properties: { identity: { type: "string", description: "an identity public key (64 hex)" } } }
  },
  {
    name: "plan_new",
    description: "A new plan for an identity (its public key, 64 hex). Its owner sees it in their web app at once, and every change after.",
    inputSchema: { type: "object", properties: { identity: { type: "string" }, title: { type: "string" } }, required: ["identity", "title"] }
  },
  {
    name: "plan_target",
    description: "Move a draft plan to another identity: withdrawn from the old owner's web app, shown in the new one's.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" }, identity: { type: "string" } }, required: ["plan_id", "identity"] }
  },
  {
    name: "plan_add",
    description: 'Add one operation with its data (base64 when it is bytes, set encoding: "base64").',
    inputSchema: { type: "object", properties: { ...ITEM_PROPS, data: { type: "string" }, encoding: { type: "string", enum: ["text", "base64"] } }, required: ["plan_id", "op", "key", "data", "reason"] }
  },
  {
    name: "plan_hold",
    description: "Add a PLACEHOLDER: an operation whose data comes later (plan_fill, while the plan runs), counted in the budget - so work that depends on an earlier signature needs no second approval.",
    inputSchema: { type: "object", properties: ITEM_PROPS, required: ["plan_id", "op", "key", "reason"] }
  },
  {
    name: "plan_remove",
    description: "Remove one item from a draft plan.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" }, item: { type: "integer" } }, required: ["plan_id", "item"] }
  },
  {
    name: "plan_show",
    description: "The plan as it is now (read only).",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" } }, required: ["plan_id"] }
  },
  {
    name: "plan_submit",
    description: "Ask the owner to approve the plan: one budget sized to it, one press. Refused until the owner has accepted you, or while no owner device is online.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" } }, required: ["plan_id"] }
  },
  {
    name: "plan_fill",
    description: "While the plan runs: a placeholder's data. It runs inside the open budget, no new press.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" }, item: { type: "integer" }, data: { type: "string" }, encoding: { type: "string", enum: ["text", "base64"] } }, required: ["plan_id", "item", "data"] }
  },
  {
    name: "plan_wait",
    description: "Wait (up to 60 s) for the plan to move on: its state, each item's result (signature, plaintext or refusal), the placeholders still waiting, the receipts.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" }, seconds: { type: "integer" } }, required: ["plan_id"] }
  },
  {
    name: "plan_finish",
    description: "End the plan's budget now: unfilled placeholders are dropped, receipts filed.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" } }, required: ["plan_id"] }
  }
];
var INSTRUCTIONS = "OnlyKey Edge control. Your owner gives you this URL and their identity public key. Say hello (keep the agent_key you get the first time), build a plan for the identity (plan_new, plan_add, plan_hold for data that comes later), then plan_submit: the owner sees the plan live in their web app, accepts you once, approves the plan and presses their key once. plan_wait gives the results.";
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }), "json");
var rpcError = /* @__PURE__ */ __name((id, code, message) => json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), "rpcError");
async function handleMcp(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return new Response("another site", { status: 403 });
  if (request.method === "GET") return new Response("no event stream: POST JSON-RPC", { status: 405, headers: { Allow: "POST, DELETE" } });
  const sid = request.headers.get("Mcp-Session-Id");
  if (request.method === "DELETE") {
    if (sid && SESSION_ID.test(sid)) await env.MCP_SESSIONS.get(env.MCP_SESSIONS.idFromName(sid)).end();
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") return new Response("POST", { status: 405, headers: { Allow: "POST, DELETE" } });
  let msg;
  try {
    msg = await request.json();
  } catch {
    return rpcError(null, -32700, "not JSON");
  }
  if (Array.isArray(msg)) return rpcError(null, -32600, "one message a request");
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg && msg.id, -32600, "not a JSON-RPC request");
  const isNotification = msg.id === void 0;
  if (msg.method === "initialize") {
    const asked = msg.params && msg.params.protocolVersion;
    const id = randomHex(16);
    await env.MCP_SESSIONS.get(env.MCP_SESSIONS.idFromName(id)).open();
    return json({ jsonrpc: "2.0", id: msg.id, result: {
      protocolVersion: SUPPORTED.includes(asked) ? asked : PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "ok-edge", version: "0.1.0" },
      instructions: INSTRUCTIONS
    } }, 200, { "Mcp-Session-Id": id });
  }
  if (!sid || !SESSION_ID.test(sid)) return rpcError(msg.id, -32600, "no session: initialize first (Mcp-Session-Id)");
  const session = env.MCP_SESSIONS.get(env.MCP_SESSIONS.idFromName(sid));
  if (isNotification) {
    if (!await session.known()) return new Response("unknown session", { status: 404 });
    return new Response(null, { status: 202 });
  }
  const r = await session.call(msg.method, msg.params || {});
  if (r.unknownSession) return new Response("unknown session", { status: 404 });
  if (r.error) return rpcError(msg.id, r.error.code, r.error.message);
  return json({ jsonrpc: "2.0", id: msg.id, result: r.result });
}
__name(handleMcp, "handleMcp");
var McpSession = class extends DurableObject {
  static {
    __name(this, "McpSession");
  }
  async open() {
    await this.ctx.storage.put("created", Date.now());
  }
  async known() {
    return await this.ctx.storage.get("created") !== void 0;
  }
  async end() {
    await this.ctx.storage.deleteAll();
  }
  async call(method, params) {
    if (!await this.known()) return { unknownSession: true };
    try {
      if (method === "ping") return { result: {} };
      if (method === "tools/list") return { result: { tools: TOOLS } };
      if (method !== "tools/call") return { error: { code: -32601, message: `no method ${method}` } };
      const { name, arguments: args = {} } = params;
      if (!TOOLS.some((t) => t.name === name)) return { error: { code: -32602, message: `no tool ${name}` } };
      const out = name === "hello" ? await this.hello(args) : await this.forAgent(name, args);
      return { result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out } };
    } catch (e) {
      if (e instanceof Refused || e && e.refused) return { result: { content: [{ type: "text", text: e.message }], isError: true } };
      return { error: { code: -32603, message: String(e && e.message || e) } };
    }
  }
  async hello(args) {
    const name = text(args.name, "name", { max: 60 });
    let key = args.agent_key;
    const first = key === void 0 || key === null || key === "";
    if (first) key = randomHex(32);
    else need(typeof key === "string" && HEX64.test(key.toLowerCase()), "agent_key: the 64 hex characters your first hello gave you");
    const id = await sha256Hex(key.toLowerCase());
    await this.ctx.storage.put("agent", { id, name });
    await this.env.AGENTS.get(this.env.AGENTS.idFromName(id)).hello(id, name);
    return first ? { agent_id: id, agent_key: key, keep: "this agent_key is shown once: keep it, and send it in every later hello" } : { agent_id: id };
  }
  async forAgent(name, args) {
    const agent = await this.ctx.storage.get("agent");
    need(agent, "say hello first");
    const r = await this.env.AGENTS.get(this.env.AGENTS.idFromName(agent.id)).tool(name, args);
    if (r && r.refused) throw new Refused(r.refused);
    return r;
  }
};
var ROOM_STUB = /* @__PURE__ */ __name((env, roomId) => env.ROOMS.get(env.ROOMS.idFromName(roomId)), "ROOM_STUB");
var AgentSession = class extends DurableObject {
  static {
    __name(this, "AgentSession");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.waiters = [];
  }
  async hello(id, name) {
    const me = await this.ctx.storage.get("me") || { id, first: Date.now() };
    await this.ctx.storage.put("me", { ...me, name, last: Date.now() });
  }
  async me() {
    return this.ctx.storage.get("me");
  }
  async plan(id) {
    return this.ctx.storage.get(`plan:${id}`);
  }
  /*
   * Every change bumps the plan's version. SEEN is the version the agent has been shown: its own changes are seen as it
   * makes them; the owner's (fromRoom) are not until plan_wait or plan_show returns them - so an answer that lands just
   * before a plan_wait starts is returned at once, not missed while the wait looks for a later one.
   */
  async save(p, { byAgent = true } = {}) {
    p.updated = Date.now();
    p.version = (p.version || 0) + 1;
    if (byAgent) p.seen = p.version;
    await this.ctx.storage.put(`plan:${p.id}`, p);
    for (const w of this.waiters.splice(0)) w();
  }
  async shownToAgent(p) {
    if (p.seen !== p.version) {
      p.seen = p.version;
      await this.ctx.storage.put(`plan:${p.id}`, p);
    }
    return this.view(p);
  }
  /* what the owner's web app is shown: everything but the agent's own bookkeeping */
  shown(p, me) {
    return { id: p.id, room: p.room, title: p.title, agent: { id: me.id, name: me.name }, state: p.state, items: p.items, results: p.results, receipts: p.receipts, why: p.why || null };
  }
  async mirror(p) {
    const me = await this.me();
    return ROOM_STUB(this.env, p.room).show(this.shown(p, me));
  }
  /* each call: one change to one plan, or a read; a refusal comes back as {refused} (an RPC throw loses its class) */
  async tool(name, args) {
    try {
      return await this.run(name, args);
    } catch (e) {
      if (e instanceof Refused) return { refused: e.message };
      throw e;
    }
  }
  async run(name, args) {
    const me = await this.me();
    if (name === "status") {
      const plans = (await this.ctx.storage.list({ prefix: "plan:" })).values();
      const out = { agent_id: me.id, plans: [...plans].map((p2) => ({ plan_id: p2.id, title: p2.title, identity: p2.identity, state: p2.state, items: p2.items.length })) };
      if (args.identity !== void 0) {
        const identity = identityArg(args.identity);
        out.identity = { identity_public_key: identity, ...await ROOM_STUB(this.env, roomOf(identity)).agentStatus(me) };
      }
      return out;
    }
    if (name === "plan_new") {
      const identity = identityArg(args.identity);
      const p2 = { id: randomHex(8), title: text(args.title, "title"), identity, room: roomOf(identity), state: "draft", items: [], results: {}, receipts: [], created: Date.now() };
      await this.save(p2);
      const seen = await this.mirror(p2);
      return { plan_id: p2.id, identity, ...seen };
    }
    const p = await this.plan(String(args.plan_id || ""));
    need(p, `no plan ${args.plan_id} - plan_new makes one`);
    const draft = /* @__PURE__ */ __name(() => need(p.state === "draft", `the plan is ${p.state}: only a draft changes`), "draft");
    const itemOf = /* @__PURE__ */ __name((n) => {
      const it = p.items.find((x) => x.item === Number(n));
      need(it, `no item ${n} in the plan`);
      return it;
    }, "itemOf");
    const opArgs = /* @__PURE__ */ __name(() => {
      need(OPS.includes(args.op), `op: ${OPS.join(" or ")}`);
      const k = args.key || {};
      need(KINDS.includes(k.kind), `key.kind: ${KINDS.join(" or ")}`);
      return { op: args.op, key: { kind: k.kind, identity: text(k.identity, "key.identity") }, reason: text(args.reason, "reason") };
    }, "opArgs");
    const dataArg = /* @__PURE__ */ __name(() => {
      const enc = args.encoding || "text";
      need(enc === "text" || enc === "base64", "encoding: text or base64");
      need(typeof args.data === "string" && args.data.length > 0 && args.data.length <= MAX_DATA, `data: 1 to ${MAX_DATA} characters`);
      if (enc === "base64") need(/^[A-Za-z0-9+/]*={0,2}$/.test(args.data) && args.data.length % 4 === 0, "data: not base64");
      return { data: args.data, encoding: enc };
    }, "dataArg");
    const nextItem = /* @__PURE__ */ __name(() => p.items.reduce((m, x) => Math.max(m, x.item), 0) + 1, "nextItem");
    switch (name) {
      case "plan_show":
        return this.shownToAgent(p);
      case "plan_target": {
        draft();
        const identity = identityArg(args.identity);
        if (identity === p.identity) return this.view(p);
        const old = p.room;
        p.identity = identity;
        p.room = roomOf(identity);
        await this.save(p);
        await ROOM_STUB(this.env, old).withdraw(p.id, "moved to another identity");
        return { ...this.view(p), ...await this.mirror(p) };
      }
      case "plan_add":
      case "plan_hold": {
        draft();
        need(p.items.length < MAX_ITEMS, `a plan holds up to ${MAX_ITEMS} items`);
        const it = { item: nextItem(), ...opArgs(), ...name === "plan_add" ? dataArg() : { data: null, held: true } };
        p.items.push(it);
        await this.save(p);
        await this.mirror(p);
        return { item: it.item, ...this.view(p) };
      }
      case "plan_remove": {
        draft();
        const it = itemOf(args.item);
        p.items = p.items.filter((x) => x !== it);
        await this.save(p);
        await this.mirror(p);
        return this.view(p);
      }
      case "plan_submit": {
        draft();
        need(p.items.length > 0, "an empty plan: add an item first");
        const r = await ROOM_STUB(this.env, p.room).submit(this.shown({ ...p, state: "submitted" }, me));
        need(r.ok, r.why);
        p.state = "submitted";
        await this.save(p);
        return this.view(p);
      }
      case "plan_fill": {
        need(p.state === "running" || p.state === "paused", `the plan is ${p.state}: a placeholder is filled while it runs`);
        const it = itemOf(args.item);
        need(it.held && it.data === null, `item ${it.item} is not a placeholder waiting for its data`);
        Object.assign(it, dataArg());
        await this.save(p);
        const r = await ROOM_STUB(this.env, p.room).fill(p.id, it.item, { data: it.data, encoding: it.encoding });
        need(r.ok, r.why);
        return this.view(p);
      }
      case "plan_finish": {
        need(["submitted", "running", "paused"].includes(p.state), `the plan is ${p.state}: nothing to finish`);
        const r = await ROOM_STUB(this.env, p.room).finish(p.id);
        need(r.ok, r.why);
        p.finishing = true;
        await this.save(p);
        return this.view(p);
      }
      case "plan_wait": {
        const seconds = Math.max(0, Math.min(WAIT_MAX_S, Number(args.seconds) || 30));
        const end = Date.now() + seconds * 1e3;
        for (; ; ) {
          const now = await this.plan(p.id);
          if (now.version !== now.seen || ["done", "declined", "failed", "ended"].includes(now.state) || Date.now() >= end) return this.shownToAgent(now);
          await new Promise((resolve) => {
            const t = setTimeout(resolve, end - Date.now());
            this.waiters.push(() => {
              clearTimeout(t);
              resolve();
            });
          });
        }
      }
      default:
        throw new Refused(`no tool ${name}`);
    }
  }
  /* what the agent reads: the plan, its results, and the placeholders still waiting for data */
  view(p) {
    return {
      plan_id: p.id,
      title: p.title,
      identity: p.identity,
      state: p.state,
      why: p.why || null,
      items: p.items.map(({ item, op, key, reason, held, data }) => ({ item, op, key, reason, ...held ? { placeholder: true, filled: data !== null } : {} })),
      results: p.results,
      waiting: p.items.filter((x) => x.held && x.data === null).map((x) => x.item),
      receipts: p.receipts
    };
  }
  /**
   * What the owner did, from their room (index.js, an owner device's mcp-re): the plan's state - declined, running,
   * paused (waiting for a placeholder), done, failed, ended - with results by item and the receipts. The room has
   * checked the plan is its own and the device joined; here the plan must be this agent's and past its draft.
   */
  async fromRoom(roomId, u) {
    const p = await this.plan(String(u.plan || ""));
    if (!p || p.room !== roomId || p.state === "draft") return { ok: false, why: "not a submitted plan of that identity" };
    if (u.state) {
      const STATES = ["declined", "running", "paused", "done", "failed", "ended"];
      if (!STATES.includes(u.state)) return { ok: false, why: `state: ${STATES.join(" | ")}` };
      p.state = u.state;
    }
    if (typeof u.why === "string") p.why = u.why.slice(0, MAX_TEXT);
    for (const r of Array.isArray(u.results) ? u.results : []) {
      if (!p.items.some((x) => x.item === r.item)) continue;
      const kept = {};
      for (const k of ["signature", "plaintext", "refusal", "encoding"]) if (typeof r[k] === "string") kept[k] = r[k].slice(0, MAX_DATA);
      p.results[r.item] = kept;
    }
    if (Array.isArray(u.receipts)) p.receipts = u.receipts.slice(0, 256).map((x) => typeof x === "object" && x ? { seq: Number(x.seq), code: String(x.code || "").slice(0, 40) } : null).filter(Boolean);
    await this.save(p, { byAgent: false });
    return { ok: true };
  }
};

// mcp-server/src/index.js
var { room } = import_bucket2.default;
var ROOM_PATH = /^\/ws\/([0-9a-f]{32})$/;
var AGENT_STATES = ["accepted", "blocked", "removed"];
var MAX_FRAME = 4 * 1024 * 1024;
var JOIN_WITHIN_MS = 3e4;
var SEALED_MAX_IDS = 2e3;
var SEALED_MAX_BLOB = 1024 * 1024;
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") return handleMcp(request, env);
    const m = ROOM_PATH.exec(url.pathname);
    if (!m) return env.ASSETS.fetch(request);
    if (request.headers.get("Upgrade") !== "websocket") return new Response("a websocket only", { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
  }
};
var send = /* @__PURE__ */ __name((ws, msg) => {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
  }
}, "send");
var IdentityRoom = class extends DurableObject2 {
  static {
    __name(this, "IdentityRoom");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }
  /* one connection: accept it, give it this connection's challenge, and give it JOIN_WITHIN_MS to answer */
  async fetch(request) {
    const url = new URL(request.url);
    const [client, server] = Object.values(new WebSocketPair());
    const { nonce, message } = room.challenge((n) => crypto.getRandomValues(new Uint8Array(n)));
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ room: ROOM_PATH.exec(url.pathname)[1], host: url.host, nonce: import_bytes2.default.toHex(nonce), device: null, since: Date.now() });
    send(server, message);
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + JOIN_WITHIN_MS);
    return new Response(null, { status: 101, webSocket: client });
  }
  /*
   * The devices that have joined: [socket, attachment], ONE per device - its newest socket. A replaced socket is still
   * listed by getWebSockets until its close completes, and changing its attachment once it closes does not hold, so the
   * room decides by device: the latest join of a device id is that device.
   */
  joined() {
    const newest = /* @__PURE__ */ new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || !a.device) continue;
      const have = newest.get(a.device.id);
      if (!have || a.joinedAt > have[1].joinedAt) newest.set(a.device.id, [ws, a]);
    }
    return [...newest.values()];
  }
  async webSocketMessage(ws, data) {
    if (typeof data !== "string" || data.length > MAX_FRAME) return ws.close(1009, "text frames up to 4 MiB");
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return ws.close(1007, "not JSON");
    }
    const me = ws.deserializeAttachment();
    if (!me.device) {
      const check = room.checkJoin(me.room, msg, { nonce: import_bytes2.default.fromHex(me.nonce), host: me.host });
      if (!check.ok) {
        send(ws, { t: "refused" });
        return ws.close(4401, "refused");
      }
      const old = this.joined().find(([, a]) => a.device.id === check.device.id);
      const peers = this.joined().filter(([, a]) => a.device.id !== check.device.id).map(([, a]) => a.device);
      ws.serializeAttachment({ ...me, device: check.device, nonce: null, joinedAt: Date.now() });
      if (old) {
        old[0].close(4409, "replaced");
        return send(ws, { t: "joined", you: check.device.id, peers });
      }
      send(ws, { t: "joined", you: check.device.id, peers });
      for (const [other] of this.joined()) if (other !== ws) send(other, { t: "peer", up: check.device });
      return;
    }
    switch (msg && msg.t) {
      case "frame": {
        if (typeof msg.to !== "string" || typeof msg.body !== "string") return send(ws, { t: "error", why: "a frame is {to, body}" });
        const to = this.joined().find(([, a]) => a.device.id === msg.to);
        if (!to) return send(ws, { t: "gone", to: msg.to });
        return send(to[0], { t: "frame", from: me.device.id, body: msg.body });
      }
      case "peers":
        return send(ws, { t: "peers", peers: this.joined().filter(([s]) => s !== ws).map(([, a]) => a.device) });
      case "mcp-re": {
        const r = await this.fromOwner(me.room, msg);
        return send(ws, msg.re !== void 0 ? { ...r, re: msg.re } : r);
      }
      case "sealed":
        return send(ws, { t: "sealed", re: msg.re, ...this.sealedOp(me.room, msg) });
      default:
        return send(ws, { t: "error", why: `unknown message ${JSON.stringify(msg && msg.t)}` });
    }
  }
  /* ------------------------------------------------------------------ the sealed copy (bucket/src/sealedcopy.js) */
  /*
   * THE IDENTITY'S SEALED COPY, IN THIS ROOM'S SQLITE (Phase 3; Brad, 2026-10-29: "the server's sealed copy will have a
   * hash table for changes"; the room's own SQLite, one row per unit). Rows the server cannot read: a keyed id, a keyed
   * change tag, a sealed unit - written and read only by the identity's own joined devices (this is past the join). Kept
   * only for identities this server is set to keep (SEALED_IDENTITIES: their ids, comma-separated, or * for all): any
   * other gets an empty table and a refused put.
   */
  sealedOn(identity) {
    const list = String(this.env.SEALED_IDENTITIES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return list.includes("*") || list.includes(String(identity).toLowerCase());
  }
  sealedSql() {
    const sql = this.ctx.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS sealed (id TEXT PRIMARY KEY, tag TEXT NOT NULL, blob TEXT NOT NULL, at INTEGER NOT NULL)");
    return sql;
  }
  sealedOp(identity, msg) {
    if (!this.sealedOn(identity)) return msg.op === "table" ? { on: false, rows: {} } : { ok: false, why: "this server keeps no sealed copy for this identity" };
    const sql = this.sealedSql();
    const HEX = /^[0-9a-f]{32}$/;
    if (msg.op === "table") {
      const rows = {};
      for (const r of sql.exec("SELECT id, tag FROM sealed").toArray()) rows[r.id] = r.tag;
      return { on: true, rows };
    }
    if (msg.op === "get") {
      const ids = Array.isArray(msg.ids) ? msg.ids.filter((id) => typeof id === "string" && HEX.test(id)).slice(0, SEALED_MAX_IDS) : [];
      const rows = {};
      for (const id of ids) {
        const r = sql.exec("SELECT blob FROM sealed WHERE id = ?", id).toArray()[0];
        if (r) rows[id] = r.blob;
      }
      return { rows };
    }
    if (msg.op === "put") {
      const entries = Object.entries(msg.rows && typeof msg.rows === "object" ? msg.rows : {});
      if (entries.length > SEALED_MAX_IDS) return { ok: false, why: `at most ${SEALED_MAX_IDS} rows a put` };
      for (const [id, r] of entries) {
        if (!HEX.test(id) || !r || typeof r.tag !== "string" || !HEX.test(r.tag) || typeof r.blob !== "string" || r.blob.length > SEALED_MAX_BLOB) {
          return { ok: false, why: `row ${String(id).slice(0, 12)}: an id and a tag of 32 hex, a blob up to ${SEALED_MAX_BLOB} characters` };
        }
      }
      const now = Date.now();
      for (const [id, r] of entries) sql.exec("INSERT INTO sealed (id, tag, blob, at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tag = excluded.tag, blob = excluded.blob, at = excluded.at", id, r.tag, r.blob, now);
      return { ok: true, n: entries.length };
    }
    return { ok: false, why: `no sealed ${JSON.stringify(msg.op)}` };
  }
  async webSocketClose(ws) {
    this.left(ws);
  }
  async webSocketError(ws) {
    this.left(ws);
  }
  /* a joined device left: the others hear it - unless this was a replaced socket and a newer one holds the device */
  left(ws) {
    const a = ws.deserializeAttachment();
    if (!a || !a.device) return;
    const others = this.joined().filter(([s]) => s !== ws);
    if (others.some(([, b]) => b.device.id === a.device.id)) return;
    for (const [other] of others) send(other, { t: "peer", down: a.device.id });
  }
  /* ------------------------------------------------------------------ the agents and their plans (mcp.js) */
  /* to every joined device of this identity - the owner's web app, phone, desktop */
  tell(msg) {
    for (const [ws] of this.joined()) send(ws, { t: "mcp", ...msg });
  }
  async agentOf(id) {
    return this.ctx.storage.get(`agent:${id}`);
  }
  async plans() {
    return [...(await this.ctx.storage.list({ prefix: "plan:" })).values()];
  }
  /*
   * An agent's plan, shown (new or changed): the agent is entered as pending the first time it targets this identity,
   * so the owner sees who asks before anything can be submitted. A blocked agent's plans are not shown.
   */
  async show(plan) {
    let a = await this.agentOf(plan.agent.id);
    if (!a) {
      a = { id: plan.agent.id, name: plan.agent.name, state: "pending", first: Date.now() };
      await this.ctx.storage.put(`agent:${a.id}`, a);
      this.tell({ ev: "agent", agent: a });
    } else if (a.name !== plan.agent.name) {
      a = { ...a, name: plan.agent.name };
      await this.ctx.storage.put(`agent:${a.id}`, a);
    }
    a = { ...a, last: Date.now() };
    await this.ctx.storage.put(`agent:${a.id}`, a);
    if (a.state === "blocked") return { agent_state: a.state, owner_online: this.joined().length > 0, shown: false };
    await this.ctx.storage.put(`plan:${plan.id}`, plan);
    this.tell({ ev: "plan", plan });
    return { agent_state: a.state, owner_online: this.joined().length > 0, shown: true };
  }
  async withdraw(planId, why) {
    if (!await this.ctx.storage.get(`plan:${planId}`)) return;
    await this.ctx.storage.delete(`plan:${planId}`);
    this.tell({ ev: "plan-gone", plan: planId, why });
  }
  /* status, for the agent: its state here (unknown until it targets a plan here) and whether an owner is online */
  async agentStatus(me) {
    const a = await this.agentOf(me.id);
    return { agent_state: a ? a.state : "unknown", owner_online: this.joined().length > 0 };
  }
  /* submit: only an accepted agent, only with an owner device online to approve it - the web app runs it from here */
  async submit(plan) {
    const a = await this.agentOf(plan.agent.id);
    if (!a || a.state !== "accepted") {
      return { ok: false, why: `the owner has not accepted you yet (${a ? a.state : "unknown"}): they see your plan in their web app and accept you there` };
    }
    if (!this.joined().length) return { ok: false, why: "no owner device is online to approve it - try again when the owner has the web app open" };
    await this.ctx.storage.put(`plan:${plan.id}`, plan);
    this.tell({ ev: "submit", plan });
    return { ok: true };
  }
  async fill(planId, item, data) {
    const plan = await this.ctx.storage.get(`plan:${planId}`);
    if (!plan || !["running", "paused"].includes(plan.state)) return { ok: false, why: "the plan is not running here" };
    if (!this.joined().length) return { ok: false, why: "no owner device is online" };
    const it = plan.items.find((x) => x.item === item);
    if (it) Object.assign(it, data);
    await this.ctx.storage.put(`plan:${planId}`, plan);
    this.tell({ ev: "fill", plan: planId, item, ...data });
    return { ok: true };
  }
  async finish(planId) {
    const plan = await this.ctx.storage.get(`plan:${planId}`);
    if (!plan) return { ok: false, why: "the plan is not here" };
    if (!this.joined().length) return { ok: false, why: "no owner device is online to end its budget" };
    this.tell({ ev: "finish", plan: planId });
    return { ok: true };
  }
  /*
   * An owner device's answer ({t:'mcp-re', op}): the agents (list, accept, block, remove), or a plan's progress, which
   * goes on to the agent. Only a joined device gets here (webSocketMessage) - the identity's own key proved it.
   */
  async fromOwner(roomId, msg) {
    if (msg.op === "agents") return { t: "mcp", ev: "agents", agents: [...(await this.ctx.storage.list({ prefix: "agent:" })).values()], plans: await this.plans() };
    if (msg.op === "agent") {
      if (!AGENT_STATES.includes(msg.state)) return { t: "error", why: `an agent is ${AGENT_STATES.join(" | ")}` };
      const a = await this.agentOf(String(msg.agent || ""));
      if (!a) return { t: "error", why: "no such agent here" };
      if (msg.state === "removed") await this.ctx.storage.delete(`agent:${a.id}`);
      else await this.ctx.storage.put(`agent:${a.id}`, { ...a, state: msg.state });
      if (msg.state !== "accepted") {
        for (const p of await this.plans()) {
          if (p.agent.id === a.id && !["running", "paused"].includes(p.state)) await this.withdraw(p.id, `agent ${msg.state}`);
        }
      }
      this.tell({ ev: "agent", agent: { ...a, state: msg.state } });
      return { t: "mcp", ev: "ok", op: "agent" };
    }
    if (msg.op === "plan") {
      const plan = await this.ctx.storage.get(`plan:${String(msg.plan || "")}`);
      if (!plan) return { t: "error", why: "no such plan here" };
      const r = await this.env.AGENTS.get(this.env.AGENTS.idFromName(plan.agent.id)).fromRoom(roomId, msg);
      if (!r.ok) return { t: "error", why: r.why };
      if (msg.state) plan.state = msg.state;
      for (const x of Array.isArray(msg.results) ? msg.results : []) plan.results = { ...plan.results, [x.item]: x };
      await this.ctx.storage.put(`plan:${plan.id}`, plan);
      this.tell({ ev: "plan", plan });
      return { t: "mcp", ev: "ok", op: "plan" };
    }
    return { t: "error", why: `unknown mcp-re op ${JSON.stringify(msg.op)}` };
  }
  /* close the sockets that never joined in time; come back while any are still waiting */
  async alarm() {
    const now = Date.now();
    let waiting = false;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || a.device) continue;
      if (now - a.since >= JOIN_WITHIN_MS) ws.close(4408, "no join in time");
      else waiting = true;
    }
    if (waiting) await this.ctx.storage.setAlarm(now + JOIN_WITHIN_MS);
  }
};
export {
  AgentSession,
  IdentityRoom,
  McpSession,
  index_default as default
};
/*! Bundled license information:

@noble/ciphers/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/edwards.js:
@noble/curves/abstract/montgomery.js:
@noble/curves/abstract/oprf.js:
@noble/curves/ed25519.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=index.js.map
