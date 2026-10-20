'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Exam Cracker needs a refresh</h1>
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
            The app shell failed to start. Your saved progress is untouched.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload the app
          </button>
        </main>
      </body>
    </html>
  );
}
