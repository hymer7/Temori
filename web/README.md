# Temori 网页端

Temori 是给学生团队使用的协作网站。首版包含邮箱验证码登录、建群与群号入群、群聊、大任务、可选 Issue 分工、成果版本、审阅验收和附件。网页代码在本目录，数据库迁移在 [`supabase/migrations/20261010_init.sql`](supabase/migrations/20261010_init.sql)。

## 本地运行

需要 Node.js 20.9 或更新版本，以及 npm。先进入本目录：

```bash
cd web
npm ci
```

此时运行 `npm run dev`，可以在 [http://localhost:3000](http://localhost:3000) 查看首页和登录界面。要使用真实登录、群组和任务，还需要配置 Supabase：

1. [创建 Supabase 项目](https://supabase.com/dashboard/projects)。在项目的 SQL Editor 中执行 [`supabase/migrations/20261010_init.sql`](supabase/migrations/20261010_init.sql) 的完整内容。它会创建数据表、访问规则、函数和私有附件 bucket；一个项目只执行一次。
2. 在 **Project Settings → API Keys** 找到项目 URL 和 **publishable key**。在 `web/` 下复制 `.env.example` 为 `.env.local`，填入这两个值：

   ```bash
   cp .env.example .env.local
   ```

   不要提交 `.env.local`，也不要把 `service_role` 或 secret key 填进 `NEXT_PUBLIC_` 变量。
3. 在 **Authentication → Providers** 确认 Email 已启用。在 **Authentication → Email Templates → Magic Link** 将邮件正文改为包含 `{{ .Token }}` 的验证码，例如：

   ```html
   <p>你的 Temori 登录验证码：<strong>{{ .Token }}</strong></p>
   ```

   这一步不可省：代码调用 `signInWithOtp`，但 Supabase 默认模板发送的是登录链接；改模板后才会收到页面要求输入的六位验证码。
4. 在 **Authentication → URL Configuration** 将 Site URL 设为本地地址 `http://localhost:3000`，上线后再改为正式域名。
5. 运行 `npm run dev`，打开 [http://localhost:3000/login](http://localhost:3000/login)，用项目团队成员邮箱试收验证码。

本地开发可先用 Supabase 自带邮件服务测试项目团队成员邮箱。若要让其他同学登录，须配置自定义 SMTP；默认邮件服务不会向项目团队以外的地址投递。SMTP 凭据只填写在 Supabase 后台，不放在本仓库或 Vercel 的公开环境变量中。[官方配置说明](https://supabase.com/docs/guides/auth/auth-smtp)。

## 部署到 Vercel

1. 将代码推送到 GitHub，在 [Vercel](https://vercel.com/new) 导入 Temori 仓库。项目的 **Root Directory** 选择 `web`，框架使用 Next.js。这个仓库的 `package.json` 位于 `web/`，不能把仓库根目录当作网站根目录。
2. 在 Vercel 项目的 **Environment Variables** 中设置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`，值与本地 `.env.local` 相同。给 Production 环境设置；若要使用 Preview 部署，也给 Preview 设置。添加或修改变量后重新部署。
3. 在 Supabase **Authentication → URL Configuration** 将 Site URL 改为正式 `https://...` 网站地址。若使用需要跳转的邮件链接，再按实际域名配置 Redirect URLs；当前登录界面直接输入验证码。
4. 在 Supabase **Authentication → SMTP Settings** 配置邮件服务商提供的 SMTP 主机、端口、用户名、密码和发件地址。用一个**不属于 Supabase 项目团队**的邮箱测试收信、验证码登录；测试垃圾邮件箱和常见邮箱。
5. 用至少两个不同账号检查建群、搜索群号、申请入群、群主审批、群聊、任务、Issue、提交、审阅和附件下载。数据库访问控制及迁移细节见 [`supabase/README.md`](supabase/README.md)。

网站使用浏览器端 Supabase 客户端与数据库交互。`NEXT_PUBLIC_` 变量会出现在浏览器代码中，因此这里仅使用 Supabase 的 publishable key；实际数据权限由迁移中的 RLS 策略控制。

## 常用命令

```bash
npm run dev       # 开发服务器
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript 检查
npm run build     # 生产构建
npm run start     # 本机启动生产构建
```

## 参考资料

- [Supabase 邮箱 OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase 自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Vercel 仓库子目录部署](https://vercel.com/docs/monorepos)
