import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

interface StatusResponse {
  enabled: boolean;
  blockedList: string[];
  totalBlocked: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatusResponse>({ enabled: true, blockedList: [], totalBlocked: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = (await browser.runtime.sendMessage({ action: "GET_STATUS" })) as StatusResponse;
      if (response && response.blockedList) {
        setStats(response);
      }
    } catch (error) {
      console.warn("Communication error", error);
    }
  }

  async function toggleProtection() {
      await browser.runtime.sendMessage({ action: "TOGGLE_PROTECTION" });
      fetchStats(); 
      browser.tabs.reload(); 
  }

  const score = stats.enabled ? Math.max(0, 100 - stats.totalBlocked * 5) : 0;

  return (
    <div style={{ width: '320px', padding: '20px', boxSizing: 'border-box', background: '#ffffff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#1A237E' }}>Privacy Guardian</h3>
          
          <button 
            onClick={toggleProtection}
            style={{
                background: stats.enabled ? '#D32F2F' : '#4CAF50',
                color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
            }}>
              {stats.enabled ? "Disable on this site" : "Enable Protection"}
          </button>
      </div>
      
      {stats.enabled ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#F5F5F5', borderRadius: '6px', marginBottom: '10px' }}>
                <span style={{ fontWeight: 500 }}>Privacy Score</span>
                <span style={{ fontWeight: 'bold', color: score > 75 ? '#2E7D32' : '#EF6C00' }}>{score}/100</span>
            </div>

            <div style={{ padding: '12px', background: '#F5F5F5', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 500 }}>Threats Blocked</span>
                    <span style={{ fontWeight: 'bold', color: '#1A237E' }}>{stats.totalBlocked}</span>
                </div>
                
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: '120px', overflowY: 'auto', fontSize: '12px', color: '#555' }}>
                    {stats.blockedList.map((domain, idx) => (
                        <li key={idx} style={{ padding: '4px 0', borderBottom: '1px solid #ddd' }}>
                            🚫 {domain}
                        </li>
                    ))}
                    {stats.blockedList.length === 0 && <li>No trackers detected yet.</li>}
                </ul>
            </div>
          </>
      ) : (
          <div style={{ padding: '20px', textAlign: 'center', background: '#FFF3E0', color: '#E65100', borderRadius: '6px' }}>
              ⚠️ Protection is currently disabled for this website. Trackers are not being blocked.
          </div>
      )}
    </div>
  );
};