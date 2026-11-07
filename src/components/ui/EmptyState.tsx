import type { ReactNode } from "react";

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon ? <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-cream text-gold">{icon}</div> : null}
      <h2 className="text-xl">{title}</h2>
      {text ? <p className="mt-2 max-w-md text-muted">{text}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
