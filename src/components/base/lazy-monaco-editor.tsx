import React from "react";
import * as monaco from "monaco-editor";
import MonacoEditor, { MonacoEditorProps } from "react-monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";
import { type JSONSchema7 } from "json-schema";
import metaSchema from "meta-json-schema/schemas/meta-json-schema.json";
import mergeSchema from "meta-json-schema/schemas/clash-verge-merge-json-schema.json";
import pac from "types-pac/pac.d.ts?raw";

// Initialization Logic
let initialized = false;
const monacoInitialization = () => {
  if (initialized) return;

  configureMonacoYaml(monaco, {
    validate: true,
    enableSchemaRequest: true,
    schemas: [
      {
        uri: "http://example.com/meta-json-schema.json",
        fileMatch: ["**/*.clash.yaml"],
        // @ts-ignore
        schema: metaSchema as JSONSchema7,
      },
      {
        uri: "http://example.com/clash-verge-merge-json-schema.json",
        fileMatch: ["**/*.merge.yaml"],
        // @ts-ignore
        schema: mergeSchema as JSONSchema7,
      },
    ],
  });
  monaco.languages.typescript.javascriptDefaults.addExtraLib(pac, "pac.d.ts");

  initialized = true;
};

const LazyMonacoEditor = (props: MonacoEditorProps) => {
  const { editorWillMount, ...rest } = props;

  const handleEditorWillMount = (m: typeof monaco) => {
    monacoInitialization();
    editorWillMount?.(m);
  };

  return (
    <MonacoEditor
      {...rest}
      editorWillMount={handleEditorWillMount}
    />
  );
};

export default LazyMonacoEditor;
