import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

// Define the exact shape of our expected data
interface StatusResponse {
  blocked: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatusResponse>({ blocked: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        // We add 'as StatusResponse' to force TypeScript to recognize the shape of the data
        const response = (await browser.runtime.sendMessage({ action: "GET_STATUS" })) as StatusResponse;
        
        if (response && typeof response.blocked === 'number') {
          setStats({ blocked: response.blocked });
        }
      } catch (error) {
        console.warn("Could not communicate with background script.", error);
      }
    }
    fetchStats();
  }, []);

  const score = Math.max(0, 100 - stats.blocked * 5);

  return (
    <div style={{
      width: '300px',
      padding: '20px',
      boxSizing: 'border-box',
      background: '#ffffff'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#1A237E' }}>Data Privacy Guardian</h3>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#F5F5F5',
        padding: '12px',
        borderRadius: '6px',
        marginBottom: '10px'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Privacy Score</span>
        <span style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: score > 75 ? '#2E7D32' : score > 40 ? '#EF6C00' : '#C62828'
        }}>{score}/100</span>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#F5F5F5',
        padding: '12px',
        borderRadius: '6px'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Trackers Blocked</span>
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1A237E' }}>{stats.blocked}</span>
      </div>
    </div>
  );
};