"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InfoIcon } from "lucide-react";

import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { placeWebOrder, useCart } from "@/lib/api";
import { useStoreHydrated } from "@/lib/hydration";

/**
 * Checkout. No payment — the customer pays on collection, which is how the
 * business already works.
 *
 * The demo notice is deliberate and must stay until a backend exists. Without
 * one this order is written to the customer's own browser and the shop never
 * sees it, so letting someone believe they had bought something would be the
 * worst failure this app could have.
 */
export function CheckoutScreen() {
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const { lines, totalAfn } = useCart();

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("+93 ");
  const [city, setCity] = React.useState("Kandahar");
  const [address, setAddress] = React.useState("");
  const [note, setNote] = React.useState("");
  const [placing, setPlacing] = React.useState(false);

  const invalid = !name.trim() || phone.replace(/\D/g, "").length < 9;

  async function handlePlace() {
    if (invalid || lines.length === 0) return;
    setPlacing(true);
    try {
      const order = await placeWebOrder({
        customerName: name,
        customerPhone: phone,
        customerCity: city,
        customerAddress: address,
        note,
      });
      router.push(`/store/thanks?ref=${order.reference}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not place your order. Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  }

  if (!hydrated) return null;

  if (lines.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm font-medium">Your basket is empty.</p>
          <Button asChild className="mt-3">
            <Link href="/store">Browse products</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Checkout</h1>

      <div
        className="border-warning/40 bg-warning/10 mb-5 flex items-start gap-2.5 rounded-lg border p-3"
        data-testid="demo-notice"
      >
        <InfoIcon className="text-warning mt-0.5 size-4 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">This shop is a demonstration.</p>
          <p className="text-muted-foreground">
            Orders placed here are saved in this browser only and do not reach
            Amanat Shopping. Please contact us directly to order for real.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-2">
              <Label htmlFor="co-name">Your name</Label>
              <Input
                id="co-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ahmad Zia Rahimi"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="co-phone">Phone number</Label>
              <Input
                id="co-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+93 700 45 12 88"
                className="tabular h-11"
                inputMode="tel"
              />
              <p className="text-muted-foreground text-xs">
                We call this number when your order arrives.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="co-city">City</Label>
                <Input
                  id="co-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="co-address">Address (optional)</Label>
                <Input
                  id="co-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="co-note">Anything we should know? (optional)</Label>
              <Textarea
                id="co-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Colour, size, or when you can collect."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold">Your order</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {lines.map(({ product, qty, lineTotalAfn }) => (
                <li key={product.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground line-clamp-1">
                    {qty} × {product.name}
                  </span>
                  <Money value={lineTotalAfn} />
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <Money value={totalAfn} unit="suffix" />
            </div>
            <Button
              className="mt-4 h-11 w-full"
              onClick={handlePlace}
              disabled={invalid || placing}
            >
              {placing ? "Placing…" : "Place order"}
            </Button>
            {invalid && (
              <p className="text-muted-foreground mt-2 text-center text-xs">
                Add your name and phone number to continue.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
