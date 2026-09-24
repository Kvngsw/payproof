import { Reveal } from "@/components/marketing/reveal"

const GROUPS = [
  {
    label: "Sellers lose",
    pains: [
      {
        quote: "\u201cI\u2019ve sent it, check the screenshot.\u201d",
        body: "The image is flawless. The transfer never happened. The box ships anyway, and the seller eats the loss.",
      },
      {
        quote: "\u201cThe rider is already on his way, send it now.\u201d",
        body: "Urgency is the oldest trick. Goods leave the shop against a payment that was never real.",
      },
      {
        quote: "\u201cHere\u2019s your tracking number.\u201d",
        body: "A fake waybill buys just enough time to vanish with the goods while the seller waits for a delivery that never started.",
      },
    ],
  },
  {
    label: "Buyers lose",
    pains: [
      {
        quote: "\u201cSend the dispatch fee to confirm.\u201d",
        body: "It is small, so it is easy. The rider never moves, the number goes quiet, and the fee is already gone.",
      },
      {
        quote: "\u201cPayment made. Seller gone.\u201d",
        body: "The alert hits, the chat freezes, the account gets blocked. Transfers do not reverse, and deleted chats do not testify.",
      },
    ],
  },
] as const;

export function Why() {
  return (
    <Reveal as="section" id="why" className="mt-16 py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-16 lg:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <h2 className="display-xl max-w-[15ch]">
              In the chat, everyone has proof. Nobody has money.
            </h2>
            <p className="mt-6 max-w-[40ch] leading-relaxed text-muted-foreground text-pretty">
              Bank transfers do not reverse. Screenshots do not testify. When
              a deal goes wrong, both sides swear they are the honest one, and
              nobody can prove a thing.
            </p>
            <p className="mt-5 max-w-[40ch] font-medium leading-relaxed text-pretty">
              PayProof replaces the screenshot with the only record nobody can
              edit: the bank&rsquo;s own.
            </p>
          </div>

          <div>
            {GROUPS.map((group) => (
              <div key={group.label} className="mb-10 last:mb-0">
                <h3 className="caption text-primary">{group.label}</h3>
                <ul className="mt-4">
                  {group.pains.map((pain, i) => (
                    <li
                      key={pain.quote}
                      className={[
                        "flex gap-5 py-6",
                        i === 0
                          ? "border-t border-border/60 pt-5"
                          : "border-t border-border/60",
                      ].join(" ")}
                    >
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-chart-1"
                        aria-hidden="true"
                      />
                      <div>
                        <h4 className="font-heading text-xl font-extrabold tracking-tight text-balance md:text-2xl">
                          {pain.quote}
                        </h4>
                        <p className="mt-2 max-w-[46ch] leading-relaxed text-muted-foreground text-pretty">
                          {pain.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
