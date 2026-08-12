"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { createClient, useClients, useCompany } from "@/lib/api";
import { CONTACT_CHANNEL_LABEL } from "@/lib/constants";
import type { ClientType, ContactChannel } from "@/lib/types";

const CITIES = [
  "Kabul",
  "Herat",
  "Mazar-i-Sharif",
  "Jalalabad",
  "Kandahar",
  "Kunduz",
  "Ghazni",
  "Bamyan",
];

export function NewClientScreen() {
  const router = useRouter();
  const clients = useClients();
  const company = useCompany();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<ClientType>("individual");
  const [phone, setPhone] = React.useState("+93 ");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [city, setCity] = React.useState(CITIES[0]);
  const [address, setAddress] = React.useState("");
  const [preferredContact, setPreferredContact] =
    React.useState<ContactChannel>("whatsapp");
  const [serviceFee, setServiceFee] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const duplicate = clients.find(
    (c) => c.phone.replace(/\D/g, "") === phone.replace(/\D/g, "") && phone.replace(/\D/g, "").length > 6,
  );

  const invalid = !name.trim() || phone.replace(/\D/g, "").length < 9;

  async function handleSubmit() {
    if (invalid) return;
    setSaving(true);
    try {
      const client = await createClient({
        name: name.trim(),
        type,
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        city,
        address: address.trim() || undefined,
        preferredContact,
        serviceFeePercent: serviceFee ? Number(serviceFee) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`${client.name} added`, {
        description: `Client code ${client.code}.`,
      });
      router.push(`/clients/${client.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader description="The minimum we need is a name and a phone number." />

      <div className="max-w-3xl space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Who are they?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Full name or business name</Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ahmad Zia Rahimi"
              />
            </div>

            <div className="grid gap-2">
              <Label>Client type</Label>
              <RadioGroup
                value={type}
                onValueChange={(value) => setType(value as ClientType)}
                className="grid-cols-2 gap-3"
              >
                {(["individual", "business"] as const).map((option) => (
                  <label
                    key={option}
                    htmlFor={`type-${option}`}
                    className="hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors"
                  >
                    <RadioGroupItem value={option} id={`type-${option}`} />
                    <span className="capitalize">{option}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How do we reach them?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+93 700 45 12 88"
                className="tabular"
                aria-invalid={!!duplicate}
              />
              {duplicate && (
                <p className="text-destructive text-xs">
                  {duplicate.name} ({duplicate.code}) already uses this number.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-whatsapp">WhatsApp (optional)</Label>
              <Input
                id="client-whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Same as phone if left empty"
                className="tabular"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-email">Email (optional)</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-contact">Preferred channel</Label>
              <Select
                value={preferredContact}
                onValueChange={(v) => setPreferredContact(v as ContactChannel)}
              >
                <SelectTrigger id="client-contact" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_CHANNEL_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-city">City</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger id="client-city" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-address">Address (optional)</Label>
              <Input
                id="client-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Karte Char, Street 3, House 22"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Commercial terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="client-fee">Agreed service fee %</Label>
              <Input
                id="client-fee"
                inputMode="decimal"
                value={serviceFee}
                onChange={(e) =>
                  setServiceFee(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder={String(company.defaultServiceFeePercent)}
                className="tabular"
              />
              <p className="text-muted-foreground text-xs">
                Leave empty to use the company default of{" "}
                {company.defaultServiceFeePercent}%.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-notes">Notes</Label>
              <Textarea
                id="client-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth remembering — delivery preferences, who pays, referrals."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/clients">Cancel</Link>
          </Button>
          <Button onClick={handleSubmit} disabled={invalid || saving}>
            {saving ? "Saving…" : "Add client"}
          </Button>
        </div>
      </div>
    </>
  );
}
