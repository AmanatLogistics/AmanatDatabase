"use client";

import Link from "next/link";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { useCompany } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Toolbar + A4 sheet wrapper shared by every printable document.
 * The sheet is fixed at 210mm so what you see on screen is what comes out of
 * the printer.
 */
export function PrintShell({
  backHref,
  backLabel,
  documentTitle,
  children,
  width = "a4",
}: {
  backHref: string;
  backLabel: string;
  documentTitle: string;
  children: React.ReactNode;
  /** Labels print on a smaller sheet than invoices. */
  width?: "a4" | "label";
}) {
  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeftIcon />
            {backLabel}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {documentTitle}
          </span>
          <Button size="sm" onClick={() => window.print()}>
            <PrinterIcon />
            Print
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "print-sheet mx-auto bg-white text-neutral-900 shadow-lg print:shadow-none",
          width === "a4"
            ? "min-h-[297mm] w-full max-w-[210mm] p-[14mm]"
            : "w-full max-w-[148mm] p-[10mm]",
        )}
      >
        {children}
      </div>
    </>
  );
}

/** Letterhead used at the top of every document. */
export function PrintLetterhead({
  documentLabel,
  documentNumber,
  meta,
}: {
  documentLabel: string;
  documentNumber: string;
  meta?: Array<{ label: string; value: React.ReactNode }>;
}) {
  const company = useCompany();

  return (
    <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-6">
      <div className="flex items-start gap-3">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: "#7B1E3C" }}
        >
          <LogoMark className="size-8" />
        </span>
        <div className="leading-tight">
          <p className="text-xl font-bold tracking-tight">{company.name}</p>
          <p className="text-[11px] text-neutral-500">{company.legalName}</p>
          <div className="mt-2 space-y-0.5 text-[11px] text-neutral-600">
            <p>
              {company.addressLine1}, {company.addressLine2}
            </p>
            <p>
              {company.city}, {company.country}
            </p>
            <p>
              {company.phone} · {company.email}
            </p>
            <p>TIN {company.taxId}</p>
          </div>
        </div>
      </div>

      <div className="text-right">
        <p className="text-2xl font-bold tracking-tight text-neutral-800 uppercase">
          {documentLabel}
        </p>
        <p className="mt-0.5 font-mono text-sm text-neutral-600">
          {documentNumber}
        </p>
        {meta && (
          <dl className="mt-3 space-y-0.5 text-[11px]">
            {meta.map((row) => (
              <div key={row.label} className="flex justify-end gap-2">
                <dt className="text-neutral-500">{row.label}</dt>
                <dd className="font-medium text-neutral-800">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}

/** Footer with the configurable invoice note and terms. */
export function PrintFooter({ showTerms = true }: { showTerms?: boolean }) {
  const company = useCompany();

  return (
    <footer className="mt-10 border-t border-neutral-200 pt-5 text-[10.5px] leading-relaxed text-neutral-600">
      {showTerms && (
        <div className="mb-3">
          <p className="mb-1 font-semibold text-neutral-800">
            Terms &amp; conditions
          </p>
          <p>{company.termsAndConditions}</p>
        </div>
      )}
      <p className="text-neutral-500">{company.invoiceFooter}</p>
      <p className="mt-3 text-center text-[10px] text-neutral-400">
        {company.name} · {company.website} · {company.phone}
      </p>
    </footer>
  );
}

/** "Bill to" block. */
export function PrintParty({
  title,
  name,
  lines,
}: {
  title: string;
  name: string;
  lines: Array<string | undefined>;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
        {title}
      </p>
      <p className="text-sm font-semibold text-neutral-900">{name}</p>
      <div className="mt-0.5 space-y-0.5 text-[11px] text-neutral-600">
        {lines.filter(Boolean).map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </div>
  );
}
