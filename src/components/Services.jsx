import { services } from '../data/siteData';

function Services() {
  return (
    <section id="services" className="bg-white">
      <div className="section-shell">
        <h2 className="section-title">Services built around local customers</h2>
        <p className="section-subtitle">From quick fixes to trade-ins, we keep your tech simple, reliable and affordable.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <div
              key={service}
              className="rounded-lg border border-gray-200 bg-softGray p-5 text-sm font-semibold text-gray-700 transition hover:border-brandRed hover:bg-red-50 hover:text-brandBlack"
            >
              {service}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Services;
