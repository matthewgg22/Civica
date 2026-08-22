// Sign-in copy for the DEMETER branch of /sign-in, in all four chat languages
// (#694).
//
// The page is shared by two products, and so is its copy problem. The apply
// flow reads from snap-copy.ts, which is EN/ES BY DESIGN — it mirrors the iOS
// CivicaText catalogs so a bilingual user sees identical phrasing on iPhone
// and web, and its parity test enforces exactly those two languages. Demeter
// is four languages everywhere else (the chat, the save panel, the saved
// list), so its sign-in strings live here, in the Demeter surface's own
// pattern: a per-surface `as const` table keyed by AnswerLang.
//
// Two copy systems on one page is a deliberate trade (weighed in #694):
// extending snap-copy to vi/zh would demand translations for the entire apply
// wizard to fix a page with sixteen strings.
//
// EN and ES are lifted VERBATIM from snap-copy's signin_* values so the same
// reader sees the same sentence whichever flow brought them here.

import type { AnswerLang } from "@civica/demeter-engine/packs";

export interface DemeterSigninCopy {
  title: string;
  subtitle: string;
  continueGoogle: string;
  /** Dismiss label for the in-chat modal (2026-08-22). */
  close: string;
  googleDisclosure: string;
  or: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailCta: string;
  emailSending: string;
  emailSentTitle: string;
  /** Contains {email}, replaced at render time. */
  emailSentBody: string;
  emailRetry: string;
  emailDisclosure: string;
  termsAssent: {
    before: string;
    terms: string;
    between: string;
    privacy: string;
    after: string;
  };
  errorInvalidEmail: string;
  errorRateLimited: string;
  errorGeneric: string;
}

export const SIGNIN_T: Record<AnswerLang, DemeterSigninCopy> = {
  en: {
    // Sign-in-wrap: notice adjacent to the button that creates the account.
    // See the matching note in demeter-chat-copy.ts — same reason, other half of
    // the surface. Anonymous chat assents at the composer; accounts assent here.
    termsAssent: {
      before: 'By creating an account you agree to our ',
      terms: 'Terms',
      between: ' and ',
      privacy: 'Privacy Policy',
      after: '.',
    },
    title: "Save your conversation",
    subtitle:
      "Sign in and this conversation will be here when you come back. The chat itself is always free — an account is only for saving.",
    continueGoogle: "Continue with Google",
    close: "Close",
    googleDisclosure:
      "We only use your Google account to sign you in and save your conversation.",
    or: "or",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    emailCta: "Email me a sign-in link",
    emailSending: "Sending…",
    emailSentTitle: "Check your email",
    emailSentBody:
      "We sent a sign-in link to {email}. Open it on this device to finish — it expires shortly.",
    emailRetry: "Use a different address",
    emailDisclosure:
      "We use your email only to sign you in. No password to remember, and no marketing.",
    errorInvalidEmail: "Please enter a valid email address.",
    errorRateLimited: "Too many attempts. Please wait 10 minutes and try again.",
    errorGeneric: "Something went wrong. Please try again.",
  },
  es: {
    // Sign-in-wrap: notice adjacent to the button that creates the account.
    // See the matching note in demeter-chat-copy.ts — same reason, other half of
    // the surface. Anonymous chat assents at the composer; accounts assent here.
    termsAssent: {
      before: 'Al crear una cuenta, aceptas nuestros ',
      terms: 'Términos',
      between: ' y la ',
      privacy: 'Política de Privacidad',
      after: '.',
    },
    title: "Guarda tu conversación",
    subtitle:
      "Inicia sesión y esta conversación estará aquí cuando regreses. El chat siempre es gratis — la cuenta es solo para guardar.",
    continueGoogle: "Continúa con Google",
    close: "Cerrar",
    googleDisclosure:
      "Solo usamos tu cuenta de Google para iniciar sesión y guardar tu conversación.",
    or: "o",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    emailCta: "Envíame un enlace para iniciar sesión",
    emailSending: "Enviando…",
    emailSentTitle: "Revisa tu correo",
    emailSentBody:
      "Enviamos un enlace de inicio de sesión a {email}. Ábrelo en este dispositivo para terminar — vence pronto.",
    emailRetry: "Usar otro correo",
    emailDisclosure:
      "Usamos tu correo solo para iniciar sesión. Sin contraseña que recordar y sin publicidad.",
    errorInvalidEmail: "Por favor ingresa un correo electrónico válido.",
    errorRateLimited: "Demasiados intentos. Por favor espera 10 minutos e intenta de nuevo.",
    errorGeneric: "Algo salió mal. Por favor intenta de nuevo.",
  },
  vi: {
    // Sign-in-wrap: notice adjacent to the button that creates the account.
    // See the matching note in demeter-chat-copy.ts — same reason, other half of
    // the surface. Anonymous chat assents at the composer; accounts assent here.
    termsAssent: {
      before: 'Bằng cách tạo tài khoản, bạn đồng ý với ',
      terms: 'Điều khoản',
      between: ' và ',
      privacy: 'Chính sách quyền riêng tư',
      after: ' của chúng tôi.',
    },
    title: "Lưu cuộc trò chuyện của bạn",
    subtitle:
      "Đăng nhập và cuộc trò chuyện này sẽ ở đây khi bạn quay lại. Trò chuyện luôn miễn phí — tài khoản chỉ dùng để lưu.",
    continueGoogle: "Tiếp tục với Google",
    close: "Đóng",
    googleDisclosure:
      "Chúng tôi chỉ dùng tài khoản Google của bạn để đăng nhập và lưu cuộc trò chuyện.",
    or: "hoặc",
    emailLabel: "Địa chỉ email",
    emailPlaceholder: "ban@vidu.com",
    emailCta: "Gửi cho tôi liên kết đăng nhập",
    emailSending: "Đang gửi…",
    emailSentTitle: "Kiểm tra email của bạn",
    emailSentBody:
      "Chúng tôi đã gửi liên kết đăng nhập đến {email}. Mở nó trên thiết bị này để hoàn tất — liên kết sẽ sớm hết hạn.",
    emailRetry: "Dùng địa chỉ khác",
    emailDisclosure:
      "Chúng tôi chỉ dùng email của bạn để đăng nhập. Không cần nhớ mật khẩu, không gửi quảng cáo.",
    errorInvalidEmail: "Vui lòng nhập địa chỉ email hợp lệ.",
    errorRateLimited: "Quá nhiều lần thử. Vui lòng đợi 10 phút rồi thử lại.",
    errorGeneric: "Đã xảy ra lỗi. Vui lòng thử lại.",
  },
  zh: {
    // Sign-in-wrap: notice adjacent to the button that creates the account.
    // See the matching note in demeter-chat-copy.ts — same reason, other half of
    // the surface. Anonymous chat assents at the composer; accounts assent here.
    termsAssent: {
      before: '创建账户即表示您同意我们的',
      terms: '服务条款',
      between: '和',
      privacy: '隐私政策',
      after: '。',
    },
    title: "保存您的对话",
    subtitle: "登录后，这段对话会在您回来时依然在这里。聊天本身永远免费——账户只用于保存。",
    continueGoogle: "使用 Google 继续",
    close: "关闭",
    googleDisclosure: "我们只使用您的 Google 账户来登录和保存您的对话。",
    or: "或",
    emailLabel: "电子邮箱",
    emailPlaceholder: "you@example.com",
    emailCta: "给我发送登录链接",
    emailSending: "发送中…",
    emailSentTitle: "请查收邮件",
    emailSentBody: "我们已将登录链接发送到 {email}。请在本设备上打开以完成登录——链接很快会过期。",
    emailRetry: "换一个邮箱",
    emailDisclosure: "我们只使用您的邮箱来登录。无需记住密码，也不会发送营销邮件。",
    errorInvalidEmail: "请输入有效的电子邮箱地址。",
    errorRateLimited: "尝试次数过多。请等待 10 分钟后再试。",
    errorGeneric: "出了点问题。请再试一次。",
  },
} as const;

/** The language the sign-in page should open in: the explicit ?lang= wins,
 *  then the locale prefix of the next-path (/vi/screen/ask carries its own
 *  answer), then English. */
export function resolveSigninLang(langParam: string | null, next: string): AnswerLang {
  if (langParam === "en" || langParam === "es" || langParam === "vi" || langParam === "zh") {
    return langParam;
  }
  const m = /^\/(es|vi|zh)\//.exec(next);
  return (m?.[1] as AnswerLang | undefined) ?? "en";
}
