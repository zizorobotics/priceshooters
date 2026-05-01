import { categories } from '../data/siteData';

function CategoryBar() {
  return (
    <section className="border-y border-gray-200 bg-white">
      <div className="section-shell py-6">
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className="rounded-full border border-gray-300 bg-softGray px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-brandRed hover:bg-red-50 hover:text-brandRed"
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CategoryBar;
