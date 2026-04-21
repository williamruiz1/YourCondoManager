import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, MapPin, CheckCircle2, ChevronRight, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAssociationContext } from "@/context/association-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const formSchema = z.object({
  name: z.string().min(1, "Association name is required"),
  associationType: z.string().min(1, "Association type is required"),
  dateFormed: z.string().optional().or(z.literal("")),
  ein: z.string().trim().regex(/^\d{2}-\d{7}$/, "Use format XX-XXXXXXX").optional().or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  { label: "Details", icon: Building2 },
  { label: "Location", icon: MapPin },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/20 text-primary ring-2 ring-primary",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-sm",
                active ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STEP1_FIELDS: (keyof FormValues)[] = ["name", "associationType"];
const ASSOCIATION_TYPES = ["HOA", "Condo", "Co-op", "Townhome", "Mixed-Use"];

export default function NewAssociationPage() {
  useDocumentTitle("New Association");
  const [, navigate] = useLocation();
  const { setActiveAssociationId } = useAssociationContext();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      associationType: "",
      dateFormed: "",
      ein: "",
      address: "",
      city: "",
      state: "",
      country: "USA",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = { ...data };
      if (!payload.dateFormed) delete (payload as Record<string, unknown>).dateFormed;
      if (!payload.ein) delete (payload as Record<string, unknown>).ein;
      const res = await apiRequest("POST", "/api/associations", payload);
      return res.json() as Promise<{ id: string; name: string }>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations"] });
      setActiveAssociationId(created.id);
      toast({ title: `${created.name} created successfully` });
      navigate("/app/association-context");
    },
  });

  async function handleNext() {
    const valid = await form.trigger(STEP1_FIELDS);
    if (valid) setStep(1);
  }

  function handleBack() {
    setStep(0);
  }

  function handleSubmit(values: FormValues) {
    createMutation.mutate(values);
  }

  const watchedName = form.watch("name");
  const watchedType = form.watch("associationType");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
        <div className="mb-6">
          <Link
            href="/app/associations"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Associations
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight font-headline">Register New Association</h1>
          <p className="text-muted-foreground mt-1 text-sm">Set up a new HOA, Condo, or Co-op in your portfolio.</p>
        </div>

        <StepIndicator current={step} />

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)}>
                {step === 0 && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Association Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Riverside Towers HOA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="associationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select association type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ASSOCIATION_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateFormed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date Formed</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ein"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EIN (Tax ID)</FormLabel>
                          <FormControl>
                            <Input placeholder="XX-XXXXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="ghost" onClick={() => navigate("/app/associations")}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleNext}>
                        Next: Location
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    {watchedName && (
                      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 mb-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{watchedName}</span>
                        {watchedType && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">{watchedType}</span>
                        )}
                      </div>
                    )}
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {createMutation.isError && (
                      <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
                    )}
                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="ghost" onClick={handleBack}>
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Back
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Creating..." : "Create Association"}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
