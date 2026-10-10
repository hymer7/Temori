"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardList, Download, FileText, GitBranch, Link2, MessageCircle, Paperclip, Plus, RotateCcw, Send, Settings2, Users } from "lucide-react";
import WorkspaceShell from "@/components/WorkspaceShell";
import { getSupabase } from "@/lib/supabase";
import { useViewer } from "@/lib/use-viewer";
import type { Attachment, Group, Issue, IssueComment, Profile, ReviewDecision, Submission, SubmissionVersion, Task } from "@/lib/types";
import styles from "./page.module.css";

type Member = { user_id: string };
type SubmissionIssue = { submission_id: string; issue_id: string };
type Assignment = { assignee: string; reviewer: string };

function taskStatusLabel(status: string) {
  if (status === "accepted") return "已验收";
  if (status === "archived") return "已归档";
  return "进行中";
}

function submissionStatusLabel(status: string) {
  if (status === "approved") return "已通过";
  if (status === "changes_requested") return "需修改";
  if (status === "pending") return "待审阅";
  return "草稿";
}

export default function TaskDetail({ groupId, taskId }: { groupId: string; taskId: string }) {
  const { user, loading, configured } = useViewer();
  const [group, setGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [decisions, setDecisions] = useState<ReviewDecision[]>([]);
  const [links, setLinks] = useState<SubmissionIssue[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [issueTitle, setIssueTitle] = useState("");
  const [issueBody, setIssueBody] = useState("");
  const [issueKind, setIssueKind] = useState<"work" | "discussion">("work");
  const [issueDue, setIssueDue] = useState("");
  const [issueRequired, setIssueRequired] = useState(true);
  const [conclusions, setConclusions] = useState<Record<string, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submissionKind, setSubmissionKind] = useState<"final" | "issue">("final");
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    setDataLoading(true);
    const [groupResult, groupsResult, taskResult, issuesResult, submissionsResult, membersResult, attachmentsResult] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("id", taskId).eq("group_id", groupId).maybeSingle(),
      supabase.from("issues").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("submissions").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      supabase.from("attachments").select("*").eq("task_id", taskId).order("created_at"),
    ]);
    setGroup((groupResult.data as Group | null) || null);
    setGroups((groupsResult.data || []) as Group[]);
    setTask((taskResult.data as Task | null) || null);
    setDeliveryUrl((taskResult.data as Task | null)?.external_delivery_url || "");
    setDeliveryNote((taskResult.data as Task | null)?.external_delivery_note || "");
    const issueRows = (issuesResult.data || []) as Issue[];
    setIssues(issueRows);
    setAttachments((attachmentsResult.data || []) as Attachment[]);
    if (issueRows.length) {
      const { data } = await supabase.from("issue_comments").select("*").in("issue_id", issueRows.map((issue) => issue.id)).order("created_at");
      setComments((data || []) as IssueComment[]);
    } else setComments([]);
    setAssignments(Object.fromEntries(issueRows.map((issue) => [issue.id, { assignee: issue.assignee_id || "", reviewer: issue.reviewer_id || "" }])));
    const submissionRows = (submissionsResult.data || []) as Submission[];
    setSubmissions(submissionRows);
    const memberRows = (membersResult.data || []) as Member[];
    setMembers(memberRows);
    if (memberRows.length) {
      const { data } = await supabase.from("profiles").select("id, display_name").in("id", memberRows.map((member) => member.user_id));
      setProfiles((data || []) as Profile[]);
    }
    if (submissionRows.length) {
      const ids = submissionRows.map((item) => item.id);
      const [versionsResult, decisionsResult, linksResult] = await Promise.all([
        supabase.from("submission_versions").select("*").in("submission_id", ids).order("version_number", { ascending: false }),
        supabase.from("review_decisions").select("*").in("submission_id", ids).order("created_at", { ascending: false }),
        supabase.from("submission_issues").select("submission_id, issue_id").in("submission_id", ids),
      ]);
      setVersions((versionsResult.data || []) as SubmissionVersion[]);
      setDecisions((decisionsResult.data || []) as ReviewDecision[]);
      setLinks((linksResult.data || []) as SubmissionIssue[]);
    } else { setVersions([]); setDecisions([]); setLinks([]); }
    const firstError = groupResult.error || taskResult.error || issuesResult.error || submissionsResult.error;
    if (firstError) setError(firstError.message);
    setDataLoading(false);
  }, [groupId, taskId, user]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const displayName = useCallback((id: string | null | undefined) => {
    if (!id) return "未指定";
    if (id === user?.id) return "你";
    return profiles.find((profile) => profile.id === id)?.display_name || `成员 ${id.slice(0, 6)}`;
  }, [profiles, user]);

  const effectiveAcceptor = task?.acceptor_id || group?.owner_id;
  const canAccept = Boolean(user && effectiveAcceptor === user.id);
  const canCoordinate = Boolean(user && task?.coordinator_id === user.id);
  const isOwner = Boolean(user && group?.owner_id === user.id);
  const workIssues = useMemo(() => issues.filter((issue) => issue.kind === "work"), [issues]);
  const requiredOpen = issues.filter((issue) => issue.is_required && !["resolved", "closed"].includes(issue.status));
  const finalSubmission = submissions.find((item) => item.kind === "final");

  async function createIssue(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !user || !task) return;
    setBusy(true); setError(""); setNotice("");
    const { data: createdIssue, error: insertError } = await supabase.from("issues").insert({
      task_id: task.id, title: issueTitle.trim(), body: issueBody.trim(), kind: issueKind,
      due_at: issueDue ? new Date(`${issueDue}T23:59:00`).toISOString() : null,
      created_by: user.id,
    }).select("id").single();
    if (insertError) { setBusy(false); setError(`创建 Issue 失败：${insertError.message}`); return; }
    if (canCoordinate && issueRequired && createdIssue?.id) {
      const { error: requiredError } = await supabase.rpc("set_issue_required", { p_issue_id: createdIssue.id, p_required: true });
      if (requiredError) setError(`Issue 已创建，但设置为必需失败：${requiredError.message}`);
    }
    setBusy(false);
    setIssueTitle(""); setIssueBody(""); setIssueDue("");
    setNotice("Issue 已创建。任务协调人可以决定是否必需，并为工作型 Issue 指定审阅人。");
    await load();
  }

  async function assignIssue(issueId: string) {
    const supabase = getSupabase();
    const value = assignments[issueId];
    if (!supabase || !value) return;
    setBusy(true); setError(""); setNotice("");
    const { error: assignError } = await supabase.rpc("set_issue_assignment", {
      p_issue_id: issueId,
      p_assignee_id: value.assignee || null,
      p_reviewer_id: value.reviewer || null,
    });
    setBusy(false);
    if (assignError) { setError(`分工保存失败：${assignError.message}`); return; }
    setNotice("Issue 负责人和审阅人已更新。");
    await load();
  }

  async function toggleIssueRequired(issue: Issue) {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: requiredError } = await supabase.rpc("set_issue_required", { p_issue_id: issue.id, p_required: !issue.is_required });
    setBusy(false);
    if (requiredError) { setError(`更新失败：${requiredError.message}`); return; }
    setNotice(issue.is_required ? "该 Issue 已设为可选。" : "该 Issue 已设为必需。");
    await load();
  }

  async function closeDiscussion(issueId: string) {
    const supabase = getSupabase();
    const conclusion = conclusions[issueId]?.trim();
    if (!supabase || !conclusion) return;
    setBusy(true); setError(""); setNotice("");
    const { error: closeError } = await supabase.rpc("close_issue", { p_issue_id: issueId, p_conclusion: conclusion });
    setBusy(false);
    if (closeError) { setError(`关闭失败：${closeError.message}`); return; }
    setNotice("讨论结论已记录，Issue 已关闭。");
    await load();
  }

  async function addIssueComment(issueId: string) {
    const supabase = getSupabase();
    const text = commentDrafts[issueId]?.trim();
    if (!supabase || !text) return;
    setBusy(true); setError(""); setNotice("");
    const { error: commentError } = await supabase.from("issue_comments").insert({ issue_id: issueId, body: text });
    setBusy(false);
    if (commentError) { setError(`回复失败：${commentError.message}`); return; }
    setCommentDrafts({ ...commentDrafts, [issueId]: "" });
    await load();
  }

  async function uploadFiles(files: File[], versionId: string | null) {
    const supabase = getSupabase();
    if (!supabase || !group || !task) return "尚未连接文件服务";
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) return `${file.name} 超过单文件 25 MiB 的上限`;
      const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "bin";
      const path = `${group.id}/${task.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("temori-files").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) return `${file.name} 上传失败：${uploadError.message}`;
      const { error: recordError } = await supabase.from("attachments").insert({
        group_id: group.id, task_id: task.id, submission_version_id: versionId,
        storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size,
      });
      if (recordError) return `${file.name} 已传入存储空间，但保存文件记录失败：${recordError.message}`;
    }
    return null;
  }

  async function uploadReferences() {
    if (!referenceFiles.length) return;
    setBusy(true); setError(""); setNotice("");
    const uploadError = await uploadFiles(referenceFiles, null);
    setBusy(false);
    if (uploadError) { setError(uploadError); await load(); return; }
    setReferenceFiles([]);
    setNotice("参考文件已上传，群组成员可以在这里下载。");
    await load();
  }

  async function downloadFile(attachment: Attachment) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error: downloadError } = await supabase.storage.from("temori-files").download(attachment.storage_path);
    if (downloadError || !data) { setError(`下载失败：${downloadError?.message || "文件不可用"}`); return; }
    const href = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = attachment.file_name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  async function addFilesToVersion(versionId: string, files: File[]): Promise<boolean> {
    if (!files.length) return false;
    setBusy(true); setError(""); setNotice("");
    const uploadError = await uploadFiles(files, versionId);
    setBusy(false);
    if (uploadError) setError(uploadError);
    else setNotice("文件已附到草稿版本；确认齐全后请点击发布给审阅人。");
    await load();
    return !uploadError;
  }

  async function publishVersion(versionId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    setBusy(true); setError(""); setNotice("");
    const expectedCount = attachments.filter((attachment) => attachment.submission_version_id === versionId).length;
    const { error: publishError } = await supabase.rpc("publish_version", { p_version_id: versionId, p_expected_attachment_count: expectedCount });
    setBusy(false);
    if (publishError) { setError(`发布失败：${publishError.message}`); await load(); return false; }
    setNotice("版本已发布，等待审阅。");
    await load();
    return true;
  }

  async function createSubmission(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !task) return;
    setBusy(true); setError(""); setNotice("");
    const { data: id, error: createError } = await supabase.rpc("create_submission", {
      p_task_id: task.id,
      p_kind: submissionKind,
      p_issue_ids: submissionKind === "issue" ? selectedIssues : [],
    });
    if (createError || !id) { setBusy(false); setError(`提交失败：${createError?.message || "未创建成果记录"}`); return; }
    const { data: versionId, error: versionError } = await supabase.rpc("submit_version", {
      p_submission_id: id as string,
      p_summary: summary.trim(),
      p_body: body.trim(),
      p_link_url: linkUrl.trim() || null,
    });
    if (versionError || !versionId) { setBusy(false); setError(`成果草稿已建立，但版本保存失败：${versionError?.message || "未生成版本"}。请在下方草稿里继续提交。`); await load(); return; }
    const uploadError = await uploadFiles(submissionFiles, versionId as string);
    setSummary(""); setBody(""); setLinkUrl(""); setSelectedIssues([]); setSubmissionFiles([]);
    if (uploadError) { setBusy(false); setError(`成果草稿已保存，但附件未完成：${uploadError}。请在草稿中补传并发布。`); await load(); return; }
    const { error: publishError } = await supabase.rpc("publish_version", { p_version_id: versionId as string, p_expected_attachment_count: submissionFiles.length });
    setBusy(false);
    if (publishError) { setError(`草稿已保存，但发布失败：${publishError.message}。请在草稿中重试发布。`); await load(); return; }
    setNotice(submissionKind === "final" ? "最终成果已提交，等待验收。" : "Issue 成果已提交，等待审阅。");
    await load();
  }

  async function addVersion(submissionId: string, nextSummary: string, nextBody: string, nextLink: string, files: File[]): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    setBusy(true); setError(""); setNotice("");
    const { data: versionId, error: versionError } = await supabase.rpc("submit_version", {
      p_submission_id: submissionId,
      p_summary: nextSummary.trim(), p_body: nextBody.trim(), p_link_url: nextLink.trim() || null,
    });
    if (versionError || !versionId) { setBusy(false); setError(`保存新版本失败：${versionError?.message || "未生成版本"}`); return false; }
    const uploadError = await uploadFiles(files, versionId as string);
    if (uploadError) { setBusy(false); setError(`新版本草稿已保存，但附件未完成：${uploadError}。请在草稿中补传并发布。`); await load(); return false; }
    const { error: publishError } = await supabase.rpc("publish_version", { p_version_id: versionId as string, p_expected_attachment_count: files.length });
    setBusy(false);
    if (publishError) { setError(`新版本草稿已保存，但发布失败：${publishError.message}。请在草稿中重试。`); await load(); return false; }
    setNotice("新版本已提交，旧版本和审阅意见仍可查看。");
    await load();
    return true;
  }

  async function review(submissionId: string, decision: "approved" | "changes_requested", comment: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: reviewError } = await supabase.rpc("review_submission", {
      p_submission_id: submissionId, p_decision: decision, p_comment: comment.trim(),
    });
    setBusy(false);
    if (reviewError) { setError(`审阅失败：${reviewError.message}`); return; }
    setNotice(decision === "approved" ? "成果已通过。" : "已要求修改，提交者可以继续提交新版本。");
    await load();
  }

  async function setAcceptor(acceptorId: string) {
    const supabase = getSupabase();
    if (!supabase || !task) return;
    setBusy(true); setError(""); setNotice("");
    const { error: acceptorError } = await supabase.rpc("set_task_acceptor", { p_task_id: task.id, p_acceptor_id: acceptorId || null });
    setBusy(false);
    if (acceptorError) { setError(`设置验收人失败：${acceptorError.message}`); return; }
    setNotice(acceptorId ? "最终验收负责人已指定。" : "已恢复由群主验收。");
    await load();
  }

  async function setCoordinator(coordinatorId: string) {
    const supabase = getSupabase();
    if (!supabase || !task || !coordinatorId) return;
    setBusy(true); setError(""); setNotice("");
    const { error: coordinatorError } = await supabase.rpc("set_task_coordinator", { p_task_id: task.id, p_coordinator_id: coordinatorId });
    setBusy(false);
    if (coordinatorError) { setError(`转交任务失败：${coordinatorError.message}`); return; }
    setNotice("任务协调工作已转交。");
    await load();
  }

  async function archive() {
    const supabase = getSupabase();
    if (!supabase || !task) return;
    setBusy(true); setError(""); setNotice("");
    const { error: archiveError } = await supabase.rpc("archive_task", { p_task_id: task.id });
    setBusy(false);
    if (archiveError) { setError(`归档失败：${archiveError.message}`); return; }
    setNotice("大任务已归档。");
    await load();
  }

  async function recordDelivery(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !task) return;
    setBusy(true); setError(""); setNotice("");
    const { error: deliveryError } = await supabase.rpc("record_external_delivery", {
      p_task_id: task.id, p_url: deliveryUrl.trim(), p_note: deliveryNote.trim(),
    });
    setBusy(false);
    if (deliveryError) { setError(`记录失败：${deliveryError.message}`); return; }
    setNotice("对外交付信息已记录。");
    await load();
  }

  const linkedIssueIds = new Set(links.map((link) => link.issue_id));
  const validWorkIssues = workIssues.filter((issue) => issue.reviewer_id && ["open", "in_progress"].includes(issue.status) && !linkedIssueIds.has(issue.id));

  return (
    <WorkspaceShell groups={groups} currentGroup={group} email={user?.email} title={task?.title || "大任务"} subtitle={task?.description || "任务说明、分工、成果和验收都在这里。"}>
      {!configured && <div className={styles.notice} role="status">请先按 web/README.md 配置 Supabase，再登录使用大任务。</div>}
      {configured && (loading || dataLoading) && <p className={styles.muted}>正在载入大任务…</p>}
      {!loading && !dataLoading && configured && (!group || !task) && <div className={styles.error} role="alert">没有找到这个任务，或你没有访问权限。<Link href="/groups">返回群组</Link></div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {task && group && <>
        <div className={styles.taskTop}>
          <Link href={`/groups/${group.id}`} className={styles.back}>群组大任务 <ChevronRight size={14} /> {task.title}</Link>
          <span className={`${styles.taskStatus} ${styles[task.status] || ""}`}>{taskStatusLabel(task.status)}</span>
        </div>
        <div className={styles.trail} aria-label="任务进度">
          <span className={styles.trailCurrent}><ClipboardList size={16} />任务说明</span><i />
          {issues.length > 0 && <><span><GitBranch size={16} />Issue 分工</span><i /></>}
          <span className={submissions.length ? styles.trailCurrent : ""}><FileText size={16} />成果版本</span><i />
          <span className={task.status === "accepted" || task.status === "archived" ? styles.trailDone : ""}><CheckCircle2 size={16} />最终验收</span>
        </div>

        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            <section className={styles.panel} aria-labelledby="task-info-title">
              <div className={styles.panelHeading}><div><span className={styles.kicker}>BRIEF</span><h2 id="task-info-title">任务说明</h2></div></div>
              <p className={styles.description}>{task.description || "任务发布者还没有填写详细说明。"}</p>
              <div className={styles.infoGrid}>
                <div><span>任务协调人</span><strong>{displayName(task.coordinator_id)}</strong></div>
                <div><span>最终验收人</span><strong>{displayName(effectiveAcceptor)}</strong></div>
                <div><span>截止日期</span><strong>{task.due_at ? new Date(task.due_at).toLocaleDateString("zh-CN") : "未设置"}</strong></div>
              </div>
              <div className={styles.referenceFiles}>
                <h3><Paperclip size={15} /> 任务参考文件</h3>
                {attachments.filter((attachment) => !attachment.submission_version_id).length === 0 && <p>还没有参考文件。</p>}
                {attachments.filter((attachment) => !attachment.submission_version_id).map((attachment) => <button key={attachment.id} type="button" onClick={() => downloadFile(attachment)}><FileText size={15} /><span>{attachment.file_name}</span><small>{Math.max(1, Math.round(attachment.size_bytes / 1024))} KB</small><Download size={14} /></button>)}
                {task.status === "open" && <div className={styles.fileUpload}><input type="file" multiple aria-label="选择任务参考文件" onChange={(event) => setReferenceFiles(Array.from(event.target.files || []))} /><button type="button" disabled={busy || !referenceFiles.length} onClick={uploadReferences}>上传参考文件</button></div>}
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="issues-title">
              <div className={styles.panelHeading}><div><span className={styles.kicker}>OPTIONAL WORK BREAKDOWN</span><h2 id="issues-title">Issue 分工与讨论 <em>{issues.length}</em></h2></div></div>
              <p className={styles.sectionNote}>简单任务可以跳过这一步，直接在下方提交最终成果。</p>
              {issues.length > 0 && <div className={styles.issueList}>{issues.map((issue) => <article key={issue.id} className={styles.issue}>
                <div className={styles.issueHead}><div><span className={`${styles.issueKind} ${issue.kind === "discussion" ? styles.discussion : ""}`}>{issue.kind === "discussion" ? "讨论" : "工作"}</span><span className={styles.issueState}>{issue.status === "resolved" || issue.status === "closed" ? "已解决" : "进行中"}</span>{issue.is_required && <span className={styles.required}>必需</span>}</div><span>{issue.due_at ? new Date(issue.due_at).toLocaleDateString("zh-CN") : ""}</span></div>
                <h3>{issue.title}</h3><p>{issue.body || "暂无补充说明"}</p>
                {issue.conclusion && <div className={styles.conclusion}><Check size={14} /> 结论：{issue.conclusion}</div>}
                <div className={styles.issueMeta}><span><Users size={13} />负责人：{displayName(issue.assignee_id)}</span>{issue.kind === "work" && <span><CheckCircle2 size={13} />审阅人：{displayName(issue.reviewer_id)}</span>}</div>
                <div className={styles.issueComments}><strong><MessageCircle size={13} /> 讨论记录</strong>
                  {comments.filter((comment) => comment.issue_id === issue.id).map((comment) => <div key={comment.id}><b>{displayName(comment.author_id)}</b><span>{comment.body}</span><small>{new Date(comment.created_at).toLocaleString("zh-CN")}</small></div>)}
                  {task.status === "open" && ["open", "in_progress"].includes(issue.status) && <form onSubmit={(event) => { event.preventDefault(); addIssueComment(issue.id); }}><input value={commentDrafts[issue.id] || ""} onChange={(event) => setCommentDrafts({ ...commentDrafts, [issue.id]: event.target.value })} placeholder="补充问题或记录讨论…" aria-label={`回复 ${issue.title}`} /><button type="submit" disabled={busy || !commentDrafts[issue.id]?.trim()}>回复</button></form>}
                </div>
                {canCoordinate && task.status === "open" && <div className={styles.assignment}>
                  <select aria-label={`${issue.title} 的负责人`} value={assignments[issue.id]?.assignee || ""} onChange={(event) => setAssignments({ ...assignments, [issue.id]: { ...(assignments[issue.id] || { reviewer: "" }), assignee: event.target.value } })}><option value="">选择负责人</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{displayName(member.user_id)}</option>)}</select>
                  {issue.kind === "work" && <select aria-label={`${issue.title} 的审阅人`} value={assignments[issue.id]?.reviewer || ""} onChange={(event) => setAssignments({ ...assignments, [issue.id]: { ...(assignments[issue.id] || { assignee: "" }), reviewer: event.target.value } })}><option value="">选择审阅人</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{displayName(member.user_id)}</option>)}</select>}
                  <button type="button" disabled={busy} onClick={() => assignIssue(issue.id)}>保存分工</button>
                  <button type="button" disabled={busy} onClick={() => toggleIssueRequired(issue)}>{issue.is_required ? "改为可选" : "改为必需"}</button>
                </div>}
                {task.status === "open" && issue.kind === "discussion" && issue.status !== "closed" && (canCoordinate || issue.created_by === user?.id) && <div className={styles.closeDiscussion}><input aria-label={`${issue.title} 的讨论结论`} placeholder="写下讨论结论…" value={conclusions[issue.id] || ""} onChange={(event) => setConclusions({ ...conclusions, [issue.id]: event.target.value })} /><button type="button" disabled={busy || !conclusions[issue.id]?.trim()} onClick={() => closeDiscussion(issue.id)}>记录结论并关闭</button></div>}
              </article>)}</div>}
              {task.status === "open" && <form className={styles.issueForm} onSubmit={createIssue}>
                <h3><Plus size={17} /> 添加 Issue</h3>
                <div className={styles.formRow}><label>类型<select value={issueKind} onChange={(event) => setIssueKind(event.target.value as "work" | "discussion")}><option value="work">工作分工</option><option value="discussion">讨论与决定</option></select></label><label>期限 <small>可选</small><input type="date" value={issueDue} onChange={(event) => setIssueDue(event.target.value)} /></label></div>
                <label>标题<input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="需要完成或讨论什么？" maxLength={140} required /></label>
                <label>说明<textarea value={issueBody} onChange={(event) => setIssueBody(event.target.value)} placeholder="背景、分工要求或需要做的决定…" rows={3} /></label>
                {canCoordinate && <label className={styles.checkLine}><input type="checkbox" checked={issueRequired} onChange={(event) => setIssueRequired(event.target.checked)} /> 完成大任务前必须解决</label>}
                <button type="submit" disabled={busy}>创建 Issue <ArrowRight size={15} /></button>
              </form>}
            </section>

            <section className={styles.panel} aria-labelledby="submissions-title">
              <div className={styles.panelHeading}><div><span className={styles.kicker}>WORK & REVIEW</span><h2 id="submissions-title">成果与审阅 <em>{submissions.length}</em></h2></div></div>
              {submissions.length === 0 && <div className={styles.empty}><FileText size={24} /><strong>还没有提交成果</strong><p>可以直接提交最终成果；如果有 Issue，也能先提交分工成果供指定成员审阅。</p></div>}
              <div className={styles.submissionList}>{submissions.map((submission) => {
                const relatedVersions = versions.filter((version) => version.submission_id === submission.id).sort((a, b) => b.version_number - a.version_number);
                const relatedDecisions = decisions.filter((decision) => decision.submission_id === submission.id);
                const issueIds = links.filter((link) => link.submission_id === submission.id).map((link) => link.issue_id);
                const relatedIssues = issues.filter((issue) => issueIds.includes(issue.id));
                const reviewerId = submission.kind === "final" ? effectiveAcceptor : relatedIssues[0]?.reviewer_id;
                const canEdit = Boolean(task.status === "open" && (user?.id === submission.created_by || canCoordinate));
                const hasDraftVersion = relatedVersions[0]?.status === "draft";
                return <SubmissionCard key={submission.id} submission={submission} versions={relatedVersions} decisions={relatedDecisions} attachments={attachments.filter((attachment) => relatedVersions.some((version) => version.id === attachment.submission_version_id))} issueTitles={relatedIssues.map((issue) => issue.title)} reviewer={displayName(reviewerId)} canReview={Boolean(task.status === "open" && user?.id === reviewerId && submission.status === "pending")} canRevise={Boolean(canEdit && !hasDraftVersion && ["draft", "changes_requested"].includes(submission.status))} canAttach={Boolean(canEdit && hasDraftVersion)} busy={busy} onReview={review} onVersion={addVersion} onUpload={addFilesToVersion} onPublish={publishVersion} onDownload={downloadFile} />;
              })}</div>
              {task.status === "open" && <form className={styles.submitForm} onSubmit={createSubmission}>
                <h3><Send size={17} /> 提交新成果</h3>
                <div className={styles.kindPicker}><label className={submissionKind === "final" ? styles.selected : ""}><input type="radio" name="submission-kind" value="final" checked={submissionKind === "final"} onChange={() => setSubmissionKind("final")} /><strong>最终成果</strong><span>简单任务直接提交；复杂任务汇总后提交</span></label><label className={submissionKind === "issue" ? styles.selected : ""}><input type="radio" name="submission-kind" value="issue" checked={submissionKind === "issue"} onChange={() => setSubmissionKind("issue")} disabled={!workIssues.length} /><strong>Issue 成果</strong><span>先让指定审阅人检查某项分工</span></label></div>
                {submissionKind === "issue" && <div className={styles.issueChecks}><strong>关联工作型 Issue</strong>{validWorkIssues.length ? validWorkIssues.map((issue) => {
                  const selectedReviewer = workIssues.find((item) => item.id === selectedIssues[0])?.reviewer_id;
                  const incompatible = Boolean(selectedReviewer && issue.reviewer_id !== selectedReviewer && !selectedIssues.includes(issue.id));
                  return <label key={issue.id}><input type="checkbox" checked={selectedIssues.includes(issue.id)} disabled={incompatible} onChange={(event) => setSelectedIssues(event.target.checked ? [...selectedIssues, issue.id] : selectedIssues.filter((id) => id !== issue.id))} />{issue.title} <small>审阅人：{displayName(issue.reviewer_id)}</small></label>;
                }) : <p>暂无可关联的工作型 Issue。请协调人指定审阅人；已有成果的 Issue 请在原成果下提交新版本。</p>}<p>同一份 Issue 成果只能关联审阅人相同的工作。</p></div>}
                {submissionKind === "final" && requiredOpen.length > 0 && <p className={styles.warning}>还有 {requiredOpen.length} 个必需 Issue 未解决；请先完成后再提交最终成果。</p>}
                {submissionKind === "final" && finalSubmission && <p className={styles.warning}>已有最终成果。需要修改时，请在上方对应成果中提交新版本。</p>}
                <label>本次提交摘要<input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="例如：课程展示最终版" maxLength={160} required /></label>
                <label>说明<textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="说明改了什么、还有哪些需要注意…" rows={4} /></label>
                <label>成果链接 <small>可选</small><div className={styles.linkInput}><Link2 size={16} /><input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" /></div></label>
                <label>成果文件 <small>可选，单文件不超过 25 MiB</small><input type="file" multiple onChange={(event) => setSubmissionFiles(Array.from(event.target.files || []))} /></label>
                <button type="submit" disabled={busy || (submissionKind === "issue" && !selectedIssues.length) || (submissionKind === "final" && (requiredOpen.length > 0 || Boolean(finalSubmission)))}>{busy ? "正在提交…" : "提交成果"}<ArrowRight size={16} /></button>
              </form>}
            </section>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.sidePanel}><div className={styles.sideTitle}><Users size={17} /><h2>责任与验收</h2></div><p>任务协调人管理分工；最终成果由群主或群主指定的验收负责人验收。</p><div className={styles.roleRow}><span>任务协调人</span><strong>{displayName(task.coordinator_id)}</strong></div><div className={styles.roleRow}><span>最终验收人</span><strong>{displayName(effectiveAcceptor)}</strong></div>
              {(canCoordinate || isOwner) && task.status === "open" && <label className={styles.acceptorSelect}><Settings2 size={14} />转交任务协调人<select value={task.coordinator_id} onChange={(event) => setCoordinator(event.target.value)} disabled={busy}>{members.map((member) => <option key={member.user_id} value={member.user_id}>{displayName(member.user_id)}</option>)}</select></label>}
              {isOwner && task.status === "open" && <label className={styles.acceptorSelect}><Settings2 size={14} />指定验收负责人<select value={task.acceptor_id || ""} onChange={(event) => setAcceptor(event.target.value)} disabled={busy}><option value="">默认：群主（你）</option>{members.filter((member) => member.user_id !== group.owner_id).map((member) => <option key={member.user_id} value={member.user_id}>{displayName(member.user_id)}</option>)}</select></label>}
            </section>
            <section className={styles.sidePanel}><div className={styles.sideTitle}><CalendarDays size={17} /><h2>任务进度</h2></div><div className={styles.progressRow}><span>Issue</span><strong>{issues.filter((issue) => ["resolved", "closed"].includes(issue.status)).length} / {issues.length}</strong></div><div className={styles.progressRow}><span>成果提交</span><strong>{submissions.filter((submission) => submission.status === "approved").length} / {submissions.length}</strong></div><div className={styles.progressRow}><span>最终成果</span><strong>{finalSubmission ? submissionStatusLabel(finalSubmission.status) : "尚未提交"}</strong></div>
              {task.status === "accepted" && canAccept && <button className={styles.archive} type="button" onClick={archive} disabled={busy}><CheckCircle2 size={15} /> 标记完成并归档</button>}
              {task.status === "archived" && <div className={styles.archived}><CheckCircle2 size={15} /> 已归档</div>}
            </section>
            {(task.status === "accepted" || task.external_delivered_at) && <section className={styles.sidePanel}><div className={styles.sideTitle}><Link2 size={17} /><h2>对外交付</h2></div>
              {task.external_delivered_at ? <p>最近记录：{new Date(task.external_delivered_at).toLocaleString("zh-CN")}</p> : <p>验收通过后，记录提交到比赛、课程或志愿平台的结果。</p>}
              {task.external_delivery_url && <a className={styles.deliveryLink} href={task.external_delivery_url} target="_blank" rel="noopener noreferrer">查看交付链接 <ArrowRight size={13} /></a>}
              {task.external_delivery_note && <p className={styles.deliveryNote}>{task.external_delivery_note}</p>}
              {task.status === "accepted" && (canCoordinate || canAccept) && <form className={styles.deliveryForm} onSubmit={recordDelivery}><label>交付链接 <small>可选</small><input type="url" value={deliveryUrl} onChange={(event) => setDeliveryUrl(event.target.value)} placeholder="https://…" /></label><label>交付记录 <small>可选</small><textarea value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} rows={3} placeholder="例如：10 月 12 日已提交至比赛官网" /></label><button type="submit" disabled={busy || (!deliveryUrl.trim() && !deliveryNote.trim())}>保存交付记录</button></form>}
            </section>}
            <Link className={styles.chatJump} href={`/groups/${group.id}/chat`}><MessageCircle size={17} /><div><strong>去群聊讨论</strong><span>快速交流留在群聊，结论写回 Issue。</span></div><ArrowRight size={16} /></Link>
          </aside>
        </div>
      </>}
    </WorkspaceShell>
  );
}

function SubmissionCard({ submission, versions, decisions, attachments, issueTitles, reviewer, canReview, canRevise, canAttach, busy, onReview, onVersion, onUpload, onPublish, onDownload }: {
  submission: Submission;
  versions: SubmissionVersion[];
  decisions: ReviewDecision[];
  attachments: Attachment[];
  issueTitles: string[];
  reviewer: string;
  canReview: boolean;
  canRevise: boolean;
  canAttach: boolean;
  busy: boolean;
  onReview: (id: string, decision: "approved" | "changes_requested", comment: string) => Promise<void>;
  onVersion: (id: string, summary: string, body: string, link: string, files: File[]) => Promise<boolean>;
  onUpload: (versionId: string, files: File[]) => Promise<boolean>;
  onPublish: (versionId: string) => Promise<boolean>;
  onDownload: (attachment: Attachment) => Promise<void>;
}) {
  const latest = versions[0];
  const [comment, setComment] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [revisionSummary, setRevisionSummary] = useState("");
  const [revisionBody, setRevisionBody] = useState("");
  const [revisionLink, setRevisionLink] = useState("");
  const [revisionFiles, setRevisionFiles] = useState<File[]>([]);
  const [moreFiles, setMoreFiles] = useState<File[]>([]);

  return <article className={styles.submission}>
    <div className={styles.submissionHead}><div><span className={styles.subKind}>{submission.kind === "final" ? "最终成果" : "Issue 成果"}</span><span className={`${styles.subStatus} ${styles[latest?.status === "draft" ? "draft" : submission.status] || ""}`}>{latest?.status === "draft" ? "草稿待发布" : submissionStatusLabel(submission.status)}</span></div><small>{latest ? `v${latest.version_number}` : "未提交版本"}</small></div>
    <h3>{latest?.summary || "待提交的成果草稿"}</h3>
    {issueTitles.length > 0 && <p className={styles.linkedIssues}>关联 Issue：{issueTitles.join("、")}</p>}
    {latest?.body && <p className={styles.versionBody}>{latest.body}</p>}
    {latest?.link_url && <a className={styles.outbound} href={latest.link_url} target="_blank" rel="noopener noreferrer"><Link2 size={14} />查看成果链接 <ArrowRight size={13} /></a>}
    {latest && attachments.filter((attachment) => attachment.submission_version_id === latest.id).map((attachment) => <button key={attachment.id} className={styles.subFile} type="button" onClick={() => onDownload(attachment)}><Paperclip size={14} />{attachment.file_name}<Download size={13} /></button>)}
    <div className={styles.reviewer}>审阅／验收人：{reviewer}</div>
    {decisions[0] && <div className={styles.reviewNote}><strong>{latest?.status === "draft" ? "上一轮意见" : decisions[0].decision === "approved" ? "已通过" : "要求修改"}</strong>{decisions[0].comment && <span>“{decisions[0].comment}”</span>}</div>}
    {(versions.length > 1 || decisions.length > 0) && <button className={styles.historyToggle} type="button" onClick={() => setShowHistory(!showHistory)}>{showHistory ? "收起版本与意见" : `查看版本与意见（${versions.length} 个版本）`}</button>}
    {showHistory && <div className={styles.history}>{versions.map((version) => <div key={version.id}><strong>版本 {version.version_number} · {version.summary}</strong><small>{new Date(version.created_at).toLocaleString("zh-CN")}</small>{version.body && <p>{version.body}</p>}{attachments.filter((attachment) => attachment.submission_version_id === version.id).map((attachment) => <button key={attachment.id} className={styles.subFile} type="button" onClick={() => onDownload(attachment)}><Paperclip size={13} />{attachment.file_name}<Download size={13} /></button>)}{decisions.filter((decision) => decision.version_id === version.id).map((decision) => <p key={decision.id} className={styles.historyDecision}>{decision.decision === "approved" ? "通过" : "要求修改"}：{decision.comment || "无补充意见"}</p>)}</div>)}</div>}
    {canAttach && latest && <div className={styles.extraFiles}><label>给草稿版本补充文件<input type="file" multiple onChange={(event) => setMoreFiles(Array.from(event.target.files || []))} /></label><button type="button" disabled={busy || !moreFiles.length} onClick={async () => { const succeeded = await onUpload(latest.id, moreFiles); if (succeeded) setMoreFiles([]); }}>上传附件</button><button type="button" disabled={busy || moreFiles.length > 0} onClick={() => onPublish(latest.id)}>发布给审阅人</button></div>}
    {canReview && <div className={styles.reviewActions}><label>对当前版本的意见<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="写下修改建议或通过理由…" /></label><div><button type="button" onClick={() => onReview(submission.id, "changes_requested", comment)} disabled={busy || !comment.trim()}><RotateCcw size={14} />要求修改</button><button type="button" onClick={() => onReview(submission.id, "approved", comment)} disabled={busy}><Check size={14} />通过</button></div></div>}
    {canRevise && <form className={styles.revision} onSubmit={async (event) => { event.preventDefault(); const succeeded = await onVersion(submission.id, revisionSummary, revisionBody, revisionLink, revisionFiles); if (succeeded) { setRevisionSummary(""); setRevisionBody(""); setRevisionLink(""); setRevisionFiles([]); } }}><strong>{submission.status === "draft" ? "完成草稿" : "提交修改后的新版本"}</strong><input value={revisionSummary} onChange={(event) => setRevisionSummary(event.target.value)} placeholder="本次修改摘要" required maxLength={160} /><textarea value={revisionBody} onChange={(event) => setRevisionBody(event.target.value)} placeholder="修改说明" rows={2} /><input type="url" value={revisionLink} onChange={(event) => setRevisionLink(event.target.value)} placeholder="成果链接（可选）" /><input type="file" multiple aria-label="为新版本添加文件" onChange={(event) => setRevisionFiles(Array.from(event.target.files || []))} /><button type="submit" disabled={busy}>提交新版本 <ArrowRight size={14} /></button></form>}
  </article>;
}
