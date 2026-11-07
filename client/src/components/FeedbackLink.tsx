import type { ReactNode } from "react";

type FeedbackLinkProps = {
  className?: string;
  children?: ReactNode;
  onOpen?: () => void;
};

const FORM_ID = "KpealM";

export default function FeedbackLink({ className, children = "Send feedback", onOpen }: FeedbackLinkProps) {
  return <a
    className={className}
    href={`https://tally.so/r/${FORM_ID}`}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(event) => {
      onOpen?.();
      const tally = (window as Window & { Tally?: { openPopup: (formId: string, options: Record<string, unknown>) => void } }).Tally;
      if (!tally) return;
      event.preventDefault();
      tally.openPopup(FORM_ID, { layout: "modal", width: 480, alignLeft: true, overlay: true, autoClose: 3000 });
    }}
  >{children}</a>;
}
