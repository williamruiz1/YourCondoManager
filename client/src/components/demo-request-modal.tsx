import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

type DemoRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const EMPTY_FORM = {
  name: "",
  email: "",
  association: "",
  unitCount: "",
  message: "",
};

export default function DemoRequestModal({ isOpen, onClose }: DemoRequestModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/public/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        if (response.status === 422 || response.status === 400) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || "Please check your input and try again.");
        }
        if (response.status >= 500) {
          throw new Error("Our server encountered an error. Please try again later.");
        }
        throw new Error(`Request failed (${response.status}). Please try again.`);
      }

      setSubmitted(true);
      setFormData(EMPTY_FORM);
      setTimeout(onClose, 2000);
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Network error — please check your connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="talk-to-us-title">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 id="talk-to-us-title" className="text-2xl font-bold text-ycm-navy dark:text-white">Talk to us</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-4xl" aria-hidden="true">✓</div>
              <h3 className="font-semibold text-lg text-ycm-navy dark:text-white">Thank you!</h3>
              <p className="text-slate-600 dark:text-slate-400">
                We've got your message and will be in touch shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="ttu-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <Input
                  id="ttu-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="ttu-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email *
                </label>
                <Input
                  id="ttu-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="ttu-association" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Association name
                </label>
                <Input
                  id="ttu-association"
                  type="text"
                  name="association"
                  value={formData.association}
                  onChange={handleChange}
                  placeholder="e.g. Cherry Hill Court Condominium"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="ttu-unitCount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Number of units
                </label>
                <Input
                  id="ttu-unitCount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  name="unitCount"
                  value={formData.unitCount}
                  onChange={handleChange}
                  placeholder="e.g. 24"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="ttu-message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Message
                </label>
                <Textarea
                  id="ttu-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us about your association and what you're looking for..."
                  className="h-20"
                  disabled={loading}
                />
              </div>

              {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send message"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
