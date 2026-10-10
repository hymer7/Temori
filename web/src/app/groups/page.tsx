"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Hash, Plus, Search, Users } from "lucide-react";
import WorkspaceShell from "@/components/WorkspaceShell";
import { getSupabase } from "@/lib/supabase";
import { useViewer } from "@/lib/use-viewer";
import type { Group, Profile } from "@/lib/types";
import styles from "./page.module.css";

type JoinRequest = { id: string; group_id: string; user_id: string; created_at: string };
type SearchGroup = Pick<Group, "id" | "name" | "description" | "group_number">;

export default function GroupsPage() {
  const { user, loading, configured } = useViewer();
  const [groups, setGroups] = useState<Group[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [requesters, setRequesters] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [number, setNumber] = useState("");
  const [found, setFound] = useState<SearchGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    const [{ data: groupRows, error: groupError }, { data: requestRows }] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_join_requests").select("id, group_id, user_id, created_at").eq("status", "pending").order("created_at"),
    ]);
    if (groupError) setError(groupError.message);
    else setGroups((groupRows || []) as Group[]);
    const pendingRequests = (requestRows || []) as JoinRequest[];
    setRequests(pendingRequests);
    if (pendingRequests.length) {
      const { data: profileRows } = await supabase.from("profiles").select("id, display_name").in("id", [...new Set(pendingRequests.map((request) => request.user_id))]);
      setRequesters(Object.fromEntries(((profileRows || []) as Profile[]).map((profile) => [profile.id, profile.display_name || `用户 ${profile.id.slice(0, 8)}`])));
    } else setRequesters({});
  }, [user]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !name.trim()) return;
    setBusy(true); setError(""); setMessage("");
    const { data, error: createError } = await supabase.rpc("create_group", {
      p_name: name.trim(), p_description: description.trim(),
    });
    setBusy(false);
    if (createError) { setError(`创建失败：${createError.message}`); return; }
    setName(""); setDescription("");
    setMessage(`已创建「${(data as Group)?.name || name.trim()}」。把群号分享给组员即可。`);
    await load();
  }

  async function searchGroup(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !number.trim()) return;
    setBusy(true); setError(""); setMessage(""); setFound(null);
    const { data, error: searchError } = await supabase.rpc("search_group_by_number", { p_group_number: number.trim().toUpperCase() });
    setBusy(false);
    if (searchError) { setError(`搜索失败：${searchError.message}`); return; }
    const result = (data as SearchGroup[] | null)?.[0];
    if (!result) { setMessage("没有找到这个群号，请检查后重试。"); return; }
    setFound(result);
  }

  async function requestJoin() {
    const supabase = getSupabase();
    if (!supabase || !found) return;
    setBusy(true); setError(""); setMessage("");
    const { error: joinError } = await supabase.rpc("request_join_group", { p_group_number: found.group_number });
    setBusy(false);
    if (joinError) { setError(`申请失败：${joinError.message}`); return; }
    setMessage(`已向「${found.name}」发送加入申请，等待群主批准。`);
    setFound(null); setNumber("");
  }

  async function decide(requestId: string, approve: boolean) {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true); setError(""); setMessage("");
    const { error: decisionError } = await supabase.rpc("decide_join_request", { p_request_id: requestId, p_approve: approve });
    setBusy(false);
    if (decisionError) { setError(decisionError.message); return; }
    setMessage(approve ? "已批准成员加入。" : "已拒绝加入申请。");
    await load();
  }

  const pendingForOwned = requests.filter((request) => groups.some((group) => group.id === request.group_id && group.owner_id === user?.id));

  return (
    <WorkspaceShell groups={groups} email={user?.email} title="我的群组" subtitle="和同学在一个地方沟通、提交、审阅和完成任务。">
      {!configured && <div className={styles.setup} role="status"><strong>还差一步接入服务</strong><span>网站页面可以预览。配置 Supabase 地址与密钥后，邮箱登录和群组数据即可使用；见 web/README.md。</span></div>}
      {loading && <p className={styles.hint}>正在加载群组…</p>}
      {message && <p className={styles.notice} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.introRow}>
        <div><span className={styles.kicker}>YOUR SPACES</span><h2>一起做事的地方</h2></div>
        <span className={styles.count}>{groups.length} 个群组</span>
      </div>

      <div className={styles.groupGrid}>
        {groups.map((group) => <Link href={`/groups/${group.id}`} key={group.id} className={styles.groupCard}>
          <div className={styles.groupCardTop}><span className={styles.groupIcon}>{group.name.slice(0, 1)}</span><ArrowRight size={18} aria-hidden="true" /></div>
          <h3>{group.name}</h3>
          <p>{group.description || "把这次团队合作的事情放进来。"}</p>
          <div className={styles.groupCardFoot}><span><Hash size={13} aria-hidden="true" /> {group.group_number}</span><span>{group.owner_id === user?.id ? "你是群主" : "已加入"}</span></div>
        </Link>)}
        {groups.length === 0 && <div className={styles.emptyCard}>
          <Users size={25} aria-hidden="true" /><strong>还没有加入群组</strong><span>创建一个新群组，或用同学发来的群号申请加入。</span>
        </div>}
      </div>

      <div className={styles.actionGrid}>
        <section className={styles.panel} aria-labelledby="create-group-title">
          <div className={styles.panelHeading}><span className={styles.panelIcon}><Plus size={18} /></span><div><h2 id="create-group-title">创建群组</h2><p>为课程小组或比赛团队开一个独立空间</p></div></div>
          <form onSubmit={createGroup} className={styles.form}>
            <label htmlFor="group-name">群组名称</label>
            <input id="group-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：软件工程课程小组" maxLength={60} required disabled={!configured || busy} />
            <label htmlFor="group-description">一句话说明 <span>可选</span></label>
            <textarea id="group-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这个群组要一起完成什么？" rows={3} maxLength={280} disabled={!configured || busy} />
            <button className={styles.primary} type="submit" disabled={!configured || busy}>{busy ? "处理中…" : "创建并生成群号"}<ArrowRight size={16} /></button>
          </form>
        </section>
        <section className={styles.panel} aria-labelledby="join-group-title">
          <div className={styles.panelHeading}><span className={styles.panelIcon}><Search size={18} /></span><div><h2 id="join-group-title">通过群号加入</h2><p>找到同学的群组，向群主发送加入申请</p></div></div>
          <form onSubmit={searchGroup} className={styles.form}>
            <label htmlFor="group-number">六位群号</label>
            <input id="group-number" className={styles.numberInput} value={number} onChange={(event) => setNumber(event.target.value.toUpperCase())} placeholder="例如：K7M2Q9" maxLength={6} required disabled={!configured || busy} />
            <button className={styles.secondary} type="submit" disabled={!configured || busy}><Search size={16} /> 搜索群组</button>
          </form>
          {found && <div className={styles.searchResult}><div><strong>{found.name}</strong><p>{found.description || "暂无说明"}</p><small>群号 {found.group_number}</small></div><button type="button" onClick={requestJoin} disabled={busy}>申请加入</button></div>}
        </section>
      </div>

      {pendingForOwned.length > 0 && <section className={styles.pending} aria-labelledby="pending-title"><h2 id="pending-title">待你审批的加入申请 <span>{pendingForOwned.length}</span></h2>
        {pendingForOwned.map((request) => <div className={styles.request} key={request.id}><div><strong>{requesters[request.user_id] || `用户 ${request.user_id.slice(0, 8)}`} 申请加入</strong><p>{groups.find((group) => group.id === request.group_id)?.name}</p></div><div><button type="button" onClick={() => decide(request.id, false)} disabled={busy}>拒绝</button><button type="button" onClick={() => decide(request.id, true)} disabled={busy}>批准</button></div></div>)}
      </section>}
    </WorkspaceShell>
  );
}
