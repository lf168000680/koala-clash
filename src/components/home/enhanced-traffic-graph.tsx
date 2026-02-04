import {
  forwardRef,
  useState,
  useCallback,
  useMemo,
  useRef,
  memo,
  useEffect,
  useImperativeHandle,
} from "react";
import parseTraffic from "@/utils/parse-traffic";
import { useTranslation } from "react-i18next";
import { Line as ChartJsLine } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { cn } from "@root/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

// 流量数据项接口
export interface ITrafficItem {
  up: number;
  down: number;
  timestamp?: number;
}

// 对外暴露的接口
export interface EnhancedTrafficGraphRef {
  appendData: (data: ITrafficItem) => void;
  toggleStyle: () => void;
}

type TimeRange = 1 | 5 | 10; // 分钟

// 数据点类型
type DataPoint = ITrafficItem & { name: string; timestamp: number };

/**
 * 增强型流量图表组件
 */
export const EnhancedTrafficGraph = memo(
  forwardRef<EnhancedTrafficGraphRef, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => {
      const { t } = useTranslation();

      // 基础状态
      const [timeRange, setTimeRange] = useState<TimeRange>(10);
      const [chartStyle, setChartStyle] = useState<"line" | "area">("area");
      const [displayData, setDisplayData] = useState<DataPoint[]>([]);

      // 数据缓冲区
      const dataBufferRef = useRef<DataPoint[]>([]);

      // 颜色状态
      const [colors, setColors] = useState({
        up: "#8b5cf6", // violet-500 (secondary)
        down: "#22c55e", // green-500 (primary)
        grid: "rgba(200, 200, 200, 0.2)",
        tooltipBg: "#ffffff",
        text: "#333333",
        tooltipBorder: "#e5e7eb",
      });

      // 更新颜色的函数
      const updateColors = useCallback(() => {
        const isDark = document.documentElement.classList.contains("dark");
        if (isDark) {
          setColors({
            up: "#a78bfa", // violet-400
            down: "#4ade80", // green-400
            grid: "rgba(255, 255, 255, 0.1)",
            tooltipBg: "#1f2937",
            text: "#f3f4f6",
            tooltipBorder: "#374151",
          });
        } else {
          setColors({
            up: "#7c3aed", // violet-600
            down: "#16a34a", // green-600
            grid: "rgba(0, 0, 0, 0.05)",
            tooltipBg: "#ffffff",
            text: "#374151",
            tooltipBorder: "#e5e7eb",
          });
        }
      }, []);

      // 监听主题变化
      useEffect(() => {
        updateColors();
        const observer = new MutationObserver(updateColors);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
        return () => observer.disconnect();
      }, [updateColors]);

      // 根据时间范围计算保留的数据点数量
      const getMaxPointsByTimeRange = useCallback(
        (minutes: TimeRange): number => minutes * 60,
        [],
      );

      // 最大数据点数量
      const MAX_BUFFER_SIZE = useMemo(
        () => getMaxPointsByTimeRange(10),
        [getMaxPointsByTimeRange],
      );

      // 切换时间范围
      const handleTimeRangeClick = useCallback(
        (event: React.MouseEvent<SVGTextElement> | any) => {
          // ChartJS event handling is tricky here, ignoring for simplicity or need specific impl
          // Simplifying: Just cycle on click anywhere if implemented via chart events,
          // but here we might need external buttons or chart plugin.
          // Original code seemed to use chart onClick.
          // For now, we'll keep the logic but it might not be triggered directly by SVGTextElement.
          setTimeRange((prevRange) => {
            return prevRange === 1 ? 5 : prevRange === 5 ? 10 : 1;
          });
        },
        [],
      );

      // 暴露给父组件的方法
      useImperativeHandle(ref, () => ({
        appendData: (data: ITrafficItem) => {
          const now = Date.now();
          const point: DataPoint = {
            ...data,
            timestamp: now,
            name: new Date(now).toLocaleTimeString(),
          };

          // 添加到缓冲区
          dataBufferRef.current.push(point);

          // 保持缓冲区大小
          if (dataBufferRef.current.length > MAX_BUFFER_SIZE) {
            dataBufferRef.current = dataBufferRef.current.slice(
              -MAX_BUFFER_SIZE,
            );
          }

          // 根据当前时间范围筛选显示数据
          const pointsNeeded = getMaxPointsByTimeRange(timeRange);
          const currentData = dataBufferRef.current.slice(-pointsNeeded);

          setDisplayData(currentData);
        },
        toggleStyle: () => {
          setChartStyle((prev) => (prev === "line" ? "area" : "line"));
        },
      }));

      // 图表配置
      const options = useMemo(
        () => ({
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 0, // 禁用动画以提高性能
          },
          interaction: {
            mode: "index" as const,
            intersect: false,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: true,
              backgroundColor: colors.tooltipBg,
              titleColor: colors.text,
              bodyColor: colors.text,
              borderColor: colors.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: function (context: any) {
                  let label = context.dataset.label || "";
                  if (label) {
                    label += ": ";
                  }
                  if (context.parsed.y !== null) {
                    label += parseTraffic(context.parsed.y) + "/s";
                  }
                  return label;
                },
              },
            },
          },
          scales: {
            x: {
              display: false, // 隐藏X轴
              grid: {
                display: false,
              },
            },
            y: {
              display: true,
              position: "right" as const,
              grid: {
                color: colors.grid,
              },
              ticks: {
                color: colors.text,
                font: {
                  size: 10,
                },
                callback: function (value: any) {
                  return parseTraffic(value) + "/s";
                },
                maxTicksLimit: 5,
              },
              beginAtZero: true,
            },
          },
          elements: {
            point: {
              radius: 0, // 隐藏数据点
              hoverRadius: 4,
            },
            line: {
              tension: 0.2, // 平滑曲线
              borderWidth: 1.5,
            },
          },
        }),
        [colors, timeRange, t],
      );

      const data = useMemo(
        () => ({
          labels: displayData.map((d) => d.name),
          datasets: [
            {
              label: t("Upload"),
              data: displayData.map((d) => d.up),
              borderColor: colors.up,
              backgroundColor:
                chartStyle === "area" ? `${colors.up}20` : "transparent",
              fill: chartStyle === "area",
            },
            {
              label: t("Download"),
              data: displayData.map((d) => d.down),
              borderColor: colors.down,
              backgroundColor:
                chartStyle === "area" ? `${colors.down}20` : "transparent",
              fill: chartStyle === "area",
            },
          ],
        }),
        [displayData, colors, chartStyle, t],
      );

      return (
        <div
          className={cn("w-full h-full min-h-[150px]", props.className)}
          onClick={handleTimeRangeClick}
        >
          <ChartJsLine options={options} data={data} />
        </div>
      );
    },
  ),
);
