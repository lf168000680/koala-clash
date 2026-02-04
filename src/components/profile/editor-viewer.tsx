import { ReactNode, useEffect, useRef, useState, Suspense, lazy } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "@/services/states";
import { nanoid } from "nanoid";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { showNotice } from "@/services/noticeService";
import getSystem from "@/utils/get-system";
import { debounce } from "lodash-es";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wand2, Maximize, Minimize, Loader2 } from "lucide-react";

const LazyMonacoEditor = lazy(() => import("@/components/base/lazy-monaco-editor"));

const appWindow = getCurrentWebviewWindow();

type Language = "yaml" | "javascript" | "css";
type Schema<T extends Language> = LanguageSchemaMap[T];
interface LanguageSchemaMap {
  yaml: "clash" | "merge";
  javascript: never;
  css: never;
}

interface Props<T extends Language> {
  open: boolean;
  title?: string | ReactNode;
  initialData: Promise<string>;
  readOnly?: boolean;
  language: T;
  schema?: Schema<T>;
  onChange?: (prev?: string, curr?: string) => void;
  onSave?: (prev?: string, curr?: string) => void;
  onClose: () => void;
}

export const EditorViewer = <T extends Language>(props: Props<T>) => {
  const { t } = useTranslation();
  const themeMode = useThemeMode();
  const [isMaximized, setIsMaximized] = useState(false);

  const {
    open = false,
    title = t("Edit File"),
    initialData = Promise.resolve(""),
    readOnly = false,
    language = "yaml",
    schema,
    onChange,
    onSave,
    onClose,
  } = props;

  const editorRef = useRef<any>(undefined);
  const prevData = useRef<string | undefined>("");
  const currData = useRef<string | undefined>("");

  const editorDidMount = async (
    editor: any,
    monaco: any
  ) => {
    editorRef.current = editor;

    // retrieve initial data
    await initialData.then((data) => {
      prevData.current = data;
      currData.current = data;

      // create and set model
      const uri = monaco.Uri.parse(`${nanoid()}.${schema}.${language}`);
      const model = monaco.editor.createModel(data, language, uri);
      editorRef.current?.setModel(model);
    });
  };

  const handleChange = useLockFn(async (value: string | undefined) => {
    try {
      currData.current = value;
      onChange?.(prevData.current, currData.current);
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    }
  });

  const handleSave = useLockFn(async () => {
    try {
      !readOnly && onSave?.(prevData.current, currData.current);
      onClose();
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    }
  });

  const handleClose = useLockFn(async () => {
    try {
      onClose();
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    }
  });

  const editorResize = debounce(() => {
    editorRef.current?.layout();
    setTimeout(() => editorRef.current?.layout(), 500);
  }, 100);

  useEffect(() => {
    const onResized = debounce(() => {
      editorResize();
      appWindow.isMaximized().then((maximized) => {
        setIsMaximized(() => maximized);
      });
    }, 100);
    const unlistenResized = appWindow.onResized(onResized);

    return () => {
      unlistenResized.then((fn) => fn());
      editorRef.current?.dispose();
      editorRef.current = undefined;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="h-[95vh] flex flex-col p-0"
        style={{ width: "95vw", maxWidth: "95vw" }}
      >
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative px-6">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>}>
            <LazyMonacoEditor
              height="100%"
              language={language}
              theme={themeMode === "light" ? "vs" : "vs-dark"}
              options={{
                tabSize: 2,
                minimap: {
                  enabled: document.documentElement.clientWidth >= 1500,
                },
                mouseWheelZoom: true,
                readOnly: readOnly,
                quickSuggestions: { strings: true, comments: true, other: true },
                padding: { top: 16 },
                fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji"${
                  getSystem() === "windows" ? ", twemoji mozilla" : ""
                }`,
                fontLigatures: false,
                smoothScrolling: true,
              }}
              editorDidMount={editorDidMount}
              onChange={handleChange}
            />
          </Suspense>
          <div className="absolute bottom-4 left-8 z-10 flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={readOnly}
                    onClick={() =>
                      editorRef.current
                        ?.getAction("editor.action.formatDocument")
                        ?.run()
                    }
                  >
                    <Wand2 className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("Format document")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() =>
                      appWindow.toggleMaximize().then(editorResize)
                    }
                  >
                    {isMaximized ? (
                      <Minimize className="h-5 w-5" />
                    ) : (
                      <Maximize className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t(isMaximized ? "Minimize" : "Maximize")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t(readOnly ? "Close" : "Cancel")}
            </Button>
          </DialogClose>
          {!readOnly && (
            <Button type="button" onClick={handleSave}>
              {t("Save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
