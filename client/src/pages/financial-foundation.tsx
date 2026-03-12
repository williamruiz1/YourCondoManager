import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Association, FinancialAccount, FinancialCategory } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveAssociation } from "@/hooks/use-active-association";

const accountSchema = z.object({
  associationId: z.string().min(1),
  name: z.string().min(1),
  accountCode: z.string().optional(),
  accountType: z.string().min(1),
});

const categorySchema = z.object({
  associationId: z.string().min(1),
  name: z.string().min(1),
  categoryType: z.string().min(1),
});

export default function FinancialFoundationPage() {
  const { toast } = useToast();
  const [openAccount, setOpenAccount] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: accounts } = useQuery<FinancialAccount[]>({ queryKey: ["/api/financial/accounts"] });
  const { data: categories } = useQuery<FinancialCategory[]>({ queryKey: ["/api/financial/categories"] });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { associationId: "", name: "", accountCode: "", accountType: "expense" },
  });

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { associationId: "", name: "", categoryType: "expense" },
  });

  useEffect(() => {
    accountForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    categoryForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [accountForm, activeAssociationId, categoryForm]);

  const createAccount = useMutation({
    mutationFn: async (values: z.infer<typeof accountSchema>) => {
      const res = await apiRequest("POST", "/api/financial/accounts", { ...values, isActive: 1 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/accounts"] });
      setOpenAccount(false);
      accountForm.reset({ associationId: activeAssociationId, name: "", accountCode: "", accountType: "expense" });
      toast({ title: "Account created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createCategory = useMutation({
    mutationFn: async (values: z.infer<typeof categorySchema>) => {
      const res = await apiRequest("POST", "/api/financial/categories", { ...values, isActive: 1 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/categories"] });
      setOpenCategory(false);
      categoryForm.reset({ associationId: activeAssociationId, name: "", categoryType: "expense" });
      toast({ title: "Category created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance Foundation</h1>
        <p className="text-muted-foreground">Configure financial accounts and categories for the current association context.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Accounts</h2>
              <Dialog open={openAccount} onOpenChange={setOpenAccount}>
                <DialogTrigger asChild><Button size="sm">Add Account</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Account</DialogTitle></DialogHeader>
                  <Form {...accountForm}>
                    <form className="space-y-4" onSubmit={accountForm.handleSubmit((v) => createAccount.mutate(v))}>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                      </div>
                      <FormField control={accountForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={accountForm.control} name="accountCode" render={({ field }) => (<FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={accountForm.control} name="accountType" render={({ field }) => (
                        <FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="expense">expense</SelectItem><SelectItem value="income">income</SelectItem><SelectItem value="asset">asset</SelectItem><SelectItem value="liability">liability</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <Button className="w-full" type="submit" disabled={createAccount.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {(accounts ?? []).map((a) => (
                  <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell>{a.accountCode || "-"}</TableCell><TableCell><Badge variant="secondary">{a.accountType}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Categories</h2>
              <Dialog open={openCategory} onOpenChange={setOpenCategory}>
                <DialogTrigger asChild><Button size="sm">Add Category</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Category</DialogTitle></DialogHeader>
                  <Form {...categoryForm}>
                    <form className="space-y-4" onSubmit={categoryForm.handleSubmit((v) => createCategory.mutate(v))}>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                      </div>
                      <FormField control={categoryForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={categoryForm.control} name="categoryType" render={({ field }) => (
                        <FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="expense">expense</SelectItem><SelectItem value="income">income</SelectItem><SelectItem value="charge">charge</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <Button className="w-full" type="submit" disabled={createCategory.isPending}>Save</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {(categories ?? []).map((c) => (
                  <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell><Badge variant="secondary">{c.categoryType}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
