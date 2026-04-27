import { navLinks, services } from '../data/siteData';

function Footer() {
  return (
    <footer className="bg-brandBlack text-gray-300">
      <div className="section-shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xl font-black uppercase text-white">The Phone Shop</p>
          <p className="mt-3 text-sm text-gray-400">Buy, sell and repair phones, tablets, laptops and accessories in Sheffield.</p>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-white">Quick links</p>
          <ul className="mt-3 space-y-2 text-sm">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="transition hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-white">Services</p>
          <ul className="mt-3 space-y-2 text-sm">
            {services.slice(0, 5).map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-white">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Sheffield, UK</li>
            <li>07XXX XXXXXX</li>
            <li>info@thephoneshop.co.uk</li>
            <li>Mon-Sat, 10am-6pm</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} The Phone Shop. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
