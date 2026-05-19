import browser from 'webextension-polyfill';
import init, { PrivacyEngine } from '../../../core/pkg/dpg_core.js';

let engine: PrivacyEngine | null = null;

// Upgraded State Management: Track domains and allowlist status per tab
interface TabState {
  enabled: boolean;
  blockedDomains: Set<string>;
}
const tabStates: Record<number, TabState> = {};

async function loadWasmEngine() {
  try {
    let wasmUrl = 'dpg_core_bg.wasm'; 
    try { await init(wasmUrl); } 
    catch(e) { await init(browser.runtime.getURL('dpg_core_bg.wasm')); }
    
    engine = new PrivacyEngine();
    
    // Simulate fetching a massive blocklist from the internet
    const remoteBlocklist = `
      google-analytics.com
      facebook.net
      scorecardresearch.com
      doubleclick.net
      amazon-adsystem.com
      criteo.com
      hotjar.com
      outbrain.com
    `;
    engine.load_rules(remoteBlocklist);
    
    console.log("Data Privacy Guardian: Engine loaded with dynamic rules!");
  } catch (error) {
    console.error("Failed to load WASM:", error);
  }
}

loadWasmEngine();

// Ensure tab state exists
function getTabState(tabId: number): TabState {
    if (!tabStates[tabId]) {
        tabStates[tabId] = { enabled: true, blockedDomains: new Set() };
    }
    return tabStates[tabId];
}

browser.webRequest.onBeforeRequest.addListener(
  (details: any) => { 
    if (!engine || details.tabId < 0) return { cancel: false };

    const state = getTabState(details.tabId);
    
    // THE KILL SWITCH: If user disabled protection for this tab, let everything through
    if (!state.enabled) return { cancel: false };

    try {
        const analysis: any = engine.analyze_url(details.url);

        if (analysis && analysis.is_tracker) {
            state.blockedDomains.add(analysis.rule_matched);
            
            browser.action.setBadgeText({
                tabId: details.tabId,
                text: state.blockedDomains.size.toString()
            });
            browser.action.setBadgeBackgroundColor({ color: "#D32F2F" });

            return { cancel: true }; 
        }
    } catch (e) {}

    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.tabs.onRemoved.addListener((tabId: number) => { 
  delete tabStates[tabId];
});

// Upgraded Message Handler
browser.runtime.onMessage.addListener(async (message: any) => { 
  if (message.action === "GET_STATUS") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTabId = tabs[0]?.id;
    if (currentTabId) {
        const state = getTabState(currentTabId);
        return {
            enabled: state.enabled,
            blockedList: Array.from(state.blockedDomains) // Sets must be converted to Arrays to send to React
        };
    }
  }
  
  if (message.action === "TOGGLE_PROTECTION") {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTabId = tabs[0]?.id;
      if (currentTabId) {
          const state = getTabState(currentTabId);
          state.enabled = !state.enabled;
          
          // Clear the badge if disabled
          if (!state.enabled) {
              browser.action.setBadgeText({ tabId: currentTabId, text: "" });
          } else {
              browser.action.setBadgeText({ tabId: currentTabId, text: state.blockedDomains.size.toString() });
          }
          return { success: true };
      }
  }
});