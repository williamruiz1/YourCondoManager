import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AdminUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

const roleOptions = ["platform-admin", "board-admin", "manager", "viewer"] as const;

export default function AdminUsersPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<(typeof roleOptions)[number]>("viewer");
  const [newActive, setNewActive] = useState("1");
  const [roleUpdates, setRoleUpdates] = useState<Record<string, { role: string; reason: string }>>({});

  const { data: users, isLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        email: newEmail.trim(),
        role: newRole,
        isActive: Number(newActive),
      };
      if (!payload.email) {
        throw new Error("Email is required");
      }
      const res = await apiRequest("POST", "/api/admin/users", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Admin user saved" });
      setOpen(false);
      setNewEmail("");
      setNewRole("viewer");
      setNewActive("1");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role, reason }: { id: string; role: string; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role, reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sortedUsers = useMemo(() => {
    return [...(users ?? [])].sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  const handleApplyRole = (user: AdminUser) => {
    const update = roleUpdates[user.id] || { role: user.role, reason: "" };
    if (update.role === user.role) {
      toast({ title: "No role change detected", variant: "destructive" });
      return;
    }
    if (!update.reason.trim()) {
      toast({ title: "Role change reason is required", variant: "destructive" });
      return;
    }
    updateRoleMutation.mutate({ id: user.id, role: update.role, reason: update.reason.trim() });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
          <p className="text-muted-foreground">Manage admin access and roles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Admin User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Create Admin User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Email</p>
                <Input
                  placeholder="admin@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Role</p>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as (typeof roleOptions)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Active</p>
                <Select value={newActive} onValueChange={setNewActive}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createUserMutation.mutate()} disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !sortedUsers.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No admin users</h3>
              <p className="text-sm text-muted-foreground mt-1">Create at least one admin user.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Update Role</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsers.map((user) => {
                      const update = roleUpdates[user.id] || { role: user.role, reason: "" };
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {user.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={update.role}
                              onValueChange={(value) => {
                                setRoleUpdates((prev) => ({
                                  ...prev,
                                  [user.id]: { ...update, role: value },
                                }));
                              }}
                            >
                              <SelectTrigger className="w-[170px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roleOptions.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Reason for role change"
                              value={update.reason}
                              onChange={(e) => {
                                setRoleUpdates((prev) => ({
                                  ...prev,
                                  [user.id]: { ...update, reason: e.target.value },
                                }));
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleApplyRole(user)}
                              disabled={updateRoleMutation.isPending}
                            >
                              Apply
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {sortedUsers.map((user) => {
                  const update = roleUpdates[user.id] || { role: user.role, reason: "" };
                  return (
                    <div key={user.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium break-all">{user.email}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="secondary">{user.role}</Badge>
                            {user.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                          </div>
                        </div>
                      </div>
                      <Select
                        value={update.role}
                        onValueChange={(value) => {
                          setRoleUpdates((prev) => ({
                            ...prev,
                            [user.id]: { ...update, role: value },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Reason for role change"
                        value={update.reason}
                        onChange={(e) => {
                          setRoleUpdates((prev) => ({
                            ...prev,
                            [user.id]: { ...update, reason: e.target.value },
                          }));
                        }}
                      />
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() => handleApplyRole(user)}
                        disabled={updateRoleMutation.isPending}
                      >
                        Apply
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
