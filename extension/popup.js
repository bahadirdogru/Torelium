const btnNewnym    = document.getElementById('btnNewnym');
const msgEl        = document.getElementById('message');
const cooldownEl   = document.getElementById('cooldown');
const torDot       = document.getElementById('torDot');
const torStatus    = document.getElementById('torStatus');
const exitIPEl     = document.getElementById('exitIP');
const exitFPIDEl   = document.getElementById('exitFPID');
const countEl      = document.getElementById('newnymCount');

// ---- Load circuit info on popup open ----
function loadCircuitInfo() {
    // Add a safety timeout in case the background doesn't respond
    const safetyTimeout = setTimeout(() => {
        if (exitIPEl.textContent === 'yükleniyor...') {
            exitIPEl.textContent = 'zaman aşımı';
            exitIPEl.className = 'info-value bad';
        }
    }, 10000);

    chrome.runtime.sendMessage({ action: "getCircuitInfo" }, (res) => {
        clearTimeout(safetyTimeout);
        if (chrome.runtime.lastError || !res) {
            setTorStatus(false);
            exitIPEl.textContent = 'bağlantı yok';
            exitIPEl.className = 'info-value bad';
            exitFPIDEl.textContent = '—';
            exitFPIDEl.className = 'info-value';
            return;
        }
        setTorStatus(res.isTor);
        if (res.ip) {
            exitIPEl.textContent = res.ip;
            exitIPEl.className = 'info-value good';
        } else {
            exitIPEl.textContent = res.error === 'timeout' ? 'zaman aşımı' : 'alınamadı';
            exitIPEl.className = 'info-value bad';
        }
        
        if (res.fpId) {
            // Truncate long hex for small popup
            const shortId = res.fpId.length > 12 ? res.fpId.substring(0, 12) + '…' : res.fpId;
            exitFPIDEl.textContent = shortId;
            exitFPIDEl.title = res.fpId; // Full ID on hover
            exitFPIDEl.className = 'info-value good';
        } else {
            exitFPIDEl.textContent = 'bilinmiyor';
            exitFPIDEl.className = 'info-value loading';
        }
        updateCount(res.count || 0);
    });
}

function setTorStatus(connected) {
    if (connected) {
        torDot.classList.remove('red');
        torStatus.textContent = 'Tor üzerinden bağlı';
    } else {
        torDot.classList.add('red');
        torStatus.textContent = 'Tor bağlantısı yok';
    }
}

function updateCount(n) {
    countEl.textContent = n === 0 ? '0 kimlik değişimi' : `${n}× değiştirildi`;
}

// ---- Message helpers ----
function showMessage(text, type) {
    msgEl.textContent = text;
    msgEl.className = 'message ' + type;
    setTimeout(() => { msgEl.className = 'message'; }, 5000);
}

function startCooldown(seconds) {
    let remaining = seconds;
    btnNewnym.disabled = true;
    const interval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(interval);
            btnNewnym.disabled = false;
            cooldownEl.textContent = '';
        } else {
            cooldownEl.textContent = `Sonraki kimlik: ${remaining}s`;
        }
    }, 1000);
    cooldownEl.textContent = `Sonraki kimlik: ${seconds}s`;
}

// ---- NEWNYM ----
function requestNewnym() {
    if (btnNewnym.disabled) return;
    btnNewnym.disabled = true;
    btnNewnym.innerHTML = '<span>⏳</span> İşleniyor...';

    // UI Safety Timeout (Ensures button resets even if background fails)
    const uiTimeout = setTimeout(() => {
        if (btnNewnym.disabled && btnNewnym.innerHTML.includes('İşleniyor')) {
            btnNewnym.disabled = false;
            btnNewnym.innerHTML = '<span>⚡</span> Yeni Tor Kimliği Al';
            showMessage("Bağlantı zaman aşımı (Arka plan yanıt vermiyor).", 'error');
        }
    }, 15000);

    chrome.runtime.sendMessage({ action: "newnym" }, (res) => {
        clearTimeout(uiTimeout);
        btnNewnym.innerHTML = '<span>⚡</span> Yeni Tor Kimliği Al';
        if (res && res.success) {
            showMessage(res.message, 'success');
            updateCount(res.count || 0);
            startCooldown(10);
            // IP değişti, güncelle
            setTimeout(loadCircuitInfo, 3000);
        } else {
            showMessage(res ? res.message : "Bilinmeyen hata (Timeout).", 'error');
            btnNewnym.disabled = false;
        }
    });
}

// ---- Checklist ----
function openChecklist() {
    chrome.tabs.create({ url: chrome.runtime.getURL("checklist.html") }, () => {
        window.close();
    });
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    loadCircuitInfo();
    
    if (btnNewnym) {
        btnNewnym.addEventListener('click', requestNewnym);
    }

    const btnNewHardware = document.getElementById('btnNewHardware');
    if (btnNewHardware) {
        btnNewHardware.addEventListener('click', () => {
            btnNewHardware.disabled = true;
            const originalHTML = btnNewHardware.innerHTML;
            btnNewHardware.innerHTML = '<span>⏳</span> Yenileniyor...';
            
            chrome.runtime.sendMessage({ action: "newHardwareIdentity" }, (res) => {
                btnNewHardware.innerHTML = originalHTML;
                btnNewHardware.disabled = false;
                if (res && res.success) {
                    showMessage(res.message, 'success');
                } else {
                    showMessage("Hata oluştu.", 'error');
                }
            });
        });
    }

    const btnChecklist = document.getElementById('btnChecklist');
    if (btnChecklist) {
        btnChecklist.addEventListener('click', openChecklist);
    }
});
