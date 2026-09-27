import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { rust } from "@codemirror/lang-rust";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const sourceHighlight = HighlightStyle.define([
  { tag: tags.comment, color: "#666666" },
  { tag: tags.keyword, color: "#d92332" },
  { tag: [tags.typeName, tags.className, tags.function(tags.variableName), tags.macroName], color: "#8024df" },
  { tag: [tags.variableName, tags.propertyName, tags.namespace], color: "#b84b00" },
  { tag: [tags.string, tags.character], color: "#06743b" },
  { tag: [tags.number, tags.bool, tags.atom], color: "#075db5" },
  { tag: [tags.punctuation, tags.operator], color: "#666666" },
]);

type Props = { value: string; onChange: (value: string) => void; disabled: boolean; label: string };

export function RustEditor({ value, onChange, disabled, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const configuration = useRef(new Compartment());
  onChangeRef.current = onChange;

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({ doc: value, extensions: [
        basicSetup, rust(), syntaxHighlighting(sourceHighlight), EditorState.tabSize.of(4),
        configuration.current.of([]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ] }),
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
    // 编辑器只初始化一次；后续属性通过事务更新，保留光标与撤销历史。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: configuration.current.reconfigure([
      EditorState.readOnly.of(disabled),
      EditorView.editable.of(!disabled),
      EditorView.contentAttributes.of({ "aria-label": label, "aria-readonly": String(disabled), tabindex: "0", id: "rust-source" }),
    ]) });
  }, [disabled, label]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);
  return <div className="rust-editor" ref={host} />;
}
