# Slant 灯泡提示

在 [puzzle-slant.com](https://puzzle-slant.com/) 的当前局面上显示下一步人类逻辑。第一次点击观察位置，第二次查看绿色结论，第三次清除提示；扩展不会自动落子。

当前版本：**1.1.2**。新增菱形联合计数和三个 2 强制出口，保留大盘面自动定位、缩放同步与两阶段图形提示。

## 安装与更新

1. 从 [最新发布](https://github.com/ankomoyu/puzzleslant-hint/releases/latest) 下载 `slant-hint-lamp-extension-v1.1.2.zip` 并完整解压到固定文件夹。
2. 打开 Edge、Chrome 或兼容 Chromium 扩展的浏览器的扩展管理页，开启开发者模式。
3. 选择“加载解压缩的扩展”（QQ 浏览器为“加载未打包的扩展工具”），选中含有 `manifest.json` 的 `extension` 文件夹。
4. 打开或刷新 puzzle-slant 题目页面，点击右下角灯泡。

已有安装可用新版文件覆盖原目录，在扩展管理页点击“重新加载”，然后刷新题目。请勿移动或删除安装目录。包内包含 PDF 使用说明和 TXT 安装说明。

## 隐私与范围

- 只在 puzzle-slant.com 及其子域名运行。
- 题面解析和逻辑推理全部在本机完成，不上传题目或作答进度。
- 不读取 Cookie、账号或浏览历史；不申请额外的 `permissions` 或 `host_permissions`。
- 后台仅用于读取当前标签页缩放比例，保持提示大小与位置。
- 没有猜测、回溯或搜索补答案；灰色省略号表示当前规则库无法继续。

仓库中的 `extension` 是当前发布包内的实际运行文件，可直接审查。226 项自动化测试及 134 道正式题库回归通过；本轮未重复浏览器实机安装测试。

## 文件校验

`slant-hint-lamp-extension-v1.1.2.zip`

SHA-256：`34eacfe801cbf202203e73cacaf20b200366f1be4d2efc72625270c9b5682849`

使用提示后的局面不建议作为纯人工解题或竞速成绩提交。

## 许可证

[MIT](LICENSE)
