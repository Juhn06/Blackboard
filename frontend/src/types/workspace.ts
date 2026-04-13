export interface Workspace {
  id: string | number;
  name: string;
  description?: string | null;
  icon?: string | null;
  owner_id?: number;
  current_user_role?: "ADMIN" | "MEMBER";
  can_manage?: boolean;
}
