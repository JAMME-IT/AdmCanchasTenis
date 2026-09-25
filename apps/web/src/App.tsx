import { useState } from 'react';
import type { HealthResponse } from '@adm/shared';

const HEALTH_URL = 'http://localhost:3000/health';

export default function App(): JSX.Element {
  const [health, setHealth] = useState<string>('Not checked yet.');
  const [loading, setLoading] = useState<boolean>(false);

  async function checkHealth(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(HEALTH_URL);
      const data = (await res.json()) as HealthResponse;
      setHealth(`API status: ${data.status}`);
    } catch {
      setHealth('API unreachable. Is the API running on port 3000?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', maxWidth: '640px' }}>
      <h1>AdmCanchasTenis</h1>
      <p>Tennis court administration.</p>
      <p>
        <a href={HEALTH_URL} target="_blank" rel="noreferrer">
          Check API health (GET /health)
        </a>
      </p>
      <button type="button" onClick={checkHealth} disabled={loading}>
        {loading ? 'Checking...' : 'Fetch health'}
      </button>
      <p>{health}</p>
    </main>
  );
}
