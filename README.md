# SupportIQ

SupportIQ is an AI-assisted customer support platform with a customer portal and a company-scoped agent portal.

## Agent portal

The agent portal keeps support operations separate from company administration:

- **Overview** shows company-authorized ticket metrics, tickets needing attention, and recent activity.
- **Support Desk** is the workspace ticket queue.
- **Companies & Workspaces** is the company directory. Open a workspace here to enter its operations area.
- **Team & Members** is available to company administrators for existing members and invitations.
- **Workspace Settings** is available to company administrators for their own company.

Workspace membership roles are scoped to a company. Regular agents can work with that company's tickets but cannot manage its members or settings. A company administrator can administer only companies where they hold an active `company_admin` membership. Creating a company is limited to agent accounts; the creator becomes that new company's first administrator. Customers cannot create, select, or manage workspaces and see only their own tickets.

## Invitations

Company administrators can add an existing account or create an invitation for a customer, agent, or company administrator. Invitations are bound to an email address, expire, and can be used once. Email delivery is not configured: after creating an invitation, copy and share its link with the intended person. The invitee must sign in or register using the invited email address. Reissuing an invitation expires the prior unused link.

## Development checks

Run the backend integration suite and frontend production build from the repository root:

```powershell
npm --prefix backend test
npm --prefix frontend run build
```