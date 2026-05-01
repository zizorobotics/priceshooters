function Contact() {
  return (
    <section id="contact" className="bg-softGray">
      <div className="section-shell">
        <h2 className="section-title">Visit or contact us</h2>
        <p className="section-subtitle">We are here six days a week for repairs, upgrades, trade-ins and advice.</p>

        <div className="mt-10 grid gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-card sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Address</p>
            <p className="mt-1 text-base font-semibold text-brandBlack">Sheffield, UK</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Phone</p>
            <p className="mt-1 text-base font-semibold text-brandBlack">07XXX XXXXXX</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Email</p>
            <p className="mt-1 text-base font-semibold text-brandBlack">info@thephoneshop.co.uk</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Opening hours</p>
            <p className="mt-1 text-base font-semibold text-brandBlack">Mon-Sat, 10am-6pm</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Contact;
