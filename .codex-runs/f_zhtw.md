任务：繁体中文 zh-TW（docs/14 B-09）。
要做：next-intl 加 zh-TW；messages/zh-TW.json 由 zh 经 opencc-js（s2twp）转换并用术语覆盖表修正（如 軟體/體系/資料 等台湾用语及命理术语繁体正字：乾坤、罗睺→羅睺、裡/裏 统一）；知识库报告文本在 interpret 输出层按 locale 做转换（加缓存），不复制 KU；路由 /zh-TW，语言切换三项，hreflang，SEO；字体子集补繁体常用字；E2E 一条验证无简体残留（用 opencc 反向检查抽样）。
