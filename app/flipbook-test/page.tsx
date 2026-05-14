export default function FlipbookTestPage() {
  return (
    <main style={{ width: '100%', height: '100dvh', margin: 0, background: '#111' }}>
      <iframe
        src="/flipbook/index.html"
        title="Flipbook Test"
        style={{
          width: '100%',
          height: '100%',
          border: '0',
          display: 'block',
          background: '#111',
        }}
      />
    </main>
  )
}
