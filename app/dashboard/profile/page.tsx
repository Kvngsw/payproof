"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { getSeller, updateProfile, type SellerProfile } from "@/lib/api";
import {
  IconMail,
  IconPhone,
  IconCalendar,
  IconBuildingBank,
  IconUser,
  IconIdBadge2,
  IconStar,
} from "@tabler/icons-react";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  first,
  hasErrors,
  pattern,
  required,
  type FieldErrors,
} from "@/lib/form";
import { toast } from "sonner";

type ProfileLike = {
  name?: string;
  email: string;
  phone?: string;
  business_name?: string;
  bvn?: string;
  settlement?: { bankCode: string; accountNumber: string } | null;
  created_at?: string;
};

type ReservedAccount = {
  account_number?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
};

function memberSinceLabel(created?: string) {
  if (!created) return null;
  return new Date(created).toLocaleDateString("en-NG", {
    month: "short",
    year: "numeric",
  });
}

function SellerDetailsCard({
  profile,
  reserved,
  rating,
}: {
  profile: ProfileLike;
  reserved?: ReservedAccount;
  rating?: SellerProfile["rating"] | null;
}) {
  const memberSince = memberSinceLabel(profile.created_at);

  const rows = [
    {
      icon: IconStar,
      label: "Rating",
      value:
        rating && rating.count > 0
          ? `${rating.average?.toFixed(1) ?? "—"} average · ${rating.count} rating${rating.count === 1 ? "" : "s"}`
          : "No ratings yet",
    },
    { icon: IconMail, label: "Email", value: profile.email },
    ...(profile.phone
      ? [{ icon: IconPhone, label: "Phone", value: profile.phone }]
      : []),
    ...(profile.settlement?.accountNumber
      ? [
          {
            icon: IconBuildingBank,
            label: "Payout account",
            value: `${profile.settlement.accountNumber} · bank ${profile.settlement.bankCode}`,
          },
        ]
      : []),
    ...(memberSince
      ? [
          {
            icon: IconCalendar,
            label: "Member since",
            value: memberSince,
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-2xl bg-secondary p-1">
      <section className="h-full rounded-xl border border-border/60 bg-card p-6">
        <div className="border-b border-dashed border-border/60 pb-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Seller details
          </h2>
        </div>
        <dl className="grid gap-4 pt-5">
          <div className="flex items-start gap-3">
            <IconUser className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Name
              </dt>
              <dd className="pt-0.5 text-sm font-medium">
                {profile.name ?? "Not set"}
              </dd>
            </div>
          </div>
          {profile.business_name && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Business name
              </dt>
              <dd className="pt-1 text-sm font-medium">
                {profile.business_name}
              </dd>
            </div>
          )}
          {reserved?.account_number && (
            <div className="flex items-start gap-3">
              <IconIdBadge2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Reserved account (buyers pay in)
                </dt>
                <dd className="pt-0.5 break-all text-sm font-medium">
                  {reserved.account_name} · {reserved.account_number} ·{" "}
                  {reserved.bank_name}
                </dd>
              </div>
            </div>
          )}
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <row.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="pt-0.5 break-all text-sm font-medium">
                  {row.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function ProfileSetupCard({ profile }: { profile: ProfileLike }) {
  const { refresh } = useDashboardSession();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function clearError(key: string) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const business_name = String(form.get("business_name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const bvn = String(form.get("bvn") ?? "").trim();
    const bankCode = String(form.get("bank_code") ?? "").trim();
    const accountNumber = String(form.get("account_number") ?? "").trim();

    const nextErrors: FieldErrors = {
      name: first(
        required(name, "Name"),
        pattern(name, /^.{2,}$/, "Name must be at least 2 characters"),
      ),
      business_name: required(business_name, "Business name"),
      phone: required(phone, "Phone number"),
      bvn: first(
        required(bvn, "BVN"),
        pattern(bvn, /^\d{11}$/, "BVN must be exactly 11 digits"),
      ),
      bank_code: first(
        required(bankCode, "Bank code"),
        pattern(bankCode, /^\d+$/, "Bank code must be digits"),
      ),
      account_number: first(
        required(accountNumber, "Account number"),
        pattern(accountNumber, /^\d{10}$/, "Account number must be exactly 10 digits"),
      ),
    };
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setBusy(true);
    try {
      await updateProfile({
        name,
        business_name,
        phone,
        bvn,
        settlement: { bankCode, accountNumber },
      });
      refresh();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your profile",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-secondary p-1">
      <section className="rounded-xl border border-border/60 bg-card p-6">
        <div className="border-b border-dashed border-border/60 pb-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Edit profile
          </h2>
        </div>
        <p className="pt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
          Your name and business name show on invoices; the business name also
          names your reserved account where buyers pay in. BVN and settlement
          details tell us where payouts land.
        </p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pt-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="setup-name">Name</FieldLabel>
              <Input
                id="setup-name"
                name="name"
                autoComplete="name"
                placeholder="Ada Obi"
                defaultValue={profile.name ?? ""}
                required
                aria-invalid={errors.name ? true : undefined}
                onChange={() => clearError("name")}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-business">Business name</FieldLabel>
              <Input
                id="setup-business"
                name="business_name"
                autoComplete="organization"
                placeholder="Ada's Kicks"
                defaultValue={profile.business_name ?? ""}
                required
                aria-invalid={errors.business_name ? true : undefined}
                onChange={() => clearError("business_name")}
              />
              <FieldError>{errors.business_name}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-phone">Phone number</FieldLabel>
              <Input
                id="setup-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+234 800 000 0000"
                defaultValue={profile.phone ?? ""}
                required
                aria-invalid={errors.phone ? true : undefined}
                onChange={() => clearError("phone")}
              />
              <FieldError>{errors.phone}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-bvn">BVN</FieldLabel>
              <Input
                id="setup-bvn"
                name="bvn"
                inputMode="numeric"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                placeholder="11-digit bank verification number"
                pattern="\d{11}"
                maxLength={11}
                defaultValue={profile.bvn ?? ""}
                required
                aria-invalid={errors.bvn ? true : undefined}
                onChange={() => clearError("bvn")}
              />
              <FieldError>{errors.bvn}</FieldError>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                Used to verify your payout account. Never shown again after
                saving.
              </p>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="setup-bank-code">Bank code</FieldLabel>
                <Input
                  id="setup-bank-code"
                  name="bank_code"
                  inputMode="numeric"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="e.g. 035"
                  maxLength={10}
                  defaultValue={profile.settlement?.bankCode ?? ""}
                  required
                  aria-invalid={errors.bank_code ? true : undefined}
                  onChange={() => clearError("bank_code")}
                />
                <FieldError>{errors.bank_code}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="setup-account">Account number</FieldLabel>
                <Input
                  id="setup-account"
                  name="account_number"
                  inputMode="numeric"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="10-digit account number"
                  pattern="\d{10}"
                  maxLength={10}
                  defaultValue={profile.settlement?.accountNumber ?? ""}
                  required
                  aria-invalid={errors.account_number ? true : undefined}
                  onChange={() => clearError("account_number")}
                />
                <FieldError>{errors.account_number}</FieldError>
              </Field>
            </div>
          </FieldGroup>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </section>
    </div>
  );
}

function BuyerProfileCard({ profile }: { profile: ProfileLike }) {
  const { refresh } = useDashboardSession();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const memberSince = memberSinceLabel(profile.created_at);

  function clearError(key: string) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();

    const nextErrors: FieldErrors = {
      name: first(
        required(name, "Name"),
        pattern(name, /^.{2,}$/, "Name must be at least 2 characters"),
      ),
      phone: first(
        required(phone, "Phone number"),
        pattern(phone, /^\+?[\d\s-]{10,}$/, "Enter a valid phone number"),
      ),
    };
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setBusy(true);
    try {
      await updateProfile({ name, phone });
      refresh();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your profile",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-secondary p-1">
      <section className="rounded-xl border border-border/60 bg-card p-6">
        <div className="border-b border-dashed border-border/60 pb-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Your profile
          </h2>
        </div>

        <dl className="grid gap-4 pt-5">
          <div className="flex items-start gap-3">
            <IconMail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="pt-0.5 break-all text-sm font-medium">
                {profile.email}
              </dd>
            </div>
          </div>
          {memberSince && (
            <div className="flex items-start gap-3">
              <IconCalendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Member since
                </dt>
                <dd className="pt-0.5 text-sm font-medium">{memberSince}</dd>
              </div>
            </div>
          )}
        </dl>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pt-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="buyer-name">Name</FieldLabel>
              <Input
                id="buyer-name"
                name="name"
                autoComplete="name"
                placeholder="Hauwa Bello"
                defaultValue={profile.name ?? ""}
                required
                aria-invalid={errors.name ? true : undefined}
                onChange={() => clearError("name")}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="buyer-phone">Phone number</FieldLabel>
              <Input
                id="buyer-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+234 800 000 0000"
                defaultValue={profile.phone ?? ""}
                required
                aria-invalid={errors.phone ? true : undefined}
                onChange={() => clearError("phone")}
              />
              <FieldError>{errors.phone}</FieldError>
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  const session = useDashboardSession();
  const [rating, setRating] = useState<SellerProfile["rating"] | null>(null);
  const sellerId =
    session.status === "authed" && session.data.role === "seller"
      ? session.data.profile.id
      : null;

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    getSeller(sellerId)
      .then((seller) => {
        if (!cancelled) setRating(seller.rating);
      })
      .catch(() => {
        /* rating is a nice-to-have — profile still renders without it */
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  if (session.status === "loading") {
    return (
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-10 w-48 rounded-lg bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-96 rounded-xl border border-border/60 bg-muted/40" />
          <div className="h-64 rounded-xl border border-border/60 bg-muted/40" />
        </div>
      </div>
    );
  }

  if (session.status !== "authed") {
    return null;
  }

  const { profile, reserved_account } = session.data;
  const isBuyer = session.data.role === "buyer";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          {isBuyer
            ? "Your name and contact details."
            : "Business details, BVN and payout account."}
        </p>
      </header>

      {isBuyer ? (
        <div className="max-w-xl">
          <BuyerProfileCard profile={profile} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <ProfileSetupCard profile={profile} />
          <SellerDetailsCard
            profile={profile}
            reserved={reserved_account}
            rating={rating}
          />
        </div>
      )}
    </div>
  );
}
