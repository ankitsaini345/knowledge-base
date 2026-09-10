# Node.js API Design, Authentication & Security

## Source Topics

- **Topic 21** — Node.js Security Fundamentals
- **Topic 22** — Authentication Architecture: JWT, OAuth 2.0, Sessions & Token Validation
- **Topic 23** — OAuth 2.0 Flows & PKCE
- **Topic 24** — API Authorization: RBAC, ABAC, Scopes & Permissions
- **Topic 25** — Node.js API Design & REST Best Practices

> This file consolidates Topics 21–25 from the original Node.js preparation conversation into one revision-oriented knowledge base for Senior Backend / SDE3 / Architect interviews.

---

# 1. Security Fundamentals

For a production Node.js API, security should be considered across the complete request lifecycle:

```text
Client
  ↓
TLS
  ↓
API Gateway / WAF
  ↓
Node.js
  ↓
Authentication
  ↓
Authorization
  ↓
Validation
  ↓
Business Logic
  ↓
DB / External Services
```

The important mindset is:

> Treat every request boundary as untrusted.

Security is not one middleware.

---

## 1.1 Authentication vs Authorization

### Authentication

Answers:

> **Who are you?**

Examples:

- OAuth 2.0
- OpenID Connect
- JWT
- Azure AD / Entra ID
- Session-based authentication

### Authorization

Answers:

> **What are you allowed to do?**

Example:

```text
User
 ↓
Authenticated
 ↓
Role = RM
 ↓
VIEW_CUSTOMER
CREATE_LEAD
Cannot approve loan
```

Remember:

```text
Authentication ≠ Authorization
```

---

# 2. JWT Security

A JWT typically looks like:

```text
xxxxx.yyyyy.zzzzz
  ↑      ↑      ↑
header payload signature
```

Example payload:

```json
{
  "sub": "12345",
  "iss": "https://issuer.example.com",
  "aud": "crm-api",
  "exp": 1788610000,
  "scope": "customer.read"
}
```

Important:

> **The payload is readable. The signature provides integrity/authenticity.**

JWTs are commonly signed, not encrypted.

Therefore, anyone holding a normal signed JWT can generally decode its payload.

## What the API should validate

When receiving:

```http
Authorization: Bearer <token>
```

the conceptual flow is:

```text
Token
 ↓
Parse
 ↓
Verify signature
 ↓
Validate issuer
 ↓
Validate audience
 ↓
Validate expiry
 ↓
Validate relevant scopes/roles
 ↓
Authenticated identity
```

Do **not** treat this as validation:

```js
JSON.parse(base64Payload)
```

That only decodes the token.

## Signature verification

The Identity Provider has:

```text
Private Key
Public Key
```

The IdP signs:

```text
JWT Header + Payload
        ↓
   Private Key
        ↓
     Signature
```

The API receives the complete token and verifies the signature using the issuer's public key.

Conceptually:

```text
Header + Payload
       ↓
   Public Key
       ↓
Expected Signature
       ↓
Compare with token signature
```

If an attacker changes:

```json
{
  "role": "admin"
}
```

the signature will no longer match.

## JWKS

Enterprise identity providers expose signing keys through a **JWKS endpoint**.

```text
Identity Provider
       ↓
      JWKS
       ↓
  Public keys
       ↓
    Node API
```

The API/library typically caches keys rather than downloading them for every request.

---

# 3. Never Trust Client Input

Treat all client-controlled values as untrusted:

```js
req.body
req.query
req.params
req.headers
```

Example:

```json
{
  "amount": 100,
  "accountId": "123"
}
```

Frontend validation is not enough.

An attacker can directly call:

```http
POST /transfer
```

with malicious values such as:

```json
{
  "amount": -999999,
  "accountId": "someone-else"
}
```

Server-side validation is mandatory.

---

# 4. Input Validation

Validate:

- type
- length
- range
- format
- allowed values
- required fields

Example:

```js
const schema = z.object({
  amount: z.number().positive(),
  accountId: z.string().min(1)
});
```

But validation is not only syntactic.

Business rules also matter:

```text
amount > 0
AND
user owns account
AND
user has sufficient permission
AND
transaction limit not exceeded
```

---

# 5. Injection Attacks

## 5.1 SQL Injection

Bad:

```js
const query =
  `SELECT * FROM users WHERE name = '${req.query.name}'`;
```

Use parameterized queries:

```js
db.query(
  "SELECT * FROM users WHERE name = $1",
  [req.query.name]
);
```

ORMs/query builders help, but they do not automatically eliminate every injection risk. Raw queries and unsafe query construction can still be vulnerable.

## 5.2 NoSQL Injection

MongoDB can also have injection vulnerabilities.

Avoid blindly accepting query objects:

```js
User.find(req.body);
```

Untrusted objects can manipulate operators such as:

```text
$gt
$ne
$regex
```

Instead, construct queries from explicitly validated fields:

```js
User.find({
  email: validatedEmail
});
```

## 5.3 Prototype Pollution

JavaScript-specific risk involving unsafe merging of untrusted objects.

Potentially dangerous patterns include careless use of:

```js
Object.assign()
deep merge libraries
```

with untrusted input.

Architectural rule:

> **Don't merge arbitrary client-controlled objects into trusted configuration/state objects.**

## 5.4 Command Injection

Dangerous:

```js
exec(`ping ${req.query.host}`);
```

Prefer APIs that avoid shell interpretation where possible:

```js
execFile("ping", ["-c", "1", host]);
```

and validate the input.

## 5.5 Path Traversal

Suppose:

```http
GET /download?file=report.pdf
```

Bad:

```js
fs.readFile(`/reports/${req.query.file}`);
```

An attacker may attempt:

```text
../../some-sensitive-file
```

Use strict filename/path validation and safe path resolution.

---

# 6. Secrets Management

Never hard-code secrets:

```js
const DB_PASSWORD = "myPassword123";
```

and do not commit `.env` files containing secrets to Git.

Use external secret management such as:

- Kubernetes Secrets
- AWS Secrets Manager
- Azure Key Vault
- GCP Secret Manager
- enterprise secret-management systems

Also:

> **Never log secrets.**

Be especially careful with:

```text
Authorization headers
JWTs
API keys
DB credentials
personal/customer data
```

---

# 7. HTTPS / TLS

Production APIs should use HTTPS:

```text
HTTP  ❌
HTTPS ✅
```

TLS protects data **in transit**:

```text
Client
   ↓ encrypted
TLS
   ↓
Node
```

But TLS does not automatically protect:

- compromised endpoints
- malicious authenticated users
- insecure authorization
- bad business logic
- data already exposed inside the application

---

# 8. Rate Limiting and Availability Protection

An attacker can overwhelm a Node service with requests:

```text
Attacker
   ↓
100,000 requests/sec
   ↓
Node
```

Potentially exhausting:

- CPU
- memory
- DB connections
- downstream APIs

Use rate limiting:

```text
Client
  ↓
Rate Limiter
  ↓
Allowed → API
Blocked → 429
```

In distributed systems, rate limiting may exist at:

- API Gateway
- Load Balancer / WAF
- application
- Redis-backed distributed limiter

---

# 9. DoS and Event-Loop Blocking

Node has a particularly important risk because CPU-heavy JavaScript can block the main JS thread.

Example:

```js
while (true) {}
```

Conceptually:

```text
Malicious request
      ↓
CPU-heavy operation
      ↓
Event loop blocked
      ↓
All requests affected
```

Defenses include:

- payload limits
- timeouts
- rate limiting
- safe regex
- bounded processing
- Worker Threads / separate workers for expensive work

---

# 10. ReDoS

A dangerous regular expression can consume huge CPU for specially crafted input.

```text
User input
   ↓
Complex regex
   ↓
Catastrophic backtracking
   ↓
CPU ↑
   ↓
Event loop blocked
```

For Node, this can be particularly damaging because the main JS thread gets blocked.

---

# 11. CORS

CORS controls which browser origins are allowed to make cross-origin requests.

Do not blindly configure:

```text
Access-Control-Allow-Origin: *
```

for sensitive authenticated APIs.

Most importantly:

> **CORS is a browser security mechanism, not API authentication.**

A non-browser client can call the API without being constrained by browser CORS policy.

---

# 12. Security Headers

Common security headers include:

```text
Content-Security-Policy
X-Content-Type-Options
Strict-Transport-Security
Referrer-Policy
```

Libraries such as Helmet can help configure common HTTP security headers in Express applications.

---

# 13. Dependency Security

Node applications can have large dependency trees:

```text
Your app
 ↓
package A
 ↓
package B
 ↓
package C
```

A vulnerability may exist in a transitive dependency.

Useful controls include:

```bash
npm audit
```

and enterprise tooling such as:

- Dependabot
- Snyk
- GitHub security scanning
- container image scanning
- SBOM/dependency scanning

Do not blindly upgrade production dependencies without considering compatibility.

---

# 14. Secure Logging

Never log:

```text
Authorization: Bearer eyJ...
password=...
cardNumber=...
```

Prefer structured, non-sensitive information:

```text
userId=123
requestId=abc
operation=TRANSFER
status=FAILED
```

Use:

- structured logging
- correlation IDs
- careful log redaction

This connects security directly with observability.

---

# 15. Secure Error Responses

Bad:

```json
{
  "error": "ORA-00942: table or view does not exist..."
}
```

Better:

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Something went wrong",
  "correlationId": "abc-123"
}
```

Detailed technical information belongs in internal logs, not client responses.

Do not expose:

```text
database stack traces
SQL statements
internal hostnames
secrets
implementation details
```

---

# 16. Enterprise Security Mental Model

For every API, ask:

```text
1. Who are you?
       ↓
Authentication

2. What can you do?
       ↓
Authorization

3. Can I trust this input?
       ↓
Validation

4. Can this input execute something?
       ↓
Injection protection

5. Can you overwhelm me?
       ↓
Rate limits + payload limits + timeouts

6. Can sensitive information leak?
       ↓
Logs + errors + secrets

7. Is data protected in transit?
       ↓
TLS

8. Are dependencies trustworthy?
       ↓
Security scanning + patching
```

### Architect-level takeaway

> **“I treat the request as untrusted at every boundary. Authentication establishes identity, authorization enforces permissions, validation constrains input, infrastructure protects availability, and observability ensures security failures can be detected without leaking sensitive information.”**

---

# 17. Authentication Architecture

When using an enterprise Identity Provider, the Node API generally does not authenticate the user's password itself.

The IdP handles authentication.

Typical architecture:

```text
                 Identity Provider
                Azure AD / Entra ID
                       │
                    Login
                       │
                       ↓
                  Access Token
                       │
                       ↓
Client ───────────→ API Gateway
                       │
                       ↓
                  Node.js API
                       │
                 Verify token
                       │
              ┌────────┴────────┐
              ↓                 ↓
        Authorization        Business
          (roles/scope)        logic
```

Important terminology:

> **OAuth 2.0 is an authorization framework. OIDC adds authentication/identity on top of OAuth 2.0. JWT is a token format, not an authentication protocol.**

---

# 18. Access Token, Refresh Token and ID Token

## Access Token

Used to call APIs:

```text
Client → API
Authorization: Bearer access_token
```

Usually short-lived.

## Refresh Token

Used to obtain a new access token without forcing the user to authenticate again:

```text
Refresh Token
      ↓
Identity Provider
      ↓
New Access Token
```

Refresh tokens require strong protection.

## ID Token

Primarily represents the authentication/identity information for the client in an OIDC flow.

The API should validate an **access token intended for that API**, not use an ID token as an API credential.

Mental model:

```text
ID Token
→ identity/authentication information for client

Access Token
→ credential presented to API for authorization
```

---

# 19. JWT vs Session

## Session-based authentication

```text
Browser
  ↓
Session ID
  ↓
Server
  ↓
Session Store
```

The server maintains state.

In a distributed architecture:

```text
             Load Balancer
                  ↓
          ┌───────┴───────┐
          ↓               ↓
        Pod 1           Pod 2
          │               │
          └────── Redis ──┘
```

## JWT-based authentication

```text
Client
  ↓
JWT
  ↓
API
```

The token carries claims and the API can validate it without a server-side session lookup for every request.

Distributed example:

```text
             Load Balancer
                  ↓
          ┌───────┬───────┐
          ↓       ↓       ↓
        Pod 1   Pod 2   Pod 3
          │       │       │
       verify   verify   verify
       token    token    token
```

JWTs are attractive for distributed APIs because validation can be local.

However:

> Do not say “JWT is always stateless.”

State can still exist through revocation, refresh tokens, deny lists, or other session/authorization mechanisms.

---

# 20. JWT Revocation Trade-off

Suppose:

```text
Access token lifetime = 1 hour
```

The token contains:

```text
role = ADMIN
```

Then admin access is revoked.

An existing token may remain valid until expiry unless a revocation/introspection mechanism is used.

Classic trade-off:

```text
JWT
 ↓
Easy distributed validation
 ↓
Immediate revocation is harder
```

Possible approaches:

- short-lived access tokens
- token revocation mechanisms
- introspection
- deny lists for specific use cases
- session-backed authorization where appropriate

---

# 21. Authentication Middleware

Conceptually:

```js
async function authenticate(req, res, next) {
  const token = extractBearerToken(req);

  const claims = await verifyToken(token);

  req.user = claims;

  next();
}
```

Authorization then runs after authentication:

```text
Request
  ↓
Authentication
  ↓
Authorization
  ↓
Controller
```

---

# 22. 401 vs 403

### 401 Unauthorized

Authentication is missing or invalid.

Examples:

```text
No token
Invalid token
Expired token
Invalid signature
```

Mental shortcut:

> **401 → “Who are you?”**

### 403 Forbidden

The caller is authenticated but lacks permission.

```text
Valid token
     ↓
User = RM
     ↓
Requires = ADMIN
     ↓
403
```

Mental shortcut:

> **403 → “I know who you are, but you can't do this.”**

---

# 23. Token Validation Trust Boundary

Architecture:

```text
Client
 ↓
API Gateway
 ↓
Node Service
```

The gateway may validate tokens.

However, the service should not blindly trust arbitrary identity or authorization headers supplied by a client.

Depending on the architecture, services may:

- independently validate the original access token
- trust a strongly authenticated gateway/service identity
- use mTLS/service identity between internal services
- use token exchange/downstream tokens

The key architectural question is:

> **Where is the trust boundary?**

---

# 24. Banking Authentication Example

A representative banking architecture:

```text
Mobile App
   │
   │ MSAL
   ▼
Azure Entra ID
   │
   │ Authorization Code + PKCE
   ▼
MSAL obtains tokens
   │
   │ Access Token
   ▼
API Gateway
   │
   ▼
Node.js Microservice
```

Node conceptually performs:

```text
Extract Bearer token
        ↓
Validate JWT signature
        ↓
Validate issuer
        ↓
Validate audience
        ↓
Validate expiry
        ↓
Validate scopes/roles
        ↓
Authorize operation
        ↓
Business logic
```

Then:

```text
req.user
   ↓
RM identity
   ↓
Customer authorization
   ↓
CRM operation
```

---

# 25. OAuth 2.0 and PKCE

OAuth 2.0 lets an application obtain limited access to a resource/API on behalf of a user or service without sharing the user's password with that application.

Important distinction:

```text
OAuth 2.0 → authorization framework
OIDC      → authentication/identity layer
```

## OAuth Roles

| Role | Meaning |
|---|---|
| Resource Owner | Usually the user |
| Client | Application requesting access |
| Authorization Server | Issues tokens |
| Resource Server | API being accessed |

Example:

```text
User        → Resource Owner
React App   → Client
Azure AD    → Authorization Server
Node API    → Resource Server
```

---

# 26. Authorization Code Flow

Most important flow for user-based applications:

```text
1. User opens application
2. App redirects user to IdP
3. User authenticates
4. IdP redirects back with authorization code
5. App exchanges code for tokens
6. App calls API using access token
```

The authorization code is temporary and used to obtain tokens.

The token exchange can be protected using PKCE.

---

# 27. PKCE — Proof Key for Code Exchange

PKCE protects the authorization-code flow against authorization-code interception.

The client generates:

```text
code_verifier
```

Then derives:

```text
code_challenge = BASE64URL(SHA256(code_verifier))
```

Initial authorization request:

```text
Client
  │
  │ code_challenge
  ▼
IdP
```

Later:

```text
Client
  │
  │ authorization_code
  │ code_verifier
  ▼
IdP
```

The IdP calculates the challenge from the verifier and verifies that it matches.

If an attacker obtains only:

```text
authorization_code
```

they cannot exchange it for tokens without:

```text
code_verifier
```

### PKCE mental model

```text
Before redirect:

Secret A = code_verifier

SHA256(Secret A)
       ↓
code_challenge
       ↓
IdP

Later:

authorization_code + Secret A
       ↓
IdP
       ↓
verify SHA256(Secret A)
       ↓
matches challenge?
       ↓
YES → issue tokens
NO  → reject
```

PKCE does **not** encrypt the authorization code.

It proves that the party exchanging the code possesses the verifier associated with the original authorization request.

---

# 28. Why PKCE Matters for SPA and Mobile

A React SPA or mobile application cannot reliably keep a client secret secret because application code is distributed to the user.

Therefore:

```text
SPA/mobile = public client
```

Use:

```text
Authorization Code + PKCE
```

Do not treat a client secret embedded in a SPA/mobile application as a real secret.

---

# 29. Authorization Code vs Access Token

### Authorization Code

```text
Temporary credential
        ↓
Used to obtain tokens
        ↓
Short-lived / one-time
```

### Access Token

```text
Credential for API
        ↓
Sent to resource server
        ↓
Authorization decision
```

Example:

```http
GET /api/customer/123

Authorization: Bearer eyJ...
```

---

# 30. Client Credentials Flow

Used for machine-to-machine communication where no end-user is involved.

```text
Service A
   │
   │ client credentials
   ▼
Identity Provider
   │
   │ access token
   ▼
Service A
   │
   │ Bearer token
   ▼
Service B
```

Typical example:

```text
CRM Service
    ↓
Customer Service
```

Service A authenticates itself as a service.

---

# 31. OAuth Flow Selection

| Scenario | Flow |
|---|---|
| User → Web application | Authorization Code + PKCE |
| User → Mobile application | Authorization Code + PKCE |
| Service → Service | Client Credentials |
| Backend acting on behalf of user | Authorization Code / token exchange depending on architecture |

---

# 32. OAuth vs JWT

They are not alternatives.

```text
OAuth 2.0
   ↓
Defines authorization flows

JWT
   ↓
Token format
```

OAuth access tokens **can** be JWTs, but OAuth does not require JWT.

An authorization server can also issue opaque tokens:

```text
a8f91b7c9...
```

rather than:

```text
eyJhbGciOi...
```

---

# 33. OAuth vs OIDC

### OAuth 2.0

Concerned with authorization.

### OIDC

Adds identity/authentication on top of OAuth 2.0.

```text
OAuth 2.0 → Authorization
OIDC      → Authentication / Identity
```

OIDC introduces the ID Token.

---

# 34. Senior OAuth Interview Questions

### Why do we need PKCE?

> PKCE protects the OAuth authorization-code flow against authorization-code interception. The client generates a code verifier and sends a derived code challenge during authorization. During token exchange, it sends the verifier, allowing the authorization server to verify that the same legitimate client initiated the flow.

### Why can't we use a client secret in a React SPA?

Because anything shipped to the browser can potentially be extracted.

Therefore:

```text
SPA/mobile = public client
```

Use:

```text
Authorization Code + PKCE
```

### Does PKCE encrypt the authorization code?

No.

It proves possession of the verifier associated with the original authorization request.

### Which OAuth flow would you use between microservices?

Usually:

```text
Client Credentials
```

because there is no end-user involved.

### What should an API validate in a JWT?

Depending on the IdP/configuration:

```text
Signature
Issuer (iss)
Audience (aud)
Expiration (exp)
Algorithm
Scopes / roles
```

Do not just decode the token.

---

# 35. API Authorization

Authentication establishes identity.

Authorization determines whether the authenticated caller can perform a specific operation.

```text
Authentication
      ↓
“Who are you?”
      ↓
Authorization
      ↓
“What can you do?”
```

---

# 36. RBAC — Role-Based Access Control

Permissions are assigned to roles, and users receive roles.

```text
User
 ↓
Role
 ↓
Permissions
```

Banking CRM example:

```text
Relationship Manager
 ↓
VIEW_CUSTOMER
CREATE_LEAD
VIEW_PORTFOLIO
```

Manager:

```text
VIEW_CUSTOMER
CREATE_LEAD
APPROVE_DEAL
VIEW_TEAM_PORTFOLIO
```

### Good when

Permissions naturally map to organizational roles.

### Problem: role explosion

```text
RM
RM_Dubai
RM_Dubai_Senior
RM_Dubai_Senior_Corporate
RM_Dubai_Senior_Corporate_Level2
...
```

---

# 37. Scopes

Scopes represent what an OAuth access token allows a client/application to access.

Examples:

```text
customer.read
customer.write
deal.read
deal.approve
```

A token might contain:

```json
{
  "sub": "user123",
  "scope": "customer.read deal.read"
}
```

The API checks:

```text
Does token have deal.read?
        ↓
      YES
        ↓
Allow
```

Important distinction:

> **Scope usually represents delegated API access, whereas roles are often used for user/application permissions.**

Do not blindly treat roles and scopes as identical concepts.

---

# 38. RBAC vs Scope

Think:

```text
Role:
“What kind of user/application are you?”

Scope:
“What access has this token been granted?”
```

Example:

```text
User Role:
Relationship Manager

Token scopes:
customer.read
deal.read
```

The role may be broader than the permissions granted to a particular token.

---

# 39. ABAC — Attribute-Based Access Control

Instead of only asking:

> “Does this user have the role?”

authorization can evaluate attributes.

Example:

```text
User:
  role = RM
  region = Dubai
  department = Corporate

Resource:
  region = Dubai
  owner = user123

Request:
  operation = UPDATE
```

Policy:

```text
ALLOW if
user.role == RM
AND
user.region == resource.region
```

Authorization becomes context-aware.

---

# 40. RBAC vs ABAC

### RBAC

```text
IF role == MANAGER
THEN allow approval
```

### ABAC

```text
IF
 role == MANAGER
 AND
 transaction.amount < approvalLimit
 AND
 transaction.region == user.region
THEN
 allow
```

ABAC is more flexible for context-dependent policies.

---

# 41. Resource-Level Authorization

This is critical for backend interviews.

Suppose:

```http
GET /customers/123
```

The user has:

```text
customer.read
```

Does that automatically mean the user can access customer 123?

**No.**

You may need:

```text
Can user123 access customer123?
```

Example:

```text
User region = Dubai
Customer region = Dubai
        ↓
       ALLOW
```

But:

```text
User region = Dubai
Customer region = London
        ↓
       DENY
```

This is object/resource-level authorization.

---

# 42. Authorization Layers

A serious enterprise authorization model can be layered:

```text
1. Authentication
        ↓
2. Token validation
        ↓
3. API-level permission
        ↓
4. Resource-level permission
        ↓
5. Business-rule authorization
```

Example:

```http
POST /deals/123/approve
```

Check:

1. Is the user authenticated?
2. Is the access token valid?
3. Does the caller have `deal.approve`?
4. Can this caller approve deal 123?
5. Does the deal satisfy business rules?

Example business rules:

```text
amount <= approvalLimit
status == PENDING_APPROVAL
```

---

# 43. Do Not Put All Authorization in the Gateway

Common architecture:

```text
Client
  ↓
API Gateway
  ↓
Microservice
```

Do not assume:

> “Gateway checked authorization, so the service can trust everything.”

Better:

```text
Gateway
 ├── Authentication / token checks
 ├── coarse-grained policies
 │
 ▼
Service
 ├── authorization
 ├── resource ownership
 └── business rules
```

Sensitive resource/business authorization should remain in the owning service.

---

# 44. Node.js Authorization Example

Coarse-grained scope middleware:

```js
function requireScope(scope) {
  return (req, res, next) => {
    if (!req.user?.scopes?.includes(scope)) {
      return res.status(403).json({
        error: "Forbidden"
      });
    }

    next();
  };
}
```

Usage:

```js
app.post(
  "/deals/:id/approve",
  authenticate,
  requireScope("deal.approve"),
  approveDeal
);
```

Then business logic still performs:

```text
authenticate
      ↓
scope check
      ↓
load deal
      ↓
check user can approve THIS deal
      ↓
check business rules
      ↓
approve
```

---

# 45. Where Should Permissions Come From?

## Token claims

```json
{
  "roles": ["manager"],
  "scope": "deal.read deal.approve"
}
```

Advantages:

- fast
- local decision

Trade-off:

> Permissions can become stale until token expiry.

## Database

```text
User → Roles → Permissions
```

More dynamic, but requires lookup/cache.

## Policy engine

```text
Node.js
   ↓
Policy Engine
   ↓
ALLOW / DENY
```

Useful for sophisticated ABAC/policy-driven systems.

---

# 46. Distributed Authorization Challenge

Suppose you have:

```text
10 Node.js services
```

and permissions change.

If authorization is entirely embedded in long-lived JWTs:

```text
Old token
   ↓
Old permissions
```

The permission change may not take effect until token expiry.

Possible approaches:

- short-lived access tokens
- centralized authorization
- token introspection where appropriate
- permission/version checks
- revocation/deny lists for exceptional cases
- centralized policy service/cache

Trade-off:

```text
JWT-only
→ fast/local
→ potentially stale

Central authorization
→ more dynamic
→ additional latency/dependency
```

---

# 47. Banking Authorization Example

Suppose:

```text
RM → creates deal
Manager → approves deal
GM → approves high-value deal
```

Permissions:

```text
deal.read
deal.create
deal.approve
deal.approve.high_value
```

Business constraints:

```text
RM:
  deal.create

Manager:
  deal.approve
  approvalLimit = 1M

GM:
  deal.approve.high_value
  approvalLimit = 10M
```

Approval flow:

```text
Is authenticated?
       ↓
Valid token?
       ↓
Has deal.approve?
       ↓
Can access this deal?
       ↓
Is deal in PENDING state?
       ↓
Amount <= approval limit?
       ↓
Approve
```

This is stronger than:

```js
if (user.role === "manager")
```

---

# 48. Senior Authorization Interview Answer

> **“I'd separate authentication from authorization. The IdP authenticates the user and issues an access token containing appropriate scopes or claims. Services validate the token and perform coarse-grained permission checks using scopes or roles. For sensitive resources, I'd additionally perform resource-level and business-rule authorization inside the owning service. For complex policies, I'd consider ABAC or a centralized policy engine. I'd also consider token lifetime and permission-change propagation so that revoked permissions don't remain effective longer than acceptable.”**

---

# 49. API Design & REST

REST is an architectural style based around resources.

Prefer:

```http
GET    /customers/123
POST   /customers
PUT    /customers/123
PATCH  /customers/123
DELETE /customers/123
```

over RPC-style endpoints such as:

```http
POST /getCustomer
POST /createCustomer
POST /deleteCustomer
```

Mental model:

> **URL identifies the resource; HTTP method expresses the operation.**

---

# 50. HTTP Methods and Idempotency

| Method | Typical purpose | Idempotent? |
|---|---|---|
| GET | Read | Yes |
| POST | Create/action | Usually No |
| PUT | Replace resource | Yes |
| PATCH | Partial update | Can be |
| DELETE | Delete | Yes |

Idempotent means repeated execution produces the same intended final state.

Example:

```http
PUT /customers/123
```

with:

```json
{
  "name": "John"
}
```

Calling it once or five times should leave:

```text
customer 123
name = John
```

---

# 51. POST and Idempotency Keys

Consider:

```http
POST /payments
```

Client sends:

```json
{
  "amount": 1000
}
```

Network timeout occurs.

The client does not know whether the payment succeeded.

Blind retry can produce:

```text
Request 1 → Payment created
Request 2 → Payment created

💥 Duplicate payment
```

Use an idempotency key:

```http
POST /payments
Idempotency-Key: 8f7a-1234
```

Server stores:

```text
idempotency_key → result
```

Flow:

```text
First request
    ↓
Process payment
    ↓
Store result

Retry
    ↓
Same key
    ↓
Return previous result
```

This is especially important in financial systems.

---

# 52. Pagination

Do not expose an endpoint that can return millions of records in one response:

```http
GET /customers
```

Use pagination.

## Offset pagination

```http
GET /customers?page=3&limit=50
```

Simple, but on frequently changing datasets records can move between pages when inserts/deletes occur.

## Cursor pagination

```http
GET /customers?limit=50&cursor=eyJpZCI6...
```

Response:

```json
{
  "data": [...],
  "nextCursor": "abc123"
}
```

Conceptually:

```text
First request
       ↓
Records 1-50
       ↓
cursor
       ↓
Next request
       ↓
Records 51-100
```

For large/frequently changing datasets, cursor-based pagination is generally preferable, with a deterministic indexed sort key.

Interview answer:

> **“I'd use offset pagination for simpler administrative/listing APIs, but for large or frequently changing datasets I'd generally prefer cursor-based pagination with a deterministic indexed sort key.”**

---

# 53. Filtering and Sorting

Filtering:

```http
GET /customers?region=dubai&status=active&segment=highvalue
```

Sorting:

```http
GET /customers?sort=createdAt&order=desc
```

Do not blindly inject user-provided sort fields into database queries.

Whitelist allowed fields:

```js
const allowedSortFields = [
  "createdAt",
  "name",
  "status"
];
```

---

# 54. API Versioning

APIs evolve.

Example:

```http
/api/v1/customers
/api/v2/customers
```

Common approaches include:

### URL versioning

```text
/v1/customers
```

Simple and common.

### Header versioning

```http
Accept: application/vnd.company.v2+json
```

More sophisticated but less obvious.

For many enterprise systems:

> URL versioning is simple and operationally easy.

---

# 55. Backward Compatibility

Suppose:

```text
v1:
{
  "customerName": "John"
}
```

and v2 changes it to:

```text
v2:
{
  "name": "John"
}
```

Do not suddenly break existing v1 consumers.

Consider:

- existing consumers
- mobile clients
- third-party integrations
- deprecation period
- migration strategy

Possible architecture:

```text
                 API Gateway
                     ↓
          ┌──────────┴──────────┐
          ↓                     ↓
        v1 API                v2 API
```

---

# 56. HTTP Status Codes

Know these well:

```text
200 OK
201 Created
202 Accepted
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests

500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
504 Gateway Timeout
```

Particularly useful:

### 201 Created

Resource successfully created.

### 202 Accepted

Request accepted for asynchronous processing.

Example:

```http
POST /reports
```

If generation takes minutes:

```http
202 Accepted
```

```json
{
  "jobId": "123",
  "status": "PROCESSING"
}
```

Then:

```http
GET /reports/jobs/123
```

---

# 57. Standardized Error Responses

Avoid inconsistent errors:

```json
{
  "error": "something went wrong"
}
```

Prefer:

```json
{
  "code": "CUSTOMER_NOT_FOUND",
  "message": "Customer was not found",
  "correlationId": "abc123"
}
```

Validation example:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request",
  "details": [
    {
      "field": "email",
      "reason": "Invalid email"
    }
  ]
}
```

Do not expose:

```text
database stack traces
SQL statements
internal hostnames
secrets
implementation details
```

---

# 58. Request Validation in APIs

Never trust:

```js
req.body
req.params
req.query
req.headers
```

Validate:

```text
type
required fields
length
format
range
allowed values
business constraints
```

Common Node/NestJS options mentioned in the preparation:

```text
Joi
Zod
class-validator
```

---

# 59. Controller / Service / Repository

Avoid putting hundreds of lines of business logic in the controller:

```js
app.post("/customer", async (req, res) => {
   // 300 lines of business logic
});
```

Prefer:

```text
Controller
    ↓
Service
    ↓
Repository / Data Access
    ↓
Database
```

Example:

```text
HTTP Controller
      ↓
CustomerService
      ↓
CustomerRepository
      ↓
MongoDB / Oracle
```

### Controller

Handles:

- HTTP
- validation
- authentication/authorization integration
- response mapping

### Service

Handles:

- business logic
- orchestration
- business rules

### Repository

Handles:

- database interaction

---

# 60. API Gateway vs Node Service

Typical architecture:

```text
Client
  ↓
API Gateway
  ↓
Node Service
  ↓
Database
```

Gateway may handle:

- TLS termination
- authentication
- rate limiting
- routing
- request size limits
- observability
- API policies

Service handles:

- business authorization
- business rules
- domain logic
- database operations

Do not turn the gateway into the entire business layer.

---

# 61. API Timeouts and Downstream Calls

Every external dependency should have appropriate timeouts.

Examples:

```text
Node API
   │
   ├── Redis timeout
   ├── DB query timeout
   ├── External API timeout
   └── Kafka operation timeout
```

Without timeouts, a hanging dependency can consume connections and cause cascading failure.

Combine with:

```text
Timeout
+
Retry
+
Backoff
+
Circuit breaker
```

where appropriate.

---

# 62. Retry + Idempotency

Suppose:

```text
Node API
   ↓
Payment Service
```

Payment request times out.

Retrying is only safe if the operation is designed for it.

```text
Retry
   ↓
Same Idempotency-Key
   ↓
Payment Service
   ↓
Return existing result
```

Key principle:

> **Retries without idempotency can create duplicate side effects.**

---

# 63. API Performance

Production API design should consider:

```text
Client
 ↓
Gateway
 ↓
Node
 ↓
Cache?
 ↓
DB
```

Consider:

- connection pooling
- Redis caching
- DB indexes
- pagination
- response compression where appropriate
- streaming for large payloads
- bounded concurrency
- avoiding N+1 queries
- timeouts
- connection reuse

Measure:

```text
P50
P95
P99
throughput
error rate
timeouts
DB latency
event-loop delay
```

---

# 64. Synchronous vs Asynchronous APIs

Do not make a client wait several minutes for a long-running operation.

Instead:

```text
POST /large-report
       ↓
202 Accepted
       ↓
jobId
```

Backend:

```text
API
 ↓
Queue
 ↓
Worker
 ↓
Generate report
 ↓
Object Storage
```

Client:

```text
GET /jobs/{jobId}
```

This is more resilient for long-running processing.

---

# 65. Example: Approve a Deal API

A reasonable design:

```http
POST /deals/{dealId}/approval
```

Headers:

```http
Authorization: Bearer <token>
Idempotency-Key: <unique-key>
```

Backend:

```text
Authenticate
    ↓
Validate token
    ↓
Check deal.approve permission
    ↓
Load deal
    ↓
Check user can access deal
    ↓
Check deal status = PENDING
    ↓
Check approval limit
    ↓
Perform transaction
    ↓
Publish event
    ↓
Return result
```

Response can be:

```http
200 OK
```

or, if processing asynchronously:

```http
202 Accepted
```

---

# 66. Senior API Design Mental Model

```text
             API DESIGN
                 │
     ┌───────────┼───────────┐
     ↓           ↓           ↓
  Resource    Contract     Security
     │           │           │
   REST       Validation   AuthN/AuthZ
   Methods    Errors       Rate limits
     │         Status      Input limits
     ↓           ↓
 Pagination   Versioning
 Filtering    Compatibility
 Sorting
     │
     ↓
 Reliability
     │
 Timeouts
 Retries
 Idempotency
 Circuit breaker
 Async processing
```

### Interview-ready answer

> **“For a production Node.js API, I'd design resource-oriented endpoints with clear HTTP semantics, validate all input, standardize error responses and status codes, use pagination for collections, version APIs when breaking changes are required, and make retryable operations idempotent. For long-running work I'd use asynchronous processing with a job ID rather than holding an HTTP request open. In a microservice architecture I'd also enforce authentication, authorization, timeouts, rate limits, observability and downstream failure handling.”**

---

# 67. Interview Rapid Fire

### Security

**Q: Authentication vs authorization?**

> Authentication establishes identity; authorization determines what that identity is allowed to do.

**Q: Is decoding a JWT enough?**

> No. The server must cryptographically verify the signature and validate claims such as issuer, audience, expiry and applicable scopes/roles.

**Q: Is JWT encrypted?**

> Normally no. JWTs are commonly signed, not encrypted. The payload can generally be decoded.

**Q: How do you prevent SQL injection?**

> Parameterized queries/prepared statements, safe query construction and input validation.

**Q: Can MongoDB have injection vulnerabilities?**

> Yes. NoSQL injection can occur when untrusted objects/operators are passed directly into database queries.

**Q: Does CORS secure an API?**

> No. CORS restricts browser-based cross-origin access; it isn't authentication or authorization.

**Q: How do you protect Node from malicious large requests?**

> Request-size limits, streaming where appropriate, timeouts, rate limiting and bounded processing.

**Q: How do you handle secrets?**

> External secret management rather than source code/config committed to repositories, with least-privilege access and careful logging.

### Authentication / OAuth

**Q: Is JWT an authentication protocol?**

> No. JWT is a token format. OAuth 2.0 is an authorization framework, while OIDC provides an identity/authentication layer.

**Q: How does an API know a JWT wasn't modified?**

> It verifies the JWT's cryptographic signature using the issuer's public key.

**Q: Can the client modify the JWT payload?**

> It can physically modify it, but the modified token will fail signature verification.

**Q: Can the client read the JWT payload?**

> Yes, for a normal signed JWT, the payload is encoded rather than encrypted.

**Q: Where does the API get the public key?**

> Typically from the identity provider's JWKS endpoint, with appropriate key caching.

**Q: ID token vs access token?**

> ID token represents authentication/identity information for the client; access token is the credential presented to an API for authorization.

**Q: 401 vs 403?**

> 401 means authentication failed/missing; 403 means the authenticated caller isn't permitted to perform the operation.

**Q: Biggest JWT disadvantage?**

> Immediate revocation is harder than with centrally managed sessions, so token lifetime and revocation strategy must be designed carefully.

### OAuth

**Q: Why PKCE?**

> PKCE protects the authorization-code flow against authorization-code interception by binding the token exchange to the original code verifier.

**Q: Why can't a React SPA safely use a client secret?**

> Anything shipped to the browser can potentially be extracted, so a SPA is treated as a public client and should use Authorization Code + PKCE.

**Q: Does PKCE encrypt the authorization code?**

> No. It proves possession of the verifier associated with the authorization request.

**Q: Which OAuth flow between microservices?**

> Usually Client Credentials because there is no end-user involved.

### Authorization

**Q: RBAC?**

> Permissions based on roles.

**Q: ABAC?**

> Permissions based on attributes and context.

**Q: Scope?**

> Granted access to resources/APIs represented in a token.

**Q: Can a valid JWT access every API?**

> No. Validate audience, scopes/roles and resource/business authorization.

**Q: Should the gateway handle all authorization?**

> No. Critical resource/business authorization should remain in the service.

**Q: Can `role=admin` in JWT alone be sufficient?**

> Usually no. Consider resource-level and business constraints.

---

# 68. Senior/SDE3 Scenarios

## Scenario 1 — Secure a Node.js Microservice

Strong answer:

> **“I'd use an enterprise IdP with OAuth/OIDC, accept access tokens intended for my API, validate the signature and claims such as issuer, audience and expiry, then enforce authorization using scopes/roles. I'd also enforce TLS, input validation, rate limits, payload limits, secure secret management and structured security logging. For distributed services, I'd explicitly define the trust boundary between the gateway and individual services rather than blindly trusting client-supplied identity headers.”**

---

## Scenario 2 — Design Enterprise Authorization

Strong answer:

> **“I'd separate authentication from authorization. The IdP authenticates the user and issues an access token containing appropriate scopes or claims. Services validate the token and perform coarse-grained permission checks using scopes or roles. For sensitive resources, I'd additionally perform resource-level and business-rule authorization inside the owning service. For complex policies, I'd consider ABAC or a centralized policy engine. I'd also consider token lifetime and permission-change propagation so that revoked permissions don't remain effective longer than acceptable.”**

---

## Scenario 3 — Payment API

Requirements:

```text
POST /payments
```

Main concern:

```text
network timeout
+
retry
+
duplicate payment
```

Design:

```text
Client
  ↓
POST /payments
Idempotency-Key
  ↓
Authenticate
  ↓
Authorize
  ↓
Validate
  ↓
Process payment
  ↓
Persist result against idempotency key
  ↓
Return result
```

Key principle:

> **Financial APIs must explicitly design for retries and duplicate side effects.**

---

## Scenario 4 — Deal Approval

```text
POST /deals/{dealId}/approval
```

Do not stop at:

```text
role == manager
```

Use layered checks:

```text
Authentication
      ↓
Token validation
      ↓
deal.approve permission
      ↓
Resource-level access
      ↓
Deal state
      ↓
Approval limit
      ↓
Transaction
```

---

## Scenario 5 — Long-Running Report

Bad:

```text
POST /large-report
      ↓
hold HTTP connection for 5 minutes
```

Better:

```text
POST /large-report
       ↓
202 Accepted
       ↓
jobId

API
 ↓
Queue
 ↓
Worker
 ↓
Object Storage

GET /jobs/{jobId}
```

---

# 69. Quick Revision

## Security

```text
Untrusted request
       ↓
TLS
       ↓
Gateway/WAF
       ↓
Authentication
       ↓
Authorization
       ↓
Validation
       ↓
Business rules
       ↓
Safe DB/external access
```

Remember:

- Never trust client input.
- Verify JWTs; do not merely decode them.
- Validate signature, issuer, audience, expiry and relevant authorization claims.
- JWT payloads are normally readable.
- Parameterize SQL.
- Prevent NoSQL injection.
- Avoid unsafe command execution.
- Prevent path traversal.
- Protect secrets externally.
- Never log tokens/passwords/customer-sensitive data.
- Use TLS.
- Rate-limit abusive traffic.
- Protect against event-loop blocking and ReDoS.
- CORS is not authentication.
- Do not leak internal errors.
- Scan dependencies.

## Authentication

```text
OAuth 2.0 → authorization framework
OIDC      → identity/authentication layer
JWT       → token format
```

```text
User app → Authorization Code + PKCE
Service → Service → Client Credentials
```

```text
Access Token → API
ID Token     → Client identity/authentication context
Refresh Token → Obtain new access token
```

## Authorization

```text
Authentication
      ↓
Token validation
      ↓
Scope / Role
      ↓
Resource-level check
      ↓
Business rules
```

```text
RBAC → role-based
ABAC → attribute/context-based
Scope → token/API access
```

## API Design

```text
Resource
+
HTTP method
+
Validation
+
Error contract
+
Pagination
+
Versioning
+
Security
+
Reliability
```

Key patterns:

```text
POST + Idempotency-Key
Cursor pagination for large/changing datasets
202 + jobId for long-running work
Controller → Service → Repository
Gateway → infrastructure/coarse policies
Service → domain/business authorization
Timeout + Retry + Backoff + Circuit Breaker
```

---

# 70. Connections to Other Files

- **File 03 — Streams, Buffers & Backpressure:** large request/response bodies, streaming and bounded processing.
- **File 04 — HTTP, Networking & Connections:** HTTP lifecycle, keep-alive, connection pools and timeouts.
- **File 05 — Performance, Memory & Profiling:** event-loop delay, CPU/memory impact, API performance.
- **File 06 — Errors, Resilience & Reliability:** retries, timeouts, circuit breakers, graceful failure.
- **File 07 — Processes, Workers & Scaling:** Worker Threads and handling CPU-intensive work.
- **File 09 — Microservices & Distributed Systems:** service-to-service communication and distributed reliability.

---

# 71. Final Architect Mental Model

```text
                         Client
                           │
                           ▼
                      TLS / WAF
                           │
                           ▼
                    API Gateway
                           │
              ┌────────────┴────────────┐
              │                         │
       AuthN / coarse AuthZ        Rate limits
              │
              ▼
                       Node API
                           │
                    Token validation
                           │
                    Scope / Role
                           │
                  Resource authorization
                           │
                    Business rules
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
             DB          Redis       Services
              │            │            │
              └────────────┼────────────┘
                           │
                     Timeouts /
                 Retry / Backoff /
                 Circuit Breaker
                           │
                     Observability
```

### The key principle

> **A production API is not just a URL and controller. It is a security, authorization, contract, reliability and scalability boundary.**

---

## Source Coverage

This file intentionally covers **Topics 21–25 only**.

- Topic 21 → Security fundamentals
- Topic 22 → Authentication architecture
- Topic 23 → OAuth 2.0 and PKCE
- Topic 24 → API authorization
- Topic 25 → REST/API design

No material from Topics 26–27 is treated as source coverage in this file.
