'use client';

type ConfirmSubmitButtonProps = {
  className?: string;
  label: string;
  message: string;
};

export function ConfirmSubmitButton({ className, label, message }: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) return;
        event.currentTarget.form?.requestSubmit();
      }}
      type='button'
    >
      {label}
    </button>
  );
}
