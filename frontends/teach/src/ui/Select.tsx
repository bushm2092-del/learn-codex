import * as Primitive from "@radix-ui/react-select";
import "./Select.css";

export type SelectOption = { value: string; label: string; disabled?: boolean };
type Props = {
  id?: string;
  label: string;
  value?: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

// 只封装选择行为与视觉，不读取课程、语言或持久化状态。
export function Select({ id, label, value, options, onValueChange, placeholder, disabled }: Props) {
  return <Primitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <Primitive.Trigger id={id} className="ui-select" aria-label={label} title={options.find(option => option.value === value)?.label}>
      <span className="ui-select__value"><Primitive.Value placeholder={placeholder} /></span>
      <Primitive.Icon className="ui-select__icon">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </Primitive.Icon>
    </Primitive.Trigger>
    <Primitive.Portal>
      <Primitive.Content className="ui-select__menu" position="popper" side="bottom" align="start" sideOffset={6} collisionPadding={12}
        onEscapeKeyDown={event => event.stopPropagation()}>
        <Primitive.Viewport className="ui-select__viewport">
          {options.map(option => <Primitive.Item className="ui-select__option" key={option.value} value={option.value} disabled={option.disabled} textValue={option.label}>
            <Primitive.ItemText>{option.label}</Primitive.ItemText>
            <Primitive.ItemIndicator className="ui-select__check">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
            </Primitive.ItemIndicator>
          </Primitive.Item>)}
        </Primitive.Viewport>
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
