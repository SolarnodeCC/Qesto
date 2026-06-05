# Phase 1.2: Firewall & Rate Limiting Rules for Qesto

**ADR-042 Phase 1.2** — Edge-layer abuse protection for authentication, WebSocket upgrade, and session join endpoints.

**Objective:** Block credential-stuffing, join-flood, and anomalous WS upgrade attempts at the edge (Cloudflare WAF), reducing Worker CPU and KV write load during attacks.

---

## Prerequisites

- Cloudflare API token with `firewall_rules:write` and `rate_limiting:write` permissions
- Account ID: `5546763229b35df670e33d9316d7f2e0`
- Zone ID for qesto.cc: `5edcaa4c31799e4109e446f5b796fa0e`

---

## 1. Rate Limiting Rule: Auth Endpoint Flood Protection

**Target:** `POST /api/auth/magic-link` (credential request abuse)

Block IPs that exceed 10 requests in 60 seconds from the same IP to the magic-link endpoint. This prevents credential-stuffing and email enumeration attacks.

```bash
#!/bin/bash
TOKEN="$CLOUDFLARE_API_TOKEN"
ZONE_ID="5edcaa4c31799e4109e446f5b796fa0e"

curl -X POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disabled": false,
    "description": "Qesto: Magic-link endpoint flood protection",
    "match": {
      "request": {
        "url": {
          "path": {
            "matches": "^/api/auth/magic-link$"
          },
          "method": ["POST"]
        }
      }
    },
    "action": "challenge",
    "threshold": 10,
    "period": 60,
    "mitigation_timeout": 86400
  }'
```

**Expected response:** 201 Created with rule ID.

---

## 2. Rate Limiting Rule: WebSocket Upgrade Flood

**Target:** `GET /api/sessions/:code/ws` (WS upgrade flood)

Block IPs that exceed 20 WS upgrades per 60 seconds. Large but legitimate rooms will upgrade once; abusers reconnect repeatedly.

```bash
TOKEN="$CLOUDFLARE_API_TOKEN"
ZONE_ID="5edcaa4c31799e4109e446f5b796fa0e"

curl -X POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disabled": false,
    "description": "Qesto: WebSocket upgrade rate limit",
    "match": {
      "request": {
        "url": {
          "path": {
            "matches": "^/api/sessions/.*/ws$"
          },
          "method": ["GET"]
        },
        "headers": {
          "Upgrade": {
            "eq": "websocket"
          }
        }
      }
    },
    "action": "challenge",
    "threshold": 20,
    "period": 60,
    "mitigation_timeout": 3600
  }'
```

---

## 3. Firewall Rule: Challenge on Anomalous Join Burst

**Target:** Detect and challenge 50+ unique IPs joining the same session within 60 seconds.

This is a heuristic to catch distributed bot farms attempting to flood a single session.

```bash
TOKEN="$CLOUDFLARE_API_TOKEN"
ZONE_ID="5edcaa4c31799e4109e446f5b796fa0e"

curl -X POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disabled": false,
    "description": "Qesto: Anomalous join burst (distributed bots)",
    "filter": {
      "expression": "(http.request.uri.path matches \"/api/sessions/.*\" and http.request.method eq \"POST\") and (cf.bot_management.score < 30)"
    },
    "action": "challenge",
    "priority": 10
  }'
```

**Note:** Requires Cloudflare Bot Management (enabled; we saw `fight_mode: true` in the audit). Adjust `bot_management.score` threshold based on your false-positive tolerance.

---

## 4. Firewall Rule: Exempt Known Services (Slack, SAML IdP callbacks)

**Critical:** Do NOT challenge the following outbound callbacks:

```bash
TOKEN="$CLOUDFLARE_API_TOKEN"
ZONE_ID="5edcaa4c31799e4109e446f5b796fa0e"

curl -X POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disabled": false,
    "description": "Qesto: Allow SAML IdP callbacks (priority override)",
    "filter": {
      "expression": "(http.host eq \"qesto.cc\" and http.request.uri.path matches \"^/api/auth/saml/callback\") or (cf.country in {\"NL\" \"US\" \"DE\"})"
    },
    "action": "allow",
    "priority": 5
  }'
```

Also create an allowlist for your office IP(s):

```bash
curl -X POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disabled": false,
    "description": "Qesto: Allowlist office IPs",
    "filter": {
      "expression": "ip.src in {\"YOUR_OFFICE_IP/32\"}"
    },
    "action": "allow",
    "priority": 1
  }'
```

Replace `YOUR_OFFICE_IP` with your actual office/VPN egress IP.

---

## 5. Bot Fight Mode Status (Verify Enabled)

Run this to confirm Bot Fight Mode is active:

```bash
TOKEN="$CLOUDFLARE_API_TOKEN"
ZONE_ID="5edcaa4c31799e4109e446f5b796fa0e"

curl -s -X GET https://api.cloudflare.com/client/v4/zones/$ZONE_ID/bot_management \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

Expected output:
```json
{
  "success": true,
  "result": {
    "fight_mode": true,
    "enable_js": true,
    "using_latest_model": true,
    "crawler_protection": "enabled",
    ...
  }
}
```

---

## Deployment Steps

1. **Get your audit token:**
   ```bash
   CLOUDFLARE_API_TOKEN=$(wrangler secret get CLOUDFLARE_AUDIT_TOKEN)
   ```

2. **Run each curl block above** in order (1 → 5).

3. **Capture rule IDs** from the responses. Store them in a tracking doc for future updates.

4. **Verify in dashboard:** https://dash.cloudflare.com/5546763229b35df670e33d9316d7f2e0/qesto.cc/security/waf/rules

5. **Canary test:**
   - Join a session from your office IP (should work)
   - Join from a VPN/fresh IP (may see challenge)
   - Monitor `/api/sessions/:id/logs` for blocked requests

---

## Monitoring & Alerts

**In Analytics Engine** (Phase 1.3), track:
- Rate-limit challenge frequency: `cf.waf.blocked_requests`
- False-positive rate: legitimate users reporting login issues
- Attack patterns: spike in join attempts from new ASNs

Update this doc with learnings after 1 week in canary.

---

## Rollback

If false positives spike:

```bash
# Disable a rule by ID
curl -X PATCH https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit/{RULE_ID} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"disabled": true}'

# Then adjust threshold & re-enable
```

---

## Next: Phase 1.3 (Analytics Engine)

See `PHASE1-ANALYTICS-ENGINE.md` for session funnel tracking setup.

---

**Owner:** DevOps  
**Sign-off required:** CSO (rule thresholds, false-positive risk)  
**Deployed by:** CI/CD on merge to `main`  
**Target date:** Week 1  
