import browser from 'webextension-polyfill';
import init, { PrivacyEngine } from '../../../core/pkg/dpg_core.js';

let engine: PrivacyEngine | null = null;
const blockedCounts: Record<number, number> = {};

// We use a Promise to ensure the engine is fully loaded before processing requests
let engineInitPromise: Promise<void> | null = null;

async function loadWasmEngine() {
  try {
    // In Webpack 5, the WASM file is bundled alongside the background script.
    // Sometimes getURL fails in Firefox MV3 due to strict origin policies.
    // We try a relative fetch first, falling back to the absolute URL.
    console.log("Data Privacy Guardian: Attempting to load Rust engine...");
    
    let wasmUrl = 'dpg_core_bg.wasm'; 
    try {
        await init(wasmUrl);
    } catch(e) {
        wasmUrl = browser.runtime.getURL('dpg_core_bg.wasm');
        await init(wasmUrl);
    }
    
    engine = new PrivacyEngine();
    console.log("Data Privacy Guardian: WASM Engine SUCCESSFULLY loaded!");
  } catch (error) {
    console.error("FATAL ERROR: Failed to load WASM Engine:", error);
  }
}

// Start the initialization immediately and store the promise
engineInitPromise = loadWasmEngine();

browser.webRequest.onBeforeRequest.addListener(
  // In MV3 blocking requests, we CANNOT use async/await here natively without returning a Promise.
  // But returning a Promise in onBeforeRequest is only supported in specific browser versions.
  // Therefore, if the engine isn't ready instantly, we let the very first requests pass 
  // (to avoid breaking the web), but catch all subsequent ones.
  (details: any) => { 
    if (!engine || details.tabId < 0) {
        // If you see this log a lot, the WASM engine is failing to load!
        // console.warn("Engine not ready, allowing request:", details.url);
        return { cancel: false }; 
    }

    try {
        const analysis: any = engine.analyze_url(details.url);

        if (analysis && analysis.is_tracker) {
            console.log(`BLOCKED: ${details.url}`);
            blockedCounts[details.tabId] = (blockedCounts[details.tabId] || 0) + 1;
            
            browser.action.setBadgeText({
                tabId: details.tabId,
                text: blockedCounts[details.tabId].toString()
            });
            browser.action.setBadgeBackgroundColor({ color: "#D32F2F" });

            return { cancel: true }; 
        }
    } catch (e) {
        console.error("Error analyzing URL in Rust:", e);
    }

    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.tabs.onRemoved.addListener((tabId: number) => { 
  delete blockedCounts[tabId];
});

browser.runtime.onMessage.addListener(async (message: any) => { 
  if (message.action === "GET_STATUS") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTabId = tabs[0]?.id;
    return {
      blocked: currentTabId ? (blockedCounts[currentTabId] || 0) : 0
    };
  }
});