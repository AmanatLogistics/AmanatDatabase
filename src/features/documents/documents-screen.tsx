"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ExternalLinkIcon,
  FileTextIcon,
  PrinterIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  StickyNoteIcon,
  TagIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import {
  CountTabs,
  ResetFiltersButton,
  SearchInput,
} from "@/components/shared/filter-bar";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { useClientLookup, useDocuments } from "@/lib/api";
import { DOCUMENT_KIND_LABEL, DOCUMENT_KIND_TONE } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { BusinessDocument, DocumentKind } from "@/lib/types";

const KIND_ICON: Record<DocumentKind, React.ComponentType<{ className?: string }>> = {
  invoice: FileTextIcon,
  quotation: ScrollTextIcon,
  receipt: ReceiptTextIcon,
  packing_list: StickyNoteIcon,
  shipping_label: TagIcon,
};

interface DocRow {
  doc: BusinessDocument;
  clientName: string;
}

export function DocumentsScreen() {
  const documents = useDocuments();
  const clientOf = useClientLookup();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const rows = React.useMemo<DocRow[]>(
    () =>
      documents.map((doc) => ({
        doc,
        clientName: clientOf(doc.clientId)?.name ?? "—",
      })),
    [documents, clientOf],
  );

  const chips = React.useMemo(
    () => [
      { value: "all", label: "All", count: rows.length },
      ...(Object.keys(DOCUMENT_KIND_LABEL) as DocumentKind[]).map((kind) => ({
        value: kind,
        label: DOCUMENT_KIND_LABEL[kind],
        count: rows.filter((r) => r.doc.kind === kind).length,
      })),
    ],
    [rows],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ doc, clientName }) => {
      if (tab !== "all" && doc.kind !== tab) return false;
      if (query) {
        if (!`${doc.number} ${clientName}`.toLowerCase().includes(query))
          return false;
      }
      return true;
    });
  }, [rows, tab, search]);

  const columns = React.useMemo<ColumnDef<DocRow, unknown>[]>(
    () => [
      {
        id: "number",
        meta: "Number",
        accessorFn: (row) => row.doc.number,
        header: "Document",
        cell: ({ row }) => {
          const { doc } = row.original;
          const Icon = KIND_ICON[doc.kind];
          return (
            <div className="flex items-center gap-2.5">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" />
              </span>
              <span className="tabular text-[13px] font-medium">
                {doc.number}
              </span>
            </div>
          );
        },
      },
      {
        id: "kind",
        meta: "Type",
        accessorFn: (row) => row.doc.kind,
        header: "Type",
        cell: ({ row }) => {
          const { kind } = row.original.doc;
          return (
            <Badge variant={DOCUMENT_KIND_TONE[kind]}>
              {DOCUMENT_KIND_LABEL[kind]}
            </Badge>
          );
        },
      },
      {
        id: "client",
        meta: "Client",
        accessorFn: (row) => row.clientName,
        header: "Client",
        cell: ({ row }) => (
          <Link
            href={`/clients/${row.original.doc.clientId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[13px] hover:underline"
          >
            {row.original.clientName}
          </Link>
        ),
      },
      {
        id: "amount",
        meta: "Amount (AFN)",
        accessorFn: (row) => row.doc.totalAfn,
        header: "Amount (AFN)",
        cell: ({ row }) => {
          const { doc } = row.original;
          if (doc.kind === "shipping_label") {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          return <Money value={doc.totalAfn} className="text-[13px]" />;
        },
      },
      {
        id: "issuedAt",
        meta: "Issued",
        accessorFn: (row) => row.doc.issuedAt,
        header: "Issued",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-[13px]">
            {formatDate(row.original.doc.issuedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="outline" size="xs" asChild>
              <Link href={row.original.doc.href} target="_blank">
                <PrinterIcon />
                Open
                <ExternalLinkIcon className="size-3" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Documents"
        description="Generated on demand from live order data. Opening one renders a print-ready A4 sheet in a new tab."
        meta={
          <span className="text-muted-foreground text-sm">
            {rows.length} documents
          </span>
        }
      />

      <CountTabs value={tab} onChange={setTab} chips={chips} />

      <DataTable
        columns={columns}
        data={filtered}
        entityName="documents"
        exportFileName="amanat-documents"
        numericColumns={["amount"]}
        initialSorting={[{ id: "issuedAt", desc: true }]}
        emptyIcon={FileTextIcon}
        emptyTitle="No documents match these filters"
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search document number or client…"
              className="w-full sm:w-72"
            />
            <ResetFiltersButton
              show={search !== ""}
              onReset={() => setSearch("")}
            />
          </>
        }
      />
    </>
  );
}
