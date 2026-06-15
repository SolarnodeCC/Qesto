---
id: teams-and-collaboration
title: Teams and Collaboration
topic: account
scope: free
excerpt: Create teams, invite members, understand roles and permissions, and configure SAML SSO on eligible plans.
---

# Teams and Collaboration

## Why Teams?

Teams organize sessions, templates, and members under one workspace. Use them when:

- Several people create sessions for the same organization
- You need shared templates or audit logs
- You want SAML single sign-on (Chorus plan)

Personal sessions belong to your account; team sessions belong to the workspace.

## Creating a Team

1. Dashboard → **Teams** tab
2. Click **Create team**
3. Enter a team name
4. You are the **owner** with full permissions

## Inviting Members

1. Open **Teams → [your team] → Settings**
2. Click **Invite member**
3. Enter their email — they receive an invite link
4. They accept via **Teams → Accept invite** (must be logged in)

Invites expire after a period for security. Resend if needed.

## Default Team Roles

| Role | Typical access |
|------|----------------|
| **Owner** | Everything including billing and SAML |
| **Admin** | Manage members, sessions, templates |
| **Member** | Create and run sessions |
| **Viewer** | Read-only access to team sessions |

Team owners can assign **custom roles** on the Chorus plan with granular permissions (create, launch, export, manage auth, etc.).

## Custom Permissions (Chorus Plan)

Examples of permission flags:

- Create / edit / launch / close / archive sessions
- Export results
- Activate energizers
- Read or write templates
- Manage members and SAML
- View audit log
- Manage billing

Assign custom roles under **Team settings → Roles**.

## SAML Single Sign-On

**Requires Chorus plan** (SAML/OAuth SSO).

### What SAML does

Lets your organization sign in through your identity provider (Okta, Azure AD, Google Workspace, etc.) instead of magic link/password.

### Setup overview

1. Team owner → **Team settings → Authentication**
2. Enter IdP metadata: entity ID, SSO URL, certificate
3. Download Qesto's SP metadata for your IdP
4. Test login with a pilot user before rolling out

For enterprise IdP configuration help, email support@qesto.cc with your provider name.

## Team Sessions vs Personal Sessions

- **Personal** — created from your dashboard without a team selected
- **Team** — visible to members based on their role; shared templates and audit trail

When creating a session, pick the team in the wizard if the session belongs to the organization.

## Audit Log (Chorus Plan)

Team owners and users with **Read audit log** permission can view compliance events:

- Session started / closed
- Exports and insight generation
- Member changes
- GDPR respondent erasure events

Access via team settings or session detail pages where enabled.

## Leaving or Removing Members

- **Owner removes member** — Team settings → Members → Remove
- **Member leaves** — contact the team owner to be removed (or delete your account)

Removing a member does not delete sessions they created — ownership stays with the team.

## Questions?

**Q: How many teams can I create?**
A: Pulse and Signal plans support multiple teams; participant limits apply per session, not per team.

**Q: Can viewers run sessions?**
A: No. Viewers can see team sessions but need **Member** (or custom launch permission) to go live.

**Q: Who pays for the team workspace subscription?**
A: The team owner's billing account. Upgrade under **Settings → Billing**.

**Q: Can I transfer team ownership?**
A: Contact support@qesto.cc — we can reassign ownership on request.
