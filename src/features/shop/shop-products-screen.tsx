"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, TagsIcon, Trash2Icon } from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { ImagePicker } from "@/components/shared/image-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useStores } from "@/lib/api";
import { deleteProduct, saveProduct } from "@/lib/server/catalogue";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/constants";
import type { ProductCategory, StoreProduct } from "@/lib/types";

/**
 * What we sell. Publishing is the switch between staff-only and
 * customer-visible.
 *
 * The catalogue is fetched by the page and arrives as a prop. After a save or a
 * delete the route is refreshed rather than the list patched by hand: the
 * server is the only thing that knows what is in there, and a local copy edited
 * to match is a second version of the truth waiting to disagree.
 */
export function ShopProductsScreen({
  products,
}: {
  products: StoreProduct[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<StoreProduct | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<StoreProduct | null>(null);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.description}`.toLowerCase().includes(q),
    );
  }, [products, search]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            {products.filter((p) => p.active).length} published of{" "}
            {products.length}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon />
          Add product
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products…"
        className="sm:max-w-xs"
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={TagsIcon}
            title="No products"
            description="Add something to sell and it will appear on the storefront once published."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon />
                Add product
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <Card key={product.id}>
              <CardContent className="flex gap-3 pt-6">
                <ProductThumb
                  size="md"
                  category={product.category}
                  name={product.name}
                  imageUrl={product.imageUrls[0]}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <Badge variant={product.active ? "success" : "muted"}>
                      {product.active ? "Published" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {product.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Sells for </span>
                      <Money value={product.priceAfn} className="font-medium" />
                      <span className="text-muted-foreground"> · costs us </span>
                      <Money value={product.costAfn} tone="muted" />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setEditing(product)}
                    >
                      <PencilIcon className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={async () => {
                        await saveProduct({
                          id: product.id,
                          name: product.name,
                          description: product.description,
                          category: product.category,
                          priceAfn: product.priceAfn,
                          costAfn: product.costAfn,
                          storeId: product.storeId,
                          imageUrls: product.imageUrls,
                          active: !product.active,
                        });
                        toast.success(
                          product.active
                            ? `${product.name} hidden from the storefront`
                            : `${product.name} is now on the storefront`,
                        );
                        router.refresh();
                      }}
                    >
                      {product.active ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                      onClick={() => setDeleting(product)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProductDialog
          product={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete this product?"
          subject={deleting.name}
          consequences={[
            "It disappears from the storefront and from any basket containing it",
          ]}
          confirmLabel="Delete product"
          successMessage={`${deleting.name} deleted`}
          onConfirm={async () => {
            await deleteProduct(deleting.id);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ProductDialog({
  product,
  onDone,
}: {
  product: StoreProduct | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const stores = useStores().filter((s) => s.active);

  const [name, setName] = React.useState(product?.name ?? "");
  const [description, setDescription] = React.useState(
    product?.description ?? "",
  );
  const [category, setCategory] = React.useState<ProductCategory>(
    product?.category ?? "other",
  );
  const [priceAfn, setPriceAfn] = React.useState(
    product ? String(product.priceAfn) : "",
  );
  const [costAfn, setCostAfn] = React.useState(
    product ? String(product.costAfn) : "",
  );
  const [storeId, setStoreId] = React.useState(
    product?.storeId ?? stores[0]?.id ?? "",
  );
  const [imageUrls, setImageUrls] = React.useState<string[]>(
    product?.imageUrls ?? [],
  );
  const [active, setActive] = React.useState(product?.active ?? true);
  const [saving, setSaving] = React.useState(false);

  const price = Number(priceAfn) || 0;
  const cost = Number(costAfn) || 0;
  const invalid = !name.trim() || price <= 0 || !storeId;

  async function handleSave() {
    if (invalid) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        priceAfn: price,
        costAfn: cost,
        storeId,
        imageUrls,
        active,
      };
      await saveProduct({ ...payload, id: product?.id });
      toast.success(product ? `${payload.name} updated` : `${payload.name} added`);
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the product.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            What the customer sees on the storefront, and what it costs us to
            source.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label>Photos</Label>
            <ImagePicker value={imageUrls} onChange={setImageUrls} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-name">Product name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apple AirPods Pro (2nd generation)"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What it is, and anything the customer should know before buying."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-price">Price to customer (AFN)</Label>
              <Input
                id="p-price"
                inputMode="numeric"
                value={priceAfn}
                onChange={(e) =>
                  setPriceAfn(e.target.value.replace(/[^\d]/g, ""))
                }
                className="tabular"
                placeholder="14500"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-cost">Costs us (AFN)</Label>
              <Input
                id="p-cost"
                inputMode="numeric"
                value={costAfn}
                onChange={(e) =>
                  setCostAfn(e.target.value.replace(/[^\d]/g, ""))
                }
                className="tabular"
                placeholder="12000"
              />
              <p className="text-muted-foreground text-xs">
                Never shown to a customer.
              </p>
            </div>
          </div>

          {price > 0 && cost > 0 && (
            <p className="text-muted-foreground text-xs">
              Margin on each sale:{" "}
              <Money value={price - cost} unit="suffix" tone="signed" />
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-cat">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ProductCategory)}
              >
                <SelectTrigger id="p-cat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_CATEGORY_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-store">We buy it from</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger id="p-store" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="p-active">Show on the storefront</Label>
              <p className="text-muted-foreground text-xs">
                Off keeps it here for staff only.
              </p>
            </div>
            <Switch id="p-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={invalid || saving}>
            {saving ? "Saving…" : product ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
