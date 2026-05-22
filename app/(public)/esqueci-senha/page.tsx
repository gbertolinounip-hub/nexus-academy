import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { redirectIfAuthenticated } from "@/lib/auth/session";

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <div className="login-page">
      <ForgotPasswordForm />
    </div>
  );
}
