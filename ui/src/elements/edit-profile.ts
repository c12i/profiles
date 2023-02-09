import { ScopedElementsMixin } from "@open-wc/scoped-elements";
import {
  Button,
  Fab,
  IconButton,
  TextField,
} from "@scoped-elements/material-web";
import { SlAvatar } from "@scoped-elements/shoelace";
import { html, LitElement } from "lit";
import { property, query, state } from "lit/decorators.js";
import { localized, msg, str } from "@lit/localize";
import { consume } from "@lit-labs/context";

import { ProfilesStore } from "../profiles-store";
import { profilesStoreContext } from "../context";
import { Profile } from "../types";
import { resizeAndExport } from "./utils/image";
import { sharedStyles } from "@holochain-open-dev/elements";
import { FieldConfig } from "../config";

/**
 * @element edit-profile
 * @fires save-profile - Fired when the save profile button is clicked
 */
@localized()
export class EditProfile extends ScopedElementsMixin(LitElement) {
  /**
   * The profile to be edited.
   */
  @property({ type: Object })
  profile: Profile | undefined;

  /**
   * Label for the save profile button.
   */
  @property({ type: String, attribute: "save-profile-label" })
  saveProfileLabel: string | undefined;

  /** Dependencies */

  /**
   * @internal
   */
  @consume({ context: profilesStoreContext, subscribe: true })
  @state()
  _store!: ProfilesStore;

  @property({ type: Boolean })
  allowCancel = false;

  /** Private properties */

  /**
   * @internal
   */
  @query("#nickname-field")
  private _nicknameField!: TextField;

  /**
   * @internal
   */
  private _existingUsernames: { [key: string]: boolean } = {};

  /**
   * @internal
   */
  @query("#avatar-file-picker")
  private _avatarFilePicker!: HTMLInputElement;

  /**
   * @internal
   */
  @state()
  private _avatar: string | undefined;

  firstUpdated() {
    this._avatar = this.profile?.fields["avatar"];

    this._nicknameField.validityTransform = (newValue: string) => {
      this.requestUpdate();
      if (newValue.length < this._store.config.minNicknameLength) {
        this._nicknameField.setCustomValidity(msg(`Nickname is too short`));
        return {
          valid: false,
        };
      } else if (this._existingUsernames[newValue]) {
        this._nicknameField.setCustomValidity(
          msg("This nickname already exists")
        );
        return { valid: false };
      }

      return {
        valid: true,
      };
    };
  }

  onAvatarUploaded() {
    if (this._avatarFilePicker.files && this._avatarFilePicker.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          this._avatar = resizeAndExport(img);
          this._avatarFilePicker.value = "";
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(this._avatarFilePicker.files[0]);
    }
  }

  avatarMode() {
    return (
      this._store.config.avatarMode === "avatar-required" ||
      this._store.config.avatarMode === "avatar-optional"
    );
  }

  renderAvatar() {
    if (!this.avatarMode()) return html``;
    return html`
      <div
        style="width: 80px; height: 80px; justify-content: center;"
        class="row"
      >
        ${this._avatar
          ? html`
              <div class="column" style="align-items: center; ">
                <sl-avatar
                  image="${this._avatar}"
                  alt="Avatar"
                  style="margin-bottom: 4px; --size: 3.5rem;"
                  initials=""
                ></sl-avatar>
                <span
                  class="placeholder label"
                  style="cursor: pointer;   text-decoration: underline;"
                  @click=${() => (this._avatar = undefined)}
                  >${msg("Clear")}</span
                >
              </div>
            `
          : html` <div class="column" style="align-items: center;">
              <mwc-fab
                icon="add"
                @click=${() => this._avatarFilePicker.click()}
                style="margin-bottom: 4px;"
              ></mwc-fab>
              <span class="placeholder label">Avatar</span>
            </div>`}
      </div>
    `;
  }

  shouldSaveButtonBeEnabled() {
    if (!this._nicknameField) return false;
    if (!this._nicknameField.validity.valid) return false;
    if (this._store.config.avatarMode === "avatar-required" && !this._avatar)
      return false;
    if (
      Object.values(this.getAdditionalTextFields()).find(
        (t) => !t.validity.valid
      )
    )
      return false;

    return true;
  }

  textfieldToFieldId(field: TextField): string {
    return field.id.split("-")[2];
  }

  getAdditionalFieldsValues(): Record<string, string> {
    const textfields = this.getAdditionalTextFields();

    const values: Record<string, string> = {};
    for (const [id, textfield] of Object.entries(textfields)) {
      values[id] = textfield.value;
    }

    return values;
  }

  getAdditionalTextFields(): Record<string, TextField> {
    const textfields = Array.from(
      this.shadowRoot!.querySelectorAll("mwc-textfield")
    ).filter((f) => f.id !== "nickname-field") as TextField[];

    const fields: Record<string, TextField> = {};
    for (const field of textfields) {
      const id = this.textfieldToFieldId(field);
      fields[id] = field;
    }
    return fields;
  }

  fireSaveProfile() {
    const nickname = this._nicknameField.value;

    const fields: Record<string, string> = this.getAdditionalFieldsValues();
    if (this._avatar) {
      fields["avatar"] = this._avatar;
    }

    const profile: Profile = {
      fields,
      nickname,
    };

    this.dispatchEvent(
      new CustomEvent("save-profile", {
        detail: {
          profile,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  fireCancel() {
    this.dispatchEvent(
      new CustomEvent("cancel-edit-profile", {
        bubbles: true,
        composed: true,
      })
    );
  }

  renderField(fieldConfig: FieldConfig) {
    return html`
      <mwc-textfield
        id="profile-field-${fieldConfig.name}"
        outlined
        .required=${fieldConfig.required}
        autoValidate
        .validationMessage=${fieldConfig.required ? msg("This field is required") : null}
        .label=${fieldConfig.label}
        .value=${this.profile?.fields[fieldConfig.name] || ""}
        @input=${() => this.requestUpdate()}
        style="margin-top: 8px;"
      ></mwc-textfield>
    `;
  }

  render() {
    return html`
      ${
        this.avatarMode()
          ? html`<input
              type="file"
              id="avatar-file-picker"
              style="display: none;"
              @change=${this.onAvatarUploaded}
            />`
          : html``
      }
        <div class="column">

          <div class="row" style="justify-content: center; margin-bottom: 8px; align-self: start;" >
            ${this.renderAvatar()}

            <mwc-textfield
              id="nickname-field"
              outlined
              .label=${msg("Nickname")}
              .value=${this.profile?.nickname || ""}
              .helper=${msg(
                str`Min. ${this._store.config.minNicknameLength} characters`
              )}
              @input=${() => this._nicknameField.reportValidity()}
              style="margin-left: 8px;"
            ></mwc-textfield>
          </div>

          ${this._store.config.additionalFields.map((field) =>
            this.renderField(field)
          )}


          <div class="row" style="margin-top: 8px;">

            ${
              this.allowCancel
                ? html`
                    <mwc-button
                      style="flex: 1; margin-right: 6px;"
                      .label=${"Cancel"}
                      @click=${() => this.fireCancel()}
                    ></mwc-button>
                  `
                : html``
            }

            <mwc-button
              style="flex: 1;"
              raised
              .disabled=${!this.shouldSaveButtonBeEnabled()}
              .label=${this.saveProfileLabel ?? msg("Save Profile")}
              @click=${() => this.fireSaveProfile()}
            ></mwc-button>

          </div>

        </div>
      </mwc-card>
    `;
  }

  /**
   * @ignore
   */
  static get scopedElements() {
    return {
      "mwc-textfield": TextField,
      "mwc-button": Button,
      "mwc-fab": Fab,
      "mwc-icon-button": IconButton,
      "sl-avatar": SlAvatar,
    };
  }

  static styles = [sharedStyles];
}
