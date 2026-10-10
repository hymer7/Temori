"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import WorkspaceShell from "@/components/WorkspaceShell";
import { getSupabase } from "@/lib/supabase";
import { useViewer } from "@/lib/use-viewer";
import type { Group, Profile } from "@/lib/types";
import styles from "./page.module.css";

// The database column is author_id; keep this local until the shared type is aligned.
type Message = {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export default function GroupChatPage() {
  return <Suspense fallback={<p>正在载入群聊…</p>}><GroupChatRoute /></Suspense>;
}

function GroupChatRoute() {
  const groupId = useSearchParams().get("groupId");
  if (!groupId) return <p>缺少群组编号。<Link href="/groups">返回我的群组</Link></p>;
  return <GroupChatContent groupId={groupId} />;
}

function GroupChatContent({ groupId }: { groupId: string }) {
  const { user, loading: viewerLoading, configured } = useViewer();
  const [groups, setGroups] = useState<Group[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !user) return;

    const { data, error: messageError } = await supabase
      .from("chat_messages")
      .select("id, group_id, author_id, body, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (messageError) {
      setError(`读取群聊失败：${messageError.message}`);
      return;
    }

    const latest = ((data || []) as Message[]).reverse();
    setMessages(latest);
    const authorIds = [...new Set(latest.map((message) => message.author_id))];
    if (authorIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", authorIds);
      if (profileRows) {
        setProfiles(Object.fromEntries((profileRows as Profile[]).map((profile) => [profile.id, profile.display_name || "成员"])));
      }
    }
  }, [groupId, user]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !user) return;

    let active = true;
    async function loadGroup() {
      const { data, error: groupError } = await supabase!.from("groups").select("*").order("created_at", { ascending: false });
      if (!active) return;
      if (groupError) {
        setError(`读取群组失败：${groupError.message}`);
        setLoading(false);
        return;
      }
      const visibleGroups = (data || []) as Group[];
      const currentGroup = visibleGroups.find((item) => item.id === groupId) || null;
      setGroups(visibleGroups);
      setGroup(currentGroup);
      if (!currentGroup) {
        setError("群组不存在，或你尚未获准加入。");
        setLoading(false);
        return;
      }
      await loadMessages();
      if (active) setLoading(false);
    }
    void loadGroup();
    return () => { active = false; };
  }, [groupId, loadMessages, user]);

  useEffect(() => {
    if (!group || group.id !== groupId || !user) return;
    const timer = window.setInterval(() => { void loadMessages(); }, 5000);
    return () => window.clearInterval(timer);
  }, [group, groupId, loadMessages, user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    const text = body.trim();
    if (!supabase || !user || group?.id !== groupId || !text || sending) return;
    setSending(true);
    setError("");
    const { error: sendError } = await supabase.from("chat_messages").insert({ group_id: groupId, body: text });
    setSending(false);
    if (sendError) {
      setError(`发送失败：${sendError.message}`);
      return;
    }
    setBody("");
    await loadMessages();
  }

  const visibleGroup = group?.id === groupId ? group : null;

  return (
    <WorkspaceShell groups={groups} currentGroup={visibleGroup} email={user?.email} title="群聊" subtitle="在这里快速沟通；重要的分工和决定可以整理到 Issue。">
      {!configured && <p className={styles.notice} role="status">试用开放后即可使用群聊。</p>}
      {(viewerLoading || loading) && configured && <p className={styles.notice} role="status">正在加载群聊…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {visibleGroup && <section className={styles.chat} aria-label={`${visibleGroup.name}群聊`}>
        <div className={styles.chatHeader}>
          <span className={styles.chatIcon}><MessageCircle size={20} aria-hidden="true" /></span>
          <div><h2>{visibleGroup.name}</h2><p>群号 {visibleGroup.group_number} · 仅群组成员可见</p></div>
        </div>
        <div className={styles.history} aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 && <div className={styles.empty}>还没有消息，和组员打个招呼吧。</div>}
          {messages.length >= 100 && <p className={styles.limit}>显示最近 100 条消息</p>}
          {messages.map((message) => {
            const mine = message.author_id === user?.id;
            return <article key={message.id} className={`${styles.message} ${mine ? styles.mine : ""}`}>
              <div className={styles.avatar} aria-hidden="true">{(profiles[message.author_id] || "成").slice(0, 1)}</div>
              <div className={styles.messageContent}>
                <div className={styles.messageMeta}><strong>{mine ? "我" : profiles[message.author_id] || "成员"}</strong><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
                <p>{message.body}</p>
              </div>
            </article>;
          })}
          <div ref={endRef} />
        </div>
        <form className={styles.composer} onSubmit={sendMessage}>
          <label htmlFor="chat-message">发送消息</label>
          <div className={styles.composerRow}>
            <textarea id="chat-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} rows={2} placeholder="输入想和组员说的话…" disabled={sending} />
            <button type="submit" disabled={sending || !body.trim()}><Send size={17} aria-hidden="true" />{sending ? "发送中" : "发送"}</button>
          </div>
        </form>
      </section>}
    </WorkspaceShell>
  );
}
