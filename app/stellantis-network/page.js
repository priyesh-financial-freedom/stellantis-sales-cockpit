import { gunzipSync } from "node:zlib";
import { STELLANTIS_NETWORK_GZIP_BASE64 } from "../../lib/stellantisNetworkDataGzip";
import StellantisNetworkTable from "../../components/StellantisNetworkTable";

export const metadata = {
  title: "Stellantis Network | Stellantis Sales Cockpit",
  description: "Dealer and touchpoint register from the STLA Dealer File dated 10 October 2026.",
};

export default function StellantisNetworkPage() {
  const source = JSON.parse(gunzipSync(Buffer.from(STELLANTIS_NETWORK_GZIP_BASE64, "base64")).toString("utf8"));
  const totalIndex = source.rows.findIndex(row =>
    row.slice(0, 10).every(value => value === null || value === "") &&
    row.slice(10).some(value => value !== null && value !== "")
  );
  const sourceTotals = totalIndex >= 0 ? source.rows[totalIndex] : null;
  const records = totalIndex >= 0 ? source.rows.filter((_, index) => index !== totalIndex) : source.rows;

  return (
    <StellantisNetworkTable
      columns={source.columns}
      records={records}
      sourceTotals={sourceTotals}
      sourceFile={source.sourceFile}
    />
  );
}
