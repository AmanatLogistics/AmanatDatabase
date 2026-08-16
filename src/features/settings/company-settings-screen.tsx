"use client";

import * as React from "react";
import { toast } from "sonner";
import { RotateCcwIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/brand/logo";
import { resetDemoData, updateCompany, useCompany } from "@/lib/api";
import type { CompanyProfile } from "@/lib/types";

export function CompanySettingsScreen() {
  const company = useCompany();
  const [draft, setDraft] = React.useState<CompanyProfile>(company);
  const [saving, setSaving] = React.useState(false);

  // Re-seed the form whenever the stored profile changes (a save, or a reset of
  // the demo data). Adjusting during render keeps the inputs from flashing the
  // stale values for a frame.
  const [lastCompany, setLastCompany] = React.useState(company);
  if (lastCompany !== company) {
    setLastCompany(company);
    setDraft(company);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(company);

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateCompany(draft);
      toast.success("Company profile saved", {
        description: "Invoices and printed documents will use the new details.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Brand</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-5">
            <div className="brand-gradient flex size-24 items-center justify-center rounded-xl">
              <Logo showWordmark={false} className="scale-150" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">Company logo</p>
              <p className="text-muted-foreground text-xs">
                The logo is rendered as vector artwork so it stays sharp on
                screen and on printed invoices. To install the official file,
                follow{" "}
                <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
                  public/README-branding.md
                </code>
                .
              </p>
              <Button variant="outline" size="sm" className="mt-2" disabled>
                Upload logo
                <span className="text-muted-foreground text-[10px]">
                  needs backend
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Company details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Trading name"
            value={draft.name}
            onChange={(v) => set("name", v)}
          />
          <Field
            label="Legal name"
            value={draft.legalName}
            onChange={(v) => set("legalName", v)}
          />
          <Field
            label="Tagline"
            value={draft.tagline}
            onChange={(v) => set("tagline", v)}
            className="sm:col-span-2"
          />
          <Field label="Phone" value={draft.phone} onChange={(v) => set("phone", v)} />
          <Field
            label="WhatsApp"
            value={draft.whatsapp}
            onChange={(v) => set("whatsapp", v)}
          />
          <Field label="Email" value={draft.email} onChange={(v) => set("email", v)} />
          <Field
            label="Website"
            value={draft.website}
            onChange={(v) => set("website", v)}
          />
          <Field
            label="Address line 1"
            value={draft.addressLine1}
            onChange={(v) => set("addressLine1", v)}
          />
          <Field
            label="Address line 2"
            value={draft.addressLine2}
            onChange={(v) => set("addressLine2", v)}
          />
          <Field label="City" value={draft.city} onChange={(v) => set("city", v)} />
          <Field
            label="Country"
            value={draft.country}
            onChange={(v) => set("country", v)}
          />
          <Field
            label="Tax / TIN number"
            value={draft.taxId}
            onChange={(v) => set("taxId", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Commercial defaults</CardTitle>
          <p className="text-muted-foreground text-xs">
            Applied to every new order unless the client has agreed terms of
            their own.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="setting-currency">Reporting currency</Label>
            <Input id="setting-currency" value={draft.currency} disabled />
            <p className="text-muted-foreground text-xs">
              Every figure in the system — quotes, purchases and payments — is in
              Afghani.
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="setting-prefix">Invoice prefix</Label>
            <Input
              id="setting-prefix"
              value={draft.invoicePrefix}
              onChange={(e) => set("invoicePrefix", e.target.value)}
              className="tabular"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Document wording</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="setting-footer">Invoice footer</Label>
            <Textarea
              id="setting-footer"
              value={draft.invoiceFooter}
              onChange={(e) => set("invoiceFooter", e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="setting-terms">Terms &amp; conditions</Label>
            <Textarea
              id="setting-terms"
              value={draft.termsAndConditions}
              onChange={(e) => set("termsAndConditions", e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await resetDemoData();
            toast.success("Demo data restored", {
              description: "All screens are back to the seeded dataset.",
            });
          }}
        >
          <RotateCcwIcon />
          Reset demo data
        </Button>

        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setDraft(company)}>
              Discard changes
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            <SaveIcon />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <Separator />

      <p className="text-muted-foreground text-xs">
        Changes are held in memory for this session. Once the backend is
        connected they will persist through{" "}
        <code className="bg-muted rounded px-1 py-0.5">PATCH /api/settings</code>.
      </p>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
