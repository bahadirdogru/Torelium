(async () => {
    try {
        const res = await chrome.storage.local.get('hw_seed');
        if (res.hw_seed) {
            document.documentElement.setAttribute('data-target-seed', res.hw_seed);
            document.documentElement.setAttribute('data-extension-url', chrome.runtime.getURL('spoof.js'));
        }
    } catch (e) {}
})();
