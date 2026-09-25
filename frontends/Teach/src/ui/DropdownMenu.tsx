import * as Primitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";

import "./DropdownMenu.css";

// 通用菜单只负责 Radix 交互与主题样式，不读取语言或业务状态。
export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export function DropdownMenuContent({
  className = "",
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align="end"
        sideOffset={6}
        collisionPadding={12}
        {...props}
        className={`ui-dropdown ${className}`}
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DropdownMenuRadioItem({
  className = "",
  children,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem {...props} className={`ui-dropdown__item ${className}`}>
      <span>{children}</span>
      <Primitive.ItemIndicator className="ui-dropdown__indicator">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m3.25 8.25 3 3 6.5-6.5" />
        </svg>
      </Primitive.ItemIndicator>
    </Primitive.RadioItem>
  );
}
