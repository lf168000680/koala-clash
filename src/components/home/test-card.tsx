import { useEffect, useRef, useMemo, useCallback } from "react";
import { useVerge } from "@/hooks/use-verge";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { TestViewer, TestViewerRef } from "@/components/test/test-viewer";
import { TestItem } from "@/components/test/test-item";
import { emit } from "@tauri-apps/api/event";
import { nanoid } from "nanoid";
import { EnhancedCard } from "./enhanced-card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Network, Plus } from "lucide-react";
import { cn } from "@root/lib/utils";

// test icons
import apple from "@/assets/image/test/apple.svg?raw";
import github from "@/assets/image/test/github.svg?raw";
import google from "@/assets/image/test/google.svg?raw";
import youtube from "@/assets/image/test/youtube.svg?raw";

// 默认测试列表，移到组件外部避免重复创建
const DEFAULT_TEST_LIST = [
  {
    uid: nanoid(),
    name: "Apple",
    url: "https://www.apple.com",
    icon: apple,
  },
  {
    uid: nanoid(),
    name: "GitHub",
    url: "https://www.github.com",
    icon: github,
  },
  {
    uid: nanoid(),
    name: "Google",
    url: "https://www.google.com",
    icon: google,
  },
  {
    uid: nanoid(),
    name: "Youtube",
    url: "https://www.youtube.com",
    icon: youtube,
  },
];

export const TestCard = () => {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor));
  const { verge, mutateVerge, patchVerge } = useVerge();
  const viewerRef = useRef<TestViewerRef>(null);

  // 使用useMemo优化测试列表，避免每次渲染重新计算
  const testList = useMemo(() => {
    return verge?.test_list ?? DEFAULT_TEST_LIST;
  }, [verge?.test_list]);

  // 使用useCallback优化函数引用，避免不必要的重新渲染
  const onTestListItemChange = useCallback(
    (uid: string, patch?: Partial<IVergeTestItem>) => {
      if (!patch) {
        mutateVerge();
        return;
      }

      const newList = testList.map((x) =>
        x.uid === uid ? { ...x, ...patch } : x,
      );

      mutateVerge({ ...verge, test_list: newList }, false);
    },
    [testList, verge, mutateVerge],
  );

  const onDeleteTestListItem = useCallback(
    (uid: string) => {
      const newList = testList.filter((x) => x.uid !== uid);
      patchVerge({ test_list: newList });
      mutateVerge({ ...verge, test_list: newList }, false);
    },
    [testList, verge, patchVerge, mutateVerge],
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const old_index = testList.findIndex((x) => x.uid === active.id);
      const new_index = testList.findIndex((x) => x.uid === over.id);

      if (old_index >= 0 && new_index >= 0) {
        const newList = [...testList];
        const [removed] = newList.splice(old_index, 1);
        newList.splice(new_index, 0, removed);

        // 优化：先本地更新，再异步 patch，避免UI卡死
        mutateVerge({ ...verge, test_list: newList }, false);
        const patchFn = () => {
          try {
            patchVerge({ test_list: newList });
          } catch { }
        };
        if (window.requestIdleCallback) {
          window.requestIdleCallback(patchFn);
        } else {
          setTimeout(patchFn, 0);
        }
      }
    },
    [testList, verge, mutateVerge, patchVerge],
  );

  // 仅在verge首次加载时初始化测试列表
  useEffect(() => {
    if (verge && !verge.test_list) {
      patchVerge({ test_list: DEFAULT_TEST_LIST });
    }
  }, [verge, patchVerge]);

  const handleEdit = useCallback((item: IVergeTestItem) => {
    viewerRef.current?.edit(item);
  }, []);

  // 使用useMemo优化UI内容，减少渲染计算
  const renderTestItems = useMemo(
    () => (
      <div className="grid grid-cols-4 gap-2">
        <SortableContext items={testList.map((x) => x.uid)}>
          {testList.map((item) => (
            <div key={item.uid} className="col-span-1">
              <TestItem
                id={item.uid}
                itemData={item}
                onEdit={handleEdit}
                onDelete={onDeleteTestListItem}
              />
            </div>
          ))}
        </SortableContext>
      </div>
    ),
    [testList, onDeleteTestListItem, handleEdit],
  );

  const handleTestAll = useCallback(() => {
    emit("verge://test-all");
  }, []);

  const handleCreateTest = useCallback(() => {
    viewerRef.current?.create();
  }, []);

  return (
    <EnhancedCard
      title={t("Website Tests")}
      icon={<Network className="w-5 h-5" />}
      action={
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleTestAll}>
                  <Network className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Test All")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCreateTest}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("Create Test")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div >
      }
    >
      <div className={cn(
        "max-h-[180px] overflow-y-auto overflow-x-hidden",
        "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
      )}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          {renderTestItems}
        </DndContext>
      </div>

      <TestViewer ref={viewerRef} onChange={onTestListItemChange} />
    </EnhancedCard >
  );
};
