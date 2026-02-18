/**
 * YomiMark Background Service Worker
 * Manages extension lifecycle and messaging between popup and content scripts.
 */

// On install, set default state
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
        chrome.storage.local.set({ yomimarkEnabled: true });
        console.log("[YomiMark] Extension installed, enabled by default.");
    }
});

// Listen for storage changes and broadcast to all content scripts
chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes.yomimarkEnabled) {
        const isEnabled = changes.yomimarkEnabled.newValue;

        // Broadcast to all tabs
        chrome.tabs.query({}, function (tabs) {
            for (const tab of tabs) {
                chrome.tabs.sendMessage(
                    tab.id,
                    { type: "SET_ENABLED", enabled: isEnabled },
                    function () {
                        // Suppress error for tabs without content script
                        if (chrome.runtime.lastError) {
                            // Expected for non-http tabs
                        }
                    }
                );
            }
        });
    }
});
