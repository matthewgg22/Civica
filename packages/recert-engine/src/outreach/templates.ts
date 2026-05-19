export const smsTemplates = {
  reminder_30d: (certPeriodEnd: string) =>
    `Your CalFresh benefits need to be renewed by ${certPeriodEnd}. Reply PRACTICE to get ready for your interview. Reply STOP to opt out.`,
  reminder_7d: (certPeriodEnd: string) =>
    `7 days until your CalFresh renewal deadline (${certPeriodEnd}). Need help? Your Civica navigator can assist. Reply STOP to opt out.`,
  reminder_0d: (certPeriodEnd: string) =>
    `Today is your CalFresh renewal deadline (${certPeriodEnd}). Contact your county office if you haven't completed your interview. Reply STOP to opt out.`,
} as const;
