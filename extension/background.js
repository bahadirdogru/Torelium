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
const TZ = "America/New_York";
const LOCALE = "en-US";

function spoofTarget(targetArg) {
    chrome.debugger.attach(targetArg, "1.3", () => {
        if (chrome.runtime.lastError) {
            if (!chrome.runtime.lastError.message.includes("already attached")) return;
        }
        chrome.debugger.sendCommand(targetArg, "Emulation.setTimezoneOverride", { timezoneId: TZ }, () => {
            chrome.debugger.sendCommand(targetArg, "Emulation.setLocaleOverride", { locale: LOCALE }, () => {});
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

// ===== SESSION SEED INITIALIZATION =====
async function initSeed() {
    const res = await chrome.storage.local.get('hw_seed');
    if (!res.hw_seed) {
        const newSeed = Math.floor(Math.random() * 2147483647);
        await chrome.storage.local.set({ hw_seed: newSeed });
    }
}
initSeed();

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
        chrome.storage.local.set({ hw_seed: newSeed }).then(() => {
            chrome.tabs.query({}, (tabs) => {
                for (let tab of tabs) {
                    if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('about:')) {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            world: 'MAIN',
                            func: (s) => {
                                try {
                                    sessionStorage.setItem('__t_seed', s);
                                    localStorage.clear();
                                    if (window.indexedDB && window.indexedDB.databases) {
                                        window.indexedDB.databases().then(dbs => dbs.forEach(db => window.indexedDB.deleteDatabase(db.name)));
                                    }
                                } catch (e) {}
                            },
                            args: [newSeed]
                        }).finally(() => { 
                            chrome.tabs.reload(tab.id, { bypassCache: true }); 
                        });
                    }
                }
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
