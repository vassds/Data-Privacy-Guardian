import browser from 'webextension-polyfill';
import init, { PrivacyEngine } from '../../../core/pkg/dpg_core.js';

let engine: PrivacyEngine | null = null;
const blockedCounts: Record<number, number> = {};
// CHANGED: Use an Array instead of a Set to store every single request
const tabBlockedDomains: Record<number, string[]> = {};

const FALLBACK_RULES = `google-analytics.com\nfacebook.net\nscorecardresearch.com\ndoubleclick.net`;

async function syncBlocklist() {
  console.log("Data Privacy Guardian: Syncing live blocklist...");
  try {
    const res = await fetch("https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/tracking-only/hosts");
    const text = await res.text();
    
    const domains = text.split('\n')
        .filter(line => line.startsWith('0.0.0.0'))
        .map(line => line.replace('0.0.0.0 ', '').trim())
        .join('\n');

    await browser.storage.local.set({ 
        'savedRules': domains, 
        'lastSyncTime': Date.now() 
    });
    
    if (engine) engine.load_rules(domains);
    console.log("Sync Complete!");
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
                    targetHost = dnsRecord.canonicalName;
                }
            } catch (e) {}
        }

        const analysis: any = engine.analyze_url(`https://${targetHost}`);

        if (analysis && analysis.is_tracker) {
            blockedCounts[details.tabId] = (blockedCounts[details.tabId] || 0) + 1;
            
            // CHANGED: Initialize as an array and push every single blocked domain
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
            // CHANGED: Simply return the array, no longer need to convert from a Set
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