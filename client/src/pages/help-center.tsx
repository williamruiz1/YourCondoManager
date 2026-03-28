import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WorkspacePageHeader } from "@/components/workspace-page-header";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqCategory = {
  title: string;
  icon: string;
  items: FaqItem[];
};

const faqCategories: FaqCategory[] = [
  {
    title: "Getting Started",
    icon: "rocket_launch",
    items: [
      {
        question: "How do I set up my association?",
        answer:
          "Navigate to the Dashboard and click 'New Association' in the sidebar. You'll be guided through entering your community name, address, and basic details. Once created, you can begin adding buildings, units, and residents.",
      },
      {
        question: "How do I add buildings and units?",
        answer:
          "Go to the Buildings page from the sidebar, then click 'Add Building'. After creating a building, you can add individual units within it. Each unit can be assigned an owner and occupancy details.",
      },
      {
        question: "How do I invite board members?",
        answer:
          "Board members can be added through the Governance section. Navigate to Governance, then use the board member management area to invite new members by email. They'll receive an invitation to access the Board Portal.",
      },
    ],
  },
  {
    title: "Financial Management",
    icon: "payments",
    items: [
      {
        question: "How do assessments and billing work?",
        answer:
          "Assessments are configured in the Financial Foundation section where you set up fee schedules. The Billing page lets you generate and track charges for each unit. You can set up recurring charges and one-time assessments.",
      },
      {
        question: "How do I record a payment?",
        answer:
          "Go to the Payments page and click 'Record Payment'. Select the unit, enter the amount and payment method, and submit. Payments are automatically applied to outstanding charges on the unit's ledger.",
      },
      {
        question: "How do I track expenses and vendor invoices?",
        answer:
          "Use the Expenses page to log community expenses. You can categorize expenses, attach invoices, and associate them with specific vendors. Financial Reports provide summaries of income vs. expenses.",
      },
      {
        question: "Where can I find financial reports?",
        answer:
          "The Reports section under Finance provides income/expense summaries, aging reports for outstanding balances, and collection tracking. Reports can be filtered by date range and exported.",
      },
    ],
  },
  {
    title: "Operations & Maintenance",
    icon: "engineering",
    items: [
      {
        question: "How do I create a work order?",
        answer:
          "Navigate to Work Orders and click 'Create Work Order'. Describe the issue, set priority, assign it to a vendor if applicable, and submit. Work orders can be tracked through their lifecycle from open to completed.",
      },
      {
        question: "How do I manage vendors?",
        answer:
          "The Vendors page lets you maintain a directory of service providers. Add vendor contact information, insurance details, and associate them with work orders. Vendors can also access their own portal.",
      },
      {
        question: "How does resident feedback work?",
        answer:
          "Residents can submit feedback through the Owner Portal. All submissions appear on the Resident Feedback page where you can review, categorize, and respond to them. You can also convert feedback into work orders.",
      },
    ],
  },
  {
    title: "Board & Governance",
    icon: "gavel",
    items: [
      {
        question: "How do I manage board meetings?",
        answer:
          "Use the Governance section to schedule meetings, create agendas, and record minutes. Meeting documents can be attached and shared with board members through the Board Portal.",
      },
      {
        question: "How do elections work?",
        answer:
          "Elections can be created in the Governance section. Define candidates and positions, set voting periods, and distribute ballot access to eligible voters. Results are tallied automatically.",
      },
      {
        question: "How do I track compliance tasks?",
        answer:
          "Governance compliance tasks help you track regulatory and policy requirements. Create tasks with deadlines, assign responsible parties, and attach evidence documents to demonstrate compliance.",
      },
    ],
  },
  {
    title: "Documents & Communications",
    icon: "description",
    items: [
      {
        question: "How do I upload and organize documents?",
        answer:
          "The Documents page provides a file manager for your community. Upload governing documents, meeting minutes, financial statements, and more. Documents can be organized into folders and shared with residents.",
      },
      {
        question: "How do I send announcements?",
        answer:
          "Go to Communications to create announcements. Set the priority level, target audience, and publish date. Announcements can be pinned for visibility and optionally sent as push or SMS notifications.",
      },
    ],
  },
  {
    title: "Portals & Access",
    icon: "group",
    items: [
      {
        question: "What is the Owner Portal?",
        answer:
          "The Owner Portal is a resident-facing interface where unit owners can view their account balance, make payments, submit feedback, access community documents, and stay informed about announcements.",
      },
      {
        question: "What is the Vendor Portal?",
        answer:
          "The Vendor Portal gives service providers access to their assigned work orders, allowing them to view details, update status, and communicate about ongoing maintenance tasks.",
      },
      {
        question: "How do user roles and permissions work?",
        answer:
          "The platform supports several roles: Platform Admin (full access), Board Admin (association management), Manager (day-to-day operations), and Viewer (read-only). Roles are assigned in the Admin Users section.",
      },
    ],
  },
];

export default function HelpCenterPage() {
  const [search, setSearch] = useState("");

  const filteredCategories = faqCategories
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          !search ||
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((category) => category.items.length > 0);

  const totalQuestions = faqCategories.reduce(
    (sum, cat) => sum + cat.items.length,
    0,
  );
  const matchedQuestions = filteredCategories.reduce(
    (sum, cat) => sum + cat.items.length,
    0,
  );

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Help Center"
        summary="Find answers to common questions about managing your community"
        eyebrow="Support"
        breadcrumbs={[{ label: "Help Center" }]}
      />

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for answers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {search && (
        <p className="text-sm text-muted-foreground">
          Showing {matchedQuestions} of {totalQuestions} questions
        </p>
      )}

      {filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-muted-foreground mb-2 block">
              search_off
            </span>
            <p className="text-muted-foreground">
              No results found for "{search}"
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Try different keywords or browse all categories
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredCategories.map((category) => (
            <Card key={category.title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="material-symbols-outlined text-[20px] text-primary">
                    {category.icon}
                  </span>
                  {category.title}
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {category.items.length}{" "}
                    {category.items.length === 1 ? "article" : "articles"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple">
                  {category.items.map((item, index) => (
                    <AccordionItem
                      key={index}
                      value={`${category.title}-${index}`}
                    >
                      <AccordionTrigger className="text-sm text-left hover:no-underline hover:text-primary">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
