import { Hashed, serializeHash } from '@holochain-open-dev/common';
import { Dictionary } from '@holochain-open-dev/common/core-types';
import {
  observable,
  makeObservable,
  action,
  runInAction,
  computed,
} from 'mobx';
import { ProfilesService } from './profiles.service';
import { AgentProfile, Profile } from './types';

export class ProfilesStore {
  @observable
  public profiles: Dictionary<Profile> = {};

  private constructor(protected profilesService: ProfilesService) {
    makeObservable(this);
  }

  get myAgentPubKey() {
    return serializeHash(this.profilesService.cellId[1]);
  }

  @computed
  get myProfile(): Profile | undefined {
    return this.profiles[this.myAgentPubKey];
  }

  @computed
  get knownProfiles(): Array<AgentProfile> {
    return Object.entries(this.profiles).map(([agent_pub_key, profile]) => ({
      agent_pub_key,
      profile,
    }));
  }

  @action
  public async fetchAllProfiles() {
    const allProfiles = await this.profilesService.getAllProfiles();

    runInAction(() => {
      for (const agentProfile of allProfiles) {
        this.profiles[agentProfile.agent_pub_key] = agentProfile.profile;
      }
    });
  }

  @action
  public async fetchMyProfile() {
    const myProfile = await this.profilesService.getMyProfile();

    runInAction(() => {
      this.profiles[this.myAgentPubKey] = myProfile.profile;
    });
  }

  @action
  public async searchProfiles(nicknamePrefix: string) {
    const searchedProfiles = await this.profilesService.searchProfiles(
      nicknamePrefix
    );

    runInAction(() => {
      for (const { agent_pub_key, profile } of searchedProfiles) {
        this.profiles[agent_pub_key] = profile;
      }
    });
  }

  @action
  public async createProfile(profile: Profile) {
    await this.profilesService.createProfile(profile);

    runInAction(() => {
      this.profiles[this.myAgentPubKey] = profile;
    });
  }
}
