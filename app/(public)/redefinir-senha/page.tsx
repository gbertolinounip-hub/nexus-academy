import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default async function ResetPasswordPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const flow = Array.isArray(searchParams.flow)
    ? searchParams.flow[0]
    : searchParams.flow;

  return (
    <div className="login-page">
      <ResetPasswordForm flow={flow} />
    </div>
  );
}
