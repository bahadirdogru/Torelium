(() => {
    // CreepJS results are usually inside #fingerprint-data
    function scrape() {
        const dataContainer = document.querySelector('#fingerprint-data');
        
        // Handle Main Page separately if needed
        const fpIdEl = document.querySelector('.fingerprint-header .ellipsis-all');
        const fpId = fpIdEl ? fpIdEl.innerText.replace('FP ID:', '').trim() : null;

        if (window.location.pathname === '/creepjs/' || window.location.pathname === '/creepjs/index.html') {
            if (!fpId || fpId === 'Computing...') return false;
            
            const liesEl = document.querySelector('.lies');
            const liesCount = liesEl ? (liesEl.innerText.match(/\d+/) || [0])[0] : 0;
            const stealthEl = document.querySelector('#headless-resistance-detection .col-six div:nth-child(5)');
            const headlessEl = document.querySelector('#headless-resistance-detection .col-six div:nth-child(3)');

            const summary = {
                fpId,
                liesCount,
                stealthRating: stealthEl ? stealthEl.innerText : '—',
                headlessRating: headlessEl ? headlessEl.innerText : '—',
                timestamp: Date.now()
            };
            chrome.runtime.sendMessage({ action: "updateCreepSummary", data: summary });
            return true;
        }

        // Sub-pages (/tests/*.html)
        if (!dataContainer || dataContainer.innerText.includes('Computing')) return false;

        const results = {
            url: window.location.href,
            path: window.location.pathname,
            title: document.title.replace('CreepJS - ', ''),
            items: [],
            timestamp: Date.now()
        };

        const rows = dataContainer.querySelectorAll('.flex-grid');
        rows.forEach(row => {
            const cols = row.querySelectorAll('div[class*="col-"]');
            if (cols.length >= 2) {
                const label = cols[0].innerText.trim().replace(/:$/, '');
                const value = cols[1].innerText.trim();
                if (label) {
                    results.items.push({
                        label: label,
                        value: value,
                        isLies: row.classList.contains('lies') || !!row.querySelector('.lies')
                    });
                }
            } else {
                const strong = row.querySelector('strong');
                if (strong) {
                    results.items.push({
                        label: strong.innerText.trim().replace(/:$/, ''),
                        value: row.innerText.replace(strong.innerText, '').trim()
                    });
                }
            }
        });

        // Special check for Worker blocks which might not use .flex-grid
        if (results.items.length === 0) {
            const blocks = dataContainer.querySelectorAll('div > div');
            blocks.forEach(block => {
                const strong = block.querySelector('strong');
                const hash = block.querySelector('.hash');
                if (strong && hash) {
                    results.items.push({
                        label: strong.innerText.trim(),
                        value: hash.innerText.trim(),
                        detail: block.innerText.replace(strong.innerText, '').replace(hash.innerText, '').trim()
                    });
                }
            });
        }

        if (results.items.length > 0) {
            chrome.runtime.sendMessage({ action: "creepScraped", data: results });
            return true;
        }
        return false;
    }

    const interval = setInterval(() => {
        if (scrape()) {
            // Data found, we can wait a bit more for stability then stop
            setTimeout(() => clearInterval(interval), 2000);
        }
    }, 1500);

    setTimeout(() => clearInterval(interval), 45000);
})();

