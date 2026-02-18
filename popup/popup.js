/**
 * YomiMark Popup Script
 * Handles the enable/disable toggle and status display.
 */
(function () {
    "use strict";

    const toggle = document.getElementById("enable-toggle");
    const statusBar = document.getElementById("status-bar");
    const statusText = document.getElementById("status-text");

    // Load saved state
    chrome.storage.local.get(["yomimarkEnabled"], function (result) {
        const isEnabled = result.yomimarkEnabled !== false; // default true
        toggle.checked = isEnabled;
        updateStatusUI(isEnabled);
    });

    // Toggle handler
    toggle.addEventListener("change", function () {
        const isEnabled = toggle.checked;

        // Save to storage
        chrome.storage.local.set({ yomimarkEnabled: isEnabled });

        // Notify content script in active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { type: "SET_ENABLED", enabled: isEnabled },
                    function (response) {
                        // Ignore errors (tab may not have content script)
                        if (chrome.runtime.lastError) {
                            // Content script not loaded on this page
                        }
                    }
                );
            }
        });

        updateStatusUI(isEnabled);
    });

    function updateStatusUI(isEnabled) {
        if (isEnabled) {
            statusBar.classList.remove("disabled");
            statusText.textContent = "Ready — select text to annotate";
        } else {
            statusBar.classList.add("disabled");
            statusText.textContent = "Disabled";
        }
    }
})();
