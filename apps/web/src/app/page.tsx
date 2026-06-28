// Placeholder cockpit route. The real cockpit (D-03 scenario comparison, server-loaded via the
// container singleton + Server Actions) is built in the cockpit wave (07-03+). This stub exists
// only so `next build` produces a route and the scaffold is verifiably buildable.
export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>House</h1>
      <p>Affordability &amp; FI-Impact engine — web shell scaffold.</p>
    </main>
  );
}
