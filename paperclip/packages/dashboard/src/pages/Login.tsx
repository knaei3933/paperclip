import { useState } from 'react';
import { login } from '../api/client';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    const result = await login(username, password);
    if (result.success && result.token) {
      onLogin();
    } else {
      setError('ユーザー名またはパスワードが正しくありません');
    }
    setLoading(false);
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.logo}>Paperclip</div>
        <h2 style={s.title}>ログイン</h2>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>ユーザー名</label>
            <input
              style={s.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>パスワード</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button type="submit" style={s.submitBtn} disabled={loading || !username.trim() || !password}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
  },
  card: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '12px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '380px',
  },
  logo: {
    color: '#93c5fd',
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    letterSpacing: '0.05em',
  },
  title: {
    color: '#e2e8f0',
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: '0 0 1.5rem 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
  },
  label: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #2a3a5c',
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  error: {
    color: '#f87171',
    fontSize: '0.8rem',
  },
  submitBtn: {
    backgroundColor: '#1e40af',
    color: '#93c5fd',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    padding: '0.65rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginTop: '0.5rem',
  },
};
