import { navLinks } from '../data/siteData';

const BrandMark = () => (
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-brandBlack bg-white shadow-sm">
      <div className="rounded-sm bg-brandRed px-2 py-1 text-[10px] font-bold tracking-wide text-white">
        THE PHONE
      </div>
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">The</p>
      <p className="text-xl font-black uppercase leading-none text-brandBlack">Phone Shop</p>
    </div>
  </div>
);

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="#home" aria-label="The Phone Shop home">
          <BrandMark />
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="text-sm font-medium text-gray-700 transition hover:text-brandRed">
              {link.label}
            </a>
          ))}
        </nav>

        <a href="#repairs" className="primary-btn text-xs sm:text-sm">
          Book Repair
        </a>
      </div>
    </header>
  );
}

export default Navbar;
