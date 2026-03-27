import { useState } from "react";
import { OwnerPortalLogin } from "./owner-portal-login";

interface OwnerPortalLoginContainerProps {
  onLoginSuccess: (accessId: string) => void;
}

export function OwnerPortalLoginContainer({ onLoginSuccess }: OwnerPortalLoginContainerProps) {
  const [otpStep, setOtpStep] = useState<"email" | "otp" | "pick">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSimulated, setOtpSimulated] = useState<string | null>(null);
  const [associationChoices, setAssociationChoices] = useState<Array<{
    associationId: string;
    associationName: string;
    associationCity: string | null;
    unitNumber: string | null;
    building: string | null;
    role: string;
  }>>([]);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingVerify, setIsLoadingVerify] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }

    setIsLoadingEmail(true);
    setEmailError(null);

    try {
      const res = await fetch("/api/portal/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setEmailError(errorData.message || "Failed to send code");
        return;
      }

      setOtp("");
      setOtpStep("otp");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleVerifyCode = async (opts?: { associationId?: string }) => {
    if (opts?.associationId) {
      // User selected an association from the pick step
      setIsLoadingVerify(true);
      setVerifyError(null);

      try {
        const res = await fetch("/api/portal/verify-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, associationId: opts.associationId }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          setVerifyError(errorData.message || "Verification failed");
          return;
        }

        const data = await res.json();
        if (data.portalAccessId) {
          onLoginSuccess(data.portalAccessId);
        }
      } catch (err) {
        setVerifyError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoadingVerify(false);
      }
      return;
    }

    if (!otp.trim() || otp.length !== 6) {
      setVerifyError("Please enter a valid 6-digit code");
      return;
    }

    setIsLoadingVerify(true);
    setVerifyError(null);

    try {
      const res = await fetch("/api/portal/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setVerifyError(errorData.message || "Verification failed");
        return;
      }

      const data = await res.json();

      // If multiple associations, show the pick step
      if (data.associations && data.associations.length > 1) {
        setAssociationChoices(data.associations);
        setOtpStep("pick");
      } else if (data.portalAccessId) {
        // Single association or direct access
        onLoginSuccess(data.portalAccessId);
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoadingVerify(false);
    }
  };

  const handleBackToEmail = () => {
    setOtpStep("email");
    setOtp("");
    setOtpSimulated(null);
    setVerifyError(null);
    setAssociationChoices([]);
  };

  return (
    <OwnerPortalLogin
      otpStep={otpStep}
      email={email}
      otp={otp}
      otpSimulated={otpSimulated}
      associationChoices={associationChoices}
      onEmailChange={setEmail}
      onOtpChange={setOtp}
      onSendCode={handleSendCode}
      onVerifyCode={handleVerifyCode}
      onBackToEmail={handleBackToEmail}
      isLoadingEmail={isLoadingEmail}
      isLoadingVerify={isLoadingVerify}
      emailError={emailError}
      verifyError={verifyError}
    />
  );
}
