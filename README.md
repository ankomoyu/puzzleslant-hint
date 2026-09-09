# Slant 灯泡提示

这是一个在 [puzzle-slant.com](https://puzzle-slant.com/) 题目页面上运行的本地提示扩展。点击灯泡会以两阶段图形标记展示下一步人类逻辑，不会自动落子。

## 安装

1. 从 [Releases](https://github.com/ankomoyu/puzzleslant-hint/releases/latest) 下载 `slant-hint-lamp-extension-v1.1.0_1.zip` 并解压。
2. 打开 Edge、Chrome 或兼容 Chromium 扩展的浏览器的扩展管理页，开启“开发者模式”。
3. 选择“加载已解压的扩展”，选中内含 `manifest.json` 的 `extension` 文件夹。
4. 打开 puzzle-slant.com 的 Slant 题目，点击页面上的灯泡。

## 隐私

- 只在 `puzzle-slant.com` 及其子域名页面上运行。
- 题面解析和逻辑推理全部在本机浏览器内完成。
- 不上传题面，不使用服务器，不读取 Cookie、账号信息或浏览历史。
- `manifest.json` 不申请额外的 `permissions`。

仓库中的 `extension` 目录是发布包内实际运行的代码，可以直接审查。

## 文件校验

`slant-hint-lamp-extension-v1.1.0_1.zip`

SHA-256: `6F1E3950360A4763212D108FF0BA104C5F4A4771CAE8EE017029B9566BCFE7F3`

> 提示功能用于学习和卡关辅助。使用提示后，不建议将该局成绩作为纯人工解题或竞速成绩提交。

## 许可证

[MIT](LICENSE)
