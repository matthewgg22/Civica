import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "@/components/snap/ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "SNAP/ProgressBar",
  component: ProgressBar,
  parameters: { layout: "padded" },
  argTypes: {
    completed: { control: { type: "range", min: 0, max: 20 } },
    total: { control: { type: "range", min: 1, max: 20 } },
    size: { control: "radio", options: ["sm", "md"] },
  },
};
export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const Empty: Story = {
  args: { completed: 0, total: 10, label: "0 of 10 completed", size: "md" },
};

export const HalfFull: Story = {
  args: { completed: 5, total: 10, label: "5 of 10 completed", size: "md" },
};

export const Complete: Story = {
  args: { completed: 10, total: 10, label: "10 of 10 completed", size: "md" },
};

export const SmallSize: Story = {
  args: { completed: 3, total: 7, label: "Section progress", size: "sm" },
};

export const NoLabel: Story = {
  args: { completed: 4, total: 6, size: "md" },
};
