# 天赋测试卡片预览

独立静态交互预览，入口为 `index.html`，样式和逻辑分别在 `styles.css`、`preview.js`。本轮未修改正式 `/talent` 页面，也未接入登录、成绩 API 或真实排行榜。

在仓库根目录运行：

```bash
python3 -m http.server 49566 --bind 127.0.0.1 --directory frontends/teach/.impeccable/previews/talent-deck
```

打开 [本地预览](http://127.0.0.1:49566/)。四项试玩均可在本地操作：五轮反应平均耗时、九宫格顺序记忆、60 秒数字规律、60 秒颜色文字干扰。支持中英文、键盘、手机横向滑动和减少动态偏好；成绩只显示本轮结果，不保存，排行榜只展示空状态预览。

`DESIGN.md` 与 `.impeccable/design.json` 记录本目录已实现的设计。页面使用 HTML/CSS 和内联 SVG，无交付栅格素材，素材来源记录不适用。
