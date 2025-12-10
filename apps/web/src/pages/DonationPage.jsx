import Card from "../components/Card";
import Page from "../components/Page";

const MOBILEPAY_URL = "https://qr.mobilepay.dk/box/f921fbf7-b760-4f56-b911-9279fb3240e4/pay-in";

export default function DonationPage() {
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

        <Card className="px-5 py-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border text-lg" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)', color: 'var(--brand)' }}>
              ❤️
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                Din støtte går en forskel
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                Hver donation hjælper med at holde servere kørende og giver tid til at bygge nye features til fællesskabet.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}
