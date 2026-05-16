import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { DocumentChecklistItem } from "@/components/snap/DocumentChecklistItem";
import type { components } from "@/lib/api/types";

type DocumentItem = components["schemas"]["DocumentItem"];

const base: DocumentItem = {
  id: "doc-1",
  name: "Proof of Identity",
  description: "Government-issued photo ID (driver's license, passport, etc.)",
  required: true,
  status: "Not Started",
};

const meta: Meta<typeof DocumentChecklistItem> = {
  title: "SNAP/DocumentChecklistItem",
  component: DocumentChecklistItem,
  parameters: { layout: "padded" },
  args: {
    packetId: "pkt-123",
    onUploaded: fn(),
  },
  decorators: [
    (Story) => (
      <ul className="max-w-lg">
        <Story />
      </ul>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof DocumentChecklistItem>;

export const NotStarted: Story = {
  name: "Not Started (uploadable)",
  args: { item: { ...base, status: "Not Started" } },
};

export const Uploaded: Story = {
  args: { item: { ...base, status: "Uploaded" } },
};

export const NeedsReview: Story = {
  name: "Needs Review",
  args: { item: { ...base, status: "Needs Review" } },
};

export const AcceptedForPacket: Story = {
  name: "Accepted for Packet",
  args: { item: { ...base, status: "Accepted for Packet" } },
};

export const Insufficient: Story = {
  name: "Insufficient (uploadable)",
  args: { item: { ...base, status: "Insufficient" } },
};

export const Missing: Story = {
  name: "Missing (uploadable)",
  args: { item: { ...base, status: "Missing" } },
};

export const Optional: Story = {
  args: {
    item: {
      ...base,
      name: "Proof of Residency (optional)",
      description: "Utility bill or lease agreement.",
      required: false,
      status: "Optional",
    },
  },
};

export const NA: Story = {
  name: "N/A",
  args: { item: { ...base, status: "N/A" } },
};

export const NoDescription: Story = {
  name: "No description",
  args: { item: { ...base, description: undefined, status: "Not Started" } },
};
