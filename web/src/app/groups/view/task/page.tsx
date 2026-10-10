"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TaskDetail from "./TaskDetail";

function TaskRoute() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");
  const taskId = searchParams.get("taskId");
  if (!groupId || !taskId) return <p>缺少群组或任务编号。<Link href="/groups">返回我的群组</Link></p>;
  return <TaskDetail groupId={groupId} taskId={taskId} />;
}

export default function TaskPage() {
  return <Suspense fallback={<p>正在载入任务…</p>}><TaskRoute /></Suspense>;
}
