import type { Meta, StoryObj } from "@storybook/react";
import { DisclaimerBanner } from "@/components/layout/DisclaimerBanner";

const meta: Meta<typeof DisclaimerBanner> = {
  title: "Layout/DisclaimerBanner",
  component: DisclaimerBanner,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof DisclaimerBanner>;

export const Default: Story = {
  args: {
    message:
      "Civica helps you prepare your SNAP application packet. We do not determine eligibility or approve benefits.",
  },
};

export const SpanishLocale: Story = {
  name: "Spanish locale",
  args: {
    message:
      "Civica te ayuda a preparar tu paquete de solicitud de SNAP. No determinamos la elegibilidad ni aprobamos beneficios.",
  },
};
