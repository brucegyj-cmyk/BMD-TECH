const sourceUrl = 'https://extremepc.co.nz/amd-ryzen-7-9850x3d-8-core-16-thread-am5-4-7-ghz-cpu-processor-without-cooler/';

const specifications = [
  ['Model', 'AMD Ryzen 7 9850X3D'],
  ['Cores / threads', '8 cores / 16 threads'],
  ['Base clock', '4.7 GHz'],
  ['Maximum boost clock', 'Up to 5.6 GHz'],
  ['Socket', 'AM5'],
  ['Total cache', '104 MB'],
  ['Default TDP', '120 W'],
  ['Cooler', 'Not included'],
  ['Package', 'OEM / no retail package'],
];

export default function Ryzen9850x3dPage() {
  return (
    <>
      <div className="notice">FREE SHIPPING ON ORDERS OVER <strong>$150</strong> &nbsp; | &nbsp; NZ-BASED SUPPORT</div>
      <header className="catalog-header">
        <a className="brand" href="/">BMD <b>TECH</b></a>
        <nav aria-label="Main navigation">
          <a href="/memory">Memory</a>
          <a href="/cpu">CPU</a>
          <a href="/graphics">Graphics Cards</a>
          <a href="/opportunities">Opportunities</a>
        </nav>
      </header>
      <main className="catalog-wrap product-detail-page">
        <p className="crumb"><a href="/">Home</a> / <a href="/cpu">CPU</a> / Ryzen 7 9850X3D</p>
        <div className="product-detail-grid">
          <div className="product-detail-visual" aria-label="CPU product image placeholder">◉<span>AMD RYZEN 7</span></div>
          <section className="product-detail-info">
            <div className="eyebrow">AMD RYZEN 9000 SERIES</div>
            <h1>AMD Ryzen 7 9850X3D</h1>
            <p className="product-detail-subtitle">8 Core / 16 Thread AM5 4.7 GHz CPU Processor — without cooler, no retail package</p>
            <div className="reference-price"><span>EXTREME PC REFERENCE PRICE</span><strong>$949.00</strong><small>Price shown as listed by Extreme PC; retailer prices can change.</small></div>
            <a className="product-source detail-source" href={sourceUrl} target="_blank" rel="noreferrer">View at Extreme PC ↗</a>
            <p className="availability-note">Extreme PC currently lists 5+ in stock in Auckland.</p>
          </section>
        </div>
        <section className="spec-section">
          <div className="section-head"><h2>Specifications</h2><span>Product details from Extreme PC</span></div>
          <dl className="spec-list">{specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>
        <a className="catalog-back" href="/cpu">← Back to CPUs</a>
      </main>
      <footer className="footer"><div className="wrap"><div><div className="brand">BMD <b>TECH</b></div><p>Hardware for people who make things happen.</p><p>© 2026 BMD TECH. All prices in NZD.</p></div></div></footer>
    </>
  );
}
