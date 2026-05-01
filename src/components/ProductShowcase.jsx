import { products } from '../data/siteData';

const conditionStyles = {
  Excellent: 'bg-emerald-100 text-emerald-700',
  Good: 'bg-amber-100 text-amber-700',
  Refurbished: 'bg-blue-100 text-blue-700'
};

function ProductShowcase() {
  return (
    <section id="products" className="bg-softGray">
      <div className="section-shell">
        <h2 className="section-title">Featured tech in stock</h2>
        <p className="section-subtitle">Professionally checked devices ready for pickup, local delivery, or in-store enquiry.</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.name}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 flex h-36 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-5xl">
                <span aria-hidden>{product.category === 'Laptops' ? '💻' : product.category === 'Tablets' ? '📱' : product.category === 'Gaming' ? '🎮' : '🔌'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-brandBlack">{product.name}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${conditionStyles[product.condition]}`}>
                  {product.condition}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{product.category}</p>
              <p className="mt-4 text-2xl font-extrabold text-brandBlack">{product.price}</p>
              <button type="button" className="primary-btn mt-4 w-full">
                Enquire
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ProductShowcase;
