# 云端食物识别（可选）

GitHub Pages 只能托管静态网页，不能安全保存 AI API 密钥。仓库提供了 Cloudflare Workers AI 服务端模板，但**需要你在自己的 Cloudflare 账号中部署后才会工作**。

## 部署步骤

1. 注册/登录 Cloudflare：<https://dash.cloudflare.com/>
2. 打开 Workers & Pages，创建 Worker。可用 Wrangler CLI 部署，也可以在 Dashboard 的 Worker 编辑器中粘贴 `cloudflare-worker.js` 内容。
3. 为 Worker 绑定 Workers AI，绑定变量名必须是 `AI`。仓库的 `wrangler.jsonc` 展示了对应配置。
4. 部署并复制 Worker 的 HTTPS URL（通常以 `.workers.dev` 结尾）。
5. 打开 GitHub Pages 网页 → 拍照识别 → 展开“云端 AI 设置（可选）”，粘贴 Worker URL，点击“保存地址”。
6. 重新选择照片并开始识别。清空地址会恢复本地模型模式。

## 费用与隐私

- Cloudflare Workers AI 当前提供每日免费 Neurons 配额（额度与模型消耗可能变化）；超过免费额度可能需要升级或请求失败。请查看官方定价：<https://developers.cloudflare.com/workers-ai/platform/pricing/>
- 云端模式会把照片发送到你配置的 Worker，再交给 Cloudflare AI 模型处理；请勿上传不希望离开手机的照片。
- 不要把任何服务端密钥写入公开的 GitHub Pages 代码仓库。
- 该模板用图像模型返回食物名称，再与网页食物库匹配。它不是营养测量设备，重量、配料和热量仍需人工核对。

## 排错

- 403/500：检查 Workers AI 绑定、模型可用性与账号配额。
- CORS/Failed to fetch：检查 Worker URL、部署状态与跨域响应。
- 识别结果为空：照片中的食物可能不在网页候选库内，或模型未输出完全匹配的名称。
