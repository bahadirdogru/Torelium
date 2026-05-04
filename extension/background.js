// ===== WEBRTC LOCK =====
chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' });

// ===== PROXY: loopback DIRECT, rest through Tor SOCKS5 =====
chrome.proxy.settings.set({
    value: {
        mode: "pac_script",
        pacScript: {
            data: `function FindProxyForURL(url, host) {
                if (host === "127.0.0.1" || host === "localhost" || isInNet(host, "127.0.0.0", "255.0.0.0")) {
                    return "DIRECT";
                }
                return "SOCKS5 127.0.0.1:9050";
            }`
        }
    },
    scope: 'regular'
});

// ===== TIMEZONE / LOCALE via CDP =====
let activeTZ = "America/New_York";
let activeLOCALE = "en-US";

async function alignNetworkAndCDP() {
    try {
        const text = await (await fetch(chrome.runtime.getURL('spoof.js'))).text();
        const match = text.match(/const __TORE_SEED__\s*=\s*(\d+)/);
        const seed = match ? parseInt(match[1], 10) : 123456789;

        const OS_POOLS = [
            { os: 'Windows', platform: 'Win32', uaBase: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{VER} Safari/537.36' },
            { os: 'Apple', platform: 'MacIntel', uaBase: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{VER} Safari/537.36' },
            { os: 'Linux', platform: 'Linux x86_64', uaBase: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{VER} Safari/537.36' }
        ];
        const CHROME_VERSIONS = ['122.0.0.0', '124.0.0.0', '125.0.0.0'];
        const LOCATIONS = [
            { locale: 'en-US', zone: 'America/New_York', lang: ['en-US', 'en'] },
            { locale: 'en-GB', zone: 'Europe/London', lang: ['en-GB', 'en'] },
            { locale: 'de-DE', zone: 'Europe/Berlin', lang: ['de-DE', 'de', 'en'] },
            { locale: 'fr-FR', zone: 'Europe/Paris', lang: ['fr-FR', 'fr', 'en'] },
            { locale: 'ja-JP', zone: 'Asia/Tokyo', lang: ['ja-JP', 'ja', 'en'] },
            { locale: 'es-ES', zone: 'Europe/Madrid', lang: ['es-ES', 'es', 'en'] },
            { locale: 'it-IT', zone: 'Europe/Rome', lang: ['it-IT', 'it', 'en'] }
        ];

        const baseProfile = OS_POOLS[seed % OS_POOLS.length];
        const ver = CHROME_VERSIONS[seed % CHROME_VERSIONS.length];
        const loc = LOCATIONS[seed % LOCATIONS.length];
        const ua = baseProfile.uaBase.replace('{VER}', ver);

        activeTZ = loc.zone;
        activeLOCALE = loc.locale;

        const acceptLang = loc.lang.join(',') + ';q=0.9';
        
        let secPlatform = `"${baseProfile.os}"`;
        if (baseProfile.os === 'Apple') secPlatform = `"macOS"`;
        const secChUa = `\"Chromium\";v=\"${ver.split('.')[0]}\", \"Google Chrome\";v=\"${ver.split('.')[0]}\", \"Not-A.Brand\";v=\"99\"`;

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1],
            addRules: [{
                id: 1,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                        { header: "User-Agent", operation: "set", value: ua },
                        { header: "Accept-Language", operation: "set", value: acceptLang },
                        { header: "sec-ch-ua", operation: "set", value: secChUa },
                        { header: "sec-ch-ua-mobile", operation: "set", value: "?0" },
                        { header: "sec-ch-ua-platform", operation: "set", value: secPlatform }
                    ]
                },
                condition: { 
                    resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "ping", "script", "image", "font", "other", "stylesheet", "websocket"]
                }
            }]
        });
    } catch(e) {}
}

alignNetworkAndCDP();

function spoofTarget(targetArg) {
    chrome.debugger.attach(targetArg, "1.3", () => {
        if (chrome.runtime.lastError) {
            if (!chrome.runtime.lastError.message.includes("already attached")) return;
        }
        chrome.debugger.sendCommand(targetArg, "Emulation.setTimezoneOverride", { timezoneId: activeTZ }, () => {
            chrome.debugger.sendCommand(targetArg, "Emulation.setLocaleOverride", { locale: activeLOCALE }, () => {});
        });
    });
}

setInterval(() => {
    chrome.debugger.getTargets((targets) => {
        for (let t of targets) {
            if ((t.type === "page" || t.type === "background_page") && !t.attached) {
                const url = t.url || "";
                const isSystem = url.startsWith("chrome://") || url.startsWith("helium://") || url.startsWith("devtools://");

                if (!isSystem) {
                    let targetArg = t.tabId ? { tabId: t.tabId } : { targetId: t.id };
                    spoofTarget(targetArg);
                }
            }
        }
    });
}, 500);

// ===== SESSION COUNTER =====
let newnymCount = 0;
let hwChangeCount = 0;
let latestCreepSummary = null;

// ===== CREEPJS DEEP SCRAPER STATE =====
const CREEP_TEST_URLS = [
    "https://abrahamjuliot.github.io/creepjs/",
    "https://abrahamjuliot.github.io/creepjs/tests/workers.html",
    "https://abrahamjuliot.github.io/creepjs/tests/iframes.html",
    "https://abrahamjuliot.github.io/creepjs/tests/fonts.html",
    "https://abrahamjuliot.github.io/creepjs/tests/timezone.html",
    "https://abrahamjuliot.github.io/creepjs/tests/window.html",
    "https://abrahamjuliot.github.io/creepjs/tests/screen.html",
    "https://abrahamjuliot.github.io/creepjs/tests/prototype.html",
    "https://abrahamjuliot.github.io/creepjs/tests/domrect.html",
    "https://abrahamjuliot.github.io/creepjs/tests/emojis.html",
    "https://abrahamjuliot.github.io/creepjs/tests/math.html",
    "https://abrahamjuliot.github.io/creepjs/tests/machine.html",
    "https://abrahamjuliot.github.io/creepjs/tests/extensions.html",
    "https://abrahamjuliot.github.io/creepjs/tests/proxy.html"
];

let deepScrapeState = {
    active: false,
    tabId: null,
    currentIndex: 0,
    results: {}
};


// ===== TOR BRIDGE (PowerShell Listener) =====
const BRIDGE_URL = "http://127.0.0.1:9060";
let BRIDGE_TOKEN = null;

const tokenReady = (async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
        try {
            const resp = await fetch(chrome.runtime.getURL('bridge_config.json'));
            const config = await resp.json();
            if (config.token) {
                BRIDGE_TOKEN = config.token;
                return;
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 500));
    }
})();

async function torBridgeRequest(command, params = {}) {
    await tokenReady;
    try {
        const url = new URL(`${BRIDGE_URL}/${command}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const headers = {};
        if (BRIDGE_TOKEN) headers['X-Bridge-Token'] = BRIDGE_TOKEN;
        const resp = await fetch(url, { cache: 'no-store', headers });
        const text = await resp.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            return { success: false, error: 'bridge_bad_response', status: resp.status };
        }
        if (!resp.ok && data.success !== false) {
            data.success = false;
            if (!data.error) data.error = 'http_' + resp.status;
        }
        return data;
    } catch (e) {
        return { success: false, error: 'bridge_down', fetchError: e && e.name };
    }
}

// ===== TOR NEWNYM =====
async function sendNewnym() {
    return await torBridgeRequest('newnym');
}

// ===== COUNTRY CODE via Tor GeoIP =====
async function getCountryForIP(ip) {
    const res = await torBridgeRequest('country', { ip });
    return res.success ? res.country : null;
}

function countryToFlag(code) {
    if (!code || code.length !== 2) return '🌐';
    return [...code.toUpperCase()].map(c =>
        String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65)
    ).join('');
}

// ===== TOR EXIT IP (via Tor proxy) =====
async function getTorExitIP() {
    try {
        const fetchPromise = fetch('https://check.torproject.org/api/ip', { cache: 'no-store' });
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 15000));
        const resp = await Promise.race([fetchPromise, timeoutPromise]);
        if (!resp) return { ip: null, isTor: false, error: 'timeout' };
        const data = await resp.json();
        return { ip: data.IP || null, isTor: data.IsTor || false };
    } catch (e) {
        return { ip: null, isTor: false, error: 'fetch_failed' };
    }
}

// INIT REMOVED

// ===== MESSAGE LISTENER =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;

    if (request.action === "getCircuitInfo") {
        (async () => {
            try {
                const ipInfo = await getTorExitIP();
                let country = null;
                let flag = '🌐';
                if (ipInfo && ipInfo.ip) {
                    country = await getCountryForIP(ipInfo.ip);
                    flag = countryToFlag(country);
                }
                sendResponse({
                    ip:      ipInfo ? ipInfo.ip : null,
                    isTor:   ipInfo ? ipInfo.isTor : false,
                    error:   ipInfo ? ipInfo.error : 'unknown',
                    country,
                    flag,
                    fpId:    latestCreepSummary ? latestCreepSummary.fpId : null,
                    count:   newnymCount,
                    hwCount: hwChangeCount
                });
            } catch (err) {
                sendResponse({ ip: null, isTor: false, error: 'critical' });
            }
        })();
        return true;
    }

    if (request.action === "newnym") {
        sendNewnym().then(result => {
            if (result && result.success) {
                newnymCount++;
                result.count = newnymCount;
                sendResponse({ success: true, message: "✅ Yeni Tor devresi oluşturuldu.", count: newnymCount });
            } else {
                let msg;
                if (result.error === 'bridge_down') {
                    msg = "Hata: Bridge'e ulaşılamıyor (127.0.0.1:9060). Torelium'u .ps1 ile açın.";
                } else if (result.message) {
                    msg = "❌ " + result.message;
                } else {
                    msg = "Yeni kimlik alınamadı.";
                }
                sendResponse({ success: false, message: msg });
            }
        }).catch(() => {
            sendResponse({ success: false, message: "Sistem hatası oluştu." });
        });
        return true;
    }

    if (request.action === "newHardwareIdentity") {
        hwChangeCount++;
        const newSeed = Math.floor(Math.random() * 2147483647);
        torBridgeRequest('newseed', { seed: newSeed }).then(() => {
            chrome.tabs.query({}, (tabs) => {
                for (let tab of tabs) {
                    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                        try {
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                world: 'MAIN',
                                func: () => {
                                    try {
                                        sessionStorage.clear();
                                        localStorage.clear();
                                        if (window.indexedDB && window.indexedDB.databases) {
                                            window.indexedDB.databases().then(dbs => dbs.forEach(db => window.indexedDB.deleteDatabase(db.name)));
                                        }
                                    } catch (e) {}
                                }
                            }).finally(() => { chrome.tabs.reload(tab.id, { bypassCache: true }); });
                        } catch(e) {
                            chrome.tabs.reload(tab.id, { bypassCache: true });
                        }
                    }
                }
                setTimeout(() => { chrome.runtime.reload(); }, 200);
            });
            sendResponse({ success: true, message: "✅ Yeni donanım kimliği uygulandı.", count: hwChangeCount });
        });
        return true;
    }

    if (request.action === "getCreepSummary") {
        sendResponse(latestCreepSummary);
        return false;
    }

    if (request.action === "updateCreepSummary") {
        latestCreepSummary = request.data;
        return false;
    }

    if (request.action === "startDeepScrape") {
        deepScrapeState.active = true;
        deepScrapeState.currentIndex = 0;
        deepScrapeState.results = {};
        
        chrome.tabs.create({ url: CREEP_TEST_URLS[0], active: false }, (tab) => {
            deepScrapeState.tabId = tab.id;
            sendResponse({ success: true, tabId: tab.id });
        });
        return true; 
    }

    if (request.action === "creepScraped") {
        if (deepScrapeState.active && sender.tab && sender.tab.id === deepScrapeState.tabId) {
            const data = request.data;
            deepScrapeState.results[data.path] = data;
            
            // Broadcast progress to checklist.js
            chrome.runtime.sendMessage({ 
                action: "deepScrapeProgress", 
                path: data.path, 
                index: deepScrapeState.currentIndex,
                total: CREEP_TEST_URLS.length
            });

            deepScrapeState.currentIndex++;
            if (deepScrapeState.currentIndex < CREEP_TEST_URLS.length) {
                chrome.tabs.update(deepScrapeState.tabId, { url: CREEP_TEST_URLS[deepScrapeState.currentIndex] });
            } else {
                deepScrapeState.active = false;
                chrome.runtime.sendMessage({ action: "deepScrapeComplete", results: deepScrapeState.results });
                
                setTimeout(() => {
                    if (deepScrapeState.tabId) {
                        chrome.tabs.remove(deepScrapeState.tabId).catch(() => {});
                        deepScrapeState.tabId = null;
                    }
                }, 2000);
            }
        }
        return false;
    }

    if (request.action === "getDeepScrapeResults") {
        sendResponse(deepScrapeState.results);
        return false;
    }

    if (request.action === "openChecklist") {
        chrome.tabs.create({ url: chrome.runtime.getURL("checklist.html") });
        sendResponse({ ok: true });
    }
});
