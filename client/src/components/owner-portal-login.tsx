import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface OwnerPortalLoginProps {
  otpStep: "email" | "otp" | "pick";
  email: string;
  otp: string;
  otpSimulated: string | null;
  associationChoices: Array<{
    associationId: string;
    associationName: string;
    associationCity: string | null;
    unitNumber: string | null;
    building: string | null;
    role: string;
  }>;

  onEmailChange: (email: string) => void;
  onOtpChange: (otp: string) => void;
  onSendCode: () => void;
  onVerifyCode: (opts?: { associationId?: string }) => void;
  onBackToEmail: () => void;

  isLoadingEmail: boolean;
  isLoadingVerify: boolean;
  emailError: string | null;
  verifyError: string | null;
}

export function OwnerPortalLogin({
  otpStep,
  email,
  otp,
  otpSimulated,
  associationChoices,
  onEmailChange,
  onOtpChange,
  onSendCode,
  onVerifyCode,
  onBackToEmail,
  isLoadingEmail,
  isLoadingVerify,
  emailError,
  verifyError,
}: OwnerPortalLoginProps) {
  return (
    <div className="light min-h-screen bg-surface-container-low text-on-surface flex items-center justify-center p-6 selection:bg-primary-fixed selection:text-on-primary-fixed">
      <main className="grid lg:grid-cols-2 w-full max-w-6xl bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden min-h-[700px]">
        {/* Left Section: Visual & Brand */}
        <section className="hidden lg:flex flex-col justify-between p-12 bg-primary relative overflow-hidden text-white">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img
              alt="Luxury property interior"
              className="w-full h-full object-cover opacity-30 grayscale brightness-75"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2BLw-TttK5VxTnDAyMwev1sYA0kiMf8jRqLVI-CvELihFDW4nnwtgiXJGUDJNh2gJK-T1e7QyHRzaf1mzPcKPNnVfwMehVNlDRsv_OX-F9HO8OugrVn7m8OQKkAjWOOqmMD07RK8FbVvqKn6EOjiQoIvizS0qRD807NZn7vMMewxIvdb2O6buFuKKRuj30kAYD6tQt3WOARW6g1x-u3ac0axjfB-K3a5AQG_yVqjqFaaRuUHXAHFWVVyWofkfx90MHvIk54MWcRU"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-transparent"></div>
          </div>

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-12">
              <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>
                domain
              </span>
              <h1 className="text-2xl font-serif italic tracking-tight">CondoManager</h1>
            </div>
            <div className="max-w-md">
              <h2 className="text-5xl font-serif leading-tight mb-6">Elevating the standard of property ownership.</h2>
              <p className="text-primary-fixed text-lg font-light leading-relaxed">
                Access your unit account, financial statements, and maintenance requests through your association's secure owner portal.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-auto">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/10 backdrop-blur-md border border-white/10">
              <div className="w-10 h-10 rounded-full bg-primary-fixed-dim flex items-center justify-center text-primary">
                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>
                  verified_user
                </span>
              </div>
              <div>
                <p className="text-xs font-label uppercase tracking-widest text-primary-fixed opacity-70">Security Protocol</p>
                <p className="text-sm font-medium">End-to-end encrypted management portal.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Section: Login Flow */}
        <section className="flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 bg-surface-container-lowest">
          <div className="w-full max-w-sm">
            {/* Mobile Branding */}
            <div className="lg:hidden flex flex-col items-center mb-12 text-center">
              <span className="material-symbols-outlined text-primary text-4xl mb-2" style={{fontVariationSettings: "'FILL' 1"}}>
                domain
              </span>
              <h1 className="text-2xl font-serif italic text-on-surface">CondoManager</h1>
            </div>

            <div className="mb-10 text-center lg:text-left">
              <span className="inline-block px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-label font-bold uppercase tracking-widest mb-4">
                Owner Portal
              </span>
              <h2 className="text-3xl font-serif text-on-surface mb-3">
                {otpStep === "email" && "Sign in to your account"}
                {otpStep === "otp" && "Verify your code"}
                {otpStep === "pick" && "Select your property"}
              </h2>
              <p className="text-on-surface-variant font-body">
                {otpStep === "email" && "Enter your registered email address to receive a secure one-time login code."}
                {otpStep === "otp" && `Check your email for a 6-digit login code. It expires in 15 minutes.`}
                {otpStep === "pick" && "You have access to multiple properties. Select one to continue."}
              </p>
            </div>

            {/* Form */}
            {otpStep === "email" && (
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSendCode();
                }}
              >
                <div>
                  <label
                    className="block text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1"
                    htmlFor="email"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Input
                      className="w-full px-4 py-4 bg-surface-container-high border-none rounded-lg text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all duration-200 outline-none"
                      id="email"
                      name="email"
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => onEmailChange(e.target.value)}
                      disabled={isLoadingEmail}
                    />
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant">
                      mail
                    </span>
                  </div>
                </div>

                {emailError && (
                  <p className="text-sm text-destructive">{emailError}</p>
                )}

                <div className="flex items-center gap-2 mb-2 ml-1">
                  <input className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-container-high" id="remember" type="checkbox" />
                  <label className="text-sm text-on-surface-variant" htmlFor="remember">
                    Keep me logged in for 30 days
                  </label>
                </div>

                <button
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-body font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all group disabled:opacity-50"
                  type="submit"
                  disabled={isLoadingEmail || !email}
                >
                  {isLoadingEmail ? "Sending…" : "Send Login Code"}
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>
              </form>
            )}

            {otpStep === "otp" && (
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  onVerifyCode();
                }}
              >
                <div>
                  <p className="text-sm text-on-surface-variant mb-4">
                    Code sent to: <strong>{email}</strong>
                  </p>

                  {otpSimulated && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 mb-4">
                      <strong>Dev mode:</strong> No email provider configured. Your code is:{" "}
                      <strong className="font-mono text-lg">{otpSimulated}</strong>
                    </div>
                  )}

                  <label className="block text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
                    6-digit Code
                  </label>
                  <Input
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => onOtpChange(e.target.value)}
                    maxLength={6}
                    className="font-mono text-center text-2xl tracking-widest h-14 bg-surface-container-high border-none rounded-lg text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all duration-200 outline-none"
                    disabled={isLoadingVerify}
                  />
                </div>

                {verifyError && (
                  <p className="text-sm text-destructive">{verifyError}</p>
                )}

                <button
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-body font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all group disabled:opacity-50"
                  type="submit"
                  disabled={isLoadingVerify || otp.length < 6}
                >
                  {isLoadingVerify ? "Verifying…" : "Verify & Sign In"}
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 text-xs font-label font-bold uppercase tracking-widest text-primary hover:text-primary-container px-4 py-2 rounded-lg border border-outline-variant hover:bg-primary/5 transition-colors disabled:opacity-50"
                    onClick={() => onSendCode()}
                    disabled={isLoadingEmail}
                  >
                    {isLoadingEmail ? "Sending…" : "Resend Code"}
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-xs font-label font-bold uppercase tracking-widest text-primary hover:text-primary-container px-4 py-2 rounded-lg border border-outline-variant hover:bg-primary/5 transition-colors"
                    onClick={onBackToEmail}
                  >
                    Use Different Email
                  </button>
                </div>
              </form>
            )}

            {otpStep === "pick" && (
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="rounded-md bg-surface-container-high px-4 py-3 text-sm text-on-surface-variant border border-outline-variant">
                  Signed in as <strong className="text-on-surface">{email}</strong>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const byAssoc = new Map<string, typeof associationChoices>();
                    for (const c of associationChoices) {
                      if (!byAssoc.has(c.associationId)) byAssoc.set(c.associationId, []);
                      byAssoc.get(c.associationId)!.push(c);
                    }

                    return Array.from(byAssoc.entries()).map(([assocId, choices]) => {
                      const assocName = choices[0].associationName;
                      const assocCity = choices[0].associationCity;
                      const unitSummaries = Array.from(
                        new Set(
                          choices
                            .map((choice) =>
                              choice.unitNumber
                                ? [choice.building ? `Bldg ${choice.building}` : null, `Unit ${choice.unitNumber}`]
                                    .filter(Boolean)
                                    .join(" · ")
                                : null
                            )
                            .filter((value): value is string => Boolean(value))
                        )
                      );

                      return (
                        <button
                          key={assocId}
                          onClick={() => onVerifyCode({ associationId: assocId })}
                          disabled={isLoadingVerify}
                          className="w-full space-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="font-semibold text-sm text-on-surface">{assocName}</div>
                            <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs">→</span>
                          </div>
                          {assocCity && <div className="text-xs text-on-surface-variant">{assocCity}</div>}
                          {unitSummaries.length > 0 && (
                            <div className="text-xs text-on-surface-variant">
                              {unitSummaries.length === 1
                                ? unitSummaries[0]
                                : `${unitSummaries.length} units linked`}
                            </div>
                          )}
                          <div className="text-xs text-on-surface-variant capitalize">{choices[0].role}</div>
                        </button>
                      );
                    });
                  })()}
                </div>

                <button
                  type="button"
                  className="w-full text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-lg transition-colors"
                  onClick={onBackToEmail}
                >
                  Use a Different Email
                </button>
              </form>
            )}

            <div className="mt-12 pt-8 border-t border-surface-container-high text-center">
              <p className="text-sm text-on-surface-variant">
                Don't have access yet?{" "}
                <a className="text-primary font-bold hover:underline" href="#">
                  Contact your Manager
                </a>
              </p>
            </div>
          </div>

          {/* Footer Policy Links */}
          <footer className="mt-auto pt-8 flex gap-6 text-[11px] font-label uppercase tracking-widest text-outline">
            <a className="hover:text-on-surface transition-colors" href="#">
              Privacy
            </a>
            <a className="hover:text-on-surface transition-colors" href="#">
              Terms
            </a>
            <a className="hover:text-on-surface transition-colors" href="#">
              Support
            </a>
          </footer>
        </section>
      </main>

      {/* Floating Help Button */}
      <div className="fixed bottom-8 right-8">
        <button className="flex items-center gap-2 bg-white dark:bg-slate-900 shadow-xl border border-outline-variant/20 px-4 py-3 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-primary">contact_support</span>
          <span className="text-xs font-label font-bold uppercase tracking-widest text-on-surface">Help</span>
        </button>
      </div>
    </div>
  );
}
