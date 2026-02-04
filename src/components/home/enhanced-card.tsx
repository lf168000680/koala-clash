import { ReactNode } from "react";
import { cn } from "@root/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@/components/ui/card";

export interface EnhancedCardProps {
  title: ReactNode;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  iconColor?:
    | "primary"
    | "secondary"
    | "error"
    | "warning"
    | "info"
    | "success";
  minHeight?: number | string;
  noContentPadding?: boolean;
  className?: string;
}

const fallbackColorMap: Record<string, string> = {
  primary: "text-blue-500 bg-blue-500/10",
  secondary: "text-purple-500 bg-purple-500/10",
  error: "text-red-500 bg-red-500/10",
  warning: "text-orange-500 bg-orange-500/10",
  info: "text-sky-500 bg-sky-500/10",
  success: "text-green-500 bg-green-500/10",
};

export const EnhancedCard = ({
  title,
  icon,
  action,
  children,
  iconColor = "primary",
  minHeight,
  noContentPadding = false,
  className,
}: EnhancedCardProps) => {
  const colorClass = fallbackColorMap[iconColor] || fallbackColorMap.primary;

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 border-b">
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-md shrink-0",
              colorClass,
            )}
          >
            {icon}
          </div>
          <CardTitle className="truncate text-lg font-medium" title={typeof title === 'string' ? title : undefined}>
            {title}
          </CardTitle>
        </div>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent
        className={cn(
          "flex-1 flex flex-col",
          noContentPadding ? "p-0" : "p-4",
        )}
        style={{ minHeight: minHeight }}
      >
        {children}
      </CardContent>
    </Card>
  );
};
