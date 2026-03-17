import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Building2, DoorOpen, CircleDollarSign, UserPlus, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step schemas ──────────────────────────────────────────────────────────────

const step1Schema = z.object({
  name: z.string().min(1, "Association name is required"),
  associationType: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required").default("United States"),
});

const step2Schema = z.object({
  buildingName: z.string().min(1, "Building name is required"),
  buildingAddress: z.string().min(1, "Building address is required"),
  unitCount: z.coerce.number().int().min(1, "At least 1 unit is required").max(999),
  unitPrefix: z.string().optional(),
});

const step3Schema = z.object({
  feeName: z.string().min(1, "Fee name is required").default("Monthly HOA Dues"),
  feeAmount: z.coerce.number().positive("Amount must be greater than 0"),
  feeFrequency: z.enum(["monthly", "quarterly", "annually", "one-time"]).default("monthly"),
});

const step4Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  role: z.string().min(1, "Role is required"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;

const STEPS = [
  { label: "Association", icon: Building2 },
  { label: "Units", icon: DoorOpen },
  { label: "HOA Fee", icon: CircleDollarSign },
  { label: "Board Member", icon: UserPlus },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex items-center gap-1">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/20 text-primary ring-2 ring-primary",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            <span
              className={cn(
                "text-xs hidden sm:inline",
                active ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Association ───────────────────────────────────────────────────────

function Step1({
  onComplete,
}: {
  onComplete: (data: Step1Data & { id: string }) => void;
}) {
  const { toast } = useToast();
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { country: "United States" },
  });

  const createMutation = useMutation({
    mutationFn: (data: Step1Data) =>
      apiRequest("POST", "/api/associations", data).then((r) => r.json()),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations"] });
      onComplete({ ...form.getValues(), id: created.id });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Create your association</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the legal name and address of the association. You can update these later.
          </p>
        </div>

        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Association name</FormLabel>
            <FormControl><Input placeholder="Maple Heights Condo Association" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="associationType" render={({ field }) => (
          <FormItem>
            <FormLabel>Type <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="condo">Condominium</SelectItem>
                <SelectItem value="hoa">HOA</SelectItem>
                <SelectItem value="co-op">Co-op</SelectItem>
                <SelectItem value="townhome">Townhome Community</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Street address</FormLabel>
              <FormControl><Input placeholder="123 Main Street" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input placeholder="Springfield" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="state" render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <FormControl><Input placeholder="IL" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create Association"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Form>
  );
}

// ── Step 2: Building + Units ──────────────────────────────────────────────────

function Step2({
  associationId,
  associationAddress,
  onComplete,
  onSkip,
}: {
  associationId: string;
  associationAddress: string;
  onComplete: (buildingId: string, unitCount: number) => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { buildingName: "Main Building", buildingAddress: associationAddress, unitPrefix: "" },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: Step2Data) => {
      // Create building
      const building = await apiRequest("POST", "/api/buildings", {
        associationId,
        name: data.buildingName,
        address: data.buildingAddress,
        totalUnits: data.unitCount,
      }).then((r) => r.json());

      // Create units in parallel batches
      const prefix = data.unitPrefix?.trim() ?? "";
      const digits = data.unitCount.toString().length;
      const unitPromises = Array.from({ length: data.unitCount }, (_, i) => {
        const num = String(i + 1).padStart(digits, "0");
        return apiRequest("POST", "/api/units", {
          associationId,
          buildingId: building.id,
          unitNumber: `${prefix}${num}`,
        });
      });
      await Promise.all(unitPromises);

      return { buildingId: building.id };
    },
    onSuccess: ({ buildingId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buildings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onComplete(buildingId, form.getValues("unitCount"));
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => setupMutation.mutate(d))} className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Add your building and units</h3>
          <p className="text-sm text-muted-foreground mt-1">
            We'll create the building and generate all unit records automatically.
            You can add more buildings and edit unit details afterward.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="buildingName" render={({ field }) => (
            <FormItem>
              <FormLabel>Building name</FormLabel>
              <FormControl><Input placeholder="Main Building" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="buildingAddress" render={({ field }) => (
            <FormItem>
              <FormLabel>Building address</FormLabel>
              <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="unitCount" render={({ field }) => (
            <FormItem>
              <FormLabel>Number of units</FormLabel>
              <FormControl><Input type="number" min={1} max={999} placeholder="24" {...field} /></FormControl>
              <FormDescription>We'll number them 01, 02, 03…</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="unitPrefix" render={({ field }) => (
            <FormItem>
              <FormLabel>Unit prefix <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl><Input placeholder="e.g. Unit or #" {...field} /></FormControl>
              <FormDescription>e.g. "Unit 01", "#01"</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={setupMutation.isPending}>
            {setupMutation.isPending ? "Creating units…" : "Create Building & Units"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ── Step 3: HOA Fee ───────────────────────────────────────────────────────────

function Step3({
  associationId,
  onComplete,
  onSkip,
}: {
  associationId: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: { feeName: "Monthly HOA Dues", feeFrequency: "monthly" },
  });

  const createMutation = useMutation({
    mutationFn: (data: Step3Data) =>
      apiRequest("POST", "/api/financial/fee-schedules", {
        associationId,
        name: data.feeName,
        amount: data.feeAmount,
        frequency: data.feeFrequency,
        startDate: new Date().toISOString(),
        graceDays: 0,
        isActive: 1,
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/fee-schedules"] });
      onComplete();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Set up your HOA fee</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create the primary recurring fee owners will be charged.
            You can add late fees, special assessments, and more from the Finance section.
          </p>
        </div>

        <FormField control={form.control} name="feeName" render={({ field }) => (
          <FormItem>
            <FormLabel>Fee name</FormLabel>
            <FormControl><Input placeholder="Monthly HOA Dues" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="feeAmount" render={({ field }) => (
            <FormItem>
              <FormLabel>Amount ($)</FormLabel>
              <FormControl><Input type="number" min={0} step={0.01} placeholder="350.00" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="feeFrequency" render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create Fee Schedule"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ── Step 4: Board Member ──────────────────────────────────────────────────────

function Step4({
  associationId,
  onComplete,
  onSkip,
}: {
  associationId: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: { role: "president" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Step4Data) => {
      // Create person
      const person = await apiRequest("POST", "/api/persons", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      }).then((r) => r.json());

      // Create board role
      const boardRole = await apiRequest("POST", "/api/board-roles", {
        personId: person.id,
        associationId,
        role: data.role,
        startDate: new Date().toISOString(),
      }).then((r) => r.json());

      return boardRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/board-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onComplete();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Add your first board member</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add at least one board member to complete the setup.
            You can invite them to the portal and add more members from the Board section.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem>
              <FormLabel>First name</FormLabel>
              <FormControl><Input placeholder="Jane" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem>
              <FormLabel>Last name</FormLabel>
              <FormControl><Input placeholder="Smith" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="role" render={({ field }) => (
          <FormItem>
            <FormLabel>Board role</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="president">President</SelectItem>
                <SelectItem value="vice-president">Vice President</SelectItem>
                <SelectItem value="treasurer">Treasurer</SelectItem>
                <SelectItem value="secretary">Secretary</SelectItem>
                <SelectItem value="board-member">Board Member</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding…" : "Add Board Member"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ── Complete screen ───────────────────────────────────────────────────────────

function StepComplete({
  associationName,
  onClose,
}: {
  associationName: string;
  onClose: () => void;
}) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold">{associationName} is ready</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your association is set up. You can now manage units, owners, financials, governance, and operations from the sidebar.
        </p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 text-left text-sm space-y-2">
        <p className="font-medium text-sm">What to do next:</p>
        <ul className="text-muted-foreground space-y-1 list-disc list-inside">
          <li>Assign owners to units in <strong>Buildings & Units</strong></li>
          <li>Configure late fee rules in <strong>Finance → Late Fees</strong></li>
          <li>Schedule your first board meeting in <strong>Governance → Meetings</strong></li>
          <li>Upload your governing documents in <strong>Documents</strong></li>
        </ul>
      </div>
      <Button className="w-full" onClick={onClose}>
        Start Managing
      </Button>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function SetupWizard({
  open,
  onOpenChange,
  onAssociationCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssociationCreated?: (id: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [createdAssociation, setCreatedAssociation] = useState<{ id: string; name: string; address: string } | null>(null);

  const handleAssociationCreated = (data: Step1Data & { id: string }) => {
    setCreatedAssociation({ id: data.id, name: data.name, address: data.address });
    onAssociationCreated?.(data.id);
    setStep(1);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setStep(0);
      setCreatedAssociation(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Association Setup Wizard</DialogTitle>
          <DialogDescription>
            Get your association fully configured in a few minutes.
          </DialogDescription>
        </DialogHeader>

        {step < 4 && <StepIndicator current={step} />}

        {step === 0 && (
          <Step1 onComplete={handleAssociationCreated} />
        )}

        {step === 1 && createdAssociation && (
          <Step2
            associationId={createdAssociation.id}
            associationAddress={createdAssociation.address}
            onComplete={() => setStep(2)}
            onSkip={() => setStep(2)}
          />
        )}

        {step === 2 && createdAssociation && (
          <Step3
            associationId={createdAssociation.id}
            onComplete={() => setStep(3)}
            onSkip={() => setStep(3)}
          />
        )}

        {step === 3 && createdAssociation && (
          <Step4
            associationId={createdAssociation.id}
            onComplete={() => setStep(4)}
            onSkip={() => setStep(4)}
          />
        )}

        {step === 4 && createdAssociation && (
          <StepComplete
            associationName={createdAssociation.name}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
