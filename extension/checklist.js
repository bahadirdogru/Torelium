// ============================================================
// Torelium · Gizlilik Kontrol Paneli - checklist.js
// Bu sayfa chrome-extension:// context'inde çalışır.
// spoof.js bu sayfada aktif DEĞİLDİR → gerçek tarayıcı
// değerleri okunur ve beklenen (spoofed) değerlerle karşılaştırılır.
// ============================================================

// Beklenen (spoofed) değerler — spoof.js ile senkronize tutulmalı
const EXPECTED = {
    webdriver: false,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    platform: 'Win32',
    vendor: 'Google Inc.',
    maxTouchPoints: 0,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.116 Safari/537.36',
    languages: ['en-US', 'en'],
    screenW: 1920,
    screenH: 1080,
    timezone: 'America/New_York',
    webgl_vendor: 'NVIDIA Corporation',
    webgl_renderer: 'NVIDIA GeForce RTX 3060',
};

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}
function trunc(val, n = 50) {
    const s = String(val);
    return s.length > n ? s.slice(0, n) + '…' : s;
}

// ---- Individual checks ----
function checks() {
    const results = [];

    // 1. WebDriver
    results.push({
        icon: '🤖', title: 'WebDriver Tespiti',
        category: 'Bot Koruması',
        status: navigator.webdriver === false ? 'pass' : 'fail',
        rows: [
            { label: 'Gerçek Değer', value: String(navigator.webdriver), good: navigator.webdriver === false },
            { label: 'Beklenen',     value: 'false', neutral: true },
        ]
    });

    // 2. Platform
    results.push({
        icon: '💻', title: 'Platform',
        category: 'Navigator Spoofing',
        status: navigator.platform === EXPECTED.platform ? 'pass' : 'fail',
        rows: [
            { label: 'Gerçek Değer', value: navigator.platform, good: navigator.platform === EXPECTED.platform },
            { label: 'Beklenen',     value: EXPECTED.platform, neutral: true },
        ]
    });

    // 3. User-Agent
    const uaMatch = navigator.userAgent === EXPECTED.userAgent;
    results.push({
        icon: '🌐', title: 'User-Agent',
        category: 'Navigator Spoofing',
        status: uaMatch ? 'pass' : 'warn',
        rows: [
            { label: 'Gerçek Değer', value: trunc(navigator.userAgent, 55), good: uaMatch },
            { label: 'Beklenen',     value: trunc(EXPECTED.userAgent, 55), neutral: true },
        ]
    });

    // 4. Hardware Concurrency
    const coresOk = navigator.hardwareConcurrency === EXPECTED.hardwareConcurrency;
    results.push({
        icon: '⚙️', title: 'CPU Çekirdek Sayısı',
        category: 'Donanım Profili',
        status: coresOk ? 'pass' : 'fail',
        rows: [
            { label: 'Gerçek Değer', value: String(navigator.hardwareConcurrency), good: coresOk },
            { label: 'Beklenen',     value: String(EXPECTED.hardwareConcurrency), neutral: true },
        ]
    });

    // 5. Device Memory
    const memOk = navigator.deviceMemory === EXPECTED.deviceMemory;
    results.push({
        icon: '🧠', title: 'Bellek (deviceMemory)',
        category: 'Donanım Profili',
        status: memOk ? 'pass' : 'fail',
        rows: [
            { label: 'Gerçek Değer', value: String(navigator.deviceMemory), good: memOk },
            { label: 'Beklenen',     value: String(EXPECTED.deviceMemory), neutral: true },
        ]
    });

    // 6. Languages
    const langOk = JSON.stringify([...navigator.languages]) === JSON.stringify(EXPECTED.languages);
    results.push({
        icon: '🌍', title: 'Dil (languages)',
        category: 'Lokalizasyon',
        status: langOk ? 'pass' : 'fail',
        rows: [
            { label: 'Gerçek Değer', value: [...navigator.languages].join(', '), good: langOk },
            { label: 'Beklenen',     value: EXPECTED.languages.join(', '), neutral: true },
        ]
    });

    // 7. Vendor
    const vendorOk = navigator.vendor === EXPECTED.vendor;
    results.push({
        icon: '🏷️', title: 'Navigator Vendor',
        category: 'Navigator Spoofing',
        status: vendorOk ? 'pass' : 'fail',
        rows: [
            { label: 'Gerçek Değer', value: navigator.vendor, good: vendorOk },
            { label: 'Beklenen',     value: EXPECTED.vendor, neutral: true },
        ]
    });

    // 8. maxTouchPoints
    const touchOk = navigator.maxTouchPoints === EXPECTED.maxTouchPoints;
    results.push({
        icon: '👆', title: 'Touch Points',
        category: 'Donanım Profili',
        status: touchOk ? 'pass' : 'warn',
        rows: [
            { label: 'Gerçek Değer', value: String(navigator.maxTouchPoints), good: touchOk },
            { label: 'Beklenen',     value: String(EXPECTED.maxTouchPoints), neutral: true },
        ]
    });

    // 9. Screen
    const swOk = screen.width === EXPECTED.screenW;
    const shOk = screen.height === EXPECTED.screenH;
    results.push({
        icon: '🖥️', title: 'Ekran Çözünürlüğü',
        category: 'Donanım Profili',
        status: (swOk && shOk) ? 'pass' : 'fail',
        rows: [
            { label: 'Gerçek Değer', value: `${screen.width}×${screen.height}`, good: swOk && shOk },
            { label: 'Beklenen',     value: `${EXPECTED.screenW}×${EXPECTED.screenH}`, neutral: true },
            { label: 'availWidth',   value: `${screen.availWidth}×${screen.availHeight}`, good: true },
        ]
    });

    // 10. Timezone
    let tz = 'Bilinmiyor';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(_) {}
    const tzOk = tz === EXPECTED.timezone;

    results.push({
        icon: '🕐', title: 'Timezone',
        category: 'Lokalizasyon',
        status: tzOk ? 'pass' : 'warn',
        rows: [
            { label: 'Gerçek Değer', value: tz, good: tzOk },
            { label: 'Beklenen',     value: EXPECTED.timezone, neutral: true },
            { label: 'CDP Durumu',   value: tzOk ? '✅ Aktif' : '⚠️ Bekleniyor (Sayfayı yenileyin)', bad: !tzOk, good: tzOk }
        ]
    });

    // 11. WebGL
    let wglVendor = 'N/A', wglRenderer = 'N/A';
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
                wglVendor   = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
                wglRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch(_) {}
    const wglVOk = wglVendor === EXPECTED.webgl_vendor;
    const wglROk = wglRenderer === EXPECTED.webgl_renderer;
    results.push({
        icon: '🎮', title: 'WebGL GPU',
        category: 'Donanım Profili',
        status: (wglVOk && wglROk) ? 'pass' : wglVendor === 'N/A' ? 'warn' : 'fail',
        rows: [
            { label: 'Vendor',    value: trunc(wglVendor, 40),   good: wglVOk },
            { label: 'Renderer',  value: trunc(wglRenderer, 40), good: wglROk },
            { label: 'Beklenen',  value: EXPECTED.webgl_renderer, neutral: true },
        ]
    });

    // 12. Canvas Noise
    let canvasNoisy = false;
    try {
        const c1 = document.createElement('canvas');
        c1.width = 200; c1.height = 50;
        const ctx1 = c1.getContext('2d');
        ctx1.fillStyle = '#ff0000';
        ctx1.fillRect(0, 0, 200, 50);
        ctx1.fillStyle = '#00ff00';
        ctx1.fillText('Torelium Test 🛡️', 10, 30);
        const d1 = ctx1.getImageData(0, 0, 200, 50).data;

        const c2 = document.createElement('canvas');
        c2.width = 200; c2.height = 50;
        const ctx2 = c2.getContext('2d');
        ctx2.fillStyle = '#ff0000';
        ctx2.fillRect(0, 0, 200, 50);
        ctx2.fillStyle = '#00ff00';
        ctx2.fillText('Torelium Test 🛡️', 10, 30);
        const d2 = ctx2.getImageData(0, 0, 200, 50).data;

        // Eğer noise ekleniyorsa her çağrı farklı sonuç verir
        // Bu sayfada spoof.js çalışmıyor, bu yüzden tutarlı → farklı render ararız
        // Tutarlıysa "spoof.js bu sayfada çalışmıyor" uyarısı göster
        canvasNoisy = (d1[d1.length - 1] !== d2[d2.length - 1]);
    } catch(_) {}

    results.push({
        icon: '🎨', title: 'Canvas Gürültüsü',
        category: 'Canvas/WebGL',
        status: 'warn',
        rows: [
            { label: 'Durum', value: 'spoof.js extension sayfasında çalışmaz', warn: true },
            { label: 'Not', value: 'Gerçek sayfalarda aktif (document_start)', neutral: true },
        ]
    });

    // 13. WebRTC
    let rtcOk = false;
    try {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        rtcOk = pc.getConfiguration().iceServers.length === 0 ||
                JSON.stringify(pc.getConfiguration().iceServers) === '[]';
        pc.close();
    } catch(_) {
        rtcOk = true; // hata = kilitli
    }
    results.push({
        icon: '📡', title: 'WebRTC IP Sızıntısı',
        category: 'Ağ Güvenliği',
        status: rtcOk ? 'pass' : 'fail',
        rows: [
            { label: 'ICE Servers', value: rtcOk ? 'Boş / Kilitli ✅' : 'Açık ❌', good: rtcOk },
            { label: 'Privacy API', value: 'disable_non_proxied_udp', neutral: true },
        ]
    });

    // 14. toString Proxy
    let toStringNative = false;
    try {
        const s = Function.prototype.toString.toString();
        toStringNative = s.includes('[native code]');
    } catch(_) {}
    results.push({
        icon: '🔗', title: 'toString() Native Maskeleme',
        category: 'Bot Koruması',
        status: toStringNative ? 'pass' : 'fail',
        rows: [
            { label: 'toString sonucu', value: toStringNative ? 'native code ✅' : 'Proxy ifşa ❌', good: toStringNative },
        ]
    });

    // 15. Audio
    results.push({
        icon: '🔊', title: 'AudioContext Gürültüsü',
        category: 'API Spoofing',
        status: 'warn',
        rows: [
            { label: 'Durum', value: 'Gerçek sayfalarda aktif (document_start)', neutral: true },
            { label: 'Not', value: 'Bu sayfada spoof.js çalışmaz', warn: true },
        ]
    });

    return results;
}

// ---- Render ----
function statusLabel(s) {
    if (s === 'pass') return '✅ PASS';
    if (s === 'fail') return '❌ FAIL';
    return '⚠️ WARN';
}

function renderCard(item) {
    const valueClass = (r) => r.good ? 'good' : r.warn ? 'warn' : r.bad ? 'bad' : '';
    const rows = item.rows.map(r => `
        <div class="value-row">
            <span class="value-label">${escapeHtml(r.label)}</span>
            <span class="value-actual ${valueClass(r)}">${escapeHtml(r.value)}</span>
        </div>`).join('');

    return `
    <div class="check-card ${item.status}">
      <div class="card-header">
        <span class="card-icon">${escapeHtml(item.icon)}</span>
        <span class="card-title">${escapeHtml(item.title)}</span>
        <span class="card-status ${item.status}">${statusLabel(item.status)}</span>
      </div>
      <div class="card-body">${rows}</div>
    </div>`;
}

function renderSummary(results) {
    const pass = results.filter(r => r.status === 'pass').length;
    const fail = results.filter(r => r.status === 'fail').length;
    const warn = results.filter(r => r.status === 'warn').length;
    const total = results.length;
    const pct = Math.round((pass / total) * 100);
    const scoreColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
    const radius = 24;
    const circ = 2 * Math.PI * radius;
    const offset = circ * (1 - pct / 100);

    return `
    <div class="score-ring">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="${radius}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5"/>
        <circle cx="30" cy="30" r="${radius}" fill="none" stroke="${scoreColor}" stroke-width="5"
          stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
          stroke-linecap="round"/>
      </svg>
      <div class="score-text">
        <div class="num" style="color:${scoreColor}">${pct}</div>
        <div class="den">/ 100</div>
      </div>
    </div>
    <div class="summary-info">
      <h2>${pct >= 80 ? '🛡️ Gizlilik İyi Durumda' : pct >= 60 ? '⚠️ Dikkat Gerektiriyor' : '❌ Yüksek Risk'}</h2>
      <p>${pass} test geçti · ${fail} başarısız · ${warn} uyarı</p>
    </div>
    <div class="summary-badges">
      <span class="badge pass">✅ ${pass}</span>
      <span class="badge fail">❌ ${fail}</span>
      <span class="badge warn">⚠️ ${warn}</span>
    </div>`;
}

function groupByCategory(results) {
    const groups = {};
    for (const r of results) {
        if (!groups[r.category]) groups[r.category] = [];
        groups[r.category].push(r);
    }
    return groups;
}

// ---- CreepJS Bridge ----
async function getCreepData() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getCreepSummary" }, (response) => {
            resolve(response);
        });
    });
}

async function runChecks() {
    const banner = document.getElementById('summaryBanner');
    const grid = document.getElementById('checkGrid');
    
    banner.innerHTML = '<div class="loading"><div class="spinner"></div>Analiz yapılıyor...</div>';
    grid.innerHTML = '';

    // Fetch remote data first
    const creep = await getCreepData();
    const results = checks();

    // Inject CreepJS summary as priority cards if available
    if (creep && creep.fpId) {
        results.unshift({
            icon: '🕵️', title: 'CreepJS Kimliği (Canlı)',
            category: 'Gelişmiş Analiz',
            status: 'pass',
            rows: [
                { label: 'FP ID', value: creep.fpId, good: true },
                { label: 'Stealth Skoru', value: creep.stealthRating || '—', neutral: true }
            ]
        });

        results.unshift({
            icon: '🛡️', title: 'CreepJS Güven Özeti',
            category: 'Gelişmiş Analiz',
            status: parseInt(creep.liesCount) > 0 ? 'fail' : 'pass',
            rows: [
                { label: 'Tespit Edilen Yalan', value: creep.liesCount, bad: parseInt(creep.liesCount) > 0, good: parseInt(creep.liesCount) === 0 },
                { label: 'Headless Durumu', value: creep.headlessRating || '—', neutral: true }
            ]
        });
    }

    banner.innerHTML = renderSummary(results);
    const groups = groupByCategory(results);
    let html = '';
    for (const [cat, items] of Object.entries(groups)) {
        html += `<div class="section-title">${escapeHtml(cat)}</div><div class="grid">`;
        html += items.map(renderCard).join('');
        html += `</div>`;
    }
    grid.innerHTML = html;
}

// ---- Tab Switching ----
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.target);
            if (target) target.classList.add('active');
        });
    });
}

// ---- Deep Scrape Logic ----
const CREEP_PATH_MAP = [
    { name: "Ana Sayfa", path: "/creepjs/" },
    { name: "Workers", path: "/creepjs/tests/workers.html" },
    { name: "Iframes", path: "/creepjs/tests/iframes.html" },
    { name: "Fonts", path: "/creepjs/tests/fonts.html" },
    { name: "Timezone", path: "/creepjs/tests/timezone.html" },
    { name: "Window", path: "/creepjs/tests/window.html" },
    { name: "Screen", path: "/creepjs/tests/screen.html" },
    { name: "Prototype", path: "/creepjs/tests/prototype.html" },
    { name: "DOMRect", path: "/creepjs/tests/domrect.html" },
    { name: "Emojis", path: "/creepjs/tests/emojis.html" },
    { name: "Math", path: "/creepjs/tests/math.html" },
    { name: "Machine", path: "/creepjs/tests/machine.html" },
    { name: "Extensions", path: "/creepjs/tests/extensions.html" },
    { name: "Proxy", path: "/creepjs/tests/proxy.html" }
];

function initDeepScrapeUI() {
    const list = document.getElementById('progressList');
    if (!list) return;
    list.innerHTML = CREEP_PATH_MAP.map(m => `
        <div class="progress-item waiting" id="p-${m.path.replace(/\//g, '_').replace(/\./g, '_')}">
           ⏳ ${m.name}
        </div>
    `).join('');
}

function renderDeepResults(results) {
    const container = document.getElementById('deepScrapeResults');
    if (!container) return;
    container.innerHTML = '';
    
    // Sort results by CREEP_PATH_MAP order
    const sortedPaths = CREEP_PATH_MAP.map(m => m.path).filter(p => results[p]);
    
    if (sortedPaths.length === 0) {
        container.innerHTML = '<div class="loading">Henüz veri toplanmadı.</div>';
        return;
    }

    for (const path of sortedPaths) {
        const data = results[path];
        const card = document.createElement('div');
        card.className = 'deep-result-card';
        
        const liesDetected = data.items.filter(i => i.isLies).length;
        const totalItems = data.items.length;
        
        const header = document.createElement('div');
        header.className = 'deep-result-header';
        header.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <strong style="font-size:13px;">${CREEP_PATH_MAP.find(m=>m.path===path)?.name || data.title}</strong>
                <span style="font-size:10px; color:var(--text-muted);">${path}</span>
            </div>
            <span class="badge ${liesDetected > 0 ? 'fail' : 'pass'}">
                ${liesDetected} / ${totalItems} Tespit
            </span>
        `;
        
        const body = document.createElement('div');
        body.className = 'deep-result-body';
        
        let rowsHtml = data.items.map(item => `
            <div class="value-row" style="margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:4px;">
                <span class="value-label" style="font-size:11px;">${escapeHtml(item.label)}</span>
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                    <span class="value-actual ${item.isLies ? 'bad' : 'good'}" style="font-size:11px;">${escapeHtml(item.value)}</span>
                    ${item.detail ? `<span style="font-size:9px; color:var(--text-muted); text-align:right;">${escapeHtml(item.detail)}</span>` : ''}
                </div>
            </div>
        `).join('');
        
        body.innerHTML = `<div class="card-body">${rowsHtml}</div>`;
        header.addEventListener('click', () => body.classList.toggle('active'));
        
        card.appendChild(header);
        card.appendChild(body);
        container.appendChild(card);
    }
}

function setupDeepScrapeListeners() {
    const btnStart = document.getElementById('btnStartDeepScrape');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            initDeepScrapeUI();
            document.getElementById('deepScrapeProgressArea').style.display = 'block';
            document.getElementById('deepScrapeStatus').innerText = 'Tarama başlatıldı, sayfalar geziliyor...';
            document.getElementById('deepScrapeResults').innerHTML = '<div class="loading"><div class="spinner"></div>Veriler toplanıyor...</div>';
            chrome.runtime.sendMessage({ action: "startDeepScrape" });
            btnStart.disabled = true;
            btnStart.style.opacity = "0.5";
        });
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "deepScrapeProgress") {
            const id = `p-${msg.path.replace(/\//g, '_').replace(/\./g, '_')}`;
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('waiting');
                el.classList.add('done');
                const name = CREEP_PATH_MAP.find(m => m.path === msg.path)?.name || msg.path;
                el.innerText = '✅ ' + name;
            }
            document.getElementById('deepScrapeStatus').innerText = `Tarama devam ediyor: ${msg.index + 1} / ${msg.total}`;
        }
        
        if (msg.action === "deepScrapeComplete") {
            document.getElementById('deepScrapeStatus').innerText = 'Tarama tamamlandı! Tüm sayfalar incelendi.';
            const btnStart = document.getElementById('btnStartDeepScrape');
            if (btnStart) {
                btnStart.disabled = false;
                btnStart.style.opacity = "1";
                btnStart.innerText = "↻ Taramayı Yeniden Başlat";
            }
            renderDeepResults(msg.results);
        }
    });
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    runChecks();
    initTabs();
    setupDeepScrapeListeners();

    // Check if there are existing results to display
    chrome.runtime.sendMessage({ action: "getDeepScrapeResults" }, (results) => {
        if (results && Object.keys(results).length > 0) {
            document.getElementById('deepScrapeProgressArea').style.display = 'block';
            document.getElementById('deepScrapeStatus').innerText = 'Önceki tarama sonuçları yüklendi.';
            // Mark all as done in UI if viewing old results
            initDeepScrapeUI();
            Object.keys(results).forEach(path => {
                const id = `p-${path.replace(/\//g, '_').replace(/\./g, '_')}`;
                const el = document.getElementById(id);
                if (el) { el.classList.remove('waiting'); el.classList.add('done'); }
            });
            renderDeepResults(results);
        }
    });

    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', runChecks);
    }
});

