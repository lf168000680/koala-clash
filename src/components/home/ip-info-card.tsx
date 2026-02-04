import { useTranslation } from "react-i18next";
import { MapPin, RefreshCw, Eye, EyeOff } from "lucide-react";
import { EnhancedCard } from "./enhanced-card";
import { getIpInfo } from "@/services/api";
import { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// 定义刷新时间（秒）
const IP_REFRESH_SECONDS = 300;

// 提取InfoItem子组件并使用memo优化
const InfoItem = memo(({ label, value }: { label: string; value: string }) => (
  <div className="mb-1.5 flex items-start">
    <span className="min-w-[60px] mr-1 shrink-0 text-right text-sm text-muted-foreground">
      {label}:
    </span>
    <span className="ml-1 flex-grow overflow-hidden text-ellipsis break-words whitespace-normal text-sm">
      {value || "Unknown"}
    </span>
  </div>
));

// 获取国旗表情
const getCountryFlag = (countryCode: string) => {
  if (!countryCode) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// IP信息卡片组件
export const IpInfoCard = () => {
  const { t } = useTranslation();
  const [ipInfo, setIpInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showIp, setShowIp] = useState(false);
  const [countdown, setCountdown] = useState(IP_REFRESH_SECONDS);

  // 获取IP信息
  const fetchIpInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getIpInfo();
      setIpInfo(data);
      setCountdown(IP_REFRESH_SECONDS);
    } catch (err: any) {
      setError(err.message || t("Failed to get IP info"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 组件加载时获取IP信息
  useEffect(() => {
    fetchIpInfo();

    // 倒计时实现优化，减少不必要的重渲染
    let timer: number | null = null;
    let currentCount = IP_REFRESH_SECONDS;

    // 只在必要时更新状态，减少重渲染次数
    const startCountdown = () => {
      timer = window.setInterval(() => {
        currentCount -= 1;

        if (currentCount <= 0) {
          fetchIpInfo();
          currentCount = IP_REFRESH_SECONDS;
        }

        // 每5秒或倒计时结束时才更新UI
        if (currentCount % 5 === 0 || currentCount <= 0) {
          setCountdown(currentCount);
        }
      }, 1000);
    };

    startCountdown();
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [fetchIpInfo]);

  const toggleShowIp = useCallback(() => {
    setShowIp((prev) => !prev);
  }, []);

  // 渲染加载状态
  if (loading) {
    return (
      <EnhancedCard
        title={t("IP Information")}
        icon={<MapPin />}
        iconColor="info"
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchIpInfo}
            disabled={true}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="w-[60%] h-[30px]" />
          <Skeleton className="w-[80%] h-[24px]" />
          <Skeleton className="w-[70%] h-[24px]" />
          <Skeleton className="w-[50%] h-[24px]" />
        </div>
      </EnhancedCard>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <EnhancedCard
        title={t("IP Information")}
        icon={<MapPin />}
        iconColor="info"
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchIpInfo}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      >
        <div className="flex flex-col items-center justify-center h-full text-destructive">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchIpInfo} className="mt-4">
            {t("Retry")}
          </Button>
        </div>
      </EnhancedCard>
    );
  }

  // 渲染正常数据
  return (
    <EnhancedCard
      title={t("IP Information")}
      icon={<MapPin />}
      iconColor="info"
      action={
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchIpInfo}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      }
    >
      <div className="h-full flex flex-col">
        <div className="flex flex-row flex-1 overflow-hidden">
          {/* 左侧：国家和IP地址 */}
          <div className="w-[40%] overflow-hidden">
            <div className="flex items-center mb-2 overflow-hidden">
              <span
                className="mr-2 inline-block w-7 text-center text-2xl shrink-0"
                style={{ fontFamily: '"twemoji mozilla", sans-serif' }}
              >
                {getCountryFlag(ipInfo?.country_code)}
              </span>
              <h6
                className="font-medium overflow-hidden text-ellipsis whitespace-nowrap max-w-full text-base"
                title={ipInfo?.country || t("Unknown")}
              >
                {ipInfo?.country || t("Unknown")}
              </h6>
            </div>

            <div className="flex items-center mb-2">
              <span className="text-sm text-muted-foreground shrink-0">
                {t("IP")}:
              </span>
              <div className="flex items-center ml-2 overflow-hidden max-w-[calc(100%-30px)]">
                <span className="font-mono text-xs overflow-hidden text-ellipsis break-all">
                  {showIp ? ipInfo?.ip : "••••••••••"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleShowIp}
                  className="h-6 w-6 ml-1"
                >
                  {showIp ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <InfoItem
              label={t("ASN")}
              value={ipInfo?.asn ? `AS${ipInfo.asn}` : "N/A"}
            />
          </div>

          {/* 右侧：组织、ISP和位置信息 */}
          <div className="w-[60%] overflow-auto">
            <InfoItem label={t("ISP")} value={ipInfo?.isp} />
            <InfoItem label={t("ORG")} value={ipInfo?.asn_organization} />
            <InfoItem
              label={t("Location")}
              value={[ipInfo?.city, ipInfo?.region].filter(Boolean).join(", ")}
            />
            <InfoItem label={t("Timezone")} value={ipInfo?.timezone} />
          </div>
        </div>

        <div className="mt-auto pt-1 border-t flex justify-between items-center opacity-70 text-[0.7rem]">
          <span className="text-xs">
            {t("Auto refresh")}: {countdown}s
          </span>
          <span className="text-xs text-ellipsis overflow-hidden whitespace-nowrap">
            {ipInfo?.country_code}, {ipInfo?.longitude?.toFixed(2)},{" "}
            {ipInfo?.latitude?.toFixed(2)}
          </span>
        </div>
      </div>
    </EnhancedCard>
  );
};
