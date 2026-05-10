// zone: Home
// persona: Manager, Platform Admin
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  MapPin,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAssociationContext } from "@/context/association-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  PmUpgradePrompt,
  hasPmUpgradePromptBeenDismissed,
} from "@/components/pm-upgrade-prompt";
import { loadGoogleMaps, hasMapsApiKey } from "@/lib/maps-loader";

// Lazy-load the building pin editor so the heavy map bundle is only fetched
// when the admin actually reaches the pin-placement step.
const BuildingPinEditor = lazy(
  () => import("@/components/building-pin-editor"),
);

// ---------- Form schema --------------------------------------------------

const formSchema = z.object({
  name: z.string().min(1, "Association name is required"),
  associationType: z.string().min(1, "Association type is required"),
  dateFormed: z.string().optional().or(z.literal("")),
  ein: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{7}$/, "Use format XX-XXXXXXX")
    .optional()
    .or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
});

type FormValues = z.infer<typeof formSchema>;

// ---------- Step definitions ---------------------------------------------

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
              {done ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </div>
            <span
              className={cn(
                "text-sm",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
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

// ---------- Places Autocomplete input ------------------------------------

type PlaceResult = {
  address: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
};

interface PlacesInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
}

function PlacesAutocompleteInput({
  value,
  onChange,
  onPlaceSelected,
}: PlacesInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasMapsApiKey || !inputRef.current) return;
    let cancelled = false;

    setLoading(true);
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !g || !inputRef.current) return;
        const ac = new g.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          fields: [
            "address_components",
            "formatted_address",
            "geometry",
          ],
        });
        autocompleteRef.current = ac;

        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.geometry?.location) return;

          const components = place.address_components ?? [];
          const get = (type: string) =>
            components.find((c) => c.types.includes(type))?.long_name ?? "";
          const getShort = (type: string) =>
            components.find((c) => c.types.includes(type))?.short_name ?? "";

          const streetNumber = get("street_number");
          const route = get("route");
          const address = streetNumber ? `${streetNumber} ${route}` : route;
          const city =
            get("locality") ||
            get("sublocality") ||
            get("administrative_area_level_2");
          const state = getShort("administrative_area_level_1");
          const country = get("country");

          onPlaceSelected({
            address,
            city,
            state,
            country,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        });

        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [onPlaceSelected]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing an address…"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

// ---------- Satellite confirmation step ----------------------------------

interface ConfirmLocationProps {
  address: string;
  lat: number;
  lng: number;
  onConfirm: () => void;
  onReject: () => void;
}

function ConfirmLocationStep({
  address,
  lat,
  lng,
  onConfirm,
  onReject,
}: ConfirmLocationProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const zoom = 18;
  const size = "600x300";

  const satelliteUrl =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=satellite` +
    `&key=${apiKey}`;

  const streetviewUrl =
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=${size}&location=${lat},${lng}&fov=90&pitch=0` +
    `&key=${apiKey}`;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <MapPin className="h-6 w-6 mx-auto mb-2 text-primary" />
        <h3 className="font-semibold text-base">Is this your community?</h3>
        <p className="text-sm text-muted-foreground mt-1">{address}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">
            Satellite
          </p>
          <img
            src={satelliteUrl}
            alt="Satellite view of address"
            className="w-full rounded-lg object-cover aspect-video border"
            loading="lazy"
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">
            Street View
          </p>
          <img
            src={streetviewUrl}
            alt="Street View of address"
            className="w-full rounded-lg object-cover aspect-video border"
            loading="lazy"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onReject}
        >
          <RefreshCcw className="h-4 w-4 mr-1.5" />
          Search again
        </Button>
        <Button type="button" className="flex-1" onClick={onConfirm}>
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Yes, this is it
        </Button>
      </div>
    </div>
  );
}

// ---------- Constants & types --------------------------------------------

const STEP1_FIELDS: (keyof FormValues)[] = ["name", "associationType"];
const ASSOCIATION_TYPES = ["HOA", "Condo", "Co-op", "Townhome", "Mixed-Use"];

type SubscriptionSummary = { status?: string; plan?: string };
type Association = { id: string; name: string };

// ---------- Main page ----------------------------------------------------

export default function NewAssociationPage() {
  useDocumentTitle("New Association");
  const [, navigate] = useLocation();
  const { setActiveAssociationId } = useAssociationContext();
  const { toast } = useToast();

  // form steps: 0 = details, 1 = location (editable), 2 = map confirm, 3 = pin editor
  const [step, setStep] = useState(0);
  const [pmUpgradeOpen, setPmUpgradeOpen] = useState(false);

  // Coordinates captured after address confirmation
  const [pendingCoords, setPendingCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  // Coordinates confirmed by the admin ("Yes, this is it")
  const [confirmedCoords, setConfirmedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  // Full formatted address string for the confirmation view
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  // Id of the created association (needed for pin editor)
  const [createdAssociationId, setCreatedAssociationId] = useState<
    string | null
  >(null);

  // 4.4 Q6 Wave 13 — PM-upgrade prompt gate
  const { data: existingAssociations } = useQuery<Association[]>({
    queryKey: ["/api/associations"],
    staleTime: 60 * 1000,
  });
  const { data: subscription } = useQuery<SubscriptionSummary>({
    queryKey: ["/api/admin/billing/subscription"],
    staleTime: 5 * 60 * 1000,
  });

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
    mutationFn: async (
      data: FormValues & { latitudeDeg?: string; longitudeDeg?: string },
    ) => {
      const payload = { ...data };
      if (!payload.dateFormed)
        delete (payload as Record<string, unknown>).dateFormed;
      if (!payload.ein) delete (payload as Record<string, unknown>).ein;
      const res = await apiRequest("POST", "/api/associations", payload);
      return res.json() as Promise<{ id: string; name: string }>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations"] });
      setActiveAssociationId(created.id);
      toast({ title: `${created.name} created successfully` });

      // 4.4 Q6 Wave 13 — second-association PM-upgrade soft-prompt
      const previousCount = existingAssociations?.length ?? 0;
      const isSelfManaged = subscription?.plan === "self-managed";
      if (
        previousCount >= 1 &&
        isSelfManaged &&
        !hasPmUpgradePromptBeenDismissed()
      ) {
        setPmUpgradeOpen(true);
        return;
      }

      // If we have confirmed coords AND the maps key is set, go to pin editor
      if (confirmedCoords && hasMapsApiKey) {
        setCreatedAssociationId(created.id);
        setStep(3);
      } else {
        navigate("/app/association-context");
      }
    },
  });

  function handlePmUpgradeClose() {
    setPmUpgradeOpen(false);
    navigate("/app/association-context");
  }

  async function handleNext() {
    const valid = await form.trigger(STEP1_FIELDS);
    if (valid) setStep(1);
  }

  function handleBack() {
    if (step === 2) {
      // back from confirm → re-show editable location form
      setPendingCoords(null);
      setSelectedAddress("");
      setStep(1);
    } else {
      setStep(0);
    }
  }

  function handlePlaceSelected(place: PlaceResult) {
    // Auto-fill form fields
    form.setValue("address", place.address, { shouldValidate: true });
    form.setValue("city", place.city, { shouldValidate: true });
    form.setValue("state", place.state, { shouldValidate: true });
    if (place.country) form.setValue("country", place.country);

    // Store pending coords and move to confirm step
    setPendingCoords({ lat: place.lat, lng: place.lng });
    setSelectedAddress(
      [place.address, place.city, place.state].filter(Boolean).join(", "),
    );
    setStep(2);
  }

  function handleConfirmLocation() {
    setConfirmedCoords(pendingCoords);
    // Submit the form immediately — coordinates are attached
    form.handleSubmit(handleSubmitWithCoords)();
  }

  function handleRejectLocation() {
    // Reset to editable location step
    setPendingCoords(null);
    setSelectedAddress("");
    setStep(1);
  }

  function handleSubmitWithCoords(values: FormValues) {
    const payload = {
      ...values,
      ...(confirmedCoords || pendingCoords
        ? {
            latitudeDeg: String(
              (confirmedCoords ?? pendingCoords)!.lat,
            ),
            longitudeDeg: String(
              (confirmedCoords ?? pendingCoords)!.lng,
            ),
          }
        : {}),
    };
    createMutation.mutate(payload);
  }

  function handleSubmit(values: FormValues) {
    // Called when user submits without going through map confirm
    createMutation.mutate(values);
  }

  const watchedName = form.watch("name");
  const watchedType = form.watch("associationType");

  // ---------- Pin editor step (step 3) -------------------------------------

  if (step === 3 && createdAssociationId && confirmedCoords) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <h1 className="text-xl font-bold tracking-tight font-headline">
              Place your buildings
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Click on the satellite map to drop a pin for each building in your
              community.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <BuildingPinEditor
              associationId={createdAssociationId}
              centerLat={confirmedCoords.lat}
              centerLng={confirmedCoords.lng}
              onDone={() => navigate("/app/association-context")}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // ---------- Main form (steps 0–2) ----------------------------------------

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
          <h1 className="text-2xl font-bold tracking-tight font-headline">
            Register New Association
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Set up a new HOA, Condo, or Co-op in your portfolio.
          </p>
        </div>

        <StepIndicator current={Math.min(step, 1)} />

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)}>
                {/* ---- Step 0: Association details ---- */}
                {step === 0 && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Association Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Riverside Towers HOA"
                              {...field}
                            />
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
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select association type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ASSOCIATION_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigate("/app/associations")}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleNext}>
                        Next: Location
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ---- Step 1: Location (editable) ---- */}
                {step === 1 && (
                  <div className="space-y-4">
                    {watchedName && (
                      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 mb-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {watchedName}
                        </span>
                        {watchedType && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                            {watchedType}
                          </span>
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
                            {hasMapsApiKey ? (
                              <PlacesAutocompleteInput
                                value={field.value}
                                onChange={field.onChange}
                                onPlaceSelected={handlePlaceSelected}
                              />
                            ) : (
                              <Input placeholder="123 Main St" {...field} />
                            )}
                          </FormControl>
                          {hasMapsApiKey && (
                            <p className="text-xs text-muted-foreground">
                              Start typing — select from the dropdown to
                              auto-fill city, state, and verify on map.
                            </p>
                          )}
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
                      <p className="text-sm text-destructive">
                        {(createMutation.error as Error).message}
                      </p>
                    )}

                    <div className="flex justify-between pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleBack}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending
                          ? "Creating..."
                          : "Create Association"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* ---- Step 2: Map confirmation ---- */}
                {step === 2 && pendingCoords && (
                  <div>
                    <ConfirmLocationStep
                      address={selectedAddress}
                      lat={pendingCoords.lat}
                      lng={pendingCoords.lng}
                      onConfirm={handleConfirmLocation}
                      onReject={handleRejectLocation}
                    />
                    {createMutation.isError && (
                      <p className="text-sm text-destructive mt-3">
                        {(createMutation.error as Error).message}
                      </p>
                    )}
                    {createMutation.isPending && (
                      <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating association…
                      </div>
                    )}
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <PmUpgradePrompt open={pmUpgradeOpen} onClose={handlePmUpgradeClose} />
    </div>
  );
}
