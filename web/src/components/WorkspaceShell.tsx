"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, ClipboardList, Home, LogOut, MessageCircle, Users } from "lucide-react";
import type { ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Group } from "@/lib/types";
import styles from "./WorkspaceShell.module.css";

type Props = {
  children: ReactNode;
  groups: Group[];
  currentGroup?: Group | null;
  email?: string | null;
  title: string;
  subtitle?: string;
};

export default function WorkspaceShell({ children, groups, currentGroup, email, title, subtitle }: Props) {
  const path = usePathname();
  const router = useRouter();
  const groupBase = currentGroup ? `/groups/${currentGroup.id}` : "/groups";

  async function signOut() {
    await getSupabase()?.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/groups" className={styles.brand} aria-label="Temori 群组首页">
          <span className={styles.brandMark}>t.</span><span>temori</span>
        </Link>
        <div className={styles.sideSectionLabel}>工作空间</div>
        <nav aria-label="主要导航" className={styles.nav}>
          <Link href="/groups" className={path === "/groups" ? styles.active : ""}>
            <Home size={18} aria-hidden="true" /><span>我的群组</span>
          </Link>
          {currentGroup && <>
            <Link href={groupBase} className={path === groupBase ? styles.active : ""}>
              <ClipboardList size={18} aria-hidden="true" /><span>大任务</span>
            </Link>
            <Link href={`${groupBase}/chat`} className={path.endsWith("/chat") ? styles.active : ""}>
              <MessageCircle size={18} aria-hidden="true" /><span>群聊</span>
            </Link>
            <Link href={`${groupBase}/members`} className={path.endsWith("/members") ? styles.active : ""}>
              <Users size={18} aria-hidden="true" /><span>成员</span>
            </Link>
          </>}
          <Link href="/inbox" className={path === "/inbox" ? styles.active : ""}>
            <Bell size={18} aria-hidden="true" /><span>待处理</span>
          </Link>
        </nav>
        {groups.length > 0 && <>
          <div className={styles.sideSectionLabel}>已加入的群组</div>
          <nav aria-label="群组列表" className={styles.groupList}>
            {groups.map((group) => <Link key={group.id} href={`/groups/${group.id}`} className={currentGroup?.id === group.id ? styles.selectedGroup : ""}>
              <span className={styles.groupDot}>{group.name.slice(0, 1)}</span>
              <span className={styles.groupName}>{group.name}</span>
            </Link>)}
          </nav>
        </>}
        <div className={styles.sidebarFoot}>
          <div className={styles.avatar}>{email?.slice(0, 1).toUpperCase() || "T"}</div>
          <div className={styles.account}><strong>{email?.split("@")[0] || "成员"}</strong><span>{email || "未登录"}</span></div>
          <button type="button" onClick={signOut} aria-label="退出登录" title="退出登录"><LogOut size={17} /></button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topCopy}>
            {currentGroup && <div className={styles.breadcrumb}><Link href="/groups">群组</Link><ChevronDown size={14} aria-hidden="true" /><span>{currentGroup.name}</span></div>}
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <Link href="/inbox" className={styles.topAction} aria-label="查看待处理"><Bell size={20} /></Link>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
