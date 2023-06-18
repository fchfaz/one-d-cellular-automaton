(function (pool, math) {
  var global = this,
    width = 256,
    chunks = 6,
    digits = 52,
    rngname = "random",
    startdenom = math.pow(width, chunks),
    significance = math.pow(2, digits),
    overflow = significance * 2,
    mask = width - 1,
    modecrypto;

  function seedrandom(seed, options, callback) {
    var key = [];
    options = options == true ? { entropy: true } : options || {};

    var shortseed = mixkey(
      flatten(
        options.entropy
          ? [seed, toString(pool)]
          : seed == null
          ? autoseed()
          : seed,
        3
      ),
      key
    );

    var arc4 = new ARC4(key);

    var prng = function () {
      var n = arc4.g(chunks),
        d = startdenom,
        x = 0;

      while (n < significance) {
        n = (n + x) * width;
        d *= width;
        x = arc4.g(1);
      }
      while (n >= overflow) {
        n /= 2;
        d /= 2;
        x >>>= 1;
      }
      return (n + x) / d;
    };
    prng.int32 = function () {
      return arc4.g(4) | 0;
    };
    prng.quick = function () {
      return arc4.g(4) / 0x100000000;
    };
    prng.double = prng;

    mixkey(tostring(arc4.S), pool);

    return (
      options.pass ||
      callback ||
      function (prng, seed, is_math_call, state) {
        if (state) {
          if (state.S) {
            copy(state, arc4);
          }

          prng.state = function () {
            return copy(arc4, {});
          };
        }

        if (is_math_call) {
          math[rngname] = prng;
          return seed;
        } else return prng;
      }
    )(
      prng,
      shortseed,
      "global" in options ? options.global : this == math,
      options.state
    );
  }
  math["seed" + rngname] = seedrandom;

  function ARC4(key) {
    var t,
      keylen = key.length,
      me = this,
      i = 0,
      j = (me.i = me.j = 0),
      s = (me.S = []);

    if (!keylen) {
      key = [keylen++];
    }

    while (i < width) {
      s[i] = i++;
    }
    for (i = 0; i < width; i++) {
      s[i] = s[(j = mask & (j + key[i % keylen] + (t = s[i])))];
      s[j] = t;
    }

    (me.g = function (count) {
      var t,
        r = 0,
        i = me.i,
        j = me.j,
        s = me.S;
      while (count--) {
        t = s[(i = mask & (i + 1))];
        r =
          r * width + s[mask & ((s[i] = s[(j = mask & (j + t))]) + (s[j] = t))];
      }
      me.i = i;
      me.j = j;
      return r;
    })(width);
  }

  function copy(f, t) {
    t.i = f.i;
    t.j = f.j;
    t.S = f.S.slice();
    return t;
  }

  function flatten(obj, depth) {
    var result = [],
      typ = typeof obj,
      prop;
    if (depth && typ == "object") {
      for (prop in obj) {
        try {
          result.push(flatten(obj[prop], depth - 1));
        } catch (e) {}
      }
    }
    return result.length ? result : typ == "string" ? obj : obj + "\0";
  }

  function mixkey(seed, key) {
    var stringseed = seed + "",
      smear,
      j = 0;
    while (j < stringseed.length) {
      key[mask & j] =
        mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++));
    }
    return tostring(key);
  }

  function autoseed() {
    try {
      if (nodecrypto) {
        return tostring(nodecrypto.randomBytes(width));
      }
      var out = new Uint8Array(width);
      (global.crypto || global.msCrypto).getRandomValues(out);
      return tostring(out);
    } catch (e) {
      var browser = global.navigator,
        plugins = browser && browser.plugins;
      return [+new Date(), global, plugins, global.screen, tostring(pool)];
    }
  }

  function tostring(a) {
    return String.fromCharCode.apply(0, a);
  }

  mixkey(math.random(), pool);

  if (typeof module == "object" && module.exports) {
    module.exports = seedrandom;

    try {
      nodecrypto = require("crypto");
    } catch (ex) {}
  } else if (typeof define == "function" && define.amd) {
    define(function () {
      return seedrandom;
    });
  }
})([], Math);
