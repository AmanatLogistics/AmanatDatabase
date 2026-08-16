import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div className="space-y-2">
        <p className="text-muted-foreground tabular text-sm">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          We could not find that record
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          The order, client or purchase you are looking for does not exist — it
          may have been removed, or the link may be wrong.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/orders">Browse orders</Link>
        </Button>
      </div>
    </div>
  );
}
