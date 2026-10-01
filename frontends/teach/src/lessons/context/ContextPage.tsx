import { contextLesson } from "../../i18n/context";
import { useLocale } from "../../i18n/useLocale";
import { LessonPage } from "../../ui/LessonPage";
import { ContextTracePlayer } from "../../ui/ContextTracePlayer";
import type { ArticleComponents } from "../../ui/LessonArticle";
import { contextAnimations } from "../../i18n/contextAnimations";
import { contextSource } from "./source";
import zh from "./article.zh.md?raw";
import en from "./article.en.md?raw";

function ContextTrace({ id }: Record<string, string>) {
  const { locale } = useLocale();
  const trace = contextAnimations[id];
  if (!trace) throw new Error(`Unknown context trace: ${id}`);
  return <ContextTracePlayer trace={trace} locale={locale} />;
}
// 注册表定义在模块级，语言切换只更新 props，不卸载播放器或重置进度。
const components: ArticleComponents = { ContextTrace };

export function ContextPage() {
  const { locale } = useLocale();
  const content = contextLesson[locale];
  return <LessonPage lesson="context" summary={content.summary} markdown={locale === "zh" ? zh : en}
    localSource={contextSource} components={components} showContents
    previous={{ to: "/lessons/function-call-source", label: content.back }} />;
}
