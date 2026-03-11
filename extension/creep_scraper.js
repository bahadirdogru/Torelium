(() => {
    console.log("[TORELIUM] CreepJS Scraper Active");

    function scrape() {
        // Try to find the FP ID
        const fpIdEl = document.querySelector('.fingerprint-header .ellipsis-all');
        const fpId = fpIdEl ? fpIdEl.innerText.replace('FP ID:', '').trim() : null;

        if (!fpId || fpId === 'Computing...') return;

        // Trash & Lies
        const liesEl = document.querySelector('.lies');
        const liesCount = liesEl ? (liesEl.innerText.match(/\d+/) || [0])[0] : 0;

        // Stealth & Headless
        const stealthEl = document.querySelector('#headless-resistance-detection .col-six div:nth-child(5)');
        const stealthRating = stealthEl ? stealthEl.innerText : '—';
        
        const headlessEl = document.querySelector('#headless-resistance-detection .col-six div:nth-child(3)');
        const headlessRating = headlessEl ? headlessEl.innerText : '—';

        const data = {
            fpId,
            liesCount,
            stealthRating,
            headlessRating,
            timestamp: Date.now()
        };

        chrome.runtime.sendMessage({ action: "updateCreepSummary", data });
    }

    // Periodically scrape until data is found
    const interval = setInterval(() => {
        scrape();
        // If we have a stable FP ID, we can slow down but keep monitoring
        const fpIdEl = document.querySelector('.fingerprint-header .ellipsis-all');
        if (fpIdEl && !fpIdEl.innerText.includes('Computing')) {
            // Found it, but maybe wait for more details?
        }
    }, 2000);

    // Stop after 2 minutes just in case
    setTimeout(() => clearInterval(interval), 120000);
})();
