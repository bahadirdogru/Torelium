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
                Object.defineProperty(newFunc, "name", { value: fakeName || (original.name && original.name !== 'get ' + methodName ? original.name : methodName) });
                Object.defineProperty(newFunc, "length", { value: original.length || 0 });
                spoofedFunctions.set(newFunc, `function ${fakeName || (original.name && original.name !== 'get ' + methodName ? original.name : methodName)}() { [native code] }`);
                if (original) spoofedFunctions.set(original, `function ${fakeName || (original.name && original.name !== 'get ' + methodName ? original.name : methodName)}() { [native code] }`);
            }

            const descriptor = {
                configurable: true,
                enumerable: true,
                ...(isGetter ? { get: newFunc } : { value: newFunc, writable: true })
            };
            Object.defineProperty(obj, methodName, descriptor);
        } catch (e) {}
    };

    // === 1. DETERMINISTIC SEED (Injected by Torelium Launcher synchronously) ===
    const __TORE_SEED__ = 123456789;

    const getSeed = () => {
        if (isWorker) {
            const params = new URLSearchParams(self.location.search);
            const s = params.get('__t_seed');
            if (s) return parseInt(s, 10) >>> 0;
        }
        return __TORE_SEED__;
    };

    const seed = getSeed();
    console.log(`%c[TORELIUM] %cYeni Kimlik Aktif: %c${seed}`, "color: #00ff00; font-weight: bold", "color: #ffffff", "color: #00ffff; font-bold");

    function mulberry32(a) {
        return function() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }
    const rand = mulberry32(seed);

    // === 2. DYNAMIC IDENTITY GENERATOR ===
    const OS_POOLS = [
        { 
            os: 'Windows', platform: 'Win32', 
            uaBase: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{VER} Safari/537.36',
            fonts: ['Segoe UI', 'Segoe UI Emoji', 'Arial', 'Consolas', 'Verdana']
        },
        { 
            os: 'Apple', platform: 'MacIntel', 
            uaBase: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{VER} Safari/537.36',
            fonts: ['Helvetica Neue', 'Helvetica', 'Arial', 'SF Pro Text', 'Geneva']
        },
        { 
            os: 'Linux', platform: 'Linux x86_64', 
            uaBase: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{VER} Safari/537.36',
            fonts: ['Ubuntu', 'DejaVu Sans', 'Liberation Sans', 'Noto Sans']
        }
    ];

    const GPU_POOLS = {
        'Windows': [
            'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)'
        ],
        'Apple': [
            'ANGLE (Apple, Apple M1 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (Apple, Apple M2 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (Intel, Intel(R) Iris(R) Plus Graphics Direct3D11 vs_5_0 ps_5_0)'
        ],
        'Linux': [
            'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)'
        ]
    };

    const CHROME_VERSIONS = ['122.0.0.0', '124.0.0.0', '125.0.0.0'];
    const CORE_COUNTS = [4, 6, 8, 12, 16];
    const MEMORY_SIZES = [8, 16, 32];
    const RESOLUTIONS = [ [1366, 768], [1920, 1080], [2560, 1440] ];

    const osIdx = seed % OS_POOLS.length;
    const baseProfile = OS_POOLS[osIdx];
    const gpuPool = GPU_POOLS[baseProfile.os];
    const gpu = gpuPool[seed % gpuPool.length];
    const ver = CHROME_VERSIONS[seed % CHROME_VERSIONS.length];
    const res = RESOLUTIONS[seed % RESOLUTIONS.length];

    const profile = {
        name: `${baseProfile.os} / ${gpu.split(',')[1]?.trim().split(' ')[0] || 'Generic'} / Chrome ${ver.split('.')[0]}`,
        os: baseProfile.os,
        ua: baseProfile.uaBase.replace('{VER}', ver),
        platform: baseProfile.platform,
        gpu: gpu,
        vendor: `Google Inc. (${gpu.includes('NVIDIA') ? 'NVIDIA' : gpu.includes('Intel') ? 'Intel' : gpu.includes('Apple') ? 'Apple' : 'AMD'})`,
        cores: CORE_COUNTS[seed % CORE_COUNTS.length],
        mem: MEMORY_SIZES[seed % MEMORY_SIZES.length],
        res: res,
        fonts: baseProfile.fonts
    };

    const LOCATIONS = [
        { locale: 'en-US', zone: 'America/New_York', lang: ['en-US', 'en'] },
        { locale: 'en-GB', zone: 'Europe/London', lang: ['en-GB', 'en'] },
        { locale: 'de-DE', zone: 'Europe/Berlin', lang: ['de-DE', 'de', 'en'] },
        { locale: 'fr-FR', zone: 'Europe/Paris', lang: ['fr-FR', 'fr', 'en'] },
        { locale: 'ja-JP', zone: 'Asia/Tokyo', lang: ['ja-JP', 'ja', 'en'] },
        { locale: 'es-ES', zone: 'Europe/Madrid', lang: ['es-ES', 'es', 'en'] },
        { locale: 'it-IT', zone: 'Europe/Rome', lang: ['it-IT', 'it', 'en'] }
    ];
    const loc = LOCATIONS[seed % LOCATIONS.length];


    if (!isWorker && !isIframe) {
        console.log(`%c[Torelium Core] %cKimlik: %c${profile.name} (%c${seed}%c)`, 
            "color: #00ff00; font-weight: bold", "color: #ffffff", "color: #00ffff; font-weight: bold", "color: #ffaa00", "color: #ffffff");
    }

    // Stable Noise Engine
    const getNoise = (x, y, seedOffset = 0) => {
        const hash = mulberry32(seed + x + (y * 1000) + seedOffset)();
        return (hash - 0.5) * 0.000000001; // Tiny stable offset
    };


    // === 3. CORE SPOOFS (Navigator, Screen, Performance) ===
    if (!isWorker) {
        const navProto = Navigator.prototype;
        hookFunction(navProto, 'webdriver', () => false, 'get webdriver', true);

        // NavigatorUAData (Client Hints)
        if (window.NavigatorUAData) {
            const uaData = {
                brands: [
                    { brand: 'Google Chrome', version: ver.split('.')[0] },
                    { brand: 'Chromium', version: ver.split('.')[0] },
                    { brand: 'Not(A:Brand', version: '8' }
                ],
                mobile: false,
                platform: profile.os
            };
            hookFunction(navProto, 'userAgentData', () => uaData, 'get userAgentData', true);
        }

        const spoofs = { 
            userAgent: profile.ua, 
            languages: loc.lang, 
            language: loc.lang[0], 
            hardwareConcurrency: profile.cores, 
            deviceMemory: profile.mem, 
            platform: profile.platform,
            maxTouchPoints: profile.os === 'Apple' ? 5 : 0,
            pdfViewerEnabled: true,
            vendor: 'Google Inc.'
        };
        for (let [k, v] of Object.entries(spoofs)) hookFunction(navProto, k, () => v, `get ${k}`, true);

        // MediaDevices & Permissions
        if (navigator.mediaDevices) {
            hookFunction(navigator.mediaDevices, 'enumerateDevices', async () => {
                const devs = [
                    { deviceId: "", kind: "audioinput", label: "", groupId: "g1" },
                    { deviceId: "", kind: "videoinput", label: "", groupId: "g2" },
                    { deviceId: "", kind: "audiooutput", label: "", groupId: "g3" }
                ];
                return devs.map(d => Object.setPrototypeOf(d, MediaDeviceInfo.prototype));
            }, 'enumerateDevices');
        }

        if (window.Permissions) {
            const oQuery = Permissions.prototype.query;
            hookFunction(Permissions.prototype, 'query', async function(q) {
                const res = await oQuery.call(this, q);
                if (['notifications', 'push', 'geolocation'].includes(q.name)) {
                    return new Proxy(res, { get: (t, p) => p === 'state' ? 'prompt' : t[p] });
                }
                return res;
            }, 'query');
        }

        const scrProto = Screen.prototype;
        const [sw, sh] = profile.res;
        hookFunction(scrProto, 'width', () => sw, 'get width', true);
        hookFunction(scrProto, 'height', () => sh, 'get height', true);
        hookFunction(scrProto, 'availWidth', () => sw, 'get availWidth', true);
        hookFunction(scrProto, 'availHeight', () => sh - (seed % 2 ? 40 : 0), 'get availHeight', true);
        hookFunction(scrProto, 'colorDepth', () => 24, 'get colorDepth', true);
        hookFunction(scrProto, 'pixelDepth', () => 24, 'get pixelDepth', true);
    } else {
        hookFunction(self.Navigator.prototype, 'hardwareConcurrency', () => profile.cores, 'get hardwareConcurrency', true);
        hookFunction(self.Navigator.prototype, 'deviceMemory', () => profile.mem, 'get deviceMemory', true);
        hookFunction(self.Navigator.prototype, 'languages', () => loc.lang, 'get languages', true);
        hookFunction(self.Navigator.prototype, 'platform', () => profile.platform, 'get platform', true);
        hookFunction(self.Navigator.prototype, 'userAgent', () => profile.ua, 'get userAgent', true);
    }

    const originalNow = Performance.prototype.now;
    hookFunction(Performance.prototype, 'now', function() { return originalNow.apply(this, arguments) + 0.0001; }, 'now');

    // === 4. GRAPHICS (Canvas, OffscreenCanvas, WebGL) ===
    const applyCanvasNoise = (canvas, res) => {
        if (!res || !res.data) return;
        // Use a stable noise based on pixel coordinates and seed
        for (let i = 0; i < res.data.length; i += 4) {
            const x = (i / 4) % (canvas.width || 1);
            const y = Math.floor((i / 4) / (canvas.width || 1));
            // Add tiny deterministic noise to RGB channels
            res.data[i]     = Math.max(0, Math.min(255, res.data[i]     + (getNoise(x, y, 0) > 0 ? 1 : 0)));
            res.data[i + 1] = Math.max(0, Math.min(255, res.data[i + 1] + (getNoise(x, y, 1) > 0 ? 1 : 0)));
            res.data[i + 2] = Math.max(0, Math.min(255, res.data[i + 2] + (getNoise(x, y, 2) > 0 ? 1 : 0)));
        }
    };

    const canvasProtos = [{ p: CanvasRenderingContext2D.prototype, n: 'CanvasRenderingContext2D' }];
    if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') canvasProtos.push({ p: OffscreenCanvasRenderingContext2D.prototype, n: 'OffscreenCanvasRenderingContext2D' });
    
    for (let item of canvasProtos) {
        const proto = item.p;
        const oGID = proto.getImageData;
        hookFunction(proto, 'getImageData', function() { 
            const res = oGID.apply(this, arguments); 
            applyCanvasNoise(this.canvas, res); 
            return res; 
        }, 'getImageData');
        
        const oMT = proto.measureText;
        hookFunction(proto, 'measureText', function(text) { 
            const m = oMT.apply(this, arguments); 
            // Stable jitter based on text content and seed
            const textHash = Array.from(text).reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0);
            const jitter = (mulberry32(seed + textHash)() - 0.5) * 0.00001;
            const patched = {};
            for (let k in m) patched[k] = typeof m[k] === 'number' ? m[k] + jitter : m[k];
            return Object.setPrototypeOf(patched, TextMetrics.prototype);
        }, 'measureText');
    }

    const GL_PARAMS = { 
        37445: profile.vendor, 
        37446: profile.gpu, 
        3379: 16384, 
        3386: new Int32Array([32768, 32768]), 
        34024: 16384, 
        34076: 16384,
        35652: profile.os === 'Windows' ? 30 : 20, // SHADING_LANGUAGE_VERSION variations
        35724: profile.vendor
    };
    const glProtos = [WebGLRenderingContext.prototype];
    if (typeof WebGL2RenderingContext !== 'undefined') glProtos.push(WebGL2RenderingContext.prototype);
    for (let proto of glProtos) {
        const original = proto.getParameter;
        hookFunction(proto, 'getParameter', function(p) { return GL_PARAMS.hasOwnProperty(p) ? GL_PARAMS[p] : original.call(this, p); }, 'getParameter');
        
        const originalRP = proto.readPixels;
        hookFunction(proto, 'readPixels', function(x, y, w, h, format, type, pixels) {
            originalRP.apply(this, arguments);
            if (pixels && pixels instanceof Uint8Array) {
                for (let i = 0; i < pixels.length; i += 4) {
                    pixels[i] = Math.max(0, Math.min(255, pixels[i] + (getNoise(x + (i/4)%w, y + Math.floor((i/4)/w), 10) > 0 ? 1 : 0)));
                }
            }
        }, 'readPixels');
    }

    // === 5. SVG & FONT MEASUREMENTS ===
    if (typeof SVGElement !== 'undefined') {
        const oGBB = SVGElement.prototype.getBBox;
        hookFunction(SVGElement.prototype, 'getBBox', function() {
            const b = oGBB.apply(this, arguments);
            const text = this.textContent || '';
            const textHash = Array.from(text).reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0);
            const jitter = (mulberry32(seed + textHash + 101)() - 0.5) * 0.0001;
            return { x: b.x + jitter, y: b.y + jitter, width: b.width + jitter, height: b.height + jitter };
        }, 'getBBox');

        const oGCTL = SVGTextContentElement.prototype.getComputedTextLength;
        hookFunction(SVGTextContentElement.prototype, 'getComputedTextLength', function() {
            const l = oGCTL.apply(this, arguments);
            const text = this.textContent || '';
            const textHash = Array.from(text).reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0);
            const jitter = (mulberry32(seed + textHash + 102)() - 0.5) * 0.0001;
            return l + jitter;
        }, 'getComputedTextLength');
    }

    if (!isWorker) {
        const oGCS = window.getComputedStyle;
        window.getComputedStyle = function(el) {
            const style = oGCS.apply(this, arguments);
            if (el instanceof HTMLElement && (el.innerText.length < 10 || el.id.includes('font') || el.id.includes('emoji'))) {
                return new Proxy(style, {
                    get(target, prop) {
                        const val = target[prop];
                        if (typeof val === 'string' && (prop === 'width' || prop === 'height' || prop === 'inlineSize' || prop === 'blockSize')) {
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                                const jitter = (mulberry32(seed + num + 103)() - 0.5) * 0.05;
                                return (num + jitter).toFixed(3) + 'px';
                            }
                        }
                        if (typeof val === 'function') return val.bind(target);
                        return val;
                    }
                });
            }
            return style;
        };
        spoofedFunctions.set(window.getComputedStyle, 'function getComputedStyle() { [native code] }');
    }

    // === 6. AUDIO SEEDING ===
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

    // === 7. WORKER INTERCEPTION ===
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

    // === 8. STEALTH (Stack cleaning and consistency) ===
    const originalError = Error;
    hookFunction(Error, 'prepareStackTrace', (err, stacks) => stacks.filter(s => !s.getFileName()?.includes('chrome-extension://')).join('\n'), 'prepareStackTrace');

    // Intl Localization
    const targetTZ = loc.zone; const targetLocale = loc.locale;
    const wrapIntl = (Class, name) => {
        const Orig = Intl[Class];
        const NewClass = function(locale, options) {
            const usedLocale = locale || targetLocale;
            if (Class === 'DateTimeFormat') options = { ...options, timeZone: options?.timeZone || targetTZ };
            return new Orig(usedLocale, options);
        };
        NewClass.prototype = Orig.prototype;
        if (Orig.supportedLocalesOf) {
            NewClass.supportedLocalesOf = (l, o) => Orig.supportedLocalesOf(l || targetLocale, o);
        }
        Intl[Class] = NewClass;
        spoofedFunctions.set(Intl[Class], `function ${name}() { [native code] }`);
    };
    ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'PluralRules', 'Collator'].forEach(c => wrapIntl(c, c));

    hookFunction(Date.prototype, 'getTimezoneOffset', function getTimezoneOffset() {
        try {
            const date = this instanceof Date ? this : new Date();
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

    // === 11. MEMORY ===
    if (!isWorker && performance.memory) {
        const memoryLimit = profile.mem * 1024 * 1024 * 1024 / 2;
        const memoryUsed = memoryLimit * (0.1 + rand() * 0.2);
        const memObj = {
            jsHeapSizeLimit: memoryLimit,
            totalJSHeapSize: memoryUsed,
            usedJSHeapSize: memoryUsed * 0.8
        };
        hookFunction(Performance.prototype, 'memory', () => Object.setPrototypeOf(memObj, Object.getPrototypeOf(performance.memory)), 'get memory', true);
    }
    if (!isWorker && navigator.connection) {
        const conn = {
            downlink: 10,
            effectiveType: '4g',
            rtt: 50,
            saveData: false,
            onchange: null
        };
        hookFunction(Navigator.prototype, 'connection', () => Object.setPrototypeOf(conn, NetworkInformation.prototype), 'get connection', true);
    }

    // === 13. CSS RESISTANCE ===
    if (!isWorker && window.CSS && CSS.supports) {
        const oCS = CSS.supports;
        CSS.supports = function(feat) {
            if (feat && typeof feat === 'string' && feat.includes('font-family')) return true;
            return oCS.apply(this, arguments);
        };
        spoofedFunctions.set(CSS.supports, 'function supports() { [native code] }');
    }
})();

