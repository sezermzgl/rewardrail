import type { LucideIcon } from "lucide-react";

type FlowNodeProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  active?: boolean;
  tone?: "default" | "green" | "blue";
};

export function FlowNode({
  icon: Icon,
  label,
  value,
  detail,
  active = false,
  tone = "default",
}: FlowNodeProps) {
  return (
    <div
      className={`flow-node flow-node--${tone}`}
      data-active={active ? "true" : "false"}
    >
      <div className="flow-node__icon" aria-hidden="true">
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="flow-node__copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}
