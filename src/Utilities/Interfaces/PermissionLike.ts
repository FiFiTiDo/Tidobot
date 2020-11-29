import { Role } from "../../Systems/Permissions/Role";

export interface PermissionLike {
    token: string;
    defaultRole: Role;
}