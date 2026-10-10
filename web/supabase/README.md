# Temori 数据库与登录配置

本目录包含首版数据库迁移。数据保存在 Supabase；网页端只使用项目 URL 和 **publishable key**。不要把 `service_role` / secret key 放进浏览器代码或 Git。

## 先配置 Supabase

1. 创建一个 Supabase 项目，在 SQL Editor 中执行 [`migrations/20261010133800_init.sql`](migrations/20261010133800_init.sql) 的完整内容。已有项目也可从 `web/` 使用 Supabase CLI 的 `supabase link`、`supabase db push` 应用迁移。迁移只应执行一次。
2. 在 Authentication → Providers 保持 Email 启用。若产品要显示**六位邮箱验证码**，在 Authentication → Email Templates 的 **Magic Link / OTP** 和 **Confirm signup** 模板中都使用 `{{ .Token }}`；首次注册与再次登录分别测试。仅调用 `signInWithOtp`、保留默认模板时，可能收到登录链接。
3. 要让普通同学注册，配置自定义 SMTP 与发件地址。Supabase 默认邮件服务仅向项目团队成员邮箱发送邮件，不能用于班级试用。上线后检查验证码邮件能否到达常见邮箱。
4. 在网页端的环境变量中配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。正式部署时在托管平台填写同名变量，并在 Supabase Authentication → URL Configuration 配置正式站点地址。
5. 迁移已创建私有 `temori-files` bucket，单文件上限 25 MiB，并把 `chat_messages` 加入 Realtime publication。确认部署环境的 Realtime 功能已启用。

## 数据对象

| 表 | 用途 |
| --- | --- |
| `profiles` | 登录用户显示名，随 Auth 用户自动建立。 |
| `groups`, `group_members`, `group_join_requests` | 群组、六位群号、成员与入群审批。 |
| `tasks` | 大任务；`coordinator_id` 默认创建者，`acceptor_id` 为 `NULL` 时默认由群主验收。 |
| `issues` | 可选分工或讨论；新 Issue 默认不阻挡最终提交，任务负责人可标记为必需；讨论 Issue 可写结论后关闭。 |
| `issue_comments` | Issue 下的讨论回复，按时间显示；结论仍记录在 Issue 本身。 |
| `submissions`, `submission_issues`, `submission_versions` | 成果提交、关联的多个 Issue、草稿及已发布版本。一个 Issue 只关联一条成果提交；修改走同一提交的新版本。`kind='final'` 可不建 Issue 直接提交。 |
| `review_decisions` | 针对具体版本的通过或要求修改决定。 |
| `chat_messages` | 群聊消息。 |
| `attachments` | 任务参考文件或成果版本文件的元数据；二进制文件在私有 Storage bucket。 |

数据库按群组成员身份启用 RLS。普通成员可建大任务、Issue、群聊消息以及上传参考文件；群主审批入群，并可指定最终验收人；任务负责人分配 Issue。重要状态变化通过 RPC 完成，客户端不直接改 `status`、`owner_id`、`reviewer_id` 等权限字段。

## 网页端调用约定

Supabase JS 的 `.rpc()` 参数名如下。返回 `uuid` 的函数返回新记录 ID。

| RPC | 参数 | 返回／用途 |
| --- | --- | --- |
| `create_group` | `p_name`, `p_description`（可省略） | 群组整行，含六位 `group_number`。 |
| `search_group_by_number` | `p_group_number` | 群组公开摘要数组；群内容仍仅成员可读。 |
| `request_join_group` | `p_group_number` | 入群申请 ID；重复申请返回当前待审申请。 |
| `decide_join_request` | `p_request_id`, `p_approve` | 群主审批。 |
| `set_task_acceptor` | `p_task_id`, `p_acceptor_id` | 群主指定成员验收；传 `null` 恢复群主默认验收。 |
| `set_task_coordinator` | `p_task_id`, `p_coordinator_id` | 当前任务负责人或群主转交协调工作。 |
| `set_issue_assignment` | `p_issue_id`, `p_assignee_id`, `p_reviewer_id` | 任务负责人指定 Issue 负责人和审阅人。 |
| `set_issue_required` | `p_issue_id`, `p_required` | 任务负责人决定 Issue 是否必须完成，默认 `false`。 |
| `create_submission` | `p_task_id`, `p_kind`, `p_issue_ids`（可省略） | `p_kind` 为 `issue` 或 `final`；返回成果提交 ID。多个 Issue 必须有同一位指定审阅人。 |
| `submit_version` | `p_submission_id`, `p_summary`, `p_body`（可省略）, `p_link_url`（可省略） | 创建草稿版本并返回版本 ID；尚不可审阅。 |
| `publish_version` | `p_version_id`, `p_expected_attachment_count`（默认 0） | 所有文件上传并登记后发布版本；附件数量必须与用户本次选取的文件数相符，成果状态才改为待审阅。无文件也要调用。 |
| `review_submission` | `p_submission_id`, `p_decision`, `p_comment`（可省略） | `approved` 或 `changes_requested`；返回审阅记录 ID。要求修改必须写评论。 |
| `close_issue` | `p_issue_id`, `p_conclusion` | 创建者或任务负责人给讨论 Issue 写结论并关闭。 |
| `record_external_delivery` | `p_task_id`, `p_url`, `p_note`（可省略） | 验收后记录外部提交。 |
| `archive_task` | `p_task_id` | 验收负责人归档已通过的大任务。 |

直接写表时：

- 建大任务：`tasks.insert({ group_id, title, description?, due_at?, created_by?, coordinator_id? })`，省略时创建者与负责人由数据库填入；显式填写时必须是当前登录用户。
- 建 Issue：`issues.insert({ task_id, title, body?, kind?, due_at?, created_by? })`；默认 `kind='work'`、`is_required=false`，显式填写的创建者必须是当前登录用户，负责人和审阅人由任务负责人随后指定；只有任务负责人能通过 `set_issue_required` 改为必需。
- 在未结束的 Issue 下回复：`issue_comments.insert({ issue_id, body })`；作者由数据库填入。
- 发群聊：`chat_messages.insert({ group_id, body })`；作者由数据库填入。
- 改显示名：`profiles.update({ display_name }).eq('id', user.id)`。

常用流程：

```text
邮箱登录 → create_group / search_group_by_number + request_join_group
复杂任务：tasks.insert → issues.insert → set_issue_assignment / set_issue_required →
          create_submission(kind='issue', issue_ids=[...]) → submit_version →
          上传并登记附件 → publish_version → review_submission →
          create_submission(kind='final') → submit_version → publish_version → 最终验收
简单任务：tasks.insert → create_submission(kind='final') → submit_version →
          上传并登记附件（可省略）→ publish_version → 最终验收
```

首次创建草稿版本时 `submission.status='draft'`；被要求修改后创建新草稿时保持 `submission.status='changes_requested'`。两种情况下版本的 `status='draft'`，审阅人都不能操作。`publish_version` 将版本改为 `published`、成果改为 `pending` 后才能审阅。同一提交同时只允许一个草稿；一个大任务只允许一条最终成果提交。被要求修改时，向原提交调用 `submit_version` 创建新版本。

`review_submission` 会把通过的工作型 Issue 标记为 `resolved`；最终成果通过后把大任务标记为 `accepted`。尚有必需 Issue 未完成时不能提交或通过最终成果。只有群主或其指定的验收负责人能验收最终成果；普通 Issue 则由对应指定审阅人审阅。

## 文件上传

先上传到私有 bucket `temori-files`，Storage 对象路径必须是 `<group_uuid>/<task_uuid>/<随机文件名>`。上传成功后，向 `attachments` 插入 `{ group_id, task_id, submission_version_id?, storage_path, file_name, mime_type?, size_bytes }`。`submission_version_id` 为空表示任务参考文件；成果文件必须绑定到当前尚未发布的最新草稿版本。**所有文件上传、附件登记完成后才调用 `publish_version`，并传入本次选取文件的数量；无文件时传 0 或省略。** 数据库会检查 Storage 对象属于当前上传者且实际存在，并在附件登记时锁定成果提交，避免与发布操作交错；发布后不能再给该版本添加附件。验收通过或归档后也不能继续上传参考文件，已上传文件仍可由群成员读取。下载时使用已登录用户的 Supabase Storage 客户端或短时签名 URL，不要把 bucket 设为公开。

## 上线前最小检查

- 用群主 A、普通成员 B 和未加入者 C 三个账号验证：C 无法读取群聊、任务、文件；B 无法审批成员或验收最终成果；群主指定 B 为验收负责人后，B 才能验收该任务。
- 测试邮箱验证码、入群申请、复杂任务审阅修改循环、简单任务直接提交、文件下载。
- 表结构或权限变更必须新建迁移文件；不要在已应用的迁移中原地修改线上数据库。

参考：[Supabase 邮箱 OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Storage 权限](https://supabase.com/docs/guides/storage/security/access-control)。
