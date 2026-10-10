"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ClipboardList, Copy, MessageCircle, Plus } from "lucide-react";
import WorkspaceShell from "@/components/WorkspaceShell";
import { getSupabase } from "@/lib/supabase";
import { useViewer } from "@/lib/use-viewer";
import type { Group, Task } from "@/lib/types";
import styles from "./page.module.css";

function statusLabel(status: string) {
  if (status === "accepted") return "已验收";
  if (status === "archived") return "已归档";
  return "进行中";
}

export default function GroupOverview({ groupId }: { groupId: string }) {
  const { user, loading, configured } = useViewer();
  const [group, setGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    setDataLoading(true);
    const [groupResult, groupsResult, tasksResult, membersResult] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", groupId),
    ]);
    if (groupResult.error) setError(groupResult.error.message);
    setGroup((groupResult.data as Group | null) || null);
    setGroups((groupsResult.data || []) as Group[]);
    setTasks((tasksResult.data || []) as Task[]);
    setMemberCount(membersResult.count || 0);
    setDataLoading(false);
  }, [groupId, user]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function createTask(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !user || !group) return;
    setBusy(true); setError(""); setMessage("");
    const { error: insertError } = await supabase.from("tasks").insert({
      group_id: group.id,
      title: title.trim(),
      description: description.trim(),
      due_at: dueAt ? new Date(`${dueAt}T23:59:00`).toISOString() : null,
      created_by: user.id,
      coordinator_id: user.id,
    });
    setBusy(false);
    if (insertError) { setError(`创建失败：${insertError.message}`); return; }
    setTitle(""); setDescription(""); setDueAt("");
    setMessage("大任务已创建。可以直接提交成果，也可以先添加 Issue 分工。");
    await load();
  }

  async function copyGroupNumber() {
    if (!group) return;
    await navigator.clipboard.writeText(group.group_number);
    setMessage("群号已复制。组员可以用它搜索并申请加入。");
  }

  return (
    <WorkspaceShell groups={groups} currentGroup={group} email={user?.email} title={group?.name || "群组"} subtitle={group?.description || "在这里把小组任务推进到完成。"}>
      {!configured && <div className={styles.notice} role="status">团队空间正在准备中，试用开放后即可进入群组。</div>}
      {configured && (loading || dataLoading) && <p className={styles.hint}>正在载入群组…</p>}
      {!loading && !dataLoading && configured && !group && <div className={styles.error} role="alert">未找到群组，或你还没有加入。<Link href="/groups">返回我的群组</Link></div>}
      {message && <div className={styles.notice} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {group && <>
        <div className={styles.groupMeta}>
          <div className={styles.metaItem}><span>群号</span><button type="button" onClick={copyGroupNumber} title="复制群号"><strong>{group.group_number}</strong><Copy size={14} /></button></div>
          <div className={styles.metaItem}><span>成员</span><strong>{memberCount} 人</strong></div>
          <div className={styles.metaItem}><span>你的身份</span><strong>{group.owner_id === user?.id ? "群主" : "组员"}</strong></div>
          <Link href={`/groups/${group.id}/chat`} className={styles.chatLink}><MessageCircle size={16} /> 打开群聊 <ArrowRight size={16} /></Link>
        </div>

        <div className={styles.columns}>
          <section className={styles.taskSection} aria-labelledby="tasks-title">
            <div className={styles.sectionHead}><div><span className={styles.kicker}>TASK ARCHIVE</span><h2 id="tasks-title">大任务</h2></div><span>{tasks.length} 项</span></div>
            {tasks.length === 0 ? <div className={styles.empty}><ClipboardList size={25} /><strong>还没有大任务</strong><p>把你们正在做的第一件事写下来。简单任务可以直接提交成果。</p></div> :
              <div className={styles.taskList}>{tasks.map((task) => <Link key={task.id} href={`/groups/${group.id}/tasks/${task.id}`} className={styles.taskCard}>
                <div><span className={`${styles.status} ${styles[task.status] || ""}`}>{statusLabel(task.status)}</span>{task.due_at && <span className={styles.due}><CalendarDays size={13} /> {new Date(task.due_at).toLocaleDateString("zh-CN")}</span>}</div>
                <h3>{task.title}</h3><p>{task.description || "暂无说明"}</p>
                <span className={styles.enter}>查看任务 <ArrowRight size={15} /></span>
              </Link>)}</div>}
          </section>

          <section className={styles.createPanel} aria-labelledby="new-task-title">
            <div className={styles.panelIcon}><Plus size={19} /></div>
            <h2 id="new-task-title">发布大任务</h2>
            <p>群主和组员都可以发布。先说明目标，再决定是否要拆 Issue。</p>
            <form onSubmit={createTask} className={styles.form}>
              <label htmlFor="task-title">任务标题</label>
              <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成课程展示" maxLength={120} required disabled={busy} />
              <label htmlFor="task-description">任务说明</label>
              <textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="目标、要求、参考资料和交付方式…" rows={5} disabled={busy} />
              <label htmlFor="task-due">截止日期 <span>可选</span></label>
              <input id="task-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={busy} />
              <button type="submit" disabled={busy}>{busy ? "正在创建…" : "创建大任务"}<ArrowRight size={16} /></button>
            </form>
            <div className={styles.tip}><Check size={15} /> 创建后可以跳过 Issue，直接提交最终成果。</div>
          </section>
        </div>
      </>}
    </WorkspaceShell>
  );
}
