任务：在当前目录（分支 deploy，已包含导出重做 b539829 与 A4 长图 8ef63a7）合并本地分支 wt/perf2（拆三 Worker 与导航加速 d240c07）。
注意：perf2 把导出、分享图迁到了 destinyos-media Worker，而 deploy 分支上的导出已改为「单张 A4 宽长图（1654px）+ 紧凑双栏 PDF + 新导出面板」。合并时必须保留导出的新行为，并让它运行在 media Worker 中（Browser Rendering 绑定、R2 缓存、超时与错误码不变）；保留 perf2 的全部性能改造。
合并后跑：pnpm install、lint、typecheck、test、build、test:e2e（至少导出、polish 与主流程）、cf:build、cf:multi:smoke、test:cloudflare:e2e；修复到全绿。一次 merge commit，修复另提交 `chore: post-merge fixes`。不要部署、不要 push。
