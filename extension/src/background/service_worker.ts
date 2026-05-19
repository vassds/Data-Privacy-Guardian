import browser from 'webextension-polyfill';
import init, { PrivacyEngine } from '../../../core/pkg/dpg_core.js';

let engine: PrivacyEngine | null = null;
const blockedCounts: Record<number, number> = {};
const tabBlockedDomains: Record<number, string[]> = {};

const FALLBACK_RULES = `google-analytics.com\nfacebook.net\nscorecardresearch.com\ndoubleclick.net`;

async function syncBlocklist() {
  console.log("Data Privacy Guardian: Syncing live blocklist from custom Threat Intel API...");
  try {
    // YOUR CUSTOM PRODUCTION URL IS INTEGRATED HERE
    const res = await fetch("https://raw.githubusercontent.com/vassds/dpg-threat-intel/refs/heads/main/master_blocklist.txt");
    const text = await res.text();
    
    // Your Python script already cleaned the 0.0.0.0 prefixes, so we just split the text into lines
    const domains = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
        
    const finalRuleString = domains.join('\n');

    await browser.storage.local.set({ 
        'savedRules': finalRuleString, 
        'lastSyncTime': Date.now() 
    });
    
    if (engine) engine.load_rules(finalRuleString);
    console.log(`Sync Complete! Loaded ${domains.length} threat rules into Rust memory.`);
  } catch (e) {
    console.error("Failed to sync remote list, using cache/fallback.", e);
  }
}

async function loadWasmEngine() {
  try {
    let wasmUrl = 'dpg_core_bg.wasm'; 
    try { await init(wasmUrl); } catch(e) { await init(browser.runtime.getURL('dpg_core_bg.wasm')); }
    
    engine = new PrivacyEngine();
    
    const data = await browser.storage.local.get(['savedRules']);
    const savedRules = data.savedRules as string | undefined;
    engine.load_rules(savedRules || FALLBACK_RULES);
    
    if (!savedRules) await syncBlocklist();
    
  } catch (error) {
    console.error("Failed to load WASM:", error);
  }
}

loadWasmEngine();

browser.alarms.create("syncRules", { periodInMinutes: 1440 });
browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "syncRules") syncBlocklist();
});

browser.webRequest.onBeforeRequest.addListener(
  async (details: any) => { 
    if (!engine || details.tabId < 0) return { cancel: false };

    try {
        const urlObj = new URL(details.url);
        let targetHost = urlObj.hostname;
        
        const data = await browser.storage.local.get(['globalAllowlist']);
        const allowlist = (data.globalAllowlist as string[]) || [];
        
        const tabInfo = await browser.tabs.get(details.tabId);
        if (tabInfo.url) {
            const tabHost = new URL(tabInfo.url).hostname;
            if (allowlist.includes(tabHost)) return { cancel: false };
        }

        if (browser.dns && browser.dns.resolve) {
            try {
                const dnsRecord = await browser.dns.resolve(targetHost, ["canonical_name"]);
                if (dnsRecord.canonicalName) {
                    urlObj.hostname = dnsRecord.canonicalName; 
                }
            } catch (e) {}
        }

        // Pass the entire reconstructed URL to trigger Rust's heuristic Regex engine
        const analysis: any = engine.analyze_url(urlObj.href);

        if (analysis && analysis.is_tracker) {
            blockedCounts[details.tabId] = (blockedCounts[details.tabId] || 0) + 1;
            
            if (!tabBlockedDomains[details.tabId]) tabBlockedDomains[details.tabId] = [];
            tabBlockedDomains[details.tabId].push(analysis.rule_matched);
            
            browser.action.setBadgeText({ tabId: details.tabId, text: blockedCounts[details.tabId].toString() });
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
  delete blockedCounts[tabId];
  delete tabBlockedDomains[tabId];
});

browser.runtime.onMessage.addListener(async (message: any, sender: any) => { 
  if (message.action === "GET_STATUS") {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTabId = tabs[0]?.id;
    if (currentTabId) {
        const data = await browser.storage.local.get(['globalAllowlist']);
        const globalAllowlist = (data.globalAllowlist as string[]) || [];
        const tabHost = tabs[0].url ? new URL(tabs[0].url).hostname : "";
        const isEnabled = !globalAllowlist.includes(tabHost);
        
        return {
            enabled: isEnabled,
            blockedList: tabBlockedDomains[currentTabId] || [],
            totalBlocked: blockedCounts[currentTabId] || 0
        };
    }
  }
  
  if (message.action === "TOGGLE_PROTECTION") {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
          const tabHost = new URL(tabs[0].url).hostname;
          const data = await browser.storage.local.get(['globalAllowlist']);
          let globalAllowlist = (data.globalAllowlist as string[]) || [];
          
          if (globalAllowlist.includes(tabHost)) {
              globalAllowlist = globalAllowlist.filter((d: string) => d !== tabHost);
          } else {
              globalAllowlist.push(tabHost);
          }
          await browser.storage.local.set({ globalAllowlist });
          return { success: true };
      }
  }

  if (message.action === "FORCE_SYNC") {
      await syncBlocklist();
      return { success: true };
  }
});