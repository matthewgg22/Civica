"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendMagicLink, sendPhoneOtp, verifyPhoneOtp } from "@/lib/auth/actions";

type Props = { locale: string };

type EmailState = "idle" | "sent";
type PhoneState = "idle" | "otp_sent";

export function SignInForm({ locale }: Props) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<EmailState>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneState, setPhoneState] = useState<PhoneState>("idle");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    startTransition(async () => {
      const result = await sendMagicLink(email, locale);
      if (result.success) {
        setEmailState("sent");
      } else {
        setEmailError(result.error);
      }
    });
  }

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    startTransition(async () => {
      const result = await sendPhoneOtp(phone);
      if (result.success) {
        setPhoneState("otp_sent");
      } else {
        setPhoneError(result.error);
      }
    });
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    startTransition(async () => {
      const result = await verifyPhoneOtp(phone, otp);
      if (result.success) {
        router.push(`/${locale}/app/packet`);
      } else {
        setPhoneError(result.error);
      }
    });
  }

  return (
    <Tabs defaultValue="email" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="email" className="flex-1">
          {t("email")}
        </TabsTrigger>
        <TabsTrigger value="phone" className="flex-1">
          {t("phone")}
        </TabsTrigger>
      </TabsList>

      {/* ── Email / magic link ── */}
      <TabsContent value="email">
        {emailState === "sent" ? (
          <Alert variant="success" className="mt-4">
            <AlertDescription>{t("magicLinkSent")}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleMagicLink} className="mt-4 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-describedby={emailError ? "email-error" : undefined}
              />
            </div>

            {emailError && (
              <Alert variant="destructive">
                <AlertDescription id="email-error" aria-live="polite">
                  {emailError}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isPending || !email}>
              {isPending ? tc("loading") : t("sendMagicLink")}
            </Button>
          </form>
        )}
      </TabsContent>

      {/* ── Phone / OTP ── */}
      <TabsContent value="phone">
        {phoneState === "idle" ? (
          <form onSubmit={handleSendOtp} className="mt-4 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 555 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                aria-describedby={phoneError ? "phone-error" : undefined}
              />
            </div>

            {phoneError && (
              <Alert variant="destructive">
                <AlertDescription id="phone-error" aria-live="polite">
                  {phoneError}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isPending || !phone}>
              {isPending ? tc("loading") : t("sendOtp")}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="otp">{t("otpCode")}</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                aria-describedby={phoneError ? "otp-error" : undefined}
              />
            </div>

            {phoneError && (
              <Alert variant="destructive">
                <AlertDescription id="otp-error" aria-live="polite">
                  {phoneError}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending || otp.length !== 6}
            >
              {isPending ? tc("loading") : t("verifyOtp")}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setPhoneState("idle");
                setOtp("");
                setPhoneError(null);
              }}
            >
              {tc("back")}
            </Button>
          </form>
        )}
      </TabsContent>
    </Tabs>
  );
}
