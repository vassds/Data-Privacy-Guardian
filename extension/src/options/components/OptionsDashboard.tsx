import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export const OptionsDashboard: React.FC = () => {
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("Never");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const data = await browser.storage.local.get(['globalAllowlist', 'lastSyncTime']);
    
    // FIX: Explicitly cast the fetched storage data
    const savedAllowlist = (data.globalAllowlist as string[]) || [];
    setAllowlist(savedAllowlist);
    
    if (data.lastSyncTime) {
        // FIX: Assert lastSyncTime is a number for the Date constructor
        setLastUpdated(new Date(data.lastSyncTime as number).toLocaleString());
    }
  }

  async function forceSync() {
    setLastUpdated("Syncing now...");
    await browser.runtime.sendMessage({ action: "FORCE_SYNC" });
    loadSettings();
  }

  async function removeDomain(domain: string) {
    const newList = allowlist.filter(d => d !== domain);
    await browser.storage.local.set({ globalAllowlist: newList });
    setAllowlist(newList);
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h1 style={{ color: '#1A237E' }}>🛡️ Data Privacy Guardian Settings</h1>
      
      <div style={{ background: '#E8EAF6', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Engine Status</h3>
        <p><strong>Blocklist Last Updated:</strong> {lastUpdated}</p>
        <button onClick={forceSync} style={{ background: '#3F51B5', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }}>
          Force Rule Sync Now
        </button>
      </div>

      <div style={{ background: '#FFF3E0', padding: '20px', borderRadius: '8px' }}>
        <h3>Website Allowlist (Kill Switch Active)</h3>
        <p>The Rust engine is currently disabled for these domains:</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {allowlist.length === 0 ? <li>No domains allowed yet.</li> : allowlist.map(domain => (
            <li key={domain} style={{ padding: '10px', background: '#fff', border: '1px solid #ddd', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
              <strong>{domain}</strong>
              <button onClick={() => removeDomain(domain)} style={{ background: '#D32F2F', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};