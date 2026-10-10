# Temori 网页端

Temori 是给学生团队使用的协作网站。首版包含邮箱验证码登录、建群与群号入群、群聊、大任务、可选 Issue 分工、成果版本、审阅验收和附件。网页代码在本目录，数据库迁移在 [`supabase/migrations/20261010133800_init.sql`](supabase/migrations/20261010133800_init.sql)。

## 公开预览：GitHub Pages

网站已上线：[https://hymer7.github.io/Temori/](https://hymer7.github.io/Temori/)。本仓库的 [Pages 工作流](../.github/workflows/pages.yml) 会在 `main` 更新时构建 `web/`，把 `web/out/` 发布为静态网站。GitHub Free 的 Pages 要求仓库公开；**当前文件和过去的提交记录都能被任何人查看**，所以不要提交私钥、密码和私人资料。

更新网站：将改动推送到 `main`，等待 **Actions → Publish Temori to GitHub Pages** 的 `build` 和 `deploy` 都成功。若要重新手动发布，可以在该工作流页面选择 **Run workflow**，分支选 `main`。打开 **Settings → Pages → Visit site** 可以查看正式地址。

目前这是**界面和流程预览**。GitHub Pages 不提供服务器和数据库；在 Supabase 迁移、邮箱投递和访问规则完成前，真实登录、建群、聊天、任务和上传不可用。不要把 `service_role`、数据库密码或邮件服务密码写进仓库或 GitHub Actions 变量。

## 本地运行

需要 Node.js 20.9 或更新版本，以及 npm。先进入本目录：

```bash
cd web
npm ci
```

此时运行 `npm run dev`，可以在 [http://localhost:3000](http://localhost:3000) 查看首页和登录界面。要使用真实登录、群组和任务，还需要配置 Supabase：

1. [创建 Supabase 项目](https://supabase.com/dashboard/projects)。在项目的 SQL Editor 中执行 [`supabase/migrations/20261010133800_init.sql`](supabase/migrations/20261010133800_init.sql) 的完整内容。它会创建数据表、访问规则、函数和私有附件 bucket；一个项目只执行一次。
2. 在 **Project Settings → API Keys** 找到项目 URL 和 **publishable key**。在 `web/` 下复制 `.env.example` 为 `.env.local`，填入这两个值：

   ```bash
   cp .env.example .env.local
   ```

   不要提交 `.env.local`，也不要把 `service_role` 或 secret key 填进 `NEXT_PUBLIC_` 变量。
3. 在 **Authentication → Providers** 确认 Email 已启用。在 **Authentication → Email Templates** 将 **Magic Link / OTP** 和 **Confirm signup** 两个模板都改为显示 `{{ .Token }}`，例如：

   ```html
   <p>你的 Temori 登录验证码：<strong>{{ .Token }}</strong></p>
   ```

   这一步不可省：代码调用 `signInWithOtp`，默认模板可能发送登录链接；首次使用的新邮箱还可能收到注册确认模板。两个模板都使用验证码后，分别测试新邮箱和已注册邮箱。
4. 在 **Authentication → URL Configuration** 将 Site URL 设为本地地址 `http://localhost:3000`；接通线上登录时再改为正式网站地址。
5. 运行 `npm run dev`，打开 [http://localhost:3000/login](http://localhost:3000/login)，用项目团队成员邮箱试收验证码。

本地开发可先用 Supabase 自带邮件服务测试项目团队成员邮箱。若要让其他同学登录，须配置自定义 SMTP；默认邮件服务不会向项目团队以外的地址投递。SMTP 凭据只填写在 Supabase 后台，不放在本仓库。[官方配置说明](https://supabase.com/docs/guides/auth/auth-smtp)。

## 之后接通真实协作

1. 在 Supabase 执行数据库迁移，核对 RLS 和私有文件 bucket，细节见 [`supabase/README.md`](supabase/README.md)。
2. 在仓库 **Settings → Secrets and variables → Actions → Variables** 增加 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。它们是会被编入浏览器代码的公开值，只能填写项目 URL 和 publishable key。重新运行 Pages 工作流使其生效。
3. 在 Supabase **Authentication → URL Configuration** 将 Site URL 设为 `https://hymer7.github.io/Temori/`。当前登录界面直接输入验证码；若以后使用邮件跳转链接，再设置 Redirect URLs。
4. 在 Supabase **Authentication → SMTP Settings** 配置邮件服务商提供的 SMTP 主机、端口、用户名、密码和发件地址。用一个**不属于 Supabase 项目团队**的邮箱测试收信和验证码登录。
5. 用至少两个不同账号检查建群、搜索群号、申请入群、群主审批、群聊、任务、Issue、提交、审阅和附件下载。

网站使用浏览器端 Supabase 客户端与数据库交互。`NEXT_PUBLIC_` 变量会出现在浏览器代码中，因此这里仅使用 Supabase 的 publishable key；实际数据权限由迁移中的 RLS 策略控制。

## 常用命令

```bash
npm run dev       # 开发服务器
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript 检查
npm run build     # 生产构建
GITHUB_PAGES=true npm run build  # 生成 GitHub Pages 版本到 out/
```

## 参考资料

- [Supabase 邮箱 OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase 自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Next.js 静态导出](https://nextjs.org/docs/app/guides/static-exports)
