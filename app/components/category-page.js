const categoryContent = {
  memory: {
    title: 'Memory',
    subtitle: 'Desktop memory for your next build.',
    groups: [
      { title: 'DDR5 DESKTOP MEMORY', slots: [1, 2, 3] },
      { title: 'DDR4 DESKTOP MEMORY', slots: [4, 5, 6] },
    ],
  },
  cpu: {
    title: 'CPU',
    subtitle: 'Processors for gaming, work and everyday builds.',
    groups: [{ title: 'PROCESSORS', slots: [1, 2, 3, 4, 5] }],
  },
  graphics: {
    title: 'Graphics Cards',
    subtitle: 'Graphics cards for gaming, creative work and more.',
    groups: [{ title: 'GRAPHICS CARDS', slots: [1, 2, 3, 4, 5, 6] }],
  },
};

function ProductSlot({ number, category }) {
  return (
    <article className="empty-product">
      <div className="empty-product-visual" aria-hidden="true">{category === 'memory' ? '▥' : category === 'cpu' ? '◉' : '▰'}</div>
      <span className="empty-product-label">PRODUCT SLOT {String(number).padStart(2, '0')}</span>
      <h3>Product details coming soon</h3>
      <p>This space is ready for a product.</p>
    </article>
  );
}

function FeaturedCpu() {
  return (
    <a className="cpu-featured-card" href="/cpu/amd-ryzen-7-9850x3d">
      <div className="cpu-featured-visual" aria-hidden="true">◉</div>
      <span className="empty-product-label">AMD RYZEN 9000 SERIES</span>
      <h3>AMD Ryzen 7 9850X3D</h3>
      <p>8 Core / 16 Thread · AM5 · 4.7 GHz</p>
      <strong>$949.00 <small>Extreme PC reference price</small></strong>
      <span className="cpu-featured-link">View product details →</span>
    </a>
  );
}

export default function CategoryPage({ category }) {
  const content = categoryContent[category];

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
      <main className="catalog-wrap">
        <p className="crumb"><a href="/">Home</a> / {content.title}</p>
        <div className="catalog-heading">
          <div className="eyebrow">BMD TECH COMPONENTS</div>
          <h1>{content.title}</h1>
          <p>{content.subtitle}</p>
        </div>
        {content.groups.map((group) => (
          <section className="catalog-group" key={group.title}>
            <div className="section-head"><h2>{group.title}</h2><span>{group.slots.length} product spaces</span></div>
            <div className="products">
              {category === 'cpu' && <FeaturedCpu />}
              {group.slots.map((number) => <ProductSlot key={number} number={number} category={category} />)}
            </div>
          </section>
        ))}
        <a className="catalog-back" href="/">← Back to home</a>
      </main>
      <footer className="footer"><div className="wrap"><div><div className="brand">BMD <b>TECH</b></div><p>Hardware for people who make things happen.</p><p>© 2026 BMD TECH. All prices in NZD.</p></div></div></footer>
    </>
  );
}
