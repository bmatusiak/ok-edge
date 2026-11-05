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

// node-built-in-modules:events
import libDefault from "events";
var require_events = __commonJS({
  "node-built-in-modules:events"(exports, module) {
    module.exports = libDefault;
  }
});

// node_modules/@bmatusiak/rectify/plugin-base.js
var require_plugin_base = __commonJS({
  "node_modules/@bmatusiak/rectify/plugin-base.js"(exports, module) {
    function objHas(obj, name) {
      return Object.prototype.hasOwnProperty.call(obj, name);
    }
    __name(objHas, "objHas");
    function setup3(imports, register) {
      var app2 = imports.app;
      var EventEmitter = app2.EventEmitter;
      var started = null;
      var waiting = [];
      app2.on("ready", function(readyApp) {
        started = readyApp;
        waiting.splice(0).forEach(function(plugin) {
          plugin.announce("ready", readyApp);
        });
      });
      function Plugin(name) {
        var events = new EventEmitter();
        var disposers = [];
        var sticky = {};
        var unloaded = false;
        var disabled = false;
        var self = this;
        this.name = name || "";
        this.announce = function(type, data) {
          sticky[type] = data;
          events.emit(type, data);
          return self;
        };
        this.emit = function(type, data) {
          events.emit(type, data);
          return self;
        };
        this.on = function(type, listener) {
          if (objHas(sticky, type)) {
            listener(sticky[type]);
          }
          events.on(type, listener);
          return self;
        };
        this.once = function(type, listener) {
          if (objHas(sticky, type)) {
            return listener(sticky[type]);
          }
          events.once(type, listener);
          return self;
        };
        this.off = function(type, listener) {
          events.removeListener(type, listener);
          return self;
        };
        this.own = function(disposer) {
          if (typeof disposer != "function") {
            throw new Error("own() takes a function to undo something: " + self.name);
          }
          disposers.push(disposer);
          return self;
        };
        this.unload = async function(reason) {
          if (unloaded) {
            return;
          }
          unloaded = true;
          while (disposers.length) {
            try {
              await disposers.pop()();
            } catch (err) {
              app2.emit("error", err);
            }
          }
          events.emit("unload", reason);
        };
        this.unloaded = function() {
          return unloaded;
        };
        this.disable = function(reason) {
          if (disabled) {
            return self;
          }
          disabled = true;
          events.emit("disable", reason);
          return self;
        };
        this.enable = function(reason) {
          if (!disabled) {
            return self;
          }
          disabled = false;
          events.emit("enable", reason);
          return self;
        };
        this.disabled = function() {
          return disabled;
        };
        this.api = function(surface) {
          Object.keys(surface).forEach(function(key) {
            Object.defineProperty(self, key, Object.getOwnPropertyDescriptor(surface, key));
          });
          Object.freeze(self);
          return self;
        };
        if (started) {
          this.announce("ready", started);
        } else {
          waiting.push(this);
        }
        made.push(this);
      }
      __name(Plugin, "Plugin");
      var made = [];
      var listed = [];
      app2.on("service", function(name, service) {
        if (made.indexOf(service) !== -1) {
          listed.push({ name, plugin: service });
        }
      });
      var ext = {
        get plugins() {
          return listed.map(function(entry) {
            return entry.plugin;
          });
        },
        // By the name the service was registered under, not the name the
        // instance was given -- that is the one everything else refers to.
        get named() {
          var byName = {};
          listed.forEach(function(entry) {
            byName[entry.name] = entry.plugin;
          });
          return byName;
        },
        get: /* @__PURE__ */ __name(function(name) {
          return ext.named[name];
        }, "get"),
        // From the graph Rectify built to sort the load, so this answers for
        // every plugin in the app -- not only the ones built on Plugin.
        // Frozen { name, provides, consumes } records; .map(e => e.name) if
        // that is all you wanted.
        dependents: /* @__PURE__ */ __name(function(service) {
          return app2.plugins.filter(function(entry) {
            return entry.consumes.indexOf(service) !== -1;
          });
        }, "dependents"),
        // Reverse order, so a consumer lets go before what it consumed. Safe to
        // call after app.destroy(), which will have unloaded most of these
        // already -- unload happens once however often it is asked for.
        unloadAll: /* @__PURE__ */ __name(async function(reason) {
          var order = ext.plugins.reverse();
          for (var i = 0; i < order.length; i++) {
            await order[i].unload(reason);
          }
        }, "unloadAll")
      };
      register(null, {
        Plugin,
        ext
      });
    }
    __name(setup3, "setup");
    setup3.consumes = ["app"];
    setup3.provides = ["Plugin", "ext"];
    module.exports = setup3;
  }
});

// node_modules/@bmatusiak/rectify/index.js
var require_rectify = __commonJS({
  "node_modules/@bmatusiak/rectify/index.js"(exports, module) {
    var isBrowserEnv = typeof window != "undefined" && typeof window.document != "undefined" ? 1 : 0;
    var events = require_events();
    var EventEmitter = events.EventEmitter;
    function objHas(obj, name) {
      return Object.prototype.hasOwnProperty.call(obj, name);
    }
    __name(objHas, "objHas");
    var GENERIC = ["setup", "plugin", "main", "default", ""];
    function describe(plugin, setup3, provides, consumes, index) {
      if (plugin && plugin.packagePath) {
        return plugin.packagePath;
      }
      var name = setup3 && setup3.name || typeof plugin == "function" && plugin.name || "";
      if (GENERIC.indexOf(name) === -1) {
        return name;
      }
      if (provides && provides.length) {
        return "the plugin providing [" + provides.join(", ") + "]";
      }
      if (consumes && consumes.length) {
        return "the plugin at config index " + index + " consuming [" + consumes.join(", ") + "]";
      }
      return "the plugin at config index " + index;
    }
    __name(describe, "describe");
    function checkConfig(config) {
      var normalized = config.map(function(plugin, index) {
        var setup3 = null;
        if (plugin && objHas(plugin, "setup")) {
          setup3 = plugin.setup;
        } else if (typeof plugin == "function") {
          setup3 = plugin;
        } else if (plugin && typeof plugin.default == "function") {
          setup3 = plugin.default;
        }
        var provides = plugin && objHas(plugin, "provides") ? plugin.provides : setup3 && setup3.provides;
        var consumes = plugin && objHas(plugin, "consumes") ? plugin.consumes : setup3 && setup3.consumes;
        var name = describe(plugin, setup3, provides, consumes, index);
        if (typeof setup3 != "function") {
          throw new Error("Plugin is missing the setup function: " + name);
        }
        if (!Array.isArray(provides)) {
          throw new Error("Plugin is missing the provides array: " + name);
        }
        if (!Array.isArray(consumes)) {
          throw new Error("Plugin is missing the consumes array: " + name);
        }
        var allowed = plugin && objHas(plugin, "allowed") ? plugin.allowed : objHas(setup3, "allowed") ? setup3.allowed : null;
        return {
          name,
          plugin,
          // what the caller passed, emitted as "plugin"
          setup: setup3,
          provides,
          consumes,
          allowed,
          config: plugin && plugin.config || setup3.config || null
        };
      });
      var providers = {};
      normalized.forEach(function(entry) {
        entry.provides.forEach(function(name) {
          if (name === "app") {
            throw new Error(`Plugin cannot provide "app", that service is Rectify's own: ` + entry.name);
          }
          if (objHas(providers, name)) {
            throw new Error("Service " + name + " is provided by two plugins: " + providers[name] + " and " + entry.name);
          }
          providers[name] = entry.name;
        });
      });
      checkAllowed(normalized);
      return checkCycles(normalized);
    }
    __name(checkConfig, "checkConfig");
    function asSet(names) {
      return names.filter(function(name, i) {
        return names.indexOf(name) === i;
      }).sort().join(",");
    }
    __name(asSet, "asSet");
    function allowedGroups(allowed, name) {
      if (!Array.isArray(allowed)) {
        throw new Error("Plugin allowed must be an array of service names: " + name);
      }
      if (!allowed.length) {
        return [];
      }
      var grouped = allowed.filter(Array.isArray).length;
      if (grouped && grouped !== allowed.length) {
        throw new Error("Plugin allowed must be either names or groups of names, not both: " + name);
      }
      var groups = grouped ? allowed : [allowed];
      groups.forEach(function(group) {
        if (!group.length) {
          throw new Error("Plugin allowed has an empty group, which nothing can match: " + name);
        }
        group.forEach(function(service) {
          if (typeof service != "string") {
            throw new Error("Plugin allowed must contain service names: " + name);
          }
        });
      });
      return groups;
    }
    __name(allowedGroups, "allowedGroups");
    function checkAllowed(normalized) {
      normalized.forEach(function(entry) {
        if (entry.allowed === null || entry.allowed === void 0) {
          return;
        }
        var groups = allowedGroups(entry.allowed, entry.name);
        if (!entry.provides.length) {
          throw new Error("Plugin declares allowed but provides nothing to restrict: " + entry.name);
        }
        var permitted = groups.map(asSet);
        var shapes = groups.map(function(group) {
          return "[" + group.join(", ") + "]";
        }).join(" or ");
        normalized.forEach(function(consumer) {
          if (consumer === entry) {
            return;
          }
          entry.provides.forEach(function(service) {
            if (consumer.consumes.indexOf(service) === -1) {
              return;
            }
            if (consumer.provides.length && permitted.indexOf(asSet(consumer.provides)) !== -1) {
              return;
            }
            throw new Error("Plugin " + entry.name + " allows " + (groups.length ? "only " + shapes : "nothing") + ' to consume "' + service + '", but ' + consumer.name + " consumes it and provides " + (consumer.provides.length ? "[" + consumer.provides.join(", ") + "]" : "nothing"));
          });
        });
      });
    }
    __name(checkAllowed, "checkAllowed");
    function checkCycles(normalized) {
      var plugins = normalized.map(function(entry, index) {
        return {
          name: entry.name,
          provides: entry.provides.concat(),
          consumes: entry.consumes.concat(),
          i: index
        };
      });
      var resolved = {
        app: true
      };
      var changed = true;
      var sorted = [];
      while (plugins.length && changed) {
        changed = false;
        plugins.concat().forEach(function(plugin) {
          var consumes = plugin.consumes.concat();
          var resolvedAll = true;
          for (var i = 0; i < consumes.length; i++) {
            var service = consumes[i];
            if (!resolved[service]) {
              resolvedAll = false;
            } else {
              plugin.consumes.splice(plugin.consumes.indexOf(service), 1);
            }
          }
          if (!resolvedAll)
            return;
          plugins.splice(plugins.indexOf(plugin), 1);
          plugin.provides.forEach(function(service2) {
            resolved[service2] = true;
          });
          sorted.push(normalized[plugin.i]);
          changed = true;
        });
      }
      if (plugins.length) {
        var unresolved = {};
        plugins.forEach(function(plugin) {
          plugin.consumes.forEach(function(name) {
            if (unresolved[name] === false)
              return;
            if (!unresolved[name])
              unresolved[name] = [];
            unresolved[name].push(plugin.name);
          });
          plugin.provides.forEach(function(name) {
            unresolved[name] = false;
          });
        });
        Object.keys(unresolved).forEach(function(name) {
          if (unresolved[name] === false)
            delete unresolved[name];
        });
        var stuck = plugins.map(function(plugin) {
          return plugin.name;
        });
        console.error("Could not resolve dependencies of these plugins:", stuck);
        console.error("Resolved services:", Object.keys(resolved));
        console.error("Missing services:", unresolved);
        var wanted = Object.keys(unresolved).map(function(name) {
          return name + " (wanted by " + unresolved[name].join(", ") + ")";
        });
        throw new Error(wanted.length ? "Could not resolve dependencies, nothing provides: " + wanted.join("; ") : "Could not resolve dependencies of: " + stuck.join(", "));
      }
      return sorted;
    }
    __name(checkCycles, "checkCycles");
    var Rectify2 = class _Rectify extends EventEmitter {
      static {
        __name(this, "Rectify");
      }
      constructor(config, appArg) {
        super();
        var app2 = this;
        app2.config = config;
        app2.setMaxListeners(0);
        app2.loading = null;
        var services2 = app2.services = {
          app: {
            EventEmitter,
            isBrowser: _Rectify.isBrowser,
            isElectron: _Rectify.isElectron,
            isNode: _Rectify.isNode,
            isFork: _Rectify.isFork,
            isNWJS: _Rectify.isNWJS,
            isWorker: _Rectify.isWorker,
            window: typeof window == "undefined" ? global : window,
            on: /* @__PURE__ */ __name(function(name, callback) {
              if (typeof callback == "function") callback = callback.bind(app2);
              app2.on.apply(app2, [name, callback]);
            }, "on"),
            once: /* @__PURE__ */ __name(function(name, callback) {
              if (typeof callback == "function") callback = callback.bind(app2);
              app2.once.apply(app2, [name, callback]);
            }, "once"),
            emit: /* @__PURE__ */ __name(function() {
              app2.emit.apply(app2, arguments);
            }, "emit"),
            get services() {
              return app2.services;
            },
            get plugins() {
              return app2.plugins;
            }
          }
        };
        if (appArg && typeof appArg == "object")
          for (var i in appArg) {
            services2.app[i] = appArg[i];
          }
        else
          services2.app.arg = appArg;
        var sortedPlugins = checkConfig(config);
        app2.plugins = Object.freeze(sortedPlugins.map(function(entry) {
          return Object.freeze({
            name: entry.name,
            provides: Object.freeze(entry.provides.concat()),
            consumes: Object.freeze(entry.consumes.concat())
          });
        }));
        var restricted = {};
        function lookup(name) {
          return objHas(restricted, name) ? restricted[name] : services2[name];
        }
        __name(lookup, "lookup");
        var destructors = [];
        var startPromise = null;
        var settled = false;
        var stopStallHint = null;
        var destroying = null;
        app2.destroy = function() {
          if (!destroying) {
            destroying = (async function() {
              while (destructors.length) {
                try {
                  await destructors.pop()();
                } catch (err) {
                  report(err);
                }
              }
              app2.emit("destroy");
            })();
          }
          return destroying;
        };
        app2.start = function(event, callback) {
          if (typeof event == "function") {
            callback = event;
            event = null;
          }
          if (event) app2.$ = event;
          if (callback) app2.on("ready", callback);
          if (!startPromise) {
            var reported = app2.listenerCount("error") > 0;
            stopStallHint = watchForStall();
            startPromise = new Promise(function(resolve, reject) {
              loadNext(resolve, reject);
            });
            if (reported) {
              startPromise.catch(function() {
              });
            }
          }
          return startPromise;
        };
        function watchForStall() {
          if (typeof process == "undefined" || typeof process.on != "function") {
            return function() {
            };
          }
          function hint() {
            if (settled) return;
            console.error("Rectify: start() never finished" + (app2.loading ? " -- plugin " + app2.loading + " has not called register()" : ""));
          }
          __name(hint, "hint");
          process.on("beforeExit", hint);
          return function() {
            process.removeListener("beforeExit", hint);
          };
        }
        __name(watchForStall, "watchForStall");
        function settle() {
          settled = true;
          app2.loading = null;
          if (stopStallHint) stopStallHint();
        }
        __name(settle, "settle");
        function report(err) {
          try {
            app2.emit("error", err);
          } catch {
          }
        }
        __name(report, "report");
        function fail(err, reject) {
          if (settled) return;
          settle();
          Promise.resolve(app2.destroy()).catch(function() {
          }).then(function() {
            report(err);
            reject(err);
          });
        }
        __name(fail, "fail");
        async function loadNext(resolve, reject) {
          var entry = sortedPlugins.shift();
          if (!entry) {
            if (settled) return;
            settle();
            if (app2.$) services2.app.emit(app2.$, app2);
            app2.emit("ready", app2);
            return resolve(app2);
          }
          app2.loading = entry.name;
          var imports = {};
          entry.consumes.forEach(function(name) {
            imports[name] = lookup(name);
          });
          var $config = {};
          entry.provides.forEach(function(name) {
            $config[name] = Object.assign(
              {},
              entry.config && entry.config[name],
              config.config && config.config[name]
            );
          });
          var registered = false;
          try {
            await entry.setup(imports, register, $config);
          } catch (e) {
            return fail(e, reject);
          }
          function register(err, provided) {
            if (registered) {
              var again = new Error("Plugin called register() more than once: " + entry.name);
              if (settled) return report(again);
              return fail(again, reject);
            }
            registered = true;
            if (err) {
              return fail(err, reject);
            }
            provided = provided || {};
            var isRestricted = entry.allowed !== null && entry.allowed !== void 0;
            for (var i2 = 0; i2 < entry.provides.length; i2++) {
              var name = entry.provides[i2];
              if (!objHas(provided, name)) {
                return fail(new Error("Plugin failed to provide " + name + " service: " + entry.name), reject);
              }
              if (isRestricted) {
                restricted[name] = provided[name];
              } else {
                services2[name] = provided[name];
                app2.emit("service", name, services2[name]);
              }
            }
            if (objHas(provided, "onDestroy"))
              destructors.push(provided.onDestroy);
            app2.emit("plugin", entry.plugin);
            return loadNext(resolve, reject);
          }
          __name(register, "register");
        }
        __name(loadNext, "loadNext");
      }
    };
    if (typeof process !== "undefined") {
      const browserLike = process && process.__nwjs || process && process.versions && process.versions.electron;
      Rectify2.isBrowser = typeof window != "undefined" && typeof window.document != "undefined" ? 1 : 0;
      Rectify2.isNode = typeof process != "undefined" && !browserLike ? 1 : 0;
      Rectify2.isFork = typeof process != "undefined" && process.send ? 1 : 0;
      Rectify2.isNWJS = typeof process != "undefined" && process.__nwjs ? 1 : 0;
      Rectify2.isElectron = typeof process != "undefined" && process.versions && process.versions.electron ? 1 : 0;
      Rectify2.isWorker = typeof WorkerGlobalScope != "undefined" && globalThis instanceof WorkerGlobalScope ? 1 : 0;
    } else {
      Rectify2.isBrowser = isBrowserEnv;
      Rectify2.isNode = 0;
      Rectify2.isFork = 0;
      Rectify2.isNWJS = 0;
      Rectify2.isElectron = 0;
      Rectify2.isWorker = typeof WorkerGlobalScope != "undefined" && globalThis instanceof WorkerGlobalScope ? 1 : 0;
    }
    Rectify2.build = function(config, callback) {
      var app2;
      var isCallback = typeof callback == "function";
      try {
        app2 = new Rectify2(config, !isCallback && callback && typeof callback == "object" ? callback : null);
      } catch (err) {
        if (!isCallback) throw err;
        return callback(err, app2);
      }
      if (isCallback) {
        app2.on("error", done);
        app2.on("ready", onReady);
      }
      return app2;
      function onReady() {
        done();
      }
      __name(onReady, "onReady");
      function done(err) {
        app2.removeListener("error", done);
        app2.removeListener("ready", onReady);
        if (err) console.error(err);
        callback(err, app2);
      }
      __name(done, "done");
    };
    Rectify2.PluginBase = require_plugin_base();
    module.exports = Rectify2;
  }
});

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
function abool(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle(title) + "expected boolean, got type=" + typeof value);
  return value;
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
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
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
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
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
function checkOpts(defaults, opts2, title = "opts") {
  aopts(defaults, "defaults");
  if (opts2 !== void 0)
    aopts(opts2, title);
  const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts2);
  return merged;
}
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = /* @__PURE__ */ __name((msg, opts2) => hashCons(opts2).update(msg).digest(), "hashC");
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts2) => hashCons(opts2);
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
var atitle, aobject, aopts, isLE, swap32IfBE, hasHexBuiltin, hexes, oidNist;
var init_utils = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/utils.js"() {
    __name(isBytes, "isBytes");
    atitle = /* @__PURE__ */ __name((title) => title ? `"${title}" ` : "", "atitle");
    __name(anumber, "anumber");
    __name(abool, "abool");
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
    __name(u32, "u32");
    __name(clean, "clean");
    __name(createView, "createView");
    __name(rotr, "rotr");
    isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    __name(byteSwap, "byteSwap");
    __name(byteSwap32, "byteSwap32");
    swap32IfBE = isLE ? (u) => u : byteSwap32;
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
function setU64FromNum(view, byteOffset, n, isLE3) {
  const h = fromNumH(n);
  const l = fromNumL(n);
  view.setUint32(byteOffset, isLE3 ? l : h, isLE3);
  view.setUint32(byteOffset + 4, isLE3 ? h : l, isLE3);
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
      constructor(blockLen, outputLen, padOffset, isLE3) {
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE3;
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
        const { buffer, view, blockLen, isLE: isLE3 } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        buffer.fill(0, pos);
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          buffer.fill(0);
        }
        setU64FromNum(view, blockLen - 8, this.length * 8, isLE3);
        this.process(view, 0);
        this.roundClean();
        const oview = out === buffer ? view : createView(out);
        const len = this.outputLen;
        const outLen = len / 4;
        const state = this.get();
        if (len % 4 || outLen > state.length)
          throw new Error("invalid outputLen");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE3);
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
        const { A, B: B2, C, D: D2, E, F: F3, G, H } = this;
        return [A, B2, C, D2, E, F3, G, H];
      }
      // prettier-ignore
      set(A, B2, C, D2, E, F3, G, H) {
        this.A = A | 0;
        this.B = B2 | 0;
        this.C = C | 0;
        this.D = D2 | 0;
        this.E = E | 0;
        this.F = F3 | 0;
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
        let { A, B: B2, C, D: D2, E, F: F3, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
          const T1 = H + sigma1 + Chi(E, F3, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
          const T2 = sigma0 + Maj(A, B2, C) | 0;
          H = G;
          G = F3;
          F3 = E;
          E = D2 + T1 | 0;
          D2 = C;
          C = B2;
          B2 = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B2 = B2 + this.B | 0;
        C = C + this.C | 0;
        D2 = D2 + this.D | 0;
        E = E + this.E | 0;
        F3 = F3 + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B2, C, D2, E, F3, G, H);
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
var utils_exports = {};
__export(utils_exports, {
  aarray: () => aarray,
  abool: () => abool2,
  abytes: () => abytes2,
  aexists: () => aexists2,
  anumber: () => anumber2,
  aoutput: () => aoutput2,
  aoutput32: () => aoutput32,
  byteSwap: () => byteSwap2,
  byteSwap32: () => byteSwap322,
  bytesToHex: () => bytesToHex2,
  bytesToNumberBE: () => bytesToNumberBE,
  bytesToUtf8: () => bytesToUtf8,
  checkOpts: () => checkOpts2,
  clean: () => clean2,
  complexOverlapBytes: () => complexOverlapBytes,
  concatBytes: () => concatBytes2,
  copyBytes: () => copyBytes,
  createView: () => createView2,
  equalBytes: () => equalBytes,
  getOutput: () => getOutput,
  hexToBytes: () => hexToBytes2,
  hexToNumber: () => hexToNumber,
  isAligned32: () => isAligned32,
  isBytes: () => isBytes2,
  isLE: () => isLE2,
  managedNonce: () => managedNonce,
  numberToBytesBE: () => numberToBytesBE,
  overlapBytes: () => overlapBytes,
  randomBytes: () => randomBytes2,
  swap32IfBE: () => swap32IfBE2,
  swap8IfBE: () => swap8IfBE,
  u32: () => u322,
  u64Lengths: () => u64Lengths,
  u8: () => u8,
  utf8ToBytes: () => utf8ToBytes2,
  wrapCipher: () => wrapCipher,
  wrapMacConstructor: () => wrapMacConstructor
});
function aarray(item, title, inner = () => {
}) {
  if (!Array.isArray(item))
    throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
  for (let i = 0; i < item.length; i++)
    inner(item[i], `${title}[${i}]`);
  return item;
}
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function abool2(value, title = "") {
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
function u322(arr) {
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
function byteSwap2(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap322(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap2(arr[i]);
  }
  return arr;
}
function bytesToHex2(bytes3) {
  abytes2(bytes3);
  if (hasHexBuiltin2)
    return bytes3.toHex();
  let hex2 = "";
  for (let i = 0; i < bytes3.length; i++) {
    hex2 += hexes2[bytes3[i]];
  }
  return hex2;
}
function asciiToBase162(ch) {
  return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
}
function hexToBytes2(hex2) {
  if (typeof hex2 !== "string")
    throw new TypeError("hex string expected, got " + typeof hex2);
  if (hasHexBuiltin2) {
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
    const n1 = asciiToBase162(hex2.charCodeAt(hi));
    const n2 = asciiToBase162(hex2.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex2[hi] + hex2[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function hexToNumber(hex2) {
  if (typeof hex2 !== "string")
    throw new TypeError("hex string expected, got " + typeof hex2);
  return hex2 === "" ? _0n : BigInt("0x" + hex2);
}
function bytesToNumberBE(bytes3) {
  return hexToNumber(bytesToHex2(bytes3));
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!(_0n <= n))
      throw new RangeError("positive bigint expected, got " + n);
  } else
    anumber2(n);
  return n;
}
function numberToBytesBE(n, len) {
  anumber2(len);
  if (len === 0)
    throw new Error("zero output length is invalid");
  n = abignumber(n);
  const expectedLen = len * 2;
  const hex2 = n.toString(16);
  if (hex2.length > expectedLen)
    throw new RangeError("number is too large");
  return hexToBytes2(hex2.padStart(expectedLen, "0"));
}
function utf8ToBytes2(str) {
  if (typeof str !== "string")
    throw new TypeError("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function bytesToUtf8(bytes3) {
  return new TextDecoder().decode(bytes3);
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
function checkOpts2(defaults, opts2) {
  aobject2(defaults, "defaults");
  aobject2(opts2, "opts");
  const merged = Object.assign(defaults, opts2);
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
function u64Lengths(dataLength, aadLength, isLE3) {
  anumber2(dataLength);
  anumber2(aadLength);
  abool2(isLE3);
  const num = new Uint8Array(16);
  const view = createView2(num);
  view.setBigUint64(0, BigInt(aadLength), isLE3);
  view.setBigUint64(8, BigInt(dataLength), isLE3);
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
function managedNonce(fn, randomBytes_ = randomBytes2) {
  if (typeof fn !== "function")
    throw new TypeError('"fn" expected cipher constructor, got type=' + typeof fn);
  if (typeof randomBytes_ !== "function")
    throw new TypeError('"randomBytes_" expected function, got type=' + typeof randomBytes_);
  const { nonceLength } = fn;
  anumber2(nonceLength, "fn.nonceLength");
  const addNonce = /* @__PURE__ */ __name((nonce, ciphertext, plaintext) => {
    const out = concatBytes2(nonce, ciphertext);
    if (!overlapBytes(plaintext, ciphertext))
      ciphertext.fill(0);
    return out;
  }, "addNonce");
  const res = /* @__PURE__ */ __name(((key, ...args) => ({
    encrypt(plaintext) {
      abytes2(plaintext, void 0, "data");
      const nonce = randomBytes_(nonceLength);
      const encrypted = fn(key, nonce, ...args).encrypt(plaintext);
      if (encrypted instanceof Promise)
        return encrypted.then((ct) => addNonce(nonce, ct, plaintext));
      return addNonce(nonce, encrypted, plaintext);
    },
    decrypt(ciphertext) {
      abytes2(ciphertext, void 0, "data");
      const nonce = ciphertext.subarray(0, nonceLength);
      const decrypted = ciphertext.subarray(nonceLength);
      return fn(key, nonce, ...args).decrypt(decrypted);
    }
  })), "res");
  if ("blockSize" in fn)
    res.blockSize = fn.blockSize;
  if ("tagLength" in fn)
    res.tagLength = fn.tagLength;
  if ("withAAD" in fn)
    res.withAAD = fn.withAAD;
  return res;
}
var atitle2, aobject2, isLE2, swap8IfBE, swap32IfBE2, hasHexBuiltin2, hexes2, _0n, wrapCipher;
var init_utils2 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/ciphers/utils.js"() {
    __name(aarray, "aarray");
    __name(isBytes2, "isBytes");
    atitle2 = /* @__PURE__ */ __name((title) => title ? `"${title}" ` : "", "atitle");
    __name(abool2, "abool");
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
    __name(u322, "u32");
    __name(clean2, "clean");
    __name(createView2, "createView");
    isLE2 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    __name(byteSwap2, "byteSwap");
    swap8IfBE = isLE2 ? (n) => n : (n) => byteSwap2(n) >>> 0;
    __name(byteSwap322, "byteSwap32");
    swap32IfBE2 = isLE2 ? (u) => u : byteSwap322;
    hasHexBuiltin2 = /* @__PURE__ */ (() => (
      // @ts-ignore
      typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
    ))();
    hexes2 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    __name(bytesToHex2, "bytesToHex");
    __name(asciiToBase162, "asciiToBase16");
    __name(hexToBytes2, "hexToBytes");
    _0n = /* @__PURE__ */ BigInt(0);
    __name(hexToNumber, "hexToNumber");
    __name(bytesToNumberBE, "bytesToNumberBE");
    __name(abignumber, "abignumber");
    __name(numberToBytesBE, "numberToBytesBE");
    __name(utf8ToBytes2, "utf8ToBytes");
    __name(bytesToUtf8, "bytesToUtf8");
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
    __name(managedNonce, "managedNonce");
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
    ZEROS32 = /* @__PURE__ */ u322(ZEROS16);
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
        const b32 = u322(data);
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
        const o32 = u322(out);
        o32[0] = s0;
        o32[1] = s1;
        o32[2] = s2;
        o32[3] = s3;
        if (!isLE2)
          swap32IfBE2(o32.subarray(0, BLOCK_SIZE / 4));
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
        const b32 = u322(data);
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
        const o32 = u322(view);
        o32[0] = s0;
        o32[1] = s1;
        o32[2] = s2;
        o32[3] = s3;
        swap32IfBE2(o32);
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
  if (!isLE2 || !isAligned32(key))
    toClean.push(key = copyBytes(key));
  const k32 = swap32IfBE2(u322(key));
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
  const c32 = u322(ctr2);
  const src32 = u322(src);
  const dst32 = u322(dst);
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
    swap32IfBE2(b32);
    const buf = u8(b32);
    for (let i = start, pos = 0; i < srcLen; i++, pos++)
      dst[i] = src[i] ^ buf[pos];
    clean2(b32);
  }
  return dst;
}
function ctr32(xk, isLE3, nonce, src, dst) {
  abytes2(nonce, BLOCK_SIZE2, "nonce");
  abytes2(src);
  dst = getOutput(src.length, dst);
  const ctr2 = nonce;
  const c32 = u322(ctr2);
  const view = createView2(ctr2);
  const src32 = u322(src);
  const dst32 = u322(dst);
  const ctrPos = isLE3 ? 0 : 12;
  const srcLen = src.length;
  let ctrNum = view.getUint32(ctrPos, isLE3);
  for (let i = 0; i + 4 <= src32.length; i += 4) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    dst32[i + 0] = src32[i + 0] ^ swap8IfBE(s0);
    dst32[i + 1] = src32[i + 1] ^ swap8IfBE(s1);
    dst32[i + 2] = src32[i + 2] ^ swap8IfBE(s2);
    dst32[i + 3] = src32[i + 3] ^ swap8IfBE(s3);
    ctrNum = ctrNum + 1 >>> 0;
    view.setUint32(ctrPos, ctrNum, isLE3);
  }
  const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
  if (start < srcLen) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    const b32 = new Uint32Array([s0, s1, s2, s3]);
    swap32IfBE2(b32);
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
  if (!isLE2 || !isAligned32(plaintext))
    plaintext = copyBytes(plaintext);
  const o = u322(dst);
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
  const tmp32 = u322(tmp);
  tmp.set(left);
  const paddingByte = BLOCK_SIZE2 - left.length;
  for (let i = BLOCK_SIZE2 - paddingByte; i < BLOCK_SIZE2; i++)
    tmp[i] = paddingByte;
  return tmp32;
}
function computeTag(fn, isLE3, key, data, AAD) {
  const aadLength = AAD ? AAD.length : 0;
  const h = fn.create(key, data.length + aadLength);
  if (AAD)
    h.update(AAD);
  const num = u64Lengths(8 * data.length, 8 * aadLength, isLE3);
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
  const b32 = u322(block);
  swap32IfBE2(b32);
  let { s0, s1, s2, s3 } = encrypt(xk, b32[0], b32[1], b32[2], b32[3]);
  b32[0] = s0, b32[1] = s1, b32[2] = s2, b32[3] = s3;
  swap32IfBE2(b32);
  return block;
}
function decryptBlock(xk, block) {
  abytes2(block, 16, "block");
  if (!isBytes32(xk))
    throw new Error("_decryptBlock accepts result of expandKeyLE");
  const b32 = u322(block);
  swap32IfBE2(b32);
  let { s0, s1, s2, s3 } = decrypt(xk, b32[0], b32[1], b32[2], b32[3]);
  b32[0] = s0, b32[1] = s1, b32[2] = s2, b32[3] = s3;
  swap32IfBE2(b32);
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
    incBytes = /* @__PURE__ */ __name((data, isLE3, carry = 1) => {
      if (!Number.isSafeInteger(carry) || carry < 0 || carry > 4294967040)
        throw new Error("incBytes: wrong carry " + carry);
      abytes2(data);
      for (let i = 0; i < data.length; i++) {
        const pos = !isLE3 ? data.length - 1 - i : i;
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
    ecb = /* @__PURE__ */ wrapCipher({ blockSize: 16 }, /* @__PURE__ */ __name(function aesecb(key, opts2 = {}) {
      const pkcs5 = !opts2.disablePadding;
      return {
        encrypt(plaintext, dst) {
          const outLen = validateBlockEncrypt(plaintext, pkcs5, dst);
          const xk = expandKeyLE(key);
          const { b: input, o, out: _out } = prepareBlockEncrypt(plaintext, outLen, dst);
          const b = u322(input);
          swap32IfBE2(b);
          let i = 0;
          for (; i + 4 <= b.length; ) {
            const { s0, s1, s2, s3 } = encrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
          }
          if (pkcs5) {
            const tmp32 = padPCKS(plaintext.subarray(i * 4));
            swap32IfBE2(tmp32);
            const { s0, s1, s2, s3 } = encrypt(xk, tmp32[0], tmp32[1], tmp32[2], tmp32[3]);
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
            clean2(tmp32);
          }
          swap32IfBE2(o);
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
          if (!isLE2 || !isAligned32(ciphertext))
            toClean.push(ciphertext = copyBytes(ciphertext));
          const b = u322(ciphertext);
          const o = u322(dst);
          swap32IfBE2(b);
          for (let i = 0; i + 4 <= b.length; ) {
            const { s0, s1, s2, s3 } = decrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
          }
          swap32IfBE2(o);
          clean2(...toClean);
          return validatePKCS(dst, pkcs5);
        }
      };
    }, "aesecb"));
    cbc = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, /* @__PURE__ */ __name(function aescbc(key, iv, opts2 = {}) {
      const pkcs5 = !opts2.disablePadding;
      return {
        encrypt(plaintext, dst) {
          const outLen = validateBlockEncrypt(plaintext, pkcs5, dst);
          const xk = expandKeyLE(key);
          const { b: input, o, out: _out } = prepareBlockEncrypt(plaintext, outLen, dst);
          const b = u322(input);
          swap32IfBE2(b);
          let _iv = iv;
          const toClean = [xk];
          if (!isLE2 || !isAligned32(_iv))
            toClean.push(_iv = copyBytes(_iv));
          const n32 = u322(_iv);
          swap32IfBE2(n32);
          let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
          let i = 0;
          for (; i + 4 <= b.length; ) {
            s0 ^= b[i + 0], s1 ^= b[i + 1], s2 ^= b[i + 2], s3 ^= b[i + 3];
            ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
          }
          if (pkcs5) {
            const tmp32 = padPCKS(plaintext.subarray(i * 4));
            swap32IfBE2(tmp32);
            s0 ^= tmp32[0], s1 ^= tmp32[1], s2 ^= tmp32[2], s3 ^= tmp32[3];
            ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
            o[i++] = s0, o[i++] = s1, o[i++] = s2, o[i++] = s3;
            clean2(tmp32);
          }
          swap32IfBE2(o);
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
          if (!isLE2 || !isAligned32(_iv))
            toClean.push(_iv = copyBytes(_iv));
          const n32 = u322(_iv);
          swap32IfBE2(n32);
          if (!isLE2 || !isAligned32(ciphertext))
            toClean.push(ciphertext = copyBytes(ciphertext));
          const b = u322(ciphertext);
          const o = u322(dst);
          swap32IfBE2(b);
          let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
          for (let i = 0; i + 4 <= b.length; ) {
            const ps0 = s0, ps1 = s1, ps2 = s2, ps3 = s3;
            s0 = b[i + 0], s1 = b[i + 1], s2 = b[i + 2], s3 = b[i + 3];
            const { s0: o0, s1: o1, s2: o2, s3: o3 } = decrypt(xk, s0, s1, s2, s3);
            o[i++] = o0 ^ ps0, o[i++] = o1 ^ ps1, o[i++] = o2 ^ ps2, o[i++] = o3 ^ ps3;
          }
          swap32IfBE2(o);
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
        if (!isLE2 || !isAligned32(_iv))
          toClean.push(_iv = copyBytes(_iv));
        if (!isLE2 || !isAligned32(src))
          toClean.push(src = copyBytes(src));
        const src32 = u322(src);
        const dst32 = u322(dst);
        const next32 = isEncrypt ? dst32 : src32;
        const n32 = u322(_iv);
        swap32IfBE2(src32);
        swap32IfBE2(n32);
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
          if (!isLE2)
            swap32IfBE2(src32.subarray(start / 4));
          ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
          const tmp = new Uint32Array([s0, s1, s2, s3]);
          swap32IfBE2(tmp);
          const buf = u8(tmp);
          for (let i = start, pos = 0; i < srcLen; i++, pos++)
            dst[i] = src[i] ^ buf[pos];
          clean2(buf);
        }
        if (!isLE2)
          swap32IfBE2(dst32.subarray(0, start / 4));
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
        if (!isLE2 || !isAligned32(_nonce))
          toClean.push(_nonce = copyBytes(_nonce));
        const n32 = u322(_nonce);
        swap32IfBE2(n32);
        let s0 = 0, s1 = n32[0], s2 = n32[1], s3 = n32[2];
        let counter = 0;
        for (const derivedKey of [authKey, encKey].map(u322)) {
          const d32 = u322(derivedKey);
          for (let i = 0; i < d32.length; i += 2) {
            const { s0: o0, s1: o1 } = encrypt(xk, s0, s1, s2, s3);
            d32[i + 0] = o0;
            d32[i + 1] = o1;
            s0 = ++counter;
          }
          swap32IfBE2(d32);
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
        const t32 = u322(tag);
        swap32IfBE2(t32);
        let s0 = t32[0], s1 = t32[1], s2 = t32[2], s3 = t32[3];
        ({ s0, s1, s2, s3 } = encrypt(encKey, s0, s1, s2, s3));
        t32[0] = s0, t32[1] = s1, t32[2] = s2, t32[3] = s3;
        swap32IfBE2(t32);
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
          const o32 = u322(out);
          swap32IfBE2(o32);
          let a0 = o32[0], a1 = o32[1];
          for (let j = 0, ctr2 = 1; j < 6; j++) {
            for (let pos = 2; pos < o32.length; pos += 2, ctr2++) {
              const { s0, s1, s2, s3 } = encrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
              a0 = s0, a1 = s1 ^ byteSwap2(ctr2), o32[pos] = s2, o32[pos + 1] = s3;
            }
          }
          o32[0] = a0, o32[1] = a1;
          swap32IfBE2(o32);
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
          const o32 = u322(out);
          swap32IfBE2(o32);
          let a0 = o32[0], a1 = o32[1];
          for (let j = 0, ctr2 = chunks * 6; j < 6; j++) {
            for (let pos = chunks * 2; pos >= 1; pos -= 2, ctr2--) {
              a1 ^= byteSwap2(ctr2);
              const { s0, s1, s2, s3 } = decrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
              a0 = s0, a1 = s1, o32[pos] = s2, o32[pos + 1] = s3;
            }
          }
          o32[0] = a0, o32[1] = a1;
          swap32IfBE2(o32);
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
        const out32 = u322(out);
        out32[0] = swap8IfBE(AESKWP_IV);
        out32[1] = swap8IfBE(byteSwap2(plaintext.length));
        AESW.encrypt(kek, out);
        return out;
      },
      decrypt(ciphertext) {
        if (ciphertext.length < 16)
          throw new Error("invalid ciphertext length");
        const out = copyBytes(ciphertext);
        const o32 = u322(out);
        AESW.decrypt(kek, out);
        const len = byteSwap2(swap8IfBE(o32[1])) >>> 0;
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
        this.x32 = u322(this.x);
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
        swap32IfBE2(x32);
        const { s0, s1, s2, s3 } = encrypt(xk, x32[0], x32[1], x32[2], x32[3]);
        x32[0] = s0, x32[1] = s1, x32[2] = s2, x32[3] = s3;
        swap32IfBE2(x32);
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
    function utf8ToBytes3(text2) {
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
    __name(utf8ToBytes3, "utf8ToBytes");
    function bytesToUtf82(bytes3) {
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
    __name(bytesToUtf82, "bytesToUtf8");
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
      utf8ToBytes: utf8ToBytes3,
      bytesToUtf8: bytesToUtf82,
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
    var { utf8ToBytes: utf8ToBytes3, bytesToUtf8: bytesToUtf82, toBase64, fromBase64 } = require_bytes();
    var HKDF_INFO = utf8ToBytes3("onlyagent-vault-v1");
    var HKDF_SALT = new Uint8Array(32);
    var NONCE_BYTES = 12;
    var TAG_BYTES = 16;
    function deriveVaultKey(sharedSecret) {
      const ikm = Uint8Array.from(sharedSecret);
      if (!ikm.length) throw new Error("the shared secret is empty");
      return hkdf2(sha2562, ikm, HKDF_SALT, HKDF_INFO, 32);
    }
    __name(deriveVaultKey, "deriveVaultKey");
    function seal(key, plaintext, randomBytes5) {
      if (typeof randomBytes5 !== "function") {
        throw new TypeError("seal needs randomBytes (from the host plugin)");
      }
      const nonce = Uint8Array.from(randomBytes5(NONCE_BYTES));
      if (nonce.length !== NONCE_BYTES) {
        throw new Error(`the nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`);
      }
      const ct = gcm2(Uint8Array.from(key), nonce).encrypt(utf8ToBytes3(String(plaintext)));
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
      return bytesToUtf82(pt);
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
    function seal(bucket, key, randomBytes5, { keyVersion } = {}) {
      return canonical({ format: SEALED_FORMAT, v: VERSION, ...keyVersion ? { kv: keyVersion } : {}, owner: bucket.owner ?? null, blob: vault.seal(key, serialize(bucket), randomBytes5) });
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
            if (live(side)) for (const id2 of JSON.parse(side.v)) ids.add(id2);
          }
          const prefix = k.slice(0, -INDEX.length);
          const listed = [...ids].filter((id2) => {
            const rec = store[`${prefix}entries/${id2}`];
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
          const id2 = fromHex(ja.deviceId);
          const r = copyfile.merge(copyfile.fromJSON(ja, id2), copyfile.fromJSON(jb, id2));
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

// node_modules/node-onlykey-lib/src/crypto/ssh-pub.js
var require_ssh_pub = __commonJS({
  "node_modules/node-onlykey-lib/src/crypto/ssh-pub.js"(exports, module) {
    "use strict";
    var { utf8ToBytes: utf8ToBytes3, toBase64, concat } = require_bytes();
    var CURVES = {
      ed25519: { curve: "ed25519", sshName: "ssh-ed25519", keyType: 1 },
      nist256p1: { curve: "nist256p1", sshName: "ecdsa-sha2-nistp256", keyType: 2, sshCurve: "nistp256" }
    };
    var RSA_NAME = "ssh-rsa";
    var toBytes = /* @__PURE__ */ __name((v) => typeof v === "string" ? utf8ToBytes3(v) : Uint8Array.from(v), "toBytes");
    function uint32(n) {
      const v = n >>> 0;
      return Uint8Array.of(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
    }
    __name(uint32, "uint32");
    function string(v) {
      const bytes3 = toBytes(v);
      return concat([uint32(bytes3.length), bytes3]);
    }
    __name(string, "string");
    function mpint(magnitude) {
      let b = toBytes(magnitude);
      let i = 0;
      while (i < b.length && b[i] === 0) i += 1;
      b = b.subarray(i);
      if (b.length && b[0] & 128) b = concat([Uint8Array.of(0), b]);
      return string(b);
    }
    __name(mpint, "mpint");
    function curveInfo(curve) {
      const info = CURVES[curve];
      if (!info) throw new Error(`the SSH agent offers ${Object.keys(CURVES).join(" and ")}, not ${curve}`);
      return info;
    }
    __name(curveInfo, "curveInfo");
    function publicKeyBlob(curve, raw) {
      const info = curveInfo(curve);
      const key = toBytes(raw);
      if (info.keyType === 1) {
        if (key.length !== 32) throw new Error(`an Ed25519 public key is 32 bytes, not ${key.length}`);
        return concat([string(info.sshName), string(key)]);
      }
      if (key.length !== 64) throw new Error(`a P-256 public key from the device is X||Y, 64 bytes, not ${key.length}`);
      return concat([string(info.sshName), string(info.sshCurve), string(concat([Uint8Array.of(4), key]))]);
    }
    __name(publicKeyBlob, "publicKeyBlob");
    function line(type, blob, comment) {
      const head = `${type} ${toBase64(blob)}`;
      return comment === void 0 || comment === null || comment === "" ? head : `${head} ${comment}`;
    }
    __name(line, "line");
    function publicKeyLine(curve, raw, comment) {
      return line(curveInfo(curve).sshName, publicKeyBlob(curve, raw), comment);
    }
    __name(publicKeyLine, "publicKeyLine");
    function exponentBytes(e) {
      if (typeof e !== "number") return toBytes(e);
      if (!Number.isSafeInteger(e) || e < 3) throw new Error(`an RSA public exponent is an integer of at least 3, not ${e}`);
      const out = [];
      for (let v = e; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
      return Uint8Array.from(out);
    }
    __name(exponentBytes, "exponentBytes");
    function rsaPublicKeyBlob(modulus, { exponent = 65537 } = {}) {
      const n = toBytes(modulus);
      let first = 0;
      while (first < n.length && n[first] === 0) first += 1;
      if (first === n.length) throw new Error("an RSA modulus cannot be zero");
      if (!(n[n.length - 1] & 1)) throw new Error("an RSA modulus is odd; these bytes are not one");
      const e = exponentBytes(exponent);
      if (!e.some((b) => b !== 0)) throw new Error("an RSA public exponent cannot be zero");
      return concat([string(RSA_NAME), mpint(e), mpint(n)]);
    }
    __name(rsaPublicKeyBlob, "rsaPublicKeyBlob");
    function rsaPublicKeyLine(modulus, comment, opts2) {
      return line(RSA_NAME, rsaPublicKeyBlob(modulus, opts2), comment);
    }
    __name(rsaPublicKeyLine, "rsaPublicKeyLine");
    module.exports = {
      CURVES,
      RSA_NAME,
      uint32,
      string,
      mpint,
      curveInfo,
      publicKeyBlob,
      publicKeyLine,
      rsaPublicKeyBlob,
      rsaPublicKeyLine
    };
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/sha3.js
var sha3_exports = {};
__export(sha3_exports, {
  Keccak: () => Keccak,
  keccakP: () => keccakP,
  keccak_224: () => keccak_224,
  keccak_256: () => keccak_256,
  keccak_384: () => keccak_384,
  keccak_512: () => keccak_512,
  sha3_224: () => sha3_224,
  sha3_256: () => sha3_256,
  sha3_384: () => sha3_384,
  sha3_512: () => sha3_512,
  shake128: () => shake128,
  shake128_32: () => shake128_32,
  shake256: () => shake256,
  shake256_64: () => shake256_64
});
function keccakP(s, rounds = 24) {
  if (!(s instanceof Uint32Array))
    throw new TypeError('"s" expected Uint32Array(50), got type=' + typeof s);
  if (s.length !== 50)
    throw new RangeError('"s" expected Uint32Array(50), got length=' + s.length);
  anumber(rounds, "rounds");
  if (rounds < 1 || rounds > 24)
    throw new Error('"rounds" expected integer 1..24');
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
      s[y] ^= ~s[y + 2] & s[y + 4];
      s[y + 1] ^= ~s[y + 3] & s[y + 5];
      s[y + 2] ^= ~s[y + 4] & s[y + 6];
      s[y + 3] ^= ~s[y + 5] & s[y + 7];
      s[y + 4] ^= ~s[y + 6] & s[y + 8];
      s[y + 5] ^= ~s[y + 7] & s[y + 9];
      s[y + 6] ^= ~s[y + 8] & b0;
      s[y + 7] ^= ~s[y + 9] & b1;
      s[y + 8] ^= ~b0 & b2;
      s[y + 9] ^= ~b1 & b3;
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var _0n2, _1n, _2n, _7n, _256n, _0x71n, SHA3_PI, SHA3_ROTL, _SHA3_IOTA, IOTAS, SHA3_IOTA_H, SHA3_IOTA_L, rotlSH, rotlSL, rotlBH, rotlBL, rotlH, rotlL, B, Keccak, genKeccak, sha3_224, sha3_256, sha3_384, sha3_512, keccak_224, keccak_256, keccak_384, keccak_512, genShake, shake128, shake256, shake128_32, shake256_64;
var init_sha3 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/hashes/sha3.js"() {
    init_u64();
    init_utils();
    _0n2 = BigInt(0);
    _1n = BigInt(1);
    _2n = BigInt(2);
    _7n = BigInt(7);
    _256n = BigInt(256);
    _0x71n = BigInt(113);
    SHA3_PI = [];
    SHA3_ROTL = [];
    _SHA3_IOTA = [];
    for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI.push(2 * (5 * y + x));
      SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n2;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
        if (R & _2n)
          t ^= _1n << (_1n << BigInt(j)) - _1n;
      }
      _SHA3_IOTA.push(t);
    }
    IOTAS = split(_SHA3_IOTA, true);
    SHA3_IOTA_H = IOTAS[0];
    SHA3_IOTA_L = IOTAS[1];
    rotlSH = /* @__PURE__ */ __name((h, l, s) => h << s | l >>> 32 - s, "rotlSH");
    rotlSL = /* @__PURE__ */ __name((h, l, s) => l << s | h >>> 32 - s, "rotlSL");
    rotlBH = /* @__PURE__ */ __name((h, l, s) => l << s - 32 | h >>> 64 - s, "rotlBH");
    rotlBL = /* @__PURE__ */ __name((h, l, s) => h << s - 32 | l >>> 64 - s, "rotlBL");
    rotlH = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s), "rotlH");
    rotlL = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s), "rotlL");
    B = new Uint32Array(5 * 2);
    __name(keccakP, "keccakP");
    Keccak = class _Keccak {
      static {
        __name(this, "Keccak");
      }
      state;
      pos = 0;
      posOut = 0;
      finished = false;
      state32;
      destroyed = false;
      blockLen;
      suffix;
      outputLen;
      canXOF;
      enableXOF = false;
      rounds;
      // NOTE: we accept arguments in bytes instead of bits here.
      constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        anumber(blockLen, "blockLen");
        anumber(suffix, "suffix");
        anumber(rounds, "rounds");
        abool(enableXOF, "enableXOF");
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.canXOF = enableXOF;
        this.rounds = rounds;
        anumber(outputLen, "outputLen");
        if (!(0 < blockLen && blockLen < 200))
          throw new Error('"blockLen" must be 1..199');
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
      }
      clone() {
        return this._cloneInto();
      }
      keccak() {
        swap32IfBE(this.state32);
        keccakP(this.state32, this.rounds);
        swap32IfBE(this.state32);
        this.posOut = 0;
        this.pos = 0;
      }
      update(data) {
        aexists(this);
        abytes(data);
        const { blockLen, state, state32 } = this;
        const len = data.length;
        const canUseU32 = blockLen % 4 === 0 && data.byteOffset % 4 === 0;
        const blockLen32 = blockLen / 4;
        const data32 = canUseU32 && len >= blockLen ? u32(data) : void 0;
        for (let pos = 0; pos < len; ) {
          if (data32 !== void 0 && this.pos === 0 && pos % 4 === 0 && len - pos >= blockLen) {
            for (let i = 0, o = pos / 4; i < blockLen32; i++)
              state32[i] ^= data32[o + i];
            pos += blockLen;
            this.pos = blockLen;
            this.keccak();
            continue;
          }
          const take = Math.min(blockLen - this.pos, len - pos);
          for (let i = 0; i < take; i++)
            state[this.pos++] ^= data[pos++];
          if (this.pos === blockLen)
            this.keccak();
        }
        return this;
      }
      finish() {
        if (this.finished)
          return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 128) !== 0 && pos === blockLen - 1)
          this.keccak();
        state[blockLen - 1] ^= 128;
        this.keccak();
      }
      writeInto(out) {
        aexists(this, false);
        abytes(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len; ) {
          if (this.posOut >= blockLen)
            this.keccak();
          const take = Math.min(blockLen - this.posOut, len - pos);
          out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
          this.posOut += take;
          pos += take;
        }
        return out;
      }
      xofInto(out) {
        if (!this.enableXOF)
          throw new Error("XOF is not enabled");
        return this.writeInto(out);
      }
      xof(bytes3) {
        anumber(bytes3);
        return this.xofInto(new Uint8Array(bytes3));
      }
      digestInto(out) {
        aoutput(out, this);
        if (this.finished)
          throw new Error("digest() was already called");
        this.writeInto(out.length === this.outputLen ? out : out.subarray(0, this.outputLen));
        this.destroy();
      }
      digest() {
        const out = new Uint8Array(this.outputLen);
        this.digestInto(out);
        return out;
      }
      destroy() {
        this.destroyed = true;
        clean(this.state);
      }
      _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
        to.blockLen = blockLen;
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.canXOF = this.canXOF;
        to.destroyed = this.destroyed;
        return to;
      }
    };
    genKeccak = /* @__PURE__ */ __name((suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info), "genKeccak");
    sha3_224 = /* @__PURE__ */ genKeccak(
      6,
      144,
      28,
      /* @__PURE__ */ oidNist(7)
    );
    sha3_256 = /* @__PURE__ */ genKeccak(
      6,
      136,
      32,
      /* @__PURE__ */ oidNist(8)
    );
    sha3_384 = /* @__PURE__ */ genKeccak(
      6,
      104,
      48,
      /* @__PURE__ */ oidNist(9)
    );
    sha3_512 = /* @__PURE__ */ genKeccak(
      6,
      72,
      64,
      /* @__PURE__ */ oidNist(10)
    );
    keccak_224 = /* @__PURE__ */ genKeccak(1, 144, 28);
    keccak_256 = /* @__PURE__ */ genKeccak(1, 136, 32);
    keccak_384 = /* @__PURE__ */ genKeccak(1, 104, 48);
    keccak_512 = /* @__PURE__ */ genKeccak(1, 72, 64);
    genShake = /* @__PURE__ */ __name((suffix, blockLen, outputLen, info = {}) => createHasher((opts2 = {}) => {
      opts2 = checkOpts({}, opts2);
      return new Keccak(blockLen, suffix, opts2.dkLen === void 0 ? outputLen : opts2.dkLen, true);
    }, info), "genShake");
    shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist(11));
    shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist(12));
    shake128_32 = /* @__PURE__ */ genShake(31, 168, 32, /* @__PURE__ */ oidNist(11));
    shake256_64 = /* @__PURE__ */ genShake(31, 136, 64, /* @__PURE__ */ oidNist(12));
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/utils.js
function aarray2(item, title, inner = () => {
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
function abool3(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle3(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function abignumber2(n) {
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
function numberToHexUnpadded(num) {
  const hex2 = abignumber2(num).toString(16);
  return hex2.length & 1 ? "0" + hex2 : hex2;
}
function hexToNumber2(hex2) {
  if (typeof hex2 !== "string")
    throw new TypeError("hex string expected, got " + typeof hex2);
  return hex2 === "" ? _0n3 : BigInt("0x" + hex2);
}
function bytesToNumberBE2(bytes3) {
  return hexToNumber2(bytesToHex(bytes3));
}
function bytesToNumberLE(bytes3) {
  return hexToNumber2(bytesToHex(copyBytes2(abytes(bytes3)).reverse()));
}
function numberToBytesBE2(n, len) {
  anumber(len);
  if (len === 0)
    throw new Error("zero output length is invalid");
  n = abignumber2(n);
  const expectedLen = len * 2;
  const hex2 = n.toString(16);
  if (hex2.length > expectedLen)
    throw new RangeError("number is too large");
  return hexToBytes(hex2.padStart(expectedLen, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE2(n, len).reverse();
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
  return typeof n === "bigint" && _0n3 <= n;
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  if (n < _0n3)
    throw new Error("expected non-negative bigint, got " + n);
  return n === _0n3 ? 0 : n.toString(2).length;
}
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  anumber(hashLen, "hashLen");
  anumber(qByteLen, "qByteLen");
  if (typeof hmacFn !== "function")
    throw new TypeError("hmacFn must be a function");
  const u8n = /* @__PURE__ */ __name((len) => new Uint8Array(len), "u8n");
  const NULL = Uint8Array.of();
  const byte0 = Uint8Array.of(0);
  const byte1 = Uint8Array.of(1);
  const _maxDrbgIters = 1e3;
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = /* @__PURE__ */ __name(() => {
    v.fill(1);
    k.fill(0);
    i = 0;
  }, "reset");
  const h = /* @__PURE__ */ __name((...msgs) => hmacFn(k, concatBytes3(v, ...msgs)), "h");
  const reseed = /* @__PURE__ */ __name((seed = NULL) => {
    k = h(byte0, seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(byte1, seed);
    v = h();
  }, "reseed");
  const gen = /* @__PURE__ */ __name(() => {
    if (i++ >= _maxDrbgIters)
      throw new Error("drbg: tried max amount of iterations");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes3(...out);
  }, "gen");
  const genUntil = /* @__PURE__ */ __name((seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while ((res = pred(gen())) === void 0)
      reseed();
    reset();
    return res;
  }, "genUntil");
  return genUntil;
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
var abytes3, anumber3, bytesToHex3, concatBytes3, hexToBytes3, isBytes3, randomBytes3, _0n3, _1n2, atitle3, bitMask, notImplemented;
var init_utils3 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/utils.js"() {
    init_utils();
    __name(aarray2, "aarray");
    abytes3 = /* @__PURE__ */ __name((value, length, title) => abytes(value, length, title), "abytes");
    anumber3 = anumber;
    __name(astring, "astring");
    __name(aobject3, "aobject");
    __name(afunction, "afunction");
    bytesToHex3 = bytesToHex;
    concatBytes3 = /* @__PURE__ */ __name((...arrays) => concatBytes(...arrays), "concatBytes");
    hexToBytes3 = /* @__PURE__ */ __name((hex2) => hexToBytes(hex2), "hexToBytes");
    isBytes3 = isBytes;
    randomBytes3 = /* @__PURE__ */ __name((bytesLength) => randomBytes(bytesLength), "randomBytes");
    _0n3 = /* @__PURE__ */ BigInt(0);
    _1n2 = /* @__PURE__ */ BigInt(1);
    atitle3 = /* @__PURE__ */ __name((title) => title ? `"${title}" ` : "", "atitle");
    __name(abool3, "abool");
    __name(abignumber2, "abignumber");
    __name(asafenumber, "asafenumber");
    __name(numberToHexUnpadded, "numberToHexUnpadded");
    __name(hexToNumber2, "hexToNumber");
    __name(bytesToNumberBE2, "bytesToNumberBE");
    __name(bytesToNumberLE, "bytesToNumberLE");
    __name(numberToBytesBE2, "numberToBytesBE");
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
      return (_1n2 << BigInt(n)) - _1n2;
    }, "bitMask");
    __name(createHmacDrbg, "createHmacDrbg");
    __name(validateObject, "validateObject");
    notImplemented = /* @__PURE__ */ __name(() => {
      throw new Error("not implemented");
    }, "notImplemented");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/modular.js
function mod(a, b) {
  if (b <= _0n4)
    throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n4 ? result : b + result;
}
function pow(num, power, modulo) {
  if (modulo <= _1n3)
    throw new Error("pow: expected modulus > 1, got " + modulo);
  if (typeof power !== "bigint")
    throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
  if (power < _0n4)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n4)
    return _1n3;
  if (power === _1n3)
    return num;
  let d = num % modulo;
  if (d < _0n4)
    d += modulo;
  if (power < POW_WINDOWED_MIN) {
    let p2 = _1n3;
    while (power > _0n4) {
      if (power & _1n3)
        p2 = p2 * d % modulo;
      d = d * d % modulo;
      power >>= _1n3;
    }
    return p2;
  }
  const digits = [];
  while (power > _0n4) {
    digits.push(Number(power & _15n));
    power >>= _4n;
  }
  const table = new Array(16);
  table[0] = _1n3;
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
  if (modulo <= _1n3)
    throw new Error("pow2: expected modulus > 1, got " + modulo);
  if (power < _0n4)
    throw new Error("pow2: expected non-negative exponent, got " + power);
  let res = x;
  while (power-- > _0n4) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n4)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _1n3)
    throw new Error("invert: expected modulus > 1, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n4, u = _1n3;
  while (a !== _0n4) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    b = a, a = r, x = u, u = m;
  }
  const gcd = b;
  if (gcd !== _1n3)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function invertCt(a, prime) {
  if (prime <= _1n3)
    throw new Error("invertCt: expected prime modulus > 1, got " + prime);
  const an = mod(a, prime);
  if (an === _0n4)
    throw new Error("invertCt: expected non-zero number");
  const inverse = pow(an, prime - _2n2, prime);
  if (mod(an * inverse, prime) !== _1n3)
    throw new Error("invertCt: does not exist");
  return inverse;
}
function assertIsSquare(Fp2, root, n) {
  const F3 = Fp2;
  if (!F3.eql(F3.sqr(root), n))
    throw new Error("Cannot find square root");
}
function aoddModulus(order, fnName) {
  if ((order & _1n3) === _0n4)
    throw new Error(fnName + ": expected odd modulus, got " + order);
}
function sqrt3mod4(Fp2, n) {
  const F3 = Fp2;
  const p1div4 = (F3.ORDER + _1n3) / _4n;
  const root = F3.pow(n, p1div4);
  assertIsSquare(F3, root, n);
  return root;
}
function sqrt5mod8(Fp2, n) {
  const F3 = Fp2;
  const p5div8 = (F3.ORDER - _5n) / _8n;
  const n2 = F3.mul(n, _2n2);
  const v = F3.pow(n2, p5div8);
  const nv = F3.mul(n, v);
  const i = F3.mul(F3.mul(nv, _2n2), v);
  const root = F3.mul(nv, F3.sub(i, F3.ONE));
  assertIsSquare(F3, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n2) / _16n;
  return ((Fp2, n) => {
    const F3 = Fp2;
    let tv1 = F3.pow(n, c4);
    let tv2 = F3.mul(tv1, c1);
    const tv3 = F3.mul(tv1, c2);
    const tv4 = F3.mul(tv1, c3);
    const e1 = F3.eql(F3.sqr(tv2), n);
    const e2 = F3.eql(F3.sqr(tv3), n);
    tv1 = F3.cmov(tv1, tv2, e1);
    tv2 = F3.cmov(tv4, tv3, e2);
    const e3 = F3.eql(F3.sqr(tv2), n);
    const root = F3.cmov(tv1, tv2, e3);
    assertIsSquare(F3, root, n);
    return root;
  });
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  aoddModulus(P, "tonelliShanks");
  let Q3 = P - _1n3;
  let S = 0;
  while (Q3 % _2n2 === _0n4) {
    Q3 /= _2n2;
    S++;
  }
  let Z = _2n2;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q3);
  const Q1div2 = (Q3 + _1n3) / _2n2;
  return /* @__PURE__ */ __name(function tonelliSlow(Fp2, n) {
    const F3 = Fp2;
    if (F3.is0(n))
      return n;
    if (FpLegendre(F3, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = F3.mul(F3.ONE, cc);
    let t = F3.pow(n, Q3);
    let R = F3.pow(n, Q1div2);
    while (!F3.eql(t, F3.ONE)) {
      if (F3.is0(t))
        throw new Error("Cannot find square root: probably non-prime P");
      let i = 1;
      let t_tmp = F3.sqr(t);
      while (!F3.eql(t_tmp, F3.ONE)) {
        i++;
        t_tmp = F3.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n3 << BigInt(M - i - 1);
      const b = F3.pow(c, exponent);
      M = i;
      c = F3.sqr(b);
      t = F3.mul(t, c);
      R = F3.mul(R, b);
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
  if (field.ORDER <= _1n3)
    throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
function FpInvertBatch(Fp2, nums, passZero = false) {
  validateField(Fp2);
  aarray2(nums, "nums");
  abool3(passZero, "passZero");
  const F3 = Fp2;
  const inverted = new Array(nums.length).fill(passZero ? F3.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (F3.is0(num))
      return acc;
    inverted[i] = acc;
    return F3.mul(acc, num);
  }, F3.ONE);
  const invertedAcc = F3.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (F3.is0(num))
      return acc;
    inverted[i] = F3.mul(acc, inverted[i]);
    return F3.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp2, n) {
  validateField(Fp2);
  const F3 = Fp2;
  aoddModulus(F3.ORDER, "FpLegendre");
  const p1mod2 = (F3.ORDER - _1n3) / _2n2;
  const powered = F3.pow(n, p1mod2);
  const yes = F3.eql(powered, F3.ONE);
  const zero = F3.eql(powered, F3.ZERO);
  const no = F3.eql(powered, F3.neg(F3.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function FpIsSquare(Fp2, n) {
  const l = FpLegendre(Fp2, n);
  return l !== -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber3(nBitLength);
  if (n <= _0n4)
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
function Field(ORDER, opts2 = {}) {
  Object.freeze(_Field.prototype);
  return new _Field(ORDER, opts2);
}
function FpSqrtEven(Fp2, elm) {
  validateField(Fp2);
  const F3 = Fp2;
  if (!F3.isOdd)
    throw new Error("Field doesn't have isOdd");
  const root = F3.sqrt(elm);
  return F3.isOdd(root) ? F3.neg(root) : root;
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  if (fieldOrder <= _1n3)
    throw new Error("field order must be greater than 1");
  const bitLength = bitLen(fieldOrder - _1n3);
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE3 = false) {
  abytes3(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = Math.max(getMinHashLength(fieldOrder), 16);
  if (len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE3 ? bytesToNumberLE(key) : bytesToNumberBE2(key);
  const reduced = mod(num, fieldOrder - _1n3) + _1n3;
  return isLE3 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE2(reduced, fieldLen);
}
var _0n4, _1n3, _2n2, _3n, _4n, _5n, _7n2, _8n, _9n, _15n, _16n, POW_WINDOWED_MIN, isNegativeLE, FIELD_FIELDS, FIELD_SQRT, _Field;
var init_modular = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/modular.js"() {
    init_utils3();
    _0n4 = /* @__PURE__ */ BigInt(0);
    _1n3 = /* @__PURE__ */ BigInt(1);
    _2n2 = /* @__PURE__ */ BigInt(2);
    _3n = /* @__PURE__ */ BigInt(3);
    _4n = /* @__PURE__ */ BigInt(4);
    _5n = /* @__PURE__ */ BigInt(5);
    _7n2 = /* @__PURE__ */ BigInt(7);
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
    isNegativeLE = /* @__PURE__ */ __name((num, modulo) => (mod(num, modulo) & _1n3) === _1n3, "isNegativeLE");
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
    __name(FpIsSquare, "FpIsSquare");
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
      ZERO = _0n4;
      ONE = _1n3;
      _lengths;
      _mod;
      constructor(ORDER, opts2 = {}) {
        if (ORDER <= _1n3)
          throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
        let _nbitLength = void 0;
        this.isLE = false;
        if (opts2 != null && typeof opts2 === "object") {
          if (typeof opts2.BITS === "number")
            _nbitLength = opts2.BITS;
          if (typeof opts2.sqrt === "function")
            Object.defineProperty(this, "sqrt", { value: opts2.sqrt, enumerable: true });
          if (typeof opts2.isLE === "boolean")
            this.isLE = opts2.isLE;
          if (opts2.allowedLengths)
            this._lengths = Object.freeze(opts2.allowedLengths.slice());
          if (typeof opts2.modFromBytes === "boolean")
            this._mod = opts2.modFromBytes;
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
        return _0n4 <= num && num < this.ORDER;
      }
      is0(num) {
        return num === _0n4;
      }
      // is valid and invertible
      isValidNot0(num) {
        return !this.is0(num) && this.isValid(num);
      }
      isOdd(num) {
        return (num & _1n3) === _1n3;
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
        return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE2(num, this.BYTES);
      }
      fromBytes(bytes3, skipValidation = false) {
        abytes3(bytes3);
        const { _lengths: allowedLengths, BYTES, isLE: isLE3, ORDER, _mod: modFromBytes } = this;
        if (allowedLengths) {
          if (bytes3.length < 1 || !allowedLengths.includes(bytes3.length) || bytes3.length > BYTES) {
            throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes3.length);
          }
          const padded = new Uint8Array(BYTES);
          padded.set(bytes3, isLE3 ? 0 : padded.length - bytes3.length);
          bytes3 = padded;
        }
        if (bytes3.length !== BYTES)
          throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes3.length);
        let scalar = isLE3 ? bytesToNumberLE(bytes3) : bytesToNumberBE2(bytes3);
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
        abool3(condition, "condition");
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
function reverseBits(n, bits) {
  checkU32(n);
  if (typeof bits !== "number")
    throw new TypeError('"bits" expected number, got type=' + typeof bits);
  if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
    throw new Error(`expected integer 0 <= bits <= 32, got ${bits}`);
  let reversed = 0;
  for (let i = 0; i < bits; i++, n >>>= 1)
    reversed = reversed << 1 | n & 1;
  return reversed >>> 0;
}
function log2(n) {
  checkU32(n);
  return 31 - Math.clz32(n);
}
function bitReversalInplace(values) {
  if (!values || typeof values !== "object" || typeof values.length !== "number")
    throw new TypeError('"values" expected array-like, got type=' + typeof values);
  const n = values.length;
  if (!isPowerOfTwo(n))
    throw new Error("expected positive power-of-two length, got " + n);
  const bits = log2(n);
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, bits);
    if (i < j) {
      const tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }
  }
  return values;
}
function poly(field, roots, create, fft, length) {
  validateField(field);
  const F3 = field;
  const _create = create || ((len, elm) => new Array(len).fill(elm ?? F3.ZERO));
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
      if (F3.eql(x, omega[i]))
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
      const out = _create(len, F3.ZERO);
      for (let i = 0; i < Math.min(a.length, len); i++)
        out[i] = a[i];
      return out;
    }, "extend"),
    degree: /* @__PURE__ */ __name((a) => {
      checkLength(a);
      for (let i = a.length - 1; i >= 0; i--)
        if (!F3.is0(a[i]))
          return i;
      return -1;
    }, "degree"),
    add: /* @__PURE__ */ __name((a, b) => {
      const len = checkLength(a, b);
      const out = _create(len);
      for (let i = 0; i < len; i++)
        out[i] = F3.add(a[i], b[i]);
      return out;
    }, "add"),
    sub: /* @__PURE__ */ __name((a, b) => {
      const len = checkLength(a, b);
      const out = _create(len);
      for (let i = 0; i < len; i++)
        out[i] = F3.sub(a[i], b[i]);
      return out;
    }, "sub"),
    dot: /* @__PURE__ */ __name((a, b) => {
      const len = checkLength(a, b);
      const out = _create(len);
      for (let i = 0; i < len; i++)
        out[i] = F3.mul(a[i], b[i]);
      return out;
    }, "dot"),
    mul: /* @__PURE__ */ __name((a, b) => {
      if (isPoly(b)) {
        const len = checkLength(a, b);
        if (fft) {
          const A = fft.direct(a, false, true);
          const B2 = fft.direct(b, false, true);
          for (let i = 0; i < A.length; i++)
            A[i] = F3.mul(A[i], B2[i]);
          return fft.inverse(A, true, false);
        } else {
          const res = _create(len);
          for (let i = 0; i < len; i++) {
            for (let j = 0; j < len; j++) {
              const k = (i + j) % len;
              res[k] = F3.add(res[k], F3.mul(a[i], b[j]));
            }
          }
          return res;
        }
      } else {
        const out = _create(checkLength(a));
        for (let i = 0; i < out.length; i++)
          out[i] = F3.mul(a[i], b);
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
      for (let i = 1, power = F3.ONE; i < p.length; i++) {
        power = F3.mul(power, factor);
        out[i] = F3.mul(p[i], power);
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
      let acc = F3.ZERO;
      for (let i = 0; i < a.length; i++)
        acc = F3.add(acc, F3.mul(a[i], basis[i]));
      return acc;
    }, "eval"),
    monomial: {
      basis: /* @__PURE__ */ __name((x, n) => {
        const out = _create(n);
        let pow3 = F3.ONE;
        for (let i = 0; i < n; i++) {
          out[i] = pow3;
          pow3 = F3.mul(pow3, x);
        }
        return out;
      }, "basis"),
      eval: /* @__PURE__ */ __name((a, x) => {
        checkLength(a);
        let acc = F3.ZERO;
        for (let i = a.length - 1; i >= 0; i--)
          acc = F3.add(F3.mul(acc, x), a[i]);
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
          out[idx] = F3.ONE;
          return out;
        }
        const tm = F3.pow(x, BigInt(n));
        const c = F3.mul(F3.sub(tm, F3.ONE), F3.inv(BigInt(n)));
        const denom = _create(n);
        for (let i = 0; i < n; i++)
          denom[i] = F3.sub(x, cache[i]);
        const inv = F3.invertBatch(denom);
        for (let i = 0; i < n; i++)
          out[i] = F3.mul(c, F3.mul(cache[i], inv[i]));
        return out;
      }, "basis"),
      eval(a, x, brp = false) {
        checkLength(a);
        const idx = findOmegaIndex(x, a.length, brp);
        if (idx !== -1)
          return a[idx];
        const L = this.basis(x, a.length, brp);
        let acc = F3.ZERO;
        for (let i = 0; i < a.length; i++)
          if (!F3.is0(a[i]))
            acc = F3.add(acc, F3.mul(a[i], L[i]));
        return acc;
      }
    },
    vanishing(roots2) {
      checkPoly("roots", roots2);
      if (length !== void 0 && roots2.length !== length)
        throw new Error(`poly: expected fixed length ${length}, got ${roots2.length}`);
      const out = _create(roots2.length + 1, F3.ZERO);
      out[0] = F3.ONE;
      for (const r of roots2) {
        const neg = F3.neg(r);
        for (let j = out.length - 1; j > 0; j--)
          out[j] = F3.add(F3.mul(out[j], neg), out[j - 1]);
        out[0] = F3.mul(out[0], neg);
      }
      return out;
    }
  };
}
var FFTCore;
var init_fft = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/fft.js"() {
    init_utils3();
    init_modular();
    __name(checkU32, "checkU32");
    __name(isPowerOfTwo, "isPowerOfTwo");
    __name(nextPowerOfTwo, "nextPowerOfTwo");
    __name(reverseBits, "reverseBits");
    __name(log2, "log2");
    __name(bitReversalInplace, "bitReversalInplace");
    FFTCore = /* @__PURE__ */ __name((F3, coreOpts) => {
      validateObject(coreOpts, { N: "number", roots: "object", dit: "boolean" }, { invertButterflies: "boolean", skipStages: "number", brp: "boolean" }, "coreOpts");
      const { N: N3, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
      checkU32(N3, "coreOpts.N");
      const bits = log2(N3);
      if (!isPowerOfTwo(N3))
        throw new Error("FFT: Polynomial size should be power of two");
      checkU32(skipStages, "coreOpts.skipStages");
      const maxSkipStages = bits === 0 ? 0 : bits - 1;
      if (skipStages > maxSkipStages)
        throw new Error(`FFT: wrong skipStages: expected 0 <= skipStages <= ${maxSkipStages}`);
      if (roots.length !== N3)
        throw new Error(`FFT: wrong roots length: expected ${N3}, got ${roots.length}`);
      const isDit = dit !== invertButterflies;
      return (values) => {
        if (values.length !== N3)
          throw new Error("FFT: wrong Polynomial length");
        if (dit && brp)
          bitReversalInplace(values);
        for (let i = 0, g = 1; i < bits - skipStages; i++) {
          const s = dit ? i + 1 + skipStages : bits - i;
          const m = 1 << s;
          const m2 = m >> 1;
          const stride = N3 >> s;
          for (let k = 0; k < N3; k += m) {
            for (let j = 0, grp = g++; j < m2; j++) {
              const rootPos = invertButterflies ? dit ? N3 - grp : grp : j * stride;
              const i0 = k + j;
              const i1 = k + j + m2;
              const omega = roots[rootPos];
              const b = values[i1];
              const a = values[i0];
              if (isDit) {
                const t = F3.mul(b, omega);
                values[i0] = F3.add(a, t);
                values[i1] = F3.sub(a, t);
              } else if (invertButterflies) {
                values[i0] = F3.add(b, a);
                values[i1] = F3.mul(F3.sub(b, a), omega);
              } else {
                values[i0] = F3.add(a, b);
                values[i1] = F3.mul(F3.sub(a, b), omega);
              }
            }
          }
        }
        if (!dit && brp)
          bitReversalInplace(values);
        return values;
      };
    }, "FFTCore");
    __name(poly, "poly");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/utils.js
function aarray3(item, title, inner = () => {
}) {
  if (!Array.isArray(item))
    throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
  for (let i = 0; i < item.length; i++)
    inner(item[i], `${title}[${i}]`);
  return item;
}
function aobject4(value, title = "object") {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
  return value;
}
function equalBytes3(a, b) {
  a = abytes(a);
  b = abytes(b);
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function copyBytes3(bytes3) {
  return new Uint8Array(abytes(bytes3));
}
function validateOpts(opts2) {
  if (isBytes(opts2))
    throw new TypeError('"opts" expected object, got Uint8Array');
  aobject4(opts2, "opts");
  const proto = Object.getPrototypeOf(opts2);
  if (proto !== null && proto !== Object.prototype)
    throw new TypeError('"opts" expected a plain object');
}
function checkOptKeys(opts2, allowed) {
  validateOpts(opts2);
  const normalized = Object.assign(/* @__PURE__ */ Object.create(null), opts2);
  for (const [k, v] of Object.entries(normalized)) {
    if (v === void 0)
      continue;
    if (!allowed.includes(k))
      throw new TypeError('unexpected option "' + String(k) + '"; expected one of: ' + allowed.join(", "));
  }
  return Object.freeze(normalized);
}
function validateVerOpts(opts2, allowed = VER_OPT_KEYS) {
  const normalized = checkOptKeys(opts2, allowed);
  if (normalized.context !== void 0)
    abytes(normalized.context, void 0, "opts.context");
  return normalized;
}
function validateSigOpts(opts2, allowed = SIG_OPT_KEYS) {
  const normalized = checkOptKeys(opts2, allowed);
  if (normalized.context !== void 0)
    abytes(normalized.context, void 0, "opts.context");
  if (normalized.extraEntropy !== false && normalized.extraEntropy !== void 0)
    abytes(normalized.extraEntropy, void 0, "opts.extraEntropy");
  return normalized;
}
function splitCoder(label, ...lengths) {
  const getLength = /* @__PURE__ */ __name((c) => typeof c === "number" ? c : c.bytesLen, "getLength");
  const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
  return {
    bytesLen,
    encode: /* @__PURE__ */ __name((bufs) => {
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < lengths.length; i++) {
        const c = lengths[i];
        const l = getLength(c);
        const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
        abytes(b, l, label);
        res.set(b, pos);
        if (typeof c !== "number")
          b.fill(0);
        pos += l;
      }
      return res;
    }, "encode"),
    decode: /* @__PURE__ */ __name((buf) => {
      abytes(buf, bytesLen, label);
      const res = [];
      for (const c of lengths) {
        const l = getLength(c);
        const b = buf.subarray(0, l);
        res.push(typeof c === "number" ? b : c.decode(b));
        buf = buf.subarray(l);
      }
      return res;
    }, "decode")
  };
}
function vecCoder(c, vecLen) {
  const coder = c;
  const bytesLen = vecLen * coder.bytesLen;
  return {
    bytesLen,
    encode: /* @__PURE__ */ __name((u) => {
      const uArr = aarray3(u, "u");
      if (uArr.length !== vecLen)
        throw new RangeError(`vecCoder.encode: wrong length=${uArr.length}. Expected: ${vecLen}`);
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < uArr.length; i++) {
        const b = coder.encode(uArr[i]);
        res.set(b, pos);
        b.fill(0);
        pos += b.length;
      }
      return res;
    }, "encode"),
    decode: /* @__PURE__ */ __name((a) => {
      abytes(a, bytesLen);
      const r = [];
      for (let i = 0; i < a.length; i += coder.bytesLen)
        r.push(coder.decode(a.subarray(i, i + coder.bytesLen)));
      return r;
    }, "decode")
  };
}
function cleanBytes(...list) {
  for (const t of list) {
    if (Array.isArray(t))
      for (const b of t)
        b.fill(0);
    else
      t.fill(0);
  }
}
function getMask(bits) {
  anumber(bits, "bits");
  if (bits > 32)
    throw new RangeError('"bits" expected <= 32, got ' + bits);
  return bits === 32 ? 4294967295 : ~(-1 << bits) >>> 0;
}
function getMessage(msg, ctx = EMPTY) {
  abytes(msg, void 0, "msg");
  abytes(ctx, void 0, "ctx");
  if (ctx.length > 255)
    throw new RangeError("context should be 255 bytes or less");
  return concatBytes(new Uint8Array([0, ctx.length]), ctx, msg);
}
function checkHash(hash, requiredStrength = 0) {
  if (typeof hash !== "function" || typeof hash.create !== "function")
    throw new TypeError('"hash" expected hash function, got type=' + typeof hash);
  ahash(hash);
  anumber(requiredStrength, "requiredStrength");
  const oid = hash.oid;
  abytes(oid, void 0, "hash.oid");
  if (!equalBytes3(oid.subarray(0, 10), oidNistP))
    throw new Error('"hash.oid" is invalid: expected NIST hash');
  const xofLen = XOF_OID_OUTPUT_LEN[bytesToHex(oid)];
  if (xofLen !== void 0 && hash.outputLen !== xofLen) {
    throw new Error("Pre-hash XOF output length must be " + xofLen + " bytes for this OID, got: " + hash.outputLen);
  }
  const collisionResistance = hash.outputLen * 8 / 2;
  if (requiredStrength > collisionResistance) {
    throw new Error("Pre-hash security strength too low: " + collisionResistance + ", required: " + requiredStrength);
  }
}
function getMessagePrehash(hash, msg, ctx = EMPTY) {
  checkHash(hash);
  abytes(msg, void 0, "msg");
  abytes(ctx, void 0, "ctx");
  if (ctx.length > 255)
    throw new RangeError("context should be 255 bytes or less");
  const hashed = hash(msg);
  return concatBytes(new Uint8Array([1, ctx.length]), ctx, hash.oid, hashed);
}
var abytesDoc, randomBytes4, VER_OPT_KEYS, SIG_OPT_KEYS, EMPTY, oidNistP, XOF_OID_OUTPUT_LEN;
var init_utils4 = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/utils.js"() {
    init_utils();
    abytesDoc = abytes;
    randomBytes4 = randomBytes;
    __name(aarray3, "aarray");
    __name(aobject4, "aobject");
    __name(equalBytes3, "equalBytes");
    __name(copyBytes3, "copyBytes");
    __name(validateOpts, "validateOpts");
    VER_OPT_KEYS = /* @__PURE__ */ Object.freeze([
      "context"
    ]);
    SIG_OPT_KEYS = /* @__PURE__ */ Object.freeze([
      "context",
      "extraEntropy"
    ]);
    __name(checkOptKeys, "checkOptKeys");
    __name(validateVerOpts, "validateVerOpts");
    __name(validateSigOpts, "validateSigOpts");
    __name(splitCoder, "splitCoder");
    __name(vecCoder, "vecCoder");
    __name(cleanBytes, "cleanBytes");
    __name(getMask, "getMask");
    EMPTY = /* @__PURE__ */ Uint8Array.of();
    __name(getMessage, "getMessage");
    oidNistP = /* @__PURE__ */ Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2]);
    XOF_OID_OUTPUT_LEN = /* @__PURE__ */ (() => ({
      "060960864801650304020b": 32,
      // id-shake128, SHAKE128(M, 256)
      "060960864801650304020c": 64
      // id-shake256, SHAKE256(M, 512)
    }))();
    __name(checkHash, "checkHash");
    __name(getMessagePrehash, "getMessagePrehash");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/_crystals.js
var genCrystals, createXofShake, XOF128, XOF256;
var init_crystals = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/_crystals.js"() {
    init_fft();
    init_sha3();
    init_utils4();
    genCrystals = /* @__PURE__ */ __name((opts2) => {
      const { newPoly: newPoly2, N: N3, Q: Q3, F: F3, ROOT_OF_UNITY: ROOT_OF_UNITY3, brvBits, isKyber } = opts2;
      const mod2 = /* @__PURE__ */ __name((a, modulo = Q3) => {
        const result = a % modulo | 0;
        return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
      }, "mod");
      const smod = /* @__PURE__ */ __name((a, modulo = Q3) => {
        const r = mod2(a, modulo) | 0;
        return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
      }, "smod");
      function getZettas() {
        const out = newPoly2(N3);
        for (let i = 0; i < N3; i++) {
          const b = reverseBits(i, brvBits);
          const p = BigInt(ROOT_OF_UNITY3) ** BigInt(b) % BigInt(Q3);
          out[i] = Number(p) | 0;
        }
        return out;
      }
      __name(getZettas, "getZettas");
      const nttZetas = getZettas();
      const inv = /* @__PURE__ */ __name((_a) => {
        throw new Error("not implemented");
      }, "inv");
      const field = isKyber ? {
        add: /* @__PURE__ */ __name((a, b) => {
          const r = a + b | 0;
          return r >= Q3 ? r - Q3 | 0 : r;
        }, "add"),
        sub: /* @__PURE__ */ __name((a, b) => {
          const r = a - b | 0;
          return r < 0 ? r + Q3 | 0 : r;
        }, "sub"),
        mul: /* @__PURE__ */ __name((a, b) => mod2((a | 0) * (b | 0)) | 0, "mul"),
        inv
      } : {
        add: /* @__PURE__ */ __name((a, b) => mod2((a | 0) + (b | 0)) | 0, "add"),
        sub: /* @__PURE__ */ __name((a, b) => mod2((a | 0) - (b | 0)) | 0, "sub"),
        mul: /* @__PURE__ */ __name((a, b) => mod2((a | 0) * (b | 0)) | 0, "mul"),
        inv
      };
      const nttOpts = {
        N: N3,
        roots: nttZetas,
        invertButterflies: true,
        skipStages: isKyber ? 1 : 0,
        brp: false
      };
      const dif = FFTCore(field, { dit: false, ...nttOpts });
      const dit = FFTCore(field, { dit: true, ...nttOpts });
      const NTT = {
        encode: /* @__PURE__ */ __name((r) => {
          return dif(r);
        }, "encode"),
        decode: /* @__PURE__ */ __name((r) => {
          dit(r);
          for (let i = 0; i < r.length; i++)
            r[i] = mod2(F3 * r[i]);
          return r;
        }, "decode")
      };
      const bitsCoder = /* @__PURE__ */ __name((d, c) => {
        for (let i = 0, bufLen = 0; i < N3; i++) {
          bufLen += d;
          if (bufLen > 32)
            getMask(bufLen);
          bufLen %= 8;
        }
        const mask = getMask(d);
        const bytesLen = d * (N3 / 8);
        return {
          bytesLen,
          encode: /* @__PURE__ */ __name((poly_) => {
            const poly2 = poly_;
            const r = new Uint8Array(bytesLen);
            for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly2.length; i++) {
              buf |= (c.encode(poly2[i]) & mask) << bufLen;
              bufLen += d;
              for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
                r[pos++] = buf & 255;
            }
            return r;
          }, "encode"),
          decode: /* @__PURE__ */ __name((bytes3) => {
            const r = newPoly2(N3);
            for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes3.length; i++) {
              buf |= bytes3[i] << bufLen;
              bufLen += 8;
              for (; bufLen >= d; bufLen -= d, buf >>= d)
                r[pos++] = c.decode(buf & mask);
            }
            return r;
          }, "decode")
        };
      }, "bitsCoder");
      return {
        mod: mod2,
        smod,
        nttZetas,
        NTT: {
          encode: /* @__PURE__ */ __name((r) => NTT.encode(r), "encode"),
          decode: /* @__PURE__ */ __name((r) => NTT.decode(r), "decode")
        },
        bitsCoder
      };
    }, "genCrystals");
    createXofShake = /* @__PURE__ */ __name((shake) => (seed, blockLen) => {
      if (!blockLen)
        blockLen = shake.blockLen;
      const _seed = new Uint8Array(seed.length + 2);
      _seed.set(seed);
      const seedLen = seed.length;
      const buf = new Uint8Array(blockLen);
      let h = shake.create({});
      let calls = 0;
      let xofs = 0;
      return {
        stats: /* @__PURE__ */ __name(() => ({ calls, xofs }), "stats"),
        get: /* @__PURE__ */ __name((x, y) => {
          _seed[seedLen + 0] = x;
          _seed[seedLen + 1] = y;
          h.destroy();
          h = shake.create({}).update(_seed);
          calls++;
          return () => {
            xofs++;
            return h.xofInto(buf);
          };
        }, "get"),
        clean: /* @__PURE__ */ __name(() => {
          h.destroy();
          cleanBytes(buf, _seed);
        }, "clean")
      };
    }, "createXofShake");
    XOF128 = /* @__PURE__ */ createXofShake(shake128);
    XOF256 = /* @__PURE__ */ createXofShake(shake256);
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/ml-kem.js
var ml_kem_exports = {};
__export(ml_kem_exports, {
  PARAMS: () => PARAMS,
  __tests: () => __tests,
  ml_kem1024: () => ml_kem1024,
  ml_kem512: () => ml_kem512,
  ml_kem768: () => ml_kem768
});
function polyAdd(a_, b_) {
  const a = a_;
  const b = b_;
  for (let i = 0; i < N; i++) {
    const r = a[i] + b[i];
    a[i] = r >= Q ? r - Q : r;
  }
}
function polySub(a_, b_) {
  const a = a_;
  const b = b_;
  for (let i = 0; i < N; i++) {
    const r = a[i] - b[i];
    a[i] = r < 0 ? r + Q : r;
  }
}
function BaseCaseMultiply(a0, a1, b0, b1, zeta) {
  const c0 = crystals.mod(crystals.mod(a1 * b1) * zeta + a0 * b0);
  const c1 = crystals.mod(a0 * b1 + a1 * b0);
  return { c0, c1 };
}
function MultiplyNTTs(f_, g_) {
  const f = f_;
  const g = g_;
  for (let i = 0; i < N / 2; i++) {
    let z = crystals.nttZetas[64 + (i >> 1)];
    if (i & 1)
      z = -z;
    const { c0, c1 } = BaseCaseMultiply(f[2 * i + 0], f[2 * i + 1], g[2 * i + 0], g[2 * i + 1], z);
    f[2 * i + 0] = c0;
    f[2 * i + 1] = c1;
  }
  return f;
}
function SampleNTT(xof_) {
  const xof = xof_;
  const r = new Uint16Array(N);
  for (let j = 0; j < N; ) {
    const b = xof();
    if (b.length % 3)
      throw new Error("SampleNTT: unaligned block");
    for (let i = 0; j < N && i + 3 <= b.length; i += 3) {
      const d1 = (b[i + 0] >> 0 | b[i + 1] << 8) & 4095;
      const d2 = (b[i + 1] >> 4 | b[i + 2] << 4) & 4095;
      if (d1 < Q)
        r[j++] = d1;
      if (j < N && d2 < Q)
        r[j++] = d2;
    }
  }
  return r;
}
function sampleCBD(PRF_, seed, nonce, eta) {
  const PRF = PRF_;
  return sampleCBDBytes(PRF(eta * N / 4, seed, nonce), eta);
}
function createKyber(opts2) {
  const rawOpts = opts2;
  const KPKE = genKPKE(rawOpts);
  const { HASH256, HASH512, KDF } = rawOpts;
  const { secretCoder: KPKESecretCoder, lengths } = KPKE;
  const secretCoder = splitCoder("secretKey", lengths.secretKey, lengths.publicKey, 32, 32);
  const msgLen = 32;
  const seedLen = 64;
  const validateModulus = /* @__PURE__ */ __name((publicKey, fn) => {
    const eke = publicKey.subarray(0, 384 * rawOpts.K);
    const ek = KPKESecretCoder.encode(KPKESecretCoder.decode(copyBytes3(eke)));
    const ok = equalBytes3(ek, eke);
    cleanBytes(ek);
    if (!ok)
      throw new Error(`ML-KEM.${fn}: wrong publicKey modulus`);
  }, "validateModulus");
  const kemLengths = Object.freeze({
    ...lengths,
    seed: 64,
    msg: msgLen,
    msgRand: msgLen,
    secretKey: secretCoder.bytesLen
  });
  return Object.freeze({
    info: Object.freeze({ type: "ml-kem" }),
    lengths: kemLengths,
    keygen: /* @__PURE__ */ __name((seed) => {
      const ownSeed = seed === void 0;
      const s = ownSeed ? randomBytes4(seedLen) : seed;
      let sk;
      let publicKeyHash;
      try {
        abytesDoc(s, seedLen, "seed");
        const keys = KPKE.keygen(s.subarray(0, 32));
        const publicKey = keys.publicKey;
        sk = keys.secretKey;
        publicKeyHash = HASH256(publicKey);
        const secretKey = secretCoder.encode([sk, publicKey, publicKeyHash, s.subarray(32)]);
        return {
          publicKey,
          secretKey
        };
      } finally {
        if (sk !== void 0)
          cleanBytes(sk);
        if (publicKeyHash !== void 0)
          cleanBytes(publicKeyHash);
        if (ownSeed)
          cleanBytes(s);
      }
    }, "keygen"),
    getPublicKey: /* @__PURE__ */ __name((secretKey) => {
      const [_sk, publicKey, _publicKeyHash, _z] = secretCoder.decode(secretKey);
      return Uint8Array.from(publicKey);
    }, "getPublicKey"),
    encapsulate: /* @__PURE__ */ __name((publicKey, msg) => {
      const ownMsg = msg === void 0;
      const m = ownMsg ? randomBytes4(msgLen) : msg;
      let kr;
      try {
        abytesDoc(publicKey, lengths.publicKey, "publicKey");
        abytesDoc(m, msgLen, "message");
        validateModulus(publicKey, "encapsulate");
        kr = HASH512.create().update(m).update(HASH256(publicKey)).digest();
        const cipherText = KPKE.encrypt(publicKey, m, kr.subarray(32, 64));
        return {
          cipherText,
          sharedSecret: kr.subarray(0, 32)
        };
      } finally {
        if (kr !== void 0)
          cleanBytes(kr.subarray(32));
        if (ownMsg)
          cleanBytes(m);
      }
    }, "encapsulate"),
    decapsulate: /* @__PURE__ */ __name((cipherText, secretKey) => {
      abytesDoc(secretKey, secretCoder.bytesLen, "secretKey");
      abytesDoc(cipherText, lengths.cipherText, "cipherText");
      const k768 = secretCoder.bytesLen - 96;
      const start = k768 + 32;
      const test = HASH256(secretKey.subarray(k768 / 2, start));
      if (!equalBytes3(test, secretKey.subarray(start, start + 32)))
        throw new Error("invalid secretKey: hash check failed");
      const [sk, publicKey, publicKeyHash, z] = secretCoder.decode(secretKey);
      const msg = KPKE.decrypt(cipherText, sk);
      const kr = HASH512.create().update(msg).update(publicKeyHash).digest();
      const Khat = kr.subarray(0, 32);
      const cipherText2 = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
      const isValid = equalBytes3(cipherText, cipherText2);
      const Kbar = KDF.create({ dkLen: 32 }).update(z).update(cipherText).digest();
      cleanBytes(msg, cipherText2, kr.subarray(32), !isValid ? Khat : Kbar);
      return isValid ? Khat : Kbar;
    }, "decapsulate"),
    /**
     * Experimental prototype: pre-expand a public key so repeated encapsulate/decapsulate
     * against the same key skip re-validation, H(ek), t̂ decoding and the K² SampleNTT
     * XOF expansions of Â. Only public data is cached; see {@link KEMPrepared}.
     */
    prepare: /* @__PURE__ */ __name((publicKey) => {
      abytesDoc(publicKey, lengths.publicKey, "publicKey");
      validateModulus(publicKey, "prepare");
      const ek = copyBytes3(publicKey);
      const publicKeyHash = HASH256(ek);
      const cached = KPKE.prepare(ek);
      return Object.freeze({
        publicKey: ek,
        encapsulate: /* @__PURE__ */ __name((msg) => {
          const ownMsg = msg === void 0;
          const m = ownMsg ? randomBytes4(msgLen) : msg;
          let kr;
          try {
            abytesDoc(m, msgLen, "message");
            kr = HASH512.create().update(m).update(publicKeyHash).digest();
            const cipherText = cached.encrypt(m, kr.subarray(32, 64));
            return {
              cipherText,
              sharedSecret: kr.subarray(0, 32)
            };
          } finally {
            if (kr !== void 0)
              cleanBytes(kr.subarray(32));
            if (ownMsg)
              cleanBytes(m);
          }
        }, "encapsulate"),
        decapsulate: /* @__PURE__ */ __name((cipherText, secretKey) => {
          abytesDoc(secretKey, secretCoder.bytesLen, "secretKey");
          abytesDoc(cipherText, lengths.cipherText, "cipherText");
          const [sk, ekEmbedded, storedHash, z] = secretCoder.decode(secretKey);
          if (!equalBytes3(ekEmbedded, ek) || !equalBytes3(storedHash, publicKeyHash))
            throw new Error("ML-KEM.decapsulate: secretKey does not match prepared publicKey");
          const msg = KPKE.decrypt(cipherText, sk);
          const kr = HASH512.create().update(msg).update(publicKeyHash).digest();
          const Khat = kr.subarray(0, 32);
          const cipherText2 = cached.encrypt(msg, kr.subarray(32, 64));
          const isValid = equalBytes3(cipherText, cipherText2);
          const Kbar = KDF.create({ dkLen: 32 }).update(z).update(cipherText).digest();
          cleanBytes(msg, cipherText2, kr.subarray(32), !isValid ? Khat : Kbar);
          return isValid ? Khat : Kbar;
        }, "decapsulate"),
        clean: cached.clean
      });
    }, "prepare")
  });
}
function shakePRF(dkLen, key, nonce) {
  return shake256.create({ dkLen }).update(key).update(new Uint8Array([nonce])).digest();
}
var N, Q, F, ROOT_OF_UNITY, crystals, PARAMS, compress, byteCoder, polyCoder, sampleCBDBytes, genKPKE, opts, mk, ml_kem512, ml_kem768, ml_kem1024, __tests;
var init_ml_kem = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/ml-kem.js"() {
    init_sha3();
    init_utils();
    init_crystals();
    init_utils4();
    N = 256;
    Q = 3329;
    F = 3303;
    ROOT_OF_UNITY = 17;
    crystals = /* @__PURE__ */ genCrystals({
      N,
      Q,
      F,
      ROOT_OF_UNITY,
      newPoly: /* @__PURE__ */ __name((n) => new Uint16Array(n), "newPoly"),
      brvBits: 7,
      isKyber: true
    });
    PARAMS = /* @__PURE__ */ (() => Object.freeze({
      512: Object.freeze({ N, Q, K: 2, ETA1: 3, ETA2: 2, du: 10, dv: 4, RBGstrength: 128 }),
      768: Object.freeze({ N, Q, K: 3, ETA1: 2, ETA2: 2, du: 10, dv: 4, RBGstrength: 192 }),
      1024: Object.freeze({ N, Q, K: 4, ETA1: 2, ETA2: 2, du: 11, dv: 5, RBGstrength: 256 })
    }))();
    compress = /* @__PURE__ */ __name((d) => {
      if (d >= 12)
        return { encode: /* @__PURE__ */ __name((i) => i, "encode"), decode: /* @__PURE__ */ __name((i) => i >= Q ? i - Q : i, "decode") };
      const a = 2 ** (d - 1);
      return {
        // This only matches standalone Compress_d after bitsCoder masks the result into Z_(2^d).
        encode: /* @__PURE__ */ __name((i) => ((i << d) + Q / 2) / Q, "encode"),
        // const decompress = (i: number) => round((Q / 2 ** d) * i);
        decode: /* @__PURE__ */ __name((i) => i * Q + a >>> d, "decode")
      };
    }, "compress");
    byteCoder = /* @__PURE__ */ __name((d) => crystals.bitsCoder(d, d === 12 ? { encode: /* @__PURE__ */ __name((i) => i, "encode"), decode: /* @__PURE__ */ __name((i) => i >= Q ? i - Q : i, "decode") } : { encode: /* @__PURE__ */ __name((i) => i, "encode"), decode: /* @__PURE__ */ __name((i) => i, "decode") }), "byteCoder");
    polyCoder = /* @__PURE__ */ __name((d) => d === 12 ? byteCoder(12) : crystals.bitsCoder(d, compress(d)), "polyCoder");
    __name(polyAdd, "polyAdd");
    __name(polySub, "polySub");
    __name(BaseCaseMultiply, "BaseCaseMultiply");
    __name(MultiplyNTTs, "MultiplyNTTs");
    __name(SampleNTT, "SampleNTT");
    sampleCBDBytes = /* @__PURE__ */ __name((buf, eta) => {
      const r = new Uint16Array(N);
      const b32 = u32(buf);
      swap32IfBE(b32);
      let len = 0;
      for (let i = 0, p = 0, bb = 0, t0 = 0; i < b32.length; i++) {
        let b = b32[i];
        for (let j = 0; j < 32; j++) {
          bb += b & 1;
          b >>= 1;
          len += 1;
          if (len === eta) {
            t0 = bb;
            bb = 0;
          } else if (len === 2 * eta) {
            r[p++] = crystals.mod(t0 - bb);
            bb = 0;
            len = 0;
          }
        }
      }
      swap32IfBE(b32);
      if (len)
        throw new Error(`sampleCBD: leftover bits: ${len}`);
      return r;
    }, "sampleCBDBytes");
    __name(sampleCBD, "sampleCBD");
    genKPKE = /* @__PURE__ */ __name((opts_) => {
      const opts2 = opts_;
      const { K, PRF, XOF, HASH512, ETA1, ETA2, du, dv } = opts2;
      const poly1 = polyCoder(1);
      const polyV = polyCoder(dv);
      const polyU = polyCoder(du);
      const publicCoder = splitCoder("publicKey", vecCoder(polyCoder(12), K), 32);
      const secretCoder = vecCoder(polyCoder(12), K);
      const cipherCoder = splitCoder("ciphertext", vecCoder(polyU, K), polyV);
      const seedCoder = splitCoder("seed", 32, 32);
      const encryptCore = /* @__PURE__ */ __name((tHat, getA, msg, seed) => {
        const rHat = [];
        for (let i = 0; i < K; i++)
          rHat.push(crystals.NTT.encode(sampleCBD(PRF, seed, i, ETA1)));
        const tmp2 = new Uint16Array(N);
        const u = [];
        for (let i = 0; i < K; i++) {
          const e1 = sampleCBD(PRF, seed, K + i, ETA2);
          const tmp = new Uint16Array(N);
          for (let j = 0; j < K; j++) {
            const aij = getA(i, j);
            polyAdd(tmp, MultiplyNTTs(aij, rHat[j]));
          }
          polyAdd(e1, crystals.NTT.decode(tmp));
          u.push(e1);
          polyAdd(tmp2, MultiplyNTTs(tHat[i], rHat[i]));
          cleanBytes(tmp);
        }
        const e2 = sampleCBD(PRF, seed, 2 * K, ETA2);
        polyAdd(e2, crystals.NTT.decode(tmp2));
        const v = poly1.decode(msg);
        polyAdd(v, e2);
        cleanBytes(tHat, rHat, tmp2, e2);
        return cipherCoder.encode([u, v]);
      }, "encryptCore");
      return {
        secretCoder,
        lengths: {
          secretKey: secretCoder.bytesLen,
          publicKey: publicCoder.bytesLen,
          cipherText: cipherCoder.bytesLen
        },
        keygen: /* @__PURE__ */ __name((seed) => {
          abytesDoc(seed, 32, "seed");
          const seedDst = new Uint8Array(33);
          seedDst.set(seed);
          seedDst[32] = K;
          const seedHash = HASH512(seedDst);
          const [rho, sigma] = seedCoder.decode(seedHash);
          const sHat = [];
          const tHat = [];
          for (let i = 0; i < K; i++)
            sHat.push(crystals.NTT.encode(sampleCBD(PRF, sigma, i, ETA1)));
          const x = XOF(rho);
          for (let i = 0; i < K; i++) {
            const e = crystals.NTT.encode(sampleCBD(PRF, sigma, K + i, ETA1));
            for (let j = 0; j < K; j++) {
              const aji = SampleNTT(x.get(j, i));
              polyAdd(e, MultiplyNTTs(aji, sHat[j]));
            }
            tHat.push(e);
          }
          x.clean();
          const res = {
            publicKey: publicCoder.encode([tHat, rho]),
            secretKey: secretCoder.encode(sHat)
          };
          cleanBytes(rho, sigma, sHat, tHat, seedDst, seedHash);
          return res;
        }, "keygen"),
        encrypt: /* @__PURE__ */ __name((publicKey, msg, seed) => {
          const [tHat, rho] = publicCoder.decode(publicKey);
          const x = XOF(rho);
          const res = encryptCore(tHat, (i, j) => SampleNTT(x.get(i, j)), msg, seed);
          x.clean();
          return res;
        }, "encrypt"),
        // Expands the full Â matrix (public data derived from rho) once, so repeated encryptions
        // against the same ek skip the K² SampleNTT XOF expansions. Cached polys are copied per
        // call because encryptCore mutates its inputs in place.
        prepare: /* @__PURE__ */ __name((publicKey) => {
          const [tHat, rho] = publicCoder.decode(publicKey);
          const x = XOF(rho);
          const A = [];
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              A.push(SampleNTT(x.get(i, j)));
          x.clean();
          return {
            encrypt: /* @__PURE__ */ __name((msg, seed) => encryptCore(tHat.map((p) => p.slice()), (i, j) => A[i * K + j].slice(), msg, seed), "encrypt"),
            clean: /* @__PURE__ */ __name(() => cleanBytes(tHat, A), "clean")
          };
        }, "prepare"),
        decrypt: /* @__PURE__ */ __name((cipherText, privateKey) => {
          const [u, v] = cipherCoder.decode(cipherText);
          const sk = secretCoder.decode(privateKey);
          const tmp = new Uint16Array(N);
          for (let i = 0; i < K; i++)
            polyAdd(tmp, MultiplyNTTs(sk[i], crystals.NTT.encode(u[i])));
          polySub(v, crystals.NTT.decode(tmp));
          const res = poly1.encode(v);
          cleanBytes(tmp, sk, u, v);
          return res;
        }, "decrypt")
      };
    }, "genKPKE");
    __name(createKyber, "createKyber");
    __name(shakePRF, "shakePRF");
    opts = /* @__PURE__ */ (() => ({
      HASH256: sha3_256,
      HASH512: sha3_512,
      KDF: shake256,
      XOF: XOF128,
      PRF: shakePRF
    }))();
    mk = /* @__PURE__ */ __name((params) => createKyber({
      ...opts,
      ...params
    }), "mk");
    ml_kem512 = /* @__PURE__ */ (() => mk(PARAMS[512]))();
    ml_kem768 = /* @__PURE__ */ (() => mk(PARAMS[768]))();
    ml_kem1024 = /* @__PURE__ */ (() => mk(PARAMS[1024]))();
    __tests = /* @__PURE__ */ (() => Object.freeze({
      Compress_d: /* @__PURE__ */ __name((x, d) => {
        if (d < 1 || d > 11)
          throw new Error(`Compress_d: expected d in [1..11], got ${d}`);
        return compress(d).encode(x) & getMask(d);
      }, "Compress_d"),
      Decompress_d: /* @__PURE__ */ __name((y, d) => {
        if (d < 1 || d > 11)
          throw new Error(`Decompress_d: expected d in [1..11], got ${d}`);
        return compress(d).decode(y);
      }, "Decompress_d"),
      ByteEncode_d: /* @__PURE__ */ __name((F3, d) => {
        if (d < 1 || d > 12)
          throw new Error(`ByteEncode_d: expected d in [1..12], got ${d}`);
        return byteCoder(d).encode(F3);
      }, "ByteEncode_d"),
      ByteDecode_d: /* @__PURE__ */ __name((B2, d) => {
        if (d < 1 || d > 12)
          throw new Error(`ByteDecode_d: expected d in [1..12], got ${d}`);
        return byteCoder(d).decode(B2);
      }, "ByteDecode_d"),
      NTT: /* @__PURE__ */ __name((f) => crystals.NTT.encode(Uint16Array.from(f)), "NTT"),
      NTT_inv: /* @__PURE__ */ __name((fHat) => crystals.NTT.decode(Uint16Array.from(fHat)), "NTT_inv"),
      MultiplyNTTs: /* @__PURE__ */ __name((fHat, gHat) => MultiplyNTTs(Uint16Array.from(fHat), Uint16Array.from(gHat)), "MultiplyNTTs"),
      SamplePolyCBD: /* @__PURE__ */ __name((B2, eta) => {
        abytesDoc(B2, 64 * eta, "B");
        return sampleCBDBytes(B2, eta);
      }, "SamplePolyCBD"),
      SampleNTT: /* @__PURE__ */ __name((B2) => {
        abytesDoc(B2, 34, "B");
        const xof = XOF128(B2.subarray(0, 32));
        try {
          return SampleNTT(xof.get(B2[32], B2[33]));
        } finally {
          xof.clean();
        }
      }, "SampleNTT")
    }))();
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/post-quantum/ml-kem.js
var require_ml_kem = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/post-quantum/ml-kem.js"(exports, module) {
    module.exports = (init_ml_kem(), __toCommonJS(ml_kem_exports));
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/sha3.js
var require_sha3 = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/sha3.js"(exports, module) {
    module.exports = (init_sha3(), __toCommonJS(sha3_exports));
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
function probeRandomBytes(randomBytes5, length) {
  if (randomBytes5 === void 0)
    return void 0;
  afunction(randomBytes5, "randomBytes");
  try {
    const probe = randomBytes5(length);
    if (!isBytes3(probe) || probe.length !== length)
      return void 0;
  } catch {
    return void 0;
  }
  return randomBytes5;
}
function validateMSMPoints(points, c) {
  aarray2(points, "points");
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
  while (n > _0n5) {
    let w = 0;
    if (n & _1n4) {
      w = Number(n & mask);
      if (w >= half)
        w -= size;
      n -= BigInt(w);
    }
    d.push(w);
    n >>= _1n4;
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
      n += _1n4;
    }
    d.push(v);
  }
  if (n !== _0n5)
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
  abool3(allowOversized, "allowOversized");
  validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
  if (points.length !== scalars.length)
    throw new Error("arrays of points and scalars must have equal length");
  const tables = points.map((p) => oddMultiples(p, 4));
  const digits = scalars.map((n) => wnafDigits(n, 4));
  return wnafWalk(c.ZERO, tables, digits);
}
function createField(order, field, isLE3) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE3 });
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
    if (!(isPosBig(val) && val !== _0n5))
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
var _0n5, _1n4, _4n2, BLIND_BYTES, BLIND_BITS, FW_WINDOW, TABLE_BYTES_MAX, pointWindowSizes, ScalarMultiplier;
var init_curve = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/curve.js"() {
    init_utils3();
    init_modular();
    _0n5 = /* @__PURE__ */ BigInt(0);
    _1n4 = /* @__PURE__ */ BigInt(1);
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
      constructor(Point, randomBytes5) {
        validatePointCons(Point);
        this.randomBytes = probeRandomBytes(randomBytes5, BLIND_BYTES);
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
        if (!inRange(scalar, _1n4, this.Point.Fn.ORDER))
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
        const n = scalar + bytesToNumberBE2(blind) * this.Point.Fn.ORDER;
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
        for (let window2 = windows - 1; window2 >= 0; window2--) {
          if (window2 !== windows - 1)
            for (let d = 0; d < W; d++)
              acc = acc.double();
          const digit = Number(n >> BigInt(window2 * W) & mask);
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
        if (cofactor === _1n4)
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
  const opts2 = extraOpts;
  const validated = createCurveFields("edwards", params, opts2, opts2.FpFnLE);
  const { Fp: Fp2, Fn: Fn2 } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor } = CURVE;
  if (FpLegendre(Fp2, CURVE.a) !== 1)
    throw new Error("edwards: CURVE.a must be a square in Fp for complete addition formulas");
  if (FpLegendre(Fp2, CURVE.d) !== -1)
    throw new Error("edwards: CURVE.d must be a non-square in Fp for complete addition formulas");
  validateObject(opts2, {}, { uvRatio: "function", randomBytes: "function" });
  const randomBytes5 = opts2.randomBytes === void 0 ? randomBytes3 : opts2.randomBytes;
  const MASK = _2n3 << BigInt(Fp2.BYTES * 8) - _1n5;
  function isOdd(n) {
    if (!Fp2.isOdd)
      throw new Error("Field does not have .isOdd()");
    return Fp2.isOdd(n);
  }
  __name(isOdd, "isOdd");
  const uvRatio2 = opts2.uvRatio === void 0 ? (u, v) => {
    try {
      return { isValid: true, value: Fp2.sqrt(Fp2.div(u, v)) };
    } catch (e) {
      return { isValid: false, value: _0n6 };
    }
  } : opts2.uvRatio;
  if (!isEdValidXY(Fp2, CURVE, CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const mulA = Fp2.eql(CURVE.a, Fp2.neg(Fp2.ONE)) ? (x) => Fp2.neg(x) : Fp2.eql(CURVE.a, Fp2.ONE) ? (x) => x : (x) => Fp2.mul(CURVE.a, x);
  function acoord(title, n, banZero = false) {
    const min = banZero ? _1n5 : _0n6;
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
      abool3(zip215, "zip215");
      const normed = copyBytes2(bytes3);
      const lastByte = bytes3[len - 1];
      normed[len - 1] = lastByte & ~128;
      const y = bytesToNumberLE(normed);
      const max = zip215 ? MASK : Fp2.ORDER;
      aInRange("point.y", y, _0n6, max);
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
      return Point.fromBytes(hexToBytes3(hex2), zip215);
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
        this.multiply(_2n3);
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
      const B2 = Fp2.sqr(Y1);
      const C = Fp2.mul(Fp2.sqr(Z1), _2n3);
      const D2 = mulA(A);
      const x1y1 = Fp2.addN(X1, Y1);
      const E = Fp2.sub(Fp2.subN(Fp2.sqr(x1y1), A), B2);
      const G = Fp2.addN(D2, B2);
      const F3 = Fp2.subN(G, C);
      const H = Fp2.subN(D2, B2);
      const X3 = Fp2.mul(E, F3);
      const Y3 = Fp2.mul(G, H);
      const T3 = Fp2.mul(E, H);
      const Z3 = Fp2.mul(F3, G);
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
      const B2 = Fp2.mul(Y1, Y2);
      const C = Fp2.mul(Fp2.mulN(T1, d), T2);
      const D2 = Fp2.mul(Z1, Z2);
      const E = Fp2.sub(Fp2.subN(Fp2.mulN(Fp2.addN(X1, Y1), Fp2.addN(X2, Y2)), A), B2);
      const F3 = Fp2.subN(D2, C);
      const G = Fp2.addN(D2, C);
      const H = Fp2.sub(B2, mulA(A));
      const X3 = Fp2.mul(E, F3);
      const Y3 = Fp2.mul(G, H);
      const T3 = Fp2.mul(E, H);
      const Z3 = Fp2.mul(F3, G);
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
      if (scalar === _0n6)
        return Point.ZERO;
      if (this.is0() || scalar === _1n5)
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
      if (cofactor === _1n5)
        return this;
      if (cofactor === _2n3)
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
      return bytesToHex3(this.toBytes());
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const normalize = /* @__PURE__ */ __name((points) => normalizeZ(Point, points), "normalize");
  const wnaf = new ScalarMultiplier(Point, randomBytes5);
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
  const opts2 = eddsaOpts;
  validateObject(opts2, {}, {
    adjustScalarBytes: "function",
    randomBytes: "function",
    domain: "function",
    prehash: "function",
    zip215: "boolean",
    mapToCurve: "function",
    toMontgomery: "function",
    toMontgomerySecret: "function"
  });
  const { prehash } = opts2;
  const { BASE, Fp: Fp2, Fn: Fn2 } = Point;
  const outputLen = hash.outputLen;
  const expectedLen = 2 * Fp2.BYTES;
  if (outputLen !== void 0) {
    asafenumber(outputLen, "hash.outputLen");
    if (outputLen !== expectedLen)
      throw new Error(`hash.outputLen must be ${expectedLen}, got ${outputLen}`);
  }
  const randomBytes5 = opts2.randomBytes === void 0 ? randomBytes3 : opts2.randomBytes;
  const toMontgomery2 = opts2.toMontgomery;
  const toMontgomerySecret2 = opts2.toMontgomerySecret;
  const adjustScalarBytes2 = opts2.adjustScalarBytes === void 0 ? (bytes3) => bytes3 : opts2.adjustScalarBytes;
  const domain = opts2.domain === void 0 ? (data, ctx, phflag) => {
    abool3(phflag, "phflag");
    if (ctx.length || phflag)
      throw new Error("Contexts/pre-hash are not supported");
    return data;
  } : opts2.domain;
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
    zip215: opts2.zip215
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
      abool3(zip215, "zip215");
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
    seed = seed === void 0 ? randomBytes5(lengths.seed) : seed;
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
var _0n6, _1n5, _2n3, _4n3, _8n2, PrimeEdwardsPoint;
var init_edwards = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/edwards.js"() {
    init_utils3();
    init_curve();
    init_modular();
    _0n6 = /* @__PURE__ */ BigInt(0);
    _1n5 = /* @__PURE__ */ BigInt(1);
    _2n3 = /* @__PURE__ */ BigInt(2);
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
        return bytesToHex3(this.toBytes());
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
      const opts2 = Object.assign({}, safeDefaults, dstOverride(options));
      const u = hash_to_field(msg, 2, opts2);
      const u0 = map(u[0]);
      const u1 = map(u[1]);
      return clear(u0.add(u1));
    },
    encodeToCurve(msg, options) {
      const optsDst = safeDefaults.encodeDST === void 0 ? {} : { DST: safeDefaults.encodeDST };
      const opts2 = Object.assign({}, safeDefaults, optsDst, dstOverride(options));
      const u = hash_to_field(msg, 1, opts2);
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
      const N3 = Point.Fn.ORDER;
      const opts2 = Object.assign({}, safeDefaults, { DST: _DST_scalar }, dstOverride(options), {
        p: N3,
        m: 1
      });
      return hash_to_field(msg, 1, opts2)[0][0];
    }
  });
}
function SWUFpSqrtRatio(Fp2, Z) {
  const F3 = validateField(Fp2);
  const q = F3.ORDER;
  let l = _0n7;
  for (let o = q - _1n6; o % _2n4 === _0n7; o /= _2n4)
    l += _1n6;
  const c1 = l;
  const _2n_pow_c1_1 = _2n4 << c1 - _1n6 - _1n6;
  const _2n_pow_c1 = _2n_pow_c1_1 * _2n4;
  const c2 = (q - _1n6) / _2n_pow_c1;
  const c3 = (c2 - _1n6) / _2n4;
  const c4 = _2n_pow_c1 - _1n6;
  const c5 = _2n_pow_c1_1;
  const c6 = F3.pow(Z, c2);
  const c7 = F3.pow(Z, (c2 + _1n6) / _2n4);
  let sqrtRatio = /* @__PURE__ */ __name((u, v) => {
    let tv1 = c6;
    let tv2 = F3.pow(v, c4);
    let tv3 = F3.sqr(tv2);
    tv3 = F3.mul(tv3, v);
    let tv5 = F3.mul(u, tv3);
    tv5 = F3.pow(tv5, c3);
    tv5 = F3.mul(tv5, tv2);
    tv2 = F3.mul(tv5, v);
    tv3 = F3.mul(tv5, u);
    let tv4 = F3.mul(tv3, tv2);
    tv5 = F3.pow(tv4, c5);
    let isQR = F3.eql(tv5, F3.ONE);
    tv2 = F3.mul(tv3, c7);
    tv5 = F3.mul(tv4, tv1);
    tv3 = F3.cmov(tv2, tv3, isQR);
    tv4 = F3.cmov(tv5, tv4, isQR);
    for (let i = c1; i > _1n6; i--) {
      let tv52 = i - _2n4;
      tv52 = _2n4 << tv52 - _1n6;
      let tvv5 = F3.pow(tv4, tv52);
      const e1 = F3.eql(tvv5, F3.ONE);
      tv2 = F3.mul(tv3, tv1);
      tv1 = F3.mul(tv1, tv1);
      tvv5 = F3.mul(tv4, tv1);
      tv3 = F3.cmov(tv2, tv3, e1);
      tv4 = F3.cmov(tvv5, tv4, e1);
    }
    return { isValid: !F3.is0(v) && (isQR || F3.is0(u)), value: tv3 };
  }, "sqrtRatio");
  if (F3.ORDER % _4n4 === _3n2) {
    const c12 = (F3.ORDER - _3n2) / _4n4;
    const c22 = F3.sqrt(F3.neg(Z));
    sqrtRatio = /* @__PURE__ */ __name((u, v) => {
      let tv1 = F3.sqr(v);
      const tv2 = F3.mul(u, v);
      tv1 = F3.mul(tv1, tv2);
      let y1 = F3.pow(tv1, c12);
      y1 = F3.mul(y1, tv2);
      const y2 = F3.mul(y1, c22);
      const tv3 = F3.mul(F3.sqr(y1), v);
      const isQR = F3.eql(tv3, u);
      let y = F3.cmov(y2, y1, isQR);
      return { isValid: !F3.is0(v) && isQR, value: y };
    }, "sqrtRatio");
  }
  return sqrtRatio;
}
function mapToCurveSimpleSWU(Fp2, opts2) {
  const F3 = validateField(Fp2);
  validateObject(opts2, {}, {}, "opts");
  const { A, B: B2, Z } = opts2;
  if (!F3.isValidNot0(A) || !F3.isValidNot0(B2) || !F3.isValid(Z))
    throw new Error("mapToCurveSimpleSWU: invalid opts");
  if (F3.eql(Z, F3.neg(F3.ONE)) || FpIsSquare(F3, Z))
    throw new Error("mapToCurveSimpleSWU: invalid opts");
  const x = F3.mul(B2, F3.inv(F3.mul(Z, A)));
  const gx = F3.add(F3.add(F3.mul(F3.sqr(x), x), F3.mul(A, x)), B2);
  if (!FpIsSquare(F3, gx))
    throw new Error("mapToCurveSimpleSWU: invalid opts");
  const sqrtRatio = SWUFpSqrtRatio(F3, Z);
  if (!F3.isOdd)
    throw new Error("Field does not have .isOdd()");
  return (u) => {
    let tv1, tv2, tv3, tv4, tv5, tv6, x2, y;
    tv1 = F3.sqr(u);
    tv1 = F3.mul(tv1, Z);
    tv2 = F3.sqr(tv1);
    tv2 = F3.add(tv2, tv1);
    tv3 = F3.add(tv2, F3.ONE);
    tv3 = F3.mul(tv3, B2);
    tv4 = F3.cmov(Z, F3.neg(tv2), !F3.eql(tv2, F3.ZERO));
    tv4 = F3.mul(tv4, A);
    tv2 = F3.sqr(tv3);
    tv6 = F3.sqr(tv4);
    tv5 = F3.mul(tv6, A);
    tv2 = F3.add(tv2, tv5);
    tv2 = F3.mul(tv2, tv3);
    tv6 = F3.mul(tv6, tv4);
    tv5 = F3.mul(tv6, B2);
    tv2 = F3.add(tv2, tv5);
    x2 = F3.mul(tv1, tv3);
    const { isValid, value } = sqrtRatio(tv2, tv6);
    y = F3.mul(tv1, u);
    y = F3.mul(y, value);
    x2 = F3.cmov(x2, tv3, isValid);
    y = F3.cmov(y, value, isValid);
    const e1 = F3.isOdd(u) === F3.isOdd(y);
    y = F3.cmov(F3.neg(y), y, e1);
    const tv4_inv = FpInvertBatch(F3, [tv4], true)[0];
    x2 = F3.mul(x2, tv4_inv);
    return { x: x2, y };
  };
}
var _0n7, _1n6, _2n4, _3n2, _4n4, os2ip, _DST_scalar;
var init_hash_to_curve = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/hash-to-curve.js"() {
    init_utils3();
    init_modular();
    _0n7 = /* @__PURE__ */ BigInt(0);
    _1n6 = /* @__PURE__ */ BigInt(1);
    _2n4 = /* @__PURE__ */ BigInt(2);
    _3n2 = /* @__PURE__ */ BigInt(3);
    _4n4 = /* @__PURE__ */ BigInt(4);
    os2ip = bytesToNumberBE2;
    __name(i2osp, "i2osp");
    __name(strxor, "strxor");
    __name(normDST, "normDST");
    __name(expand_message_xmd, "expand_message_xmd");
    __name(expand_message_xof, "expand_message_xof");
    __name(hash_to_field, "hash_to_field");
    _DST_scalar = "HashToScalar-";
    __name(createHasher2, "createHasher");
    __name(SWUFpSqrtRatio, "SWUFpSqrtRatio");
    __name(mapToCurveSimpleSWU, "mapToCurveSimpleSWU");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/frost.js
function createFROST(opts2) {
  validateObject(opts2, {
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
  validatePointCons(opts2.Point);
  const { Point, validatePoint, parsePublicKey, adjustScalar, adjustPoint: adjustPointHook, challenge, adjustNonces, adjustSecret, adjustPublic, adjustGroupCommitmentShare, adjustDKG } = opts2;
  const Fn2 = opts2.Fn === void 0 ? Point.Fn : opts2.Fn;
  const adjustTx = opts2.adjustTx === void 0 ? void 0 : { encode: opts2.adjustTx.encode, decode: opts2.adjustTx.decode };
  if (adjustTx)
    validateObject(adjustTx, { encode: "function", decode: "function" });
  const hashBytes = opts2.hash;
  const hashToScalar = opts2.hashToScalar === void 0 ? (msg, opts3 = { DST: new Uint8Array() }) => {
    const t = hashBytes(concatBytes3(opts3.DST, msg));
    return Fn2.create(Fn2.isLE ? bytesToNumberLE(t) : bytesToNumberBE2(t));
  } : opts2.hashToScalar;
  const H1Prefix = utf8ToBytes(opts2.H1 !== void 0 ? opts2.H1 : opts2.name + "rho");
  const H2Prefix = utf8ToBytes(opts2.H2 !== void 0 ? opts2.H2 : opts2.name + "chal");
  const H3Prefix = utf8ToBytes(opts2.H3 !== void 0 ? opts2.H3 : opts2.name + "nonce");
  const H4Prefix = utf8ToBytes(opts2.H4 !== void 0 ? opts2.H4 : opts2.name + "msg");
  const H5Prefix = utf8ToBytes(opts2.H5 !== void 0 ? opts2.H5 : opts2.name + "com");
  const HDKGPrefix = utf8ToBytes(opts2.HDKG !== void 0 ? opts2.HDKG : opts2.name + "dkg");
  const HIDPrefix = utf8ToBytes(opts2.HID !== void 0 ? opts2.HID : opts2.name + "id");
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
    return Fn2.isLE ? bytesToNumberLE(t) : bytesToNumberBE2(t);
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
  const serializeIdentifier = /* @__PURE__ */ __name((id2) => bytesToHex3(Fn2.toBytes(validateIdentifier(id2))), "serializeIdentifier");
  const parseIdentifier = /* @__PURE__ */ __name((id2, title = "identifier") => {
    astring(id2, title);
    const n = validateIdentifier(Fn2.fromBytes(hexToBytes3(id2)));
    if (serializeIdentifier(n) !== id2)
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
      aarray2(coeffs, "coeffs");
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
    challenge: /* @__PURE__ */ __name((id2, verKey, R) => HDKG(concatBytes3(Fn2.toBytes(id2), serializePoint(verKey), serializePoint(R))), "challenge"),
    compute(id2, coefficents, commitments, rng = randomBytes3) {
      if (coefficents.length < 1)
        throw new Error("coefficients should have at least one element");
      const { point: R, scalar: k } = genPointScalarPair(rng);
      const verKey = commitments[0];
      const c = this.challenge(id2, verKey, R);
      const mu = Fn2.add(k, Fn2.mul(coefficents[0], c));
      return Signature.encode(R, mu);
    },
    validate(id2, commitment, proof) {
      if (commitment.length < 1)
        throw new Error("commitment should have at least one element");
      const { R, z } = Signature.decode(proof);
      const phi = parsePoint(commitment[0]);
      const c = this.challenge(id2, phi, R);
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
    for (const [_, id2, hC, bC] of CL)
      Cbytes.push(Fn2.toBytes(id2), serializePoint(hC), serializePoint(bC));
    const encodedCommitmentHash = H5(concatBytes3(...Cbytes));
    const rhoPrefix = concatBytes3(serializePoint(GPK), H4(msg), encodedCommitmentHash);
    const bindingFactors = {};
    for (const [i, id2] of CL) {
      bindingFactors[i] = H1(concatBytes3(rhoPrefix, Fn2.toBytes(id2)));
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
    const id2 = parseIdentifier(identifier);
    const { identifiers, groupCommitment, bindingFactors } = getGroupCommitment(GPK, commitmentList, msg);
    const bindingFactor = bindingFactors[identifier];
    const lambda = deriveInterpolatingValue(identifiers, id2);
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
      round1: /* @__PURE__ */ __name((id2, signers, secret, rng = randomBytes3) => {
        const idNum = parseIdentifier(id2, "id");
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
        aarray2(others, "others");
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
          const id2 = parseIdentifier(p.identifier);
          if (id2 === secret.identifier)
            throw new Error("duplicate id=" + serializeIdentifier(id2));
          ProofOfKnowledge.validate(id2, p.commitment, p.proofOfKnowledge);
          for (const c of p.commitment)
            parsePoint(c);
          if (res[p.identifier])
            throw new Error("Duplicate id=" + id2);
          const signingShare = Fn2.toBytes(polynomialEvaluate(id2, secret.coefficients));
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
        aarray2(round1, "round1");
        aarray2(round2, "round2");
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
          const id2 = parseIdentifier(k);
          const signingSharePart = Fn2.fromBytes(v.signingShare);
          const commitment = v.commitment.map(parsePoint);
          validateSecretShare(secret.identifier, commitment, signingSharePart);
          signingShare = Fn2.add(signingShare, signingSharePart);
          const idSer = serializeIdentifier(id2);
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
        aarray2(identifiers, "identifiers");
        if (identifiers.length !== signers.max)
          throw new Error("identifiers should be array of " + signers.max);
      }
      const identifierNums = {};
      for (const id2 of identifiers) {
        const idNum = parseIdentifier(id2);
        if (id2 in identifierNums)
          throw new Error("duplicated id=" + id2);
        identifierNums[id2] = idNum;
      }
      const sp = generateSecretPolynomial(signers, secret, void 0, rng);
      const commitmentBytes = sp.commitment.map(serializePoint);
      const secretShares = {};
      const verifyingShares = {};
      for (const id2 of identifiers) {
        const signingShare = polynomialEvaluate(identifierNums[id2], sp.coefficients);
        verifyingShares[id2] = serializePoint(Point.BASE.multiply(signingShare));
        secretShares[id2] = {
          identifier: id2,
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
      aarray2(pub.commitments, "pub.commitments");
      const id2 = parseIdentifier(secret.identifier);
      const commitment = pub.commitments.map(parsePoint);
      const signingShare = Fn2.fromBytes(secret.signingShare);
      validateSecretShare(id2, commitment, signingShare);
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
      aarray2(pub.commitments, "pub.commitments");
      validateObject(nonces, { hiding: "object", binding: "object" }, {}, "nonces");
      abytes3(nonces.hiding, Fn2.BYTES, "nonces.hiding");
      abytes3(nonces.binding, Fn2.BYTES, "nonces.binding");
      aarray2(commitmentList, "commitmentList");
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
      if (bytesToHex3(commitment.hiding) !== bytesToHex3(expectedCommitment.hiding) || bytesToHex3(commitment.binding) !== bytesToHex3(expectedCommitment.binding))
        throw new Error("incorrect signer commitment");
      if (adjustSecret)
        secret = adjustSecret(secret, pub);
      if (adjustPublic)
        pub = adjustPublic(pub);
      const SK = Fn2.fromBytes(secret.signingShare);
      const { lambda, challenge: challenge2, bindingFactor, groupCommitment } = prepareShare(pub.commitments[0], commitmentList, msg, secret.identifier);
      const N3 = adjustNonces ? adjustNonces(groupCommitment, nonces) : nonces;
      const hidingNonce = adjustNonces ? Fn2.fromBytes(N3.hiding) : hidingNonce0;
      const bindingNonce = adjustNonces ? Fn2.fromBytes(N3.binding) : bindingNonce0;
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
      aarray2(pub.commitments, "pub.commitments");
      aarray2(commitmentList, "commitmentList");
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
      aarray2(pub.commitments, "pub.commitments");
      aarray2(commitmentList, "commitmentList");
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
      for (const id2 of ids) {
        if (seen.has(id2))
          throw new AggErr("aggregation failed", []);
        seen.add(id2);
      }
      if (ids.length !== Object.keys(sigShares).length)
        throw new AggErr("aggregation failed", []);
      for (const id2 of ids) {
        if (!(id2 in sigShares) || !(id2 in pub.verifyingShares))
          throw new AggErr("aggregation failed", []);
      }
      const GPK = parsePoint(pub.commitments[0]);
      const { groupCommitment } = getGroupCommitment(GPK, commitmentList, msg);
      let z = Fn2.ZERO;
      for (const id2 of ids)
        z = Fn2.add(z, Fn2.fromBytes(sigShares[id2]));
      if (!Basic.verify(msg, groupCommitment, z, GPK)) {
        const cheaters = [];
        for (const id2 of ids) {
          if (!this.verifyShare(rawPub, commitmentList, msg, id2, sigShares[id2]))
            cheaters.push(id2);
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
      aarray2(shares, "shares");
      validateSigners(signers);
      if (shares.length < signers.min || shares.length > signers.max)
        throw new Error("wrong secret shares array");
      const points = [];
      const seen = {};
      for (const s of shares) {
        const idNum = parseIdentifier(s.identifier);
        const id2 = serializeIdentifier(idNum);
        if (seen[id2])
          throw new Error("duplicated id=" + id2);
        seen[id2] = true;
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
  return P + swap - (swap >> _1n7 << _1n7);
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
function validateOpts2(curve) {
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
  const CURVE = validateOpts2(curveDef);
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
  const minScalar = is25519 ? _2n5 ** BigInt(254) : _2n5 ** BigInt(447);
  const maxAdded = is25519 ? BigInt(8) * (_2n5 ** BigInt(251) - _1n7) : BigInt(4) * (_2n5 ** BigInt(445) - _1n7);
  const maxScalar = minScalar + maxAdded + _1n7;
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
    _0n8,
    _1n7,
    P - _1n7,
    BigInt("325606250916557431795983626356110631294008115727848805560023387167927233504"),
    BigInt("39382357235489614581723060781553021112529911719440698176882885853963445705823")
  ] : [_0n8, _1n7, P - _1n7]);
  function scalarMult(scalar, u) {
    const pointU = decodeU(u);
    if (lowOrderU.has(pointU))
      throw new Error("invalid private or public key received");
    const pu = montgomeryLadder(pointU, decodeScalar(scalar));
    if (pu === _0n8)
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
    if (pu === _0n8)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  __name(scalarMultBase, "scalarMultBase");
  const getPublicKey = scalarMultBase;
  const getSharedSecret = scalarMult;
  function montgomeryLadder(u, scalar) {
    aInRange("u", u, _0n8, P);
    aInRange("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = _1n7;
    let z_2 = _0n8;
    let x_3 = u;
    let z_3 = _1n7;
    const kx = k ^ k >> _1n7;
    for (let t = BigInt(montgomeryBits - 1); t >= _0n8; t--) {
      const mask2 = cmask(P, kx >> t);
      ({ x_2, x_3 } = swap(mask2, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = swap(mask2, z_2, z_3));
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B2 = x_2 - z_2;
      const BB = modP(B2 * B2);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D2 = x_3 - z_3;
      const DA = modP(D2 * A);
      const CB = modP(C * B2);
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
var _0n8, _1n7, _2n5;
var init_montgomery = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/montgomery.js"() {
    init_utils3();
    init_curve();
    init_modular();
    _0n8 = /* @__PURE__ */ BigInt(0);
    _1n7 = /* @__PURE__ */ BigInt(1);
    _2n5 = /* @__PURE__ */ BigInt(2);
    __name(cmask, "cmask");
    __name(cswap, "cswap");
    __name(validateOpts2, "validateOpts");
    __name(montgomery, "montgomery");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/oprf.js
function createOPRF(opts2) {
  validateObject(opts2, {
    name: "string",
    hash: "function",
    hashToScalar: "function",
    hashToGroup: "function"
  });
  validatePointCons(opts2.Point);
  const { name, Point, hash, hashToGroup: hashToGroupHook, hashToScalar } = opts2;
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
    return Fn2.isLE ? bytesToNumberLE(t) : bytesToNumberBE2(t);
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
        res2.push(numberToBytesBE2(a, 2));
      else if (typeof a === "string")
        res2.push(asciiToBytes(a));
      else {
        abytes3(a);
        res2.push(numberToBytesBE2(a.length, 2), a);
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
  function getTranscripts(B2, C, D2, ctx) {
    const Bm = B2.toBytes();
    const seed = hash(encode(Bm, concatBytes3(asciiToBytes("Seed-"), ctx)));
    const res2 = [];
    for (let i = 0; i < C.length; i++) {
      const Ci = C[i].toBytes();
      const Di = D2[i].toBytes();
      const di = hashToScalarPrefixed(encode(seed, i, Ci, Di, "Composite"), ctx);
      res2.push(di);
    }
    return res2;
  }
  __name(getTranscripts, "getTranscripts");
  function computeComposites(B2, C, D2, ctx) {
    const T = getTranscripts(B2, C, D2, ctx);
    const M = msm(C, T);
    const Z = msm(D2, T);
    return { M, Z };
  }
  __name(computeComposites, "computeComposites");
  function computeCompositesFast(k, B2, C, D2, ctx) {
    const T = getTranscripts(B2, C, D2, ctx);
    const M = msm(C, T);
    const Z = M.multiply(k);
    return { M, Z };
  }
  __name(computeCompositesFast, "computeCompositesFast");
  function challengeTranscript(B2, M, Z, t2, t3, ctx) {
    const [Bm, a0, a1, a2, a3] = [B2, M, Z, t2, t3].map((i) => i.toBytes());
    return hashToScalarPrefixed(encode(Bm, a0, a1, a2, a3, "Challenge"), ctx);
  }
  __name(challengeTranscript, "challengeTranscript");
  function generateProof(ctx, k, B2, C, D2, rng) {
    const { M, Z } = computeCompositesFast(k, B2, C, D2, ctx);
    const r = randomScalar(rng);
    const t2 = Point.BASE.multiply(r);
    const t3 = M.multiply(r);
    const c = challengeTranscript(B2, M, Z, t2, t3, ctx);
    const s = Fn2.sub(r, Fn2.mul(c, k));
    return concatBytes3(...[c, s].map((i) => Fn2.toBytes(i)));
  }
  __name(generateProof, "generateProof");
  function verifyProof(ctx, B2, C, D2, proof) {
    abytes3(proof, 2 * Fn2.BYTES);
    const { M, Z } = computeComposites(B2, C, D2, ctx);
    const [c, s] = [proof.subarray(0, Fn2.BYTES), proof.subarray(Fn2.BYTES)].map((f) => Fn2.fromBytes(f));
    const t2 = msm([Point.BASE, B2], [s, c]);
    const t3 = msm([M, Z], [s, c]);
    const expectedC = challengeTranscript(B2, M, Z, t2, t3, ctx);
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
  const b4 = pow2(b2, _2n6, P) * b2 % P;
  const b5 = pow2(b4, _1n8, P) * x % P;
  const b10 = pow2(b5, _5n2, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n6, P) * x % P;
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
  return Fp.toBytes(Fp.div(_1n8 + y, _1n8 - y));
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
function ed(opts2) {
  return eddsa(ed25519_Point, sha512, Object.assign({ adjustScalarBytes, toMontgomery, toMontgomerySecret, zip215: true }, opts2));
}
function _map_to_curve_elligator2_curve25519(u) {
  let tv1 = Fp.sqr(u);
  tv1 = Fp.mul(tv1, _2n6);
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
  return { xMn: xn, xMd: xd, yMn: y, yMd: _1n8 };
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
  const Ns = Fp.mul(Fp.addN(r, _1n8), ONE_MINUS_D_SQ);
  let c = BigInt(-1);
  const D2 = Fp.mul(Fp.subN(c, Fp.mulN(d, r)), Fp.add(r, d));
  let { isValid: Ns_D_is_sq, value: s } = uvRatio(Ns, D2);
  let s_ = Fp.mul(s, r0);
  if (!Fp.isOdd(s_))
    s_ = Fp.neg(s_);
  if (!Ns_D_is_sq)
    s = s_;
  if (!Ns_D_is_sq)
    c = r;
  const Nt = Fp.sub(Fp.mulN(Fp.mulN(c, Fp.subN(r, _1n8)), D_MINUS_ONE_SQ), D2);
  const s2 = Fp.sqrN(s);
  const W0 = Fp.mul(Fp.addN(s, s), D2);
  const W1 = Fp.mul(Nt, SQRT_AD_MINUS_ONE);
  const W2 = Fp.sub(_1n8, s2);
  const W3 = Fp.add(_1n8, s2);
  return new ed25519_Point(Fp.mul(W0, W3), Fp.mul(W2, W1), Fp.mul(W1, W3), Fp.mul(W0, W2));
}
var _0n9, _1n8, _2n6, _3n3, _5n2, _8n3, ed25519_CURVE_p, ed25519_CURVE, ED25519_SQRT_M1, ed25519_Point, Fp, Fn, ed25519, ed25519ctx, ed25519ph, ed25519_FROST, x25519, ELL2_C1, ELL2_C2, ELL2_C3, ELL2_J, ELL2_C1_EDWARDS, ed25519_hasher, SQRT_M1, SQRT_AD_MINUS_ONE, INVSQRT_A_MINUS_D, ONE_MINUS_D_SQ, D_MINUS_ONE_SQ, invertSqrt, MAX_255B, bytes255ToNumberLE, _RistrettoPoint, ristretto255, ristretto255_hasher, ristretto255_oprf, ristretto255_FROST, ED25519_TORSION_SUBGROUP;
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
    _0n9 = /* @__PURE__ */ BigInt(0);
    _1n8 = /* @__PURE__ */ BigInt(1);
    _2n6 = /* @__PURE__ */ BigInt(2);
    _3n3 = /* @__PURE__ */ BigInt(3);
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
        return mod(pow2(pow_p_5_8, _3n3, P) * b2, P);
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
          if (kn === _0n9)
            return _0n9;
          const p = ed25519_Point.BASE.multiply(kn);
          return mod((p.Z + p.Y) * powPminus2(mod(p.Z - p.Y, P)), P);
        }, "scalarMultBase")
      });
    })();
    ELL2_C1 = /* @__PURE__ */ (() => (ed25519_CURVE_p + _3n3) / _8n3)();
    ELL2_C2 = /* @__PURE__ */ (() => Fp.pow(_2n6, ELL2_C1))();
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
    invertSqrt = /* @__PURE__ */ __name((number) => uvRatio(_1n8, number), "invertSqrt");
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
        const u1 = Fp.add(_1n8, Fp.mulN(a, s2));
        const u2 = Fp.sub(_1n8, Fp.mulN(a, s2));
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
        let D3;
        if (Fp.isOdd(Fp.mul(T, zInv))) {
          let _x = Fp.mul(Y, SQRT_M1);
          let _y = Fp.mul(X, SQRT_M1);
          X = _x;
          Y = _y;
          D3 = Fp.mul(D1, INVSQRT_A_MINUS_D);
        } else {
          D3 = D2;
        }
        if (Fp.isOdd(Fp.mul(X, zInv)))
          Y = Fp.neg(Y);
        let s = Fp.mul(Fp.subN(Z, Y), D3);
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

// node_modules/node-onlykey-lib/src/crypto/age_pqc.js
var require_age_pqc = __commonJS({
  "node_modules/node-onlykey-lib/src/crypto/age_pqc.js"(exports, module) {
    var { ml_kem768: ml_kem7682 } = require_ml_kem();
    var { shake256: shake2562, sha3_256: sha3_2562 } = require_sha3();
    var { sha256: sha2562 } = require_sha2();
    var { x25519: x255192 } = require_ed25519();
    var { utf8ToBytes: utf8ToBytes3, bytesToUtf8: bytesToUtf82 } = require_bytes();
    var MLKEM_PK = 1184;
    var MLKEM_CT = 1088;
    var XWING_PK = 1216;
    var XWING_CT = 1120;
    var SEED = 32;
    var XWING_LABEL = Uint8Array.from([92, 46, 47, 47, 94, 92]);
    function concatBytes4(...arrays) {
      const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
      let offset = 0;
      for (const a of arrays) {
        out.set(a, offset);
        offset += a.length;
      }
      return out;
    }
    __name(concatBytes4, "concatBytes");
    function deriveLabelTag(label) {
      return sha2562(utf8ToBytes3(label));
    }
    __name(deriveLabelTag, "deriveLabelTag");
    function mlkemKeypairFromSeed(mlkemSeed) {
      if (mlkemSeed.length !== SEED) {
        throw new Error(`mlkem_seed must be ${SEED} bytes, got ${mlkemSeed.length}`);
      }
      const seed64 = shake2562(mlkemSeed, { dkLen: 64 });
      return ml_kem7682.keygen(seed64);
    }
    __name(mlkemKeypairFromSeed, "mlkemKeypairFromSeed");
    function buildRecipient(pkX, mlkemSeed) {
      if (pkX.length !== 32) {
        throw new Error(`pk_X must be 32 bytes, got ${pkX.length}`);
      }
      const { publicKey: pkM } = mlkemKeypairFromSeed(mlkemSeed);
      return concatBytes4(pkM, pkX);
    }
    __name(buildRecipient, "buildRecipient");
    function xwingCombiner(ssM, ssX, ctX, pkX) {
      return sha3_2562(concatBytes4(ssM, ssX, ctX, pkX, XWING_LABEL));
    }
    __name(xwingCombiner, "xwingCombiner");
    function splitDecapsulate(ssX, ciphertext, pkX, mlkemSeed) {
      if (ssX.length !== 32) throw new Error("ss_X must be 32 bytes");
      if (ciphertext.length !== XWING_CT) {
        throw new Error(`X-Wing ct must be ${XWING_CT} bytes, got ${ciphertext.length}`);
      }
      const ctM = ciphertext.subarray(0, MLKEM_CT);
      const ctX = ciphertext.subarray(MLKEM_CT, XWING_CT);
      const { secretKey: skM } = mlkemKeypairFromSeed(mlkemSeed);
      const ssM = ml_kem7682.decapsulate(ctM, skM);
      return xwingCombiner(ssM, ssX, ctX, pkX);
    }
    __name(splitDecapsulate, "splitDecapsulate");
    function ctXOf(ciphertext) {
      return ciphertext.subarray(MLKEM_CT, XWING_CT);
    }
    __name(ctXOf, "ctXOf");
    function xwingEncapsHost(pk) {
      if (pk.length !== XWING_PK) {
        throw new Error(`X-Wing pk must be ${XWING_PK} bytes, got ${pk.length}`);
      }
      const pkM = pk.subarray(0, MLKEM_PK);
      const pkX = pk.subarray(MLKEM_PK, XWING_PK);
      const ekX = x255192.utils.randomSecretKey();
      const ctX = x255192.getPublicKey(ekX);
      const ssX = x255192.getSharedSecret(ekX, pkX);
      const { cipherText: ctM, sharedSecret: ssM } = ml_kem7682.encapsulate(pkM);
      const ss = xwingCombiner(ssM, ssX, ctX, pkX);
      const ct = concatBytes4(ctM, ctX);
      return { sharedSecret: ss, ciphertext: ct };
    }
    __name(xwingEncapsHost, "xwingEncapsHost");
    var BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    var BECH32_GEN = [996825010, 642813549, 513874426, 1027748829, 705979059];
    function bech32Polymod(values) {
      let chk = 1;
      for (const v of values) {
        const b = chk >>> 25;
        chk = (chk & 33554431) << 5 ^ v;
        for (let i = 0; i < 5; i++) {
          if (b >>> i & 1) chk ^= BECH32_GEN[i];
        }
      }
      return chk >>> 0;
    }
    __name(bech32Polymod, "bech32Polymod");
    function bech32HrpExpand(hrp) {
      const out = [];
      for (const ch of hrp) out.push(ch.charCodeAt(0) >>> 5);
      out.push(0);
      for (const ch of hrp) out.push(ch.charCodeAt(0) & 31);
      return out;
    }
    __name(bech32HrpExpand, "bech32HrpExpand");
    function bech32CreateChecksum(hrp, data) {
      const values = bech32HrpExpand(hrp).concat(data);
      const polymod = bech32Polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ 1;
      const out = [];
      for (let i = 0; i < 6; i++) out.push(polymod >>> 5 * (5 - i) & 31);
      return out;
    }
    __name(bech32CreateChecksum, "bech32CreateChecksum");
    function bech32VerifyChecksum(hrp, data) {
      return bech32Polymod(bech32HrpExpand(hrp).concat(data)) === 1;
    }
    __name(bech32VerifyChecksum, "bech32VerifyChecksum");
    function convertBits(data, fromBits, toBits, pad) {
      let acc = 0;
      let bits = 0;
      const ret = [];
      const maxv = (1 << toBits) - 1;
      for (const value of data) {
        if (value < 0 || value >> fromBits !== 0) return null;
        acc = acc << fromBits | value;
        bits += fromBits;
        while (bits >= toBits) {
          bits -= toBits;
          ret.push(acc >>> bits & maxv);
        }
      }
      if (pad) {
        if (bits > 0) ret.push(acc << toBits - bits & maxv);
      } else if (bits >= fromBits || (acc << toBits - bits & maxv) !== 0) {
        return null;
      }
      return ret;
    }
    __name(convertBits, "convertBits");
    function bech32Encode(hrp, data) {
      const values = convertBits(Array.from(data), 8, 5, true);
      const checksum = bech32CreateChecksum(hrp, values);
      return hrp + "1" + values.concat(checksum).map((d) => BECH32_CHARSET[d]).join("");
    }
    __name(bech32Encode, "bech32Encode");
    function bech32Decode(bech) {
      for (const ch of bech) {
        const code = ch.charCodeAt(0);
        if (code < 33 || code > 126) return { hrp: null, data: null };
      }
      bech = bech.toLowerCase();
      const pos = bech.lastIndexOf("1");
      if (pos < 1 || pos + 7 > bech.length) return { hrp: null, data: null };
      const hrp = bech.slice(0, pos);
      const data = [];
      for (const ch of bech.slice(pos + 1)) {
        const idx = BECH32_CHARSET.indexOf(ch);
        if (idx === -1) return { hrp: null, data: null };
        data.push(idx);
      }
      if (!bech32VerifyChecksum(hrp, data)) return { hrp: null, data: null };
      const decoded = convertBits(data.slice(0, -6), 5, 8, false);
      if (decoded === null) return { hrp: null, data: null };
      return { hrp, data: Uint8Array.from(decoded) };
    }
    __name(bech32Decode, "bech32Decode");
    var RECIPIENT_HRP = "age1onlykey";
    function encodeRecipient(pubkey) {
      return bech32Encode(RECIPIENT_HRP, pubkey);
    }
    __name(encodeRecipient, "encodeRecipient");
    function decodeRecipient(recipient) {
      const { hrp, data } = bech32Decode(String(recipient).trim().toLowerCase());
      if (hrp !== RECIPIENT_HRP || data === null) {
        throw new Error(`not a valid ${RECIPIENT_HRP} recipient: ${recipient}`);
      }
      return data;
    }
    __name(decodeRecipient, "decodeRecipient");
    var X25519_RECIPIENT_HRP = "age";
    function encodeX25519Recipient(pubkey) {
      const key = Uint8Array.from(pubkey || []);
      if (key.length !== 32) throw new Error(`an age X25519 recipient is a 32-byte public key, not ${key.length} bytes`);
      return bech32Encode(X25519_RECIPIENT_HRP, key);
    }
    __name(encodeX25519Recipient, "encodeX25519Recipient");
    function decodeX25519Recipient(recipient) {
      const text2 = String(recipient).trim();
      const { hrp, data } = text2 === text2.toLowerCase() ? bech32Decode(text2) : { hrp: null, data: null };
      if (hrp !== X25519_RECIPIENT_HRP || data === null || data.length !== 32) {
        throw new Error(`not a valid age X25519 recipient (age1...): ${recipient}`);
      }
      return data;
    }
    __name(decodeX25519Recipient, "decodeX25519Recipient");
    var IDENTITY_HRP = "age-plugin-onlykey-";
    var DERIVED_MARKER = 255;
    function encodeIdentity(label) {
      if (typeof label !== "string" || !label) {
        throw new Error("derived identity needs a non-empty label");
      }
      const payload = concatBytes4(Uint8Array.of(DERIVED_MARKER), utf8ToBytes3(label));
      return bech32Encode(IDENTITY_HRP, payload).toUpperCase();
    }
    __name(encodeIdentity, "encodeIdentity");
    var IDENTITY_VERSION = 1;
    var IDENTITY_FINGERPRINT_LEN = 8;
    function recipientFingerprint(pubkey) {
      return sha2562(Uint8Array.from(pubkey)).subarray(0, IDENTITY_FINGERPRINT_LEN);
    }
    __name(recipientFingerprint, "recipientFingerprint");
    function encodeSlotIdentity(slot, pubkey = null) {
      if (!Number.isInteger(slot) || slot < 101 || slot > 116) {
        throw new Error(`an age identity slot is 101..116; ${slot} is not one`);
      }
      const payload = pubkey ? concatBytes4(
        Uint8Array.of(IDENTITY_VERSION, slot),
        recipientFingerprint(pubkey)
      ) : Uint8Array.of(slot);
      return bech32Encode(IDENTITY_HRP, payload).toUpperCase();
    }
    __name(encodeSlotIdentity, "encodeSlotIdentity");
    function decodeIdentity(s) {
      const { hrp, data } = bech32Decode(String(s).trim().toLowerCase());
      if (hrp !== IDENTITY_HRP || !data || data.length < 1) return null;
      if (data[0] === DERIVED_MARKER) {
        return { derived: true, label: bytesToUtf82(data.subarray(1)) };
      }
      if (data.length === 1) {
        return { derived: false, slot: data[0], fingerprint: null, legacy: true };
      }
      if (data.length !== 2 + IDENTITY_FINGERPRINT_LEN) return null;
      if (data[0] !== IDENTITY_VERSION) return null;
      return {
        derived: false,
        slot: data[1],
        fingerprint: data.subarray(2),
        legacy: false
      };
    }
    __name(decodeIdentity, "decodeIdentity");
    function identityMatchesKey(identity, pubkey) {
      if (!identity || identity.derived || !identity.fingerprint) return true;
      const expected = recipientFingerprint(pubkey);
      if (expected.length !== identity.fingerprint.length) return false;
      let same = 0;
      for (let i = 0; i < expected.length; i++) same |= expected[i] ^ identity.fingerprint[i];
      return same === 0;
    }
    __name(identityMatchesKey, "identityMatchesKey");
    module.exports = {
      /*
       * DEPRECATED, split custody only (see the header): mlkemKeypairFromSeed,
       * buildRecipient, splitDecapsulate, ctXOf. Still exported - consumers pin
       * this library by hash, and a removed export breaks them at load.
       */
      mlkemKeypairFromSeed,
      buildRecipient,
      xwingCombiner,
      splitDecapsulate,
      ctXOf,
      xwingEncapsHost,
      deriveLabelTag,
      encodeRecipient,
      decodeRecipient,
      encodeX25519Recipient,
      decodeX25519Recipient,
      X25519_RECIPIENT_HRP,
      encodeIdentity,
      encodeSlotIdentity,
      decodeIdentity,
      identityMatchesKey,
      recipientFingerprint,
      IDENTITY_VERSION,
      IDENTITY_FINGERPRINT_LEN,
      XWING_LABEL,
      MLKEM_PK,
      MLKEM_CT,
      XWING_PK,
      XWING_CT,
      SEED,
      /*
       * The encoding underneath the recipient and identity strings, exported for
       * onlykey-testing, whose age-pqc.js carried its own copies of these: a
       * test that builds or reads an age1onlykey... / age-plugin-onlykey-...
       * string by hand needs the same bech32 (BIP-173 checksum, no 90-character
       * cap - a 1216-byte recipient does not fit one) and the same prefixes.
       * Checked identical to the kit's before it switched: 20/20 encode and
       * decode, both prefixes, 0..1216 bytes.
       */
      bech32Encode,
      bech32Decode,
      RECIPIENT_HRP,
      IDENTITY_HRP,
      DERIVED_MARKER
    };
  }
});

// node_modules/node-onlykey-lib/keychain/src/artifacts.js
var require_artifacts = __commonJS({
  "node_modules/node-onlykey-lib/keychain/src/artifacts.js"(exports, module) {
    "use strict";
    var { toHex, toBase64 } = require_bytes();
    var ssh = require_ssh_pub();
    var pqc = require_age_pqc();
    function forKey({ type, publicKey, comment, pgp }) {
      if (type === "composite") return pgp ? { pgp } : {};
      const out = { hex: toHex(publicKey), base64: toBase64(publicKey) };
      if (type === "ed25519") out.ssh = ssh.publicKeyLine("ed25519", publicKey, comment);
      else if (type === "p256") out.ssh = ssh.publicKeyLine("nist256p1", publicKey, comment);
      else if (type === "rsa") out.ssh = ssh.rsaPublicKeyLine(publicKey, comment);
      else if (type === "x25519") out.age = pqc.encodeX25519Recipient(publicKey);
      else if (type === "xwing") out.age = pqc.encodeRecipient(publicKey);
      return out;
    }
    __name(forKey, "forKey");
    module.exports = { forKey };
  }
});

// node_modules/node-onlykey-lib/src/crypto/public-only.js
var require_public_only = __commonJS({
  "node_modules/node-onlykey-lib/src/crypto/public-only.js"(exports, module) {
    "use strict";
    var PRIVATE_FIELDS = ["secret", "privateKey", "private", "scalar", "seed", "d", "p", "q", "dp", "dq", "qi", "blob"];
    var PRIVATE_TEXT = /PRIVATE KEY|AGE-SECRET-KEY-|-----BEGIN PGP PRIVATE/i;
    function refusePrivate(value, where, holder = "the Key Chain list") {
      if (value && typeof value === "object" && !(value instanceof Uint8Array)) {
        for (const [k, v] of Object.entries(value)) {
          if (PRIVATE_FIELDS.includes(k)) {
            throw new Error(`${holder} holds public data only - "${where}.${k}" looks like a private key`);
          }
          refusePrivate(v, `${where}.${k}`, holder);
        }
      } else if (typeof value === "string" && PRIVATE_TEXT.test(value)) {
        throw new Error(`${holder} holds public data only - "${where}" contains private key text`);
      }
    }
    __name(refusePrivate, "refusePrivate");
    var isPrivateText = /* @__PURE__ */ __name((text2) => typeof text2 === "string" && PRIVATE_TEXT.test(text2), "isPrivateText");
    module.exports = { PRIVATE_FIELDS, PRIVATE_TEXT, refusePrivate, isPrivateText };
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/ciphers/utils.js
var require_utils = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/ciphers/utils.js"(exports, module) {
    module.exports = (init_utils2(), __toCommonJS(utils_exports));
  }
});

// node_modules/node-onlykey-lib/src/crypto/der.js
var require_der = __commonJS({
  "node_modules/node-onlykey-lib/src/crypto/der.js"(exports, module) {
    "use strict";
    var { concat } = require_bytes();
    function derLength(n) {
      if (n < 128) return Uint8Array.of(n);
      const out = [];
      for (let v = n; v > 0; v = Math.floor(v / 256)) out.unshift(v & 255);
      return Uint8Array.of(128 | out.length, ...out);
    }
    __name(derLength, "derLength");
    var tlv = /* @__PURE__ */ __name((tag, content) => concat([Uint8Array.of(tag), derLength(content.length), content]), "tlv");
    var sequence = /* @__PURE__ */ __name((...items) => tlv(48, concat(items)), "sequence");
    var octets = /* @__PURE__ */ __name((bytes3) => tlv(4, bytes3), "octets");
    var NULL = Uint8Array.of(5, 0);
    function integer(value) {
      let bytes3;
      if (typeof value === "bigint" || typeof value === "number") {
        let v = BigInt(value);
        const out = [];
        do {
          out.unshift(Number(v & 0xffn));
          v >>= 8n;
        } while (v > 0n);
        bytes3 = Uint8Array.from(out);
      } else {
        let start = 0;
        while (start < value.length - 1 && value[start] === 0) start++;
        bytes3 = value.subarray(start);
      }
      if (bytes3[0] & 128) bytes3 = concat([Uint8Array.of(0), bytes3]);
      return tlv(2, bytes3);
    }
    __name(integer, "integer");
    function oid(dotted) {
      const parts = dotted.split(".").map(Number);
      const out = [40 * parts[0] + parts[1]];
      for (const part of parts.slice(2)) {
        const groups = [];
        let v = part;
        do {
          groups.unshift(v & 127);
          v = Math.floor(v / 128);
        } while (v > 0);
        for (let i = 0; i < groups.length - 1; i++) groups[i] |= 128;
        out.push(...groups);
      }
      return tlv(6, Uint8Array.from(out));
    }
    __name(oid, "oid");
    module.exports = { derLength, tlv, sequence, octets, NULL, integer, oid };
  }
});

// node_modules/node-onlykey-lib/src/crypto/x509.js
var require_x509 = __commonJS({
  "node_modules/node-onlykey-lib/src/crypto/x509.js"(exports, module) {
    "use strict";
    var { sha256: sha2562, sha512: sha5122 } = require_sha2();
    var { randomBytes: randomBytes5 } = require_utils();
    var { concat, utf8ToBytes: utf8ToBytes3, toBase64, fromBase64 } = require_bytes();
    var { tlv, sequence, NULL, integer, oid } = require_der();
    var OID = {
      rsaEncryption: "1.2.840.113549.1.1.1",
      sha256WithRSAEncryption: "1.2.840.113549.1.1.11",
      sha512WithRSAEncryption: "1.2.840.113549.1.1.13",
      countryName: "2.5.4.6",
      organizationName: "2.5.4.10",
      organizationalUnitName: "2.5.4.11",
      commonName: "2.5.4.3"
    };
    var HASHES = {
      sha256: { digest: sha2562, algorithm: OID.sha256WithRSAEncryption },
      sha512: { digest: sha5122, algorithm: OID.sha512WithRSAEncryption }
    };
    var bitString = /* @__PURE__ */ __name((bytes3) => tlv(3, concat([Uint8Array.of(0), bytes3])), "bitString");
    var unsigned = /* @__PURE__ */ __name((b) => {
      let i = 0;
      while (i < b.length - 1 && b[i] === 0) i++;
      return b.subarray(i);
    }, "unsigned");
    function name(n) {
      if (!n || !String(n.CN || "").trim()) throw new TypeError("x509: a certificate names its subject (CN at least)");
      const rdn = /* @__PURE__ */ __name((type, value) => tlv(49, sequence(oid(type), value)), "rdn");
      const parts = [];
      if (n.C !== void 0) {
        if (!/^[A-Z]{2}$/.test(String(n.C))) throw new TypeError("x509: C is a two-letter country code");
        parts.push(rdn(OID.countryName, tlv(19, utf8ToBytes3(n.C))));
      }
      if (n.O !== void 0) parts.push(rdn(OID.organizationName, tlv(12, utf8ToBytes3(String(n.O)))));
      if (n.OU !== void 0) parts.push(rdn(OID.organizationalUnitName, tlv(12, utf8ToBytes3(String(n.OU)))));
      parts.push(rdn(OID.commonName, tlv(12, utf8ToBytes3(String(n.CN)))));
      return sequence(...parts);
    }
    __name(name, "name");
    function time(d) {
      const p = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "p");
      const y = d.getUTCFullYear();
      const rest = `${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
      return y < 2050 ? tlv(23, utf8ToBytes3(`${p(y % 100)}${rest}`)) : tlv(24, utf8ToBytes3(`${y}${rest}`));
    }
    __name(time, "time");
    function rsaPublicKeyInfo(modulus, exponent = 65537) {
      return sequence(sequence(oid(OID.rsaEncryption), NULL), bitString(sequence(integer(unsigned(modulus)), integer(exponent))));
    }
    __name(rsaPublicKeyInfo, "rsaPublicKeyInfo");
    async function selfSigned({ modulus, exponent = 65537, subject, notBefore = /* @__PURE__ */ new Date(), days = 365 * 30, hash, serial, sign }) {
      const n = unsigned(Uint8Array.from(modulus || []));
      if (n.length < 128 || n.length > 512) throw new TypeError(`x509: an RSA modulus of 1024 to 4096 bits, not ${n.length * 8}`);
      const h = HASHES[hash || (n.length > 384 ? "sha512" : "sha256")];
      if (!h) throw new TypeError(`x509: hash sha256 or sha512, not ${JSON.stringify(hash)}`);
      if (!Number.isInteger(days) || days < 1) throw new TypeError("x509: days is a whole number, 1 or more");
      const sn = Uint8Array.from(serial || randomBytes5(16));
      sn[0] = sn[0] & 127 | 1;
      const algorithm = sequence(oid(h.algorithm), NULL);
      const subjectName = name(subject);
      const notAfter = new Date(notBefore.getTime() + days * 864e5);
      const tbs = sequence(
        tlv(160, integer(2)),
        /* v3 */
        integer(sn),
        algorithm,
        subjectName,
        sequence(time(notBefore), time(notAfter)),
        subjectName,
        rsaPublicKeyInfo(n, exponent)
      );
      const signature = Uint8Array.from(await sign(h.digest(tbs)));
      if (signature.length !== n.length) throw new Error(`x509: the key's signature is ${signature.length} bytes, not ${n.length} (its modulus)`);
      return sequence(tbs, algorithm, bitString(signature));
    }
    __name(selfSigned, "selfSigned");
    function toPem(der) {
      const b64 = toBase64(der);
      return `-----BEGIN CERTIFICATE-----
${b64.match(/.{1,64}/g).join("\n")}
-----END CERTIFICATE-----
`;
    }
    __name(toPem, "toPem");
    function derRead(bytes3, at) {
      const tag = bytes3[at];
      let len = bytes3[at + 1];
      let head = 2;
      if (len === void 0) throw new Error("x509: a DER element runs past the end");
      if (len & 128) {
        const n = len & 127;
        if (n < 1 || n > 3) throw new Error("x509: a DER length this reader does not take");
        len = 0;
        for (let i = 0; i < n; i++) len = len * 256 + bytes3[at + 2 + i];
        head = 2 + n;
      }
      const start = at + head;
      const end = start + len;
      if (end > bytes3.length) throw new Error("x509: a DER element runs past the end");
      return { tag, start, end, all: bytes3.subarray(at, end) };
    }
    __name(derRead, "derRead");
    function derChildren(bytes3, el) {
      const out = [];
      for (let at = el.start; at < el.end; ) {
        const c = derRead(bytes3, at);
        out.push(c);
        at = c.end;
      }
      return out;
    }
    __name(derChildren, "derChildren");
    function oidText(b) {
      const parts = [Math.floor(b[0] / 40), b[0] % 40];
      for (let i = 1, v = 0; i < b.length; i++) {
        v = v * 128 + (b[i] & 127);
        if (!(b[i] & 128)) {
          parts.push(v);
          v = 0;
        }
      }
      return parts.join(".");
    }
    __name(oidText, "oidText");
    var READ_SIGNATURES = {
      "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
      [OID.sha256WithRSAEncryption]: "sha256WithRSAEncryption",
      "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
      [OID.sha512WithRSAEncryption]: "sha512WithRSAEncryption"
    };
    var NAME_KEYS = { [OID.commonName]: "CN", [OID.organizationName]: "O", [OID.organizationalUnitName]: "OU", [OID.countryName]: "C" };
    function nameOf(bytes3, el) {
      const out = {};
      for (const set of derChildren(bytes3, el)) {
        for (const atv of derChildren(bytes3, set)) {
          const [type, value] = derChildren(bytes3, atv);
          const key = NAME_KEYS[oidText(bytes3.subarray(type.start, type.end))];
          if (key) out[key] = new TextDecoder().decode(bytes3.subarray(value.start, value.end));
        }
      }
      return out;
    }
    __name(nameOf, "nameOf");
    function timeOf(bytes3, el) {
      const t = new TextDecoder().decode(bytes3.subarray(el.start, el.end));
      const full = el.tag === 23 ? `${Number(t.slice(0, 2)) < 50 ? "20" : "19"}${t}` : t;
      return `${full.slice(0, 4)}-${full.slice(4, 6)}-${full.slice(6, 8)}T${full.slice(8, 10)}:${full.slice(10, 12)}:${full.slice(12, 14)}Z`;
    }
    __name(timeOf, "timeOf");
    function read(input) {
      let der = input;
      if (typeof input === "string") {
        const m = /-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/.exec(input);
        if (!m) throw new Error("x509: not a PEM certificate (no BEGIN CERTIFICATE block)");
        der = fromBase64(m[1].replace(/\s+/g, ""));
      }
      der = Uint8Array.from(der);
      const cert = derRead(der, 0);
      if (cert.tag !== 48 || cert.end !== der.length) throw new Error("x509: not one DER certificate");
      const [tbsEl, algEl, sigEl] = derChildren(der, cert);
      if (!tbsEl || !algEl || !sigEl || sigEl.tag !== 3) throw new Error("x509: a certificate is to-be-signed, algorithm, signature");
      const tbsParts = derChildren(der, tbsEl);
      const f = tbsParts[0].tag === 160 ? tbsParts.slice(1) : tbsParts;
      const [, , issuerEl, validityEl, subjectEl, spkiEl] = f;
      const [nb, na] = derChildren(der, validityEl);
      const [spkiAlg, spkiBits] = derChildren(der, spkiEl);
      const keyOid = oidText(der.subarray(derChildren(der, spkiAlg)[0].start, derChildren(der, spkiAlg)[0].end));
      if (keyOid !== OID.rsaEncryption) throw new Error(`x509: an RSA certificate is read here; its key is ${keyOid}`);
      const rsaKey = derRead(der, spkiBits.start + 1);
      const [nEl, eEl] = derChildren(der, rsaKey);
      const modulus = unsigned(der.subarray(nEl.start, nEl.end));
      const sigAlg = oidText(der.subarray(derChildren(der, algEl)[0].start, derChildren(der, algEl)[0].end));
      return {
        der,
        subject: nameOf(der, subjectEl),
        issuer: nameOf(der, issuerEl),
        notBefore: timeOf(der, nb),
        notAfter: timeOf(der, na),
        modulus,
        exponent: unsigned(der.subarray(eEl.start, eEl.end)),
        bits: modulus.length * 8,
        /* by name when known (READ_SIGNATURES - the ones a host may check: Android's debug certificate is SHA-1), else its OID */
        signatureAlgorithm: READ_SIGNATURES[sigAlg] || sigAlg,
        tbs: tbsEl.all,
        signature: der.subarray(sigEl.start + 1, sigEl.end),
        sha256: Array.from(sha2562(der), (b) => b.toString(16).padStart(2, "0")).join("")
      };
    }
    __name(read, "read");
    module.exports = { selfSigned, toPem, read, rsaPublicKeyInfo, name, OID };
  }
});

// node_modules/node-onlykey-lib/keychain/src/list.js
var require_list = __commonJS({
  "node_modules/node-onlykey-lib/keychain/src/list.js"(exports, module) {
    "use strict";
    var { toHex, fromHex } = require_bytes();
    var { sha256: sha2562 } = require_sha2();
    var artifacts = require_artifacts();
    var FORMAT = "onlykey-keychain";
    var VERSION = 1;
    var KINDS2 = ["slot", "derived", "external"];
    var TYPES = ["ed25519", "x25519", "p256", "secp256k1", "rsa", "mlkem768", "xwing", "composite"];
    var OWN_FIELDS = ["yours", "own", "mine", "ownIdentity"];
    var { refusePrivate } = require_public_only();
    function entryId(e) {
      const where = e.kind === "slot" ? `slot${e.slot}` : e.kind === "derived" ? `${e.scheme}:${e.label}` : e.name || "";
      const material = e.publicKey.length || !e.pgpFingerprint ? e.publicKey : new TextEncoder().encode(e.pgpFingerprint);
      return `${e.kind}:${where}:${e.type}:${toHex(sha2562(material)).slice(0, 16)}`;
    }
    __name(entryId, "entryId");
    function createEntry(fields) {
      refusePrivate(fields, "entry");
      const e = { ...fields };
      for (const k of OWN_FIELDS) delete e[k];
      if (!KINDS2.includes(e.kind)) throw new Error(`entry kind is one of ${KINDS2.join(", ")}; got "${e.kind}"`);
      if (!TYPES.includes(e.type)) throw new Error(`entry type is one of ${TYPES.join(", ")}; got "${e.type}"`);
      e.publicKey = typeof e.publicKey === "string" ? fromHex(e.publicKey) : Uint8Array.from(e.publicKey || []);
      if (!e.publicKey.length && e.type !== "composite") throw new Error("an entry needs its public key");
      if (e.kind === "slot" && !Number.isInteger(e.slot)) throw new Error("a slot entry needs its slot number");
      if (e.kind === "derived" && (!e.scheme || !e.label)) throw new Error("a derived entry needs its scheme and label");
      if (e.kind === "derived" && (e.scheme === "ssh" || e.scheme === "gpg") && String(e.label).startsWith(`${e.scheme}://`)) {
        e.label = String(e.label).slice(e.scheme.length + 3);
      }
      if (e.pgp !== void 0 && (typeof e.pgp !== "string" || !/BEGIN PGP PUBLIC KEY BLOCK/.test(e.pgp))) {
        throw new Error("an entry's pgp is an armored PUBLIC key block");
      }
      if (e.revocation !== void 0 && (typeof e.revocation !== "string" || !/BEGIN PGP PUBLIC KEY BLOCK/.test(e.revocation))) {
        throw new Error("an entry revocation is an armored PUBLIC key block");
      }
      if (e.x509 !== void 0) {
        if (typeof e.x509 !== "string" || !/BEGIN CERTIFICATE/.test(e.x509)) throw new Error("an entry's x509 is a PEM certificate");
        if (e.type !== "rsa") throw new Error("an entry keeps an x509 certificate for an RSA key");
        const cert = require_x509().read(e.x509);
        if (toHex(cert.modulus) !== toHex(e.publicKey)) throw new Error("the certificate's public key is not this entry's key");
      }
      if (!e.artifacts && (e.publicKey.length || e.pgp)) {
        try {
          e.artifacts = artifacts.forKey({ type: e.type, publicKey: e.publicKey, pgp: e.pgp });
        } catch (_) {
          e.artifacts = {};
        }
      }
      e.created = e.created || (/* @__PURE__ */ new Date()).toISOString();
      e.id = entryId(e);
      return e;
    }
    __name(createEntry, "createEntry");
    function serialize(entries) {
      return JSON.stringify({
        format: FORMAT,
        version: VERSION,
        entries: entries.map((e) => ({ ...e, publicKey: toHex(e.publicKey) }))
      }, null, 2);
    }
    __name(serialize, "serialize");
    function parse(text2) {
      let doc;
      try {
        doc = JSON.parse(String(text2));
      } catch (err) {
        throw new Error(`not a Key Chain file (${err.message})`);
      }
      if (!doc || doc.format !== FORMAT) throw new Error('not a Key Chain file (no "onlykey-keychain" format)');
      if (doc.version !== VERSION) throw new Error(`Key Chain file version ${doc.version}; this reads ${VERSION}`);
      if (!Array.isArray(doc.entries)) throw new Error("a Key Chain file has an entries list");
      return doc.entries.map(createEntry);
    }
    __name(parse, "parse");
    function merge(existing, incoming) {
      const byId = new Map(existing.map((e) => [e.id, e]));
      let added = 0;
      let paired = 0;
      let joined = 0;
      for (const e of incoming) {
        if (byId.has(e.id)) {
          const cur = byId.get(e.id);
          const one = combine(cur, e);
          if (sameEntry(one, cur)) {
            if (one.lastSeen !== cur.lastSeen) byId.set(one.id, one);
            continue;
          }
          byId.set(one.id, one);
          joined += 1;
          continue;
        }
        const twin = findTwin([...byId.values()], e);
        if (twin) {
          const one = combine(twin, e);
          byId.delete(twin.id);
          byId.set(one.id, one);
          paired += 1;
          continue;
        }
        byId.set(e.id, e);
        added += 1;
      }
      return { entries: [...byId.values()], added, paired, joined, kept: incoming.length - added - paired - joined };
    }
    __name(merge, "merge");
    var bytesEqual = /* @__PURE__ */ __name((a, b) => a.length === b.length && a.every((x, i) => x === b[i]), "bytesEqual");
    function canonical(v) {
      if (Array.isArray(v)) return v.map(canonical);
      if (v && typeof v === "object") return Object.keys(v).sort().reduce((o, k) => {
        o[k] = canonical(v[k]);
        return o;
      }, {});
      return v;
    }
    __name(canonical, "canonical");
    function sameEntry(a, b) {
      const text2 = /* @__PURE__ */ __name((e) => {
        const o = JSON.parse(serialize([e])).entries[0];
        delete o.lastSeen;
        return JSON.stringify(canonical(o));
      }, "text");
      return text2(a) === text2(b);
    }
    __name(sameEntry, "sameEntry");
    function findTwin(entries, e) {
      if (e.kind !== "derived" || !e.publicKey || !e.publicKey.length) return null;
      return entries.find((x) => x !== e && x.kind === "derived" && x.type === e.type && x.publicKey && bytesEqual(x.publicKey, e.publicKey)) || null;
    }
    __name(findTwin, "findTwin");
    function combine(a, b) {
      const named = /* @__PURE__ */ __name((x) => x.label && !String(x.label).startsWith("hash:"), "named");
      const [base, other] = named(b) && !named(a) ? [b, a] : [a, b];
      const one = { ...other, ...base };
      const hashOf = [a, b].map((x) => x.labelHash || (String(x.label).startsWith("hash:") ? String(x.label).slice(5) : null)).find(Boolean);
      if (hashOf) one.labelHash = hashOf;
      const times = /* @__PURE__ */ __name((k, pick) => [a[k], b[k]].filter(Boolean).sort()[pick === "min" ? 0 : 1] || a[k] || b[k], "times");
      if (a.firstSeen || b.firstSeen) one.firstSeen = times("firstSeen", "min");
      if (a.created || b.created) one.created = times("created", "min");
      if (a.lastSeen || b.lastSeen) one.lastSeen = [a.lastSeen, b.lastSeen].filter(Boolean).sort().pop();
      if (a.gone || b.gone) one.gone = [a.gone, b.gone].filter(Boolean).sort().pop();
      const tools = [.../* @__PURE__ */ new Set([...a.tools || [], ...b.tools || []])];
      if (tools.length) one.tools = tools;
      else delete one.tools;
      for (const k of ["pgp", "pgpFingerprint", "certCreated", "certExpires", "revocation", "transport", "rpIdHash", "rpId", "code"]) {
        if (one[k] === void 0) one[k] = a[k] !== void 0 ? a[k] : b[k];
      }
      return createEntry(one);
    }
    __name(combine, "combine");
    var fingerprint = /* @__PURE__ */ __name((publicKey) => toHex(sha2562(publicKey)).slice(0, 16).match(/.{4}/g).join(" "), "fingerprint");
    function present(e) {
      return !e.gone || Boolean(e.lastSeen && e.lastSeen > e.gone);
    }
    __name(present, "present");
    module.exports = { FORMAT, VERSION, KINDS: KINDS2, TYPES, createEntry, serialize, parse, merge, findTwin, combine, fingerprint, present };
  }
});

// node_modules/node-onlykey-lib/edge/src/codes.js
var require_codes = __commonJS({
  "node_modules/node-onlykey-lib/edge/src/codes.js"(exports, module) {
    "use strict";
    var OP = Object.freeze({
      SIGN: 1,
      DECRYPT: 2,
      GRANT_CREATE: 6,
      GRANT_END: 7,
      RECEIPT: 8,
      LOSS: 11,
      /* SPEC.md R15a - appended last so the numbers above never move */
      GRANT_HOLD: 13,
      GRANT_RESUME: 14,
      /* 15 is reserved: it was agent registration, retired 2026-10-08 (Brad: "so the claude key thing is overkill"); never reused, never read */
      /*
       * CONTINUE (R28) - the FIRST link of a device's own chain: the next seq after the chain
       * it continues, welded onto the new genesis, grant_id = debts carried, subject =
       * chain.continueSubject. Every restore writes one (2026-10-08).
       */
      CONTINUE: 16,
      /*
       * DERIVE (PROPOSAL-login-plan.md; Brad, 2026-10-29: "we can change the RFC") - a touchless derive_secret on slot 128
       * a budget paid: the scope names its 32-byte label hash, the subject is SHA-256 of the request (mode || label hash).
       * A use like a sign or decrypt: intent in 47-62, owes a receipt. Appended last, so the numbers above never move.
       */
      DERIVE: 17,
      /*
       * CERTIFY (Brad, 2026-10-30: "change nametag to certify ... and we certify agent identities"; "certify should be in
       * the blockchain, so it needs to advance the head") - the owner key certified a subject the host built (grants
       * certifyDigest): a nametag's hash, an agent identity's creation info. Pressed: decision approve, the press flag. Paid
       * by a budget's CERTIFY scope (slot 0): a use like a sign - self-press, intent, owes a receipt. Appended last.
       */
      CERTIFY: 18
      /*
       * v1 (2026-10-08): 3-5 (FIDO, HMAC - never linked), 9-10 (peers), 12 (wipe, R9 dropped)
       * and 17-20 (siblings, anchor, sync) are unused: the key writes a link only for a press
       * or a use an approved budget pays (Brad), and pairing and sync are the app's.
       */
    });
    var DECISION = Object.freeze({
      APPROVE: 1,
      DENY: 2,
      TIMEOUT: 3,
      SELF_PRESS: 4
    });
    var END = Object.freeze({
      COMPLETED: 1,
      REVOKED: 2,
      SETTLED: 3
    });
    var FLAG = Object.freeze({
      PRESS_OBSERVED: 1,
      BUDGET_SPENT: 2,
      /* R16: set by the key on every budget use - it owes a receipt. (v1, 2026-10-08: bits 2, 3 and 5 are unused - no "previous use had no receipt", no receipts' "history at risk", no "started": a budget only pays a started request) */
      OWES_RECEIPT: 16
    });
    var TAG = Object.freeze({
      GENESIS: "OKEDGE-GENESIS-v1",
      CONTINUE: "OKEDGE-CONTINUE-v1",
      LINK: "OKEDGE-LINK-v1",
      CHECKPOINT: "OKEDGE-CKPT-v1",
      GRANT: "OKEDGE-GRANT-v1",
      /* CHOSEN: device_id = SHA256(DEVICE || the Edge public key X||Y)[0..16] - the key and edge JS both derive it */
      DEVICE: "OKEDGE-DEVICE-v1",
      RECEIPT: "OKEDGE-RECEIPT-v1",
      /* SPEC.md R18: a human's press clears every owed receipt at once */
      SETTLE: "OKEDGE-SETTLE-v1",
      /*
       * SPEC.md R13a/R13b: a TX start is bound to the head, the exact request and
       * what the use is for (the intent, welded into the link). One label since the
       * rename (2026-10-07): the ARM-v1/-v2 split is gone.
       */
      TX: "OKEDGE-TX-v1",
      INTENT: "OKEDGE-INTENT-v1"
    });
    var RECEIPT = Object.freeze({
      0: "OK",
      1: "OK_UNCONFIRMED",
      2: "PARTIAL",
      16: "NOT_USED",
      17: "SUPERSEDED",
      32: "TARGET_REJECTED",
      33: "TARGET_UNREACHABLE",
      48: "ABORTED_BY_AGENT",
      49: "ABORTED_BY_HUMAN",
      64: "AGENT_ERROR",
      128: "USED_DIFFERENTLY",
      129: "SUSPECTED_INJECTION",
      130: "DATA_EXPOSED",
      131: "POLICY_CONCERN",
      143: "NEEDS_REVIEW",
      255: "UNKNOWN"
    });
    var STATUS = Object.freeze({
      0: { name: "ok", text: "Done" },
      1: { name: "need-pin", text: "This key has no PIN set yet, so it has no Edge key" },
      2: { name: "bad-scopes", text: "A budget has 1 to 4 scopes" },
      3: { name: "scope-not-allowed", text: "A budget cannot pay for that operation or slot" },
      4: { name: "too-many-uses", text: "A budget has at most 1024 uses" },
      5: { name: "live-full", text: "Four budgets are already live" },
      6: { name: "sign-failed", text: "The key could not sign" },
      7: { name: "no-such-budget", text: "No live budget has that id" },
      8: { name: "no-receipt-waiting", text: "That use owes no receipt (or nothing is owed to settle)" },
      9: { name: "not-held", text: "The key no longer holds that link" },
      10: { name: "unknown-request", text: "This key does not know that Edge request" },
      11: { name: "stale-head", text: "The chain moved since that head - read the head and start again" },
      12: { name: "receipt-owed", text: "A use is waiting for its receipt - receipt it, or settle in the app" },
      13: { name: "nothing-to-pay", text: "No live budget (or every one is on hold)" },
      14: { name: "gate-refused", text: "The key did not take that warm-up token - not its own, or too far behind its newest link (more than 1024)" },
      /* 0x0e-0x11 (restore-then-replay) and 0x13-0x1b (peers, siblings, sync, anchors on the key) went 2026-10-08; their numbers stay unused */
      18: { name: "bad-range", text: "A loss is #from..#to, at or before the key's head" },
      /* R13a (2026-10-06): the sign was not the request the agent started for - refused, no link; TX start again */
      28: { name: "tx-mismatch", text: "That request was not the one the agent started for - refused (the TX start is used up)" }
    });
    function parseStatus(text2) {
      const m = /^EDGE:([0-9A-Fa-f]{2})/.exec(String(text2 || ""));
      if (!m) return null;
      const code = parseInt(m[1], 16);
      const s = STATUS[code];
      return { code, name: s ? s.name : "unknown", text: s ? s.text : `Edge status 0x${m[1]}` };
    }
    __name(parseStatus, "parseStatus");
    function receiptByte(code) {
      if (typeof code === "number") {
        if (Number.isInteger(code) && code >= 0 && code <= 255) return code;
      } else if (typeof code === "string") {
        const t = code.trim();
        if (/^0x[0-9a-f]{1,2}$/i.test(t)) return parseInt(t, 16);
        if (/^[0-9]{1,3}$/.test(t) && Number(t) <= 255) return Number(t);
        const hit = Object.entries(RECEIPT).find(([, name]) => name === t.toUpperCase());
        if (hit) return Number(hit[0]);
      }
      throw new RangeError(`edge: not a receipt code: ${JSON.stringify(code)} (one of ${Object.values(RECEIPT).join(", ")}, or a byte)`);
    }
    __name(receiptByte, "receiptByte");
    function receiptCode(code) {
      const name = Object.prototype.hasOwnProperty.call(RECEIPT, code) ? RECEIPT[code] : null;
      return {
        code,
        name,
        known: name !== null,
        alarm: (code & 128) !== 0 || name === null,
        /* high nibble, so the tab can colour success (0) apart from neutral/failure */
        class: code >> 4 & 15
      };
    }
    __name(receiptCode, "receiptCode");
    function nameOf(table, value) {
      for (const [k, v] of Object.entries(table)) if (v === value) return k.toLowerCase().replace(/_/g, "-");
      return null;
    }
    __name(nameOf, "nameOf");
    var isUse = /* @__PURE__ */ __name((op) => op === OP.SIGN || op === OP.DECRYPT || op === OP.DERIVE || op === OP.CERTIFY, "isUse");
    module.exports = { OP, DECISION, END, FLAG, TAG, RECEIPT, STATUS, parseStatus, receiptCode, receiptByte, nameOf, isUse };
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/der.js
var _0n10, DERErr, _DER, DER;
var init_der = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/der.js"() {
    init_utils3();
    _0n10 = /* @__PURE__ */ BigInt(0);
    DERErr = class extends Error {
      static {
        __name(this, "DERErr");
      }
      constructor(m = "") {
        super(m);
      }
    };
    _DER = {
      // asn.1 DER encoding utils
      Err: DERErr,
      // Basic building block is TLV (Tag-Length-Value)
      _tlv: {
        encode: /* @__PURE__ */ __name((tag, data) => {
          const { Err: E } = _DER;
          asafenumber(tag, "tag");
          if (tag < 0 || tag > 255)
            throw new E("tlv.encode: wrong tag");
          astring(data, "data");
          if (data.length & 1)
            throw new E("tlv.encode: unpadded data");
          const dataLen = data.length / 2;
          const len = numberToHexUnpadded(dataLen);
          if (len.length / 2 & 128)
            throw new E("tlv.encode: long form length too big");
          const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
          const t = numberToHexUnpadded(tag);
          return t + lenLen + len + data;
        }, "encode"),
        // v - value, l - left bytes (unparsed)
        decode(tag, data) {
          const { Err: E } = _DER;
          data = abytes3(data, void 0, "DER data");
          let pos = 0;
          if (tag < 0 || tag > 255)
            throw new E("tlv.decode: wrong tag");
          if (data.length < 2 || data[pos++] !== tag)
            throw new E("tlv.decode: wrong tlv");
          const first = data[pos++];
          const isLong = !!(first & 128);
          let length = 0;
          if (!isLong)
            length = first;
          else {
            const lenLen = first & 127;
            if (!lenLen)
              throw new E("tlv.decode(long): indefinite length not supported");
            if (lenLen > 4)
              throw new E("tlv.decode(long): byte length is too big");
            const lengthBytes = data.subarray(pos, pos + lenLen);
            if (lengthBytes.length !== lenLen)
              throw new E("tlv.decode: length bytes not complete");
            if (lengthBytes[0] === 0)
              throw new E("tlv.decode(long): zero leftmost byte");
            for (const b of lengthBytes)
              length = length << 8 | b;
            pos += lenLen;
            if (length < 128)
              throw new E("tlv.decode(long): not minimal encoding");
          }
          const v = data.subarray(pos, pos + length);
          if (v.length !== length)
            throw new E("tlv.decode: wrong value length");
          return { v, l: data.subarray(pos + length) };
        }
      },
      // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
      // since we always use positive integers here. It must always be empty:
      // - add zero byte if exists
      // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
      _int: {
        encode(num) {
          const { Err: E } = _DER;
          abignumber2(num);
          if (num < _0n10)
            throw new E("integer: negative integers are not allowed");
          let hex2 = numberToHexUnpadded(num);
          if (Number.parseInt(hex2[0], 16) & 8)
            hex2 = "00" + hex2;
          if (hex2.length & 1)
            throw new E("unexpected DER parsing assertion: unpadded hex");
          return hex2;
        },
        decode(data) {
          const { Err: E } = _DER;
          if (data.length < 1)
            throw new E("invalid signature integer: empty");
          if (data[0] & 128)
            throw new E("invalid signature integer: negative");
          if (data.length > 1 && data[0] === 0 && !(data[1] & 128))
            throw new E("invalid signature integer: unnecessary leading zero");
          return bytesToNumberBE2(data);
        }
      },
      toSig(bytes3, maxScalarBytes) {
        const { Err: E, _int: int, _tlv: tlv } = _DER;
        if (maxScalarBytes !== void 0) {
          asafenumber(maxScalarBytes, "maxScalarBytes");
          if (maxScalarBytes < 1)
            throw new E("invalid signature: maxScalarBytes must be positive");
        }
        const data = abytes3(bytes3, void 0, "signature");
        const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
        if (seqLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
        const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
        if (sLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        if (maxScalarBytes !== void 0 && (rBytes.length > maxScalarBytes || sBytes.length > maxScalarBytes))
          throw new E("invalid signature: integer too large");
        return { r: int.decode(rBytes), s: int.decode(sBytes) };
      },
      hexFromSig(sig) {
        const { _tlv: tlv, _int: int } = _DER;
        validateObject(sig, { r: "bigint", s: "bigint" }, {}, "sig");
        const rs = tlv.encode(2, int.encode(sig.r));
        const ss = tlv.encode(2, int.encode(sig.s));
        const seq = rs + ss;
        return tlv.encode(48, seq);
      }
    };
    DER = /* @__PURE__ */ (() => {
      Object.freeze(_DER._tlv);
      Object.freeze(_DER._int);
      return Object.freeze(_DER);
    })();
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/weierstrass.js
function _splitEndoScalar(k, basis, n) {
  aInRange("scalar", k, _0n11, n);
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n11;
  const k2neg = k2 < _0n11;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n9;
  if (k1 < _0n11 || k1 >= MAX_NUM || k2 < _0n11 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed for k");
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts2(opts2, def) {
  validateObject(opts2);
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts2[optName] === void 0 ? def[optName] : opts2[optName];
  }
  abool3(optsn.lowS, "lowS");
  abool3(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const Fp2 = validated.Fp;
  const Fn2 = validated.Fn;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    randomBytes: "function"
  });
  const { endo: endoOpts, allowInfinityPoint, clearCofactor, isTorsionFree, fromBytes, toBytes } = extraOpts;
  const randomBytes5 = extraOpts.randomBytes === void 0 ? randomBytes3 : extraOpts.randomBytes;
  if (endoOpts) {
    if (!Fp2.is0(CURVE.a) || typeof endoOpts.beta !== "bigint" || !Array.isArray(endoOpts.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const endo = endoOpts ? {
    beta: endoOpts.beta,
    basises: endoOpts.basises.map((basis) => [...basis])
  } : void 0;
  const lengths = getWLengths(Fp2, Fn2);
  function assertCompressionIsSupported() {
    if (!Fp2.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  __name(assertCompressionIsSupported, "assertCompressionIsSupported");
  function pointToBytes(_c, point, isCompressed) {
    if (point.is0()) {
      if (!allowInfinityPoint)
        throw new Error("bad point: ZERO");
      return Uint8Array.of(0);
    }
    const { x, y } = point.toAffine();
    const bx = Fp2.toBytes(x);
    abool3(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp2.isOdd(y);
      return concatBytes3(pprefix(hasEvenY), bx);
    } else {
      return concatBytes3(Uint8Array.of(4), bx, Fp2.toBytes(y));
    }
  }
  __name(pointToBytes, "pointToBytes");
  function pointFromBytes(bytes3) {
    abytes3(bytes3, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes3.length;
    const head = bytes3[0];
    const tail = bytes3.subarray(1);
    if (allowInfinityPoint && length === 1 && head === 0)
      return { x: Fp2.ZERO, y: Fp2.ZERO };
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp2.fromBytes(tail);
      if (!Fp2.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp2.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp2.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp2.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp2.BYTES;
      const x = Fp2.fromBytes(tail.subarray(0, L));
      const y = Fp2.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  __name(pointFromBytes, "pointFromBytes");
  const encodePoint = toBytes === void 0 ? pointToBytes : toBytes;
  const decodePoint = fromBytes === void 0 ? pointFromBytes : fromBytes;
  const b3 = Fp2.mul(CURVE.b, _3n4);
  const mulA = Fp2.is0(CURVE.a) ? (_) => Fp2.ZERO : (x) => Fp2.mul(CURVE.a, x);
  function weierstrassEquation(x) {
    const x2 = Fp2.sqr(x);
    const x3 = Fp2.mul(x2, x);
    return Fp2.add(Fp2.add(x3, Fp2.mul(x, CURVE.a)), CURVE.b);
  }
  __name(weierstrassEquation, "weierstrassEquation");
  function isValidXY(x, y) {
    const left = Fp2.sqr(y);
    const right = weierstrassEquation(x);
    return Fp2.eql(left, right);
  }
  __name(isValidXY, "isValidXY");
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp2.mul(Fp2.pow(CURVE.a, _3n4), _4n5);
  const _27b2 = Fp2.mul(Fp2.sqr(CURVE.b), BigInt(27));
  if (Fp2.is0(Fp2.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp2.isValid(n) || banZero && Fp2.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return typeof n === "object" && n !== null ? Fp2.create(n) : n;
  }
  __name(acoord, "acoord");
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  __name(aprjpoint, "aprjpoint");
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn2.ORDER);
  }
  __name(splitEndoScalarN, "splitEndoScalarN");
  function pushWnafPair(points, scalars, p, k) {
    if (!Fn2.isValid(k))
      throw new RangeError("invalid scalar: out of range");
    if (endo) {
      const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(k);
      const psi = new Point(Fp2.mul(p.X, endo.beta), p.Y, p.Z);
      points.push(k1neg ? p.negate() : p, k2neg ? psi.negate() : psi);
      scalars.push(k1, k2);
    } else {
      points.push(p);
      scalars.push(k);
    }
  }
  __name(pushWnafPair, "pushWnafPair");
  const validityCache = /* @__PURE__ */ new WeakSet();
  class Point {
    static {
      __name(this, "Point");
    }
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp2.ONE);
    static ZERO = new Point(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
    static Fp = Fp2;
    static Fn = Fn2;
    X;
    Y;
    Z;
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp2.is0(x) && Fp2.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp2.ONE);
    }
    static fromBytes(bytes3) {
      const P = Point.fromAffine(decodePoint(abytes3(bytes3, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex2) {
      return Point.fromBytes(hexToBytes3(hex2));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     * @param isLazy - true will defer table computation until the first multiplication
     */
    precompute(windowSize = 6, isLazy = true) {
      wnaf.setWindowSize(this, windowSize);
      if (!isLazy)
        this.multiply(_3n4);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      const p = this;
      if (p.is0()) {
        if (allowInfinityPoint && Fp2.is0(p.X) && Fp2.eql(p.Y, Fp2.ONE) && Fp2.is0(p.Z))
          return;
        throw new Error("bad point: ZERO");
      }
      if (validityCache.has(p))
        return;
      const { x, y } = p.toAffine();
      if (!Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("bad point: x or y not field elements");
      if (!isValidXY(x, y))
        throw new Error("bad point: equation left != right");
      if (!p.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
      validityCache.add(p);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp2.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp2.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
      const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point(this.X, Fp2.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      let t0 = Fp2.mul(X1, X1);
      let t1 = Fp2.mul(Y1, Y1);
      let t2 = Fp2.mul(Z1, Z1);
      let t3 = Fp2.mul(X1, Y1);
      t3 = Fp2.add(t3, t3);
      Z3 = Fp2.mul(X1, Z1);
      Z3 = Fp2.add(Z3, Z3);
      X3 = mulA(Z3);
      Y3 = Fp2.mul(b3, t2);
      Y3 = Fp2.add(X3, Y3);
      X3 = Fp2.sub(t1, Y3);
      Y3 = Fp2.add(t1, Y3);
      Y3 = Fp2.mul(X3, Y3);
      X3 = Fp2.mul(t3, X3);
      Z3 = Fp2.mul(b3, Z3);
      t2 = mulA(t2);
      t3 = Fp2.sub(t0, t2);
      t3 = mulA(t3);
      t3 = Fp2.add(t3, Z3);
      Z3 = Fp2.add(t0, t0);
      t0 = Fp2.add(Z3, t0);
      t0 = Fp2.add(t0, t2);
      t0 = Fp2.mul(t0, t3);
      Y3 = Fp2.add(Y3, t0);
      t2 = Fp2.mul(Y1, Z1);
      t2 = Fp2.add(t2, t2);
      t0 = Fp2.mul(t2, t3);
      X3 = Fp2.sub(X3, t0);
      Z3 = Fp2.mul(t2, t1);
      Z3 = Fp2.add(Z3, Z3);
      Z3 = Fp2.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      let t0 = Fp2.mul(X1, X2);
      let t1 = Fp2.mul(Y1, Y2);
      let t2 = Fp2.mul(Z1, Z2);
      let t3 = Fp2.add(X1, Y1);
      let t4 = Fp2.add(X2, Y2);
      t3 = Fp2.mul(t3, t4);
      t4 = Fp2.add(t0, t1);
      t3 = Fp2.sub(t3, t4);
      t4 = Fp2.add(X1, Z1);
      let t5 = Fp2.add(X2, Z2);
      t4 = Fp2.mul(t4, t5);
      t5 = Fp2.add(t0, t2);
      t4 = Fp2.sub(t4, t5);
      t5 = Fp2.add(Y1, Z1);
      X3 = Fp2.add(Y2, Z2);
      t5 = Fp2.mul(t5, X3);
      X3 = Fp2.add(t1, t2);
      t5 = Fp2.sub(t5, X3);
      Z3 = mulA(t4);
      X3 = Fp2.mul(b3, t2);
      Z3 = Fp2.add(X3, Z3);
      X3 = Fp2.sub(t1, Z3);
      Z3 = Fp2.add(t1, Z3);
      Y3 = Fp2.mul(X3, Z3);
      t1 = Fp2.add(t0, t0);
      t1 = Fp2.add(t1, t0);
      t2 = mulA(t2);
      t4 = Fp2.mul(b3, t4);
      t1 = Fp2.add(t1, t2);
      t2 = Fp2.sub(t0, t2);
      t2 = mulA(t2);
      t4 = Fp2.add(t4, t2);
      t0 = Fp2.mul(t1, t4);
      Y3 = Fp2.add(Y3, t0);
      t0 = Fp2.mul(t5, t4);
      X3 = Fp2.mul(t3, X3);
      X3 = Fp2.sub(X3, t0);
      t0 = Fp2.mul(t3, t1);
      Z3 = Fp2.mul(t5, Z3);
      Z3 = Fp2.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      aprjpoint(other);
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses precomputed tables (signed fixed-window wNAF) when available.
     * Uses scalar blinding and avoids endomorphism splitting in the secret-scalar path.
     * @param scalar - by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      if (!Fn2.isValidNot0(scalar))
        throw new RangeError("invalid scalar: out of range");
      const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
      return normalize([p, f])[0];
    }
    /**
     * Non-constant-time multiplication. Uses width-4 wNAF with GLV endomorphism splitting
     * when available (two half-width scalars sharing one halved doubling chain).
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(scalar) {
      const p = this;
      const sc = scalar;
      if (!Fn2.isValid(sc))
        throw new RangeError("invalid scalar: out of range");
      if (sc === _0n11 || p.is0())
        return Point.ZERO;
      if (sc === _1n9)
        return p;
      if (wnaf.hasWindowSize(this))
        return wnaf.mulUnsafe(p, sc, normalize);
      const points = [];
      const scalars = [];
      pushWnafPair(points, scalars, p, sc);
      return mulAddUnsafe(Point, points, scalars);
    }
    /**
     * Non-constant-time double-scalar multiplication `a⋅this + b⋅other` (Strauss–Shamir).
     * Both walks share one doubling chain via {@link mulAddUnsafe}, and GLV endomorphism
     * (when available) halves the chain again by splitting each scalar into two half-width
     * parts. Used by ECDSA verification and public-key recovery for `R = u1⋅G + u2⋅P`.
     * Only for public scalars.
     */
    mulAddUnsafe(a, other, b) {
      aprjpoint(other);
      const points = [];
      const scalars = [];
      pushWnafPair(points, scalars, this, a);
      pushWnafPair(points, scalars, other, b);
      return mulAddUnsafe(Point, points, scalars);
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
     * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      if (iz != null && !Fp2.isValid(iz))
        throw new RangeError('"invertedZ" expected valid field element');
      const { X, Y, Z } = p;
      if (Fp2.eql(Z, Fp2.ONE))
        return { x: X, y: Y };
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp2.ONE : Fp2.inv(Z);
      const x = Fp2.mul(X, iz);
      const y = Fp2.mul(Y, iz);
      const zz = Fp2.mul(Z, iz);
      if (is0)
        return { x: Fp2.ZERO, y: Fp2.ZERO };
      if (!Fp2.eql(zz, Fp2.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      if (cofactor === _1n9)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.mulUnsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      if (cofactor === _1n9)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      if (cofactor === _1n9)
        return this.is0();
      return this.clearCofactor().is0();
    }
    toBytes(isCompressed = true) {
      abool3(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex3(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const normalize = /* @__PURE__ */ __name((points) => normalizeZ(Point, points), "normalize");
  const wnaf = new ScalarMultiplier(Point, randomBytes5);
  if (wnaf.bits >= 6)
    Point.BASE.precompute(6);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp2, Fn2) {
  return {
    secretKey: Fn2.BYTES,
    publicKey: 1 + Fp2.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp2.BYTES,
    publicKeyHasPrefix: true,
    // Raw compact `(r || s)` signature width; DER and recovered signatures use
    // different lengths outside this helper.
    signature: 2 * Fn2.BYTES
  };
}
function ecdh(Point, ecdhOpts = {}) {
  validatePointCons(Point);
  const { Fn: Fn2 } = Point;
  const randomBytes_ = ecdhOpts.randomBytes === void 0 ? randomBytes3 : ecdhOpts.randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn2), {
    seed: Math.max(getMinHashLength(Fn2.ORDER), 16)
  });
  function isValidSecretKey(secretKey) {
    try {
      const num = Fn2.fromBytes(secretKey);
      return Fn2.isValidNot0(num);
    } catch (error) {
      return false;
    }
  }
  __name(isValidSecretKey, "isValidSecretKey");
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !Point.fromBytes(publicKey).is0();
    } catch (error) {
      return false;
    }
  }
  __name(isValidPublicKey, "isValidPublicKey");
  function randomSecretKey(seed) {
    seed = seed === void 0 ? randomBytes_(lengths.seed) : seed;
    return mapHashToField(abytes3(seed, lengths.seed, "seed"), Fn2.ORDER);
  }
  __name(randomSecretKey, "randomSecretKey");
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(Fn2.fromBytes(secretKey)).toBytes(isCompressed);
  }
  __name(getPublicKey, "getPublicKey");
  function isProbPub(item) {
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    const allowedLengths = Fn2._lengths;
    if (!isBytes3(item))
      return void 0;
    const l = abytes3(item, void 0, "key").length;
    const isPub = l === publicKey || l === publicKeyUncompressed;
    const isSec = l === secretKey || !!allowedLengths?.includes(l);
    if (isPub && isSec)
      return void 0;
    return isPub;
  }
  __name(isProbPub, "isProbPub");
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = Fn2.fromBytes(secretKeyA);
    const b = Point.fromBytes(publicKeyB);
    if (b.is0())
      throw new Error("invalid public key: point at infinity");
    return b.multiply(s).toBytes(isCompressed);
  }
  __name(getSharedSecret, "getSharedSecret");
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey
  };
  const keygen = createKeygen(randomSecretKey, getPublicKey);
  Object.freeze(utils);
  Object.freeze(lengths);
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa(Point, hash, ecdsaOpts = {}) {
  validatePointCons(Point);
  const hash_ = hash;
  ahash(hash_);
  validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const opts2 = Object.assign({}, ecdsaOpts);
  const randomBytes5 = opts2.randomBytes === void 0 ? randomBytes3 : opts2.randomBytes;
  const hmac2 = opts2.hmac === void 0 ? (key, msg) => hmac(hash_, key, msg) : opts2.hmac;
  const { Fp: Fp2, Fn: Fn2 } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn2;
  const blindLength = getMinHashLength(CURVE_ORDER);
  const csprng = probeRandomBytes(randomBytes5, blindLength);
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, opts2);
  const defaultSigOpts = {
    prehash: true,
    lowS: typeof opts2.lowS === "boolean" ? opts2.lowS : true,
    format: "compact",
    extraEntropy: false
  };
  const hasLargeRecoveryLifts = CURVE_ORDER * _2n7 + _1n9 < Fp2.ORDER;
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n9;
    return number > HALF;
  }
  __name(isBiggerThanHalfOrder, "isBiggerThanHalfOrder");
  function validateRS(title, num) {
    if (!Fn2.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  __name(validateRS, "validateRS");
  function assertFieldSignIsSupported() {
    if (!Fp2.isOdd)
      throw new Error("Field doesn't support isOdd");
  }
  __name(assertFieldSignIsSupported, "assertFieldSignIsSupported");
  function getRecoveryBit(x, y, r) {
    assertFieldSignIsSupported();
    return (x === r ? 0 : 2) | Number(Fp2.isOdd(y));
  }
  __name(getRecoveryBit, "getRecoveryBit");
  function assertRecoverableCurve() {
    if (hasLargeRecoveryLifts)
      throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
  }
  __name(assertRecoverableCurve, "assertRecoverableCurve");
  function validateSigLength(bytes3, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return abytes3(bytes3, sizer);
  }
  __name(validateSigLength, "validateSigLength");
  class Signature {
    static {
      __name(this, "Signature");
    }
    r;
    s;
    recovery;
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null) {
        assertRecoverableCurve();
        if (![0, 1, 2, 3].includes(recovery))
          throw new Error("invalid recovery id");
        this.recovery = recovery;
      }
      Object.freeze(this);
    }
    static fromBytes(bytes3, format = defaultSigOpts.format) {
      validateSigLength(bytes3, format);
      let recid;
      if (format === "der") {
        if (bytes3.length > 2 * Fn2.BYTES + 16)
          throw new DER.Err("invalid signature: DER signature too long");
        const { r: r2, s: s2 } = DER.toSig(abytes3(bytes3), Fn2.BYTES + 1);
        return new Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes3[0];
        format = "compact";
        bytes3 = bytes3.subarray(1);
      }
      const L = lengths.signature / 2;
      const r = bytes3.subarray(0, L);
      const s = bytes3.subarray(L, L * 2);
      return new Signature(Fn2.fromBytes(r), Fn2.fromBytes(s), recid);
    }
    static fromHex(hex2, format) {
      return this.fromBytes(hexToBytes3(hex2), format);
    }
    assertRecovery() {
      const { recovery } = this;
      if (recovery == null)
        throw new Error("invalid recovery id: must be present");
      return recovery;
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    // Unlike the top-level helper below, this method expects a digest that has
    // already been hashed to the curve's message representative.
    recoverPublicKey(messageHash) {
      const { r, s } = this;
      const recovery = this.assertRecovery();
      const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
      if (!Fp2.isValid(radj))
        throw new Error("invalid recovery id: sig.r+curve.n != R.x");
      const x = Fp2.toBytes(radj);
      const R = Point.fromBytes(concatBytes3(pprefix((recovery & 1) === 0), x));
      const ir = Fn2.inv(radj);
      const h = bits2int_modN(abytes3(messageHash, void 0, "msgHash"));
      const u1 = Fn2.create(-h * ir);
      const u2 = Fn2.create(s * ir);
      const Q3 = Point.BASE.mulAddUnsafe(u1, R, u2);
      if (Q3.is0())
        throw new Error("invalid recovery: point at infinify");
      Q3.assertValidity();
      return Q3;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts.format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes3(DER.hexFromSig(this));
      const { r, s } = this;
      const rb = Fn2.toBytes(r);
      const sb = Fn2.toBytes(s);
      if (format === "recovered") {
        assertRecoverableCurve();
        return concatBytes3(Uint8Array.of(this.assertRecovery()), rb, sb);
      }
      return concatBytes3(rb, sb);
    }
    toHex(format) {
      return bytesToHex3(this.toBytes(format));
    }
  }
  Object.freeze(Signature.prototype);
  Object.freeze(Signature);
  const bits2int = opts2.bits2int === void 0 ? /* @__PURE__ */ __name(function bits2int_def(bytes3) {
    if (bytes3.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE2(bytes3);
    const delta = bytes3.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  }, "bits2int_def") : opts2.bits2int;
  const bits2int_modN = opts2.bits2int_modN === void 0 ? /* @__PURE__ */ __name(function bits2int_modN_def(bytes3) {
    return Fn2.create(bits2int(bytes3));
  }, "bits2int_modN_def") : opts2.bits2int_modN;
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num) {
    aInRange("num < 2^" + fnBits, num, _0n11, ORDER_MASK);
    return Fn2.toBytes(num);
  }
  __name(int2octets, "int2octets");
  function validateMsgAndHash(message, prehash) {
    abytes3(message, void 0, "message");
    return prehash ? abytes3(hash_(message), void 0, "prehashed message") : message;
  }
  __name(validateMsgAndHash, "validateMsgAndHash");
  function prepSig(message, secretKey, opts3) {
    const { lowS, prehash, extraEntropy } = validateSigOpts2(opts3, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = Fn2.fromBytes(secretKey);
    if (!Fn2.isValidNot0(d))
      throw new Error("invalid private key");
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes5(lengths.secretKey) : extraEntropy;
      seedArgs.push(abytes3(e, void 0, "extraEntropy"));
    }
    const seed = concatBytes3(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn2.isValidNot0(k))
        return;
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn2.create(q.x);
      if (r === _0n11)
        return;
      let s;
      if (csprng !== void 0) {
        const b = bytesToNumberBE2(mapHashToField(csprng(blindLength), CURVE_ORDER));
        const ibk = Fn2.inv(Fn2.mul(b, k));
        const bm = Fn2.mul(b, m);
        const bd = Fn2.mul(b, d);
        s = Fn2.create(ibk * Fn2.create(bm + bd * r));
      } else {
        const ik = invertCt(k, CURVE_ORDER);
        s = Fn2.create(ik * Fn2.create(m + r * d));
      }
      if (s === _0n11)
        return;
      let recovery = getRecoveryBit(q.x, q.y, r);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn2.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, hasLargeRecoveryLifts ? void 0 : recovery);
    }
    __name(k2sig, "k2sig");
    return { seed, k2sig };
  }
  __name(prepSig, "prepSig");
  function sign(message, secretKey, opts3 = {}) {
    const { seed, k2sig } = prepSig(message, secretKey, opts3);
    const drbg = createHmacDrbg(hash_.outputLen, Fn2.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig.toBytes(opts3.format);
  }
  __name(sign, "sign");
  function verify(signature, message, publicKey, opts3 = {}) {
    const { lowS, prehash, format } = validateSigOpts2(opts3, defaultSigOpts);
    publicKey = abytes3(publicKey, void 0, "publicKey");
    message = validateMsgAndHash(message, prehash);
    if (!isBytes3(signature)) {
      const end = signature instanceof Signature ? ", use sig.toBytes()" : "";
      throw new Error("verify expects Uint8Array signature" + end);
    }
    validateSigLength(signature, format);
    try {
      const sig = Signature.fromBytes(signature, format);
      const P = Point.fromBytes(publicKey);
      if (P.is0())
        return false;
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn2.inv(s);
      const u1 = Fn2.create(h * is);
      const u2 = Fn2.create(r * is);
      const R = Point.BASE.mulAddUnsafe(u1, P, u2);
      if (R.is0())
        return false;
      const q = R.toAffine();
      const v = Fn2.create(q.x);
      if (v !== r)
        return false;
      if (format === "recovered" && sig.recovery !== getRecoveryBit(q.x, q.y, r))
        return false;
      return true;
    } catch (e) {
      return false;
    }
  }
  __name(verify, "verify");
  function recoverPublicKey(signature, message, opts3 = {}) {
    const { prehash } = validateSigOpts2(opts3, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  __name(recoverPublicKey, "recoverPublicKey");
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash: hash_
  });
}
var divNearest, _0n11, _1n9, _2n7, _3n4, _4n5;
var init_weierstrass = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/abstract/weierstrass.js"() {
    init_hmac();
    init_utils();
    init_utils3();
    init_curve();
    init_der();
    init_modular();
    divNearest = /* @__PURE__ */ __name((num, den) => (num + (num >= 0 ? den : -den) / _2n7) / den, "divNearest");
    __name(_splitEndoScalar, "_splitEndoScalar");
    __name(validateSigFormat, "validateSigFormat");
    __name(validateSigOpts2, "validateSigOpts");
    _0n11 = /* @__PURE__ */ BigInt(0);
    _1n9 = /* @__PURE__ */ BigInt(1);
    _2n7 = /* @__PURE__ */ BigInt(2);
    _3n4 = /* @__PURE__ */ BigInt(3);
    _4n5 = /* @__PURE__ */ BigInt(4);
    __name(weierstrass, "weierstrass");
    __name(pprefix, "pprefix");
    __name(getWLengths, "getWLengths");
    __name(ecdh, "ecdh");
    __name(ecdsa, "ecdsa");
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/nist.js
var nist_exports = {};
__export(nist_exports, {
  p256: () => p256,
  p256_FROST: () => p256_FROST,
  p256_hasher: () => p256_hasher,
  p256_oprf: () => p256_oprf,
  p384: () => p384,
  p384_hasher: () => p384_hasher,
  p384_oprf: () => p384_oprf,
  p521: () => p521,
  p521_hasher: () => p521_hasher,
  p521_oprf: () => p521_oprf
});
function createSWU(Point, opts2) {
  let map;
  return (scalars) => (map || (map = mapToCurveSimpleSWU(Point.Fp, opts2)))(scalars[0]);
}
var p256_CURVE, p384_CURVE, p521_CURVE, p256_Point, p256, p256_hasher, p256_oprf, p256_FROST, p384_Point, p384, p384_hasher, p384_oprf, p521_Point, p521, p521_hasher, p521_oprf;
var init_nist = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/curves/nist.js"() {
    init_sha2();
    init_frost();
    init_hash_to_curve();
    init_oprf();
    init_weierstrass();
    p256_CURVE = /* @__PURE__ */ (() => ({
      p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
      n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
      h: BigInt(1),
      a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
      b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
      Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
      Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
    }))();
    p384_CURVE = /* @__PURE__ */ (() => ({
      p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff"),
      n: BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973"),
      h: BigInt(1),
      a: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffc"),
      b: BigInt("0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef"),
      Gx: BigInt("0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7"),
      Gy: BigInt("0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f")
    }))();
    p521_CURVE = /* @__PURE__ */ (() => ({
      p: BigInt("0x1ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
      n: BigInt("0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409"),
      h: BigInt(1),
      a: BigInt("0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc"),
      b: BigInt("0x0051953eb9618e1c9a1f929a21a0b68540eea2da725b99b315f3b8b489918ef109e156193951ec7e937b1652c0bd3bb1bf073573df883d2c34f1ef451fd46b503f00"),
      Gx: BigInt("0x00c6858e06b70404e9cd9e3ecb662395b4429c648139053fb521f828af606b4d3dbaa14b5e77efe75928fe1dc127a2ffa8de3348b3c1856a429bf97e7e31c2e5bd66"),
      Gy: BigInt("0x011839296a789a3bc0045c8a5fb42c7d1bd998f54449579b446817afbd17273e662c97ee72995ef42640c550b9013fad0761353c7086a272c24088be94769fd16650")
    }))();
    __name(createSWU, "createSWU");
    p256_Point = /* @__PURE__ */ weierstrass(p256_CURVE);
    p256 = /* @__PURE__ */ ecdsa(p256_Point, sha256);
    p256_hasher = /* @__PURE__ */ (() => {
      return createHasher2(p256_Point, createSWU(p256_Point, {
        A: p256_CURVE.a,
        B: p256_CURVE.b,
        Z: p256_Point.Fp.neg(BigInt(10))
      }), {
        DST: "P256_XMD:SHA-256_SSWU_RO_",
        encodeDST: "P256_XMD:SHA-256_SSWU_NU_",
        p: p256_CURVE.p,
        m: 1,
        k: 128,
        expand: "xmd",
        hash: sha256
      });
    })();
    p256_oprf = /* @__PURE__ */ (() => createOPRF({
      name: "P256-SHA256",
      Point: p256_Point,
      hash: sha256,
      hashToGroup: p256_hasher.hashToCurve,
      hashToScalar: p256_hasher.hashToScalar
    }))();
    p256_FROST = /* @__PURE__ */ (() => createFROST({
      name: "FROST-P256-SHA256-v1",
      Point: p256_Point,
      hashToScalar: p256_hasher.hashToScalar,
      hash: sha256
    }))();
    p384_Point = /* @__PURE__ */ weierstrass(p384_CURVE);
    p384 = /* @__PURE__ */ ecdsa(p384_Point, sha384);
    p384_hasher = /* @__PURE__ */ (() => {
      return createHasher2(p384_Point, createSWU(p384_Point, {
        A: p384_CURVE.a,
        B: p384_CURVE.b,
        Z: p384_Point.Fp.neg(BigInt(12))
      }), {
        DST: "P384_XMD:SHA-384_SSWU_RO_",
        encodeDST: "P384_XMD:SHA-384_SSWU_NU_",
        p: p384_CURVE.p,
        m: 1,
        k: 192,
        expand: "xmd",
        hash: sha384
      });
    })();
    p384_oprf = /* @__PURE__ */ (() => createOPRF({
      name: "P384-SHA384",
      Point: p384_Point,
      hash: sha384,
      hashToGroup: p384_hasher.hashToCurve,
      hashToScalar: p384_hasher.hashToScalar
    }))();
    p521_Point = /* @__PURE__ */ weierstrass(p521_CURVE);
    p521 = /* @__PURE__ */ ecdsa(p521_Point, sha512);
    p521_hasher = /* @__PURE__ */ (() => {
      return createHasher2(p521_Point, createSWU(p521_Point, {
        A: p521_CURVE.a,
        B: p521_CURVE.b,
        Z: p521_Point.Fp.neg(BigInt(4))
      }), {
        DST: "P521_XMD:SHA-512_SSWU_RO_",
        encodeDST: "P521_XMD:SHA-512_SSWU_NU_",
        p: p521_CURVE.p,
        m: 1,
        k: 256,
        expand: "xmd",
        hash: sha512
      });
    })();
    p521_oprf = /* @__PURE__ */ (() => createOPRF({
      name: "P521-SHA512",
      Point: p521_Point,
      hash: sha512,
      hashToGroup: p521_hasher.hashToCurve,
      hashToScalar: p521_hasher.hashToScalar
      // produces L=98 just like in RFC
    }))();
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/curves/nist.js
var require_nist = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/curves/nist.js"(exports, module) {
    module.exports = (init_nist(), __toCommonJS(nist_exports));
  }
});

// node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/ml-dsa.js
var ml_dsa_exports = {};
__export(ml_dsa_exports, {
  PARAMS: () => PARAMS2,
  ml_dsa44: () => ml_dsa44,
  ml_dsa65: () => ml_dsa65,
  ml_dsa87: () => ml_dsa87
});
function validateInternalOpts(opts2, allowed) {
  const normalized = checkOptKeys(opts2, allowed);
  if (normalized.externalMu !== void 0)
    abool3(normalized.externalMu, "opts.externalMu");
  return normalized;
}
function RejNTTPoly(xof_) {
  const xof = xof_;
  const r = newPoly(N2);
  for (let j = 0; j < N2; ) {
    const b = xof();
    if (b.length % 3)
      throw new Error("RejNTTPoly: unaligned block");
    for (let i = 0; j < N2 && i <= b.length - 3; i += 3) {
      const t = (b[i + 0] | b[i + 1] << 8 | b[i + 2] << 16) & 8388607;
      if (t < Q2)
        r[j++] = t;
    }
  }
  return r;
}
function getDilithium(opts_) {
  const opts2 = opts_;
  const { K, L, GAMMA1, GAMMA2, TAU, ETA, OMEGA } = opts2;
  const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128: XOF1282, XOF256: XOF2562, securityLevel } = opts2;
  if (![2, 4].includes(ETA))
    throw new Error("Wrong ETA");
  if (![1 << 17, 1 << 19].includes(GAMMA1))
    throw new Error("Wrong GAMMA1");
  if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
    throw new Error("Wrong GAMMA2");
  const BETA = TAU * ETA;
  const decompose = /* @__PURE__ */ __name((r) => {
    const rPlus = crystals2.mod(r);
    const r0 = crystals2.smod(rPlus, 2 * GAMMA2) | 0;
    if (rPlus - r0 === Q2 - 1)
      return { r1: 0 | 0, r0: r0 - 1 | 0 };
    const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
    return { r1, r0 };
  }, "decompose");
  const HighBits = /* @__PURE__ */ __name((r) => decompose(r).r1, "HighBits");
  const LowBits = /* @__PURE__ */ __name((r) => decompose(r).r0, "LowBits");
  const MakeHint = /* @__PURE__ */ __name((z, r) => {
    const res0 = z <= GAMMA2 || z > Q2 - GAMMA2 || z === Q2 - GAMMA2 && r === 0 ? 0 : 1;
    return res0;
  }, "MakeHint");
  const HINT_M = Math.floor((Q2 - 1) / (2 * GAMMA2));
  const UseHint = /* @__PURE__ */ __name((h, r) => {
    const { r1, r0 } = decompose(r);
    if (h === 1)
      return r0 > 0 ? crystals2.mod(r1 + 1, HINT_M) | 0 : crystals2.mod(r1 - 1, HINT_M) | 0;
    return r1 | 0;
  }, "UseHint");
  const Power2Round = /* @__PURE__ */ __name((r) => {
    const rPlus = crystals2.mod(r);
    const r0 = crystals2.smod(rPlus, 2 ** D) | 0;
    return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
  }, "Power2Round");
  const hintCoder = {
    bytesLen: OMEGA + K,
    encode: /* @__PURE__ */ __name((h_) => {
      const h = h_;
      if (h === false)
        throw new Error("hint.encode: hint is false");
      const res = new Uint8Array(OMEGA + K);
      for (let i = 0, k = 0; i < K; i++) {
        for (let j = 0; j < N2; j++)
          if (h[i][j] !== 0)
            res[k++] = j;
        res[OMEGA + i] = k;
      }
      return res;
    }, "encode"),
    decode: /* @__PURE__ */ __name((buf) => {
      const h = [];
      let k = 0;
      for (let i = 0; i < K; i++) {
        const hi = newPoly(N2);
        if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
          return false;
        for (let j = k; j < buf[OMEGA + i]; j++) {
          if (j > k && buf[j] <= buf[j - 1])
            return false;
          hi[buf[j]] = 1;
        }
        k = buf[OMEGA + i];
        h.push(hi);
      }
      for (let j = k; j < OMEGA; j++)
        if (buf[j] !== 0)
          return false;
      return h;
    }, "decode")
  };
  const ETACoder = polyCoder2(ETA === 2 ? 3 : 4, (i) => ETA - i, (i) => {
    if (!(-ETA <= i && i <= ETA))
      throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA}, ${ETA}]`);
    return i;
  });
  const T0Coder = polyCoder2(13, (i) => (1 << D - 1) - i);
  const T1Coder = polyCoder2(10);
  const ZCoder = polyCoder2(GAMMA1 === 1 << 17 ? 18 : 20, (i) => crystals2.smod(GAMMA1 - i));
  const W1Coder = polyCoder2(GAMMA2 === GAMMA2_1 ? 6 : 4);
  const W1Vec = vecCoder(W1Coder, K);
  const publicCoder = splitCoder("publicKey", 32, vecCoder(T1Coder, K));
  const secretCoder = splitCoder("secretKey", 32, 32, TR_BYTES, vecCoder(ETACoder, L), vecCoder(ETACoder, K), vecCoder(T0Coder, K));
  const sigCoder = splitCoder("signature", C_TILDE_BYTES, vecCoder(ZCoder, L), hintCoder);
  const CoefFromHalfByte = ETA === 2 ? (n) => n < 15 ? 2 - n % 5 : false : (n) => n < 9 ? 4 - n : false;
  function RejBoundedPoly(xof_) {
    const xof = xof_;
    const r = newPoly(N2);
    for (let j = 0; j < N2; ) {
      const b = xof();
      for (let i = 0; j < N2 && i < b.length; i += 1) {
        const d1 = CoefFromHalfByte(b[i] & 15);
        const d2 = CoefFromHalfByte(b[i] >> 4 & 15);
        if (d1 !== false)
          r[j++] = d1;
        if (j < N2 && d2 !== false)
          r[j++] = d2;
      }
    }
    return r;
  }
  __name(RejBoundedPoly, "RejBoundedPoly");
  const SampleInBall = /* @__PURE__ */ __name((seed) => {
    const pre = newPoly(N2);
    const s = shake256.create({}).update(seed);
    const buf = new Uint8Array(shake256.blockLen);
    s.xofInto(buf);
    const masks = buf.slice(0, 8);
    for (let i = N2 - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N2; i++) {
      let b = i + 1;
      for (; b > i; ) {
        b = buf[pos++];
        if (pos < shake256.blockLen)
          continue;
        s.xofInto(buf);
        pos = 0;
      }
      pre[i] = pre[b];
      pre[b] = 1 - ((masks[maskPos] >> maskBit++ & 1) << 1);
      if (maskBit >= 8) {
        maskPos++;
        maskBit = 0;
      }
    }
    return pre;
  }, "SampleInBall");
  const polyPowerRound = /* @__PURE__ */ __name((p_) => {
    const p = p_;
    const res0 = newPoly(N2);
    const res1 = newPoly(N2);
    for (let i = 0; i < p.length; i++) {
      const { r0, r1 } = Power2Round(p[i]);
      res0[i] = r0;
      res1[i] = r1;
    }
    return { r0: res0, r1: res1 };
  }, "polyPowerRound");
  const polyUseHint = /* @__PURE__ */ __name((u_, h_) => {
    const u = u_;
    const h = h_;
    for (let i = 0; i < N2; i++)
      u[i] = UseHint(h[i], u[i]);
    return u;
  }, "polyUseHint");
  const polyMakeHint = /* @__PURE__ */ __name((a_, b_) => {
    const a = a_;
    const b = b_;
    const v = newPoly(N2);
    let cnt = 0;
    for (let i = 0; i < N2; i++) {
      const h = MakeHint(a[i], b[i]);
      v[i] = h;
      cnt += h;
    }
    return { v, cnt };
  }, "polyMakeHint");
  const signRandBytes = 32;
  const seedCoder = splitCoder("seed", 32, 64, 32);
  const internal = Object.freeze({
    info: Object.freeze({ type: "internal-ml-dsa" }),
    lengths: Object.freeze({
      secretKey: secretCoder.bytesLen,
      publicKey: publicCoder.bytesLen,
      seed: 32,
      signature: sigCoder.bytesLen,
      signRand: signRandBytes
    }),
    keygen: /* @__PURE__ */ __name((seed) => {
      const seedDst = new Uint8Array(32 + 2);
      const randSeed = seed === void 0;
      if (randSeed)
        seed = randomBytes4(32);
      abytesDoc(seed, 32, "seed");
      seedDst.set(seed);
      if (randSeed)
        cleanBytes(seed);
      seedDst[32] = K;
      seedDst[33] = L;
      const [rho, rhoPrime, K_] = seedCoder.decode(shake256(seedDst, { dkLen: seedCoder.bytesLen }));
      const xofPrime = XOF2562(rhoPrime);
      const s1 = [];
      for (let i = 0; i < L; i++)
        s1.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s2 = [];
      for (let i = L; i < L + K; i++)
        s2.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s1Hat = s1.map((i) => crystals2.NTT.encode(i.slice()));
      const t0 = [];
      const t1 = [];
      const xof = XOF1282(rho);
      const t = newPoly(N2);
      for (let i = 0; i < K; i++) {
        cleanBytes(t);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd2(t, MultiplyNTTs2(aij, s1Hat[j]));
        }
        crystals2.NTT.decode(t);
        const { r0, r1 } = polyPowerRound(polyAdd2(t, s2[i]));
        t0.push(r0);
        t1.push(r1);
      }
      const publicKey = publicCoder.encode([rho, t1]);
      const tr = shake256(publicKey, { dkLen: TR_BYTES });
      const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]);
      xof.clean();
      xofPrime.clean();
      cleanBytes(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
      return {
        publicKey,
        secretKey
      };
    }, "keygen"),
    getPublicKey: /* @__PURE__ */ __name((secretKey) => {
      const [rho, _K, _tr, s1, s2, _t0] = secretCoder.decode(secretKey);
      const xof = XOF1282(rho);
      const s1Hat = s1.map((p) => crystals2.NTT.encode(p.slice()));
      const t1 = [];
      const tmp = newPoly(N2);
      for (let i = 0; i < K; i++) {
        tmp.fill(0);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd2(tmp, MultiplyNTTs2(aij, s1Hat[j]));
        }
        crystals2.NTT.decode(tmp);
        polyAdd2(tmp, s2[i]);
        const { r1 } = polyPowerRound(tmp);
        t1.push(r1);
      }
      xof.clean();
      cleanBytes(tmp, s1Hat, _t0, s1, s2);
      return publicCoder.encode([rho, t1]);
    }, "getPublicKey"),
    // NOTE: random is optional.
    sign: /* @__PURE__ */ __name((msg, secretKey, opts3 = {}) => {
      opts3 = validateSigOpts(opts3, INTERNAL_SIG_OPT_KEYS);
      opts3 = validateInternalOpts(opts3, INTERNAL_SIG_OPT_KEYS);
      const { extraEntropy: random, externalMu = false } = opts3;
      if (externalMu)
        abytesDoc(msg, CRH_BYTES, "mu");
      const ownRnd = random === false || random === void 0;
      const rnd = random === false ? new Uint8Array(32) : random === void 0 ? randomBytes4(signRandBytes) : random;
      abytesDoc(rnd, 32, "extraEntropy");
      const decoded = (() => {
        try {
          return secretCoder.decode(secretKey);
        } catch (error) {
          if (ownRnd)
            cleanBytes(rnd);
          throw error;
        }
      })();
      const [rho, _K, tr, s1, s2, t0] = decoded;
      const A = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K; i++) {
        const pv = [];
        for (let j = 0; j < L; j++)
          pv.push(RejNTTPoly(xof.get(j, i)));
        A.push(pv);
      }
      xof.clean();
      for (let i = 0; i < L; i++)
        crystals2.NTT.encode(s1[i]);
      for (let i = 0; i < K; i++) {
        crystals2.NTT.encode(s2[i]);
        crystals2.NTT.encode(t0[i]);
      }
      const mu = externalMu ? msg : (
        // 6: µ ← H(tr||M, 512)
        //    ▷ Compute message representative µ
        shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
      );
      const rhoprime = shake256.create({ dkLen: CRH_BYTES }).update(_K).update(rnd).update(mu).digest();
      if (ownRnd)
        cleanBytes(rnd);
      abytesDoc(rhoprime, CRH_BYTES);
      const x256 = XOF2562(rhoprime, ZCoder.bytesLen);
      main_loop: for (let kappa = 0; ; ) {
        const y = [];
        for (let i = 0; i < L; i++, kappa++)
          y.push(ZCoder.decode(x256.get(kappa & 255, kappa >> 8)()));
        const z = y.map((i) => crystals2.NTT.encode(i.slice()));
        const w = [];
        for (let i = 0; i < K; i++) {
          const wi = newPoly(N2);
          for (let j = 0; j < L; j++)
            polyAdd2(wi, MultiplyNTTs2(A[i][j], z[j]));
          crystals2.NTT.decode(wi);
          w.push(wi);
        }
        const w1 = w.map((j) => j.map(HighBits));
        const cTilde = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(w1)).digest();
        const cHat = crystals2.NTT.encode(SampleInBall(cTilde));
        const cs1 = s1.map((i) => MultiplyNTTs2(i, cHat));
        for (let i = 0; i < L; i++) {
          polyAdd2(crystals2.NTT.decode(cs1[i]), y[i]);
          if (polyChknorm(cs1[i], GAMMA1 - BETA)) {
            cleanBytes(cTilde, cs1, cHat, w1, w, z, y);
            continue main_loop;
          }
        }
        let cnt = 0;
        const h = [];
        for (let i = 0; i < K; i++) {
          const cs2 = crystals2.NTT.decode(MultiplyNTTs2(s2[i], cHat));
          const r0 = polySub2(w[i], cs2).map(LowBits);
          if (polyChknorm(r0, GAMMA2 - BETA)) {
            cleanBytes(cTilde, cs1, cHat, w1, w, z, y, h, cs2, r0);
            continue main_loop;
          }
          const ct0 = crystals2.NTT.decode(MultiplyNTTs2(t0[i], cHat));
          if (polyChknorm(ct0, GAMMA2)) {
            cleanBytes(cTilde, cs1, cHat, w1, w, z, y, h, cs2, r0, ct0);
            continue main_loop;
          }
          polyAdd2(r0, ct0);
          const hint = polyMakeHint(r0, w1[i]);
          h.push(hint.v);
          cnt += hint.cnt;
        }
        if (cnt > OMEGA) {
          cleanBytes(cTilde, cs1, cHat, w1, w, z, y, h);
          continue;
        }
        x256.clean();
        const res = sigCoder.encode([cTilde, cs1, h]);
        cleanBytes(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, s1, s2, t0, ...A);
        if (!externalMu)
          cleanBytes(mu);
        return res;
      }
      throw new Error("Unreachable code path reached, report this error");
    }, "sign"),
    verify: /* @__PURE__ */ __name((sig, msg, publicKey, opts3 = {}) => {
      opts3 = validateInternalOpts(opts3, INTERNAL_VER_OPT_KEYS);
      const { externalMu = false } = opts3;
      if (externalMu)
        abytesDoc(msg, CRH_BYTES, "mu");
      const [rho, t1] = publicCoder.decode(publicKey);
      const tr = shake256(publicKey, { dkLen: TR_BYTES });
      if (sig.length !== sigCoder.bytesLen)
        return false;
      const [cTilde, z, h] = sigCoder.decode(sig);
      if (h === false)
        return false;
      for (let i = 0; i < L; i++)
        if (polyChknorm(z[i], GAMMA1 - BETA))
          return false;
      const mu = externalMu ? msg : (
        // 7: µ ← H(tr||M, 512)
        shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
      );
      const c = crystals2.NTT.encode(SampleInBall(cTilde));
      const zNtt = z.map((i) => i.slice());
      for (let i = 0; i < L; i++)
        crystals2.NTT.encode(zNtt[i]);
      const wTick1 = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K; i++) {
        const ct12d = MultiplyNTTs2(crystals2.NTT.encode(polyShiftl(t1[i])), c);
        const Az = newPoly(N2);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd2(Az, MultiplyNTTs2(aij, zNtt[j]));
        }
        const wApprox = crystals2.NTT.decode(polySub2(Az, ct12d));
        wTick1.push(polyUseHint(wApprox, h[i]));
      }
      xof.clean();
      const c2 = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(wTick1)).digest();
      for (const t of h) {
        const sum = t.reduce((acc, i) => acc + i, 0);
        if (!(sum <= OMEGA))
          return false;
      }
      for (const t of z)
        if (polyChknorm(t, GAMMA1 - BETA))
          return false;
      return equalBytes3(cTilde, c2);
    }, "verify")
  });
  return Object.freeze({
    info: Object.freeze({ type: "ml-dsa" }),
    internal,
    securityLevel,
    keygen: internal.keygen,
    lengths: internal.lengths,
    getPublicKey: internal.getPublicKey,
    sign: /* @__PURE__ */ __name((msg, secretKey, opts3 = {}) => {
      opts3 = validateSigOpts(opts3);
      const M = getMessage(msg, opts3.context);
      const res = internal.sign(M, secretKey, {
        extraEntropy: opts3.extraEntropy,
        externalMu: false
      });
      cleanBytes(M);
      return res;
    }, "sign"),
    verify: /* @__PURE__ */ __name((sig, msg, publicKey, opts3 = {}) => {
      opts3 = validateVerOpts(opts3);
      abytesDoc(sig, void 0, "signature");
      return internal.verify(sig, getMessage(msg, opts3.context), publicKey, { externalMu: false });
    }, "verify"),
    prehash: /* @__PURE__ */ __name((hash) => {
      checkHash(hash, securityLevel);
      const rawHash = hash;
      return Object.freeze({
        info: Object.freeze({ type: "hashml-dsa" }),
        securityLevel,
        lengths: internal.lengths,
        keygen: internal.keygen,
        getPublicKey: internal.getPublicKey,
        sign: /* @__PURE__ */ __name((msg, secretKey, opts3 = {}) => {
          opts3 = validateSigOpts(opts3);
          const M = getMessagePrehash(rawHash, msg, opts3.context);
          const res = internal.sign(M, secretKey, {
            extraEntropy: opts3.extraEntropy,
            externalMu: false
          });
          cleanBytes(M);
          return res;
        }, "sign"),
        verify: /* @__PURE__ */ __name((sig, msg, publicKey, opts3 = {}) => {
          opts3 = validateVerOpts(opts3);
          abytesDoc(sig, void 0, "signature");
          return internal.verify(sig, getMessagePrehash(rawHash, msg, opts3.context), publicKey, {
            externalMu: false
          });
        }, "verify")
      });
    }, "prehash")
  });
}
var INTERNAL_SIG_OPT_KEYS, INTERNAL_VER_OPT_KEYS, N2, Q2, ROOT_OF_UNITY2, F2, D, GAMMA2_1, GAMMA2_2, PARAMS2, newPoly, crystals2, id, polyCoder2, polyAdd2, polySub2, polyShiftl, polyChknorm, MultiplyNTTs2, ml_dsa44, ml_dsa65, ml_dsa87;
var init_ml_dsa = __esm({
  "node_modules/node-onlykey-lib/src/vendor/node_modules/@noble/post-quantum/ml-dsa.js"() {
    init_utils3();
    init_sha3();
    init_crystals();
    init_utils4();
    INTERNAL_SIG_OPT_KEYS = /* @__PURE__ */ Object.freeze([
      "extraEntropy",
      "externalMu"
    ]);
    INTERNAL_VER_OPT_KEYS = /* @__PURE__ */ Object.freeze(["externalMu"]);
    __name(validateInternalOpts, "validateInternalOpts");
    N2 = 256;
    Q2 = 8380417;
    ROOT_OF_UNITY2 = 1753;
    F2 = 8347681;
    D = 13;
    GAMMA2_1 = Math.floor((Q2 - 1) / 88) | 0;
    GAMMA2_2 = Math.floor((Q2 - 1) / 32) | 0;
    PARAMS2 = /* @__PURE__ */ (() => Object.freeze({
      2: Object.freeze({
        K: 4,
        L: 4,
        D,
        GAMMA1: 2 ** 17,
        GAMMA2: GAMMA2_1,
        TAU: 39,
        ETA: 2,
        OMEGA: 80
      }),
      3: Object.freeze({
        K: 6,
        L: 5,
        D,
        GAMMA1: 2 ** 19,
        GAMMA2: GAMMA2_2,
        TAU: 49,
        ETA: 4,
        OMEGA: 55
      }),
      5: Object.freeze({
        K: 8,
        L: 7,
        D,
        GAMMA1: 2 ** 19,
        GAMMA2: GAMMA2_2,
        TAU: 60,
        ETA: 2,
        OMEGA: 75
      })
    }))();
    newPoly = /* @__PURE__ */ __name((n) => new Int32Array(n), "newPoly");
    crystals2 = /* @__PURE__ */ genCrystals({
      N: N2,
      Q: Q2,
      F: F2,
      ROOT_OF_UNITY: ROOT_OF_UNITY2,
      newPoly,
      isKyber: false,
      brvBits: 8
    });
    id = /* @__PURE__ */ __name((n) => n, "id");
    polyCoder2 = /* @__PURE__ */ __name((d, compress2 = id, verify = id) => crystals2.bitsCoder(d, {
      encode: /* @__PURE__ */ __name((i) => compress2(verify(i)), "encode"),
      decode: /* @__PURE__ */ __name((i) => verify(compress2(i)), "decode")
    }), "polyCoder");
    polyAdd2 = /* @__PURE__ */ __name((a_, b_) => {
      const a = a_;
      const b = b_;
      for (let i = 0; i < a.length; i++)
        a[i] = crystals2.mod(a[i] + b[i]);
      return a;
    }, "polyAdd");
    polySub2 = /* @__PURE__ */ __name((a_, b_) => {
      const a = a_;
      const b = b_;
      for (let i = 0; i < a.length; i++)
        a[i] = crystals2.mod(a[i] - b[i]);
      return a;
    }, "polySub");
    polyShiftl = /* @__PURE__ */ __name((p_) => {
      const p = p_;
      for (let i = 0; i < N2; i++)
        p[i] <<= D;
      return p;
    }, "polyShiftl");
    polyChknorm = /* @__PURE__ */ __name((p_, B2) => {
      const p = p_;
      for (let i = 0; i < N2; i++)
        if (Math.abs(crystals2.smod(p[i])) >= B2)
          return true;
      return false;
    }, "polyChknorm");
    MultiplyNTTs2 = /* @__PURE__ */ __name((a_, b_) => {
      const a = a_;
      const b = b_;
      const c = newPoly(N2);
      for (let i = 0; i < a.length; i++)
        c[i] = crystals2.mod(a[i] * b[i]);
      return c;
    }, "MultiplyNTTs");
    __name(RejNTTPoly, "RejNTTPoly");
    __name(getDilithium, "getDilithium");
    ml_dsa44 = /* @__PURE__ */ (() => getDilithium({
      ...PARAMS2[2],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 32,
      XOF128,
      XOF256,
      securityLevel: 128
    }))();
    ml_dsa65 = /* @__PURE__ */ (() => getDilithium({
      ...PARAMS2[3],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 48,
      XOF128,
      XOF256,
      securityLevel: 192
    }))();
    ml_dsa87 = /* @__PURE__ */ (() => getDilithium({
      ...PARAMS2[5],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 64,
      XOF128,
      XOF256,
      securityLevel: 256
    }))();
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/post-quantum/ml-dsa.js
var require_ml_dsa = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/post-quantum/ml-dsa.js"(exports, module) {
    module.exports = (init_ml_dsa(), __toCommonJS(ml_dsa_exports));
  }
});

// node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/hmac.js
var require_hmac = __commonJS({
  "node_modules/node-onlykey-lib/src/vendor/exports/@noble/hashes/hmac.js"(exports, module) {
    module.exports = (init_hmac(), __toCommonJS(hmac_exports));
  }
});

// node_modules/node-onlykey-lib/src/crypto/provider.js
var require_provider = __commonJS({
  "node_modules/node-onlykey-lib/src/crypto/provider.js"(exports, module) {
    "use strict";
    var { sha256: nobleSha256 } = require_sha2();
    var { hmac: hmac2 } = require_hmac();
    var { p256: p2562 } = require_nist();
    var { ed25519: ed255192 } = require_ed25519();
    var js = {
      sha256: /* @__PURE__ */ __name((bytes3) => nobleSha256(bytes3), "sha256"),
      sha256Repeat(bytes3, times) {
        let x = bytes3;
        for (let k = 0; k < times; k++) x = nobleSha256(x);
        return x;
      },
      hmacSha256: /* @__PURE__ */ __name((key, msg) => hmac2(nobleSha256, key, msg), "hmacSha256"),
      p256VerifyDigest: /* @__PURE__ */ __name((sig, digest, publicKey) => p2562.verify(sig, digest, publicKey, { prehash: false, lowS: false }), "p256VerifyDigest"),
      ed25519Verify: /* @__PURE__ */ __name((sig, msg, publicKey) => ed255192.verify(sig, msg, publicKey, { zip215: false }), "ed25519Verify")
    };
    var impl = js;
    var implName = "js";
    function setCryptoProvider(provider, name = "custom") {
      impl = provider ? { ...js, ...provider } : js;
      implName = provider ? name : "js";
    }
    __name(setCryptoProvider, "setCryptoProvider");
    function cryptoProviderName() {
      return implName;
    }
    __name(cryptoProviderName, "cryptoProviderName");
    var P256_HALF_N = 0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8n;
    function highS(sig) {
      let s = 0n;
      for (let i = 32; i < 64; i++) s = s << 8n | BigInt(sig[i]);
      return s > P256_HALF_N;
    }
    __name(highS, "highS");
    function sha2562(bytes3) {
      return impl.sha256(bytes3);
    }
    __name(sha2562, "sha256");
    function sha256Repeat(bytes3, times) {
      if (!Number.isInteger(times) || times < 0) throw new RangeError(`crypto: not a repeat count: ${times}`);
      return times === 0 ? bytes3 : impl.sha256Repeat(bytes3, times);
    }
    __name(sha256Repeat, "sha256Repeat");
    function hmacSha256(key, msg) {
      return impl.hmacSha256(key, msg);
    }
    __name(hmacSha256, "hmacSha256");
    function p256VerifyDigest(sig, digest, publicKey, { lowS = true } = {}) {
      try {
        if (!(sig instanceof Uint8Array) || sig.length !== 64 || digest.length !== 32) return false;
        if (lowS && highS(sig)) return false;
        return impl.p256VerifyDigest(sig, digest, publicKey) === true;
      } catch {
        return false;
      }
    }
    __name(p256VerifyDigest, "p256VerifyDigest");
    function p256Verify(sig, msg, publicKey, opts2) {
      return p256VerifyDigest(sig, sha2562(msg), publicKey, opts2);
    }
    __name(p256Verify, "p256Verify");
    function ed25519Verify(sig, msg, publicKey) {
      try {
        if (!(sig instanceof Uint8Array) || sig.length !== 64 || publicKey.length !== 32) return false;
        return impl.ed25519Verify(sig, msg, publicKey) === true;
      } catch {
        return false;
      }
    }
    __name(ed25519Verify, "ed25519Verify");
    module.exports = {
      sha256: sha2562,
      sha256Repeat,
      hmacSha256,
      p256Verify,
      p256VerifyDigest,
      ed25519Verify,
      setCryptoProvider,
      cryptoProviderName,
      js
    };
  }
});

// node_modules/node-onlykey-lib/edge/src/hash.js
var require_hash = __commonJS({
  "node_modules/node-onlykey-lib/edge/src/hash.js"(exports, module) {
    "use strict";
    var crypto2 = require_provider();
    var { concat, equalConstantTime } = require_bytes();
    function ascii(text2) {
      const out = new Uint8Array(text2.length);
      for (let i = 0; i < text2.length; i++) {
        const c = text2.charCodeAt(i);
        if (c > 126 || c < 32) throw new TypeError(`edge: tag is not printable ASCII: ${JSON.stringify(text2)}`);
        out[i] = c;
      }
      return out;
    }
    __name(ascii, "ascii");
    function u32le(n) {
      if (!Number.isInteger(n) || n < 0 || n > 4294967295) throw new RangeError(`edge: not a u32: ${n}`);
      return new Uint8Array([n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255]);
    }
    __name(u32le, "u32le");
    function u82(n) {
      if (!Number.isInteger(n) || n < 0 || n > 255) throw new RangeError(`edge: not a byte: ${n}`);
      return new Uint8Array([n]);
    }
    __name(u82, "u8");
    function H(...parts) {
      return crypto2.sha256(concat(parts.map((p) => typeof p === "string" ? ascii(p) : p)));
    }
    __name(H, "H");
    function hmacSha256(key, msg) {
      return crypto2.hmacSha256(key, msg);
    }
    __name(hmacSha256, "hmacSha256");
    function bytes32(b, what) {
      if (!(b instanceof Uint8Array) || b.length !== 32) throw new TypeError(`edge: ${what} must be 32 bytes`);
      return b;
    }
    __name(bytes32, "bytes32");
    var same = /* @__PURE__ */ __name((a, b) => a instanceof Uint8Array && b instanceof Uint8Array && equalConstantTime(a, b), "same");
    module.exports = { H, hmacSha256, ascii, u32le, u8: u82, bytes32, same };
  }
});

// node_modules/node-onlykey-lib/edge/src/chain.js
var require_chain = __commonJS({
  "node_modules/node-onlykey-lib/edge/src/chain.js"(exports, module) {
    "use strict";
    var { OP, TAG, DECISION, isUse } = require_codes();
    var LINK_VERSION = 1;
    var { p256: p2562 } = require_nist();
    var { ml_dsa65: ml_dsa652 } = require_ml_dsa();
    var crypto2 = require_provider();
    var { concat } = require_bytes();
    var { H, ascii, u32le, bytes32, same } = require_hash();
    var LINK_BYTES = 64;
    var REASONS = Object.freeze([
      "hash-mismatch",
      // a link does not weld to the head stored or anchored for it
      "seq-gap",
      // links the key still holds (>= ringFrom) are missing
      "seq-reorder",
      // seq not strictly rising: reordered, duplicated or replayed
      "head-mismatch",
      // the chain does not reach the key's live head
      "rollback",
      // the key's head is behind, or off, what this host saw before
      "device-mismatch"
      // the mirror was recorded for another key
    ]);
    function encodeLink(f) {
      const b = new Uint8Array(LINK_BYTES);
      b.set(u32le(f.seq), 0);
      b[4] = f.op;
      b[5] = f.decision;
      b[6] = f.slot || 0;
      b[7] = f.flags || 0;
      b.set(bytes32(f.subject, "subject"), 8);
      b.set(u32le(f.grantId || 0), 40);
      const step = f.grantStep || 0;
      if (!Number.isInteger(step) || step < 0 || step > 65535) throw new RangeError(`edge: grantStep not a u16: ${step}`);
      b[44] = step & 255;
      b[45] = step >>> 8;
      if (f.reserved) b.set(f.reserved.subarray(0, 18), 46);
      b[63] = f.version !== void 0 ? f.version : LINK_VERSION;
      if (f.intent) {
        if (!(f.intent instanceof Uint8Array) || f.intent.length !== 16) throw new TypeError("edge: intent must be 16 bytes");
        b.set(f.intent, 47);
      }
      if (f.scope !== void 0) {
        if (!Number.isInteger(f.scope) || f.scope < 0 || f.scope > 255) throw new RangeError(`edge: scope not a byte: ${f.scope}`);
        b[46] = f.scope;
      }
      return b;
    }
    __name(encodeLink, "encodeLink");
    function decodeLink(b) {
      if (!(b instanceof Uint8Array) || b.length !== LINK_BYTES) throw new TypeError(`edge: a link is ${LINK_BYTES} bytes`);
      const u323 = /* @__PURE__ */ __name((o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0, "u32");
      const isReceipt = b[4] === OP.RECEIPT;
      return {
        seq: u323(0),
        op: b[4],
        decision: b[5],
        slot: b[6],
        flags: b[7],
        subject: b.slice(8, 40),
        grantId: u323(40),
        grantStep: b[44] | b[45] << 8,
        /* the receipt reuses two fields (R16): its code and the seq it answers */
        ...isReceipt ? { code: b[5], refSeq: u323(40) } : {},
        /* R3: the scope that paid (1-based) on a link that spends a budget; on a budget's opening, its scope count; 0 on every other link */
        scope: b[46],
        /*
         * R13b: a sign/decrypt link carries the agent's intent in 47-62 (zeros: the use gave
         * none). Every other link keeps 47-62 zero. R3: byte 63 = the format's version; v1 is
         * the first release and the only one known - nothing older is read (2026-10-08).
         */
        intent: isUse(b[4]) && b.subarray(47, 63).some((x) => x !== 0) ? b.slice(47, 63) : null,
        version: b[63],
        versionKnown: b[63] === LINK_VERSION,
        reservedZero: (isUse(b[4]) || b.subarray(47, 63).every((x) => x === 0)) && b[63] === LINK_VERSION
      };
    }
    __name(decodeLink, "decodeLink");
    function genesis(deviceId) {
      if (!(deviceId instanceof Uint8Array) || deviceId.length === 0) throw new TypeError("edge: deviceId must be non-empty bytes");
      return H(TAG.GENESIS, deviceId);
    }
    __name(genesis, "genesis");
    function continueSubject({ oldDeviceId, oldSeq, oldHead, owedSeqs = [] }) {
      if (!(oldDeviceId instanceof Uint8Array) || oldDeviceId.length !== 16) throw new TypeError("edge: oldDeviceId must be 16 bytes");
      return H(TAG.CONTINUE, oldDeviceId, u32le(oldSeq), bytes32(oldHead, "oldHead"), ...owedSeqs.map((s) => u32le(s)));
    }
    __name(continueSubject, "continueSubject");
    function chainStart(entries, deviceId) {
      const first = (entries || [])[0];
      if (first) {
        const d = decodeLink(first.link || first);
        if (d.op === OP.CONTINUE) return { fromSeq: d.seq, fromHead: genesis(deviceId) };
      }
      return { fromSeq: 0, fromHead: genesis(deviceId) };
    }
    __name(chainStart, "chainStart");
    function weld(head, link) {
      if (!(link instanceof Uint8Array) || link.length !== LINK_BYTES) throw new TypeError(`edge: a link is ${LINK_BYTES} bytes`);
      return H(TAG.LINK, bytes32(head, "head"), link);
    }
    __name(weld, "weld");
    function heads(links, startHead) {
      const out = [];
      let h = startHead;
      for (const l of links) out.push(h = weld(h, l));
      return out;
    }
    __name(heads, "heads");
    function normalise(entries) {
      return entries.map((e) => e instanceof Uint8Array ? { link: e, head: null } : { link: e.link, head: e.head || null });
    }
    __name(normalise, "normalise");
    function verify(entries, opts2 = {}) {
      const fromSeq = opts2.fromSeq || 0;
      const start = opts2.fromHead || (opts2.deviceId ? genesis(opts2.deviceId) : null);
      if (!start) throw new TypeError("edge.verify: give deviceId or fromHead");
      const fail = /* @__PURE__ */ __name((seq, reason) => ({ ok: false, verifiedThrough: fromSeq - 1, gaps: [], failure: { seq, reason } }), "fail");
      if (opts2.mirrorDeviceId && opts2.deviceId && !same(opts2.mirrorDeviceId, opts2.deviceId)) {
        return fail(fromSeq, "device-mismatch");
      }
      const exp = opts2.expectHead || null;
      const last = opts2.lastSeen || null;
      if (exp && last && exp.seq < last.seq) return fail(exp.seq, "rollback");
      const list = normalise(entries);
      const bySeq = /* @__PURE__ */ new Map();
      let prev = fromSeq - 1;
      for (const e of list) {
        const seq = decodeLink(e.link).seq;
        if (seq <= prev) return fail(seq, "seq-reorder");
        bySeq.set(seq, e);
        prev = seq;
      }
      const lastEntry = prev;
      if (exp && exp.seq < lastEntry) return fail(exp.seq + 1, "rollback");
      const end = exp ? exp.seq : lastEntry;
      const trusted = /* @__PURE__ */ new Map([[fromSeq - 1, { head: start, source: "start" }]]);
      for (const a of opts2.anchors || []) trusted.set(a.seq, { head: bytes32(a.head, "anchor head"), source: "anchor" });
      if (exp && exp.head) {
        const had = trusted.get(exp.seq);
        if (had && !same(had.head, exp.head)) return fail(exp.seq, "head-mismatch");
        trusted.set(exp.seq, { head: bytes32(exp.head, "expectHead.head"), source: "key" });
      }
      const verified = /* @__PURE__ */ new Set();
      const failures = [];
      const mismatchAt = /* @__PURE__ */ __name((seq) => failures.push({ seq, reason: trusted.get(seq)?.source === "key" ? "head-mismatch" : "hash-mismatch" }), "mismatchAt");
      for (let seq = fromSeq; seq <= end; seq++) {
        const e = bySeq.get(seq);
        const before = trusted.get(seq - 1);
        if (!e || !before) continue;
        const h = weld(before.head, e.link);
        const known = trusted.get(seq);
        if (known && !same(known.head, h)) {
          mismatchAt(seq);
          continue;
        }
        if (e.head && !same(e.head, h)) {
          failures.push({ seq, reason: "hash-mismatch" });
          continue;
        }
        if (!known) trusted.set(seq, { head: h, source: "computed" });
        verified.add(seq);
      }
      for (let seq = end; seq > fromSeq; seq--) {
        const t = trusted.get(seq);
        const e = bySeq.get(seq);
        const below = bySeq.get(seq - 1);
        if (!t || !e || verified.has(seq) || !below || !below.head || trusted.has(seq - 1)) continue;
        if (!same(weld(below.head, e.link), t.head)) {
          mismatchAt(seq);
          continue;
        }
        trusted.set(seq - 1, { head: below.head, source: "computed" });
        verified.add(seq);
      }
      if (opts2.ringFrom !== void 0) {
        for (let seq = Math.max(fromSeq, opts2.ringFrom); seq <= end; seq++) {
          if (!bySeq.has(seq)) {
            failures.push({ seq, reason: "seq-gap" });
            break;
          }
        }
      }
      if (last && trusted.has(last.seq) && !same(trusted.get(last.seq).head, last.head)) {
        failures.push({ seq: last.seq, reason: "rollback" });
      }
      failures.sort((a, b) => a.seq - b.seq);
      const failure = failures[0];
      const stop = failure ? failure.seq : end + 1;
      let through = fromSeq - 1;
      while (through + 1 < stop && verified.has(through + 1)) through++;
      const gaps = [];
      for (let seq = fromSeq; seq <= end; seq++) {
        if (verified.has(seq) && seq < stop) continue;
        const g = gaps[gaps.length - 1];
        if (g && g.to === seq - 1) g.to = seq;
        else gaps.push({ from: seq, to: seq });
      }
      return failure ? { ok: false, verifiedThrough: through, gaps, failure } : { ok: true, verifiedThrough: through, gaps };
    }
    __name(verify, "verify");
    function sec1(publicKey) {
      if (!(publicKey instanceof Uint8Array)) throw new TypeError("edge: a public key is bytes");
      return publicKey.length === 64 ? Uint8Array.from([4, ...publicKey]) : publicKey;
    }
    __name(sec1, "sec1");
    function deviceIdOf(publicKey) {
      const xy = publicKey.length === 65 ? publicKey.subarray(1) : publicKey;
      if (xy.length !== 64) throw new TypeError("edge: the Edge public key is 64 bytes X||Y");
      return H(TAG.DEVICE, xy).slice(0, 16);
    }
    __name(deviceIdOf, "deviceIdOf");
    function checkpointMessage({ deviceId, seq, head }) {
      return concat([ascii(TAG.CHECKPOINT), deviceId, u32le(seq), bytes32(head, "head")]);
    }
    __name(checkpointMessage, "checkpointMessage");
    function checkpointDigest(fields) {
      return crypto2.sha256(checkpointMessage(fields));
    }
    __name(checkpointDigest, "checkpointDigest");
    var ML_DSA65 = { PK: 1952, SIG: 3309 };
    function mlDsaVerify(signature, message, publicKey) {
      try {
        if (!signature || !publicKey || signature.length !== ML_DSA65.SIG || publicKey.length !== ML_DSA65.PK) return false;
        return ml_dsa652.verify(Uint8Array.from(signature), message, Uint8Array.from(publicKey));
      } catch {
        return false;
      }
    }
    __name(mlDsaVerify, "mlDsaVerify");
    function verifyCheckpoint(fields, signature, publicKey, signaturePq, publicKeyPq) {
      try {
        const digest = checkpointDigest(fields);
        return crypto2.p256VerifyDigest(Uint8Array.from(signature), digest, sec1(publicKey), { lowS: false }) && mlDsaVerify(signaturePq, digest, publicKeyPq);
      } catch {
        return false;
      }
    }
    __name(verifyCheckpoint, "verifyCheckpoint");
    function verifyCheckpointP256(fields, signature, publicKey) {
      try {
        return crypto2.p256VerifyDigest(Uint8Array.from(signature), checkpointDigest(fields), sec1(publicKey), { lowS: false });
      } catch {
        return false;
      }
    }
    __name(verifyCheckpointP256, "verifyCheckpointP256");
    function signCheckpoint(fields, secretKey) {
      return p2562.sign(checkpointDigest(fields), secretKey, { prehash: false, lowS: false });
    }
    __name(signCheckpoint, "signCheckpoint");
    function mlDsaKeys(seed32) {
      return ml_dsa652.keygen(Uint8Array.from(seed32));
    }
    __name(mlDsaKeys, "mlDsaKeys");
    function signCheckpointPq(fields, secretKeyPq) {
      return ml_dsa652.sign(checkpointDigest(fields), secretKeyPq);
    }
    __name(signCheckpointPq, "signCheckpointPq");
    module.exports = {
      LINK_VERSION,
      LINK_BYTES,
      REASONS,
      encodeLink,
      decodeLink,
      genesis,
      continueSubject,
      chainStart,
      weld,
      heads,
      verify,
      deviceIdOf,
      checkpointMessage,
      checkpointDigest,
      verifyCheckpoint,
      verifyCheckpointP256,
      signCheckpoint,
      ML_DSA65,
      mlDsaVerify,
      mlDsaKeys,
      signCheckpointPq
    };
  }
});

// node_modules/node-onlykey-lib/edge/src/block.js
var require_block = __commonJS({
  "node_modules/node-onlykey-lib/edge/src/block.js"(exports, module) {
    "use strict";
    var { OP } = require_codes();
    var chain = require_chain();
    var crypto2 = require_provider();
    var { toHex, fromHex } = require_bytes();
    var BLOCK_VERSION = 1;
    var NETS = Object.freeze(["live", "test"]);
    var OP_NAME = Object.freeze(Object.fromEntries(Object.entries(OP).map(([k, v]) => [v, k.toLowerCase()])));
    var OP_CODE = Object.freeze(Object.fromEntries(Object.entries(OP_NAME).map(([v, k]) => [k, Number(v)])));
    function canonical(value) {
      const out = [];
      write(value, out, "$");
      return out.join("");
    }
    __name(canonical, "canonical");
    function write(v, out, at) {
      if (v === null || v === true || v === false) {
        out.push(String(v));
        return;
      }
      if (typeof v === "number") {
        if (!Number.isSafeInteger(v)) throw new TypeError(`edge block: ${at} is not a safe integer (${v}) - blocks hold integers only`);
        out.push(String(v));
        return;
      }
      if (typeof v === "string") {
        out.push(str(v, at));
        return;
      }
      if (Array.isArray(v)) {
        out.push("[");
        v.forEach((x, i) => {
          if (i) out.push(",");
          write(x, out, `${at}[${i}]`);
        });
        out.push("]");
        return;
      }
      if (typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
        const keys = Object.keys(v).filter((k) => v[k] !== void 0).sort();
        out.push("{");
        keys.forEach((k, i) => {
          if (i) out.push(",");
          out.push(str(k, `${at} key`), ":");
          write(v[k], out, `${at}.${k}`);
        });
        out.push("}");
        return;
      }
      throw new TypeError(`edge block: ${at} has a value a block cannot hold (${typeof v})`);
    }
    __name(write, "write");
    function str(s, at) {
      if (!/^[\x20-\x7e]*$/.test(s)) throw new TypeError(`edge block: ${at} is not printable ASCII`);
      return `"${s.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
    }
    __name(str, "str");
    function blockId(block) {
      return toHex(crypto2.sha256(new TextEncoder().encode(canonical(block))));
    }
    __name(blockId, "blockId");
    var hex2 = /* @__PURE__ */ __name((b) => toHex(Uint8Array.from(b)), "hex");
    function linkFields(bytes3) {
      const d = chain.decodeLink(bytes3);
      const name = OP_NAME[d.op];
      if (!name) throw new TypeError(`edge block: link ${d.seq} has an op this library does not know (${d.op})`);
      const f = {
        seq: d.seq,
        op: name,
        decision: d.decision,
        slot: d.slot,
        flags: d.flags,
        subject: hex2(d.subject),
        grant: d.grantId,
        step: d.grantStep,
        scope: d.scope,
        intent: d.intent ? hex2(d.intent) : null,
        v: d.version
      };
      if (toHex(linkBytes(f)) !== toHex(bytes3)) {
        throw new TypeError(`edge block: link ${d.seq} has bytes its fields cannot carry (reserved bytes not zero)`);
      }
      return f;
    }
    __name(linkFields, "linkFields");
    function linkBytes(f) {
      const op = OP_CODE[f.op];
      if (op === void 0) throw new TypeError(`edge block: link ${f.seq} names an unknown op "${f.op}"`);
      return chain.encodeLink({
        seq: f.seq,
        op,
        decision: f.decision,
        slot: f.slot,
        flags: f.flags,
        subject: fromHex(f.subject),
        grantId: f.grant,
        grantStep: f.step,
        scope: f.scope,
        intent: f.intent ? fromHex(f.intent) : void 0,
        version: f.v
      });
    }
    __name(linkBytes, "linkBytes");
    function buildBlock({ net, deviceId, start, prev = null, links, checkpoint }) {
      if (!NETS.includes(net)) throw new TypeError(`edge block: net must be ${NETS.join(" or ")}`);
      const block = {
        v: BLOCK_VERSION,
        net,
        device: hex2(deviceId),
        prev,
        start: { seq: start.seq, head: hex2(start.head) },
        links: links.map((l) => linkFields(Uint8Array.from(l))),
        checkpoint: {
          seq: checkpoint.seq,
          head: hex2(checkpoint.head),
          sig: hex2(checkpoint.signature),
          ...checkpoint.signaturePq && checkpoint.signaturePq.length ? { sigPq: hex2(checkpoint.signaturePq) } : {}
        }
      };
      canonical(block);
      return block;
    }
    __name(buildBlock, "buildBlock");
    function blocksFrom({ net, deviceId, records, seals }) {
      const recs = (records || []).map((r) => Uint8Array.from(r.link || r));
      if (!recs.length) return { blocks: [], open: 0 };
      const startAt = chain.chainStart(recs.map((link) => ({ link })), deviceId);
      if (chain.decodeLink(recs[0]).seq !== startAt.fromSeq) {
        return { blocks: [], open: recs.length, reason: `the copy starts at #${chain.decodeLink(recs[0]).seq}, not at its chain's start` };
      }
      const bySeq = new Map(recs.map((l) => [chain.decodeLink(l).seq, l]));
      const blocks = [];
      let start = { seq: startAt.fromSeq, head: startAt.fromHead };
      let prev = null;
      for (const s of [...seals].sort((a, b) => a.seq - b.seq)) {
        if (s.seq < start.seq) continue;
        const links = [];
        for (let q = start.seq; q <= s.seq; q += 1) {
          if (!bySeq.has(q)) return { blocks, open: recs.length - countUpTo(blocks), reason: `the copy has no link #${q}` };
          links.push(bySeq.get(q));
        }
        const b = buildBlock({ net, deviceId, start, prev, links, checkpoint: {
          seq: s.seq,
          head: Uint8Array.from(s.head),
          signature: Uint8Array.from(s.signature),
          ...s.signaturePq ? { signaturePq: Uint8Array.from(s.signaturePq) } : {}
        } });
        blocks.push(b);
        prev = blockId(b);
        start = { seq: s.seq + 1, head: Uint8Array.from(s.head) };
      }
      return { blocks, open: recs.length - countUpTo(blocks) };
    }
    __name(blocksFrom, "blocksFrom");
    var countUpTo = /* @__PURE__ */ __name((blocks) => blocks.reduce((n, b) => n + b.links.length, 0), "countUpTo");
    function verifyBlock(block, publicKey, publicKeyPq, prevBlock = null, { anchor = true } = {}) {
      const fail = /* @__PURE__ */ __name((reason) => ({ ok: false, reason }), "fail");
      try {
        if (!block || block.v !== BLOCK_VERSION) return fail("version");
        if (!NETS.includes(block.net)) return fail("net");
        const id2 = blockId(block);
        const deviceId = chain.deviceIdOf(publicKey);
        if (hex2(deviceId) !== block.device) return fail("device");
        const start = { seq: block.start.seq, head: fromHex(block.start.head) };
        if (prevBlock) {
          if (block.prev !== blockId(prevBlock)) return fail("prev");
          if (prevBlock.device !== block.device || prevBlock.net !== block.net) return fail("prev");
          if (block.start.head !== prevBlock.checkpoint.head || block.start.seq !== prevBlock.checkpoint.seq + 1) return fail("prev");
        } else if (block.prev === null) {
          if (toHex(start.head) !== toHex(chain.genesis(deviceId))) return fail("genesis");
        }
        let head = start.head;
        let seq = start.seq;
        for (const f of block.links) {
          if (f.seq !== seq) return fail("seq");
          const bytes3 = linkBytes(f);
          linkFields(bytes3);
          head = chain.weld(head, bytes3);
          seq += 1;
        }
        if (seq - 1 !== block.checkpoint.seq) return fail("checkpoint");
        if (toHex(head) !== block.checkpoint.head) return fail("checkpoint");
        const fields = { deviceId, seq: block.checkpoint.seq, head: fromHex(block.checkpoint.head) };
        if (anchor) {
          if (typeof block.checkpoint.sigPq !== "string") return fail("signature");
          if (!chain.verifyCheckpoint(fields, fromHex(block.checkpoint.sig), publicKey, fromHex(block.checkpoint.sigPq), publicKeyPq)) return fail("signature");
        } else if (!chain.verifyCheckpointP256(fields, fromHex(block.checkpoint.sig), publicKey)) {
          return fail("signature");
        }
        return { ok: true, id: id2 };
      } catch (e) {
        return fail(`malformed: ${e.message}`);
      }
    }
    __name(verifyBlock, "verifyBlock");
    module.exports = { BLOCK_VERSION, NETS, canonical, blockId, buildBlock, blocksFrom, verifyBlock, linkFields, linkBytes };
  }
});

// node_modules/node-onlykey-lib/edge/src/copyfile.js
var require_copyfile = __commonJS({
  "node_modules/node-onlykey-lib/edge/src/copyfile.js"(exports, module) {
    "use strict";
    var { toHex, fromHex } = require_bytes();
    var chain = require_chain();
    var block = require_block();
    var VERSION = 1;
    var REFUSALS_KEPT = 50;
    var seqOf = /* @__PURE__ */ __name((r) => chain.decodeLink(r.link).seq, "seqOf");
    var hex2 = /* @__PURE__ */ __name((b) => b ? toHex(b) : "", "hex");
    function empty(deviceId) {
      return { deviceId, links: [], lastSeen: null, publicKey: null, publicKeyPq: null, seals: [], checkpoint: null, statement: null, openings: [], anchor: null, refusals: [] };
    }
    __name(empty, "empty");
    function fromJSON(s, deviceId) {
      if (!s || s.v !== VERSION) return empty(deviceId);
      return {
        deviceId,
        links: s.links.map((l) => ({ link: fromHex(l.link), head: fromHex(l.head), ...l.reveal ? { reveal: fromHex(l.reveal) } : {} })),
        lastSeen: s.lastSeen ? { seq: s.lastSeen.seq, head: fromHex(s.lastSeen.head) } : null,
        publicKey: s.publicKey ? fromHex(s.publicKey) : null,
        publicKeyPq: s.publicKeyPq ? fromHex(s.publicKeyPq) : null,
        /* only the newest seal keeps signaturePq ("B"); the checkpoint without one loads as empty bytes and fails its check */
        seals: (s.seals || []).map((x) => ({ seq: x.seq, head: fromHex(x.head), signature: fromHex(x.signature), ...x.signaturePq ? { signaturePq: fromHex(x.signaturePq) } : {}, ...x.ended !== void 0 ? { ended: x.ended } : {} })),
        openings: Array.isArray(s.openings) ? s.openings : [],
        anchor: s.anchor ? { seq: s.anchor.seq, head: fromHex(s.anchor.head) } : null,
        refusals: Array.isArray(s.refusals) ? s.refusals : [],
        notes: s.notes && typeof s.notes === "object" ? s.notes : { reasons: {}, messages: {} },
        checkpoint: s.checkpoint ? {
          seq: s.checkpoint.seq,
          head: fromHex(s.checkpoint.head),
          signature: fromHex(s.checkpoint.signature),
          signaturePq: fromHex(s.checkpoint.signaturePq || "")
        } : null,
        statement: s.statement ? {
          deviceId: fromHex(s.statement.deviceId),
          publicKey: fromHex(s.statement.publicKey),
          publicKeyPq: fromHex(s.statement.publicKeyPq || ""),
          seq: s.statement.seq ?? null,
          nametag: s.statement.nametag,
          signature: fromHex(s.statement.signature),
          signaturePq: fromHex(s.statement.signaturePq || "")
        } : null
      };
    }
    __name(fromJSON, "fromJSON");
    function toJSON(c) {
      return {
        v: VERSION,
        deviceId: toHex(c.deviceId),
        links: c.links.map((l) => ({ link: toHex(l.link), head: toHex(l.head), ...l.reveal ? { reveal: toHex(l.reveal) } : {} })),
        lastSeen: c.lastSeen ? { seq: c.lastSeen.seq, head: toHex(c.lastSeen.head) } : null,
        ...c.publicKey ? { publicKey: toHex(c.publicKey) } : {},
        ...c.publicKeyPq ? { publicKeyPq: toHex(c.publicKeyPq) } : {},
        seals: (c.seals || []).map((x) => ({ seq: x.seq, head: toHex(x.head), signature: toHex(x.signature), ...x.signaturePq && x.signaturePq.length ? { signaturePq: toHex(x.signaturePq) } : {}, ...x.ended !== void 0 ? { ended: x.ended } : {} })),
        ...c.openings && c.openings.length ? { openings: c.openings } : {},
        ...c.anchor ? { anchor: { seq: c.anchor.seq, head: toHex(c.anchor.head) } } : {},
        ...c.refusals && c.refusals.length ? { refusals: c.refusals } : {},
        ...c.notes ? { notes: c.notes } : {},
        ...c.checkpoint ? { checkpoint: {
          seq: c.checkpoint.seq,
          head: toHex(c.checkpoint.head),
          signature: toHex(c.checkpoint.signature),
          signaturePq: toHex(c.checkpoint.signaturePq || new Uint8Array(0))
        } } : {},
        ...c.statement ? { statement: {
          deviceId: toHex(c.statement.deviceId),
          publicKey: toHex(c.statement.publicKey),
          publicKeyPq: toHex(c.statement.publicKeyPq || new Uint8Array(0)),
          seq: c.statement.seq ?? null,
          nametag: c.statement.nametag,
          signature: toHex(c.statement.signature),
          signaturePq: toHex(c.statement.signaturePq || new Uint8Array(0))
        } } : {}
      };
    }
    __name(toJSON, "toJSON");
    function oneAnchor(seals) {
      const sorted = [...seals].sort((a, b) => a.seq - b.seq);
      return sorted.map((x, i) => {
        if (i === sorted.length - 1) return x;
        const { signaturePq: _older, ...p2562 } = x;
        return p2562;
      });
    }
    __name(oneAnchor, "oneAnchor");
    function merge(a, b) {
      if (hex2(a.deviceId) !== hex2(b.deviceId)) throw new Error("two devices' copies do not merge");
      const keysA = a.publicKey && b.publicKey && hex2(a.publicKey) !== hex2(b.publicKey);
      const keysPq = a.publicKeyPq && b.publicKeyPq && hex2(a.publicKeyPq) !== hex2(b.publicKeyPq);
      if (keysA || keysPq) return { copy: a, taken: 0, fork: { seq: -1, reason: "the copies name different keys for this device" } };
      const bySeq = new Map(a.links.map((l) => [seqOf(l), l]));
      for (const l of b.links) {
        const have = bySeq.get(seqOf(l));
        if (have && (hex2(have.link) !== hex2(l.link) || hex2(have.head) !== hex2(l.head))) {
          return { copy: a, taken: 0, fork: { seq: seqOf(l), reason: `the copies disagree at #${seqOf(l)} - a fork, reported, never repaired` } };
        }
      }
      let taken = 0;
      for (const l of b.links) {
        if (!bySeq.has(seqOf(l))) {
          bySeq.set(seqOf(l), l);
          taken += 1;
        }
      }
      const links = [...bySeq.values()].sort((x, y) => seqOf(x) - seqOf(y));
      const seals = new Map(a.seals.map((x) => [x.seq, x]));
      for (const x of b.seals) {
        const was = seals.get(x.seq);
        if (!was) seals.set(x.seq, x);
        else if (x.ended !== void 0) seals.set(x.seq, { ...was, ended: [.../* @__PURE__ */ new Set([...was.ended || [], ...x.ended])].sort((p, q) => p - q) });
      }
      const refusalKey = /* @__PURE__ */ __name((r) => `${r.seq}|${r.computer}|${r.at}`, "refusalKey");
      const refused = new Map([...b.refusals || [], ...a.refusals || []].map((r) => [refusalKey(r), r]));
      const refusals = [...refused.values()].sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-REFUSALS_KEPT);
      const newer = /* @__PURE__ */ __name((x, y, seq) => !x ? y : !y ? x : seq(y) > seq(x) ? y : x, "newer");
      const openings = new Map((a.openings || []).map((o) => [o.grantId, o]));
      for (const o of b.openings || []) if (!openings.has(o.grantId)) openings.set(o.grantId, o);
      const na = a.notes || { reasons: {}, messages: {} };
      const nb = b.notes || { reasons: {}, messages: {} };
      return {
        copy: {
          deviceId: a.deviceId,
          links,
          lastSeen: newer(a.lastSeen, b.lastSeen, (x) => x.seq),
          publicKey: a.publicKey || b.publicKey,
          publicKeyPq: a.publicKeyPq || b.publicKeyPq,
          seals: oneAnchor([...seals.values()]),
          checkpoint: newer(a.checkpoint, b.checkpoint, (x) => x.seq),
          statement: newer(a.statement, b.statement, (x) => x.seq ?? -1),
          openings: [...openings.values()].sort((x, y) => x.grantId - y.grantId),
          notes: {
            reasons: { ...nb.reasons, ...na.reasons },
            messages: { ...nb.messages, ...na.messages },
            seen: { ...nb.seen || {}, ...na.seen || {} },
            ...na.who || nb.who ? { who: { ...nb.who || {}, ...na.who || {} } } : {}
          },
          /* the earlier anchor: the union of links reaches back to it */
          anchor: !a.anchor ? b.anchor || null : !b.anchor ? a.anchor : b.anchor.seq < a.anchor.seq ? b.anchor : a.anchor,
          refusals
        },
        taken,
        fork: null
      };
    }
    __name(merge, "merge");
    function blocks(c, { net }) {
      const r = block.blocksFrom({ net, deviceId: c.deviceId, records: c.links, seals: c.seals });
      const out = [];
      for (const [i, b] of r.blocks.entries()) {
        const anchor = i === r.blocks.length - 1;
        const v = c.publicKey ? block.verifyBlock(b, c.publicKey, c.publicKeyPq, out.length ? out[out.length - 1].block : null, { anchor }) : { ok: false, reason: "no public key kept - it is read from the key with the copy (any edge command with the key plugged in)" };
        out.push({ block: b, id: block.blockId(b), ok: v.ok, ...v.ok ? {} : { reason: v.reason } });
      }
      return { deviceId: toHex(c.deviceId), blocks: out, open: r.open, ...r.reason ? { reason: r.reason } : {} };
    }
    __name(blocks, "blocks");
    module.exports = { VERSION, REFUSALS_KEPT, empty, fromJSON, toJSON, merge, blocks, seqOf };
  }
});

// node_modules/node-onlykey-lib/edge/src/logblocks.js
var require_logblocks = __commonJS({
  "node_modules/node-onlykey-lib/edge/src/logblocks.js"(exports, module) {
    "use strict";
    var copyfile = require_copyfile();
    var { fromHex } = require_bytes();
    var chain = require_chain();
    var BLOCK = 64;
    var pad = /* @__PURE__ */ __name((n) => String(n).padStart(6, "0"), "pad");
    var devOf = /* @__PURE__ */ __name((deviceIdHex) => String(deviceIdHex).slice(0, 16).toLowerCase(), "devOf");
    var seqOfHex = /* @__PURE__ */ __name((l) => chain.decodeLink(fromHex(l.link)).seq, "seqOfHex");
    var FIELDS = {
      meta: ["lastSeen", "checkpoint", "anchor"],
      keys: ["publicKey", "publicKeyPq"],
      statement: ["statement"],
      seals: ["seals"],
      refusals: ["refusals"]
    };
    var NOTE_FIELDS = ["reasons", "messages", "seen", "who"];
    var NUMBERED = ["links", "notes", "open"];
    function parseKey(key) {
      const m = /^([0-9a-f]{16})\.(meta|keys|statement|seals|refusals|links|notes|open)(?:\.(\d+))?$/.exec(key);
      if (!m) return null;
      if (NUMBERED.includes(m[2]) !== (m[3] !== void 0)) return null;
      return { dev: m[1], kind: m[2], n: m[3] === void 0 ? null : Number(m[3]) };
    }
    __name(parseKey, "parseKey");
    function split2(j) {
      const dev = devOf(j.deviceId);
      const out = {};
      const { links = [], notes = {}, openings = [] } = j;
      for (const [kind, fields] of Object.entries(FIELDS)) {
        const part = { v: j.v, deviceId: j.deviceId };
        for (const f of fields) if (j[f] !== void 0) part[f] = j[f];
        if (kind === "meta" || fields.some((f) => j[f] !== void 0 && !(Array.isArray(j[f]) && !j[f].length))) out[`${dev}.${kind}`] = JSON.stringify(part);
      }
      const byBlock = /* @__PURE__ */ new Map();
      for (const l of links) {
        const n = Math.floor(seqOfHex(l) / BLOCK);
        if (!byBlock.has(n)) byBlock.set(n, []);
        byBlock.get(n).push(l);
      }
      for (const [n, ls] of byBlock) out[`${dev}.links.${pad(n)}`] = JSON.stringify(ls.sort((a, b) => seqOfHex(a) - seqOfHex(b)));
      const noteBlocks = /* @__PURE__ */ new Map();
      for (const field of NOTE_FIELDS) {
        for (const [seq, v] of Object.entries(notes[field] || {})) {
          const n = Math.floor(Number(seq) / BLOCK);
          if (!noteBlocks.has(n)) noteBlocks.set(n, { reasons: {}, messages: {}, seen: {} });
          const nb = noteBlocks.get(n);
          if (!nb[field]) nb[field] = {};
          nb[field][seq] = v;
        }
      }
      for (const [n, nb] of noteBlocks) out[`${dev}.notes.${pad(n)}`] = JSON.stringify(nb);
      for (const o of openings) out[`${dev}.open.${o.grantId}`] = JSON.stringify(o);
      return out;
    }
    __name(split2, "split");
    function join(entries, deviceIdHex) {
      const dev = devOf(deviceIdHex);
      const metaText = entries[`${dev}.meta`];
      if (metaText === void 0) return null;
      const meta = JSON.parse(metaText);
      const one = {};
      for (const kind of Object.keys(FIELDS)) if (entries[`${dev}.${kind}`] !== void 0) Object.assign(one, JSON.parse(entries[`${dev}.${kind}`]));
      const j = { v: meta.v, deviceId: meta.deviceId, links: [] };
      if (one.lastSeen !== void 0) j.lastSeen = one.lastSeen;
      for (const f of ["publicKey", "publicKeyPq", "seals", "checkpoint", "statement", "anchor", "refusals"]) if (one[f] !== void 0) j[f] = one[f];
      if (!j.seals) j.seals = [];
      j.notes = { reasons: {}, messages: {}, seen: {} };
      j.openings = [];
      for (const key of Object.keys(entries).sort()) {
        const k = parseKey(key);
        if (!k || k.dev !== dev || !NUMBERED.includes(k.kind)) continue;
        const v = JSON.parse(entries[key]);
        if (k.kind === "links") j.links.push(...v);
        if (k.kind === "notes") {
          for (const f of NOTE_FIELDS) if (v[f]) j.notes[f] = Object.assign(j.notes[f] || {}, v[f]);
        }
        if (k.kind === "open") j.openings.push(v);
      }
      j.links.sort((a, b) => seqOfHex(a) - seqOfHex(b));
      j.openings.sort((a, b) => a.grantId - b.grantId);
      if (!j.openings.length) delete j.openings;
      if (!Object.keys(j.notes.seen).length) delete j.notes.seen;
      if (j.notes.who && !Object.keys(j.notes.who).length) delete j.notes.who;
      return j;
    }
    __name(join, "join");
    function devices(keys) {
      return keys.map(parseKey).filter((k) => k && k.kind === "meta").map((k) => k.dev).sort();
    }
    __name(devices, "devices");
    function mergeEntry(key, haveText, lo, hi) {
      const k = parseKey(key);
      if (!k) return { v: hi, taken: hi === haveText ? 0 : 1, fork: null };
      if (k.kind === "links") {
        const bySeq = /* @__PURE__ */ new Map();
        for (const l of JSON.parse(lo)) bySeq.set(seqOfHex(l), l);
        for (const l of JSON.parse(hi)) {
          const s = seqOfHex(l);
          const was = bySeq.get(s);
          if (was && (was.link !== l.link || was.head !== l.head)) return { v: haveText, taken: 0, fork: `the logs disagree at #${s} - a fork, reported, never repaired` };
          bySeq.set(s, was && was.reveal && !l.reveal ? was : l);
        }
        const had = new Set(JSON.parse(haveText).map(seqOfHex));
        const merged = [...bySeq.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
        return { v: JSON.stringify(merged), taken: merged.filter((l) => !had.has(seqOfHex(l))).length, fork: null };
      }
      if (k.kind === "notes") {
        const a = JSON.parse(lo);
        const b = JSON.parse(hi);
        const out = {};
        for (const f of NOTE_FIELDS) if (a[f] || b[f] || f !== "who") out[f] = { ...a[f] || {}, ...b[f] || {} };
        const v = JSON.stringify(out);
        const have = JSON.parse(haveText);
        const count = /* @__PURE__ */ __name((x) => NOTE_FIELDS.reduce((s, f) => s + Object.keys(x[f] || {}).length, 0), "count");
        return { v, taken: v === haveText ? 0 : Math.max(1, count(out) - count(have)), fork: null };
      }
      if (FIELDS[k.kind]) {
        const a = JSON.parse(lo);
        const b = JSON.parse(hi);
        if (k.kind === "keys" && (a.publicKey && b.publicKey && a.publicKey !== b.publicKey || a.publicKeyPq && b.publicKeyPq && a.publicKeyPq !== b.publicKeyPq)) {
          return { v: haveText, taken: 0, fork: "the logs name different keys for this device" };
        }
        const id2 = fromHex(a.deviceId || b.deviceId);
        const r = copyfile.merge(copyfile.fromJSON({ ...a, v: copyfile.VERSION, links: [] }, id2), copyfile.fromJSON({ ...b, v: copyfile.VERSION, links: [] }, id2));
        const merged = copyfile.toJSON(r.copy);
        const part = { v: a.v ?? b.v, deviceId: a.deviceId || b.deviceId };
        for (const f of FIELDS[k.kind]) if (merged[f] !== void 0 && (a[f] !== void 0 || b[f] !== void 0)) part[f] = merged[f];
        const v = JSON.stringify(part);
        return { v, taken: v === haveText ? 0 : 1, fork: null };
      }
      return { v: hi, taken: hi === haveText ? 0 : 1, fork: null };
    }
    __name(mergeEntry, "mergeEntry");
    function fileInto(have, j) {
      const changed = {};
      const forks = [];
      for (const [key, mine] of Object.entries(split2(j))) {
        const was = have[key];
        if (was === void 0 || was === null) {
          changed[key] = mine;
          continue;
        }
        if (was === mine) continue;
        const r = mergeEntry(key, was, was, mine);
        if (r.fork) {
          forks.push(`${key}: ${r.fork}`);
          continue;
        }
        if (r.v !== was) changed[key] = r.v;
      }
      return { changed, forks };
    }
    __name(fileInto, "fileInto");
    function newestSeqs(entries) {
      const last = {};
      for (const key of Object.keys(entries)) {
        const k = parseKey(key);
        if (k && k.kind === "links" && (last[k.dev] === void 0 || key > last[k.dev])) last[k.dev] = key;
      }
      const out = {};
      for (const [dev, key] of Object.entries(last)) {
        const ls = JSON.parse(entries[key]);
        if (ls.length) out[dev] = Math.max(...ls.map(seqOfHex));
      }
      return out;
    }
    __name(newestSeqs, "newestSeqs");
    module.exports = { BLOCK, split: split2, join, devices, parseKey, mergeEntry, devOf, fileInto, newestSeqs };
  }
});

// node_modules/node-onlykey-lib/bucket/src/store-rules.js
var require_store_rules = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/store-rules.js"(exports, module) {
    "use strict";
    var rules = require_rules();
    function storeRules() {
      const out = {};
      const both = /* @__PURE__ */ __name((name, rule) => {
        out[name] = rule;
        out[`${name}-test`] = rule;
      }, "both");
      try {
        both("keychain", rules.keychain(require_list()));
      } catch {
      }
      both("guestbook", rules.guestbook());
      both("passwords", rules.passwords());
      both("cryptobox", rules.cryptobox());
      try {
        both("edge-logs", rules.edgeLogs(require_logblocks()));
      } catch {
      }
      try {
        const copies = rules.edgeCopies(require_copyfile());
        out["edge.copies"] = copies;
        out["edge-test.copies"] = copies;
      } catch {
      }
      return out;
    }
    __name(storeRules, "storeRules");
    module.exports = { storeRules };
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
          const id2 = mac(keys.tableKey, `${name}\0${k}`);
          rows[id2] = mac(keys.tableKey, `${u.h}\0${u.at || ""}`);
          where[id2] = [name, k];
        }
      }
      return { rows, where };
    }
    __name(table, "table");
    function plan(mine, theirs, keys) {
      const h = keys ? headsId(keys) : null;
      const get = Object.keys(theirs).filter((id2) => id2 !== h && mine[id2] !== theirs[id2]).sort();
      const put = Object.keys(mine).filter((id2) => theirs[id2] !== mine[id2]).sort();
      return { get, put };
    }
    __name(plan, "plan");
    function sealRows(bucket, keys, ids, { rules = {}, randomBytes: randomBytes5 }) {
      const t = table(bucket, keys, { rules });
      const mine = replicate.summarize(bucket, { rules });
      const theirs = JSON.parse(JSON.stringify(mine));
      for (const id2 of ids) {
        const w = t.where[id2];
        if (!w) throw Object.assign(new Error("a row to put is not in this bucket now - plan again"), { code: "EBUCKET_CHANGED" });
        delete theirs[w[0]][w[1]];
      }
      const given = replicate.give(bucket, mine, theirs, { rules });
      const out = {};
      for (const id2 of ids) {
        const [name, k] = t.where[id2];
        out[id2] = { tag: t.rows[id2], blob: vault.seal(keys.unitKey, JSON.stringify({ id: id2, s: name, k, r: given[name][k] }), randomBytes5) };
      }
      return out;
    }
    __name(sealRows, "sealRows");
    function openRows(rows, keys) {
      const given = {};
      const refused = [];
      for (const [id2, blob] of Object.entries(rows)) {
        let u;
        try {
          u = JSON.parse(vault.open(keys.unitKey, blob));
        } catch (_) {
          refused.push(`${id2}: does not open with this bucket key`);
          continue;
        }
        if (!u || u.id !== id2 || typeof u.s !== "string" || typeof u.k !== "string" || !u.r) {
          refused.push(`${id2}: not this row's unit`);
          continue;
        }
        if (!given[u.s]) given[u.s] = {};
        given[u.s][u.k] = u.r;
      }
      return { given, refused };
    }
    __name(openRows, "openRows");
    function sealHeads(heads, keys, randomBytes5) {
      const text2 = JSON.stringify(Object.fromEntries(Object.entries(heads).sort()));
      const id2 = headsId(keys);
      return { id: id2, tag: mac(keys.tableKey, text2), blob: vault.seal(keys.unitKey, JSON.stringify({ id: id2, heads: JSON.parse(text2) }), randomBytes5) };
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
    async function syncWith(bucket, keys, store, { rules = {}, randomBytes: randomBytes5, heads = null } = {}) {
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
      const rows = put.length ? sealRows(bucket, keys, put, { rules, randomBytes: randomBytes5 }) : {};
      if (heads) {
        const h = sealHeads(heads, keys, randomBytes5);
        if (theirs[h.id] !== h.tag) rows[h.id] = { tag: h.tag, blob: h.blob };
      }
      if (Object.keys(rows).length) await store.put(rows);
      const after = table(bucket, keys, { rules });
      const stores = {};
      const of = /* @__PURE__ */ __name((name) => stores[name] = stores[name] || { units: 0, got: 0, put: 0 }, "of");
      for (const [name] of Object.values(after.where)) of(name).units += 1;
      for (const id2 of p.get) {
        const w = after.where[id2];
        if (w) of(w[0]).got += 1;
      }
      for (const id2 of put) {
        const w = after.where[id2];
        if (w) of(w[0]).put += 1;
      }
      return { got: p.get.length, put: Object.keys(rows).length, taken, conflicts, refused, stores };
    }
    __name(syncWith, "syncWith");
    var OWNER = "\0owner";
    var ownerId = /* @__PURE__ */ __name((keys) => mac(keys.tableKey, OWNER), "ownerId");
    function sealOwner(owner, keys, randomBytes5) {
      const id2 = ownerId(keys);
      return { id: id2, tag: mac(keys.tableKey, `${OWNER}\0${owner}`), blob: vault.seal(keys.unitKey, JSON.stringify({ id: id2, owner }), randomBytes5) };
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
      const units = Object.fromEntries(Object.entries(rows).filter(([id2]) => id2 !== oid && id2 !== hid));
      const { given, refused } = openRows(units, keys);
      if (refused.length) return null;
      const { create } = require_bucket();
      const b = create({ owner });
      replicate.take(b, given, { rules });
      return b;
    }
    __name(bucketFromRows, "bucketFromRows");
    function locate(bucket, keys, rows, { rules = {} } = {}) {
      const t = table(bucket, keys, { rules });
      const h = headsId(keys);
      const stores = /* @__PURE__ */ new Set();
      let unknown = 0;
      for (const [id2, tag] of Object.entries(rows || {})) {
        if (id2 === h || t.rows[id2] === tag) continue;
        const w = t.where[id2];
        if (w) stores.add(w[0]);
        else unknown += 1;
      }
      return { stores: [...stores].sort(), unknown };
    }
    __name(locate, "locate");
    module.exports = { keysOf, headsId, table, plan, sealRows, openRows, sealHeads, openHeads, syncWith, locate, ownerId, sealOwner, bucketFromRows };
  }
});

// node_modules/node-onlykey-lib/bucket/src/storage.js
var require_storage = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/storage.js"(exports, module) {
    "use strict";
    var bucketLib3 = require_bucket();
    var sealedCopy = require_sealedcopy();
    function rowsStorage({ rows, rules = {}, randomBytes: randomBytes5 }) {
      function kept(identity, bucket, key, tags) {
        const store = rows(identity);
        const keys = sealedCopy.keysOf({ secretKey: key });
        let writes = Promise.resolve();
        return {
          bucket,
          write() {
            const run = writes.then(async () => {
              const t = sealedCopy.table(bucket, keys, { rules });
              const ids = Object.keys(t.rows).filter((id2) => tags[id2] !== t.rows[id2]);
              const out = ids.length ? sealedCopy.sealRows(bucket, keys, ids, { rules, randomBytes: randomBytes5 }) : {};
              const o = sealedCopy.sealOwner(identity, keys, randomBytes5);
              if (tags[o.id] !== o.tag) out[o.id] = { tag: o.tag, blob: o.blob };
              if (!Object.keys(out).length) return;
              await store.put(out);
              for (const [id2, r] of Object.entries(out)) tags[id2] = r.tag;
            });
            writes = run.catch(() => {
            });
            return run;
          },
          /* nothing else writes these rows: what is in memory is what is kept */
          refresh: /* @__PURE__ */ __name(async () => 0, "refresh")
        };
      }
      __name(kept, "kept");
      return {
        needsKey: true,
        async state(identity) {
          return Object.keys(await rows(identity).table()).length ? "sealed" : "none";
        },
        async open(identity, key, prove) {
          if (!key) throw new Error("the bucket is sealed here: the key's secret opens it");
          const store = rows(identity);
          const all = await store.all();
          if (!Object.keys(all).length) return null;
          const bucket = prove(all);
          return kept(identity, bucket, key, await store.table());
        },
        async create(identity, key) {
          if (!key) throw new Error("the bucket is sealed here: a new one needs the key's secret");
          const bucket = bucketLib3.create({ owner: identity });
          const opened = kept(identity, bucket, key, {});
          await opened.write();
          return opened;
        }
      };
    }
    __name(rowsStorage, "rowsStorage");
    function sharedFileStorage({ side, net, rules = {} }) {
      function kept(identity, n, bucket) {
        let writes = Promise.resolve();
        return {
          bucket,
          write() {
            const run = writes.then(() => side.mergeIn(identity, n, bucketLib3.serialize(bucket)));
            writes = run.catch(() => {
            });
            return run.then(() => {
            });
          },
          async refresh() {
            const text2 = await side.read(identity, n);
            if (!text2) return 0;
            const { bucket: merged, report } = bucketLib3.merge(bucket, bucketLib3.parse(text2), { rules });
            bucket.stores = merged.stores;
            bucket.clock = merged.clock;
            return Object.values(report.taken).reduce((a, b) => a + b, 0);
          }
        };
      }
      __name(kept, "kept");
      return {
        needsKey: false,
        async state(identity) {
          return await side.has(identity, net()) ? "kept" : "none";
        },
        async open(identity) {
          const n = net();
          const text2 = await side.read(identity, n);
          return text2 ? kept(identity, n, bucketLib3.parse(text2)) : null;
        },
        async create(identity) {
          const n = net();
          const bucket = bucketLib3.create({ owner: identity });
          await side.keep(identity, n, bucketLib3.serialize(bucket));
          return kept(identity, n, bucket);
        }
      };
    }
    __name(sharedFileStorage, "sharedFileStorage");
    function memoryRows() {
      const m = /* @__PURE__ */ new Map();
      return {
        async table() {
          return Object.fromEntries([...m].map(([id2, r]) => [id2, r.tag]));
        },
        async all() {
          return Object.fromEntries([...m].map(([id2, r]) => [id2, r.blob]));
        },
        async get(ids) {
          return Object.fromEntries(ids.filter((id2) => m.has(id2)).map((id2) => [id2, m.get(id2).blob]));
        },
        async put(rows) {
          for (const [id2, r] of Object.entries(rows)) m.set(id2, { tag: r.tag, blob: r.blob });
        },
        async clear() {
          m.clear();
        }
      };
    }
    __name(memoryRows, "memoryRows");
    module.exports = { rowsStorage, sharedFileStorage, memoryRows };
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
    async function readIdentity(okcrypto, opts2 = {}) {
      const publicKey = Uint8Array.from(await okcrypto.agent.publicKey(labelHash(IDENTITY_LABEL), { ...opts2, ...AGENT, keyType: ED25519 }));
      return { publicKey, id: identityIdOf(publicKey) };
    }
    __name(readIdentity, "readIdentity");
    var BUCKET_KEY_VERSION = 2;
    var bucketKeyLabel = /* @__PURE__ */ __name((identityPublicKey) => `okedge/bucket-key/v2/${identityIdOf(identityPublicKey)}`, "bucketKeyLabel");
    var bucketLabel = /* @__PURE__ */ __name((identityPublicKey) => `okedge/bucket/v2/${identityIdOf(identityPublicKey)}`, "bucketLabel");
    async function deriveBucketKeyAt(okcrypto, identityPublicKey, site, opts2 = {}) {
      if (typeof site !== "string" || !site) {
        throw Object.assign(new Error("bucket key: this key names no site (ctap_bridge) - its bucket key is bound to that site, and there is no other"), { code: "NO_KEY_SITE" });
      }
      const secret = Uint8Array.from(await okcrypto.deriveSecret(bucketKeyLabel(identityPublicKey), { ...opts2, rpId: site }));
      try {
        const secretKey = hkdf2(sha2562, secret, utf8("OKBUCKET-KEY-v2"), Uint8Array.from(identityPublicKey), 32);
        return { secretKey, publicKey: ed255192.getPublicKey(secretKey), version: BUCKET_KEY_VERSION };
      } finally {
        secret.fill(0);
      }
    }
    __name(deriveBucketKeyAt, "deriveBucketKeyAt");
    var certDigest = /* @__PURE__ */ __name((identityPublicKey, bucketPublicKey) => H("OKBUCKET-CERT-v1", identityPublicKey, bucketPublicKey), "certDigest");
    async function certify(okcrypto, identityPublicKey, bucketPublicKey, opts2 = {}) {
      const sig = await okcrypto.agent.sign(labelHash(IDENTITY_LABEL), certDigest(identityPublicKey, bucketPublicKey), { ...opts2, ...AGENT, keyType: ED25519 });
      return Uint8Array.from(sig).slice(0, 64);
    }
    __name(certify, "certify");
    var loginDigest = /* @__PURE__ */ __name((identityPublicKey, bucketPublicKey, login) => H("OKROOM-LOGIN-v1", identityPublicKey, bucketPublicKey, utf8(`${String(login.host).toLowerCase()}|`), login.nonce), "loginDigest");
    async function signLogin(okcrypto, identityPublicKey, bucketPublicKey, login, opts2 = {}) {
      const sig = await okcrypto.agent.sign(labelHash(IDENTITY_LABEL), loginDigest(identityPublicKey, bucketPublicKey, login), { ...opts2, ...AGENT, keyType: ED25519 });
      return Uint8Array.from(sig).slice(0, 64);
    }
    __name(signLogin, "signLogin");
    function verifyCertificate({ identityPublicKey, bucketPublicKey, certificate, login }) {
      try {
        if (login) return ed255192.verify(Uint8Array.from(certificate), loginDigest(identityPublicKey, bucketPublicKey, login), Uint8Array.from(identityPublicKey));
        return ed255192.verify(Uint8Array.from(certificate), certDigest(identityPublicKey, bucketPublicKey), Uint8Array.from(identityPublicKey));
      } catch {
        return false;
      }
    }
    __name(verifyCertificate, "verifyCertificate");
    function certifies(me) {
      try {
        return identityIdOf(me.identityPublicKey) === me.id && verifyCertificate({ identityPublicKey: me.identityPublicKey, bucketPublicKey: me.bucketKey.publicKey, certificate: me.certificate });
      } catch {
        return false;
      }
    }
    __name(certifies, "certifies");
    var PURPOSES = /* @__PURE__ */ new Set(["proof", "give", "accept", "revoke", "join"]);
    var purposeDigest = /* @__PURE__ */ __name((purpose, bytes3) => {
      if (!PURPOSES.has(purpose)) throw new Error(`the bucket key signs ${[...PURPOSES].join(", ")} - not ${purpose}`);
      return H(`OKBUCKET-${purpose.toUpperCase()}-v1`, bytes3);
    }, "purposeDigest");
    function sign(bucketKey, purpose, bytes3) {
      return ed255192.sign(purposeDigest(purpose, Uint8Array.from(bytes3)), bucketKey.secretKey);
    }
    __name(sign, "sign");
    function verify({ identityPublicKey, bucketPublicKey, certificate, login, purpose, bytes: bytes3, signature }) {
      try {
        return verifyCertificate({ identityPublicKey, bucketPublicKey, certificate, login }) && ed255192.verify(Uint8Array.from(signature), purposeDigest(purpose, Uint8Array.from(bytes3)), Uint8Array.from(bucketPublicKey));
      } catch {
        return false;
      }
    }
    __name(verify, "verify");
    module.exports = { bucketLabel, IDENTITY_LABEL, isBucketIdentityId, identityIdOf, readIdentity, deriveBucketKeyAt, BUCKET_KEY_VERSION, bucketKeyLabel, certify, verifyCertificate, certifies, sign, verify, signLogin, loginDigest };
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
        /* a login proof says which challenge it answered (bucket-identity signLogin); a kept certificate carries none */
        ...me.login ? { login: { host: String(me.login.host).toLowerCase(), nonce: enc(me.login.nonce) } } : {},
        signature: enc(bid.sign(me.bucketKey, "proof", proofBytes(nonce, side, me.id)))
      };
    }
    __name(prove, "prove");
    function checks(proof, nonce, side, id2) {
      try {
        const identityPublicKey = dec(proof.identityPublicKey);
        if (bid.identityIdOf(identityPublicKey) !== id2) return false;
        return bid.verify({
          identityPublicKey,
          bucketPublicKey: dec(proof.bucketPublicKey),
          certificate: dec(proof.certificate),
          login: proof.login ? { host: String(proof.login.host), nonce: dec(proof.login.nonce) } : void 0,
          purpose: "proof",
          bytes: proofBytes(nonce, side, id2),
          signature: dec(proof.signature)
        });
      } catch {
        return false;
      }
    }
    __name(checks, "checks");
    function computerSide({ bucket, me, randomBytes: randomBytes5, rules = {} }) {
      const nonce = randomBytes5(NONCE);
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
    function peerSide({ bucket, me, randomBytes: randomBytes5, rules = {}, seen = /* @__PURE__ */ new Set() }) {
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
          const nonce = randomBytes5(NONCE);
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
  const b32 = u322(block);
  const isAligned = isLE2 && isAligned32(data) && isAligned32(output);
  const d32 = isAligned ? u322(data) : U32_EMPTY;
  const o32 = isAligned ? u322(output) : U32_EMPTY;
  if (!isLE2) {
    for (let pos = 0; pos < len; counter++) {
      core(sigma, key, nonce, b32, counter, rounds);
      swap32IfBE2(b32);
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
function createCipher(core, opts2) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts2({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts2);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  anumber2(counterLength);
  anumber2(rounds);
  abool2(counterRight);
  abool2(allowShortKeys);
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
    if (!isLE2 || !isAligned32(nonce))
      toClean.push(nonce = copyBytes(nonce));
    let k32 = u322(k);
    if (extendNonceFn) {
      if (nonce.length !== 24)
        throw new Error("arx: extended nonce must be 24 bytes");
      const n16 = nonce.subarray(0, 16);
      if (isLE2)
        extendNonceFn(sigma, k32, u322(n16), k32);
      else {
        const sigmaRaw = swap32IfBE2(Uint32Array.from(sigma));
        extendNonceFn(sigmaRaw, k32, u322(n16), k32);
        clean2(sigmaRaw);
        swap32IfBE2(k32);
      }
      nonce = nonce.subarray(16);
    } else if (!isLE2)
      swap32IfBE2(k32);
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length)
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    if (nonceNcLen !== 12) {
      const nc = new Uint8Array(12);
      nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc;
      toClean.push(nonce);
    }
    const n32 = swap32IfBE2(u322(nonce));
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
    sigma16_32 = /* @__PURE__ */ (() => swap32IfBE2(u322(encodeStr("expand 16-byte k"))))();
    sigma32_32 = /* @__PURE__ */ (() => swap32IfBE2(u322(encodeStr("expand 32-byte k"))))();
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
  const s2 = isLE2 ? s : swap32IfBE2(s.slice(0, 4));
  const k2 = isLE2 ? k : swap32IfBE2(k.slice(0, 8));
  const i2 = isLE2 ? i : swap32IfBE2(i.slice(0, 4));
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
  swap32IfBE2(out);
  if (!isLE2)
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
    function challenge(randomBytes5) {
      const nonce = Uint8Array.from(randomBytes5(NONCE));
      return { nonce, message: { t: "challenge", nonce: toHex(nonce) } };
    }
    __name(challenge, "challenge");
    function join(me, asked, device) {
      return {
        t: "join",
        identityPublicKey: toHex(me.identityPublicKey),
        bucketPublicKey: toHex(me.bucketKey.publicKey),
        certificate: toHex(me.certificate),
        /* a login proof (bucket-identity signLogin) says which challenge it answers; a kept certificate carries none */
        ...me.login ? { login: { host: String(me.login.host).toLowerCase(), nonce: toHex(me.login.nonce) } } : {},
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
    function checkJoin(room2, msg, asked, { requireLogin = false, open = false } = {}) {
      try {
        if (!msg || msg.t !== "join" || !hex2(msg.identityPublicKey, 32) || !hex2(msg.bucketPublicKey, 32)) return REFUSED;
        const device = deviceOf(msg.device);
        const identityPublicKey = fromHex(msg.identityPublicKey);
        if (!device || bid.identityIdOf(identityPublicKey) !== room2) return REFUSED;
        if (open) return { ok: true, identity: room2, device, login: false };
        if (!hex2(msg.certificate, 64) || !hex2(msg.signature, 64)) return REFUSED;
        let login = null;
        if (msg.login) {
          if (String(msg.login.host) !== String(asked.host).toLowerCase() || msg.login.nonce !== toHex(asked.nonce)) return REFUSED;
          login = { host: asked.host, nonce: asked.nonce };
        } else if (requireLogin) return REFUSED;
        const ok = bid.verify({
          identityPublicKey,
          bucketPublicKey: fromHex(msg.bucketPublicKey),
          certificate: fromHex(msg.certificate),
          login,
          purpose: "join",
          bytes: joinBytes(asked.host, asked.nonce),
          signature: fromHex(msg.signature)
        });
        return ok ? { ok: true, identity: room2, device, login: !!login } : REFUSED;
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
    function sealFrame(key, who, payload, randomBytes5) {
      const nonce = Uint8Array.from(randomBytes5(FRAME_NONCE));
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
    var { fromHex } = require_bytes();
    var { ed25519: ed255192 } = require_ed25519();
    var PING_MS = 25e3;
    function connectRoom({ url, me: given, device, WebSocket: WS, randomBytes: randomBytes5, timeoutMs = 15e3, login = null }) {
      const me = given.bucketKey ? given : (() => {
        const secretKey = randomBytes5(32);
        return { ...given, bucketKey: { secretKey, publicKey: ed255192.getPublicKey(secretKey) }, certificate: new Uint8Array(0) };
      })();
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
        const waitMs = login ? Math.max(timeoutMs, 4e4) : timeoutMs;
        const joinTimer = setTimeout(() => {
          reject(new Error(`${host}: no answer to the join within ${waitMs} ms`));
          try {
            ws.close();
          } catch {
          }
        }, waitMs);
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
            case "challenge": {
              if (!login) {
                send2(room2.join(me, { nonce: m.nonce, host }, device));
                return;
              }
              const asked = { host: host.toLowerCase(), nonce: fromHex(m.nonce) };
              let proof;
              try {
                proof = await login(asked);
              } catch (e) {
                clearTimeout(joinTimer);
                reject(e);
                try {
                  ws.close();
                } catch {
                }
                return;
              }
              send2(room2.join({ ...me, certificate: proof, login: asked }, { nonce: m.nonce, host }, device));
              return;
            }
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
                for (const [id2, p] of pending) if (p.to === m.down) {
                  pending.delete(id2);
                  p.reject(new Error(`the device ${m.down} left the room`));
                }
                emit("peer", { down: m.down });
              }
              return;
            case "gone":
              for (const [id2, p] of pending) if (p.to === m.to) {
                pending.delete(id2);
                p.reject(new Error(`the device ${m.to} is not in the room`));
              }
              return;
            /*
             * AN AGENT ON THIS DEVICE'S KEY (the room's accepted agent - a computer's onlykey-js; ok-edge plan B4): its key
             * session messages (desktop/protocol.js's) - this device runs desktop/session.js on its key and answers with
             * keyReply. key-gone: that agent left, or the owner blocked it - its session is over.
             */
            case "key":
              if (typeof m.from === "string" && m.m && typeof m.m === "object") emit("key", { from: m.from, name: String(m.name || ""), m: m.m });
              return;
            case "key-gone":
              emit("key-gone", { from: String(m.from || "") });
              return;
            case "sealed-changed":
              if (m.rows && typeof m.rows === "object") emit("sealed-changed", { from: m.from || null, rows: m.rows });
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
                send2({ t: "frame", to: m.from, body: room2.sealFrame(key, { room: me.id, from: you, to: m.from }, { re: body.id, answer }, randomBytes5) });
              } catch {
              }
              return;
            }
            default:
          }
        };
        ws.onclose = (ev) => {
          clearTimeout(joinTimer);
          if (ping) clearInterval(ping);
          fail("the room connection closed");
          emit("close", { code: ev && ev.code, reason: ev && ev.reason });
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
              const id2 = ++seq;
              const timer = setTimeout(() => {
                if (pending.delete(id2)) rej(new Error(`no answer from ${to} within ${t} ms`));
              }, t);
              pending.set(id2, {
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
                send2({ t: "frame", to, body: room2.sealFrame(key, { room: me.id, from: you, to }, { id: id2, message }, randomBytes5) });
              } catch (e) {
                pending.delete(id2);
                clearTimeout(timer);
                rej(e);
              }
            });
          },
          /* one answer to the agents' side of the room, and the room's reply ({ev: 'ok' | 'agents', ...}) */
          /** one key-session message back to the agent that sent it (the room passes it to that agent's sockets) */
          keyReply(to, m) {
            try {
              send2({ t: "key-re", to, m });
            } catch {
            }
          },
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
          async planClaim(plan) {
            await api.mcp("plan-claim", { plan });
          },
          async planUpdate(plan, { state, results, receipts, why } = {}) {
            await api.mcp("plan", { plan, ...state ? { state } : {}, ...results ? { results } : {}, ...receipts ? { receipts } : {}, ...typeof why === "string" ? { why } : {} });
          },
          /*
           * THE SERVER'S SEALED COPY OF THIS BUCKET (bucket/src/sealedcopy.js; Phase 3): the room's rows as a row store for
           * sealedcopy.syncWith - ids and tags, sealed units the server cannot read. on: false only from a server older than
           * the tiers (2026-10-30), which kept copies for an allow-list alone. tier(): what the last table answer said - {tier:
           * 'free' | 'lifetime', purgeAt: ms | null} (free: dropped after its window without a touch) - or null before one.
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
            let tier = null;
            const table = /* @__PURE__ */ __name(async () => {
              const r = await api.sealed("table");
              if (r.tier) tier = { tier: r.tier, purgeAt: r.purgeAt ?? null };
              return r;
            }, "table");
            return {
              async on() {
                return Boolean((await table()).on);
              },
              async table() {
                return (await table()).rows || {};
              },
              tier() {
                return tier;
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

// node_modules/node-onlykey-lib/bucket/src/room-agent.js
var require_room_agent = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/room-agent.js"(exports, module) {
    "use strict";
    function connectAgent({ url, room: room2, agentKey, name, WebSocket: WS, timeoutMs = 1e4 }) {
      const base = new URL(url);
      const wsUrl = `${base.protocol === "https:" ? "wss:" : "ws:"}//${base.host}/ws/${room2}`;
      const listeners = /* @__PURE__ */ new Map();
      const emit = /* @__PURE__ */ __name((ev, v) => (listeners.get(ev) || []).forEach((l) => {
        try {
          l(v);
        } catch {
        }
      }), "emit");
      const on = /* @__PURE__ */ __name((ev, l) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(l);
        return () => {
          listeners.set(ev, (listeners.get(ev) || []).filter((x) => x !== l));
        };
      }, "on");
      return new Promise((resolve, reject) => {
        const ws = new WS(wsUrl);
        const send2 = /* @__PURE__ */ __name((m) => ws.send(JSON.stringify(m)), "send");
        let you = null;
        let state = null;
        let devices = [];
        const timer = setTimeout(() => {
          reject(new Error(`${base.host}: no answer to the agent's hello in ${timeoutMs} ms`));
          try {
            ws.close();
          } catch {
          }
        }, timeoutMs);
        ws.onerror = () => {
        };
        ws.onclose = (ev) => {
          clearTimeout(timer);
          emit("close", { code: ev && ev.code, reason: ev && ev.reason });
          if (!you) reject(new Error(`${base.host} closed the agent's connection${ev && ev.reason ? ` (${ev.reason})` : ""}`));
        };
        ws.onmessage = (ev) => {
          let m;
          try {
            m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
          } catch {
            return;
          }
          switch (m.t) {
            case "challenge":
              if (!you) send2({ t: "agent", agent_key: agentKey, name });
              return;
            case "agent":
              state = m.state;
              if (Array.isArray(m.devices)) devices = m.devices;
              if (!you) {
                you = m.you;
                clearTimeout(timer);
                if (state === "blocked") {
                  reject(new Error("the owner blocked this computer"));
                  return;
                }
                resolve(api);
              } else emit("state", state);
              return;
            case "refused":
              clearTimeout(timer);
              reject(new Error(`${base.host} refused the agent: ${m.why}`));
              return;
            case "devices":
              state = m.state;
              devices = m.devices || [];
              emit("devices", devices);
              return;
            case "peer":
              emit("peer", m);
              return;
            case "key":
              emit("key", m);
              return;
            case "key-refused":
              emit("key-refused", m);
              return;
            case "gone":
              emit("gone", m);
              return;
            default:
              return;
          }
        };
        const api = {
          get you() {
            return you;
          },
          get state() {
            return state;
          },
          get devices() {
            return devices;
          },
          on,
          refreshDevices() {
            send2({ t: "devices" });
          },
          close() {
            try {
              ws.close();
            } catch {
            }
          },
          /**
           * The channel cli/transport-desktop.js takes: the device's key session, by its device id. The room's refusal (not
           * accepted yet), the device going, or this connection closing all end it as the protocol's refused / close.
           */
          keyChannel(deviceId, { name: holder = "the phone" } = {}) {
            const msgs = /* @__PURE__ */ new Set();
            const closes = /* @__PURE__ */ new Set();
            const offs = [
              on("key", (k) => {
                if (k.from === deviceId) for (const f of [...msgs]) f(k.m);
              }),
              on("key-refused", (k) => {
                for (const f of [...msgs]) f({ t: "refused", why: k.why });
              }),
              on("gone", (g) => {
                if (g.to === deviceId) for (const f of [...msgs]) f({ t: "refused", why: `${holder} is not in the room` });
              }),
              on("peer", (p) => {
                if (p.down === deviceId) for (const f of [...closes]) f();
              }),
              on("close", () => {
                for (const f of [...closes]) f();
              })
            ];
            return Promise.resolve({
              send: /* @__PURE__ */ __name((m) => send2({ t: "key", to: deviceId, m }), "send"),
              onMessage: /* @__PURE__ */ __name((f) => msgs.add(f), "onMessage"),
              onClose: /* @__PURE__ */ __name((f) => closes.add(f), "onClose"),
              close: /* @__PURE__ */ __name(() => {
                for (const off of offs) off();
                api.close();
              }, "close"),
              hello: { t: "hello" },
              name: holder
            });
          }
        };
      });
    }
    __name(connectAgent, "connectAgent");
    module.exports = { connectAgent };
  }
});

// node_modules/node-onlykey-lib/bucket/src/roomsync.js
var require_roomsync = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/roomsync.js"(exports, module) {
    "use strict";
    var trade = require_trade();
    var replicate = require_replicate();
    var sealedCopy = require_sealedcopy();
    var logblocks = require_logblocks();
    var count = /* @__PURE__ */ __name((o) => Object.values(o || {}).reduce((a, b) => a + Number(b), 0), "count");
    var say = /* @__PURE__ */ __name((line) => {
      if (typeof console !== "undefined") console.log(line);
    }, "say");
    function createRoomSync({ open, me, save, handleTrade, rules, randomBytes: randomBytes5, selfId = /* @__PURE__ */ __name(() => "", "selfId"), answerMs = 12e4, tell = {} }) {
      for (const [n, f] of Object.entries({ open, me, save, handleTrade, randomBytes: randomBytes5 })) {
        if (typeof f !== "function") throw new TypeError(`room sync: ${n} is a function`);
      }
      const t = { pulse: /* @__PURE__ */ __name(() => {
      }, "pulse"), checked: /* @__PURE__ */ __name(() => {
      }, "checked"), traded: /* @__PURE__ */ __name(() => {
      }, "traded"), last: /* @__PURE__ */ __name(() => {
      }, "last"), items: /* @__PURE__ */ __name(() => ({}), "items"), ...tell };
      const wired = /* @__PURE__ */ new Map();
      let chain = Promise.resolve();
      const sealedSaid = /* @__PURE__ */ new Map();
      function queue(fn, onError) {
        chain = chain.then(fn).catch(onError);
        return chain;
      }
      __name(queue, "queue");
      function wire(r, hooks, joinedAs) {
        wired.set(r, hooks);
        r.serve(async (from, message) => {
          t.pulse();
          const out = await handleTrade(message, from, { allowed: /* @__PURE__ */ __name(() => open()?.identity === joinedAs.id, "allowed") });
          if (message?.type === trade.TYPES.PROVE && out?.ok && out.state && message.state) {
            const b = open()?.bucket;
            const differs = replicate.differs(out.state, message.state);
            const stores = {};
            if (b) for (const [name, items] of Object.entries(t.items(b))) stores[name] = { items, same: !differs.includes(name) };
            t.checked(stores);
          }
          if (message?.type === trade.TYPES.GIVE && out?.ok) {
            const b = open()?.bucket;
            t.traded(out.taken || {}, b ? t.items(b) : {});
            const who = r.peers().find((p) => p.id === from);
            t.last(who ? who.name : from, "traded - answered its trade");
          }
          return out;
        });
        r.on("peer", (p) => {
          hooks.peers(r);
          say(`${hooks.tag} ${p.up ? `${p.up.name} (${p.up.kind}) came online` : `${p.down} left`}`);
          if (p.up) tradeSoon(p.up, r, hooks);
        });
        r.on("sealed-changed", (e) => {
          void (async () => {
            const o = open();
            const m = await me();
            if (!o || !m) return;
            const at = sealedCopy.locate(o.bucket, sealedCopy.keysOf(m.bucketKey), e.rows, { rules });
            if (!at.stores.length && !at.unknown) return;
            say(`${hooks.tag} the sealed copy changed on the server (${e.from ?? "another device"}): newer there - ${[...at.stores, ...at.unknown ? [`${at.unknown} new`] : []].join(", ")}`);
            hooks.newer(at.stores, at.unknown);
            sealedSoon("the server copy changed", r, hooks);
          })().catch(() => {
          });
        });
        r.on("close", () => {
          wired.delete(r);
        });
        for (const p of r.peers()) tradeSoon(p, r, hooks);
        sealedSoon("joined", r, hooks);
      }
      __name(wire, "wire");
      function changed() {
        for (const [r, hooks] of wired) {
          for (const p of r.peers()) tradeSoon(p, r, hooks);
          sealedSoon("this bucket changed", r, hooks);
        }
      }
      __name(changed, "changed");
      function tradeSoon(peer, r, hooks) {
        const mine = selfId() || r.you || "";
        if (mine && peer.id < mine) {
          say(`${hooks.tag} ${peer.name}: it starts the trade (the lower id)`);
          return;
        }
        queue(() => tradeWith(peer, r, hooks), (e) => {
          const line = `not traded: ${String(e?.message ?? e)}`;
          say(`${hooks.tag} ${peer.name}: ${line}`);
          t.last(peer.name, line);
        });
      }
      __name(tradeSoon, "tradeSoon");
      async function tradeWith(peer, r, hooks) {
        const o = open();
        const m = await me();
        if (!r || !wired.has(r) || !o || !m) {
          say(`${hooks.tag} ${peer.name}: no trade - ${!o ? "no bucket open here" : !m ? "no proof material for the open bucket" : "that room is closed"}`);
          return;
        }
        const send2 = /* @__PURE__ */ __name((msg) => {
          t.pulse();
          return r.request(peer.id, msg, { timeoutMs: answerMs });
        }, "send");
        const c = trade.computerSide({ bucket: o.bucket, me: m, randomBytes: randomBytes5, rules });
        const done = /* @__PURE__ */ __name((line) => {
          say(`${hooks.tag} ${peer.name}: ${line}`);
          t.last(peer.name, line);
        }, "done");
        const m2 = c.prove(await send2(c.hello()));
        if (!m2) return done("refused - it did not prove this bucket identity, or does not trade");
        let step = c.compare(await send2(m2));
        if (!step) return done("it did not say its state");
        if (step.same) return done("in sync");
        const taken = {};
        let gave = 0;
        let settled = false;
        for (; ; ) {
          const g = c.give(await send2(step.message));
          if (!g) break;
          for (const [s2, n] of Object.entries(g.taken || {})) taken[s2] = (taken[s2] || 0) + Number(n);
          const s = c.settle(await send2(g.message));
          if (!s) break;
          gave += count(s.taken);
          if (s.same) {
            settled = true;
            break;
          }
          if (!s.message) break;
          step = s;
        }
        if (count(taken)) {
          await save();
          t.traded(taken, t.items(o.bucket));
        }
        done(`${settled ? "traded" : "not settled"} - took ${count(taken)}, gave ${gave}`);
      }
      __name(tradeWith, "tradeWith");
      function sealedSoon(why, r, hooks) {
        queue(() => sealedSync(why, r, hooks), (e) => {
          const msg = String(e?.message ?? e);
          say(`${hooks.tag} the sealed copy: not synced - ${msg}`);
          hooks.sealed({ status: "error", at: Date.now(), why: msg });
        });
      }
      __name(sealedSoon, "sealedSoon");
      async function sealedSync(why, r, hooks) {
        const o = open();
        const m = await me();
        if (!r || !wired.has(r) || !o || !m) return;
        const store = r.sealedStore();
        if (!await store.on()) {
          if (sealedSaid.get(hooks.tag) !== "off") {
            sealedSaid.set(hooks.tag, "off");
            say(`${hooks.tag} the sealed copy: this server keeps none for this identity`);
          }
          hooks.sealed({ status: "none", at: Date.now(), why: null, stores: {}, tier: null });
          return;
        }
        const entries = /* @__PURE__ */ __name((name) => Object.fromEntries(Object.entries(o.bucket.stores[name] ?? {}).filter(([, x]) => x && !x.archived && x.v !== null).map(([k, x]) => [k, x.v])), "entries");
        const heads = { ...logblocks.newestSeqs(entries("edge-logs")), ...logblocks.newestSeqs(entries("edge-logs-test")) };
        hooks.sealed({ status: "syncing" });
        t.pulse();
        const res = await sealedCopy.syncWith(o.bucket, sealedCopy.keysOf(m.bucketKey), store, { rules, randomBytes: randomBytes5, heads });
        for (const x of res.refused) say(`${hooks.tag} the sealed copy: a row refused - ${x}`);
        if (count(res.taken)) {
          await save();
          t.traded(res.taken, t.items(o.bucket));
        }
        sealedSaid.set(hooks.tag, "on");
        hooks.sealed({ status: "synced", at: Date.now(), why: null, stores: res.stores ?? {}, tier: typeof store.tier === "function" ? store.tier() : null });
        say(`${hooks.tag} the sealed copy (${why}): got ${res.got}, put ${res.put}${count(res.taken) ? ` - took ${JSON.stringify(res.taken)}` : ""}`);
      }
      __name(sealedSync, "sealedSync");
      const inQueue = /* @__PURE__ */ __name((fn) => queue(fn, (e) => say(`room sync: ${String(e?.message ?? e)}`)), "inQueue");
      return { wire, changed, inQueue, rooms: /* @__PURE__ */ __name(() => wired, "rooms") };
    }
    __name(createRoomSync, "createRoomSync");
    module.exports = { createRoomSync };
  }
});

// node_modules/node-onlykey-lib/bucket/src/index.js
var require_src = __commonJS({
  "node_modules/node-onlykey-lib/bucket/src/index.js"(exports, module) {
    "use strict";
    module.exports = { ...require_bucket(), rules: require_rules(), storeRules: require_store_rules().storeRules, storage: require_storage(), replicate: require_replicate(), bucketIdentity: require_bucket_identity(), trade: require_trade(), room: require_room(), roomClient: require_room_client(), roomAgent: require_room_agent(), sealedCopy: require_sealedcopy(), roomSync: require_roomsync() };
  }
});

// mcp-server/src/cloudflare/worker.js
var import_rectify = __toESM(require_rectify(), 1);
import { DurableObject } from "cloudflare:workers";

// node_modules/node-onlykey-lib/mcp/core/mcp.js
var import_src = __toESM(require_src(), 1);
var import_bytes = __toESM(require_bytes(), 1);
var import_x509 = __toESM(require_x509(), 1);
var PROTOCOL = "2025-06-18";
var SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
var SESSION_ID = /^[0-9a-f]{32}$/;
var HEX64 = /^[0-9a-f]{64}$/;
var MAX_ITEMS = 32;
var MAX_DATA = 64 * 1024;
var MAX_TEXT = 200;
var WAIT_MAX_S = 60;
var OPS = ["sign", "decrypt"];
var KINDS = ["ssh", "gpg", "rsa"];
var MAX_CERTS = 4;
var LABEL = /^[ -~]{1,64}$/;
var STATES = ["declined", "running", "done", "failed", "ended"];
var hex = /* @__PURE__ */ __name((u82) => import_bytes.default.toHex(u82), "hex");
var randomHex = /* @__PURE__ */ __name((n) => hex(crypto.getRandomValues(new Uint8Array(n))), "randomHex");
var sha256Hex = /* @__PURE__ */ __name(async (h) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", import_bytes.default.fromHex(h)))), "sha256Hex");
var roomOf = /* @__PURE__ */ __name((identityPublicKey) => import_src.default.bucketIdentity.identityIdOf(import_bytes.default.fromHex(identityPublicKey)), "roomOf");
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
var itemArgs = /* @__PURE__ */ __name((it, n) => {
  need(it && typeof it === "object", `item ${n}: {op, key, reason, fingerprint}`);
  need(OPS.includes(it.op), `item ${n}: op ${OPS.join(" or ")}`);
  const k = it.key || {};
  need(KINDS.includes(k.kind), `item ${n}: key.kind ${KINDS.join(", ")}`);
  let key;
  if (k.kind === "rsa") {
    const cert = typeof k.cert === "string" ? k.cert.trim().toLowerCase() : "";
    need(HEX64.test(cert), `item ${n}: an rsa key is named by key.cert - the SHA-256 (64 hex) of a certificate your card holds`);
    key = { kind: "rsa", cert };
  } else key = { kind: k.kind, identity: text(k.identity, `item ${n}: key.identity`) };
  const fingerprint = typeof it.fingerprint === "string" ? it.fingerprint.trim().toLowerCase() : "";
  need(HEX64.test(fingerprint), `item ${n}: fingerprint - the SHA-256 of its data, 64 hex`);
  return { op: it.op, key, reason: text(it.reason, `item ${n}: reason`), fingerprint };
}, "itemArgs");
var dataArg = /* @__PURE__ */ __name((d) => {
  const enc = d.encoding || "text";
  need(enc === "text" || enc === "base64", "encoding: text or base64");
  need(typeof d.data === "string" && d.data.length > 0 && d.data.length <= MAX_DATA, `data: 1 to ${MAX_DATA} characters`);
  if (enc === "base64") need(/^[A-Za-z0-9+/]*={0,2}$/.test(d.data) && d.data.length % 4 === 0, "data: not base64");
  return { data: d.data, encoding: enc };
}, "dataArg");
var bytesOf = /* @__PURE__ */ __name((one) => one.encoding === "base64" ? import_bytes.default.fromBase64(one.data) : new TextEncoder().encode(one.data), "bytesOf");
var KEY_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: KINDS, description: "ssh or gpg: an agent-derived key Edge uses; rsa: a key stored on the OnlyKey" },
    identity: { type: "string", description: `ssh / gpg: the key's label, e.g. "you@example.com" (gpg) or "ssh://user@host" (ssh)` },
    cert: { type: "string", description: "rsa: the SHA-256 (64 hex) of the key's X.509 certificate - one your card holds (card_new certs)" }
  },
  required: ["kind"]
};
var ITEM_SCHEMA = {
  type: "object",
  properties: {
    op: { type: "string", enum: OPS },
    key: KEY_SCHEMA,
    reason: { type: "string", description: "why, in a few words - the owner reads it before approving" },
    fingerprint: { type: "string", description: "SHA-256 of the exact bytes this item will sign (64 hex) - its data comes after the approval (plan_data)" }
  },
  required: ["op", "key", "reason", "fingerprint"]
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
    name: "card_new",
    description: "Ask the owner for your agent card: the keys your plans may use, under a label of your choosing. The owner approves it once and their key certifies it at a press; plan_wait on the plan_id it gives says when. Every plan names it.",
    inputSchema: { type: "object", properties: {
      identity: { type: "string" },
      label: { type: "string", description: "the card's label, 1-64 printable characters, fixed for good" },
      certs: { type: "array", items: { type: "string" }, description: "RSA keys on the OnlyKey, each named by its X.509 certificate (PEM): the owner's device finds the key it certifies - you never name a slot" },
      ssh: { type: "string", description: "an ssh identity to derive, ssh://user@host" },
      days: { type: "integer", description: "how long it lasts, in days (0 = until revoked)" },
      reason: { type: "string", description: "why you need it - the owner reads it" }
    }, required: ["identity", "label", "reason"] }
  },
  {
    name: "plan_new",
    description: "A new plan for an identity (its public key, 64 hex), under your card: every item with the SHA-256 of its data - no data yet. Its owner sees it in their web app at once, and every change after.",
    inputSchema: { type: "object", properties: { identity: { type: "string" }, title: { type: "string" }, card: { type: "string", description: "your card's label (card_new)" }, items: { type: "array", items: ITEM_SCHEMA } }, required: ["identity", "title", "card", "items"] }
  },
  {
    name: "plan_target",
    description: "Move a draft plan to another identity: withdrawn from the old owner's web app, shown in the new one's.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" }, identity: { type: "string" } }, required: ["plan_id", "identity"] }
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
    description: "Ask the owner to approve the plan - the item count and their fingerprints: one budget sized to it, one press. Refused until the owner has accepted you, or while no owner device is online.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" } }, required: ["plan_id"] }
  },
  {
    name: "plan_data",
    description: `Once the plan runs (its budget is open): the items' data (base64 when it is bytes, encoding: "base64"). Each must match its fingerprint, or nothing is signed.`,
    inputSchema: { type: "object", properties: { plan_id: { type: "string" }, items: { type: "array", items: { type: "object", properties: { item: { type: "integer" }, data: { type: "string" }, encoding: { type: "string", enum: ["text", "base64"] } }, required: ["item", "data"] } } }, required: ["plan_id", "items"] }
  },
  {
    name: "plan_wait",
    description: "Wait (up to 60 s) for the plan to move on: its state, the items whose data it still waits for, and at its end every item's result (signature or refusal) and the receipts.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" }, seconds: { type: "integer" } }, required: ["plan_id"] }
  },
  {
    name: "plan_finish",
    description: "End the plan's budget now: if its data has not all come, nothing is signed.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" } }, required: ["plan_id"] }
  }
];
var INSTRUCTIONS = "OnlyKey Edge control. Your owner gives you this URL and their identity public key. Say hello (keep the agent_key you get the first time); once, ask for your card (card_new) and plan_wait for its approval. Then build a plan under it: plan_new with every item's SHA-256 fingerprint and no data, plan_submit - the owner sees it live in their web app, accepts you once, approves the plan and presses their key once. When plan_wait says running, send the data (plan_data); plan_wait gives every result when the budget ends.";
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }), "json");
var rpcError = /* @__PURE__ */ __name((id2, code, message) => json({ jsonrpc: "2.0", id: id2 ?? null, error: { code, message } }), "rpcError");
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
    const id2 = randomHex(16);
    await env.MCP_SESSIONS.get(env.MCP_SESSIONS.idFromName(id2)).open();
    return json({ jsonrpc: "2.0", id: msg.id, result: {
      protocolVersion: SUPPORTED.includes(asked) ? asked : PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "ok-edge", version: "0.1.0" },
      instructions: INSTRUCTIONS
    } }, 200, { "Mcp-Session-Id": id2 });
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
var McpSessionCore = class {
  static {
    __name(this, "McpSessionCore");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
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
    const id2 = await sha256Hex(key.toLowerCase());
    await this.ctx.storage.put("agent", { id: id2, name });
    await this.env.AGENTS.get(this.env.AGENTS.idFromName(id2)).hello(id2, name);
    return first ? { agent_id: id2, agent_key: key, keep: "this agent_key is shown once: keep it, and send it in every later hello" } : { agent_id: id2 };
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
var AgentSessionCore = class {
  static {
    __name(this, "AgentSessionCore");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.waiters = [];
  }
  async hello(id2, name) {
    const me = await this.ctx.storage.get("me") || { id: id2, first: Date.now() };
    await this.ctx.storage.put("me", { ...me, name, last: Date.now() });
  }
  async me() {
    return this.ctx.storage.get("me");
  }
  async plan(id2) {
    return this.ctx.storage.get(`plan:${id2}`);
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
  /* a plan's items go out with their fingerprints and never their data: the data goes to the device that runs it (plan_data) */
  shown(p, me) {
    return {
      id: p.id,
      kind: p.kind || "plan",
      room: p.room,
      title: p.title,
      agent: { id: me.id, name: me.name },
      state: p.state,
      ...p.card ? { card: p.card } : {},
      ...p.ask ? { ask: p.ask } : {},
      items: p.items.map(({ item, op, key, reason, fingerprint }) => ({ item, op, key, reason, fingerprint })),
      results: p.results,
      receipts: p.receipts,
      why: p.why || null
    };
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
    if (name === "card_new") {
      const identity = identityArg(args.identity);
      const label = text(args.label, "label", { max: 64 });
      need(LABEL.test(label), "label: 1-64 printable characters");
      const certs = args.certs === void 0 ? [] : args.certs;
      need(Array.isArray(certs) && certs.length <= MAX_CERTS, `certs: up to ${MAX_CERTS} PEM certificates`);
      const read = certs.map((pem, i) => {
        need(typeof pem === "string" && pem.length <= 8192, `certs[${i}]: a PEM certificate`);
        try {
          return { pem: pem.trim(), sha256: import_x509.default.read(pem).sha256 };
        } catch (e) {
          throw new Refused(`certs[${i}]: ${e.message}`);
        }
      });
      const ssh = args.ssh === void 0 ? null : text(args.ssh, "ssh");
      need(ssh === null || /^ssh:\/\/\S+$/.test(ssh), "ssh: ssh://user@host");
      need(read.length || ssh, "a card names at least one key: certs or ssh");
      const days = args.days === void 0 ? 0 : Number(args.days);
      need(Number.isInteger(days) && days >= 0 && days <= 3650, "days: 0 (until revoked) to 3650");
      const ask = { label, certs: read.filter((c, i) => read.findIndex((x) => x.sha256 === c.sha256) === i), ...ssh ? { ssh } : {}, days, reason: text(args.reason, "reason") };
      const p2 = { id: randomHex(8), kind: "card", title: `agent card "${label}"`, identity, room: roomOf(identity), state: "draft", ask, items: [], results: {}, receipts: [], created: Date.now() };
      await this.save(p2);
      await this.mirror(p2);
      const r = await ROOM_STUB(this.env, p2.room).submit(this.shown({ ...p2, state: "submitted" }, me));
      if (r.ok) p2.state = "submitted";
      else p2.why = r.why;
      await this.save(p2);
      return this.view(p2);
    }
    if (name === "plan_new") {
      const identity = identityArg(args.identity);
      const card = text(args.card, "card", { max: 64 });
      need(Array.isArray(args.items) && args.items.length > 0 && args.items.length <= MAX_ITEMS, `items: 1 to ${MAX_ITEMS}, each {op, key, reason, fingerprint}`);
      const items = args.items.map((it, n) => ({ item: n + 1, ...itemArgs(it, n + 1) }));
      const p2 = { id: randomHex(8), title: text(args.title, "title"), identity, room: roomOf(identity), card, state: "draft", items, results: {}, receipts: [], created: Date.now() };
      await this.save(p2);
      const seen = await this.mirror(p2);
      return { ...this.view(p2), ...seen };
    }
    const p = await this.plan(String(args.plan_id || ""));
    need(p, `no plan ${args.plan_id} - plan_new makes one`);
    const draft = /* @__PURE__ */ __name(() => need(p.state === "draft", `the plan is ${p.state}: only a draft changes`), "draft");
    const itemOf = /* @__PURE__ */ __name((n) => {
      const it = p.items.find((x) => x.item === Number(n));
      need(it, `no item ${n} in the plan`);
      return it;
    }, "itemOf");
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
        need(p.kind === "card" || p.items.length > 0, "an empty plan: add an item first");
        const r = await ROOM_STUB(this.env, p.room).submit(this.shown({ ...p, state: "submitted", why: null }, me));
        need(r.ok, r.why);
        p.state = "submitted";
        p.why = null;
        await this.save(p);
        return this.view(p);
      }
      case "plan_data": {
        need(p.kind !== "card", "a card ask takes no data");
        need(p.state === "running", `the plan is ${p.state}: its data is sent once it runs (its budget is open - plan_wait)`);
        need(Array.isArray(args.items) && args.items.length > 0, "items: [{item, data, encoding}]");
        const sent = [];
        for (const d of args.items) {
          const it = itemOf(d && d.item);
          need(!it.sent, `item ${it.item}'s data was sent already`);
          const one = dataArg(d);
          need(await sha256Hex(import_bytes.default.toHex(bytesOf(one))) === it.fingerprint, `item ${it.item}'s data does not match its fingerprint ${it.fingerprint.slice(0, 16)} - not sent`);
          sent.push([it, one]);
        }
        for (const [it, one] of sent) {
          const r = await ROOM_STUB(this.env, p.room).data(p.id, it.item, one);
          need(r.ok, r.why);
          it.sent = true;
        }
        await this.save(p);
        return this.view(p);
      }
      case "plan_finish": {
        need(["submitted", "running"].includes(p.state), `the plan is ${p.state}: nothing to finish`);
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
  /* what the agent reads: the plan, the items whose data the running plan still waits for, and at its end the results */
  view(p) {
    return {
      plan_id: p.id,
      kind: p.kind || "plan",
      title: p.title,
      identity: p.identity,
      state: p.state,
      why: p.why || null,
      ...p.card ? { card: p.card } : {},
      ...p.ask ? { ask: p.ask } : {},
      items: p.items.map(({ item, op, key, reason, fingerprint, sent }) => ({ item, op, key, reason, fingerprint, sent: !!sent })),
      results: p.results,
      waiting: p.state === "running" ? p.items.filter((x) => !x.sent).map((x) => x.item) : [],
      receipts: p.receipts
    };
  }
  /**
   * What the owner did, from their room (index.js, an owner device's mcp-re): the plan's state - declined, running (its
   * budget open: the data may come), done, failed, ended - with results by item and the receipts. The room has checked
   * the plan is its own and the device joined; here the plan must be this agent's and past its draft.
   */
  async fromRoom(roomId, u) {
    const p = await this.plan(String(u.plan || ""));
    if (!p || p.room !== roomId || p.state === "draft") return { ok: false, why: "not a submitted plan of that identity" };
    if (u.state) {
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

// node_modules/node-onlykey-lib/mcp/core/room.js
var import_src2 = __toESM(require_src(), 1);
var import_bytes2 = __toESM(require_bytes(), 1);
var { room } = import_src2.default;
var ROOM_PATH = /^\/ws\/([0-9a-f]{32})$/;
var AGENT_STATES = ["accepted", "blocked", "removed"];
var MAX_FRAME = 4 * 1024 * 1024;
var JOIN_WITHIN_MS = 3e4;
var SEALED_MAX_IDS = 2e3;
var SEALED_MAX_BLOB = 1024 * 1024;
var send = /* @__PURE__ */ __name((ws, msg) => {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
  }
}, "send");
var RoomCore = class {
  static {
    __name(this, "RoomCore");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  /*
   * one connection's socket (the websocket API): accept it, give it this connection's challenge, JOIN_WITHIN_MS to answer.
   * origin 'ble': a phone over Bluetooth (localhost/ble.js) - the same socket, kept in its attachment for the join's rule.
   */
  async accept(server, url, { origin = null } = {}) {
    const { nonce, message } = room.challenge((n) => crypto.getRandomValues(new Uint8Array(n)));
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ room: ROOM_PATH.exec(url.pathname)[1], host: url.host, nonce: import_bytes2.default.toHex(nonce), device: null, since: Date.now(), origin });
    send(server, message);
    const at = await this.ctx.storage.getAlarm();
    if (at === null || at > Date.now() + JOIN_WITHIN_MS) await this.ctx.storage.setAlarm(Date.now() + JOIN_WITHIN_MS);
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
    if (me.agent) return this.fromAgent(ws, me, msg);
    if (!me.device && msg && msg.t === "agent" && me.origin !== "ble") return this.agentHello(ws, me, msg);
    if (!me.device) {
      const ble = me.origin === "ble";
      const check = room.checkJoin(
        me.room,
        msg,
        { nonce: import_bytes2.default.fromHex(me.nonce), host: me.host },
        { requireLogin: ble || this.env.REQUIRE_LOGIN === "1", open: !ble && this.env.OPEN_JOIN === "1" }
      );
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
      case "key-re": {
        if (typeof msg.to !== "string" || !msg.m || typeof msg.m !== "object") return send(ws, { t: "error", why: "a key-re is {to, m}" });
        const to = this.agents(msg.to);
        if (!to.length) return send(ws, { t: "key-gone", from: msg.to });
        for (const [s] of to) send(s, { t: "key", from: me.device.id, m: msg.m });
        return;
      }
      case "mcp-re": {
        const r = await this.fromOwner(me.room, msg, me.device.id);
        return send(ws, msg.re !== void 0 ? { ...r, re: msg.re } : r);
      }
      case "sealed": {
        if (!this.ctx.storage.sql) return send(ws, { t: "sealed", re: msg.re, on: false });
        const r = this.sealedOp(me.room, msg);
        await this.sealedTouch(me.room);
        send(ws, { t: "sealed", re: msg.re, ...r });
        if (msg.op === "put" && r.ok && r.n) {
          const rows = {};
          for (const [id2, x] of Object.entries(msg.rows)) rows[id2] = x.tag;
          for (const [other] of this.joined()) if (other !== ws) send(other, { t: "sealed-changed", from: me.device.id, rows });
        }
        return;
      }
      default:
        return send(ws, { t: "error", why: `unknown message ${JSON.stringify(msg && msg.t)}` });
    }
  }
  /* ------------------------------------------------------------------ the sealed copy (bucket/src/sealedcopy.js) */
  /*
   * THE IDENTITY'S SEALED COPY, IN THIS ROOM'S SQLITE (Phase 3; Brad, 2026-10-29: "the server's sealed copy will have a
   * hash table for changes"; the room's own SQLite, one row per unit). Rows the server cannot read: a keyed id, a keyed
   * change tag, a sealed unit - written and read only by the identity's own joined devices (this is past the join).
   *
   * TWO TIERS, AND EVERY IDENTITY SYNCS (Brad, 2026-10-30: "1 free (temp 7 day) and the lifetime (ones i choose)"; "they
   * both sync, i should not have to enable a key to sync, you should have to enable a key to not get purged if it has
   * not been touched"):
   *   free      any identity: its copy is dropped once nothing of it has touched the copy (a table, get or put by any of
   *             its devices) for SEALED_FREE_MS - 7 days unless set (a test server sets it short)
   *   lifetime  the ids in LIFETIME_IDENTITIES (comma-separated; * for all - local dev): never dropped
   * The drop is the room's alarm (alarm below) - an inactivity timer, nothing polls.
   */
  sealedLifetime(identity) {
    const list = String(this.env.LIFETIME_IDENTITIES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return list.includes("*") || list.includes(String(identity).toLowerCase());
  }
  sealedFreeMs() {
    const ms = Number(this.env.SEALED_FREE_MS);
    return Number.isFinite(ms) && ms > 0 ? ms : 7 * 24 * 3600 * 1e3;
  }
  sealedSql() {
    const sql = this.ctx.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS sealed (id TEXT PRIMARY KEY, tag TEXT NOT NULL, blob TEXT NOT NULL, at INTEGER NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS sealed_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
    return sql;
  }
  /* what the copy's tier is, and when a free copy is dropped if nothing touches it again (null: never) */
  sealedTier(identity, touched) {
    const lifetime = this.sealedLifetime(identity);
    return { tier: lifetime ? "lifetime" : "free", purgeAt: lifetime ? null : touched + this.sealedFreeMs() };
  }
  /* a touch: the 7 days start again, and the room's alarm is set for the earlier of that and any join deadline */
  async sealedTouch(identity) {
    const now = Date.now();
    const sql = this.sealedSql();
    sql.exec("INSERT INTO sealed_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", "touched", String(now));
    sql.exec("INSERT INTO sealed_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", "identity", String(identity));
    const { purgeAt } = this.sealedTier(identity, now);
    if (purgeAt === null) return;
    const at = await this.ctx.storage.getAlarm();
    if (at === null || at > purgeAt) await this.ctx.storage.setAlarm(purgeAt);
  }
  /* the alarm's half for the copy: a free copy nothing touched for its window is dropped; -> when to look again (or null) */
  sealedPurgeDue(now) {
    const sql = this.sealedSql();
    const meta = Object.fromEntries(sql.exec("SELECT k, v FROM sealed_meta").toArray().map((r) => [r.k, r.v]));
    if (!meta.identity || !meta.touched) return null;
    const { purgeAt } = this.sealedTier(meta.identity, Number(meta.touched));
    if (purgeAt === null) return null;
    if (now < purgeAt) return purgeAt;
    sql.exec("DELETE FROM sealed");
    sql.exec("DELETE FROM sealed_meta");
    return null;
  }
  sealedOp(identity, msg, touched = Date.now()) {
    const sql = this.sealedSql();
    const HEX = /^[0-9a-f]{32}$/;
    if (msg.op === "table") {
      const rows = {};
      for (const r of sql.exec("SELECT id, tag FROM sealed").toArray()) rows[r.id] = r.tag;
      return { on: true, rows, ...this.sealedTier(identity, touched) };
    }
    if (msg.op === "get") {
      const ids = Array.isArray(msg.ids) ? msg.ids.filter((id2) => typeof id2 === "string" && HEX.test(id2)).slice(0, SEALED_MAX_IDS) : [];
      const rows = {};
      for (const id2 of ids) {
        const r = sql.exec("SELECT blob FROM sealed WHERE id = ?", id2).toArray()[0];
        if (r) rows[id2] = r.blob;
      }
      return { rows };
    }
    if (msg.op === "put") {
      const entries = Object.entries(msg.rows && typeof msg.rows === "object" ? msg.rows : {});
      if (entries.length > SEALED_MAX_IDS) return { ok: false, why: `at most ${SEALED_MAX_IDS} rows a put` };
      for (const [id2, r] of entries) {
        if (!HEX.test(id2) || !r || typeof r.tag !== "string" || !HEX.test(r.tag) || typeof r.blob !== "string" || r.blob.length > SEALED_MAX_BLOB) {
          return { ok: false, why: `row ${String(id2).slice(0, 12)}: an id and a tag of 32 hex, a blob up to ${SEALED_MAX_BLOB} characters` };
        }
      }
      const now = Date.now();
      for (const [id2, r] of entries) sql.exec("INSERT INTO sealed (id, tag, blob, at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tag = excluded.tag, blob = excluded.blob, at = excluded.at", id2, r.tag, r.blob, now);
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
    if (a && a.agent) {
      if (!this.agents(a.agent.id).some(([s]) => s !== ws)) for (const [d] of this.joined()) send(d, { t: "key-gone", from: a.agent.id });
      return;
    }
    if (!a || !a.device) return;
    for (const [s] of this.agents()) send(s, { t: "peer", down: a.device.id });
    const others = this.joined().filter(([s]) => s !== ws);
    if (others.some(([, b]) => b.device.id === a.device.id)) return;
    for (const [other] of others) send(other, { t: "peer", down: a.device.id });
  }
  /* ------------------------------------------------------------------ the agents and their plans (mcp.js) */
  /* to every joined device of this identity - the owner's web app, phone, desktop */
  tell(msg) {
    for (const [ws] of this.joined()) send(ws, { t: "mcp", ...msg });
  }
  /* ------------------------------------------------------------------ an agent on the identity's key (plan B4) */
  /*
   * THE CLI REACHES A DEVICE'S KEY THROUGH THE ROOM (ok-edge plan B4; Brad, 2026-11-01: "the app authorizes/approves ble
   * over to the host using the same mechanism ... re-use code we already have"): a computer's onlykey-js is an AGENT of
   * this identity - the same agent record the MCP keeps (agent:<id>, id = sha256 of its agent_key), accepted, blocked or
   * removed only by the owner's own devices (fromOwner). It opens a socket to the room and introduces itself
   * ({t:'agent', agent_key, name}) instead of joining; while accepted, its {t:'key', to, m} goes to the device it names -
   * the device runs the lib's key session (desktop/session.js) on its key and answers {t:'key-re', to, m}. A new agent is
   * entered as pending and the owner told, as a plan's agent is; nothing reaches a key until the owner accepts it.
   */
  agents(id2 = null) {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a && a.agent && (id2 === null || a.agent.id === id2)) out.push([ws, a]);
    }
    return out;
  }
  async agentHello(ws, me, msg) {
    const key = typeof msg.agent_key === "string" ? msg.agent_key.toLowerCase() : "";
    const name = typeof msg.name === "string" ? msg.name.slice(0, 60) : "";
    if (!/^[0-9a-f]{64}$/.test(key) || !name) {
      send(ws, { t: "refused", why: "an agent is {agent_key: 64 hex, name}" });
      return ws.close(4400, "not an agent");
    }
    const id2 = import_bytes2.default.toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", import_bytes2.default.fromHex(key))));
    let a = await this.agentOf(id2);
    if (!a) {
      a = { id: id2, name, state: "pending", first: Date.now() };
      this.tell({ ev: "agent", agent: a });
    }
    a = { ...a, name, last: Date.now() };
    await this.ctx.storage.put(`agent:${id2}`, a);
    if (a.state === "blocked") {
      send(ws, { t: "agent", you: id2, state: "blocked" });
      return ws.close(4403, "blocked");
    }
    ws.serializeAttachment({ ...me, agent: { id: id2, name }, nonce: null });
    send(ws, { t: "agent", you: id2, state: a.state, devices: this.joined().map(([, d]) => d.device) });
  }
  async fromAgent(ws, me, msg) {
    switch (msg && msg.t) {
      case "key": {
        const a = await this.agentOf(me.agent.id);
        if (!a || a.state !== "accepted") return send(ws, { t: "key-refused", why: `the owner has not accepted this computer (${a ? a.state : "removed"}) - they accept it in the app's Agents list` });
        if (typeof msg.to !== "string" || !msg.m || typeof msg.m !== "object") return send(ws, { t: "error", why: "a key is {to, m}" });
        const to = this.joined().find(([, d]) => d.device.id === msg.to);
        if (!to) return send(ws, { t: "gone", to: msg.to });
        return send(to[0], { t: "key", from: me.agent.id, name: me.agent.name, m: msg.m });
      }
      case "devices": {
        const a = await this.agentOf(me.agent.id);
        return send(ws, { t: "devices", state: a ? a.state : "removed", devices: this.joined().map(([, d]) => d.device) });
      }
      default:
        return send(ws, { t: "error", why: `an agent sends key or devices, not ${JSON.stringify(msg && msg.t)}` });
    }
  }
  async agentOf(id2) {
    return this.ctx.storage.get(`agent:${id2}`);
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
  /*
   * AN ITEM'S DATA (plan_data, once its budget is open): passed on to the devices and never kept here - the room's mirror
   * of the plan holds the fingerprints only (mcp.js shown); the device that runs it checks the data against them.
   */
  async data(planId, item, data) {
    const plan = await this.ctx.storage.get(`plan:${planId}`);
    if (!plan || plan.state !== "running") return { ok: false, why: "the plan is not running here" };
    if (!this.joined().length) return { ok: false, why: "no owner device is online" };
    if (!plan.items.some((x) => x.item === item)) return { ok: false, why: `no item ${item} in the plan` };
    this.tell({ ev: "data", plan: planId, item, data: data.data, encoding: data.encoding });
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
  async fromOwner(roomId, msg, deviceId = null) {
    if (msg.op === "agents") return { t: "mcp", ev: "agents", agents: [...(await this.ctx.storage.list({ prefix: "agent:" })).values()], plans: await this.plans() };
    if (msg.op === "agent") {
      if (!AGENT_STATES.includes(msg.state)) return { t: "error", why: `an agent is ${AGENT_STATES.join(" | ")}` };
      const a = await this.agentOf(String(msg.agent || ""));
      if (!a) return { t: "error", why: "no such agent here" };
      if (msg.state === "removed") await this.ctx.storage.delete(`agent:${a.id}`);
      else await this.ctx.storage.put(`agent:${a.id}`, { ...a, state: msg.state });
      if (msg.state !== "accepted") {
        for (const p of await this.plans()) {
          if (p.agent.id === a.id && p.state !== "running") await this.withdraw(p.id, `agent ${msg.state}`);
        }
      }
      this.tell({ ev: "agent", agent: { ...a, state: msg.state } });
      for (const [s] of this.agents(a.id)) {
        send(s, { t: "agent", you: a.id, state: msg.state });
        if (msg.state !== "accepted") s.close(4403, msg.state);
      }
      if (msg.state !== "accepted") for (const [d] of this.joined()) send(d, { t: "key-gone", from: a.id });
      return { t: "mcp", ev: "ok", op: "agent" };
    }
    if (msg.op === "plan-claim") {
      const plan = await this.ctx.storage.get(`plan:${String(msg.plan || "")}`);
      if (!plan) return { t: "error", why: "no such plan here" };
      if (plan.by && plan.by !== deviceId) return { t: "error", why: "another of your devices runs it" };
      if (!plan.by && plan.state !== "submitted") return { t: "error", why: `the plan is ${plan.state}, not waiting for approval` };
      plan.by = deviceId;
      await this.ctx.storage.put(`plan:${plan.id}`, plan);
      this.tell({ ev: "plan", plan });
      return { t: "mcp", ev: "ok", op: "plan-claim" };
    }
    if (msg.op === "plan") {
      const plan = await this.ctx.storage.get(`plan:${String(msg.plan || "")}`);
      if (!plan) return { t: "error", why: "no such plan here" };
      if (plan.by && plan.by !== deviceId) return { t: "error", why: "another of your devices runs it" };
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
  /*
   * The room's one alarm, two jobs: close the sockets that never joined in time, and drop a free sealed copy nothing has
   * touched for its window. Set again for whichever comes first.
   */
  async alarm() {
    const now = Date.now();
    let waiting = false;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || a.device || a.agent) continue;
      if (now - a.since >= JOIN_WITHIN_MS) ws.close(4408, "no join in time");
      else waiting = true;
    }
    const purge = this.sealedPurgeDue(now);
    const next = [waiting ? now + JOIN_WITHIN_MS : null, purge].filter((x) => x !== null);
    if (next.length) await this.ctx.storage.setAlarm(Math.min(...next));
  }
};

// node_modules/node-onlykey-lib/mcp/core/plugin.js
function setup(imports, register) {
  register(null, { mcpCore: { handleMcp, RoomCore, McpSessionCore, AgentSessionCore, ROOM_PATH } });
}
__name(setup, "setup");
setup.consumes = [];
setup.provides = ["mcpCore"];

// mcp-server/src/cloudflare/plugin.js
function setup2(imports, register) {
  const { mcpCore } = imports;
  register(null, {
    mcpCloudflare: {
      async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/mcp") return mcpCore.handleMcp(request, env);
        const m = mcpCore.ROOM_PATH.exec(url.pathname);
        if (!m) return env.ASSETS.fetch(request);
        if (request.headers.get("Upgrade") !== "websocket") return new Response("a websocket only", { status: 426 });
        return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
      }
    }
  });
}
__name(setup2, "setup");
setup2.consumes = ["mcpCore"];
setup2.provides = ["mcpCloudflare"];

// mcp-server/src/cloudflare/worker.js
var app = import_rectify.default.build([setup, setup2]);
var services = app.start().then(() => app.services);
var worker_default = {
  async fetch(request, env) {
    return (await services).mcpCloudflare.fetch(request, env);
  }
};
var IdentityRoom = class extends DurableObject {
  static {
    __name(this, "IdentityRoom");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    this.core = services.then((s) => new s.mcpCore.RoomCore(ctx, env));
  }
  /* one connection: a socket pair, the server end accepted by the room */
  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    await (await this.core).accept(server, new URL(request.url));
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, data) {
    return (await this.core).webSocketMessage(ws, data);
  }
  async webSocketClose(ws) {
    return (await this.core).webSocketClose(ws);
  }
  async webSocketError(ws) {
    return (await this.core).webSocketError(ws);
  }
  async alarm() {
    return (await this.core).alarm();
  }
  /* the agents' room side, as the MCP sessions call it (mcp.js ROOM_STUB) */
  async show(...a) {
    return (await this.core).show(...a);
  }
  async withdraw(...a) {
    return (await this.core).withdraw(...a);
  }
  async agentStatus(...a) {
    return (await this.core).agentStatus(...a);
  }
  async submit(...a) {
    return (await this.core).submit(...a);
  }
  async fill(...a) {
    return (await this.core).fill(...a);
  }
  async finish(...a) {
    return (await this.core).finish(...a);
  }
};
var McpSession = class extends DurableObject {
  static {
    __name(this, "McpSession");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.core = services.then((s) => new s.mcpCore.McpSessionCore(ctx, env));
  }
  async open(...a) {
    return (await this.core).open(...a);
  }
  async known(...a) {
    return (await this.core).known(...a);
  }
  async end(...a) {
    return (await this.core).end(...a);
  }
  async call(...a) {
    return (await this.core).call(...a);
  }
};
var AgentSession = class extends DurableObject {
  static {
    __name(this, "AgentSession");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.core = services.then((s) => new s.mcpCore.AgentSessionCore(ctx, env));
  }
  async hello(...a) {
    return (await this.core).hello(...a);
  }
  async me(...a) {
    return (await this.core).me(...a);
  }
  async plan(...a) {
    return (await this.core).plan(...a);
  }
  async tool(...a) {
    return (await this.core).tool(...a);
  }
  async fromRoom(...a) {
    return (await this.core).fromRoom(...a);
  }
};
export {
  AgentSession,
  IdentityRoom,
  McpSession,
  worker_default as default
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
@noble/curves/abstract/der.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/nist.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/post-quantum/utils.js:
@noble/post-quantum/_crystals.js:
@noble/post-quantum/ml-kem.js:
@noble/post-quantum/ml-dsa.js:
  (*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=worker.js.map
