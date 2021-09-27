import { AgentPubKeyB64 } from '@holochain-open-dev/core-types';
import { contextProvided } from '@lit-labs/context';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { profilesStoreContext } from '../context';
import { ProfilesStore } from '../profiles-store';
import { HoloIdenticon } from './holo-identicon';
import { lightTheme, SlAvatar } from '@scoped-elements/shoelace';
import { StoreSubscriber } from 'lit-svelte-stores';

export class AgentAvatar extends ScopedElementsMixin(LitElement) {
  /** Public properties */

  @property({
    attribute: 'agent-pub-key',
  })
  agentPubKey!: AgentPubKeyB64;

  @property()
  size: number = 32;

  /** Dependencies */

  @contextProvided({ context: profilesStoreContext })
  _store!: ProfilesStore;

  _profile = new StoreSubscriber(this, () =>
    this._store.profileOf(this.agentPubKey)
  );

  async firstUpdated() {
    if (this._store.config.avatarMode === 'avatar') {
      await this._store.fetchAgentProfile(this.agentPubKey);
    }
  }

  render() {
    if (this._store.config.avatarMode === 'identicon')
      return html`<holo-identicon
        .hash=${this.agentPubKey}
        .size=${this.size}
      ></holo-identicon>`;
    else
      return html`
        <sl-avatar
          .image=${this._profile.value.fields.avatar}
          style="--size: ${this.size}px;"
        ></sl-avatar>
      `;
  }

  static get scopedElements() {
    return {
      'holo-identicon': HoloIdenticon,
      'sl-avatar': SlAvatar,
    };
  }

  static styles = [lightTheme];
}