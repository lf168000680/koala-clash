import React from "react";
import { cn } from "@root/lib/utils";

interface CenterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Center: React.FC<CenterProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex justify-center items-center w-full h-full",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
