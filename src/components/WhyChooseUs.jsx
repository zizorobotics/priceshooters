import { reasons } from '../data/siteData';

function WhyChooseUs() {
  return (
    <section id="sell-device" className="bg-white">
      <div className="section-shell">
        <h2 className="section-title">Why choose The Phone Shop</h2>
        <p className="section-subtitle">A trusted independent team offering clear advice, fair pricing and quality service.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {reasons.map((reason) => (
            <div key={reason} className="rounded-lg border border-gray-200 p-5 text-center shadow-sm">
              <p className="text-sm font-semibold text-brandBlack">{reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhyChooseUs;
