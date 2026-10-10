function query(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

export function groupHref(groupId: string) {
  return `/groups/view?${query({ groupId })}`;
}

export function groupChatHref(groupId: string) {
  return `/groups/view/chat?${query({ groupId })}`;
}

export function groupMembersHref(groupId: string) {
  return `/groups/view/members?${query({ groupId })}`;
}

export function taskHref(groupId: string, taskId: string) {
  return `/groups/view/task?${query({ groupId, taskId })}`;
}
