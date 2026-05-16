import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { DistressConfirmModal } from "@/components/snap/DistressConfirmModal";

const meta: Meta<typeof DistressConfirmModal> = {
  title: "SNAP/DistressConfirmModal",
  component: DistressConfirmModal,
  parameters: { layout: "centered" },
  args: {
    onContinue: fn(),
    onResources: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof DistressConfirmModal>;

export const Open: Story = {
  args: { open: true },
};

export const Closed: Story = {
  args: { open: false },
};
