import { useState } from 'react';

function BookingForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.reset();
  };

  return (
    <section id="repairs" className="bg-softGray">
      <div className="section-shell">
        <h2 className="section-title">Book a repair or send an enquiry</h2>
        <p className="section-subtitle">Tell us your device issue and our team will contact you quickly.</p>

        <form onSubmit={handleSubmit} className="mt-10 grid gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-card sm:grid-cols-2">
          <input required type="text" name="name" placeholder="Name" className="rounded-md border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brandRed" />
          <input required type="tel" name="phone" placeholder="Phone number" className="rounded-md border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brandRed" />
          <input required type="email" name="email" placeholder="Email" className="rounded-md border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brandRed" />
          <input required type="text" name="service" placeholder="Service needed" className="rounded-md border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brandRed" />
          <input required type="text" name="device" placeholder="Device model" className="rounded-md border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brandRed sm:col-span-2" />
          <textarea required name="message" rows="5" placeholder="Message" className="rounded-md border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brandRed sm:col-span-2" />
          <div className="sm:col-span-2">
            <button type="submit" className="primary-btn w-full sm:w-auto">
              Submit Enquiry
            </button>
          </div>
        </form>

        {submitted ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Thanks, your enquiry has been received. We&apos;ll contact you shortly.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default BookingForm;
