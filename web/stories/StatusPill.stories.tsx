import type { Meta, StoryObj } from "@storybook/react";
import { StatusPill } from "@/components/snap/StatusPill";

const meta: Meta<typeof StatusPill> = {
  title: "SNAP/StatusPill",
  component: StatusPill,
  parameters: { layout: "centered" },
  argTypes: {
    status: {
      control: "select",
      options: [
        "Draft",
        "Submitted for Review",
        "Needs Documents",
        "Needs Applicant Clarification",
        "In Navigator Review",
        "Ready for Handoff",
        "Handed Off",
        "Closed",
      ],
    },
    size: { control: "radio", options: ["sm", "lg"] },
  },
};
export default meta;

type Story = StoryObj<typeof StatusPill>;

export const Draft: Story = { args: { status: "Draft", size: "sm" } };
export const SubmittedForReview: Story = {
  name: "Submitted for Review",
  args: { status: "Submitted for Review", size: "sm" },
};
export const NeedsDocuments: Story = {
  name: "Needs Documents",
  args: { status: "Needs Documents", size: "sm" },
};
export const NeedsApplicantClarification: Story = {
  name: "Needs Applicant Clarification",
  args: { status: "Needs Applicant Clarification", size: "sm" },
};
export const InNavigatorReview: Story = {
  name: "In Navigator Review",
  args: { status: "In Navigator Review", size: "sm" },
};
export const ReadyForHandoff: Story = {
  name: "Ready for Handoff",
  args: { status: "Ready for Handoff", size: "sm" },
};
export const HandedOff: Story = {
  name: "Handed Off",
  args: { status: "Handed Off", size: "sm" },
};
export const Closed: Story = { args: { status: "Closed", size: "sm" } };

export const LargeSize: Story = {
  name: "Large (lg)",
  args: { status: "In Navigator Review", size: "lg" },
};

export const AllStatuses: Story = {
  name: "All statuses",
  render: () => (
    <div className="flex flex-col gap-2 p-4">
      {(
        [
          "Draft",
          "Submitted for Review",
          "Needs Documents",
          "Needs Applicant Clarification",
          "In Navigator Review",
          "Ready for Handoff",
          "Handed Off",
          "Closed",
        ] as const
      ).map((s) => (
        <StatusPill key={s} status={s} size="sm" />
      ))}
    </div>
  ),
};
