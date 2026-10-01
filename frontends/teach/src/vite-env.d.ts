/// <reference types="vite/client" />

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "virtual:context-source" {
  const data: {
    snapshot: import("./course/sourceSnapshot").SourceSnapshot;
    icons: Record<string, string>;
  };
  export default data;
}

declare module "virtual:context-source-content" {
  const data: {
    texts: Record<string, string>;
    refs: Record<string, import("./course/sourceSnapshot").SourceRefs>;
  };
  export default data;
}
