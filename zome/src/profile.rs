use crate::utils;
use hdk::prelude::holo_hash::AgentPubKeyB64;
use hdk::prelude::*;
use std::collections::BTreeMap;
use std::convert::{TryFrom, TryInto};

#[hdk_entry(id = "profile", visibility = "public")]
#[derive(Clone)]
pub struct Profile {
    pub nickname: String,
    pub fields: BTreeMap<String, String>,
}

// Used as a return type of all functions
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AgentProfile {
    pub agent_pub_key: AgentPubKeyB64,
    pub profile: Profile,
}

pub fn create_profile(profile: Profile) -> ExternResult<AgentProfile> {
    let agent_info = agent_info()?;

    create_entry(&profile.clone())?;

    let profile_hash = hash_entry(&profile.clone())?;

    let path = prefix_path(profile.nickname.clone());

    path.ensure()?;

    let agent_address: AnyDhtHash = agent_info.agent_initial_pubkey.clone().into();

    create_link(
        path.hash()?,
        profile_hash.clone(),
        link_tag(profile.nickname.as_str().clone())?,
    )?;
    create_link(
        agent_address.into(),
        profile_hash.clone(),
        link_tag("profile")?,
    )?;

    let agent_profile = AgentProfile {
        agent_pub_key: AgentPubKeyB64::from(agent_info.agent_initial_pubkey),
        profile,
    };

    Ok(agent_profile)
}

pub fn search_profiles(nickname_prefix: String) -> ExternResult<Vec<AgentProfile>> {
    if nickname_prefix.len() < 3 {
        return Err(crate::err(
            "Cannot search with a prefix less than 3 characters",
        ));
    }

    let prefix_path = prefix_path(nickname_prefix);

    get_agent_profiles_for_path(prefix_path.hash()?)
}

pub fn get_all_profiles() -> ExternResult<Vec<AgentProfile>> {
    let path = Path::from("all_profiles");

    let children = path.children()?;

    let agent_profiles: Vec<AgentProfile> = children
        .into_iter()
        .map(|link| get_agent_profiles_for_path(link.target))
        .collect::<ExternResult<Vec<Vec<AgentProfile>>>>()?
        .into_iter()
        .flatten()
        .collect();

    Ok(agent_profiles)
}

pub fn get_agent_profile(
    wrapped_agent_pub_key: AgentPubKeyB64,
) -> ExternResult<Option<AgentProfile>> {
    let agent_pub_key = AgentPubKey::from(wrapped_agent_pub_key.clone());

    let agent_address: AnyDhtHash = agent_pub_key.into();

    let links = get_links(agent_address.into(), Some(link_tag("profile")?))?;

    if links.len() == 0 {
        return Ok(None);
    }

    let link = links[0].clone();

    let profile: Profile = utils::try_get_and_convert(link.target)?;

    let agent_profile = AgentProfile {
        agent_pub_key: wrapped_agent_pub_key,
        profile,
    };

    Ok(Some(agent_profile))
}

pub fn get_agents_profile(
    agent_pub_keys_b64: Vec<AgentPubKeyB64>,
) -> ExternResult<Vec<AgentProfile>> {
    let link_tag = Some(link_tag("profile")?);

    let get_links_input: Vec<GetLinksInput> = agent_pub_keys_b64
        .into_iter()
        .map(|agent_pub_key_b64| {
            let agent_pub_key = AgentPubKey::from(agent_pub_key_b64.clone());
            let agent_address: AnyDhtHash = agent_pub_key.into();
            GetLinksInput::new(agent_address.into(), link_tag.clone())
        })
        .collect();

    let get_links_output = HDK
        .with(|h| h.borrow().get_links(get_links_input))?
        .into_iter()
        .flatten()
        .collect::<Vec<Link>>();

    let get_input = get_links_output
        .into_iter()
        .map(|link| GetInput::new(link.target.into(), GetOptions::default()))
        .collect();
    let get_output = HDK.with(|h| h.borrow().get(get_input))?;

    get_output
        .into_iter()
        .filter_map(|maybe_option| maybe_option)
        .map(get_agent_profile_from_element)
        .collect()
}

/** Private helpers */

fn prefix_path(nickname: String) -> Path {
    // conver to lowercase for path for ease of search
    let lower_nickname = nickname.to_lowercase();
    let (prefix, _) = lower_nickname.as_str().split_at(3);

    Path::from(format!("all_profiles.{}", prefix))
}

fn get_agent_profiles_for_path(path_hash: EntryHash) -> ExternResult<Vec<AgentProfile>> {
    let links = get_links(path_hash, None)?;

    let get_input = links
        .into_iter()
        .map(|link| GetInput::new(link.target.into(), GetOptions::default()))
        .collect();

    let get_output = HDK.with(|h| h.borrow().get(get_input))?;

    get_output
        .into_iter()
        .filter_map(|maybe_option| maybe_option)
        .map(get_agent_profile_from_element)
        .collect()
}

fn get_agent_profile_from_element(element: Element) -> ExternResult<AgentProfile> {
    let author = element.header().author().clone();

    let profile: Profile = utils::try_from_element(element)?;

    let agent_profile = AgentProfile {
        agent_pub_key: AgentPubKeyB64::from(author),
        profile,
    };

    Ok(agent_profile)
}

#[derive(Serialize, Deserialize, Debug, SerializedBytes)]
struct StringLinkTag(String);
pub fn link_tag(tag: &str) -> ExternResult<LinkTag> {
    let sb: SerializedBytes = StringLinkTag(tag.into()).try_into()?;
    Ok(LinkTag(sb.bytes().clone()))
}
