'use client';

import { useEffect, useState } from 'react';
import { checkServerHealth, config } from '@/lib/java-api';

export function JavaServerTest() {
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const apiBaseSafe = config.apiBase ?? '';

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setHealth(null);
    
    try {
      console.log('🔧 Testing Java server connection...');
      config.logConfig();
      
      let result;
      try {
        // First try the configured URL (tunnel)
        result = await checkServerHealth();
        console.log('✅ Java server health check passed:', result);
      } catch (tunnelError) {
        console.warn('🔄 Tunnel failed, trying localhost fallback:', tunnelError);
        
        // If tunnel fails, try localhost directly
        const originalBase = config.apiBase;
        (config as any).apiBase = 'http://localhost:8081'; // Updated to correct port
        
        try {
          result = await checkServerHealth();
          console.log('✅ Local Java server health check passed:', result);
          setError(`Tunnel failed, but local server works. Error: ${(tunnelError as Error).message}`);
        } catch (localError) {
          console.error('❌ Both tunnel and local server failed');
          throw new Error(`Tunnel: ${(tunnelError as Error).message}, Local: ${(localError as Error).message}`);
        } finally {
          (config as any).apiBase = originalBase; // Restore original
        }
      }
      
      setHealth(result);
    } catch (e: any) {
      console.error('❌ Java server health check failed:', e);
      setError(e.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      margin: '20px 0',
      backgroundColor: '#f9f9f9'
    }}>
      <h3>🔧 Java Server Connection Test</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>API Base URL:</strong> {config.apiBase ?? '(not set)'}
      </div>
      
      <button 
        onClick={testConnection} 
        disabled={loading}
        style={{
          padding: '8px 16px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginRight: '10px'
        }}
      >
        {loading ? 'Testing...' : 'Test Connection'}
      </button>
      
      <button 
        onClick={async () => {
          setLoading(true);
          try {
            const response = await fetch('http://localhost:8081/health');
            const data = await response.json();
            setHealth(data);
            setError(null);
          } catch (e: any) {
            setError(`Local test: ${e.message}`);
          }
          setLoading(false);
        }}
        disabled={loading}
        style={{
          padding: '8px 16px',
          backgroundColor: loading ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        Test Localhost
      </button>
      
      {health && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#d4edda', borderRadius: '4px' }}>
          <strong>✅ Connection Successful!</strong>
          <pre style={{ fontSize: '12px', marginTop: '5px' }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        </div>
      )}
      
      {error && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
          <strong>❌ Connection Failed:</strong>
          <div style={{ fontSize: '14px', marginTop: '5px', color: '#721c24' }}>
            {error}
          </div>
        </div>
      )}
      
      <details style={{ marginTop: '10px' }}>
        <summary>🔍 Debug Info</summary>
        <pre style={{ fontSize: '11px', backgroundColor: '#fff', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
{`Environment Variables:
- NEXT_PUBLIC_JAVA_API_URL: ${process.env.NEXT_PUBLIC_JAVA_API_URL || 'undefined'}
- NODE_ENV: ${process.env.NODE_ENV}

Configuration:
- API Base: ${config.apiBase ?? '(not set)'}
- Use Java Server: ${config.useJavaServer}
- Is Production: ${config.isProduction}
- Has ngrok Header: ${apiBaseSafe.includes('ngrok') || apiBaseSafe.includes('tunnel')}`}
        </pre>
      </details>
    </div>
  );
}
