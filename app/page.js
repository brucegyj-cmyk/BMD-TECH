'use client';

import { useState } from 'react';

const products = [
  { badge: 'DDR5 DESKTOP MEMORY', icon: '▥', name: 'TeamGroup T-CREATE CLASSIC 32GB (2 × 16GB) DDR5 6000MT/s Desktop Memory', rating: '★★★★★', reviews: 0, price: '$803.85', priceNote: 'PB Tech reference price · inc GST', sourceUrl: 'https://www.pbtech.co.nz/product/MEMTGM0050/TeamGroup-T-CREATE-CLASSIC-32GB--2-X-16GB-DDR5-600' },
  { badge: 'IN STOCK', icon: '▥', name: 'Kingston FURY Beast 32GB DDR5 6000MHz Kit', rating: '★★★★★', reviews: 28, price: '$219.00' },
  { badge: 'IN STOCK', icon: '▰', name: 'ASUS Dual GeForce RTX 5070 12GB Graphics Card', rating: '★★★★★', reviews: 14, price: '$1,249.00' },
  { badge: 'HOT PRICE', icon: '◉', name: 'AMD Ryzen 7 7800X3D 8-Core AM5 Processor', rating: '★★★★★', reviews: 53, price: '$699.00' },
  { badge: 'IN STOCK', icon: '▥', name: 'Corsair Vengeance 64GB DDR5 5600MHz Kit', rating: '★★★★☆', reviews: 9, price: '$389.00' },
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState(0);
  const [added, setAdded] = useState(null);
  const shownProducts = products.filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase()));

  function search() {
    document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addToCart(index) {
    setCart((count) => count + 1);
    setAdded(index);
    window.setTimeout(() => setAdded(null), 1000);
  }

  return <>
    <div className="notice">FREE SHIPPING ON ORDERS OVER <strong>$150</strong> &nbsp; | &nbsp; NZ-BASED SUPPORT</div>
    <div className="utility"><div className="wrap">Business &amp; Education &nbsp; | &nbsp; Store Locator &nbsp; | &nbsp; Help Centre &nbsp; | &nbsp; Sign In</div></div>
    <header className="head"><div className="wrap"><div className="brand">BMD <b>TECH</b></div><label className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} aria-label="Search products" placeholder="Search parts, brands, model numbers..." /><button onClick={search}>SEARCH</button></label><div className="head-actions"><div>☎ 0800 BMD TECH<span>Mon–Fri, 9am–5pm</span></div><div className="cart">Cart <span>{cart} item{cart === 1 ? '' : 's'}</span></div></div></div></header>
    <nav className="nav"><div className="wrap"><a href="#components">☰ SHOP ALL</a><a href="/memory">MEMORY</a><a href="/graphics">GRAPHICS CARDS</a><a href="/cpu">CPU</a><a href="#deals">DEALS</a><a href="#support">BUILD A PC</a><a href="/opportunities">OPPORTUNITIES</a></div></nav>
    <main className="wrap">
      <div className="crumb">Home / Computer Components</div>
      <section className="hero"><div className="hero-copy"><div className="eyebrow">POWER UP YOUR NEXT BUILD</div><h1>Components that make your rig fly.</h1><p>Hand-picked PC hardware, sharp pricing, and people who know their silicon.</p><a className="button" href="#components">SHOP COMPONENTS →</a></div></section>
      <section id="components"><div className="section-head"><h2>Shop core components</h2><a href="#products">View all components →</a></div><div className="category-grid">
        <a className="category memory-category" id="memory" href="/memory"><span className="icon">▥</span><h3>Memory</h3><p>DDR4 &amp; DDR5 RAM for every build</p><div className="memory-classes"><span>DDR5 DESKTOP MEMORY</span><span>DDR4 DESKTOP MEMORY</span></div></a>
        <a className="category" id="graphics" href="/graphics"><span className="icon">▰</span><h3>Graphics Cards</h3><p>Gaming starts here — RTX &amp; Radeon</p></a>
        <a className="category" id="amd" href="/cpu"><span className="icon">◉</span><h3>CPU</h3><p>Processors for gaming and work</p></a>
      </div></section>
      <section className="promo" id="deals"><div><h3>⚡ Today’s component deals</h3><p>Fresh specials on the gear your build needs.</p></div><div><strong>PRICE MATCH</strong><p>Found it cheaper? Talk to our team.</p></div><div><h3>🚚 Fast NZ delivery</h3><p>Tracked delivery across Aotearoa.</p></div></section>
      <section id="products"><div className="section-head"><h2>Popular parts right now</h2><a href="#components">Browse all →</a></div><div className="products">
        {shownProducts.map((product, index) => <article className="product" key={product.name}><span className="badge">{product.badge}</span><div className="product-image">{product.icon}</div><h3>{product.name}</h3>{product.reviews > 0 && <div className="stars">{product.rating} <span>({product.reviews})</span></div>}<div className="price">{product.price} <span className="inc">{product.priceNote || 'inc GST'}</span></div>{product.sourceUrl ? <a className="product-source" href={product.sourceUrl} target="_blank" rel="noreferrer">View at PB Tech ↗</a> : <button onClick={() => addToCart(index)}>{added === index ? 'Added ✓' : 'Add to cart'}</button>}</article>)}
      </div></section>
      <section className="bar" id="support"><div>✓ Expert component advice<span>Talk to real PC builders before you buy.</span></div><div>↻ Easy 14-day returns<span>Shop with confidence on eligible products.</span></div><div>▣ Secure payment options<span>Visa, Mastercard, Afterpay &amp; bank transfer.</span></div></section>
    </main>
    <footer className="footer"><div className="wrap"><div><div className="brand">BMD <b>TECH</b></div><p>Hardware for people who make things happen.</p><p>© 2026 BMD TECH. All prices in NZD.</p></div><nav><a href="#components">Components</a><a href="#support">Support</a><a href="#deals">Delivery &amp; Returns</a><a href="#">Contact</a></nav></div></footer>
  </>;
}
