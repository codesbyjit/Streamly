import { type JSX } from "react";

export function Code({
  children,
  classusername,
}: {
  children: React.ReactNode;
  classusername?: string;
}): JSX.Element {
  return <code classusername={classusername}>{children}</code>;
}
