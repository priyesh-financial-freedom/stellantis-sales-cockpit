"use client";

import CockpitNavigation from "../../components/CockpitNavigation";

export default function PricesPage() {
  return (
    <main className="cockpit pricesPage">
      <header className="header">
        <div>
          <div className="eyebrow">STELLANTIS INDIA · PRODUCT INTELLIGENCE</div>
          <h1>Prices</h1>
          <p className="subtitle">Vehicle pricing and variant analysis</p>
        </div>
        <div className="dataFreshness">Pricing data not yet uploaded</div>
      </header>

      <CockpitNavigation active="/prices" />

      <section className="pricesEmptyState" aria-labelledby="prices-upload-heading">
        <div className="pricesEmptyIcon" aria-hidden="true">₹</div>
        <h2 id="prices-upload-heading">Your pricing workspace is ready</h2>
        <p>
          Upload the pricing file to configure this page around the actual data.
          Model, variant, price type, geography, effective date and comparison
          filters will be added where the uploaded file supports them.
        </p>
        <p className="pricesUploadNote">
          No pricing values or assumptions have been added yet.
        </p>
      </section>
    </main>
  );
}
