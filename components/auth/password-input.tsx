"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>;

export function PasswordInput({ className, id, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <Input
        id={inputId}
        type={visible ? "text" : "password"}
        className={cn("pe-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={inputId}
        className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-3xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <span className="relative flex size-4 items-center justify-center">
          <IconEyeOff
            aria-hidden="true"
            className={cn(
              "absolute size-3.5 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
              visible
                ? "scale-100 opacity-100 blur-0"
                : "scale-[0.25] opacity-0 blur-[4px]",
            )}
          />
          <IconEye
            aria-hidden="true"
            className={cn(
              "relative size-3.5 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
              visible
                ? "scale-[0.25] opacity-0 blur-[4px]"
                : "scale-100 opacity-100 blur-0",
            )}
          />
        </span>
      </button>
    </div>
  );
}
