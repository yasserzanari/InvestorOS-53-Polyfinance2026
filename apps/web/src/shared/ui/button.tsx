import * as React from "react";
import { cn } from "../utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive";
  size?: "default" | "sm" | "icon" | "icon-sm";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "outline" && "border-border bg-background hover:bg-muted",
        variant === "secondary" && "bg-muted text-foreground hover:bg-muted/80",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "destructive" && "bg-red-50 text-red-700 hover:bg-red-100",
        size === "default" && "h-8 px-2.5 text-sm",
        size === "sm" && "h-7 px-2 text-xs",
        size === "icon" && "size-8",
        size === "icon-sm" && "size-7",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
