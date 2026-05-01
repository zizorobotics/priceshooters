function Hero() {
  return (
    <section id="home" className="bg-gradient-to-b from-softGray to-white">
      <div className="section-shell py-20 sm:py-24">
        <div className="max-w-4xl">
          <p className="mb-4 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm">
            Trusted local tech specialists in Sheffield
          </p>
          <h1 className="text-4xl font-black tracking-tight text-brandBlack sm:text-5xl lg:text-6xl">
            Buy, Sell &amp; Repair Phones and Tech
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">
            Your local UK tech shop for phones, tablets, laptops, gaming accessories and professional repair services.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
            <a href="#repairs" className="primary-btn">
              Book a Repair
            </a>
            <a href="#products" className="secondary-btn">
              View Products
            </a>
            <a href="#sell-device" className="secondary-btn">
              Sell Your Device
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
