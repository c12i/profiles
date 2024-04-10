import { ActionCommittedSignal } from "@holochain-open-dev/utils";

export type ProfilesSignal = ActionCommittedSignal<EntryTypes, any>;

export type EntryTypes = Profile;

export interface Profile {
  type: "Profile";
  nickname: string;
  fields: Record<string, string>;
}
