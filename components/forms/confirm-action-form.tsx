"use client";

import type { ReactNode } from "react";

interface ConfirmActionFormProps {
  action: (formData: FormData) => void | Promise<void>;
  confirmationMessage: string;
  fields: Array<{
    name: string;
    value: string;
  }>;
  children: ReactNode;
  className?: string;
}

export function ConfirmActionForm({
  action,
  confirmationMessage,
  fields,
  children,
  className
}: ConfirmActionFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmationMessage)) {
          event.preventDefault();
        }
      }}
    >
      {fields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}
