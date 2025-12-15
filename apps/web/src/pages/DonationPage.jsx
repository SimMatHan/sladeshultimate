import { useEffect, useState } from "react";
import Card from "../components/Card";
import Page from "../components/Page";
import { getDonors } from "../services/donorService";

const MOBILEPAY_URL = "https://qr.mobilepay.dk/box/f921fbf7-b760-4f56-b911-9279fb3240e4/pay-in";

export default function DonationPage() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const donorList = getDonors();
      setDonors(donorList);
    } catch (error) {
      console.error('[DonationPage] Failed to load donors', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <Page title="Støt Sladesh">
      <div className="space-y-6">
        <Card className="px-5 py-6 space-y-4">
          <div className="space-y-2">
            <div
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: 'var(--muted)' }}
            >
              Støt Sladesh
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              Tak fordi du overvejer at støtte
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Sladesh er et hobbyprojekt bygget for sjov og fællesskab. Hvis du har glæde af appen, betyder en frivillig MobilePay-donation alverden for at holde udviklingen kørende.
            </p>
          </div>

          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--subtle)' }}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
              Dine bidrag går direkte til drift, kaffe og små forbedringer, så Sladesh kan blive ved med at være hyggeligt at bruge.
            </p>
          </div>

          <a href={MOBILEPAY_URL} target="_blank" rel="noreferrer" className="block">
            <button
              type="button"
              className="w-full inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft transition hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              Donér via MobilePay
            </button>
          </a>
        </Card>

        {/* Top Donors Section */}
        <Card className="px-5 py-6 space-y-4">
          <div className="space-y-2">
            <div
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: 'var(--muted)' }}
            >
              Top Donerer
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Tak til alle der har støttet Sladesh! 🙏
            </p>
          </div>

          {loading ? (
            <div className="text-center py-4 text-sm" style={{ color: 'var(--muted)' }}>
              Indlæser...
            </div>
          ) : donors.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-6 text-center" style={{ borderColor: 'var(--line)' }}>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Ingen donorer endnu. Vær den første til at støtte! 💚
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {donors.map((donor) => (
                <div
                  key={donor.id}
                  className="rounded-2xl border px-4 py-3 space-y-2"
                  style={{ borderColor: 'var(--line)', backgroundColor: 'var(--subtle)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {donor.name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {formatDate(donor.date)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold shrink-0" style={{ color: 'var(--brand)' }}>
                      {formatAmount(donor.amount)}
                    </div>
                  </div>
                  {donor.message && (
                    <div
                      className="text-xs leading-relaxed italic pt-1 border-t"
                      style={{ color: 'var(--muted)', borderColor: 'var(--line)' }}
                    >
                      "{donor.message}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
