// founder-os#9487 — Board mode wizard host.
// Renders the guided wizard for a given action id (from the route).

import { Redirect } from "wouter";
import { PostChargeWizard } from "@/components/board-mode/wizards/PostChargeWizard";
import { LogViolationWizard } from "@/components/board-mode/wizards/LogViolationWizard";
import { ScheduleMeetingWizard } from "@/components/board-mode/wizards/ScheduleMeetingWizard";
import { AddOwnerWizard } from "@/components/board-mode/wizards/AddOwnerWizard";
import { RequestVendorWorkWizard } from "@/components/board-mode/wizards/RequestVendorWorkWizard";

export default function BoardWizardPage({ action }: { action: string }) {
  switch (action) {
    case "post-charge":
      return <PostChargeWizard />;
    case "log-violation":
      return <LogViolationWizard />;
    case "schedule-meeting":
      return <ScheduleMeetingWizard />;
    case "add-owner":
      return <AddOwnerWizard />;
    case "request-work":
      return <RequestVendorWorkWizard />;
    default:
      return <Redirect to="/app/board-home" />;
  }
}
