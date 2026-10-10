"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GroupOverview from "./GroupOverview";

function GroupRoute() {
  const groupId = useSearchParams().get("groupId");
  if (!groupId) return <p>缺少群组编号。<Link href="/groups">返回我的群组</Link></p>;
  return <GroupOverview groupId={groupId} />;
}

export default function GroupPage() {
  return <Suspense fallback={<p>正在载入群组…</p>}><GroupRoute /></Suspense>;
}
