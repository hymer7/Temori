export type Group = {
  id: string;
  group_number: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
};

export type Task = {
  id: string;
  group_id: string;
  title: string;
  description: string;
  due_at: string | null;
  created_by: string;
  coordinator_id: string;
  acceptor_id: string | null;
  status: string;
  external_delivery_url: string | null;
  external_delivery_note: string | null;
  external_delivered_at: string | null;
  created_at: string;
};

export type Issue = {
  id: string;
  task_id: string;
  title: string;
  body: string;
  kind: "discussion" | "work";
  is_required: boolean;
  status: string;
  assignee_id: string | null;
  reviewer_id: string | null;
  due_at: string | null;
  conclusion: string | null;
  created_by: string;
  created_at: string;
};

export type Submission = {
  id: string;
  task_id: string;
  kind: "final" | "issue";
  created_by: string;
  status: string;
  created_at: string;
};

export type SubmissionVersion = {
  id: string;
  submission_id: string;
  version_number: number;
  status: "draft" | "published";
  summary: string;
  body: string;
  link_url: string | null;
  created_by: string;
  created_at: string;
};

export type ReviewDecision = {
  id: string;
  submission_id: string;
  version_id: string;
  reviewer_id: string;
  decision: "approved" | "changes_requested";
  comment: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type IssueComment = {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type Attachment = {
  id: string;
  group_id: string;
  task_id: string;
  submission_version_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};
