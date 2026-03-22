# RGDGC Security Audit — 2026-03-22

## Summary
| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 3 | 1 (XSS) | 2 (rotate keys — manual) |
| High | 6 | 4 | 2 (web3 nonces, token blacklist fail-closed) |
| Medium | 10 | 4 | 6 |
| Low | 7 | 0 | 7 |
| Info | 5 | 0 | 5 |
| **Total** | **31** | **9** | **22** |

## Fixed This Session
1. CRITICAL-3: XSS in public HTML — added `html.escape()` on all user-controlled vars
2. HIGH-1: Timing attack on owner key — switched to `hmac.compare_digest()`
3. HIGH-3: Score input validation — added `Field(ge=1, le=20)` constraints
4. HIGH-6: Refresh token blacklist — now checks `is_token_blacklisted()` before issuing new tokens
5. MEDIUM-1: Password min length 8 chars
6. MEDIUM-2: Username validation `^[a-zA-Z0-9_-]+$`, 3-50 chars
7. MEDIUM-3: CORS restricted to specific methods/headers
8. MEDIUM-4: Security headers middleware (X-Content-Type-Options, X-Frame-Options, etc.)
9. MEDIUM-6: Docker non-root user

## Still Requires Manual Action
- CRITICAL-1: Rotate blockchain deployer private key (contracts/.env)
- CRITICAL-2: Revoke Mapbox secret token (mobile/.env)
- HIGH-2: Move web3 nonces to Redis
- HIGH-4: Fail-closed token blacklist when Redis down
- HIGH-5: Separate UserPublicOut schema (hide email/phone)

## Security Tooling Added
- `scripts/security-audit.sh` — automated scan, run in CI or locally
- Checks: secrets in code, auth patterns, XSS protection, input validation, Docker config, dependencies

## Recommended Next Steps
1. Run `./scripts/security-audit.sh` before every deploy
2. Add `gitleaks` pre-commit hook to prevent secret commits
3. Add `bandit` + `pip-audit` to CI pipeline
4. Migrate from `python-jose` to `PyJWT`
5. Implement user data anonymization for GDPR compliance
