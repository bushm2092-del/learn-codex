import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import "./HelpPopover.css";

export function HelpPopover({ label, children }: { label: string; children: ReactNode }) {
  return <Popover.Root>
    <Popover.Trigger asChild><button type="button" className="help-popover__trigger" aria-label={label}>
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M8 7.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3M10 13v1" /></svg>
    </button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="help-popover__content" sideOffset={8} collisionPadding={16} aria-label={label}>
      {children}
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
