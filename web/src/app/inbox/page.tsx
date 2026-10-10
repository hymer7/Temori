"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Check, Clock3, RefreshCw, RotateCcw, Users, X } from "lucide-react";
import WorkspaceShell from "@/components/WorkspaceShell";
import { getSupabase } from "@/lib/supabase";
import type { Group, Profile, Submission, Task } from "@/lib/types";
import { useViewer } from "@/lib/use-viewer";
import styles from "./page.module.css";

type JoinRequest = {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
};
type InboxTask = Pick<Task, "id" | "group_id" | "title" | "status" | "coordinator_id" | "acceptor_id">;
type IssueReviewer = { id: string; reviewer_id: string | null; status: string };
type SubmissionIssue = { submission_id: string; issue_id: string };
type RevisionDecision = { submission_id: string; comment: string; created_at: string };
type JoinItem = { request: JoinRequest; group: Group; person: string };
type SubmissionItem = { submission: Submission; task: InboxTask; group: Group; comment?: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function InboxPage() {
  const { user, loading: viewerLoading, configured } = useViewer();
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinItems, setJoinItems] = useState<JoinItem[]>([]);
  const [reviewItems, setReviewItems] = useState<SubmissionItem[]>([]);
  const [revisionItems, setRevisionItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const userId = user?.id;
    if (!supabase || !userId) return;

    setLoading(true);
    setError("");
    try {
      const { data: groupRows, error: groupError } = await supabase
        .from("groups")
        .select("id, group_number, name, description, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (groupError) throw groupError;
      const nextGroups = (groupRows ?? []) as Group[];
      setGroups(nextGroups);

      const ownedIds = nextGroups.filter((group) => group.owner_id === userId).map((group) => group.id);
      const groupIds = nextGroups.map((group) => group.id);
      const groupById = new Map(nextGroups.map((group) => [group.id, group]));

      const [requestResult, taskResult] = await Promise.all([
        ownedIds.length
          ? supabase.from("group_join_requests")
              .select("id, group_id, user_id, created_at")
              .in("group_id", ownedIds).eq("status", "pending")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as JoinRequest[], error: null }),
        groupIds.length
          ? supabase.from("tasks")
              .select("id, group_id, title, status, coordinator_id, acceptor_id")
              .in("group_id", groupIds).eq("status", "open")
          : Promise.resolve({ data: [] as InboxTask[], error: null }),
      ]);
      if (requestResult.error) throw requestResult.error;
      if (taskResult.error) throw taskResult.error;

      const requests = (requestResult.data ?? []) as JoinRequest[];
      const tasks = (taskResult.data ?? []) as InboxTask[];
      const taskIds = tasks.map((task) => task.id);
      const taskById = new Map(tasks.map((task) => [task.id, task]));

      const [profileResult, submissionResult] = await Promise.all([
        requests.length
          ? supabase.from("profiles")
              .select("id, display_name")
              .in("id", [...new Set(requests.map((request) => request.user_id))])
          : Promise.resolve({ data: [] as Profile[], error: null }),
        taskIds.length
          ? supabase.from("submissions")
              .select("id, task_id, kind, status, created_by, created_at")
              .in("task_id", taskIds)
              .in("status", ["pending", "changes_requested"])
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as Submission[], error: null }),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (submissionResult.error) throw submissionResult.error;

      const profileById = new Map(((profileResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      setJoinItems(requests.flatMap((request) => {
        const group = groupById.get(request.group_id);
        if (!group || group.owner_id !== userId) return [];
        return [{
          request,
          group,
          person: profileById.get(request.user_id)?.display_name || `用户 ${request.user_id.slice(0, 8)}`,
        }];
      }));

      const submissions = (submissionResult.data ?? []) as Submission[];
      const pendingIssueIds = submissions
        .filter((submission) => submission.status === "pending" && submission.kind === "issue")
        .map((submission) => submission.id);
      const revisions = submissions.filter((submission) => {
        const task = taskById.get(submission.task_id);
        return submission.status === "changes_requested"
          && (submission.created_by === userId || task?.coordinator_id === userId);
      });

      const [linkResult, decisionResult] = await Promise.all([
        pendingIssueIds.length
          ? supabase.from("submission_issues")
              .select("submission_id, issue_id")
              .in("submission_id", pendingIssueIds)
          : Promise.resolve({ data: [] as SubmissionIssue[], error: null }),
        revisions.length
          ? supabase.from("review_decisions")
              .select("submission_id, comment, created_at")
              .in("submission_id", revisions.map((submission) => submission.id))
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as RevisionDecision[], error: null }),
      ]);
      if (linkResult.error) throw linkResult.error;
      if (decisionResult.error) throw decisionResult.error;

      const links = (linkResult.data ?? []) as SubmissionIssue[];
      const issueIds = [...new Set(links.map((link) => link.issue_id))];
      const issueResult = issueIds.length
        ? await supabase.from("issues").select("id, reviewer_id, status").in("id", issueIds)
        : { data: [] as IssueReviewer[], error: null };
      if (issueResult.error) throw issueResult.error;
      const issueById = new Map(((issueResult.data ?? []) as IssueReviewer[]).map((issue) => [issue.id, issue]));
      const linksBySubmission = new Map<string, string[]>();
      for (const link of links) {
        linksBySubmission.set(link.submission_id, [...(linksBySubmission.get(link.submission_id) ?? []), link.issue_id]);
      }

      const toItem = (submission: Submission, comment?: string): SubmissionItem | null => {
        const task = taskById.get(submission.task_id);
        const group = task && groupById.get(task.group_id);
        return task && group ? { submission, task, group, comment } : null;
      };

      const reviews = submissions.filter((submission) => {
        if (submission.status !== "pending") return false;
        const task = taskById.get(submission.task_id);
        if (!task) return false;
        if (submission.kind === "final") {
          const group = groupById.get(task.group_id);
          return (task.acceptor_id ?? group?.owner_id) === userId;
        }
        const linked = linksBySubmission.get(submission.id) ?? [];
        return linked.length > 0 && linked.every((issueId) => {
          const issue = issueById.get(issueId);
          return issue?.reviewer_id === userId && ["open", "in_progress"].includes(issue.status);
        });
      });
      setReviewItems(reviews.flatMap((submission) => {
        const item = toItem(submission);
        return item ? [item] : [];
      }));

      const latestComment = new Map<string, string>();
      for (const decision of (decisionResult.data ?? []) as RevisionDecision[]) {
        if (!latestComment.has(decision.submission_id)) {
          latestComment.set(decision.submission_id, decision.comment);
        }
      }
      setRevisionItems(revisions.flatMap((submission) => {
        const item = toItem(submission, latestComment.get(submission.id));
        return item ? [item] : [];
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "待处理事项加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function decide(requestId: string, approve: boolean) {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusyRequest(requestId);
    setError("");
    setNotice("");
    const { error: decisionError } = await supabase.rpc("decide_join_request", {
      p_request_id: requestId,
      p_approve: approve,
    });
    setBusyRequest(null);
    if (decisionError) {
      setError(`处理入群申请失败：${decisionError.message}`);
      return;
    }
    setNotice(approve ? "已批准加入申请。" : "已拒绝加入申请。");
    await load();
  }

  const total = joinItems.length + reviewItems.length + revisionItems.length;

  return (
    <WorkspaceShell groups={groups} email={user?.email} title="待处理" subtitle="需要你做决定、审阅或修改的事项都在这里。">
      {!configured && <div className={styles.setup} role="status"><strong>还差一步接入服务</strong><span>配置 Supabase 后，这里会显示真实的团队待办。设置方法见 web/README.md。</span></div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <div className={styles.intro}>
        <div>
          <span className={styles.kicker}>YOUR INBOX</span>
          <h2>你的下一步</h2>
          <p>按团队当前进度整理，处理后刷新即可看到最新结果。</p>
        </div>
        <div className={styles.introActions}>
          <span className={styles.total}>{loading ? "更新中…" : `${total} 项待处理`}</span>
          <button type="button" className={styles.refresh} onClick={() => { void load(); }} disabled={!configured || !user || loading} aria-label="刷新待处理事项" title="刷新待处理事项"><RefreshCw size={17} /></button>
        </div>
      </div>

      {(viewerLoading || loading) && <p className={styles.loading} role="status">正在整理待处理事项…</p>}
      {!viewerLoading && !loading && configured && !error && total === 0 && <div className={styles.allDone}><span><Check size={25} /></span><strong>目前都处理好了</strong><p>新的加入申请、待审阅提交和修改意见会出现在这里。</p><Link href="/groups">返回我的群组 <ArrowRight size={15} /></Link></div>}

      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="join-heading">
          <div className={styles.sectionHead}><span className={styles.sectionIcon}><Users size={18} /></span><div><h2 id="join-heading">入群申请</h2><p>你作为群主需要批准</p></div><span className={styles.count}>{joinItems.length}</span></div>
          <div className={styles.items}>
            {joinItems.map(({ request, group, person }) => <article className={styles.card} key={request.id}>
              <span className={styles.meta}>{group.name} · {formatDate(request.created_at)}</span>
              <h3>{person} 申请加入</h3>
              <p>批准后，这位同学就能查看群组并参与任务。</p>
              <div className={styles.joinActions}>
                <button type="button" onClick={() => { void decide(request.id, false); }} disabled={busyRequest !== null}><X size={14} /> 拒绝</button>
                <button type="button" className={styles.approve} onClick={() => { void decide(request.id, true); }} disabled={busyRequest !== null}><Check size={14} /> {busyRequest === request.id ? "处理中…" : "批准加入"}</button>
              </div>
            </article>)}
            {!loading && joinItems.length === 0 && <p className={styles.sectionEmpty}>暂无待审批的入群申请</p>}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="review-heading">
          <div className={styles.sectionHead}><span className={styles.sectionIcon}><Clock3 size={18} /></span><div><h2 id="review-heading">等待你审阅</h2><p>检查成果，再决定通过或要求修改</p></div><span className={styles.count}>{reviewItems.length}</span></div>
          <div className={styles.items}>
            {reviewItems.map(({ submission, task, group }) => <Link href={`/groups/${group.id}/tasks/${task.id}`} className={styles.cardLink} key={submission.id}>
              <span className={styles.meta}>{group.name} · {formatDate(submission.created_at)}</span>
              <h3>{task.title}</h3>
              <p>{submission.kind === "final" ? "最终成果待你验收" : "Issue 成果待你审阅"}</p>
              <span className={styles.open}>打开任务审阅 <ArrowRight size={15} /></span>
            </Link>)}
            {!loading && reviewItems.length === 0 && <p className={styles.sectionEmpty}>暂无等待你审阅的成果</p>}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="revision-heading">
          <div className={styles.sectionHead}><span className={styles.sectionIcon}><RotateCcw size={18} /></span><div><h2 id="revision-heading">需要修改</h2><p>你的提交或你协调的任务收到了意见</p></div><span className={styles.count}>{revisionItems.length}</span></div>
          <div className={styles.items}>
            {revisionItems.map(({ submission, task, group, comment }) => <Link href={`/groups/${group.id}/tasks/${task.id}`} className={styles.cardLink} key={submission.id}>
              <span className={styles.meta}>{group.name} · {submission.kind === "final" ? "最终成果" : "Issue 成果"}</span>
              <h3>{task.title}</h3>
              {comment && <p className={styles.feedback}>“{comment}”</p>}
              {!comment && <p>审阅人要求修改，打开任务查看详情。</p>}
              <span className={styles.open}>查看意见并提交新版本 <ArrowRight size={15} /></span>
            </Link>)}
            {!loading && revisionItems.length === 0 && <p className={styles.sectionEmpty}>暂无需要你修改的提交</p>}
          </div>
        </section>
      </div>
      <div className={styles.footnote}><Bell size={15} /><span>这里显示当前状态；有新变化时，点击右上角刷新。</span></div>
    </WorkspaceShell>
  );
}
