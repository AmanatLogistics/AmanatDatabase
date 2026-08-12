"use client";

import { InfoIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTeam } from "@/lib/api";
import { TEAM_ROLE_LABEL } from "@/lib/constants";
import { initials } from "@/lib/format";

export function TeamSettingsScreen() {
  const team = useTeam();

  return (
    <>
      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Read-only until sign-in exists</AlertTitle>
        <AlertDescription>
          Team members and their permissions will be editable once
          authentication is built. For now the list drives the &ldquo;recorded
          by&rdquo; names on payments, purchases and order activity.
        </AlertDescription>
      </Alert>

      <Card className="overflow-hidden py-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Team</CardTitle>
              <p className="text-muted-foreground text-xs">
                Who works in the shop and what they can do.
              </p>
            </div>
            <Button size="sm" disabled>
              Invite member
              <span className="text-muted-foreground text-[10px]">
                needs backend
              </span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-3 pb-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                        {initials(member.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{member.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === "owner" ? "brand" : "muted"}>
                      {TEAM_ROLE_LABEL[member.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular text-[13px]">
                    {member.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.active ? "success" : "muted"}>
                      {member.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
