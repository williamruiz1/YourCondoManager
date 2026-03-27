import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { PortalAccess, Unit } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhoneNumber, getPhoneDigits } from "@/lib/phone-formatter";

type PortalSession = PortalAccess & {
  hasBoardAccess: boolean;
  effectiveRole: string;
  boardRoleId: string | null;
  unitNumber: string | null;
  building: string | null;
};

interface OwnerInfoSectionProps {
  portalAccessId: string;
  onSuccess?: () => void;
}

export function OwnerInfoSection({ portalAccessId, onSuccess }: OwnerInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    secondaryPhone: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    contactPreference: "email",
    emergencyContactName: "",
    emergencyContactRelationship: "spouse",
    emergencyContactPhone: "",
  });

  const portalHeaders = {
    "x-portal-access-id": portalAccessId,
  };

  const { data: me } = useQuery<PortalSession | null>({
    queryKey: ["ownerInfo", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/me", { headers: portalHeaders });
      if (!res.ok) return null;
      const data = await res.json();
      // Initialize form with fetched data
      if (data && isEditing === false) {
        setFormData((prev) => ({
          ...prev,
          email: data.email || "",
          phone: formatPhoneNumber(data.phone || ""),
          firstName: data.firstName || "",
          lastName: data.lastName || "",
        }));
      }
      return data;
    },
  });

  const { data: ownerUnits } = useQuery<Unit[]>({
    queryKey: ["ownerUnitsInfo", portalAccessId],
    enabled: !!portalAccessId,
    queryFn: async () => {
      const res = await fetch("/api/portal/my-units", { headers: portalHeaders });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/me", {
        method: "PATCH",
        headers: {
          ...portalHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: getPhoneDigits(formData.phone),
          email: formData.email,
        }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      onSuccess?.();
    },
  });

  const submitContactUpdateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/contact-updates", {
        method: "POST",
        headers: {
          ...portalHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          phone: getPhoneDigits(formData.phone),
          secondaryPhone: getPhoneDigits(formData.secondaryPhone),
          mailingAddress: `${formData.street}, ${formData.city}, ${formData.state} ${formData.postalCode}`,
          contactPreference: formData.contactPreference,
          emergencyContactName: formData.emergencyContactName,
          emergencyContactPhone: getPhoneDigits(formData.emergencyContactPhone),
        }),
      });
      if (!res.ok) throw new Error("Failed to submit contact update");
      return res.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      onSuccess?.();
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isPhoneField = ['phone', 'secondaryPhone', 'emergencyContactPhone'].includes(name);
    const formattedValue = isPhoneField ? formatPhoneNumber(value) : value;

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  const propertyStats = ownerUnits?.reduce(
    (acc, unit) => {
      acc.total += 1;
      acc.residential += 1;
      return acc;
    },
    { total: 0, residential: 0, commercial: 0 }
  ) || { total: 0, residential: 0, commercial: 0 };

  return (
    <main className="md:ml-64 w-full pt-24 md:pt-20 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
      {/* Editorial Header Section */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-headline text-primary mb-2">Owner Profile</h1>
            <p className="text-on-surface-variant max-w-xl text-lg">
              Manage your personal legacy, communication preferences, and security protocols across your entire property portfolio.
            </p>
          </div>
          {isEditing && (
            <div className="flex gap-4">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 text-primary font-semibold hover:bg-white transition-all rounded-lg"
              >
                Discard Changes
              </button>
              <button
                onClick={() => {
                  submitContactUpdateMutation.mutate();
                  updateProfileMutation.mutate();
                }}
                disabled={updateProfileMutation.isPending || submitContactUpdateMutation.isPending}
                className="px-8 py-3 bg-gradient-to-r from-primary to-primary-container text-white font-semibold rounded-lg shadow-md flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                Save Profile <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Column 1: Core Identity & Communication */}
        <div className="md:col-span-8 space-y-8">
          {/* Section: Profile Information */}
          <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-headline text-on-surface">Profile Information</h2>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-primary hover:underline">
                  <span className="material-symbols-outlined">edit</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Secondary Phone
                </label>
                <input
                  type="tel"
                  name="secondaryPhone"
                  value={formData.secondaryPhone}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="Optional"
                  className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Section: Mailing Address */}
          {isEditing && (
            <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
              <h2 className="text-2xl font-headline text-on-surface mb-6">Mailing Address</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Street Address
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1 space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      className="w-full bg-surface-container-highest border-none rounded-lg focus:ring-2 focus:ring-primary p-3 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Column 2: Specific Contacts & Preferences */}
        <div className="md:col-span-4 space-y-8">
          {/* Section: Preferred Contact */}
          {isEditing && (
            <div className="bg-white rounded-xl p-8 border border-outline-variant/10 shadow-sm">
              <h2 className="text-2xl font-headline text-on-surface mb-6">Preferred Contact</h2>
              <div className="space-y-4">
                <label className="flex items-center p-4 rounded-lg bg-surface-container-low cursor-pointer hover:bg-primary-fixed transition-all group">
                  <input
                    type="radio"
                    name="contactPreference"
                    value="email"
                    checked={formData.contactPreference === "email"}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <div className="ml-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">
                      mail
                    </span>
                    <span className="font-medium">Email Communication</span>
                  </div>
                </label>
                <label className="flex items-center p-4 rounded-lg bg-surface-container-low cursor-pointer hover:bg-primary-fixed transition-all group">
                  <input
                    type="radio"
                    name="contactPreference"
                    value="phone"
                    checked={formData.contactPreference === "phone"}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <div className="ml-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">
                      call
                    </span>
                    <span className="font-medium">Phone Calls</span>
                  </div>
                </label>
                <label className="flex items-center p-4 rounded-lg bg-surface-container-low cursor-pointer hover:bg-primary-fixed transition-all group">
                  <input
                    type="radio"
                    name="contactPreference"
                    value="sms"
                    checked={formData.contactPreference === "sms"}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <div className="ml-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">
                      sms
                    </span>
                    <span className="font-medium">Text Messaging</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Section: Emergency Contact */}
          {isEditing && (
            <div className="bg-tertiary-fixed rounded-xl p-8 border border-tertiary/10 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-tertiary">emergency</span>
                <h2 className="text-2xl font-headline text-on-tertiary-fixed">Emergency Contact</h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant opacity-70">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={handleInputChange}
                    className="w-full bg-white/50 border-none rounded-lg focus:ring-2 focus:ring-tertiary p-3 outline-none transition-all placeholder:text-on-tertiary-fixed-variant/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant opacity-70">
                    Relationship
                  </label>
                  <select
                    name="emergencyContactRelationship"
                    value={formData.emergencyContactRelationship}
                    onChange={handleInputChange}
                    className="w-full bg-white/50 border-none rounded-lg focus:ring-2 focus:ring-tertiary p-3 outline-none transition-all"
                  >
                    <option value="spouse">Spouse</option>
                    <option value="business-partner">Business Partner</option>
                    <option value="legal-representative">Legal Representative</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant opacity-70">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleInputChange}
                    className="w-full bg-white/50 border-none rounded-lg focus:ring-2 focus:ring-tertiary p-3 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Information / Security Bento */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-secondary-container p-8 rounded-xl flex flex-col justify-between aspect-video md:aspect-auto">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">verified_user</span>
          <div>
            <h3 className="text-xl font-headline text-on-secondary-container mb-2">Account Security</h3>
            <p className="text-sm text-on-secondary-container/80">Your account is secure with active portal authentication.</p>
          </div>
          <button className="mt-4 text-sm font-bold uppercase tracking-widest text-primary hover:underline self-start">
            View Security Settings
          </button>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm md:col-span-2 flex items-center gap-8 border border-outline-variant/5">
          <div className="hidden sm:block h-32 w-32 rounded-lg bg-surface-container overflow-hidden flex-shrink-0">
            <span className="material-symbols-outlined text-4xl flex items-center justify-center h-full w-full">
              apartment
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-headline text-on-surface mb-2">Associated Portfolio</h3>
            <p className="text-on-surface-variant mb-4">
              You are currently managing {propertyStats.total} propert{propertyStats.total !== 1 ? "ies" : "y"} across your portfolio.
            </p>
            <div className="flex gap-2">
              <span className="bg-white border border-outline-variant/30 px-3 py-1 rounded text-xs font-medium">
                {propertyStats.residential} Residential
              </span>
              <span className="bg-white border border-outline-variant/30 px-3 py-1 rounded text-xs font-medium">
                {propertyStats.commercial} Commercial
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
