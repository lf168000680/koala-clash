import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  CloudUpload,
  Database,
  RefreshCw,
  Globe,
  Gauge,
  Calendar,
  ExternalLink,
} from "lucide-react";
import dayjs from "dayjs";
import parseTraffic from "@/utils/parse-traffic";
import { useMemo, useCallback, useState } from "react";
import { openWebUrl, updateProfile } from "@/services/cmds";
import { useLockFn } from "ahooks";
import { showNotice } from "@/services/noticeService";
import { EnhancedCard } from "./enhanced-card";
import { useAppStatic } from "@/providers/app-data-provider";
import { cn } from "@root/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// 辅助函数解析URL和过期时间
const parseUrl = (url?: string) => {
  if (!url) return "-";
  if (url.startsWith("http")) return new URL(url).host;
  return "local";
};

const parseExpire = (expire?: number) => {
  if (!expire) return "-";
  return dayjs(expire * 1000).format("YYYY-MM-DD");
};

// 使用类型定义，而不是导入
interface ProfileExtra {
  upload: number;
  download: number;
  total: number;
  expire: number;
}

export interface ProfileItem {
  uid: string;
  type?: "local" | "remote" | "merge" | "script";
  name?: string;
  desc?: string;
  file?: string;
  url?: string;
  updated?: number;
  extra?: ProfileExtra;
  home?: string;
  option?: any;
}

export interface HomeProfileCardProps {
  current: ProfileItem | null | undefined;
  onProfileUpdated?: () => void;
}

// 提取独立组件减少主组件复杂度
const ProfileDetails = ({
  current,
  onUpdateProfile,
  updating,
}: {
  current: ProfileItem;
  onUpdateProfile: () => void;
  updating: boolean;
}) => {
  const { t } = useTranslation();

  const usedTraffic = useMemo(() => {
    if (!current.extra) return 0;
    return current.extra.upload + current.extra.download;
  }, [current.extra]);

  const trafficPercentage = useMemo(() => {
    if (!current.extra || !current.extra.total || current.extra.total <= 0)
      return 0;
    return Math.min(Math.round((usedTraffic / current.extra.total) * 100), 100);
  }, [current.extra, usedTraffic]);

  return (
    <div>
      <div className="space-y-4">
        {current.url && (
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <div className="text-sm text-muted-foreground flex items-center overflow-hidden">
              <span className="flex-shrink-0">{t("From")}: </span>
              {current.home ? (
                <button
                  onClick={() => current.home && openWebUrl(current.home)}
                  className="inline-flex items-center min-w-0 max-w-[calc(100%-40px)] ml-1 hover:underline text-foreground font-medium"
                  title={parseUrl(current.url)}
                >
                  <span className="truncate flex-1">
                    {parseUrl(current.url)}
                  </span>
                  <ExternalLink
                    className="ml-1 w-3 h-3 opacity-70 flex-shrink-0"
                  />
                </button>
              ) : (
                <span
                  className="truncate flex-1 ml-1 font-medium text-foreground"
                  title={parseUrl(current.url)}
                >
                  {parseUrl(current.url)}
                </span>
              )}
            </div>
          </div>
        )}

        {current.updated && (
          <div className="flex items-center space-x-2">
            <RefreshCw
              className={cn(
                "w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors",
                updating && "animate-spin"
              )}
              onClick={onUpdateProfile}
            />
            <div
              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={onUpdateProfile}
            >
              {t("Update Time")}:{" "}
              <span className="font-medium text-foreground">
                {dayjs(current.updated * 1000).format("YYYY-MM-DD HH:mm")}
              </span>
            </div>
          </div>
        )}

        {current.extra && (
          <>
            <div className="flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                {t("Used / Total")}:{" "}
                <span className="font-medium text-foreground">
                  {parseTraffic(usedTraffic)} /{" "}
                  {parseTraffic(current.extra.total)}
                </span>
              </div>
            </div>

            {current.extra.expire > 0 && (
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  {t("Expire Time")}:{" "}
                  <span className="font-medium text-foreground">
                    {parseExpire(current.extra.expire)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-2">
              <span className="text-xs text-muted-foreground mb-1 block">
                {trafficPercentage}%
              </span>
              <Progress value={trafficPercentage} className="h-2" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 提取空配置组件
const EmptyProfile = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
      onClick={onClick}
    >
      <CloudUpload className="w-16 h-16 text-primary mb-4" />
      <h6 className="text-lg font-medium mb-1">
        {t("Import")} {t("Profiles")}
      </h6>
      <p className="text-sm text-muted-foreground">
        {t("Click to import subscription")}
      </p>
    </div>
  );
};

export const HomeProfileCard = ({
  current,
  onProfileUpdated,
}: HomeProfileCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshAll } = useAppStatic();

  // 更新当前订阅
  const [updating, setUpdating] = useState(false);

  const onUpdateProfile = useLockFn(async () => {
    if (!current?.uid) return;

    setUpdating(true);
    try {
      await updateProfile(current.uid, current.option);
      showNotice("success", t("Update subscription successfully"), 1000);
      onProfileUpdated?.();

      // 刷新首页数据
      refreshAll();
    } catch (err: any) {
      showNotice("error", err.message || err.toString(), 3000);
    } finally {
      setUpdating(false);
    }
  });

  // 导航到订阅页面
  const goToProfiles = useCallback(() => {
    navigate("/profile");
  }, [navigate]);

  // 卡片标题
  const cardTitle = useMemo(() => {
    if (!current) return t("Profiles");

    if (!current.home) return current.name;

    return (
      <button
        onClick={() => current.home && openWebUrl(current.home)}
        className="text-lg font-medium flex items-center min-w-0 max-w-full hover:underline text-inherit bg-transparent border-0 p-0 cursor-pointer"
        title={current.name}
      >
        <span className="truncate flex-1">{current.name}</span>
        <ExternalLink
          className="ml-1 w-3.5 h-3.5 opacity-70 flex-shrink-0"
        />
      </button>
    );
  }, [current, t]);

  // 卡片操作按钮
  const cardAction = useMemo(() => {
    if (!current) return null;

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={goToProfiles}
        className="rounded-md"
      >
        {t("Label-Profiles")}
        <Database className="ml-2 w-4 h-4" />
      </Button>
    );
  }, [current, goToProfiles, t]);

  return (
    <EnhancedCard
      title={cardTitle}
      icon={<CloudUpload className="w-5 h-5" />}
      iconColor="info"
      action={cardAction}
    >
      {current ? (
        <ProfileDetails
          current={current}
          onUpdateProfile={onUpdateProfile}
          updating={updating}
        />
      ) : (
        <EmptyProfile onClick={goToProfiles} />
      )}
    </EnhancedCard>
  );
};
