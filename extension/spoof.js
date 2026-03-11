(() => {
    const isIframe = window.self !== window.top;
    console.log(`[STEALTH] Torelium Stealth Engine v7.5.3 Loading... (Context: ${isIframe ? 'Iframe' : 'Main Window'})`);
    
    // === TOSTRING() SPOOFING (Zero-Trace Native Binding) ===
    const originalToString = Function.prototype.toString;
    const spoofedFunctions = new WeakMap();

    function toString() {
        if (typeof this === 'function' && spoofedFunctions.has(this)) {
            return spoofedFunctions.get(this);
        }
        return originalToString.apply(this, arguments);
    }
    Object.defineProperty(toString, "name", { value: "toString" });
    Object.defineProperty(toString, "length", { value: 0 });
    Object.setPrototypeOf(toString, Function.prototype); 
    
    spoofedFunctions.set(toString, 'function toString() { [native code] }');
    Function.prototype.toString = toString;

    const hookFunction = (obj, methodName, newFunc, fakeName, isGetter = false) => {
        try {
            const originalAttr = Object.getOwnPropertyDescriptor(obj, methodName);
            const original = isGetter ? (originalAttr ? originalAttr.get : undefined) : obj[methodName];
            
            if (original) {
                Object.setPrototypeOf(newFunc, Object.getPrototypeOf(original));
                Object.defineProperty(newFunc, "name", { value: fakeName || original.name || methodName });
                Object.defineProperty(newFunc, "length", { value: original.length || 0 });
            }
            
            if (isGetter) {
                Object.defineProperty(obj, methodName, {
                    get: newFunc,
                    configurable: true,
                    enumerable: true
                });
                spoofedFunctions.set(newFunc, `function ${fakeName}() { [native code] }`);
            } else {
                obj[methodName] = newFunc;
                spoofedFunctions.set(newFunc, `function ${fakeName || methodName}() { [native code] }`);
                if (original) spoofedFunctions.set(original, `function ${fakeName || methodName}() { [native code] }`);
            }
        } catch (e) {}
    };

    // === 1. HARDWARE PROFILE ===
    const hwProfile = {cores: 8, memory: 8, gpu: 'NVIDIA GeForce RTX 3060', vendor: 'NVIDIA Corporation', screenW: 1920, screenH: 1080};

    // === 2. NAVIGATOR & BOT BYPASS ===
    const navProto = Navigator.prototype;
    hookFunction(navProto, 'webdriver', function webdriver() { return false; }, 'get webdriver', true);

    const spoofValues = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.116 Safari/537.36',
        languages: ['en-US', 'en'],
        hardwareConcurrency: hwProfile.cores,
        deviceMemory: hwProfile.memory,
        platform: 'Win32',
        vendor: 'Google Inc.',
        maxTouchPoints: 0
    };
    
    for (const [key, value] of Object.entries(spoofValues)) {
        hookFunction(navProto, key, function() { return value; }, `get ${key}`, true);
    }

    // === 3. SCREEN CONSISTENCY ===
    const screenProto = Screen.prototype;
    hookFunction(screenProto, 'width', function width() { return hwProfile.screenW; }, 'get width', true);
    hookFunction(screenProto, 'height', function height() { return hwProfile.screenH; }, 'get height', true);
    hookFunction(screenProto, 'availWidth', function availWidth() { return hwProfile.screenW; }, 'get availWidth', true);
    hookFunction(screenProto, 'availHeight', function availHeight() { return hwProfile.screenH - 40; }, 'get availHeight', true);

    // === 4. CANVAS STABLE BYPASS ===
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    hookFunction(CanvasRenderingContext2D.prototype, 'getImageData', function getImageData() {
        const res = originalGetImageData.apply(this, arguments);
        if (res && res.data && res.data.length > 4) {
            res.data[res.data.length - 1] = res.data[res.data.length - 1] ^ 1;
        }
        return res;
    }, 'getImageData');

    const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
    hookFunction(CanvasRenderingContext2D.prototype, 'measureText', function measureText() {
        const measurement = originalMeasureText.apply(this, arguments);
        const offset = 0.0000000000001;
        return { 
            width: measurement.width + offset,
            actualBoundingBoxAscent: measurement.actualBoundingBoxAscent,
            actualBoundingBoxDescent: measurement.actualBoundingBoxDescent,
            actualBoundingBoxLeft: measurement.actualBoundingBoxLeft,
            actualBoundingBoxRight: measurement.actualBoundingBoxRight,
            fontBoundingBoxAscent: measurement.fontBoundingBoxAscent,
            fontBoundingBoxDescent: measurement.fontBoundingBoxDescent
        };
    }, 'measureText');

    // === 5. WEBGL CONSISTENCY ===
    const webglParameters = {
        37445: hwProfile.vendor, 
        37446: hwProfile.gpu     
    };
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    hookFunction(WebGLRenderingContext.prototype, 'getParameter', function getParameter(param) {
        return webglParameters.hasOwnProperty(param) ? webglParameters[param] : originalGetParameter.call(this, param);
    }, 'getParameter');
    if (window.WebGL2RenderingContext) {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        hookFunction(WebGL2RenderingContext.prototype, 'getParameter', function getParameter(param) {
            return webglParameters.hasOwnProperty(param) ? webglParameters[param] : originalGetParameter2.call(this, param);
        }, 'getParameter');
    }

    // === 6. AUDIO STABLE BYPASS ===
    if (window.AudioContext || window.webkitAudioContext) {
        const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
        const originalCreateAnalyser = OriginalAudioContext.prototype.createAnalyser;
        hookFunction(OriginalAudioContext.prototype, 'createAnalyser', function createAnalyser() {
            const analyser = originalCreateAnalyser.call(this);
            const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
            hookFunction(analyser, 'getFloatFrequencyData', function getFloatFrequencyData(array) {
                originalGetFloatFrequencyData.call(this, array);
                if (array.length > 0) array[0] += 0.0000001;
            }, 'getFloatFrequencyData');
            return analyser;
        }, 'createAnalyser');
    }

    // === 7. PERFORMANCE STEALTH ===
    const originalNow = Performance.prototype.now;
    hookFunction(Performance.prototype, 'now', function now() {
        return originalNow.call(this) + 0.0001;
    }, 'now');

    // === 8. WEBRTC MASKING ===
    if (window.RTCPeerConnection) {
        const OrigRTC = window.RTCPeerConnection;
        window.RTCPeerConnection = function RTCPeerConnection(config = {}) {
            config.iceServers = [];
            return new OrigRTC(config);
        };
        Object.setPrototypeOf(window.RTCPeerConnection, OrigRTC);
        window.RTCPeerConnection.prototype = OrigRTC.prototype;
        Object.defineProperty(window.RTCPeerConnection, "name", { value: "RTCPeerConnection" });
        Object.defineProperty(window.RTCPeerConnection, "length", { value: 0 });
        spoofedFunctions.set(window.RTCPeerConnection, "function RTCPeerConnection() { [native code] }");
    }

    // === 9. TIMEZONE & LOCALE (Manual Fallback for CDP) ===
    const targetTZ = 'America/New_York';
    const targetLocale = 'en-US';

    try {
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locale, options) {
            const finalLocale = locale || targetLocale;
            const finalOptions = options || {};
            if (!finalOptions.timeZone) finalOptions.timeZone = targetTZ;
            return new originalDateTimeFormat(finalLocale, finalOptions);
        };
        Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
        Object.defineProperty(Intl.DateTimeFormat, 'name', { value: 'DateTimeFormat' });
        spoofedFunctions.set(Intl.DateTimeFormat, "function DateTimeFormat() { [native code] }");

        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        hookFunction(Date.prototype, 'getTimezoneOffset', function getTimezoneOffset() {
            // New York is usually -240 (EDT) or -300 (EST)
            // We'll mimic -240 (4 hours behind UTC)
            return 240; 
        }, 'getTimezoneOffset');
    } catch (e) {}

    if (!isIframe) {
        console.log(`[STEALTH] Profile: ${hwProfile.cores}C/${hwProfile.memory}GB/${hwProfile.gpu} | TZ: ${targetTZ}`);
    }
})();
