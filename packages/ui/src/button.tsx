"use client";

import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  classusername?: string;
  appusername: string;
}

export const Button = ({ children, classusername, appusername }: ButtonProps) => {
  return (
    <button
      classusername={classusername}
      onClick={() => alert(`Hello from your ${appusername} app!`)}
    >
      {children}
    </button>
  );
};
