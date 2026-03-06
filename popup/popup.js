/**
 * YomiMark Popup Script
 * Handles the enable/disable toggle and status display.
 */
(function () {
    "use strict";

    const toggle = document.getElementById("enable-toggle");
    const statusBar = document.getElementById("status-bar");
    const statusText = document.getElementById("status-text");

    const colorPicker = document.getElementById("rt-color");
    const gairaigoColorPicker = document.getElementById("gairaigo-color");
    const demoRtKanji = document.querySelectorAll(".demo-after .yomimark-rt-kanji");
    const demoRtGairaigo = document.querySelectorAll(".demo-after .yomimark-rt-gairaigo");

    // Load saved state
    chrome.storage.local.get(["yomimarkEnabled", "yomimarkRubyColor", "yomimarkGairaigoColor"], function (result) {
        const isEnabled = result.yomimarkEnabled !== false; // default true
        toggle.checked = isEnabled;
        updateStatusUI(isEnabled);

        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        if (result.yomimarkRubyColor) {
            colorPicker.value = result.yomimarkRubyColor;
            demoRtKanji.forEach(el => el.style.color = result.yomimarkRubyColor);
        } else {
            colorPicker.value = isDark ? "#38bdf8" : "#4a62a8";
        }

        if (result.yomimarkGairaigoColor) {
            gairaigoColorPicker.value = result.yomimarkGairaigoColor;
            demoRtGairaigo.forEach(el => el.style.color = result.yomimarkGairaigoColor);
        } else {
            gairaigoColorPicker.value = isDark ? "#34d399" : "#10b981";
        }
    });

    // Color picker handlers
    colorPicker.addEventListener("input", function () {
        const color = colorPicker.value;
        chrome.storage.local.set({ yomimarkRubyColor: color });
        demoRtKanji.forEach(el => el.style.color = color);
    });

    gairaigoColorPicker.addEventListener("input", function () {
        const color = gairaigoColorPicker.value;
        chrome.storage.local.set({ yomimarkGairaigoColor: color });
        demoRtGairaigo.forEach(el => el.style.color = color);
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
