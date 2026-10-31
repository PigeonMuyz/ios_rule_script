# Surge / Loon 精选补充规则

这些文件仅包含公开域名，不包含机场订阅、证书、API 密钥、设备或家庭网络设置。

- 来源：MagicRule 各客户端的实时目录和 manifest。
- OpenAI、Anthropic、Gemini：按服务域名筛选。
- AITools：Cursor、Perplexity 和 GitHub/Microsoft Copilot。
- Games：Steam、Epic、Xbox、PlayStation、Nintendo、HoYoverse。
- BiliDomestic：B 站国内服务域名；国际版不在其中。
- provenance.json：原始文件地址、校验值、更新时间和被排除规则。

筛选时移除宽泛共享服务、关键词、进程、ASN、IP 和中国 .cn AI 规则。
PCC、Emby 的策略和 CN DIRECT 优先级由各客户端主配置维护。
这是一组补充规则，现有 Loyalsoldier 基础分类和备份仓库规则继续使用。

## 更新

需要 Node.js、curl、已登录且可写此仓库的 GitHub CLI。

    # 获取和校验最新来源，输出可检查的 JSON；不修改仓库或客户端配置
    node personal-rules/refresh.mjs

    # 校验通过后，把公开规则以一次非强制提交更新到本仓库 master
    node personal-rules/refresh.mjs --publish

主配置使用 personal-rules/Surge/*.list 和 personal-rules/Loon/*.list 的稳定 raw 地址。
刷新脚本每次重新解析目录和 manifest，不依赖旧产物的摘要文件名。
当前没有设置自动定时发布；来源或筛选逻辑变化后应先检查生成结果。
