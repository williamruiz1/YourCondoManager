import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  // Wave 31 a11y: main landmark with aria-labelledby; decorative icon hidden.
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-labelledby="not-found-heading"
      className="min-h-screen w-full flex items-center justify-center bg-gray-50"
    >
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
            <h1 id="not-found-heading" className="text-2xl font-bold text-gray-900">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
