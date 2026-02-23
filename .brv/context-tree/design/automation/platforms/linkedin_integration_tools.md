## Raw Concept
**Task:**
Document the LinkedIn integration tools and authentication mechanisms

**Files:**
- src/tools/linkedin-tools.ts

**Flow:**
Tool.execute -> getLinkedInToken() -> Fetch LinkedIn API (/ugcPosts or /userinfo) -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
LinkedIn integration is handled via the LinkedIn V2 API. The `linkedInTools` module in src/tools/linkedin-tools.ts provides a standard interface for the agent to publish content and manage profiles.

### Features
Publishing UGC (User Generated Content) posts, link sharing, profile retrieval, and authentication verification.

### Rules
1. Authentication tokens are retrieved with priority: Keychain (`com.launchcrew.linkedin`) > `LINKEDIN_ACCESS_TOKEN` env var.
2. The default user URN is `urn:li:person:vuzryA4D9-`.
3. UGC posts use the `com.linkedin.ugc.ShareContent` format.
4. Link shares are categorized as `ARTICLE` in the `shareMediaCategory` field.

### Examples
LinkedIn Tool Suite:
| Tool Name | Endpoint | Description |
| :--- | :--- | :--- |
| `post_to_linkedin` | `/ugcPosts` | Publish a text or link post (supports `visibility` and `dryRun`) |
| `draft_linkedin_post` | N/A | Provide formatting guidelines for a draft (no API call) |
| `get_linkedin_profile` | `/userinfo` | Fetch basic profile info (name, URN, picture) |
| `check_linkedin_auth` | `/userinfo` | Verify token validity and return user name/URN |

LinkedIn formatting guidelines (via `draft_linkedin_post`):
- Ideal length: 1200-1500 characters
- Line breaks for readability
- Start with a hook
- 3-5 relevant hashtags at the end
