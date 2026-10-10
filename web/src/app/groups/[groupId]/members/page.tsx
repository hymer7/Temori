"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Crown, Hash, Users } from "lucide-react";
import WorkspaceShell from "@/components/WorkspaceShell";
import { getSupabase } from "@/lib/supabase";
import { useViewer } from "@/lib/use-viewer";
import type { Group, Profile } from "@/lib/types";
import styles from "./page.module.css";

type GroupMember = {
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

export default function GroupMembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { user, loading: viewerLoading, configured } = useViewer();
  const [groups, setGroups] = useState<Group[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !user) return;

    let active = true;
    async function load() {
      const { data: groupRows, error: groupError } = await supabase!.from("groups").select("*").order("created_at", { ascending: false });
      if (!active) return;
      if (groupError) {
        setError(`读取群组失败：${groupError.message}`);
        setLoading(false);
        return;
      }
      const visibleGroups = (groupRows || []) as Group[];
      const currentGroup = visibleGroups.find((item) => item.id === groupId) || null;
      setGroups(visibleGroups);
      setGroup(currentGroup);
      if (!currentGroup) {
        setError("群组不存在，或你尚未获准加入。");
        setLoading(false);
        return;
      }

      const { data: memberRows, error: memberError } = await supabase!
        .from("group_members")
        .select("group_id, user_id, role, joined_at")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true });
      if (!active) return;
      if (memberError) {
        setError(`读取成员失败：${memberError.message}`);
        setLoading(false);
        return;
      }

      const visibleMembers = (memberRows || []) as GroupMember[];
      visibleMembers.sort((a, b) => (a.user_id === currentGroup.owner_id ? -1 : b.user_id === currentGroup.owner_id ? 1 : 0));
      setMembers(visibleMembers);
      if (visibleMembers.length > 0) {
        const { data: profileRows, error: profileError } = await supabase!
          .from("profiles")
          .select("id, display_name")
          .in("id", visibleMembers.map((member) => member.user_id));
        if (!active) return;
        if (profileError) setError(`读取成员资料失败：${profileError.message}`);
        else setProfiles(Object.fromEntries(((profileRows || []) as Profile[]).map((profile) => [profile.id, profile.display_name || "成员"])));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [groupId, user]);

  async function copyGroupNumber() {
    if (group?.id !== groupId) return;
    try {
      await navigator.clipboard.writeText(group.group_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("复制失败，可以直接选中群号分享给组员。");
    }
  }

  const visibleGroup = group?.id === groupId ? group : null;
  const ownerName = visibleGroup ? profiles[visibleGroup.owner_id] || (visibleGroup.owner_id === user?.id ? "我" : "成员") : "";

  return (
    <WorkspaceShell groups={groups} currentGroup={visibleGroup} email={user?.email} title="群组成员" subtitle="查看和你一起完成任务的同学。">
      {!configured && <p className={styles.notice} role="status">试用开放后即可查看群组成员。</p>}
      {(viewerLoading || loading) && configured && <p className={styles.notice} role="status">正在加载成员…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {visibleGroup && <>
        <section className={styles.summary} aria-label="群组信息">
          <div className={styles.summaryText}>
            <span className={styles.kicker}>GROUP PROFILE</span>
            <h2>{visibleGroup.name}</h2>
            <p>{visibleGroup.description || "这个群组还没有简介。"}</p>
            <div className={styles.summaryMeta}>
              <span><Crown size={15} aria-hidden="true" /> 群主：{ownerName}</span>
              <span><Users size={15} aria-hidden="true" /> {members.length} 位成员</span>
            </div>
          </div>
          <div className={styles.groupNumber}>
            <span>邀请同学时分享群号</span>
            <strong><Hash size={20} aria-hidden="true" />{visibleGroup.group_number}</strong>
            <button type="button" onClick={copyGroupNumber}>{copied ? "已复制" : "复制群号"}</button>
            <small>同学申请加入后，由群主审批。</small>
          </div>
        </section>

        <section className={styles.list} aria-label="成员列表">
          <div className={styles.listHeader}><div><h2>全部成员</h2><p>群组内容仅对已加入的成员开放</p></div><span>{members.length} 人</span></div>
          {members.length === 0 && <p className={styles.empty}>暂无成员信息。</p>}
          {members.map((member) => {
            const name = profiles[member.user_id] || (member.user_id === user?.id ? "我" : "成员");
            const owner = member.user_id === visibleGroup.owner_id;
            return <div key={member.user_id} className={styles.member}>
              <span className={styles.avatar} aria-hidden="true">{name.slice(0, 1)}</span>
              <div className={styles.memberName}><strong>{name}{member.user_id === user?.id && <span>（我）</span>}</strong><small>{owner ? "创建群组" : `加入于 ${new Date(member.joined_at).toLocaleDateString("zh-CN")}`}</small></div>
              <span className={owner ? styles.ownerBadge : styles.memberBadge}>{owner ? "群主" : "成员"}</span>
            </div>;
          })}
        </section>
        <Link href={`/groups/${groupId}`} className={styles.back}><ArrowLeft size={15} aria-hidden="true" /> 返回大任务</Link>
      </>}
    </WorkspaceShell>
  );
}
