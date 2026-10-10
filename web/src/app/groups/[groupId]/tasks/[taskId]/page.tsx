import TaskDetail from "./TaskDetail";

export default async function TaskPage({ params }: { params: Promise<{ groupId: string; taskId: string }> }) {
  const { groupId, taskId } = await params;
  return <TaskDetail groupId={groupId} taskId={taskId} />;
}
