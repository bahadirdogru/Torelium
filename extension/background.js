// ===== WEBRTC LOCK =====
chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' });
console.log("[STEALTH] WebRTC tightly locked via privacy API.");

// ===== TIMEZONE / LOCALE via CDP =====
const TZ = "America/New_York";
const LOCALE = "en-US";

function spoofTarget(targetArg) {
    chrome.debugger.attach(targetArg, "1.3", () => {
        if (chrome.runtime.lastError) {
            // If already attached, we just send commands
            if (!chrome.runtime.lastError.message.includes("already attached")) return;
        }
        chrome.debugger.sendCommand(targetArg, "Emulation.setTimezoneOverride", { timezoneId: TZ }, () => {
            chrome.debugger.sendCommand(targetArg, "Emulation.setLocaleOverride", { locale: LOCALE }, () => {
                // Signal to the page that CDP is active
                chrome.debugger.sendCommand(targetArg, "Runtime.evaluate", { 
                    expression: "window.to_cdp_active = true; console.log('[TORELIUM] CDP Core Attached');" 
                });
            });
        });
    });
}

setInterval(() => {
    chrome.debugger.getTargets((targets) => {
        for (let t of targets) {
            // We want to spoof regular pages and our own extension pages
            // But we avoid system pages like 'devtools', 'helium', or internal 'chrome://' settings
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
let latestCreepSummary = null;

// ===== TOR BRIDGE (PowerShell Listener) =====
const BRIDGE_URL = "http://127.0.0.1:9060";

async function torBridgeRequest(command, params = {}) {
    try {
        const url = new URL(`${BRIDGE_URL}/${command}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const resp = await fetch(url, { cache: 'no-store' });
        return await resp.json();
    } catch (e) {
        console.error(`[BRIDGE] Request failed: ${command}`, e);
        return { success: false, error: 'bridge_down' };
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

// Country code → flag emoji (Internal helper, kept)
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
        console.error("[STEALTH] IP Fetch Error:", e);
        return { ip: null, isTor: false, error: e.message };
    }
}

// ===== MESSAGE LISTENER =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

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
                    count:   newnymCount
                });
            } catch (err) {
                console.error("Critical error in getCircuitInfo:", err);
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
                sendResponse({ success: false, message: result.error === 'bridge_down' ? "Hata: Torelium Bridge aktif değil. Lütfen .ps1 scriptini kontrol edin." : "Yeni kimlik alınamadı." });
            }
        }).catch(e => {
            sendResponse({ success: false, message: "Sistem Hatası: " + e.message });
        });
        return true;
    }

    if (request.action === "getCreepSummary") {
        sendResponse(latestCreepSummary);
        return false;
    }

    if (request.action === "updateCreepSummary") {
        latestCreepSummary = request.data;
        console.log("[TORELIUM] Scraped new CreepJS Summary:", latestCreepSummary.fpId);
        return false;
    }

    if (request.action === "openChecklist") {
        chrome.tabs.create({ url: chrome.runtime.getURL("checklist.html") });
        sendResponse({ ok: true });
    }
});
