//! Changes a user asks GitHub to make to a pull request, and GitHub's answer.

use serde::{Deserialize, Serialize};

use super::{EnrichedGithubPullRequest, GithubPullRequestNumber, GithubPullRequestRef};

/// A request to mark one pull request as a draft, or as ready for review, on
/// the user's behalf.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(utoipa::ToSchema))]
#[serde(rename_all = "camelCase")]
pub struct SetGithubPullRequestDraftRequest {
    /// The GitHub repository owner or organization.
    pub owner: String,
    /// The GitHub repository name.
    pub repo: String,
    /// The GitHub pull request number.
    pub number: u64,
    /// `true` converts the pull request to a draft; `false` marks it ready for review.
    pub draft: bool,
}

impl SetGithubPullRequestDraftRequest {
    /// The reference enrichment uses for this pull request.
    pub fn to_reference(&self) -> GithubPullRequestRef {
        GithubPullRequestNumber {
            owner: self.owner.clone(),
            repo: self.repo.clone(),
            number: self.number,
        }
        .to_reference()
    }
}

/// Response body for a pull request whose draft state changed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(utoipa::ToSchema))]
#[serde(rename_all = "camelCase")]
pub struct SetGithubPullRequestDraftResponse {
    /// Whether the pull request is now a draft.
    pub draft: bool,
    /// The pull request as GitHub reports it after the change, when the
    /// refresh succeeded.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pull_request: Option<EnrichedGithubPullRequest>,
}

/// Why GitHub declined to change a pull request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GithubPullRequestUpdateRejection {
    /// The user's token cannot see the pull request.
    NotFound,
    /// The user may not change the pull request.
    Forbidden,
    /// GitHub rejected the change, for example on a closed pull request.
    Invalid,
}

/// GitHub's answer to a draft change: performed, or declined with its reason.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GithubDraftOutcome {
    /// The pull request's draft state is now the one asked for.
    Changed {
        /// Whether the pull request is now a draft.
        draft: bool,
    },
    /// GitHub declined, with the message it gave for the user.
    Rejected {
        /// Why GitHub declined.
        rejection: GithubPullRequestUpdateRejection,
        /// GitHub's message, written for the person who asked.
        message: String,
    },
}
