import clsx from "clsx";

const statusConfig = {
  unanswered: { label: "Unanswered", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  "in-progress": { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  answered: { label: "Answered", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

interface StatusBadgeProps {
  status: keyof typeof statusConfig;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={clsx("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", config.color)}>
      {config.label}
    </span>
  );
}
