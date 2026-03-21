(() => {
    const isWorker = typeof importScripts !== 'undefined';
    const isIframe = !isWorker && window.self !== window.top;

    // === TOSTRING() SPOOFING (Zero-Trace Native Binding) ===
    const originalToString = Function.prototype.toString;
    const spoofedFunctions = new WeakMap();
    let inToString = false;

    function toString() {
        if (inToString) return originalToString.call(this);
        inToString = true;
        try {
            if (typeof this === 'function' && spoofedFunctions.has(this)) return spoofedFunctions.get(this);
            return originalToString.apply(this, arguments);
        } finally {
            inToString = false;
        }
    }
    Object.defineProperty(toString, "name", { value: "toString" });
    Object.defineProperty(toString, "length", { value: 0 });
    Object.setPrototypeOf(toString, Function.prototype);
    spoofedFunctions.set(toString, 'function toString() { [native code] }');
    Function.prototype.toString = toString;

    const originalObjectToString = Object.prototype.toString;
    const objectToStringProxy = function toString() {
        if (typeof this === 'function' && spoofedFunctions.has(this)) return '[object Function]';
        return originalObjectToString.call(this);
    };
    Object.defineProperty(objectToStringProxy, "name", { value: "toString" });
    Object.defineProperty(objectToStringProxy, "length", { value: 0 });
    spoofedFunctions.set(objectToStringProxy, 'function toString() { [native code] }');
    Object.prototype.toString = objectToStringProxy;

    const hookFunction = (obj, methodName, newFunc, fakeName, isGetter = false) => {
        try {
            if (!obj) return;
            const originalAttr = Object.getOwnPropertyDescriptor(obj, methodName);
            const original = isGetter ? (originalAttr ? originalAttr.get : undefined) : obj[methodName];

            if (original) {
                Object.setPrototypeOf(newFunc, Object.getPrototypeOf(original));
                Object.defineProperty(newFunc, "name", { value: fakeName || original.name || methodName });
                Object.defineProperty(newFunc, "length", { value: original.length || 0 });
            }

            if (isGetter) {
                Object.defineProperty(obj, methodName, { get: newFunc, configurable: true, enumerable: true });
                spoofedFunctions.set(newFunc, `function ${fakeName}() { [native code] }`);
            } else {
                obj[methodName] = newFunc;
                spoofedFunctions.set(newFunc, `function ${fakeName || methodName}() { [native code] }`);
                if (original) spoofedFunctions.set(original, `function ${fakeName || methodName}() { [native code] }`);
            }
        } catch (e) {}
    };

    // === 1. DETERMINISTIC SEED (Synced via DOM/Storage/Worker param) ===
    const getSeed = () => {
        if (isWorker) {
            const params = new URLSearchParams(self.location.search);
            const s = params.get('__t_seed');
            return s ? parseInt(s, 10) >>> 0 : 123456789;
        }
        try {
            const sess = sessionStorage.getItem('__t_seed');
            if (sess) return parseInt(sess, 10) >>> 0;
        } catch (e) {}
        const attr = document.documentElement.getAttribute('data-target-seed');
        if (attr) {
            const s = parseInt(attr, 10) >>> 0;
            try { sessionStorage.setItem('__t_seed', s); } catch (e) {}
            return s;
        }
        const s = crypto.getRandomValues(new Uint32Array(1))[0];
        try { sessionStorage.setItem('__t_seed', s); } catch (e) {}
        return s;
    };

    const seed = getSeed();
    function mulberry32(a) {
        return function() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }
    const rand = mulberry32(seed);

    if (!isWorker && !isIframe) {
        console.log(`%c[Torelium Core] %cDonanım Kimliği: %c${seed}`, 
            "color: #00ff00; font-weight: bold", "color: #ffffff", "color: #00ffff; font-weight: bold");
    }

    const PROFILES = [
        { gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)', vendor: 'Google Inc. (NVIDIA)', cores: [12, 16], mem: [16, 24], maxTex: 16384, maxVP: [32768, 32768], res: [1920, 1080] },
        { gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)', vendor: 'Google Inc. (Intel)', cores: [4, 6, 8], mem: [8, 12, 16], maxTex: 16383, maxVP: [16384, 16384], res: [1366, 768] },
        { gpu: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)', vendor: 'Google Inc. (AMD)', cores: [8, 12], mem: [8, 16], maxTex: 16384, maxVP: [16384, 16384], res: [1920, 1080] },
        { gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)', vendor: 'Google Inc. (NVIDIA)', cores: [16, 20, 32], mem: [32, 64], maxTex: 32768, maxVP: [32768, 32768], res: [2560, 1440] },
        { gpu: 'ANGLE (Apple, Apple M1 Direct3D11 vs_5_0 ps_5_0)', vendor: 'Google Inc. (Apple)', cores: [8], mem: [8, 16], maxTex: 16384, maxVP: [16384, 16384], res: [2560, 1600] }
    ];

    const pRaw = PROFILES[seed % PROFILES.length];
    const hw = {
        gpu: pRaw.gpu.replace('11', '11.' + (seed % 99)), // Varied driver/version string
        vendor: pRaw.vendor,
        cores: pRaw.cores[Math.floor(rand() * pRaw.cores.length)],
        mem: pRaw.mem[Math.floor(rand() * pRaw.mem.length)],
        maxTex: pRaw.maxTex, 
        maxVP: pRaw.maxVP.map(v => v - (seed % 5) * 64), // Procedural variance
        scrW: pRaw.res[0], scrH: pRaw.res[1]
    };

    const LOCATIONS = [
        { locale: 'en-US', zone: 'America/New_York', lang: ['en-US', 'en'] },
        { locale: 'en-GB', zone: 'Europe/London', lang: ['en-GB', 'en'] },
        { locale: 'de-DE', zone: 'Europe/Berlin', lang: ['de-DE', 'de', 'en'] },
        { locale: 'tr-TR', zone: 'Europe/Istanbul', lang: ['tr-TR', 'tr', 'en'] },
        { locale: 'fr-FR', zone: 'Europe/Paris', lang: ['fr-FR', 'fr', 'en'] },
        { locale: 'ja-JP', zone: 'Asia/Tokyo', lang: ['ja-JP', 'ja', 'en'] },
        { locale: 'es-ES', zone: 'Europe/Madrid', lang: ['es-ES', 'es', 'en'] },
        { locale: 'it-IT', zone: 'Europe/Rome', lang: ['it-IT', 'it', 'en'] },
        { locale: 'en-CA', zone: 'America/Toronto', lang: ['en-CA', 'en'] },
        { locale: 'en-AU', zone: 'Australia/Sydney', lang: ['en-AU', 'en'] },
        { locale: 'ko-KR', zone: 'Asia/Seoul', lang: ['ko-KR', 'ko', 'en'] },
        { locale: 'pt-BR', zone: 'America/Sao_Paulo', lang: ['pt-BR', 'pt', 'en'] },
        { locale: 'nl-NL', zone: 'Europe/Amsterdam', lang: ['nl-NL', 'nl', 'en'] },
        { locale: 'zh-HK', zone: 'Asia/Hong_Kong', lang: ['zh-HK', 'zh', 'en'] },
        { locale: 'en-SG', zone: 'Asia/Singapore', lang: ['en-SG', 'en'] },
        { locale: 'fr-CH', zone: 'Europe/Zurich', lang: ['fr-CH', 'de-CH', 'it-CH', 'en'] }
    ];
    const loc = LOCATIONS[seed % LOCATIONS.length];

    // === 3. CORE SPOOFS (Navigator, Screen, Performance) ===
    if (!isWorker) {
        const navProto = Navigator.prototype;
        hookFunction(navProto, 'webdriver', () => false, 'get webdriver', true);
        const spoofs = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.116 Safari/537.36', languages: loc.lang, language: loc.lang[0], hardwareConcurrency: hw.cores, deviceMemory: hw.mem, platform: 'Win32' };
        for (let [k, v] of Object.entries(spoofs)) hookFunction(navProto, k, () => v, `get ${k}`, true);

        const scrProto = Screen.prototype;
        hookFunction(scrProto, 'width', () => hw.scrW, 'get width', true);
        hookFunction(scrProto, 'height', () => hw.scrH, 'get height', true);
        hookFunction(scrProto, 'availWidth', () => hw.scrW, 'get availWidth', true);
        hookFunction(scrProto, 'availHeight', () => hw.scrH - 40, 'get availHeight', true);
    } else {
        hookFunction(self.Navigator.prototype, 'hardwareConcurrency', () => hw.cores, 'get hardwareConcurrency', true);
        hookFunction(self.Navigator.prototype, 'deviceMemory', () => hw.mem, 'get deviceMemory', true);
        hookFunction(self.Navigator.prototype, 'languages', () => loc.lang, 'get languages', true);
    }

    const originalNow = Performance.prototype.now;
    hookFunction(Performance.prototype, 'now', function() { return originalNow.apply(this, arguments) + 0.0001; }, 'now');

    // === 4. GRAPHICS (Canvas, OffscreenCanvas, WebGL) ===
    const applyCanvasNoise = (res) => {
        if (!res || !res.data || res.data.length < 32) return;
        const points = 20;
        const step = Math.floor(res.data.length / points);
        for (let i = 0; i < points; i++) {
            const idx = (i * step) + (seed % 4);
            if (idx < res.data.length) res.data[idx] = res.data[idx] ^ (1 + (seed % 3));
        }
    };

    const canvasProtos = [{ p: CanvasRenderingContext2D.prototype, n: 'CanvasRenderingContext2D' }];
    if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') canvasProtos.push({ p: OffscreenCanvasRenderingContext2D.prototype, n: 'OffscreenCanvasRenderingContext2D' });
    
    for (let item of canvasProtos) {
        const proto = item.p;
        const oGID = proto.getImageData;
        hookFunction(proto, 'getImageData', function() { const res = oGID.apply(this, arguments); applyCanvasNoise(res); return res; }, 'getImageData');
        
        const oMT = proto.measureText;
        hookFunction(proto, 'measureText', function() { 
            const m = oMT.apply(this, arguments); 
            const jitter = (seed % 100) / 1000000000000;
            return { ...m, width: m.width + jitter }; 
        }, 'measureText');
    }

    // SVG Spoofing for CreepJS
    if (typeof SVGElement !== 'undefined') {
        const oGBB = SVGElement.prototype.getBBox;
        hookFunction(SVGElement.prototype, 'getBBox', function() {
            const b = oGBB.apply(this, arguments);
            const j = (seed % 50) / 1000000;
            return { x: b.x + j, y: b.y + j, width: b.width + j, height: b.height + j };
        }, 'getBBox');
    }

    const GL_PARAMS = { 37445: hw.vendor, 37446: hw.gpu, 3379: hw.maxTex, 3386: new Int32Array(hw.maxVP), 34024: hw.maxTex, 34076: hw.maxTex };
    const glProtos = [WebGLRenderingContext.prototype];
    if (typeof WebGL2RenderingContext !== 'undefined') glProtos.push(WebGL2RenderingContext.prototype);
    for (let proto of glProtos) {
        const original = proto.getParameter;
        hookFunction(proto, 'getParameter', function(p) { return GL_PARAMS.hasOwnProperty(p) ? GL_PARAMS[p] : original.call(this, p); }, 'getParameter');
    }

    // === 5. AUDIO SEEDING ===
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const AC = typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext;
        const oCA = AC.prototype.createAnalyser;
        hookFunction(AC.prototype, 'createAnalyser', function() {
            const a = oCA.call(this);
            const oGFFD = a.getFloatFrequencyData;
            hookFunction(a, 'getFloatFrequencyData', function(arr) { oGFFD.call(this, arr); if (arr.length > 10) for (let i = 0; i < arr.length; i += 2) arr[i] += 0.0000001 * ((seed % 5) - 2); }, 'getFloatFrequencyData');
            return a;
        }, 'createAnalyser');
    }

    // === 6. WORKER INTERCEPTION (The Ultimate CreepJS Bypass) ===
    if (!isWorker) {
        const originalWorker = window.Worker;
        const originalSharedWorker = window.SharedWorker;
        const scriptUrl = document.documentElement.getAttribute('data-extension-url');

        if (scriptUrl) {
            const wrapWorker = (Orig) => {
                return function(url, options) {
                    const blobUrl = URL.createObjectURL(new Blob([`importScripts("${scriptUrl}?__t_seed=${seed}");`, `/* Original Code Start */\n`, `importScripts("${url}");`], { type: 'application/javascript' }));
                    const w = new Orig(blobUrl, options);
                    spoofedFunctions.set(w, `function ${Orig.name}() { [native code] }`);
                    return w;
                };
            };

            window.Worker = wrapWorker(originalWorker);
            window.SharedWorker = wrapWorker(originalSharedWorker);
            Object.setPrototypeOf(window.Worker, originalWorker);
            Object.setPrototypeOf(window.SharedWorker, originalSharedWorker);
        }
    }

    // === 7. STEALTH (Stack cleaning and consistency) ===
    const originalError = Error;
    hookFunction(Error, 'prepareStackTrace', (err, stacks) => stacks.filter(s => !s.getFileName()?.includes('chrome-extension://')).join('\n'), 'prepareStackTrace');

    // Intl Localization
    const targetTZ = loc.zone; const targetLocale = loc.locale;
    const wrapIntl = (Class, name) => {
        const Orig = Intl[Class];
        Intl[Class] = function(locale, options) {
            if (Class === 'DateTimeFormat') options = { ...options, timeZone: options?.timeZone || targetTZ };
            return new Orig(locale || targetLocale, options);
        };
        Intl[Class].prototype = Orig.prototype;
        spoofedFunctions.set(Intl[Class], `function ${name}() { [native code] }`);
    };
    ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'PluralRules', 'Collator'].forEach(c => wrapIntl(c, c));

    hookFunction(Date.prototype, 'getTimezoneOffset', function getTimezoneOffset() {
        try {
            const date = new Date();
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: targetTZ,
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
            }).formatToParts(date);
            const getP = (t) => parts.find(p => p.type === t).value;
            const targetDate = new Date(getP('year'), getP('month')-1, getP('day'), getP('hour') === '24' ? '00' : getP('hour'), getP('minute'), getP('second'));
            return Math.round((date.getTime() - targetDate.getTime()) / 60000);
        } catch (e) { return 0; }
    }, 'getTimezoneOffset');
})();

